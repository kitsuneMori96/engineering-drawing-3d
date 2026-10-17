import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../lib/math';
import { buildSystem } from '../../lib/engine';
import {
  auxPlaneCord,
  clipToTriangle2D,
  coincidentPair,
  compareValue,
  crossStub,
  hiddenInterval,
  isTrueIntersection,
  linePoint,
  lineVsPlane,
  planePointAtView,
  planePlane,
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

describe('ch3 两平面相交(预设精确例)', () => {
  // △ABC:平面 −x+5y+6z=31;△DEF 的边 DE、DF 各穿入三角形内部
  const A: Vec3 = [5, 6, 1];
  const B: Vec3 = [1, 4, 2];
  const C: Vec3 = [4, 1, 5];
  const D: Vec3 = [2.6, 6.4, 6.4];
  const E: Vec3 = [4.6, 3.8, 1.2];
  const F: Vec3 = [4.2, 1.2, 3.6];
  const K: Vec3 = [4.193073593073592, 4.329004329004329, 2.2580086580086585];
  const L: Vec3 = [3.9261261261261264, 2.09009009009009, 4.079279279279279];

  it('DE、DF 分别以 s=184/231、92/111 穿入 △ABC', () => {
    const h1 = lineVsPlane(D, E, A, B, C)!;
    const h2 = lineVsPlane(D, F, A, B, C)!;
    expect(near(h1.s, 184 / 231, 1e-9)).toBe(true);
    expect(h1.insideTri).toBe(true);
    expect(near(h2.s, 92 / 111, 1e-9)).toBe(true);
    expect(h2.insideTri).toBe(true);
  });
  it('planePlane:端点=两穿透点,分属 DE、FD 边', () => {
    const { parallel, hit } = planePlane(A, B, C, D, E, F);
    expect(parallel).toBe(false);
    expect(hit).not.toBeNull();
    expect(vec3Near(hit!.K, K, 1e-9)).toBe(true);
    expect(vec3Near(hit!.L, L, 1e-9)).toBe(true);
    expect(hit!.kEdge).toEqual(['D', 'E']);
    expect(hit!.lEdge).toEqual(['F', 'D']);
    expect(near(hit!.length, 2.8984521033175734, 1e-9)).toBe(true);
  });
  it('辅助面绳索:两端点 H 投影都在积聚线 de 上', () => {
    const cord = auxPlaneCord(D, E, [A, B, C])!;
    const v: [number, number] = [projH(E)[0] - projH(D)[0], projH(E)[1] - projH(D)[1]];
    for (const P of [cord.M, cord.N]) {
      const w: [number, number] = [projH(P)[0] - projH(D)[0], projH(P)[1] - projH(D)[1]];
      expect(Math.abs(w[0] * v[1] - w[1] * v[0])).toBeLessThan(1e-9);
    }
  });
  it('作图 ≡ 解析:m′n′ 与 d′e′ 的交点 = projV(K)、= projV(L)', () => {
    const c1 = auxPlaneCord(D, E, [A, B, C])!;
    const x1 = segSegCross(projV(D), projV(E), projV(c1.M), projV(c1.N))!;
    expect(vec3Near([...x1.pt, 0] as Vec3, [...projV(K), 0] as Vec3, 1e-6)).toBe(true);
    const c2 = auxPlaneCord(D, F, [A, B, C])!;
    const x2 = segSegCross(projV(D), projV(F), projV(c2.M), projV(c2.N))!;
    expect(vec3Near([...x2.pt, 0] as Vec3, [...projV(L), 0] as Vec3, 1e-6)).toBe(true);
  });
  it('逐边可见性:DE 两面被挡段均起于穿透点 s=184/231', () => {
    const ivV = hiddenInterval('V', D, E, A, B, C)!;
    const ivH = hiddenInterval('H', D, E, A, B, C)!;
    expect(near(ivV[0], 184 / 231, 1e-9)).toBe(true);
    expect(ivV[1]).toBeLessThan(1);
    expect(near(ivH[0], 184 / 231, 1e-9)).toBe(true);
    expect(near(ivH[1], 1, 1e-9)).toBe(true);
  });
  it('平行特例:E=D+0.8(B−A)、F=D+0.8(C−A) → 无交线', () => {
    const E2: Vec3 = [D[0] + 0.8 * (B[0] - A[0]), D[1] + 0.8 * (B[1] - A[1]), D[2] + 0.8 * (B[2] - A[2])];
    const F2: Vec3 = [D[0] + 0.8 * (C[0] - A[0]), D[1] + 0.8 * (C[1] - A[1]), D[2] + 0.8 * (C[2] - A[2])];
    expect(planePlane(A, B, C, D, E2, F2)).toEqual({ parallel: true, hit: null });
  });
  it('图形分离:整体平移 △DEF 后平面仍相交但线段不在重叠区 → hit null', () => {
    const sh = (P: Vec3): Vec3 => [P[0] + 6, P[1], P[2]];
    const r = planePlane(A, B, C, sh(D), sh(E), sh(F));
    expect(r.parallel).toBe(false);
    expect(r.hit).toBeNull();
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
