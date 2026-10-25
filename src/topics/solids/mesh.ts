import type { Vec2, Vec3 } from '../../lib/math';
import { add3, cross3, dot3, len3, mul3, norm3, sub3 } from '../../lib/math';

export type FaceKind = 'base' | 'side' | 'top' | 'cut';

export interface FaceGroup {
  id: string;
  name: string;
  kind: FaceKind;
  /** 截切面高亮用 */
  color?: string;
}

/** 平面多边形面:pts 按外法向逆时针 */
export interface PolyFace {
  group: string;
  pts: Vec3[];
}

export interface PolySolid {
  faces: PolyFace[];
  groups: FaceGroup[];
}

export interface Tri {
  a: number;
  b: number;
  c: number;
  group: string;
  normal: Vec3;
}

export interface FeatureEdge {
  a: number;
  b: number;
  groups: string[];
  /** 相邻面法向(用于轮廓线与截交线判定) */
  normals: Vec3[];
}

export interface TriMesh {
  verts: Vec3[];
  tris: Tri[];
  groups: FaceGroup[];
  edges: FeatureEdge[];
}

const EPS = 1e-6;

export const vkey = (p: Vec3): string =>
  `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)},${Math.round(p[2] * 1e6)}`;

export function polygonNormal(pts: Vec3[]): Vec3 {
  let n: Vec3 = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    n = [
      n[0] + (a[1] - b[1]) * (a[2] + b[2]),
      n[1] + (a[2] - b[2]) * (a[0] + b[0]),
      n[2] + (a[0] - b[0]) * (a[1] + b[1]),
    ];
  }
  return norm3(n);
}

/** 去掉重合的相邻顶点与末点重复 */
export function cleanPolygon(pts: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || len3(sub3(p, last)) > 1e-7) out.push(p);
  }
  while (out.length > 1 && len3(sub3(out[0], out[out.length - 1])) <= 1e-7) out.pop();
  return out;
}

/** 按期望外法向定向面点序 */
export function orientFace(pts: Vec3[], outward: Vec3): Vec3[] {
  return dot3(polygonNormal(pts), outward) < 0 ? [...pts].reverse() : pts;
}

interface Plane2 {
  u: Vec3;
  v: Vec3;
  proj: (p: Vec3) => Vec2;
}

function basisOf(n: Vec3): Plane2 {
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  let u: Vec3;
  if (ax <= ay && ax <= az) u = norm3(cross3(n, [1, 0, 0]));
  else if (ay <= az) u = norm3(cross3(n, [0, 1, 0]));
  else u = norm3(cross3(n, [0, 0, 1]));
  const v = norm3(cross3(n, u));
  return { u, v, proj: (p) => [dot3(p, u), dot3(p, v)] };
}

const cross2 = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function inTri(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = cross2(a, b, p);
  const d2 = cross2(b, c, p);
  const d3 = cross2(c, a, p);
  const neg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
  const pos = d1 > EPS || d2 > EPS || d3 > EPS;
  return !(neg && pos);
}

/** 耳切三角化:返回顶点下标三元组,绕向与面法向一致 */
export function triangulateFace(pts: Vec3[], normal: Vec3): [number, number, number][] {
  const n = pts.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];
  const { proj } = basisOf(normal);
  const p2 = pts.map(proj);
  let idx = [...Array(n).keys()];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = p2[i];
    const b = p2[(i + 1) % n];
    area += a[0] * b[1] - a[1] * b[0];
  }
  if (area < 0) idx = idx.reverse();
  const tris: [number, number, number][] = [];
  let guard = n * n + 8;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      if (cross2(p2[ia], p2[ib], p2[ic]) <= EPS) continue;
      let ok = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (inTri(p2[j], p2[ia], p2[ib], p2[ic])) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  else for (let i = 1; i + 1 < idx.length; i++) tris.push([idx[0], idx[i], idx[i + 1]]);
  return tris;
}

