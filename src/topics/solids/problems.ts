import type { Vec2, Vec3 } from '../../lib/math';
import { boxBounds, extrudeX, extrudeZ, regularFrustum, regularPrism, regularPyramid } from './bodies';
import { cutAt, cutSolid } from './clip';
import { subtractSolid } from './csg';
import { buildMesh, translateSolid, type PolySolid, type TriMesh } from './mesh';
import type { ViewId } from './hlr';

export interface SolidProblem {
  id: number;
  title: string;
  base: string;
  cut: string;
  given: ViewId[];
  missing: ViewId;
  /** 图意把握不足时提示对照教材核对 */
  note?: string;
  build: () => PolySolid;
}

const TRI: Vec2[] = [
  [-3, 0],
  [3, 0],
  [0, 5],
];

/** 正五边形截面(尖角朝上),(z,y) 坐标,底边落在 y=0 */
const PENT_W: Vec2[] = (() => {
  const r = 3.2;
  const lift = r * Math.cos(Math.PI / 5);
  return Array.from({ length: 5 }, (_, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [r * Math.cos(a), r * Math.sin(a) + lift] as Vec2;
  });
})();

/** 第 1 题:横放三棱柱,左上被水平台阶切掉一截 */
function build1(): PolySolid {
  const base = extrudeX(TRI, -4, 4);
  return subtractSolid(base, boxBounds(-6, -0.6, 2.6, 6.5, -4, 4), {
    group: 'cut1',
    name: '台阶截断面',
    color: '#f59e0b',
  });
}

/** 第 2 题:三棱锥,前上角切去一块 */
function build2(): PolySolid {
  const base = regularPyramid(3, 3.2, 5.4, Math.PI / 2);
  return subtractSolid(base, boxBounds(0.9, 6, 2.6, 7, -0.4, 5), {
    group: 'cut1',
    name: '切口',
    color: '#f59e0b',
  });
}

/** 第 3 题:四棱锥(菱形底),左立切 + 斜切 + 顶部水平切 */
function build3(): PolySolid {
  let s = regularPyramid(4, 3.6, 5.2, 0);
  s = cutSolid(s, [
    cutAt([-1, 0, 0], [-2, 0, 0], { group: 'cut1', label: '立切面', color: '#f59e0b' }),
  ]);
  s = cutSolid(s, [
    cutAt([-2.8, 4.8, 0], [0.4, 4.0, 0], { group: 'cut2', label: '斜切面', color: '#22c55e' }),
  ]);
  s = cutSolid(s, [
    cutAt([0, 1, 0], [0, 4.0, 0], { group: 'cut3', label: '水平切面', color: '#3b82f6' }),
  ]);
  return s;
}

/** 第 4 题:四棱台,顶部开通槽(槽底以上、前后贯通) */
function build4(): PolySolid {
  const base = regularFrustum(4, 4.4, 2.0, 5, 0);
  return subtractSolid(base, boxBounds(-1.5, 1.5, 2.2, 6, -6, 6), {
    group: 'cut1',
    name: '通槽',
    color: '#f59e0b',
  });
}

/** 第 5 题:四棱锥,前半侧斜切 + 水平切,形成带台阶的缺口 */
function build5(): PolySolid {
  const base = regularPyramid(4, 3.8, 5.6, 0);
  // 缺口沿 z 只切前半:V 面投影为 D-F-G-A 折线,后半保留完整三角形轮廓
  const cut = { group: 'cut1', name: '切口', color: '#f59e0b' };
  let s = subtractSolid(
    base,
    extrudeZ(
      [
        [-0.9, 4.2],
        [1.6, 2.0],
        [-2.0, 1.85],
      ],
      0,
      4.2,
    ),
    cut,
  );
  s = subtractSolid(
    s,
    extrudeZ(
      [
        [-0.9, 4.2],
        [-2.0, 1.85],
        [-3.8, 0],
      ],
      0,
      4.2,
    ),
    cut,
  );
  return s;
}

/** 第 6 题:横放阶梯棱柱,左端用斜面截切 */
function build6(): PolySolid {
  // W 视可见台阶由前(近)向后(远)逐级降低
  const profile: Vec2[] = [
    [-3.2, 0],
    [3.2, 0],
    [3.2, 1.0],
    [1.5, 1.0],
    [1.5, 1.6],
    [0.3, 1.6],
    [0.3, 3.5],
    [-0.9, 3.5],
    [-0.9, 4.6],
    [-3.2, 4.6],
  ];
  let s = extrudeX(profile, -4, 4);
  s = cutSolid(s, [
    cutAt([-4.6, 3.4, 0], [-4, 0, 0], { group: 'cut1', label: '左端斜切面', color: '#f59e0b' }),
  ]);
  return s;
}

