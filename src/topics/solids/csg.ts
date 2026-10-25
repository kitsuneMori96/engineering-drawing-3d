import type { Vec3 } from '../../lib/math';
import { cross3, dot3, len3, norm3, sub3 } from '../../lib/math';
import {
  buildMesh,
  cleanPolygon,
  vkey,
  type FaceGroup,
  type PolyFace,
  type PolySolid,
  type TriMesh,
} from './mesh';

/**
 * BSP 布尔减(csg.js 思路的 TS 移植)。
 * 半空间顺序截切只能得到"凸的保留侧交集",台阶/槽口这类凹形缺口必须做布尔差;
 * 输入面先三角化,避免 BSP 对凹多边形的分割假设不成立。
 */

const EPS = 1e-5;

interface CPlane {
  n: Vec3;
  w: number;
}

interface CPoly {
  verts: Vec3[];
  plane: CPlane;
  group: string;
}

const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

function planeFrom(a: Vec3, b: Vec3, c: Vec3): CPlane | null {
  const n = cross3(sub3(b, a), sub3(c, a));
  if (len3(n) < 1e-12) return null;
  const nn = norm3(n);
  return { n: nn, w: dot3(nn, a) };
}

function flipPlane(p: CPlane): CPlane {
  return { n: [-p.n[0], -p.n[1], -p.n[2]], w: -p.w };
}

function splitPolygon(
  plane: CPlane,
  poly: CPoly,
  coFront: CPoly[],
  coBack: CPoly[],
  front: CPoly[],
  back: CPoly[],
) {
  let type = COPLANAR;
  const types: number[] = [];
  for (const v of poly.verts) {
    const t = dot3(plane.n, v) - plane.w;
    const k = t < -EPS ? BACK : t > EPS ? FRONT : COPLANAR;
    type |= k;
    types.push(k);
  }
  if (type === COPLANAR) {
    (dot3(plane.n, poly.plane.n) > 0 ? coFront : coBack).push(poly);
    return;
  }
  if (type === FRONT) {
    front.push(poly);
    return;
  }
  if (type === BACK) {
    back.push(poly);
    return;
  }
  const f: Vec3[] = [];
  const b: Vec3[] = [];
  const n = poly.verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ti = types[i];
    const tj = types[j];
    const vi = poly.verts[i];
    const vj = poly.verts[j];
    if (ti !== BACK) f.push(vi);
    if (ti !== FRONT) b.push(vi);
    if ((ti | tj) === SPANNING) {
      const den = dot3(plane.n, sub3(vj, vi));
      const t = den === 0 ? 0 : (plane.w - dot3(plane.n, vi)) / den;
      const v: Vec3 = [
        vi[0] + (vj[0] - vi[0]) * t,
        vi[1] + (vj[1] - vi[1]) * t,
        vi[2] + (vj[2] - vi[2]) * t,
      ];
      f.push(v);
      b.push(v);
    }
  }
  if (f.length >= 3) front.push({ verts: f, plane: poly.plane, group: poly.group });
  if (b.length >= 3) back.push({ verts: b, plane: poly.plane, group: poly.group });
}

class Node {
  plane: CPlane | null = null;
  front: Node | null = null;
  back: Node | null = null;
  polys: CPoly[] = [];

  constructor(polys: CPoly[] = []) {
    if (polys.length) this.build(polys);
  }

  invert() {
    this.polys = this.polys.map((p) => ({
      verts: [...p.verts].reverse(),
      plane: flipPlane(p.plane),
      group: p.group,
    }));
    if (this.plane) this.plane = flipPlane(this.plane);
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    const t = this.front;
    this.front = this.back;
    this.back = t;
  }

  clipPolygons(polys: CPoly[]): CPoly[] {
    if (!this.plane) return polys.slice();
    let front: CPoly[] = [];
    let back: CPoly[] = [];
    for (const p of polys) splitPolygon(this.plane, p, front, back, front, back);
    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back);
    else back = [];
    return front.concat(back);
  }

  clipTo(bsp: Node) {
    this.polys = bsp.clipPolygons(this.polys);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }

  allPolygons(): CPoly[] {
    let out = this.polys.slice();
    if (this.front) out = out.concat(this.front.allPolygons());
    if (this.back) out = out.concat(this.back.allPolygons());
    return out;
  }

  build(polys: CPoly[]) {
    if (!polys.length) return;
    if (!this.plane) this.plane = polys[0].plane;
    const front: CPoly[] = [];
    const back: CPoly[] = [];
    for (const p of polys) splitPolygon(this.plane, p, this.polys, this.polys, front, back);
    if (front.length) {
      if (!this.front) this.front = new Node();
      this.front.build(front);
    }
    if (back.length) {
      if (!this.back) this.back = new Node();
      this.back.build(back);
    }
  }
}

function toPolygons(solid: PolySolid): CPoly[] {
  const mesh = buildMesh(solid, 0);
  const out: CPoly[] = [];
  for (const t of mesh.tris) {
    const a = mesh.verts[t.a];
    const b = mesh.verts[t.b];
    const c = mesh.verts[t.c];
    const plane = planeFrom(a, b, c);
    if (!plane) continue;
    out.push({ verts: [a, b, c], plane, group: t.group });
  }
  return out;
}

function fromPolygons(polys: CPoly[], groups: FaceGroup[]): PolySolid {
  const seen = new Set<string>();
  const faces: PolyFace[] = [];
  for (const p of polys) {
    const pts = cleanPolygon(p.verts);
    if (pts.length < 3) continue;
    const k = `${p.group}:${pts.map(vkey).join('>')}`;
    if (seen.has(k)) continue;
    seen.add(k);
    faces.push({ group: p.group, pts });
  }
  return { faces, groups };
}

export interface SubtractOptions {
  group: string;
  name?: string;
  color?: string;
}

/** solid − tool,工具上残留的面归入 options.group(截断面) */
export function subtractSolid(
  solid: PolySolid,
  tool: PolySolid,
  options: SubtractOptions,
): PolySolid {
  const labeledTool: PolySolid = {
    faces: tool.faces.map((f) => ({ group: options.group, pts: f.pts })),
    groups: tool.groups,
  };
  const a = new Node(toPolygons(solid));
  const b = new Node(toPolygons(labeledTool));
  a.invert();
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  a.invert();

  const groups: FaceGroup[] = [...solid.groups];
  for (const g of tool.groups) {
    if (!groups.some((x) => x.id === g.id)) groups.push(g);
  }
  if (!groups.some((g) => g.id === options.group)) {
    groups.push({
      id: options.group,
      name: options.name ?? options.group,
      kind: 'cut',
      color: options.color,
    });
  }
  return fromPolygons(a.allPolygons(), groups);
}

/** 渲染用网格(截切后) */
export const meshOf = (solid: PolySolid): TriMesh => buildMesh(solid);