/** 多边形集合 → 三角网格(顶点去重 + 特征边提取) */
export function buildMesh(solid: PolySolid, creaseDeg = 6): TriMesh {
  const verts: Vec3[] = [];
  const index = new Map<string, number>();
  const vid = (p: Vec3): number => {
    const k = vkey(p);
    const hit = index.get(k);
    if (hit !== undefined) return hit;
    index.set(k, verts.length);
    verts.push(p);
    return verts.length - 1;
  };

  interface Adj {
    groups: string[];
    normals: Vec3[];
  }
  const edgeMap = new Map<string, Adj>();
  const addEdge = (a: Vec3, b: Vec3, group: string, normal: Vec3) => {
    const ka = vkey(a);
    const kb = vkey(b);
    if (ka === kb) return;
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const adj = edgeMap.get(k) ?? { groups: [], normals: [] };
    if (!adj.groups.includes(group)) adj.groups.push(group);
    adj.normals.push(normal);
    edgeMap.set(k, adj);
  };

  const tris: Tri[] = [];
  for (const face of solid.faces) {
    const pts = cleanPolygon(face.pts);
    if (pts.length < 3) continue;
    const normal = polygonNormal(pts);
    if (len3(normal) < 0.5) continue;
    for (let i = 0; i < pts.length; i++) addEdge(pts[i], pts[(i + 1) % pts.length], face.group, normal);
    for (const t of triangulateFace(pts, normal)) {
      const pa = pts[t[0]];
      const pb = pts[t[1]];
      const pc = pts[t[2]];
      const area = len3(cross3(sub3(pb, pa), sub3(pc, pa)));
      if (area < 1e-9) continue;
      tris.push({ a: vid(pa), b: vid(pb), c: vid(pc), group: face.group, normal });
    }
  }

  const edges: FeatureEdge[] = [];
  const cosT = Math.cos((creaseDeg * Math.PI) / 180);
  for (const [k, adj] of edgeMap) {
    const [ka, kb] = k.split('|');
    const a = index.get(ka);
    const b = index.get(kb);
    if (a === undefined || b === undefined) continue;
    const differentGroup = adj.groups.length > 1;
    const crease =
      adj.normals.length < 2 || Math.abs(dot3(adj.normals[0], adj.normals[1])) < cosT;
    if (differentGroup || crease)
      edges.push({ a, b, groups: adj.groups, normals: adj.normals });
  }

  return { verts, tris, groups: solid.groups, edges };
}

/** 整体平移(用于把立体放到 V 面之后:深度 z ≥ 0) */
export function translateSolid(solid: PolySolid, d: Vec3): PolySolid {
  if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) < 1e-12) return solid;
  return {
    groups: solid.groups,
    faces: solid.faces.map((f) => ({
      group: f.group,
      pts: f.pts.map((p) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]] as Vec3),
    })),
  };
}

/** 网格包围盒 */
export function meshBounds(mesh: TriMesh): { min: Vec3; max: Vec3 } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.verts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  }
  return { min, max };
}

/** 面上一点(重心)——取点失败时给提示用 */
export function triCentroid(mesh: TriMesh, t: Tri): Vec3 {
  return mul3(add3(add3(mesh.verts[t.a], mesh.verts[t.b]), mesh.verts[t.c]), 1 / 3);
}

export function edgeMid(mesh: TriMesh, e: FeatureEdge): Vec3 {
  return mul3(add3(mesh.verts[e.a], mesh.verts[e.b]), 0.5);
}

/**
 * 图上真正要标注的"角点":去掉 CSG 产生的 T 形分点。
 * T 形分点只有两条共线的特征边(落在一条长棱中间),删去后顶点编号才与教材一致。
 */
export function displayVertices(mesh: TriMesh, tol = 1e-3): Vec3[] {
  const clusters: { p: Vec3; ids: number[] }[] = [];
  const clusterOf = new Map<number, number>();
  mesh.verts.forEach((p, i) => {
    let ci = -1;
    for (let k = 0; k < clusters.length; k++) {
      if (len3(sub3(clusters[k].p, p)) <= tol) {
        ci = k;
        break;
      }
    }
    if (ci < 0) {
      ci = clusters.length;
      clusters.push({ p, ids: [] });
    }
    clusters[ci].ids.push(i);
    clusterOf.set(i, ci);
  });

  const nbrs = new Map<number, Set<number>>();
  for (const e of mesh.edges) {
    const ca = clusterOf.get(e.a);
    const cb = clusterOf.get(e.b);
    if (ca === undefined || cb === undefined || ca === cb) continue;
    (nbrs.get(ca) ?? nbrs.set(ca, new Set()).get(ca)!).add(cb);
    (nbrs.get(cb) ?? nbrs.set(cb, new Set()).get(cb)!).add(ca);
  }

  const out: Vec3[] = [];
  clusters.forEach((c, ci) => {
    const ns = [...(nbrs.get(ci) ?? [])];
    // 只有 0/1 条特征边的点必是三角化残留,不是真实角点
    if (ns.length < 2) return;
    // 邻边方向全共线 = 落在一条长棱中间(T 形分点,可能因碎片被拆成 3 段)
    const dirs = ns.map((k) => norm3(sub3(clusters[k].p, c.p)));
    if (dirs.every((d) => Math.abs(dot3(d, dirs[0])) > 0.995)) return;
    const avg = c.ids.reduce<Vec3>((a, i) => add3(a, mesh.verts[i]), [0, 0, 0]);
    out.push(mul3(avg, 1 / c.ids.length));
  });
  return out;
}
