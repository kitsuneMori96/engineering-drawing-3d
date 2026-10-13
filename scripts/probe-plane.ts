/** 探针:扫描 OX₁ 角度,找使 a₁b₁c₁ 共线的角度,对照 planeAxisAngle */
import { buildSystem, planeAxisAngle, type PlaneDef } from '../src/lib/engine';
import type { Vec3 } from '../src/lib/math';

const A: Vec3 = [1.6, 3.2, 3.4];
const B: Vec3 = [5.8, 5.6, 7.2];
const C: Vec3 = [5.0, 2.6, 4.6];
const pos: [number, number] = [0, 11];

function defs(angle: number): PlaneDef[] {
  return [
    { id: 'V', parentId: null, name: 'V', axisLabel: null, axisPos: [0, 0], axisDir: [1, 0], side: 1, color: '#000' },
    { id: 'H', parentId: 'V', name: 'H', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '#000' },
    { id: 'V1', parentId: 'H', name: 'V₁', axisLabel: 'OX₁', axisPos: pos, axisDir: [Math.cos(angle), Math.sin(angle)], side: -1, color: '#000' },
  ];
}

function cross(angle: number): number {
  const sys = buildSystem(defs(angle), () => 1);
  const a = sys.local('V1', A);
  const b = sys.local('V1', B);
  const c = sys.local('V1', C);
  const v1: [number, number] = [b[0] - a[0], b[1] - a[1]];
  const v2: [number, number] = [c[0] - a[0], c[1] - a[1]];
  return Math.abs(v1[0] * v2[1] - v1[1] * v2[0]);
}

const hla = planeAxisAngle(A, B, C);
console.log(`planeAxisAngle = ${((hla * 180) / Math.PI).toFixed(3)}°  cross@hla = ${cross(hla).toExponential(3)}`);

// 扫描 -90°..90°,步进 1°
let best = { a: 0, c: Infinity };
for (let d = -90; d <= 90; d += 1) {
  const c = cross((d * Math.PI) / 180);
  if (c < best.c) best = { a: d, c };
}
console.log(`扫描最优: ${best.a}°  cross = ${best.c.toExponential(3)}`);

// 精扫 ±2° 步进 0.05°
for (let d = best.a - 2; d <= best.a + 2; d += 0.05) {
  const c = cross((d * Math.PI) / 180);
  if (c < best.c) best = { a: d, c };
}
console.log(`精扫最优: ${best.a.toFixed(2)}°  cross = ${best.c.toExponential(3)}`);

// 打印几组候选角度
for (const [name, ang] of [
  ['hla', hla],
  ['hla+90', hla + Math.PI / 2],
  ['-hla', -hla],
  ['best', (best.a * Math.PI) / 180],
] as const) {
  console.log(`${name} = ${(((ang as number) * 180) / Math.PI).toFixed(2)}°  cross=${cross(ang as number).toExponential(3)}`);
}

// 坐标约定探查
const sys0 = buildSystem(defs(0), () => 1);
console.log('V1 local A:', sys0.local('V1', A), ' H local A:', sys0.local('H', A), ' V local A:', sys0.local('V', A));
console.log('sheetPos V1 A:', sys0.sheetPos('V1', A), ' sheetPos H A:', sys0.sheetPos('H', A));
