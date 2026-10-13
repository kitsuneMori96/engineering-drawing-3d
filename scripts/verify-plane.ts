/**
 * 平面章几何验证(临时,验证后删除):
 * 1. OX₁ ∥ 平面内水平线时,a₁、b₁、c₁ 共线(积聚成线)
 * 2. OX₁ 旋转偏离后共线性被破坏
 * 3. 二次换面 OX₂ ∥ 积聚线时,H₂ 上实形:a₂b₂=|AB|、a₂c₂=|AC|、a₂c₂ 与 a₂b₂ 夹角 = ∠BAC
 * 4. 二次换面等距链 |a₂到OX₂| = |a到OX₁|
 */
import {
  buildSystem,
  computeAxisH2,
  planeAxisAngle,
  type PlaneDef,
} from '../src/lib/engine';
import type { Vec3 } from '../src/lib/math';

const A: Vec3 = [1.6, 3.2, 3.4];
const B: Vec3 = [5.8, 5.6, 7.2];
const C: Vec3 = [5.0, 2.6, 4.6];

const pos: [number, number] = [0, 11];
const ang = planeAxisAngle(A, B, C);

function chainDefs(axisAngle: number): PlaneDef[] {
  return [
    { id: 'V', parentId: null, name: 'V', axisLabel: null, axisPos: [0, 0], axisDir: [1, 0], side: 1, color: '#000' },
    { id: 'H', parentId: 'V', name: 'H', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '#000' },
    { id: 'V1', parentId: 'H', name: 'V₁', axisLabel: 'OX₁', axisPos: pos, axisDir: [Math.cos(axisAngle), Math.sin(axisAngle)], side: -1, color: '#000' },
  ];
}

// V1 local 坐标:y 相同 ⇒ 在平行于 OX₁ 的直线上(对积聚而言还需共线,直接算叉积)
function collinearity(sys: ReturnType<typeof buildSystem>): number {
  const a = sys.local('V1', A);
  const b = sys.local('V1', B);
  const c = sys.local('V1', C);
  const v1: [number, number] = [b[0] - a[0], b[1] - a[1]];
  const v2: [number, number] = [c[0] - a[0], c[1] - a[1]];
  return Math.abs(v1[0] * v2[1] - v1[1] * v2[0]);
}

let fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? '✓' : '✗'} ${name}  (${detail})`);
  if (!ok) fail++;
};

// 1. 轴 ∥ 水平线 → 积聚
const sysOk = buildSystem(chainDefs(ang), () => 1);
const crossOk = collinearity(sysOk);
check('积聚成线:OX₁ ∥ 水平时三点共线', crossOk < 1e-9, `叉积 ${crossOk.toExponential(3)}`);

// 2. 轴偏离 10° → 破坏
const sysBad = buildSystem(chainDefs(ang + 0.1745), () => 1);
const crossBad = collinearity(sysBad);
check('条件可破坏:OX₁ 偏 10° 后不共线', crossBad > 0.1, `叉积 ${crossBad.toFixed(4)}`);

// 3. 二次换面:OX₂ ∥ 积聚线 → 实形
const { pos: h2pos, dir: h2dir } = computeAxisH2(sysOk, A, B, 8, 'parallel');
const sysH2 = buildSystem(
  [
    ...chainDefs(ang),
    { id: 'H2', parentId: 'V1', name: 'H₂', axisLabel: 'OX₂', axisPos: h2pos, axisDir: h2dir, side: -1, color: '#000' },
  ],
  () => 1,
);
const a2 = sysH2.local('H2', A);
const b2 = sysH2.local('H2', B);
const c2 = sysH2.local('H2', C);
const d = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const ab2 = d(a2, b2), ac2 = d(a2, c2);
const ab3 = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
const ac3 = Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
check('实形:a₂b₂ = |AB|', Math.abs(ab2 - ab3) < 1e-9, `${ab2.toFixed(6)} vs ${ab3.toFixed(6)}`);
check('实形:a₂c₂ = |AC|', Math.abs(ac2 - ac3) < 1e-9, `${ac2.toFixed(6)} vs ${ac3.toFixed(6)}`);

// 夹角:∠b₂a₂c₂ = ∠BAC
const ang2 = Math.atan2(c2[1] - a2[1], c2[0] - a2[0]) - Math.atan2(b2[1] - a2[1], b2[0] - a2[0]);
const ab: [number, number, number] = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
const ac: [number, number, number] = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
const dot = ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2];
const ang3 = Math.acos(dot / (ab3 * ac3));
const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const diff = Math.min(Math.abs(norm(ang2) - norm(ang3)), Math.abs(norm(-ang2) - norm(ang3)));
check('实形:∠b₂a₂c₂ = ∠BAC', diff < 1e-6 || Math.abs(Math.abs(ang2) - ang3) < 1e-6, `平面 ${ang3.toFixed(6)} rad`);

// 4. 等距链:a₂ 到 OX₂ = a 到 OX₁(a 在 H 上,其原轴为 OX₁)—— 口径同 verify-engine
const hA = sysOk.local('H', A);
const n1: [number, number] = [-Math.sin(ang), Math.cos(ang)];
const dA1H = Math.abs((hA[0] - pos[0]) * n1[0] + (hA[1] - pos[1]) * n1[1]);
const dA2toOx2 = Math.abs(sysH2.local('H2', A)[1]);
check('等距链:|a₂到OX₂| = |a到OX₁|', Math.abs(dA2toOx2 - dA1H) < 1e-9, `${dA2toOx2.toFixed(6)} vs ${dA1H.toFixed(6)}`);

if (fail > 0) {
  console.error(`\n${fail} 项失败 ✗`);
  process.exit(1);
}
console.log('\n平面章全部验证通过 ✔');
