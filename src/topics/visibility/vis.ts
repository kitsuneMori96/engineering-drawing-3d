import type { Vec2, Vec3 } from '../../lib/math';
import { add3, cross3, dot3, len3, mul3, norm3, sub2, sub3 } from '../../lib/math';
import type { PtKey } from './chapters';

/**
 * 判别可见性主题的纯数学库。
 * 坐标约定(与 lib/engine 一致):Vec3 = [x, 高度, 深度]。
 *   - 对 V 面(正立投影,观察者在前)重影 → 比 comp2(深度),大者=前=可见
 *   - 对 H 面(水平投影,观察者在上)重影 → 比 comp1(高度),大者=高=可见
 * 纸面数学坐标(y 向上):projV(P)=[x,高度](OX 上方),projH(P)=[x,−深度](OX 下方)。
 */

export type Face = 'V' | 'H';

export const projV = (P: Vec3): Vec2 => [P[0], P[1]];
export const projH = (P: Vec3): Vec2 => [P[0], -P[2]];
export const proj = (face: Face, P: Vec3): Vec2 => (face === 'V' ? projV(P) : projH(P));

/** 直线参数点 P(s) = P0 + s·(P1−P0) */
export const linePoint = (P0: Vec3, P1: Vec3, s: number): Vec3 =>
  add3(P0, mul3(sub3(P1, P0), s));

const det2 = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];

/** 2D 线段求交;平行/退化/交点不在线段范围内 → null */
export function segSegCross(
  p1: Vec2,
  p2: Vec2,
  q1: Vec2,
  q2: Vec2,
  eps = 1e-9,
): { pt: Vec2; t: number; u: number } | null {
  const d1: Vec2 = [p2[0] - p1[0], p2[1] - p1[1]];
  const d2: Vec2 = [q2[0] - q1[0], q2[1] - q1[1]];
  if (Math.hypot(d1[0], d1[1]) < eps || Math.hypot(d2[0], d2[1]) < eps) return null;
  const den = det2(d1, d2);
  if (Math.abs(den) < eps) return null;
  const w: Vec2 = [q1[0] - p1[0], q1[1] - p1[1]];
  const t = det2(w, d2) / den;
  const u = det2(w, d1) / den;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  return { pt: [p1[0] + d1[0] * t, p1[1] + d1[1] * t], t, u };
}

/** 两点在 face 上是否构成重影(同影异深/同影异高) */
export function coincidentPair(P: Vec3, Q: Vec3, face: Face, eps = 0.05): boolean {
  const d0 = Math.abs(P[0] - Q[0]);
  if (d0 > eps) return false;
  if (face === 'V') {
    return Math.abs(P[1] - Q[1]) <= eps && Math.abs(P[2] - Q[2]) > eps;
  }
  return Math.abs(P[2] - Q[2]) <= eps && Math.abs(P[1] - Q[1]) > eps;
}

/** 重影对中可见者的判定坐标:V 面比深度(comp2),H 面比高度(comp1) */
export const compareValue = (P: Vec3, face: Face): number =>
  face === 'V' ? P[2] : P[1];

/** 重影对中可见的点(相等时取 P) */
export function visibleOfCoincident(P: Vec3, Q: Vec3, face: Face): Vec3 {
  return compareValue(Q, face) > compareValue(P, face) ? Q : P;
}

/** 不可见投影的教材括号标注,如 b′ → (b′) */
export const parenthesized = (label: string): string => `(${label})`;

/**
 * 三角形 ABC 内、face 投影恰为 X 的空间点(2×2 视图坐标解 α,β);
 * 投影方向上三角形退化或 X 不在投影三角形内 → null。
 */
