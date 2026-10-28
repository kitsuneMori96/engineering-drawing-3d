import { describe, expect, it } from 'vitest';
import { buildSystem, type PlaneDef } from '../../lib/engine';
import { dot3, cross3, type Vec2, type Vec3 } from '../../lib/math';
import { box, boxBounds, cutX, cutY, extrudeX, extrudeZ, regularPrism, regularPyramid } from './bodies';
import { subtractSolid } from './csg';
import { cutSolid } from './clip';
import { SOLID_PROBLEMS, problemSolid } from './problems';
import { buildMesh, type TriMesh } from './mesh';
import { hiddenLines, viewBasis } from './hlr';
import { pickSurface, isPointVisible } from './ray';

const near = (a: number, b: number, eps = 1e-7) => expect(a).closeTo(b, eps);

function volume(mesh: TriMesh): number {
  let v = 0;
  for (const t of mesh.tris) {
    const a = mesh.verts[t.a];
    const b = mesh.verts[t.b];
    const c = mesh.verts[t.c];
    v += dot3(a, cross3(b, c)) / 6;
  }
  return Math.abs(v);
}

function closed(mesh: TriMesh): boolean {
  const count = new Map<string, number>();
  const key = (i: number, j: number) => (i < j ? `${i}|${j}` : `${j}|${i}`);
  for (const t of mesh.tris) {
    for (const [i, j] of [
      [t.a, t.b],
      [t.b, t.c],
      [t.c, t.a],
    ]) {
      const k = key(i, j);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  return [...count.values()].every((n) => n === 2);
}

describe('三角化与特征边', () => {
  it('长方体:体积、闭合、12 条特征边', () => {
    const mesh = buildMesh(box(4, 6, 3));
    near(volume(mesh), 72);
    expect(closed(mesh)).toBe(true);
    expect(mesh.edges.length).toBe(12);
  });

  it('正六棱柱:体积 = 底面积 × 高', () => {
    const r = 2;
    const h = 5;
    const mesh = buildMesh(regularPrism(6, r, h));
    const area = (3 * Math.sqrt(3) * r * r) / 2;
    near(volume(mesh), area * h, 1e-6);
    expect(closed(mesh)).toBe(true);
    expect(mesh.edges.length).toBe(18);
  });

  it('正四棱锥:体积 = 底面积 × 高 / 3', () => {
    const r = 3;
    const h = 4;
    const mesh = buildMesh(regularPyramid(4, r, h, Math.PI / 4));
    const side = r * Math.SQRT2;
    near(volume(mesh), (side * side * h) / 3, 1e-6);
    expect(closed(mesh)).toBe(true);
  });

  it('包含非凸截断面的多刀截切仍闭合', () => {
    const base = box(8, 6, 5);
    const cut = cutSolid(base, [cutY(3, 1), cutX(0, -1)]);
    const mesh = buildMesh(cut);
    expect(closed(mesh)).toBe(true);
    near(volume(mesh), 4 * 6 * 3, 1e-6);
  });
});

describe('半空间截切', () => {
  const profile: Vec2[] = [
    [0, 0],
    [0, 4],
    [3, 0],
  ];
  const prism = extrudeX(profile, 0, 10);

  it('横放三棱柱体积 = 截面面积 × 长', () => {
    const mesh = buildMesh(prism);
    near(volume(mesh), 60, 1e-6);
    expect(mesh.edges.length).toBe(9);
  });

  it('水平一刀:体积与截断面一致', () => {
    const cut = cutSolid(prism, [cutY(2, 1)]);
    const mesh = buildMesh(cut);
    near(volume(mesh), 45, 1e-6);
    expect(closed(mesh)).toBe(true);
    expect(cut.groups.some((g) => g.kind === 'cut')).toBe(true);
  });

  it('完全切掉 → 空体', () => {
    const cut = cutSolid(prism, [cutY(-1, 1)]);
    expect(cut.faces.length).toBe(0);
  });
});

describe('三面投影与视图基', () => {
  const x0 = 12;
  const defs: PlaneDef[] = [
    { id: 'V', parentId: null, name: 'V', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
    { id: 'H', parentId: 'V', name: 'H', axisLabel: 'OX', axisPos: [0, 0], axisDir: [1, 0], side: -1, color: '' },
    { id: 'W', parentId: 'V', name: 'W', axisLabel: 'OZ', axisPos: [x0, 0], axisDir: [0, 1], side: -1, color: '' },
  ];
  const sys = buildSystem(defs, () => 1);
  const P: Vec3 = [1.5, 2.5, 3.5];

  it('视图基与纸面坐标一致', () => {
    expect(viewBasis('V', x0).project(P)).toEqual([1.5, 2.5]);
    for (let i = 0; i < 2; i++) {
      near(viewBasis('H', x0).project(P)[i], [1.5, -3.5][i]);
      near(viewBasis('W', x0).project(P)[i], [x0 + 3.5, 2.5][i]);
      near(sys.sheetPos('V', P)[i], viewBasis('V', x0).project(P)[i]);
      near(sys.sheetPos('H', P)[i], viewBasis('H', x0).project(P)[i]);
      near(sys.sheetPos('W', P)[i], viewBasis('W', x0).project(P)[i]);
    }
  });
});

describe('BSP 布尔减(台阶/槽口)', () => {
  it('切掉一角:体积正确', () => {
    const base = box(6, 6, 6);
    const tool = boxBounds(0, 10, 3, 10, -10, 10);
    const cut = subtractSolid(base, tool, { group: 'cut1', name: '截断面' });
    const mesh = buildMesh(cut);
    near(volume(mesh), 216 - 54, 1e-5);
    // BSP 切分会在公共边上留下 T 形接点(位置都落在真实棱上),不要求严格水密
    expect(mesh.edges.length).toBeGreaterThan(12);
  });

  it('前表面横槽:俯视图出现虚线', () => {
    const base = box(8, 4, 6);
    const tool = boxBounds(-2, 2, 2, 4, 0.5, 3);
    const cut = subtractSolid(base, tool, { group: 'cut1', name: '槽' });
    const mesh = buildMesh(cut);
    near(volume(mesh), 8 * 4 * 6 - 4 * 2 * 1.5, 1e-5);
    const h = hiddenLines(mesh, viewBasis('H'));
    expect(h.hidden.length).toBeGreaterThan(0);
  });

  it('背后台阶:主视图出现虚线', () => {
    const base = box(8, 4, 6);
    const tool = boxBounds(-4, 0, 3, 6.5, -3, -0.5);
    const cut = subtractSolid(base, tool, { group: 'cut1', name: '台阶' });
    const mesh = buildMesh(cut);
    const v = hiddenLines(mesh, viewBasis('V'));
    expect(v.hidden.length).toBeGreaterThan(0);
  });
});

describe('隐藏线', () => {
  it('轴对齐长方体主视图无虚线(后棱与可见棱重合被抑制)', () => {
    const mesh = buildMesh(box(6, 4, 5));
    const r = hiddenLines(mesh, viewBasis('V'));
    expect(r.hidden.length).toBe(0);
    expect(r.visible.length).toBe(4);
  });

  it('斜切三棱柱:斜面轮廓可见', () => {
    const base = regularPrism(3, 3, 6, Math.PI / 2);
    const cut = cutSolid(base, [cutY(4, 1)]);
    const mesh = buildMesh(cut);
    const r = hiddenLines(mesh, viewBasis('V'));
    expect(r.visible.length).toBeGreaterThan(0);
    expect(closed(mesh)).toBe(true);
  });
});

describe('建模防呆断言', () => {
  it('extrudeZ 顺时针剖面在入口抛错', () => {
    expect(() => extrudeZ([[0, 0], [0, 2], [3, 2], [3, 0]], 0, 4)).toThrow(/剖面绕向错误/);
  });

  it('extrudeX 逆时针剖面在入口抛错', () => {
    expect(() => extrudeX([[0, 0], [3, 0], [0, 4]], 0, 10)).toThrow(/剖面绕向错误/);
  });

  it('切块未碰到实体在出口抛错', () => {
    const tool = boxBounds(10, 12, 0, 2, 0, 2);
    expect(() => subtractSolid(box(6, 6, 6), tool, { group: 'cut1', name: '缺口' })).toThrow(
      /未移除任何材料/,
    );
  });

  it('非凸台阶棱柱不被朝向启发式翻面(体积 = 截面积 × 长)', () => {
    const profile: Vec2[] = [
      [0, 5], [1, 5], [1, 4], [2, 4], [2, 1.7], [3, 1.7], [3, 1], [4, 1], [4, 0], [0, 0],
    ];
    const mesh = buildMesh(extrudeX(profile, -4, 4));
    near(volume(mesh), 11.7 * 8, 1e-6);
    expect(closed(mesh)).toBe(true);
  });

  it('十题模型全部通过校验且体积为正', () => {
    for (const p of SOLID_PROBLEMS) {
      const built = problemSolid(p.id);
      expect(built.solid.faces.length).toBeGreaterThan(0);
      expect(volume(built.mesh)).toBeGreaterThan(1);
    }
  });

  it('第 5 题非凸缺口:体积与数值积分一致(24.32)', () => {
    near(volume(problemSolid(5).mesh), 24.323, 0.02);
  });
});

describe('表面取点', () => {
  const mesh = buildMesh(box(8, 4, 6));

  it('主视图中心命中前面 z=+2', () => {
    const hit = pickSurface(mesh, viewBasis('V'), [0, 3]);
    expect(hit).not.toBeNull();
    expect(hit!.point[2]).toBeCloseTo(2, 6);
    expect(hit!.front).toBe(true);
  });

  it('俯视图中心命中顶面 y=6', () => {
    const hit = pickSurface(mesh, viewBasis('H'), [0, 0]);
    expect(hit!.point[1]).toBeCloseTo(6, 6);
    expect(hit!.front).toBe(true);
  });

  it('左视图中心命中左面 x=−4', () => {
    const hit = pickSurface(mesh, viewBasis('W'), [12 + 0, 3]);
    expect(hit!.point[0]).toBeCloseTo(-4, 6);
    expect(hit!.front).toBe(true);
    expect(isPointVisible(mesh, viewBasis('W'), hit!.point)).toBe(true);
  });

  it('背面点在该视图不可见', () => {
    const back: Vec3 = [0, 3, -2];
    expect(isPointVisible(mesh, viewBasis('V'), back)).toBe(false);
  });

  it('限定面组取点', () => {
    const base = box(8, 4, 6);
    const cut = cutSolid(base, [cutY(4, 1)]);
    const m = buildMesh(cut);
    const hit = pickSurface(m, viewBasis('H'), [0, 0], 'cut1');
    expect(hit).not.toBeNull();
    expect(hit!.point[1]).toBeCloseTo(4, 6);
  });
});
