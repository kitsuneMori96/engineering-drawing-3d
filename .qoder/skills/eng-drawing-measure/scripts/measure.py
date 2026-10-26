#!/usr/bin/env python3
"""扫描件量线:读像素坐标、自动找横/竖直线、量间距。

所有坐标都是(可选旋转后的)图像像素坐标,原点左上。旋转与 PIL
Image.rotate(rot, expand=True) 一致,rot 为正表示逆时针。

用法:
  measure.py runs  IMG --region x0,y0,x1,y1 --rows 900,950 [--rot 0] [--thr N]
  measure.py runs  IMG --region x0,y0,x1,y1 --cols 300,310 [...]
  measure.py lines IMG --region x0,y0,x1,y1 [--axis h|v|both] [--min-len 40]
                   [--max-thick 8] [--thr N] [--invert] [--exclude x0,y0,x1,y1]...

输出:默认 JSON(供程序/模型直接读),--text 输出紧凑表格。
"""
from __future__ import annotations

import argparse
import json
import sys

import numpy as np
from PIL import Image


def fail(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def load(path: str, rot: int) -> np.ndarray:
    try:
        im = Image.open(path).convert('L')
    except Exception as exc:  # noqa: BLE001
        fail(f"打不开 {path}: {exc}")
    if rot:
        im = im.rotate(rot, expand=True)
    return np.array(im)


def parse_region(text: str, w: int, h: int, name: str = '--region') -> tuple[int, int, int, int]:
    try:
        x0, y0, x1, y1 = (int(v) for v in text.split(','))
    except ValueError:
        fail(f'{name} 需要 x0,y0,x1,y1 四个整数,收到 {text!r}')
    x0, x1 = max(0, min(w, x0)), max(0, min(w, x1))
    y0, y1 = max(0, min(h, y0)), max(0, min(h, y1))
    if x1 - x0 < 2 or y1 - y0 < 2:
        fail(f'{name} 区域为空: {x0},{y0},{x1},{y1}(图像 {w}x{h})')
    return x0, y0, x1, y1


def otsu(a: np.ndarray) -> int:
    hist = np.bincount(a.ravel(), minlength=256).astype(float)
    total = float(a.size)
    sum_all = float((np.arange(256) * hist).sum())
    w_b = 0.0
    sum_b = 0.0
    best = -1.0
    thr = 127
    for t in range(256):
        w_b += hist[t]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += t * hist[t]
        m_b = sum_b / w_b
        m_f = (sum_all - sum_b) / w_f
        var = w_b * w_f * (m_b - m_f) ** 2
        if var > best:
            best = var
            thr = t
    return thr


def runs(mask: np.ndarray) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    i, n = 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            out.append((i, j))
            i = j + 1
        else:
            i += 1
    return out


def cmd_runs(args: argparse.Namespace) -> dict:
    a = load(args.image, args.rot)
    h, w = a.shape
    x0, y0, x1, y1 = parse_region(args.region, w, h)
    if args.invert:
        a = 255 - a
    thr = args.thr if args.thr is not None else otsu(a[y0:y1, x0:x1])
    ink = a < thr
    out: dict = {'thr': int(thr), 'rows': [], 'cols': []}
    for y in args.rows or []:
        if not (y0 <= y < y1):
            fail(f'--rows 的 {y} 不在区域 y∈[{y0},{y1}) 内')
        out['rows'].append({
            'y': y,
            'runs': [[s + x0, e + x0] for s, e in runs(ink[y, x0:x1])],
        })
    for x in args.cols or []:
        if not (x0 <= x < x1):
            fail(f'--cols 的 {x} 不在区域 x∈[{x0},{x1}) 内')
        out['cols'].append({
            'x': x,
            'runs': [[s + y0, e + y0] for s, e in runs(ink[y0:y1, x])],
        })
    return out


def detect(ink: np.ndarray, axis: str, min_len: int, max_thick: int,
           min_cov: float) -> list[dict]:
    if axis == 'v':
        ink = ink.T
    min_run = max(8, min_len // 3)
    rows: dict[int, list[tuple[int, int]]] = {}
    for y in range(ink.shape[0]):
        rr = [(s, e) for s, e in runs(ink[y]) if e - s + 1 >= min_run]
        if rr:
            rows[y] = rr
    groups: list[dict] = []
    cur: dict | None = None
    for y in sorted(rows):
        if cur is not None and y == cur['ys'][-1] + 1 and len(cur['ys']) < max_thick:
            cur['ys'].append(y)
            cur['runs'].extend(rows[y])
        else:
            if cur is not None:
                groups.append(cur)
            cur = {'ys': [y], 'runs': list(rows[y])}
    if cur is not None:
        groups.append(cur)

    lines: list[dict] = []
    for g in groups:
        merged: list[list[int]] = []
        for s, e in sorted(g['runs']):
            if merged and s <= merged[-1][1] + 1:
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e])
        start, end = merged[0][0], merged[-1][1]
        extent = end - start + 1
        if extent < min_len:
            continue
        covered = sum(e - s + 1 for s, e in merged)
        coverage = covered / extent
        if coverage < min_cov:
            continue
        lines.append({
            'pos': round((g['ys'][0] + g['ys'][-1]) / 2, 1),
            'start': int(start),
            'end': int(end),
            'len': int(extent),
            'thickness': len(g['ys']),
            'coverage': round(coverage, 3),
            'dashed': coverage < 0.90,
            'gaps': max(0, len(merged) - 1),
        })
    lines.sort(key=lambda d: d['pos'])
    return lines


