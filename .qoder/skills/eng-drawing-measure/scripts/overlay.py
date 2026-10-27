#!/usr/bin/env python3
"""把程序算出的单个视图(渲染图)叠回扫描件,给出偏差报告。

对齐方式:取双方墨迹外接框做初值(宽、高、二者的均值都可作为起点),
再做平移/缩放的坐标下降。默认用相似变换(可水平镜像);扫描件本身
有拉伸误差时用 --aniso 允许横纵比例不同,或用默认模式让宽高比差
直接出现在 warnings 里。

报告:
  dev_px        渲染线到扫描墨迹的距离(mean/p95/max)与容差内比例
  explained_pct 扫描墨迹被渲染线覆盖的比例
  extra         渲染线里扫描件没有的部分(疑似多画),带 bbox 与线段
  missing       扫描件里渲染线没有的部分(疑似漏画),带 bbox 与线段
  warnings      对齐质量、宽高比、页框线等提示

用法:
  overlay.py IMG --region x0,y0,x1,y1 --render view.pgm [--rot 0]
             [--flip auto|none|x] [--tol 3] [--aniso]
             [--exclude x0,y0,x1,y1]... [--out overlay.png] [--text]

坐标:输入 --region/--exclude 为图像像素坐标,输出的 bbox/线段同为
图像像素坐标。渲染图应是白底深线、只含一个视图;多视图请分别叠加。
"""
from __future__ import annotations

import argparse
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

try:
    import cv2
except Exception:  # noqa: BLE001
    cv2 = None


