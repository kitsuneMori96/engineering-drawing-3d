import type { Vec2, Vec3 } from '../../lib/math';
import type { TriMesh } from './mesh';

export type ViewId = 'V' | 'H' | 'W';

/** 正交视图基:2D 图面坐标 + 深度(越小越靠近观察者)+ 射入场景方向 */
export interface ViewBasis {
  id: ViewId;
  /** W 面纸面 x 原点(与 engine 的 W 轴位置一致) */
  x0: number;
  project: (p: Vec3) => Vec2;
  depth: (p: Vec3) => number;
  into: Vec3;
}

export function viewBasis(id: ViewId, x0 = 10): ViewBasis {
  if (id === 'V') {
    return {
      id,
      x0,
      project: (p) => [p[0], p[1]],
      depth: (p) => -p[2],
      into: [0, 0, -1],
    };
  }
  if (id === 'H') {
    return {
      id,
      x0,
      project: (p) => [p[0], -p[2]],
      depth: (p) => -p[1],
      into: [0, -1, 0],
    };
  }
  return {
    id,
    x0,
    project: (p) => [x0 + p[2], p[1]],
    depth: (p) => p[0],
    into: [1, 0, 0],
  };
}

export interface Seg2 {
  a: Vec2;
  b: Vec2;
  /** 相邻面组;含切面 = 截交线 */
  groups: string[];
  /** 轮廓线(相邻面一正一背) */
  outline?: boolean;
}

export interface HlrResult {
  visible: Seg2[];
  hidden: Seg2[];
}

const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/** 2D 三角形重心坐标;不在三角形内返回 null */
function bary(p: Vec2, a: Vec2, b: Vec2, c: Vec2): [number, number, number] | null {
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(d) < 1e-12) return null;
  const w0 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / d;
  const w1 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / d;
  const w2 = 1 - w0 - w1;
  const e = -1e-7;
  if (w0 < e || w1 < e || w2 < e) return null;
  return [w0, w1, w2];
}

/** 线段 pq 与线段 ab 的交点参数 t(沿 pq),无交点返回 null */
function segParam(p: Vec2, q: Vec2, a: Vec2, b: Vec2): number | null {
  const r: Vec2 = [q[0] - p[0], q[1] - p[1]];
  const s: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const qp: Vec2 = [a[0] - p[0], a[1] - p[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / den;
  const u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u < -1e-7 || u > 1 + 1e-7) return null;
  return t;
}

/**
 * 隐藏线消除:把特征边按投影三角形边界切分,逐段做深度比较;
 * 与可见线共线的隐藏段被抑制(虚不盖实)。
 */
export function hiddenLines(mesh: TriMesh, view: ViewBasis): HlrResult {
  const P = mesh.verts.map(view.project);
  const D = mesh.verts.map(view.depth);

  const tris = mesh.tris
    .map((t) => ({ ia: t.a, ib: t.b, ic: t.c }))
    .filter((t) => {
      const a = P[t.ia];
      const b = P[t.ib];
      const c = P[t.ic];
      return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-9;
    });

  const occludedAt = (p: Vec2, dep: number): boolean => {
    for (const t of tris) {
      const w = bary(p, P[t.ia], P[t.ib], P[t.ic]);
      if (!w) continue;
      const d = w[0] * D[t.ia] + w[1] * D[t.ib] + w[2] * D[t.ic];
      if (d < dep - 2e-3) return true;
    }
    return false;
  };

  const visible: Seg2[] = [];
  const hidden: Seg2[] = [];
  for (const e of mesh.edges) {
    const a = P[e.a];
    const b = P[e.b];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (la < 1e-6) continue;
    const da = D[e.a];
    const db = D[e.b];
    const front = e.normals.map(
      (n) => n[0] * view.into[0] + n[1] * view.into[1] + n[2] * view.into[2] < 0,
    );
    const outline = front.some(Boolean) && front.some((f) => !f);
    const ts = new Set<number>([0, 1]);
    for (const t of tris) {
      const ids = [t.ia, t.ib, t.ic];
      for (let k = 0; k < 3; k++) {
        const s = segParam(a, b, P[ids[k]], P[ids[(k + 1) % 3]]);
        if (s !== null) ts.add(Math.round(s * 1e6) / 1e6);
      }
    }
    const sorted = [...ts].sort((x, y) => x - y);
    let runStart: number | null = null;
    let runHidden = false;
    const flush = (t0: number, t1: number) => {
      if (t1 - t0 < 1e-7) return;
      const seg = { a: lerp2(a, b, t0), b: lerp2(a, b, t1), groups: e.groups, outline };
      (runHidden ? hidden : visible).push(seg);
    };
    for (let i = 0; i + 1 < sorted.length; i++) {
      const t0 = sorted[i];
      const t1 = sorted[i + 1];
      if (t1 - t0 < 1e-7) continue;
      const tm = (t0 + t1) / 2;
      const occ = occludedAt(lerp2(a, b, tm), da + (db - da) * tm);
      if (runStart === null) {
        runStart = t0;
        runHidden = occ;
      } else if (occ !== runHidden) {
        flush(runStart, t0);
        runStart = t0;
        runHidden = occ;
      }
    }
    if (runStart !== null) flush(runStart, sorted[sorted.length - 1]);
  }

  return { visible, hidden: suppressCoincident(hidden, visible) };
}

const onLine = (p: Vec2, a: Vec2, b: Vec2): boolean => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l < 1e-9) return false;
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l < 1e-4;
};

/** 去掉与可见线共线重叠的隐藏段(保留不重叠部分) */
function suppressCoincident(hidden: Seg2[], visible: Seg2[]): Seg2[] {
  const out: Seg2[] = [];
  for (const h of hidden) {
    let pieces: [number, number][] = [[0, 1]];
    const dir: Vec2 = [h.b[0] - h.a[0], h.b[1] - h.a[1]];
    const len = Math.hypot(dir[0], dir[1]);
    const u: Vec2 = [dir[0] / len, dir[1] / len];
    for (const v of visible) {
      if (!onLine(v.a, h.a, h.b) || !onLine(v.b, h.a, h.b)) continue;
      const t0 = ((v.a[0] - h.a[0]) * u[0] + (v.a[1] - h.a[1]) * u[1]) / len;
      const t1 = ((v.b[0] - h.a[0]) * u[0] + (v.b[1] - h.a[1]) * u[1]) / len;
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(1, Math.max(t0, t1));
      if (hi - lo < 1e-6) continue;
      const next: [number, number][] = [];
      for (const [a, b] of pieces) {
        if (hi <= a || lo >= b) {
          next.push([a, b]);
          continue;
        }
        if (lo > a) next.push([a, lo]);
        if (hi < b) next.push([hi, b]);
      }
      pieces = next;
    }
    for (const [t0, t1] of pieces) {
      if (t1 - t0 < 1e-6) continue;
      out.push({ a: lerp2(h.a, h.b, t0), b: lerp2(h.a, h.b, t1), groups: h.groups, outline: h.outline });
    }
  }
  return out;
}
