import * as THREE from 'three';
import type { Vec2, Vec3 } from './math';
import { add2, add3, cross3, dot3, len2, mul2, mul3, norm2, norm3, sub2, sub3 } from './math';

/**
 * 投影体系 = 投影面链。根为 V 面(不动),每个新投影面通过一根"轴"铰接在
 * 父投影面内,且恒垂直于父面(换面法体系的直角性)。
 *
 * 局部坐标约定(每个投影面):
 *   u —— 沿轴方向;v —— 垂直于轴、指向"距离方向"(= 父面法向)。
 *   点在该面上的投影局部坐标 = ((A - 轴原点)·u, (A - 轴原点)·v)。
 * 等距规律是这个几何的自动推论:子面 v 坐标 = A 在父面法向上的分量
 * = 被替换投影到其旧轴的距离。
 */
export interface PlaneDef {
  id: string;
  parentId: string | null;
  /** 显示名:'V' | 'H' | 'V₁' … */
  name: string;
  /** 轴名:'OX' | 'OX₁' … */
  axisLabel: string;
  /** 轴在父面局部坐标中的位置与方向(dir 会被归一化) */
  axisPos: Vec2;
  axisDir: Vec2;
  /** 展开侧:+1/-1,默认 -1(新面展开到背离父视图一侧) */
  side: 1 | -1;
  color: string;
}

/** 正交坐标架:o 原点,u/v 面内正交基,n 面法向 */
export interface Frame3 {
  o: Vec3;
  u: Vec3;
  v: Vec3;
  n: Vec3;
}

const ROOT_FRAME: Frame3 = { o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] };

function axisOf(def: PlaneDef, parent: Frame3): { o: Vec3; u: Vec3 } {
  const d = norm2(def.axisDir);
  const u = add3(mul3(parent.u, d[0]), mul3(parent.v, d[1]));
  const o = add3(
    parent.o,
    add3(mul3(parent.u, def.axisPos[0]), mul3(parent.v, def.axisPos[1])),
  );
  return { o, u };
}

/** 未展开(空间真实位置)坐标架 */
function spatialFrames(defs: Map<string, PlaneDef>): Map<string, Frame3> {
  const out = new Map<string, Frame3>();
  const build = (id: string): Frame3 => {
    const cached = out.get(id);
    if (cached) return cached;
    const def = defs.get(id)!;
    let f: Frame3;
    if (!def.parentId) {
      f = ROOT_FRAME;
    } else {
      const parent = build(def.parentId);
      const { o, u } = axisOf(def, parent);
      const v = parent.n;
      f = { o, u, v, n: norm3(cross3(u, v)) };
    }
    out.set(id, f);
    return f;
  };
  for (const id of defs.keys()) build(id);
  return out;
}

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qt = new THREE.Quaternion();
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();

/** 将单位向量 a 绕轴旋转 t∈[0,1] 走到 b(90° 以内的大圆插值) */
function rotateToward(a: Vec3, b: Vec3, t: number): Vec3 {
  _va.set(a[0], a[1], a[2]);
  _vb.set(b[0], b[1], b[2]);
  _qa.identity();
  _qb.setFromUnitVectors(_va, _vb);
  _qt.slerpQuaternions(_qa, _qb, t);
  _va.set(a[0], a[1], a[2]).applyQuaternion(_qt);
  return [_va.x, _va.y, _va.z];
}

/** 展开到 t 时的坐标架;t=1 即纸面(综合投影图)位置 */
function renderFrames(
  defs: Map<string, PlaneDef>,
  unfoldOf: (id: string) => number,
): Map<string, Frame3> {
  const out = new Map<string, Frame3>();
  const build = (id: string): Frame3 => {
    const cached = out.get(id);
    if (cached) return cached;
    const def = defs.get(id)!;
    let f: Frame3;
    if (!def.parentId) {
      f = ROOT_FRAME;
    } else {
      const parent = build(def.parentId);
      const { o, u } = axisOf(def, parent);
      const t = Math.min(1, Math.max(0, unfoldOf(id)));
      let v = parent.n;
      if (t > 0) {
        const d = norm2(def.axisDir);
        const target = add3(
          mul3(parent.u, -d[1] * def.side),
          mul3(parent.v, d[0] * def.side),
        );
        v = rotateToward(parent.n, target, t);
      }
      f = { o, u, v, n: norm3(cross3(u, v)) };
    }
    out.set(id, f);
    return f;
  };
  for (const id of defs.keys()) build(id);
  return out;
}

const frameXY = (f: Frame3): { o: Vec2; u: Vec2; v: Vec2 } => ({
  o: [f.o[0], f.o[1]],
  u: [f.u[0], f.u[1]],
  v: [f.v[0], f.v[1]],
});

export interface System {
  defs: Map<string, PlaneDef>;
  order: string[];
  /** 空间(未展开)坐标架 */
  spatial: (id: string) => Frame3;
  /** 纸面(完全展开)坐标架 */
  sheetFrame: (id: string) => { o: Vec2; u: Vec2; v: Vec2 };
  /** 点在某投影面上的投影,局部坐标(u 沿轴,v 为到轴距离方向) */
  local: (id: string, A: Vec3) => Vec2;
  /** 点的投影在纸面上的坐标 */
  sheetPos: (id: string, A: Vec3) => Vec2;
  /** 点的投影在当前展开状态下的空间位置 */
  renderPos: (id: string, A: Vec3) => Vec3;
  /** 投影面在当前展开状态下的坐标架 */
  renderFrame: (id: string) => Frame3;
  /** 纸面坐标 → 某投影面局部坐标(用于拖拽换算) */
  sheetToLocal: (id: string, p: Vec2) => Vec2;
  /** 轴在纸面上的两个端点(供绘图) */
  axisSheetEndpoints: (id: string, halfLen?: number) => [Vec2, Vec2];
}

