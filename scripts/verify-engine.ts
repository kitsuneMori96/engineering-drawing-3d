/**
 * 投影引擎数值验证(不依赖浏览器):
 * 1) 一次换面等距规律:|a₁ 到 OX₁| = |a′ 到 OX|
 * 2) 投影连线性质:a、a₁ 与垂足共线,连线 ⊥ OX₁
 * 3) 二次换面:换面后实长保持;一般位置线经两次换面积聚为点
 * 4) 二次换面等距链:|a₂ 到 OX₂| = |a₁ 到 OX₁|
 */
import { buildSystem, type PlaneDef } from '../src/lib/engine';
import { dot2, norm2, type Vec2 } from '../src/lib/math';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`);
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const A: readonly [number, number, number] = [1.6, 3.2, 3.4];
const B: readonly [number, number, number] = [5.8, 5.6, 7.2];

const base: PlaneDef[] = [
  { id: 'V', parentId: null, name: 'V', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
  { id: 'H', parentId: 'V', name: 'H', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
];

/* ---------- 一次换面 ---------- */
const hA0 = buildSystem(base, () => 0).local('H', A);
const hB0 = buildSystem(base, () => 0).local('H', B);
const abDir = norm2([hB0[0] - hA0[0], hB0[1] - hA0[1]]);
const v1def: PlaneDef = {
  id: 'V1', parentId: 'H', name: 'V₁', axisLabel: 'OX₁',
  axisPos: [0, 6.4], axisDir: abDir, side: -1, color: '',
};
const sys1 = buildSystem([...base, v1def], () => 1);

const l1A = sys1.local('V1', A);
check('等距规律:|a₁ 到 OX₁| = |a′ 到 OX|', near(Math.abs(l1A[1]), Math.abs(A[1])),
  `${Math.abs(l1A[1])} vs ${A[1]}`);

const sA_H = sys1.sheetPos('H', A);
const sA_V1 = sys1.sheetPos('V1', A);
const f1A = sys1.axisSheetEndpoints('V1');
const t1 = norm2([f1A[1][0] - f1A[0][0], f1A[1][1] - f1A[0][1]]);
const n1: Vec2 = [-t1[1], t1[0]];
const footA: Vec2 = [
  sA_V1[0] - n1[0] * l1A[1],
  sA_V1[1] - n1[1] * l1A[1],
];
const c1: Vec2 = [sA_H[0] - footA[0], sA_H[1] - footA[1]];
const c2: Vec2 = [sA_V1[0] - footA[0], sA_V1[1] - footA[1]];
check('a、垂足、a₁ 三点共线(叉积为零)', near(c1[0] * c2[1] - c1[1] * c2[0], 0, 1e-9));
check('连线 ⊥ 新轴', near(dot2([sA_V1[0] - sA_H[0], sA_V1[1] - sA_H[1]], t1), 0));

/* ---------- 二次换面(一般位置线 → 积聚) ---------- */
const l1B = sys1.local('V1', B);
const a1b1 = norm2([l1B[0] - l1A[0], l1B[1] - l1A[1]]);
const e: Vec2 = [-a1b1[1], a1b1[0]];
const h2def: PlaneDef = {
  id: 'H2', parentId: 'V1', name: 'H₂', axisLabel: 'OX₂',
  axisPos: [l1A[0] + e[0] * 4, l1A[1] + e[1] * 4], axisDir: e, side: -1, color: '',
};
const sys2 = buildSystem([...base, v1def, h2def], () => 1);

const lenAB = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
check('一次换面后反映实长', near(dist(l1A as Vec2, l1B as Vec2), lenAB, 1e-9),
  `|a₁b₁|=${dist(l1A as Vec2, l1B as Vec2)}, |AB|=${lenAB}`);

const sA_H2 = sys2.sheetPos('H2', A);
const sB_H2 = sys2.sheetPos('H2', B);
check('二次换面积聚成点:a₂ ≡ b₂', dist(sA_H2, sB_H2) < 1e-9, `间距 ${dist(sA_H2, sB_H2)}`);

const l2A = sys2.local('H2', A);
// 换面规律:新投影到新轴距离 = 被替换旧投影到其原轴距离。第二次替换 H 上的 a,其原轴为 OX₁。
const aLocalH = sys2.local('H', A);
const perpDir1: Vec2 = [-abDir[1], abDir[0]];
const distAToOX1 = Math.abs(
  (aLocalH[0] - v1def.axisPos[0]) * perpDir1[0] + (aLocalH[1] - v1def.axisPos[1]) * perpDir1[1],
);
check('二次换面等距链:|a₂ 到 OX₂| = |a 到 OX₁|', near(Math.abs(l2A[1]), distAToOX1),
  `${Math.abs(l2A[1])} vs ${distAToOX1}`);

if (failed > 0) {
  console.error(`\n${failed} 项验证失败`);
  process.exit(1);
}
console.log('\n全部验证通过 ✔');