def fail(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def otsu(a: np.ndarray) -> int:
    hist = np.bincount(a.ravel(), minlength=256).astype(float)
    total = float(a.size)
    sum_all = float((np.arange(256) * hist).sum())
    w_b = sum_b = 0.0
    best, thr = -1.0, 127
    for t in range(256):
        w_b += hist[t]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += t * hist[t]
        m_b, m_f = sum_b / w_b, (sum_all - sum_b) / w_f
        var = w_b * w_f * (m_b - m_f) ** 2
        if var > best:
            best, thr = var, t
    return thr


def bbox_of(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def ink_points(mask: np.ndarray, limit: int = 60000) -> np.ndarray:
    """返回 (N,2) 的 (x,y) 墨迹像素,必要时等间隔抽稀。"""
    ys, xs = np.where(mask)
    pts = np.stack([xs, ys], axis=1).astype(np.float64)
    if len(pts) > limit:
        idx = np.linspace(0, len(pts) - 1, limit).astype(int)
        pts = pts[idx]
    return pts


def sample_dev(pts: np.ndarray, dt: np.ndarray, sx: float, sy: float,
               tx: float, ty: float, out_penalty: float) -> np.ndarray:
    h, w = dt.shape
    xs = pts[:, 0] * sx + tx
    ys = pts[:, 1] * sy + ty
    inside = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
    xi = np.clip(xs.astype(int), 0, w - 1)
    yi = np.clip(ys.astype(int), 0, h - 1)
    return np.where(inside, dt[yi, xi], out_penalty)


def fit(pts: np.ndarray, dt: np.ndarray, sx0: float, sy0: float,
        tx0: float, ty0: float, out_penalty: float, aniso: bool
        ) -> tuple[float, float, float, float, float]:
    """坐标下降求 (sx, sy, tx, ty);aniso=False 时 sx≡sy。返回 (mean, sx, sy, tx, ty)。"""
    s0 = (sx0 + sy0) / 2

    def mean_at(sx: float, sy: float, tx: float, ty: float) -> float:
        return float(sample_dev(pts, dt, sx, sy, tx, ty, out_penalty).mean())

    def score(sx: float, sy: float, tx: float, ty: float) -> float:
        # 轻微惩罚偏离起始尺度,避免搜索缩成一团;--aniso 的尺度细化不带惩罚
        return mean_at(sx, sy, tx, ty) + 2.0 * (abs(sx / s0 - 1.0) + abs(sy / s0 - 1.0)) / 0.01

    def descend(fn, best, span: float, step: float):
        _, sx, sy, tx, ty = best
        for dx in np.arange(-span, span + 1e-9, step):
            for dy in np.arange(-span, span + 1e-9, step):
                cand = (fn(sx, sy, tx + dx, ty + dy), sx, sy, tx + dx, ty + dy)
                if cand[0] < best[0]:
                    best = cand
        return best

    best = (score(s0, s0, tx0, ty0), s0, s0, tx0, ty0)
    best = descend(score, best, 8.0, 2.0)
    for pct in np.arange(-0.02, 0.0201, 0.005):
        _, sx, sy, tx, ty = best
        cand = (score(s0 * (1 + pct), s0 * (1 + pct), tx, ty),
                s0 * (1 + pct), s0 * (1 + pct), tx, ty)
        if cand[0] < best[0]:
            best = cand
    best = descend(score, best, 1.0, 0.5)

    if aniso:
        # 各向异性细化:既从均匀结果出发,也从"宽比宽、高比高"的形变种子出发,
        # 否则拉伸超过 ±4% 的扫描件永远搜不到正确横纵比例
        seeds = [(best[1], best[2], best[3], best[4]), (sx0, sy0, best[3], best[4])]
        overall = mean_at(*best[1:])
        for sx, sy, tx, ty in seeds:
            seed = (mean_at(sx, sy, tx, ty), sx, sy, tx, ty)
            for pct in np.arange(-0.04, 0.0401, 0.01):
                for pct2 in np.arange(-0.04, 0.0401, 0.01):
                    _, sx, sy, tx, ty = seed
                    cand = (mean_at(sx * (1 + pct), sy * (1 + pct2), tx, ty),
                            sx * (1 + pct), sy * (1 + pct2), tx, ty)
                    cand = descend(mean_at, cand, 2.0, 1.0)
                    if cand[0] < seed[0]:
                        seed = cand
            if seed[0] < overall:
                overall = seed[0]
                best = (overall, seed[1], seed[2], seed[3], seed[4])
    return mean_at(*best[1:]), best[1], best[2], best[3], best[4]


def rasterize(pts: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    m = np.zeros(shape, dtype=bool)
    h, w = shape
    xs = np.clip(pts[:, 0].astype(int), 0, w - 1)
    ys = np.clip(pts[:, 1].astype(int), 0, h - 1)
    m[ys, xs] = True
    return m


def components(mask: np.ndarray, min_px: int) -> list[dict]:
    out: list[dict] = []
    if cv2 is not None:
        n, _, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
        for i in range(1, n):
            x, y, w, h, area = stats[i]
            if area >= min_px:
                out.append({'bbox': [int(x), int(y), int(x + w), int(y + h)], 'px': int(area)})
    else:
        lbl, _ = ndimage.label(mask)
        for sl in ndimage.find_objects(lbl):
            area = int(mask[sl].sum())
            if area >= min_px:
                out.append({'bbox': [sl[1].start, sl[0].start, sl[1].stop, sl[0].stop],
                            'px': area})
    out.sort(key=lambda d: -d['px'])
    return out


def segments(mask: np.ndarray, min_len: int) -> list[list[int]]:
    if cv2 is None or mask.sum() < 20:
        return []
    try:
        lines = cv2.HoughLinesP(mask.astype(np.uint8), 1, np.pi / 360, threshold=12,
                                minLineLength=min_len, maxLineGap=6)
    except Exception:  # noqa: BLE001
        return []
    if lines is None:
        return []
    arr = np.asarray(lines)
    if arr.ndim == 3:
        arr = arr[:, 0, :]
    found = [list(map(int, row)) for row in arr]
    found.sort(key=lambda s: -math.hypot(s[2] - s[0], s[3] - s[1]))
    return found[:12]


def annotate(comps: list[dict], mask: np.ndarray, off: tuple[int, int], tol: float) -> None:
    """给每个连通块补上 bbox/线段(换成原图坐标)。"""
    ox, oy = off
    for comp in comps:
        xa, ya, xb, yb = comp['bbox']
        segs = segments(mask[ya:yb + 1, xa:xb + 1], min_len=max(12, int(tol * 4)))
        comp['segments'] = [[sx + xa + ox, sy + ya + oy, ex + xa + ox, ey + ya + oy]
                            for sx, sy, ex, ey in segs]
        comp['bbox'] = [xa + ox, ya + oy, xb + ox, yb + oy]


def draw_result(gray: np.ndarray, src_ink: np.ndarray, r_ink: np.ndarray,
                extra: list[dict], missing: list[dict], out: str) -> None:
    base = 255 - (255 - gray.astype(np.int16)) // 3
    img = np.stack([base, base, base], axis=2).astype(np.uint8)
    img[src_ink] = (175, 195, 220)
    img[r_ink] = (220, 40, 40)
    pic = Image.fromarray(img)
    dr = ImageDraw.Draw(pic)
    for comp in extra[:20]:
        xa, ya, xb, yb = comp['bbox_xy']
        dr.rectangle([xa, ya, xb, yb], outline=(230, 0, 160), width=1)
    for comp in missing[:20]:
        xa, ya, xb, yb = comp['bbox_xy']
        dr.rectangle([xa, ya, xb, yb], outline=(0, 150, 90), width=1)
    pic.save(out)


def main() -> None:
    ap = argparse.ArgumentParser(description='渲染视图叠加比对')
    ap.add_argument('image')
    ap.add_argument('--region', required=True, help='扫描件中的视图区域 x0,y0,x1,y1')
    ap.add_argument('--render', required=True, help='白底深线的单视图图(.pgm/.png)')
    ap.add_argument('--rot', type=int, default=0)
    ap.add_argument('--thr', type=int, default=None, help='扫描件二值阈值,默认 Otsu')
    ap.add_argument('--render-thr', type=int, default=128, help='渲染图二值阈值')
    ap.add_argument('--flip', choices=['auto', 'none', 'x'], default='auto')
    ap.add_argument('--tol', type=float, default=3.0, help='匹配容差(px)')
    ap.add_argument('--aniso', action='store_true', help='允许横向/纵向比例不同(扫描件有拉伸时)')
    ap.add_argument('--exclude', action='append', help='扫描件排除区 x0,y0,x1,y1,可重复')
    ap.add_argument('--out', help='叠加图输出路径')
    ap.add_argument('--text', action='store_true')
    args = ap.parse_args()

    try:
        src_im = Image.open(args.image).convert('L')
    except Exception as exc:  # noqa: BLE001
        fail(f"打不开 {args.image}: {exc}")
    if args.rot:
        src_im = src_im.rotate(args.rot, expand=True)
    src_full = np.array(src_im)
    H, W = src_full.shape
    try:
        x0, y0, x1, y1 = (int(v) for v in args.region.split(','))
    except ValueError:
        fail('--region 需要 x0,y0,x1,y1')
    x0, x1 = max(0, min(W, x0)), max(0, min(W, x1))
    y0, y1 = max(0, min(H, y0)), max(0, min(H, y1))
    if x1 - x0 < 10 or y1 - y0 < 10:
        fail('--region 区域太小')

    gray = src_full[y0:y1, x0:x1]
    thr = args.thr if args.thr is not None else otsu(gray)
    src_ink = gray < thr
    for spec in args.exclude or []:
        try:
            ex0, ey0, ex1, ey1 = (int(v) for v in spec.split(','))
        except ValueError:
            fail(f'--exclude 需要 x0,y0,x1,y1,收到 {spec!r}')
        src_ink[max(0, ey0 - y0):max(0, ey1 - y0), max(0, ex0 - x0):max(0, ex1 - x0)] = False
    if src_ink.sum() < 50:
        fail('扫描件区域内几乎没有墨迹,检查 --region/--thr')

    try:
        r_gray = np.array(Image.open(args.render).convert('L'))
    except Exception as exc:  # noqa: BLE001
        fail(f"打不开 {args.render}: {exc}")
    r_ink = r_gray < args.render_thr
    if r_ink.sum() < 50:
        fail('渲染图几乎没有墨迹,检查 --render 或 --render-thr')

    sb = bbox_of(src_ink)
    rb = bbox_of(r_ink)
    assert sb and rb
    sw, sh = sb[2] - sb[0] + 1, sb[3] - sb[1] + 1
    rw, rh = rb[2] - rb[0] + 1, rb[3] - rb[1] + 1
    # (sx, sy) 种子:--aniso 时先给"宽比宽、高比高"的形变起点
    starts: list[tuple[float, float]] = []
    cand_pairs: list[tuple[float, float]] = (
        [(sw / rw, sh / rh)] if args.aniso else []
    ) + [(v, v) for v in (sw / rw, sh / rh, (sw / rw + sh / rh) / 2)]
    for pair in cand_pairs:
        if all(abs(pair[0] / s[0] - 1) > 0.004 and abs(pair[1] / s[1] - 1) > 0.004
               for s in starts):
            starts.append(pair)

    pts0 = ink_points(r_ink)
    dt = ndimage.distance_transform_edt(~src_ink)
    out_penalty = args.tol * 6.0
    flips = ({'none': False, 'x': True} if args.flip == 'auto'
             else {'none': False} if args.flip == 'none' else {'x': True})
    best = None
    for name, flip in flips.items():
        pts = pts0.copy()
        if flip:
            pts[:, 0] = (r_gray.shape[1] - 1) - pts[:, 0]
        px0, px1 = pts[:, 0].min(), pts[:, 0].max()
        py0, py1 = pts[:, 1].min(), pts[:, 1].max()
        for s0x, s0y in starts:
            tx0 = sb[0] + sw / 2 - s0x * (px0 + px1) / 2
            ty0 = sb[1] + sh / 2 - s0y * (py0 + py1) / 2
            mean, sx, sy, tx, ty = fit(pts, dt, s0x, s0y, tx0, ty0, out_penalty, args.aniso)
            if best is None or mean < best[0]:
                best = (mean, sx, sy, tx, ty, name, flip, pts)
    assert best
    _, sx, sy, tx, ty, flip_name, flip, pts = best

    warped = np.stack([pts[:, 0] * sx + tx, pts[:, 1] * sy + ty], axis=1)
    dev = sample_dev(pts, dt, sx, sy, tx, ty, out_penalty)
    tol = args.tol
    within = float((dev <= tol).mean() * 100)

    r_ink_warped = rasterize(warped, gray.shape)
    extra_mask = rasterize(warped[dev > tol * 2], gray.shape)
    extra_mask &= ~ndimage.binary_dilation(src_ink, iterations=max(1, int(tol)))
    extra = components(extra_mask, min_px=25)[:20]
    annotate(extra, extra_mask, (x0, y0), tol)
    for comp in extra:
        comp['bbox_xy'] = [comp['bbox'][0] - x0, comp['bbox'][1] - y0,
                           comp['bbox'][2] - x0, comp['bbox'][3] - y0]

    dt_r = ndimage.distance_transform_edt(~r_ink_warped)
    missing_mask = src_ink & (dt_r > tol * 2)
    missing = components(missing_mask, min_px=40)[:20]
    annotate(missing, missing_mask, (x0, y0), tol)
    for comp in missing:
        comp['bbox_xy'] = [comp['bbox'][0] - x0, comp['bbox'][1] - y0,
                           comp['bbox'][2] - x0, comp['bbox'][3] - y0]

    explained = float(((~missing_mask)[src_ink]).mean() * 100)
    warnings: list[str] = []
    asp_s, asp_r = sw / sh, rw / rh
    if not args.aniso and abs(asp_s / asp_r - 1) > 0.03:
        warnings.append(
            f'源视图宽高比与渲染相差 {(asp_s / asp_r - 1) * 100:+.1f}%:'
            '扫描件可能被拉伸(或取区含页框/标注),可改用 --aniso 或收紧 --region')
    if within < 85:
        warnings.append(f'容差内比例仅 {within:.0f}%:确认 --region 只含目标视图、方向未颠倒')
    for comp in missing:
        bx0, by0, bx1, by1 = comp['bbox_xy']
        span_w = (bx1 - bx0) / (x1 - x0)
        span_h = (by1 - by0) / (y1 - y0)
        touches = (bx0 <= 2 or by0 <= 2 or bx1 >= (x1 - x0) - 3 or by1 >= (y1 - y0) - 3)
        if touches and (span_w > 0.6 or span_h > 0.6):
            warnings.append('有长直线未被解释且贴着取区边界,疑似页框/图框线,考虑 --exclude')
            break

    report = {
        'thr': int(thr),
        'fit': {
            'flip': flip_name,
            'scale_x': round(sx, 4),
            'scale_y': round(sy, 4),
            'tx': round(tx, 1),
            'ty': round(ty, 1),
        },
        'render_ink': int(len(pts)),
        'source_ink': int(src_ink.sum()),
        'within_tol_pct': round(within, 1),
        'explained_pct': round(explained, 1),
        'dev_px': {
            'mean': round(float(dev.mean()), 2),
            'p95': round(float(np.percentile(dev, 95)), 2),
            'max': round(float(dev.max()), 2),
        },
        'extra': extra,
        'missing': missing,
        'warnings': warnings,
    }
    if args.out:
        draw_result(gray, src_ink, r_ink_warped, extra, missing, args.out)
        report['overlay'] = args.out

    if args.text:
        f = report['fit']
        print(f"对齐 flip={f['flip']} scale=({f['scale_x']},{f['scale_y']}) "
              f"tx={f['tx']} ty={f['ty']}")
        print(f"偏差 mean={report['dev_px']['mean']}px p95={report['dev_px']['p95']}px "
              f"容差内 {report['within_tol_pct']}% / 扫描件解释 {report['explained_pct']}%")
        for w in warnings:
            print(f"提示: {w}")
        for tag, key in (('多画', 'extra'), ('漏画', 'missing')):
            items = report[key]
            if not items:
                continue
            print(f"{tag} {len(items)} 处:")
            for it in items[:8]:
                print(f"  bbox={it['bbox']} px={it['px']}")
                for seg in it['segments'][:4]:
                    print(f"    线段 {seg}")
    else:
        print(json.dumps(report, ensure_ascii=False, separators=(',', ':')))


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        fail(f'{type(exc).__name__}: {exc}')
