import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../lib/math';
import { buildSystem } from '../../lib/engine';
import {
  clipToTriangle2D,
  coincidentPair,
  compareValue,
  crossStub,
  hiddenInterval,
  isTrueIntersection,
  linePoint,
  lineVsPlane,
  planePointAtView,
  projH,
  projV,
  segSegCross,
  visibleOfCoincident,
} from './vis';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const vec3Near = (a: Vec3, b: Vec3, eps = 1e-6) =>
  a.every((v, i) => near(v, b[i], eps));

describe('segSegCross', () => {
  it('求交点与参数', () => {
    const r = segSegCross([0, 0], [4, 4], [0, 4], [4, 0])!;
    expect(near(r.pt[0], 2)).toBe(true);
    expect(near(r.pt[1], 2)).toBe(true);
    expect(near(r.t, 0.5)).toBe(true);
    expect(near(r.u, 0.5)).toBe(true);
  });
  it('平行/退化/越界 → null', () => {
    expect(segSegCross([0, 0], [1, 0], [0, 1], [1, 1])).toBeNull();
    expect(segSegCross([0, 0], [0, 0], [0, 1], [1, 0])).toBeNull();
    expect(segSegCross([0, 0], [1, 0], [2, -1], [2, 1])).toBeNull();
    expect(segSegCross([0, 0], [10, 0], [5, 5], [5, 1])).toBeNull();
  });
});

describe('重影点', () => {
  const A: Vec3 = [3, 4, 1.5];
  const B: Vec3 = [3, 4, 5];
  const C: Vec3 = [6.5, 1, 3];
  const D: Vec3 = [6.5, 4.5, 3];
  it('ch0 预设:AB 对 V 重影,CD 对 H 重影', () => {
    expect(coincidentPair(A, B, 'V')).toBe(true);
    expect(coincidentPair(A, B, 'H')).toBe(false);
    expect(coincidentPair(C, D, 'H')).toBe(true);
    expect(coincidentPair(C, D, 'V')).toBe(false);
  });
  it('V 面比深度(前遮后),H 面比高度(高遮低)', () => {
    expect(vec3Near(visibleOfCoincident(A, B, 'V'), B)).toBe(true);
    expect(vec3Near(visibleOfCoincident(C, D, 'H'), D)).toBe(true);
  });
  it('破坏重影(高度差超容差)不再判为对 V 重影', () => {
    expect(coincidentPair(A, [3, 4.5, 5], 'V')).toBe(false);
  });
});

describe('ch1 交叉直线预设', () => {
  const A: Vec3 = [1, 5, 2];
  const B: Vec3 = [6, 2, 6];
  const C: Vec3 = [4.5, 3, 5];
  const D: Vec3 = [0.5, 1, 1];
  it('V/H 投影均交叉且非真相交', () => {
    expect(segSegCross(projV(A), projV(B), projV(C), projV(D))).not.toBeNull();
    expect(segSegCross(projH(A), projH(B), projH(C), projH(D))).not.toBeNull();
    expect(isTrueIntersection(A, B, C, D).yes).toBe(false);
  });
  it('两视图可见线不同(V 面 CD 在前,H 面 AB 在高)——教学要点', () => {
    const xv = segSegCross(projV(A), projV(B), projV(C), projV(D))!;
    const M = linePoint(A, B, xv.t);
    const N = linePoint(C, D, xv.u);
    expect(compareValue(M, 'V') < compareValue(N, 'V')).toBe(true);
    const xh = segSegCross(projH(A), projH(B), projH(C), projH(D))!;
    const M2 = linePoint(A, B, xh.t);
    const N2 = linePoint(C, D, xh.u);
    expect(compareValue(M2, 'H') > compareValue(N2, 'H')).toBe(true);
  });
  it('构造真相交:D = 2P − C 后两交点同柱,全实线', () => {
    const P = linePoint(A, B, 0.5);
    const D2: Vec3 = [2 * P[0] - C[0], 2 * P[1] - C[1], 2 * P[2] - C[2]];
    const t = isTrueIntersection(A, B, C, D2);
    expect(t.yes).toBe(true);
    expect(vec3Near(t.P!, P, 0.05)).toBe(true);
  });
  it('crossStub 关于交点对称', () => {
    const [p, q] = crossStub([2, 3], [1, 0], 0.7);
    expect(near(p[0], 1.3) && near(q[0], 2.7)).toBe(true);
  });
});