/** 第 7 题:横放五棱柱,左端向内切 V 形槽,槽底向远端斜升 */
function build7(): PolySolid {
  const base = extrudeX(PENT_W, -4, 4);
  const cut = { group: 'cut1', name: 'V 形槽', color: '#f59e0b' };
  // 槽由左右两个三角棱工具合成(屋脊部分一并切除),两工具在 z=0 处少量重叠
  const endPlane = cutAt([1, -0.812, 0], [-1.0, 1.6, 0]);
  const tools = [
    extrudeX(
      [
        [0.06, 1.6],
        [-1.621, 4.611],
        [0.06, 5.85],
      ],
      -4.3,
      3.0,
    ),
    extrudeX(
      [
        [-0.06, 1.6],
        [1.621, 4.611],
        [-0.06, 5.85],
      ],
      -4.3,
      3.0,
    ),
  ];
  let s = base;
  for (const tool of tools) s = subtractSolid(s, cutSolid(tool, [endPlane]), cut);
  return s;
}

/** 第 8 题:六棱柱,顶部双斜切形成屋脊槽 */
function build8(): PolySolid {
  let s = regularPrism(6, 3.2, 4.8);
  s = cutSolid(s, [
    cutAt([1, 1, 0], [0, 3.2, 0], { group: 'cut1', label: '左斜切面', color: '#f59e0b' }),
  ]);
  s = cutSolid(s, [
    cutAt([-1, 1, 0], [0, 3.2, 0], { group: 'cut2', label: '右斜切面', color: '#22c55e' }),
  ]);
  return s;
}

/** 第 9 题:立放五棱柱,前部切出三角形缺口 */
function build9(): PolySolid {
  const base = regularPrism(5, 3.6, 5.2, -Math.PI / 2);
  return subtractSolid(
    base,
    extrudeZ(
      [
        [-0.2, 3.8],
        [-3.1, 2.5],
        [1.2, 1.4],
      ],
      -4.2,
      -1.0,
    ),
    { group: 'cut1', name: '三角缺口', color: '#f59e0b' },
  );
}

/** 第 10 题:菱形底四棱柱底座 + 四棱锥,前半侧三段折面切口 */
function build10(): PolySolid {
  const r = 3.8;
  const blockH = 2.8;
  const coneH = 4.2;
  const block = regularPrism(4, r, blockH, 0);
  const cone = translateSolid(regularPyramid(4, r, coneH, 0), [0, blockH, 0]);
  const faces = [
    ...block.faces.filter((f) => f.group !== 'top'),
    ...cone.faces.filter((f) => f.group !== 'base'),
  ];
  const used = new Set(faces.map((f) => f.group));
  const groups = [...block.groups, ...cone.groups].filter(
    (g, i, arr) => used.has(g.id) && arr.findIndex((x) => x.id === g.id) === i,
  );
  const base: PolySolid = { faces, groups };
  // 缺口只切前半(z>0):斜切 D-F、立切 F-F2、下斜切 F2-B,左侧沿轮廓回到 D
  return subtractSolid(
    base,
    extrudeZ(
      [
        [-1.27, 5.6],
        [1.5, 4.2],
        [1.5, 1.4],
        [-3.8, 0.6],
        [-3.8, 2.8],
      ],
      0,
      4.4,
    ),
    { group: 'cut1', name: '切口', color: '#f59e0b' },
  );
}

