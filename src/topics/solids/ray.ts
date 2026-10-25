import type { Vec2, Vec3 } from '../../lib/math';
import { add3, mul3 } from '../../lib/math';
import type { TriMesh, Tri } from './mesh';
import type { ViewBasis } from './hlr';

export interface SurfaceHit {
  point: Vec3;
  depth: number;
  tri: Tri;
  group: string;
  /** 该面朝向观察者 */
  front: boolean;
}

/** 视线上的全部表面交点,按由近到远排序 */
export function surfaceHits(mesh: TriMesh, view: ViewBasis, p: Vec2): SurfaceHit[] {
  const out: SurfaceHit[] = [];
  for (const tri of mesh.tris) {
    const a = mesh.verts[tri.a];
    const b = mesh.verts[tri.b];
    const c = mesh.verts[tri.c];
    const pa = view.project(a);
    const pb = view.project(b);
    const pc = view.project(c);
    const den = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1]);
    if (Math.abs(den) < 1e-12) continue;
    const w0 = ((pb[1] - pc[1]) * (p[0] - pc[0]) + (pc[0] - pb[0]) * (p[1] - pc[1])) / den;
    const w1 = ((pc[1] - pa[1]) * (p[0] - pc[0]) + (pa[0] - pc[0]) * (p[1] - pc[1])) / den;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
    const point = add3(add3(mul3(a, w0), mul3(b, w1)), mul3(c, w2));
    out.push({
      point,
      depth: view.depth(point),
      tri,
      group: tri.group,
      front: tri.normal[0] * view.into[0] + tri.normal[1] * view.into[1] + tri.normal[2] * view.into[2] < 0,
    });
  }
  out.sort((x, y) => x.depth - y.depth);
  return out;
}

/** 最靠近观察者的有效表面点;limitGroup 时取该面组上最近命中 */
export function pickSurface(
  mesh: TriMesh,
  view: ViewBasis,
  p: Vec2,
  limitGroup?: string,
): SurfaceHit | null {
  const hits = surfaceHits(mesh, view, p);
  if (limitGroup) return hits.find((h) => h.group === limitGroup) ?? null;
  return hits[0] ?? null;
}

/** 已知点是否在投影轮廓上可见(用于括号判断) */
export function isPointVisible(mesh: TriMesh, view: ViewBasis, p: Vec3): boolean {
  const hits = surfaceHits(mesh, view, view.project(p));
  if (!hits.length) return false;
  const d = view.depth(p);
  return Math.abs(hits[0].depth - d) < 5e-3;
}