export function buildSystem(defs: PlaneDef[], unfoldOf: (id: string) => number): System {
  const map = new Map(defs.map((d) => [d.id, d]));
  const order = defs.map((d) => d.id);
  const spatial = spatialFrames(map);
  const sheetFrames = renderFrames(map, () => 1);
  const rendered = renderFrames(map, unfoldOf);

  const local = (id: string, A: Vec3): Vec2 => {
    const f = spatial.get(id)!;
    const d = sub3(A, f.o);
    return [dot3(d, f.u), dot3(d, f.v)];
  };
  const posInFrame = (f: Frame3, lu: number, lv: number): Vec3 =>
    add3(f.o, add3(mul3(f.u, lu), mul3(f.v, lv)));

  return {
    defs: map,
    order,
    spatial: (id) => spatial.get(id)!,
    sheetFrame: (id) => frameXY(sheetFrames.get(id)!),
    local,
    sheetPos: (id, A) => {
      const [lu, lv] = local(id, A);
      const p = posInFrame(sheetFrames.get(id)!, lu, lv);
      return [p[0], p[1]];
    },
    renderPos: (id, A) => {
      const [lu, lv] = local(id, A);
      return posInFrame(rendered.get(id)!, lu, lv);
    },
    renderFrame: (id) => rendered.get(id)!,
    sheetToLocal: (id, p) => {
      const f = sheetFrames.get(id)!;
      const d: Vec3 = [p[0] - f.o[0], p[1] - f.o[1], 0];
      return [dot3(d, f.u), dot3(d, f.v)];
    },
    axisSheetEndpoints: (id, halfLen = 30) => {
      const f = frameXY(sheetFrames.get(id)!);
      return [
        [f.o[0] - f.u[0] * halfLen, f.o[1] - f.u[1] * halfLen],
        [f.o[0] + f.u[0] * halfLen, f.o[1] + f.u[1] * halfLen],
      ];
    },
  };
}

/** 投影面名称后缀:根 V → a′,H → a,第 n 次换面 → aₙ */
export function projLabel(base: string, planeId: string): string {
  if (planeId === 'V') return base + '\u2032';
  if (planeId === 'H') return base;
  const n = planeId.match(/(\d+)$/)?.[1] ?? '1';
  const sub = String.fromCodePoint(0x2080 + Number(n));
  return base + sub;
}

/** OX₂ 的两种模式:'perp' = 直线积聚成点,'parallel' = 平面积聚线求实形 */
export type AxisH2Mode = 'perp' | 'parallel';

/**
 * 二次换面新轴 OX₂,只有 1 个平移自由度:
 * - 'perp'(直线 → 积聚成点):方向 ⊥ a₁b₁(保证 H₂ ⊥ AB),位置 = a₁ 沿 a₁b₁ 偏移 offset
 * - 'parallel'(平面积聚线 → 求实形):方向 ∥ 积聚线 p₁(保证 H₂ ∥ 平面),
 *   位置 = 从 p₁ 沿其法向偏移 offset
 */
export function computeAxisH2(
  sys: System,
  A: Vec3,
  B: Vec3,
  offset: number,
  mode: AxisH2Mode = 'perp',
): { pos: Vec2; dir: Vec2 } {
  const lA = sys.local('V1', A);
  const lB = sys.local('V1', B);
  const e = norm2(sub2(lB, lA));
  if (mode === 'parallel') {
    const perp: Vec2 = [-e[1], e[0]];
    return { pos: add2(lA, mul2(perp, offset)), dir: e };
  }
  return { pos: add2(lA, mul2(e, offset)), dir: [-e[1], e[0]] };
}

/**
 * 使 V₁ ⊥ 平面 ABC(积聚成线)的 OX₁ 方向角(H 局部坐标)。
 * 推导:n = (B-A)×(C-A);水平线 d = n × e₁ = (-n₂, 0, n₀)(e₁ = H 法向,即
 * world[1] 方向,H 面 = world(0,2) 平面)。V₁ 法向须水平且 ⊥ n,约束与 d 相同
 * → n_V₁ ∥ d,而 OX₁ ⊥ n_V₁ → OX₁ ⊥ d 的 H 投影。
 * 等价:OX₁ ∥ n 在 H 面上的投影 (n₀, n₂)。
 * (注意:d 的 H 投影为 (-n₂, n₀),与 n 的 H 投影 (n₀, n₂) 垂直。)
 */
export function planeAxisAngle(A: Vec3, B: Vec3, C: Vec3): number {
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
  const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  const nx = uy * vz - uz * vy;
  const nz = ux * vy - uy * vx;
  return Math.atan2(nz, nx);
}

/** 默认 OX₂ 位置:越过 b₁ 一个单位(教材典型画法) */
export function defaultAxisH2Offset(sys: System, A: Vec3, B: Vec3): number {
  return len2(sub2(sys.local('V1', B), sys.local('V1', A))) + 1;
}