export function planePointAtView(
  face: Face,
  X: Vec2,
  A: Vec3,
  B: Vec3,
  C: Vec3,
  eps = 1e-9,
): Vec3 | null {
  const u = sub3(B, A);
  const v = sub3(C, A);
  // 视图坐标分量索引:V 用 (0,1),H 用 (0,2) 且纸面 y = −深度
  const i1 = face === 'V' ? 1 : 2;
  const sgn = face === 'V' ? 1 : -1;
  const m: Vec2[] = [
    [u[0], v[0]],
    [sgn * u[i1], sgn * v[i1]],
  ];
  const den = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (Math.abs(den) < 1e-9) return null;
  const rhs: Vec2 = [X[0] - A[0], X[1] - sgn * A[i1]];
  const alpha = (rhs[0] * m[1][1] - m[0][1] * rhs[1]) / den;
  const beta = (m[0][0] * rhs[1] - m[1][0] * rhs[0]) / den;
  if (alpha < -eps || beta < -eps || alpha + beta > 1 + eps) return null;
  return add3(A, add3(mul3(u, alpha), mul3(v, beta)));
}

/** 直线 D→E 与平面 ABC 的交点:s∈[0,1] 且 K 在三角形内才 insideTri;平行 → null */
export function lineVsPlane(
  D: Vec3,
  E: Vec3,
  A: Vec3,
  B: Vec3,
  C: Vec3,
  eps = 1e-9,
): { s: number; K: Vec3; insideTri: boolean } | null {
  const n = cross3(sub3(B, A), sub3(C, A));
  const dir = sub3(E, D);
  const nn = dot3(n, n);
  if (nn < eps) return null; // 退化三角形
  const den = dot3(dir, n);
  if (Math.abs(den) < 1e-9 * Math.sqrt(nn) * Math.max(1, len3(dir))) return null; // 平行
  const s = dot3(sub3(A, D), n) / den;
  const K = add3(D, mul3(dir, s));
  const w = sub3(K, A);
  const alpha = dot3(cross3(w, sub3(C, A)), n) / nn;
  const beta = dot3(cross3(sub3(B, A), w), n) / nn;
  const insideTri = alpha >= -1e-9 && beta >= -1e-9 && alpha + beta <= 1 + 1e-9;
  return { s, K, insideTri };
}

