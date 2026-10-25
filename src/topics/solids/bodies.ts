import type { Vec2, Vec3 } from '../../lib/math';
import { add3, cross3, dot3, mul3, norm3, sub3 } from '../../lib/math';
import { orientFace, polygonNormal, type FaceGroup, type PolyFace, type PolySolid } from './mesh';
import { cutAt, type CutPlane } from './clip';

const GROUPS = {
  base: { id: 'base', name: '底面', kind: 'base' } as FaceGroup,
  top: { id: 'top', name: '顶面', kind: 'top' } as FaceGroup,
  side: { id: 'side', name: '棱面', kind: 'side' } as FaceGroup,
};

function assemble(faces: PolyFace[]): PolySolid {
  const ids = new Set(faces.map((f) => f.group));
  const groups: FaceGroup[] = [];
  if (ids.has('base')) groups.push(GROUPS.base);
  if (ids.has('side')) groups.push(GROUPS.side);
  if (ids.has('top')) groups.push(GROUPS.top);
  const centroid = faces
    .flatMap((f) => f.pts)
    .reduce<Vec3>((acc, p) => add3(acc, p), [0, 0, 0]);
  const count = faces.reduce((n, f) => n + f.pts.length, 0) || 1;
  const center = mul3(centroid, 1 / count);
  const out = faces.map((f) => ({
    group: f.group,
    pts: orientFace(f.pts, sub3(mul3(f.pts.reduce<Vec3>((a, p) => add3(a, p), [0, 0, 0]), 1 / f.pts.length), center)),
  }));
  return { faces: out, groups };
}

/** 正 n 边形环:y 固定,rot 为弧度 */
export function ring(n: number, r: number, y: number, rot = 0): Vec3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = rot + (i * 2 * Math.PI) / n;
    return [r * Math.cos(t), y, r * Math.sin(t)] as Vec3;
  });
}

/** 正 n 棱柱,底面在 H 面(y=0) */
export function regularPrism(n: number, r: number, h: number, rot = 0): PolySolid {
  const b = ring(n, r, 0, rot);
  const t = ring(n, r, h, rot);
  const faces: PolyFace[] = [
    { group: 'base', pts: b },
    { group: 'top', pts: t },
  ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ group: 'side', pts: [b[i], b[j], t[j], t[i]] });
  }
  return assemble(faces);
}

/** 正 n 棱锥 */
export function regularPyramid(n: number, r: number, h: number, rot = 0): PolySolid {
  const b = ring(n, r, 0, rot);
  const apex: Vec3 = [0, h, 0];
  const faces: PolyFace[] = [{ group: 'base', pts: b }];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ group: 'side', pts: [b[i], b[j], apex] });
  }
  return assemble(faces);
}

/** 正 n 棱台;r1=0 退化为棱锥 */
export function regularFrustum(
  n: number,
  r0: number,
  r1: number,
  h: number,
  rot = 0,
): PolySolid {
  if (r1 <= 1e-6) return regularPyramid(n, r0, h, rot);
  const b = ring(n, r0, 0, rot);
  const t = ring(n, r1, h, rot);
  const faces: PolyFace[] = [
    { group: 'base', pts: b },
    { group: 'top', pts: t },
  ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ group: 'side', pts: [b[i], b[j], t[j], t[i]] });
  }
  return assemble(faces);
}

export function box(w: number, d: number, h: number): PolySolid {
  return boxBounds(-w / 2, w / 2, 0, h, -d / 2, d / 2);
}

/** 按包围盒建长方体(截切工具块也用) */
export function boxBounds(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): PolySolid {
  const b: Vec3[] = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
  ];
  const t = b.map((p) => [p[0], y1, p[2]] as Vec3);
  const faces: PolyFace[] = [
    { group: 'base', pts: b },
    { group: 'top', pts: t },
    { group: 'side', pts: [b[0], b[1], t[1], t[0]] },
    { group: 'side', pts: [b[1], b[2], t[2], t[1]] },
    { group: 'side', pts: [b[2], b[3], t[3], t[2]] },
    { group: 'side', pts: [b[3], b[0], t[0], t[3]] },
  ];
  return assemble(faces);
}

/** 横放棱柱:把 (z,y) 截面沿 X 从 x0 拉伸到 x1 */
export function extrudeX(profile: Vec2[], x0: number, x1: number): PolySolid {
  const lo = profile.map((p) => [x0, p[1], p[0]] as Vec3);
  const hi = profile.map((p) => [x1, p[1], p[0]] as Vec3);
  const faces: PolyFace[] = [
    { group: 'base', pts: lo },
    { group: 'base', pts: hi },
  ];
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ group: 'side', pts: [lo[i], lo[j], hi[j], hi[i]] });
  }
  return assemble(faces);
}

/** 立放棱柱:把 (x,y) 截面沿 Z 从 z0 拉伸到 z1 */
export function extrudeZ(profile: Vec2[], z0: number, z1: number): PolySolid {
  const lo = profile.map((p) => [p[0], p[1], z0] as Vec3);
  const hi = profile.map((p) => [p[0], p[1], z1] as Vec3);
  const faces: PolyFace[] = [
    { group: 'base', pts: lo },
    { group: 'base', pts: hi },
  ];
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ group: 'side', pts: [lo[i], lo[j], hi[j], hi[i]] });
  }
  return assemble(faces);
}

/* ---------- 截平面构造 ---------- */

export const cutX = (x: number, keep: 1 | -1, extra: Partial<CutPlane> = {}): CutPlane =>
  cutAt([keep, 0, 0], [x, 0, 0], extra);
export const cutY = (y: number, keep: 1 | -1, extra: Partial<CutPlane> = {}): CutPlane =>
  cutAt([0, keep, 0], [0, y, 0], extra);
export const cutZ = (z: number, keep: 1 | -1, extra: Partial<CutPlane> = {}): CutPlane =>
  cutAt([0, 0, keep], [0, 0, z], extra);

/** 过三点、保留 keepPoint 所在侧 */
export function cutThrough(p1: Vec3, p2: Vec3, p3: Vec3, keepPoint: Vec3, extra: Partial<CutPlane> = {}): CutPlane {
  const n0 = cross3(sub3(p2, p1), sub3(p3, p1));
  const n = norm3(n0);
  // 保留侧是 n·P ≤ d:必须让 keepPoint 落在法向的反方向
  const flip = dot3(n, sub3(keepPoint, p1)) > 0 ? -1 : 1;
  const nn: Vec3 = [n[0] * flip, n[1] * flip, n[2] * flip];
  return cutAt(nn, p1, extra);
}

/** 面的外法向(用于标注/调试) */
export const faceNormal = (f: PolyFace): Vec3 => polygonNormal(f.pts);