export const SOLID_PROBLEMS: SolidProblem[] = [
  {
    id: 1,
    title: '三棱柱 · 台阶',
    base: '三棱柱横放,棱线朝上',
    cut: '左上用一个水平面切掉棱顶一段,形成台阶',
    given: ['V', 'W'],
    missing: 'H',
    build: build1,
  },
  {
    id: 2,
    title: '三棱锥 · 切口',
    base: '三棱锥,一条底边在后、锥顶朝上',
    cut: '前上角用两个互相垂直的平面切去一块',
    given: ['V', 'H'],
    missing: 'W',
    build: build2,
  },
  {
    id: 3,
    title: '四棱锥 · 立切 + 斜切',
    base: '四棱锥,菱形底',
    cut: '左侧立切,左上斜切,右侧水平切顶',
    given: ['V', 'H'],
    missing: 'W',
    note: '按图意建模,截平面位置可对照教材微调',
    build: build3,
  },
  {
    id: 4,
    title: '四棱台 · 通槽',
    base: '四棱台,菱形底',
    cut: '顶部正中开一条前后贯通的矩形槽,槽底以下仍为完整棱台',
    given: ['V', 'H'],
    missing: 'W',
    build: build4,
  },
  {
    id: 5,
    title: '四棱锥 · 斜切台阶',
    base: '四棱锥,菱形底',
    cut: '前半侧用斜面与平面切出一个台阶形缺口,后半保留锥顶',
    given: ['V', 'H'],
    missing: 'W',
    note: '按图意建模,缺口位置可对照教材微调',
    build: build5,
  },
  {
    id: 6,
    title: '阶梯棱柱 · 斜切',
    base: '横放台阶形棱柱,截面自前向后逐级降低',
    cut: '左端用一个斜平面截切,斜边与各级台阶顶面相交',
    given: ['V', 'W'],
    missing: 'H',
    note: '教材 W 视右侧被页面裁去,台阶级数按可见部分建模',
    build: build6,
  },
  {
    id: 7,
    title: '五棱柱 · V 形槽',
    base: '五棱柱横放,五边形截面尖角朝上',
    cut: '左端向内切出 V 形槽,槽底向远端斜升',
    given: ['V', 'W'],
    missing: 'H',
    note: '按图意建模,槽口深度与斜升位置可对照教材微调',
    build: build7,
  },
  {
    id: 8,
    title: '六棱柱 · 屋脊槽',
    base: '正六棱柱',
    cut: '顶部用两个斜面相向切出屋脊形缺口',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 V 的斜切位置按图意近似,可对照教材微调',
    build: build8,
  },
  {
    id: 9,
    title: '五棱柱 · 三角缺口',
    base: '五棱柱立放,五边形底,一条棱朝前',
    cut: '前侧切出三角形缺口,缺口朝前开口',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 H 视省略缺口线,补 W 时以立体为准',
    build: build9,
  },
  {
    id: 10,
    title: '棱锥 + 底座 · 三段切口',
    base: '四棱锥立在菱形底四棱柱上',
    cut: '前半侧先斜切、再立切、下部斜切,形成折线形缺口',
    given: ['V', 'H'],
    missing: 'W',
    note: '按图意建模,切口位置可对照教材微调',
    build: build10,
  },
];

export function problemById(id: number): SolidProblem {
  return SOLID_PROBLEMS.find((p) => p.id === id) ?? SOLID_PROBLEMS[0];
}

export interface Built {
  solid: PolySolid;
  mesh: TriMesh;
}

/**
 * 把立体整体推到 V 面之后(最小深度 = 0.8)。
 * 三面体系要求物体在第一卦限:H 投影才会落在 OX 下方,W 投影才会落在 OZ 右侧。
 * 截切在建模时已完成,整体平移不改变立体与截断面的相对关系。
 */
function placeBehindV(solid: PolySolid): PolySolid {
  let minZ = Infinity;
  for (const f of solid.faces) for (const p of f.pts) minZ = Math.min(minZ, p[2]);
  if (!Number.isFinite(minZ)) return solid;
  return translateSolid(solid, [0, 0, 0.8 - minZ]);
}

const cache = new Map<number, Built>();

export function problemSolid(id: number): Built {
  const hit = cache.get(id);
  if (hit) return hit;
  const solid = placeBehindV(problemById(id).build());
  const mesh = buildMesh(solid);
  const out = { solid, mesh };
  cache.set(id, out);
  return out;
}

/** 教学用简例(第 0 章):长方体被一大一小两刀截切 */
const teachCache = new Map<number, Built>();

function buildTeach(kind: number): PolySolid {
  if (kind === 0) {
    const base = boxBounds(-3, 3, 0, 4, -2.5, 2.5);
    return subtractSolid(base, boxBounds(0.6, 4, 2.2, 5, -3, 3), {
      group: 'cut1',
      name: '截断面',
      color: '#f59e0b',
    });
  }
  if (kind === 1) {
    const base = regularPyramid(4, 3.8, 5.4, Math.PI / 4);
    return cutSolid(base, [
      cutAt([0, 1, 0], [0, 2.8, 0], { group: 'cut1', label: '水平截平面', color: '#f59e0b' }),
    ]);
  }
  return build1();
}

export function teachSolid(kind: number): Built {
  const hit = teachCache.get(kind);
  if (hit) return hit;
  const solid = placeBehindV(buildTeach(kind));
  const out = { solid, mesh: buildMesh(solid) };
  teachCache.set(kind, out);
  return out;
}

/** 教学体的包围盒(用于纸面范围与 W 轴位置) */
export function meshSize(mesh: TriMesh): { min: Vec3; max: Vec3 } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.verts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  }
  return { min, max };
}