def cmd_lines(args: argparse.Namespace) -> dict:
    a = load(args.image, args.rot)
    h, w = a.shape
    x0, y0, x1, y1 = parse_region(args.region, w, h)
    if args.invert:
        a = 255 - a
    thr = args.thr if args.thr is not None else otsu(a[y0:y1, x0:x1])
    ink = a < thr
    for spec in args.exclude or []:
        ex0, ey0, ex1, ey1 = parse_region(spec, w, h, '--exclude')
        ink[ey0:ey1, ex0:ex1] = False

    out: dict = {'thr': int(thr), 'region': [x0, y0, x1, y1], 'h': [], 'v': []}
    for axis in ('h', 'v'):
        if args.axis not in (axis, 'both'):
            continue
        found = detect(ink[y0:y1, x0:x1], axis, args.min_len, args.max_thick, args.min_cov)
        if axis == 'h':
            for d in found:
                d['pos'] = round(d['pos'] + y0, 1)
                d['start'] += x0
                d['end'] += x0
        else:
            for d in found:
                d['pos'] = round(d['pos'] + x0, 1)
                d['start'] += y0
                d['end'] += y0
        out[axis] = found

    for axis in ('h', 'v'):
        lines = out[axis]
        if len(lines) > 1:
            out[f'diffs_{axis}'] = [
                [lines[i]['pos'], round(lines[i + 1]['pos'] - lines[i]['pos'], 1)]
                for i in range(len(lines) - 1)
            ]
    if len(out['h']) > 200:
        out['h'] = out['h'][:200]
        out['truncated'] = True
    if len(out['v']) > 200:
        out['v'] = out['v'][:200]
        out['truncated'] = True
    return out


def print_text(data: dict) -> None:
    if 'rows' in data or 'cols' in data:
        print(f"thr={data['thr']}")
        for r in data.get('rows', []):
            print(f"row y={r['y']}: " + ' '.join(f'[{s},{e}]' for s, e in r['runs']))
        for c in data.get('cols', []):
            print(f"col x={c['x']}: " + ' '.join(f'[{s},{e}]' for s, e in c['runs']))
        return
    for axis, title in (('h', '横线(H):pos=纵坐标'), ('v', '竖线(V):pos=横坐标')):
        lines = data[axis]
        print(f"{title} {len(lines)} 条")
        for d in lines:
            flag = '虚' if d['dashed'] else '实'
            print(
                f"  pos={d['pos']:>7} [{d['start']},{d['end']}] len={d['len']}"
                f" t={d['thickness']} cov={d['coverage']:.2f} {flag} gaps={d['gaps']}"
            )
        if data.get(f'diffs_{axis}'):
            print('  间距: ' + ', '.join(f'{p}→+{dv}' for p, dv in data[f'diffs_{axis}']))


def main() -> None:
    ap = argparse.ArgumentParser(description='扫描件量线工具')
    sub = ap.add_subparsers(dest='cmd', required=True)

    def common(p: argparse.ArgumentParser) -> None:
        p.add_argument('image')
        p.add_argument('--region', required=True, help='x0,y0,x1,y1(必填)')
        p.add_argument('--rot', type=int, default=0, help='逆时针旋转角度')
        p.add_argument('--thr', type=int, default=None, help='二值阈值,默认 Otsu')
        p.add_argument('--invert', action='store_true', help='浅色线条/深色底时使用')
        p.add_argument('--text', action='store_true', help='输出文本表格而非 JSON')

    p_runs = sub.add_parser('runs', help='沿指定行/列列出墨迹区间')
    common(p_runs)
    p_runs.add_argument('--rows', type=lambda s: [int(v) for v in s.split(',')])
    p_runs.add_argument('--cols', type=lambda s: [int(v) for v in s.split(',')])

    p_lines = sub.add_parser('lines', help='自动检测横向/竖向直线')
    common(p_lines)
    p_lines.add_argument('--axis', choices=['h', 'v', 'both'], default='both')
    p_lines.add_argument('--min-len', type=int, default=40, help='最短线长(px),滤掉文字')
    p_lines.add_argument('--max-thick', type=int, default=8, help='最大线宽(px),滤掉色块')
    p_lines.add_argument('--min-cov', type=float, default=0.15,
                         help='线在跨度内的覆盖率下限,滤掉文字;虚线一般 0.4~0.85')
    p_lines.add_argument('--exclude', action='append', help='排除区 x0,y0,x1,y1,可重复')

    args = ap.parse_args()
    if args.cmd == 'runs' and not args.rows and not args.cols:
        fail('runs 需要 --rows 或 --cols')
    data = cmd_runs(args) if args.cmd == 'runs' else cmd_lines(args)
    if args.text:
        print_text(data)
    else:
        print(json.dumps(data, ensure_ascii=False, separators=(',', ':')))


if __name__ == '__main__':
    main()
