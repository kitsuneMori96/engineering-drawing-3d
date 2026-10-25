import type { Vec3 } from '../../lib/math';
import { dot3, len3, norm3, sub3 } from '../../lib/math';
import {
  cleanPolygon,
  orientFace,
  polygonNormal,
  vkey,
  type FaceGroup,
  type PolyFace,
  type PolySolid,
} from './mesh';

const EPS = 1e-6;

/** 半空间 n·P ≤ d(保留侧),n 为单位外法向 */
export interface CutPlane {
  n: Vec3;
  d: number;
  group?: string;
  label?: string;
  color?: string;
}

export const cutAt = (n: Vec3, point: Vec3, extra: Partial<CutPlane> = {}): CutPlane => {
  const nn = norm3(n);
  return { n: nn, d: dot3(nn, point), ...extra };
};

interface Clipped {
  pts: Vec3[];
  onPlane: boolean[];
  cut: Vec3[]; // 落在切平面上的新边界点(按多边形走向)
}

function clipFace(pts: Vec3[], plane: CutPlane): Clipped | null {
  const s = pts.map((p) => dot3(plane.n, p) - plane.d);
  const inside = s.map((v) => v <= EPS);
  if (inside.every(Boolean)) return { pts, onPlane: s.map((v) => Math.abs(v) <= EPS), cut: [] };
  if (!inside.some(Boolean)) return null;

  const out: Vec3[] = [];
  const onPlane: boolean[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p = pts[i];
    const q = pts[j];
    const sp = s[i];
    const sq = s[j];
    if (sp <= EPS) {
      out.push(p);
      onPlane.push(Math.abs(sp) <= EPS);
    }
    if ((sp <= EPS) !== (sq <= EPS)) {
      const t = sp / (sp - sq);
      out.push([
        p[0] + (q[0] - p[0]) * t,
        p[1] + (q[1] - p[1]) * t,
        p[2] + (q[2] - p[2]) * t,
      ]);
      onPlane.push(true);
    }
  }
  const cleaned: Vec3[] = [];
  const flags: boolean[] = [];
  for (let i = 0; i < out.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && len3(sub3(out[i], prev)) <= 1e-7) {
      flags[flags.length - 1] = flags[flags.length - 1] || onPlane[i];
      continue;
    }
    cleaned.push(out[i]);
    flags.push(onPlane[i]);
  }
  if (cleaned.length < 3) return null;
  // 相邻重合点合并后,首尾也可能重合
  while (cleaned.length > 1 && len3(sub3(cleaned[0], cleaned[cleaned.length - 1])) <= 1e-7) {
    cleaned.pop();
    flags.pop();
  }
  const cut: Vec3[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const j = (i + 1) % cleaned.length;
    if (flags[i] && flags[j]) cut.push(cleaned[i], cleaned[j]);
  }
  return { pts: cleaned, onPlane: flags, cut };
}

/** 把切平面上的线段串成闭合环 */
function chainLoops(segs: [Vec3, Vec3][]): Vec3[][] {
  const key = (p: Vec3) => vkey(p);
  const seen = new Set<string>();
  const uniq: [Vec3, Vec3][] = [];
  for (const [a, b] of segs) {
    if (len3(sub3(a, b)) <= 1e-7) continue;
    const ka = key(a);
    const kb = key(b);
    if (ka === kb) continue;
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push([a, b]);
  }
  const adj = new Map<string, number[]>();
  uniq.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const k = key(p);
      const list = adj.get(k) ?? [];
      list.push(i);
      adj.set(k, list);
    }
  });
  const used = new Array(uniq.length).fill(false);
  const loops: Vec3[][] = [];
  for (let start = 0; start < uniq.length; start++) {
    if (used[start]) continue;
    const loop: Vec3[] = [];
    let curIdx = start;
    let curPt = uniq[start][0];
    let guard = uniq.length * 2 + 8;
    while (guard-- > 0) {
      used[curIdx] = true;
      loop.push(curPt);
      const [a, b] = uniq[curIdx];
      const nextPt = key(curPt) === key(a) ? b : a;
      const cands = adj.get(key(nextPt)) ?? [];
      let nextIdx = -1;
      for (const c of cands) {
        if (!used[c]) {
          nextIdx = c;
          break;
        }
      }
      if (nextIdx < 0) {
        loops.push(loop);
        break;
      }
      curIdx = nextIdx;
      curPt = nextPt;
    }
  }
  return loops.filter((l) => l.length >= 3);
}

/** 半空间截切;可连续多刀(台阶、槽口) */
export function cutSolid(solid: PolySolid, planes: CutPlane[]): PolySolid {
  let faces: PolyFace[] = solid.faces.map((f) => ({ ...f }));
  const groups: FaceGroup[] = [...solid.groups];
  let cutNo = 0;

  for (const plane of planes) {
    const nextFaces: PolyFace[] = [];
    const segs: [Vec3, Vec3][] = [];
    for (const face of faces) {
      const pts = cleanPolygon(face.pts);
      if (pts.length < 3) continue;
      const res = clipFace(pts, plane);
      if (!res) continue;
      if (res.pts.length >= 3) nextFaces.push({ group: face.group, pts: res.pts });
      for (let i = 0; i < res.cut.length; i += 2) segs.push([res.cut[i], res.cut[i + 1]]);
    }
    for (const loop of chainLoops(segs)) {
      cutNo += 1;
      const id = plane.group ?? `cut${cutNo}`;
      if (!groups.some((g) => g.id === id)) {
        groups.push({
          id,
          name: plane.label ?? `截断面 ${cutNo}`,
          kind: 'cut',
          color: plane.color,
        });
      }
      const ordered = orientFace(cleanPolygon(loop), plane.n);
      if (ordered.length >= 3 && len3(polygonNormal(ordered)) > 0.5) {
        nextFaces.push({ group: id, pts: ordered });
      }
    }
    faces = nextFaces;
    if (!faces.length) break;
  }

  return { faces, groups };
}

/** 按面组拆分(3D 着色 / 高亮用) */
export function facesOfGroup(solid: PolySolid, group: string): PolyFace[] {
  return solid.faces.filter((f) => f.group === group);
}