/** 线段参数域与投影三角形(凸)的交集 [t0,t1];不相交 → null */
export function clipToTriangle2D(
  q0: Vec2,
  q1: Vec2,
  tri: [Vec2, Vec2, Vec2],
): [number, number] | null {
  const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
  const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    const a = tri[i];
    const b = tri[(i + 1) % 3];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const side = (p: Vec2): number => ex * (p[1] - a[1]) - ey * (p[0] - a[0]);
    const s = Math.sign(side([cx, cy]));
    if (s === 0) return null; // 投影三角形退化
    const f0 = side(q0);
    const f1 = side(q1);
    if (s * f0 >= 0 && s * f1 >= 0) continue;
    if (s * f0 < 0 && s * f1 < 0) return null;
    const tf = f0 / (f0 - f1);
    if (s * f0 < 0) {
      t0 = Math.max(t0, tf);
    } else {
      t1 = Math.min(t1, tf);
    }
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

/**
 * face 视图中,直线 DE 被三角形 ABC 遮挡的参数区间 [s0,s1](画虚线);
 * 无遮挡 → null。要求交点 K 存在且在三角形内、且落在投影重叠区内。
 */
export function hiddenInterval(
  face: Face,
  D: Vec3,
  E: Vec3,
  A: Vec3,
  B: Vec3,
  C: Vec3,
): [number, number] | null {
  const hit = lineVsPlane(D, E, A, B, C);
  if (!hit || !hit.insideTri) return null;
  const { s: sK } = hit;
  const clip = clipToTriangle2D(proj(face, D), proj(face, E), [
    proj(face, A),
    proj(face, B),
    proj(face, C),
  ]);
  if (!clip) return null;
  const [sIn, sOut] = clip;
  if (sK <= sIn + 1e-9 || sK >= sOut - 1e-9) return null;
  const hiddenAt = (s: number): boolean => {
    const P = linePoint(D, E, s);
    const planePt = planePointAtView(face, proj(face, P), A, B, C);
    if (!planePt) return false;
    return compareValue(P, face) < compareValue(planePt, face);
  };
  return hiddenAt((sK + sOut) / 2) ? [sK, sOut] : [sIn, sK];
}

/** 交叉直线章:被遮线在投影交点 X 附近的短虚线段(教材画法) */
export function crossStub(X: Vec2, unitDir: Vec2, half = 0.7): [Vec2, Vec2] {
  return [
    [X[0] - unitDir[0] * half, X[1] - unitDir[1] * half],
    [X[0] + unitDir[0] * half, X[1] + unitDir[1] * half],
  ];
}

/**
 * 两直线 AB、CD 是否真相交:两面投影交点都存在且在同一根投影连线上(x 相同)。
 * yes 时给出空间交点。
 */
export function isTrueIntersection(
  A: Vec3,
  B: Vec3,
  C: Vec3,
  D: Vec3,
  eps = 0.05,
): { yes: boolean; P: Vec3 | null } {
  const xv = segSegCross(projV(A), projV(B), projV(C), projV(D));
  const xh = segSegCross(projH(A), projH(B), projH(C), projH(D));
  if (!xv || !xh) return { yes: false, P: null };
  if (Math.abs(xv.pt[0] - xh.pt[0]) > eps) return { yes: false, P: null };
  return { yes: true, P: linePoint(A, B, xv.t) };
}

/* ============================ ch3 两平面相交 ============================ */

/** 线段 p→q 与无限直线 la→lb 的 2D 交点(线段参数 t∈[0,1]);平行/不相交 → null */
export function edgeVsLine2D(
  p: Vec2,
  q: Vec2,
  la: Vec2,
  lb: Vec2,
  eps = 1e-9,
): { pt: Vec2; t: number } | null {
  const d1: Vec2 = [q[0] - p[0], q[1] - p[1]];
  const d2: Vec2 = [lb[0] - la[0], lb[1] - la[1]];
  const den = det2(d1, d2);
  if (Math.abs(den) < eps) return null;
  const w: Vec2 = [la[0] - p[0], la[1] - p[1]];
  const t = det2(w, d2) / den;
  if (t < -eps || t > 1 + eps) return null;
  return { pt: [p[0] + d1[0] * t, p[1] + d1[1] * t], t };
}

/**
 * 过直线 G0G1 的铅垂辅助面 R(R⊥H,H 面积聚为 projH(G0)→projH(G1) 的延长线)
 * 截 △ABC 所得交线 MN 的两个端点:三角形两边与积聚线的交点,取 V 面投影不重合的一对。
 * 找不到有效点对 → null(积聚线不过三角形 / 退化)。
 */
export function auxPlaneCord(
  G0: Vec3,
  G1: Vec3,
  tri: [Vec3, Vec3, Vec3],
): { M: Vec3; N: Vec3 } | null {
  const la = projH(G0);
  const lb = projH(G1);
  if (Math.hypot(lb[0] - la[0], lb[1] - la[1]) < 1e-9) return null;
  const hits: Vec3[] = [];
  const pairs: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  for (const [i, j] of pairs) {
    const h = edgeVsLine2D(projH(tri[i]), projH(tri[j]), la, lb);
    if (!h) continue;
    const P = linePoint(tri[i], tri[j], h.t);
    if (!hits.some((q) => len3(sub3(q, P)) < 1e-7)) hits.push(P);
  }
  for (let a = 0; a < hits.length; a++)
    for (let b = a + 1; b < hits.length; b++) {
      const dv = sub2(projV(hits[a]), projV(hits[b]));
      if (Math.hypot(dv[0], dv[1]) > 1e-6) return { M: hits[a], N: hits[b] };
    }
  return null;
}

export interface PpHit {
  K: Vec3;
  L: Vec3;
  length: number;
  /** K、L 各自所在的对象边(6 条边中最近的一条,用于把 k′ 画到正确投影上) */
  kEdge: [PtKey, PtKey];
  lEdge: [PtKey, PtKey];
}

const distToSeg = (P: Vec3, Q: Vec3, X: Vec3): number => {
  const d = sub3(Q, P);
  const t = Math.min(1, Math.max(0, dot3(sub3(X, P), d) / Math.max(dot3(d, d), 1e-12)));
  return len3(sub3(linePoint(P, Q, t), X));
};

/**
 * 两一般位置平面 △ABC × △DEF 的交线分析。
 * 穿透点集 = {DEF 各边与平面 ABC 的交点(在线段上且落入 △ABC 内)}
 *          ∪ {ABC 各边与平面 DEF 的交点(同条件)};
 * 沿交线方向 cross(n1,n2) 取参数极值即交线段端点 K、L。
 * 平行(含重合)→ parallel:true;不平行但重叠段退化 → hit:null。
 */
export function planePlane(
  A: Vec3,
  B: Vec3,
  C: Vec3,
  D: Vec3,
  E: Vec3,
  F: Vec3,
): { parallel: boolean; hit: PpHit | null } {
  const n1 = cross3(sub3(B, A), sub3(C, A));
  const n2 = cross3(sub3(E, D), sub3(F, D));
  const w = cross3(n1, n2);
  const scale = Math.max(len3(n1) * len3(n2), 1e-12);
  if (len3(w) < 1e-9 * scale) return { parallel: true, hit: null };
  const edges: { key: [PtKey, PtKey]; P0: Vec3; P1: Vec3; tri: [Vec3, Vec3, Vec3] }[] = [
    { key: ['D', 'E'], P0: D, P1: E, tri: [A, B, C] },
    { key: ['E', 'F'], P0: E, P1: F, tri: [A, B, C] },
    { key: ['F', 'D'], P0: F, P1: D, tri: [A, B, C] },
    { key: ['A', 'B'], P0: A, P1: B, tri: [D, E, F] },
    { key: ['B', 'C'], P0: B, P1: C, tri: [D, E, F] },
    { key: ['C', 'A'], P0: C, P1: A, tri: [D, E, F] },
  ];
  const pts: { P: Vec3; edge: [PtKey, PtKey] }[] = [];
  for (const e of edges) {
    const h = lineVsPlane(e.P0, e.P1, e.tri[0], e.tri[1], e.tri[2]);
    if (!h || !h.insideTri || h.s < -1e-9 || h.s > 1 + 1e-9) continue;
    if (!pts.some((q) => len3(sub3(q.P, h.K)) < 1e-7)) pts.push({ P: h.K, edge: e.key });
  }
  if (pts.length < 2) return { parallel: false, hit: null };
  const u = norm3(w)!;
  let lo = pts[0];
  let hi = pts[0];
  let tLo = 0;
  let tHi = 0;
  for (const q of pts) {
    const t = dot3(sub3(q.P, lo.P), u);
    if (t < tLo) {
      tLo = t;
      lo = q;
    }
    if (t > tHi) {
      tHi = t;
      hi = q;
    }
  }
  if (tHi - tLo < 1e-7) return { parallel: false, hit: null };
  const edgeOf = (P: Vec3): [PtKey, PtKey] => {
    const all: { key: [PtKey, PtKey]; P0: Vec3; P1: Vec3 }[] = [
      { key: ['D', 'E'], P0: D, P1: E },
      { key: ['E', 'F'], P0: E, P1: F },
      { key: ['F', 'D'], P0: F, P1: D },
      { key: ['A', 'B'], P0: A, P1: B },
      { key: ['B', 'C'], P0: B, P1: C },
      { key: ['C', 'A'], P0: C, P1: A },
    ];
    let best = all[0];
    let bd = Infinity;
    for (const e of all) {
      const d = distToSeg(e.P0, e.P1, P);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best.key;
  };
  return {
    parallel: false,
    hit: {
      K: lo.P,
      L: hi.P,
      length: len3(sub3(hi.P, lo.P)),
      kEdge: edgeOf(lo.P),
      lEdge: edgeOf(hi.P),
    },
  };
}

/** ch3 全部对象边(逐边可见性裁剪遍历用) */
export const PP_EDGES: [PtKey, PtKey][] = [
  ['D', 'E'],
  ['E', 'F'],
  ['F', 'D'],
  ['A', 'B'],
  ['B', 'C'],
  ['C', 'A'],
];
