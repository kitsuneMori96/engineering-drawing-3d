import { describe, expect, it } from 'vitest';
import {
  buildSystem,
  computeAxisH2,
  defaultAxisH2Offset,
  planeAxisAngle,
  projLabel,
  type PlaneDef,
} from './engine';
import { dot2, norm2, type Vec2, type Vec3 } from './math';

const near = (a: number, b: number, eps = 1e-9) => expect(a).closeTo(b, eps);

const A: Vec3 = [1.6, 3.2, 3.4];
const B: Vec3 = [5.8, 5.6, 7.2];
const C: Vec3 = [5.0, 2.6, 4.6];

const base: PlaneDef[] = [
  { id: 'V', parentId: null, name: 'V', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
  { id: 'H', parentId: 'V', name: 'H', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
];

function v1Def(axisPos: Vec2, angle: number): PlaneDef {
  return {
    id: 'V1',
    parentId: 'H',
    name: 'V₁',
    axisLabel: 'OX₁',
    axisPos,
    axisDir: norm2([Math.cos(angle), Math.sin(angle)]),
    side: -1,
    color: '',
  };
}

const len3 = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
const dist2 = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('一次换面(点的等距规律)', () => {
  const hA0 = buildSystem(base, () => 0).local('H', A);
  const hB0 = buildSystem(base, () => 0).local('H', B);
  const abDir = norm2([hB0[0] - hA0[0], hB0[1] - hA0[1]]);
  const v1 = v1Def([0, 6.4], Math.atan2(abDir[1], abDir[0]));
  const sys = buildSystem([...base, v1], () => 1);

  it('换面不换距:|a₁ 到 OX₁| = |a′ 到 OX|', () => {
    near(Math.abs(sys.local('V1', A)[1]), Math.abs(A[1]));
  });

  it('OX₁ ∥ ab 时 a₁b₁ 反映实长', () => {
    near(dist2(sys.local('V1', A), sys.local('V1', B)), len3(A, B));
  });

  it('投影连线 ⊥ 新轴,且 a、垂足、a₁ 共线', () => {
    const l1A = sys.local('V1', A);
    const sA_H = sys.sheetPos('H', A);
    const sA_V1 = sys.sheetPos('V1', A);
    const [e0, e1] = sys.axisSheetEndpoints('V1');
    const t = norm2([e1[0] - e0[0], e1[1] - e0[1]]);
    const foot: Vec2 = [sA_V1[0] + t[1] * l1A[1], sA_V1[1] - t[0] * l1A[1]];
    const c1: Vec2 = [sA_H[0] - foot[0], sA_H[1] - foot[1]];
    const c2: Vec2 = [sA_V1[0] - foot[0], sA_V1[1] - foot[1]];
    near(c1[0] * c2[1] - c1[1] * c2[0], 0);
    near(dot2([sA_V1[0] - sA_H[0], sA_V1[1] - sA_H[1]], t), 0);
  });
});

describe('二次换面(直线积聚成点 + 等距链)', () => {
  const v1 = v1Def([0, 6.4], Math.atan2(3.8, 4.2));
  const three = buildSystem([...base, v1], () => 1);
  const offset = defaultAxisH2Offset(three, A, B);
  const ax2 = computeAxisH2(three, A, B, offset, 'perp');
  const h2: PlaneDef = {
    id: 'H2', parentId: 'V1', name: 'H₂', axisLabel: 'OX₂',
    axisPos: ax2.pos, axisDir: ax2.dir, side: -1, color: '',
  };
  const sys = buildSystem([...base, v1, h2], () => 1);

  it('AB 在 H₂ 上积聚为一点', () => {
    expect(dist2(sys.sheetPos('H2', A), sys.sheetPos('H2', B))).toBeLessThan(1e-9);
  });

  it('等距链:|a₂ 到 OX₂| = |a 到 OX₁|', () => {
    const aH = sys.local('H', A);
    const p1: Vec2 = [-v1.axisDir[1], v1.axisDir[0]];
    const dToOX1 = Math.abs((aH[0] - v1.axisPos[0]) * p1[0] + (aH[1] - v1.axisPos[1]) * p1[1]);
    near(Math.abs(sys.local('H2', A)[1]), dToOX1);
  });
});

describe('平面换面(积聚成线 → 实形 → 倾角)', () => {
  const angle = planeAxisAngle(A, B, C);
  const v1 = v1Def([0, 11], angle);
  const three = buildSystem([...base, v1], () => 1);

  it('OX₁ ∥ 平面内水平线 ⇒ a₁b₁c₁ 共线(积聚成线)', () => {
    const la = three.local('V1', A);
    const lb = three.local('V1', B);
    const lc = three.local('V1', C);
    const d = norm2([lb[0] - la[0], lb[1] - la[1]]);
    const dev = Math.abs((lc[0] - la[0]) * d[1] - (lc[1] - la[1]) * d[0]);
    expect(dev).toBeLessThan(1e-9);
  });

  const ax2 = computeAxisH2(three, A, B, 3, 'parallel');
  const h2: PlaneDef = {
    id: 'H2', parentId: 'V1', name: 'H₂', axisLabel: 'OX₂',
    axisPos: ax2.pos, axisDir: ax2.dir, side: -1, color: '',
  };
  const sys = buildSystem([...base, v1, h2], () => 1);

  it('H₂ ∥ 平面 ⇒ 投影反映实形(对应边 = 实长)', () => {
    near(dist2(sys.local('H2', A), sys.local('H2', B)), len3(A, B));
    near(dist2(sys.local('H2', A), sys.local('H2', C)), len3(A, C));
  });

  it('倾角 δ:积聚线 p₁ 与 OX₁ 的夹角 = 平面与 H 面的真实夹角', () => {
    const la = sys.local('V1', A);
    const lb = sys.local('V1', B);
    const d = norm2([lb[0] - la[0], lb[1] - la[1]]);
    const delta = Math.acos(Math.min(1, Math.abs(d[0])));
    // 独立验证:平面法向 n 与 H 面法向的夹角补角
    const u: Vec3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v: Vec3 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n: Vec3 = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const nl = Math.hypot(...n);
    // V₁ 同时 ⊥ 平面与 H,⇒ 面内迹线夹角 = 真实二面角 = 法向夹角(H 法向 = y 轴)
    const expectDelta = Math.acos(Math.min(1, Math.abs(n[1]) / nl));
    near(delta, expectDelta, 1e-7);
  });
});

describe('投影命名', () => {
  it('V→a′,H→a,第 n 次换面→aₙ', () => {
    expect(projLabel('a', 'V')).toBe('a\u2032');
    expect(projLabel('a', 'H')).toBe('a');
    expect(projLabel('a', 'V1')).toBe('a\u2081');
    expect(projLabel('a', 'H2')).toBe('a\u2082');
  });
});