describe('ch2 线面相交(精确例)', () => {
  // 平面 x+h+d=4,直线 (8,8,8)→(0,0,0) 过重心
  const A: Vec3 = [0, 4, 0];
  const B: Vec3 = [4, 0, 0];
  const C: Vec3 = [0, 0, 4];
  const D: Vec3 = [8, 8, 8];
  const E: Vec3 = [0, 0, 0];
  it('交点 K = 重心,s = 5/6,在三角形内', () => {
    const hit = lineVsPlane(D, E, A, B, C)!;
    expect(near(hit.s, 5 / 6, 1e-9)).toBe(true);
    expect(vec3Near(hit.K, [4 / 3, 4 / 3, 4 / 3])).toBe(true);
    expect(hit.insideTri).toBe(true);
  });
  it('两面被挡区间均为 [5/6, 1](穿入平面后在两面都更远/更低)', () => {
    expect(hiddenInterval('V', D, E, A, B, C)![0]).toBeCloseTo(5 / 6, 9);
    expect(hiddenInterval('V', D, E, A, B, C)![1]).toBeCloseTo(1, 9);
    expect(hiddenInterval('H', D, E, A, B, C)![0]).toBeCloseTo(5 / 6, 9);
    expect(hiddenInterval('H', D, E, A, B, C)![1]).toBeCloseTo(1, 9);
  });
  it('反向穿过:被挡区间为 [0, 1/6]', () => {
    const iv = hiddenInterval('V', E, D, A, B, C)!;
    expect(iv[0]).toBeCloseTo(0, 9);
    expect(iv[1]).toBeCloseTo(1 / 6, 9);
  });
  it('线在平面内(平行)→ 无交点、无遮挡', () => {
    expect(lineVsPlane([0, 4, 0], [4, 0, 0], A, B, C)).toBeNull();
    expect(hiddenInterval('V', [0, 4, 0], [4, 0, 0], A, B, C)).toBeNull();
  });
  it('交点在三角形外 → 不遮挡', () => {
    const hit = lineVsPlane([10, -5, 10], [0, -5, 0], A, B, C)!;
    expect(hit.insideTri).toBe(false);
    expect(hiddenInterval('V', [10, -5, 10], [0, -5, 0], A, B, C)).toBeNull();
  });
  it('planePointAtView:视图坐标反求平面上的点', () => {
    const K: Vec3 = [4 / 3, 4 / 3, 4 / 3];
    const got = planePointAtView('V', projV(K), A, B, C)!;
    expect(vec3Near(got, K, 1e-6)).toBe(true);
    expect(planePointAtView('V', [4.5, 4.5], A, B, C)).toBeNull();
  });
  it('clipToTriangle2D:完全在外 → null', () => {
    expect(
      clipToTriangle2D([10, 10], [11, 11], [
        [0, 4],
        [4, 0],
        [0, 0],
      ]),
    ).toBeNull();
  });
});

describe('坐标约定与共享引擎一致', () => {
  it('projH/projV 与 engine.sheetPos(V/H) 在全展开时一致', () => {
    const P: Vec3 = [2.5, 3.5, 1.5];
    const sys = buildSystem(
      [
        { id: 'V', parentId: null, name: 'V', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
        { id: 'H', parentId: 'V', name: 'H', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
      ],
      () => 1,
    );
    expect(vec3Near([sys.sheetPos('V', P)[0], sys.sheetPos('V', P)[1], 0] as Vec3, [...projV(P), 0] as Vec3)).toBe(true);
    expect(vec3Near([sys.sheetPos('H', P)[0], sys.sheetPos('H', P)[1], 0] as Vec3, [...projH(P), 0] as Vec3)).toBe(true);
  });
});
