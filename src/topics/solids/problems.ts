import type { Vec2, Vec3 } from '../../lib/math';
import {
  boxBounds,
  cutThrough,
  extrudeX,
  extrudeZ,
  regularFrustum,
  regularPrism,
  regularPyramid,
} from './bodies';
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
  return subtractSolid(base, boxBounds(-10, -0.3, 3.65, 10, -10, 10), {
    group: 'cut1',
    name: '台阶截断面',
    color: '#f59e0b',
  });
}

/**
 * 第 2 题:三棱锥,前上角切去一块。
 * 锥体底面为任意三角形(BL、BR、F),锥顶 A 不在底心正上方,
 * 用四个过棱面的截平面从包围盒上切出。
 */
function build2(): PolySolid {
  const BL: Vec3 = [-2.48, 0, 0];
  const BR: Vec3 = [2.46, 0, 0];
  const F: Vec3 = [0.035, 0, 4.75];
  const A: Vec3 = [0.004, 5.38, 1.51];
  const inside: Vec3 = [0.005, 1.35, 1.57];
  const side = { group: 'side', label: '棱面', color: '#94a3b8' };
  const tetra = cutSolid(boxBounds(-4, 4, -0.1, 7, -1, 6), [
    cutThrough(BL, BR, F, inside, side),
    cutThrough(BL, BR, A, inside, side),
    cutThrough(BR, F, A, inside, side),
    cutThrough(F, BL, A, inside, side),
  ]);
  return subtractSolid(tetra, boxBounds(-5, 0.55, 1.7, 7, -5, 5), {
    group: 'cut1',
    name: '切口',
    color: '#f59e0b',
  });
}

/** 第 3 题:四棱柱,左上斜切出斜面,右侧保留全高 */
function build3(): PolySolid {
  const base = regularPrism(4, 3.0, 5.0, 0);
  return subtractSolid(
    base,
    extrudeZ(
      [
        [-4, 1.95],
        [1.96, 3.93],
        [1.96, 8],
        [-4, 8],
      ],
      -6,
      6,
    ),
    { group: 'cut1', name: '斜切面', color: '#f59e0b' },
  );
}

/** 第 4 题:四棱台,顶部开通槽(槽底以上、前后贯通) */
function build4(): PolySolid {
  const base = regularFrustum(4, 3.0, 1.3, 6.0, 0);
  return subtractSolid(base, boxBounds(-0.76, 0.76, 2.4, 10, -10, 10), {
    group: 'cut1',
    name: '通槽',
    color: '#f59e0b',
  });
}

/** 第 5 题:四棱锥,左侧切出一个台阶形缺口(前后贯通) */
function build5(): PolySolid {
  const base = regularPyramid(4, 3.0, 5.6, 0);
  return subtractSolid(
    base,
    extrudeZ(
      [
        [-0.955, 3.97],
        [1.268, 1.353],
        [-1.665, 1.353],
        [-3.0, 0.0],
      ],
      -10,
      10,
    ),
    { group: 'cut1', name: '缺口', color: '#f59e0b' },
  );
}

/** 第 6 题:横放阶梯棱柱,左端用 45° 斜面截切 */
function build6(): PolySolid {
  // (z,y) 截面:z 越小越高,台阶自前(z=4)向后(z=0)逐级升高
  const profile: Vec2[] = [
    [0, 0],
    [4, 0],
    [4, 1.0],
    [3, 1.0],
    [3, 1.7],
    [2, 1.7],
    [2, 4.0],
    [1, 4.0],
    [1, 5.0],
    [0, 5.0],
  ];
  let s = extrudeX(profile, -4, 4);
  s = cutSolid(s, [
    cutAt([-1, 1, 0], [-4, 0, 0], { group: 'cut1', label: '45° 斜切面', color: '#f59e0b' }),
  ]);
  return s;
}

/** 第 7 题:横放五棱柱;纵向贯通平顶 V 形槽,左端再被水平台阶 + 斜面切去 */
function build7(): PolySolid {
  const base = extrudeX(PENT_W, -4, 4);
  const groove = extrudeX(
    [
      [-1.05, 4.09],
      [1.05, 4.09],
      [0, 0.716],
    ],
    -4.5,
    4.5,
  );
  let s = subtractSolid(base, groove, { group: 'cut1', name: 'V 形槽', color: '#f59e0b' });
  // 左端:水平台阶面 y=1.83 接斜切面,升到棱顶
  s = subtractSolid(
    s,
    extrudeZ(
      [
        [-4, 1.83],
        [-1.7, 1.83],
        [2.31, 5.79],
        [2.31, 8],
        [-4, 8],
      ],
      -5,
      5,
    ),
    { group: 'cut2', name: '台阶斜面', color: '#22c55e' },
  );
  return s;
}

/** 第 8 题:六棱柱,中部菱形通孔,左侧切出台阶形缺口 */
function build8(): PolySolid {
  let s = regularPrism(6, 3.0, 6.46, 0);
  s = subtractSolid(s, regularPrism(4, 2.0, 8, 0), {
    group: 'cut1',
    name: '菱形通孔',
    color: '#f59e0b',
  });
  // 缺口:左侧开口,底面水平,顶面为斜平面
  const notch = extrudeZ(
    [
      [-4, 1.61],
      [0.865, 1.61],
      [0.865, 2.73],
      [-3, 5.91],
      [-4, 6.73],
    ],
    -4,
    4,
  );
  return subtractSolid(s, notch, { group: 'cut2', name: '台阶缺口', color: '#22c55e' });
}

/** 第 9 题:立放五棱柱,三角形通孔(沿 z 贯通) */
function build9(): PolySolid {
  const base = regularPrism(5, 3.0, 6.4, Math.PI);
  return subtractSolid(
    base,
    extrudeZ(
      [
        [0.02, 5.26],
        [-2.46, 2.57],
        [1.26, 1.08],
      ],
      -10,
      10,
    ),
    { group: 'cut1', name: '三角通孔', color: '#f59e0b' },
  );
}

/** 第 10 题:菱形底四棱柱 + 四棱锥,左上角切出台阶形缺口(前后贯通) */
function build10(): PolySolid {
  const r = 3.0;
  const blockH = 3.0;
  const apexY = 7.0;
  const block = regularPrism(4, r, blockH, 0);
  const cone = translateSolid(regularPyramid(4, r, apexY - blockH, 0), [0, blockH, 0]);
  const faces = [
    ...block.faces.filter((f) => f.group !== 'top'),
    ...cone.faces.filter((f) => f.group !== 'base'),
  ];
  const used = new Set(faces.map((f) => f.group));
  const groups = [...block.groups, ...cone.groups].filter(
    (g, i, arr) => used.has(g.id) && arr.findIndex((x) => x.id === g.id) === i,
  );
  const base: PolySolid = { faces, groups };
  // 缺口:左棱柱边 → 锥体左棱 → 斜切面 → 立切面 → 下斜切面,回到左棱柱边
  const notch = extrudeZ(
    [
      [-r, 0.68],
      [-r, blockH],
      [-1.01, 5.65],
      [1.41, 4.3],
      [1.41, 2.25],
    ],
    -r - 1,
    r + 1,
  );
  return subtractSolid(base, notch, { group: 'cut1', name: '台阶缺口', color: '#f59e0b' });
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
    base: '三棱锥,一条底边在后、锥顶偏向后方',
    cut: '左上方切去一块,锥顶及两条上棱成为虚想轮廓',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 H 视只画出底面轮廓与虚想棱线,截口投影省略',
    build: build2,
  },
  {
    id: 3,
    title: '四棱柱 · 斜切台阶',
    base: '四棱柱(正方形截面),棱线朝前',
    cut: '左上用斜平面切去,右侧保留全高,顶部形成台阶',
    given: ['V', 'H'],
    missing: 'W',
    build: build3,
  },
  {
    id: 4,
    title: '四棱台 · 通槽',
    base: '四棱台,菱形底',
    cut: '顶部正中开一条前后贯通的矩形槽,槽底以下仍为完整棱台',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 H 视省略槽口的投影',
    build: build4,
  },
  {
    id: 5,
    title: '四棱锥 · 台阶缺口',
    base: '四棱锥,菱形底',
    cut: '左侧切出台阶形缺口,水平面与斜面组合,前后贯通',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 H 视省略缺口投影',
    build: build5,
  },
  {
    id: 6,
    title: '阶梯棱柱 · 斜切',
    base: '横放台阶形棱柱,截面自前向后逐级升高',
    cut: '左端用一个 45° 斜平面截切,斜边与各级台阶顶面相交',
    given: ['V', 'W'],
    missing: 'H',
    build: build6,
  },
  {
    id: 7,
    title: '五棱柱 · V 形槽',
    base: '五棱柱横放,五边形截面尖角朝上',
    cut: '左端向内切出平顶 V 形槽,槽尾被斜平面截断',
    given: ['V', 'W'],
    missing: 'H',
    note: '教材五边形肩宽略宽于正五边形,按正五边形近似;W 视未画出台阶截口线',
    build: build7,
  },
  {
    id: 8,
    title: '六棱柱 · 菱形通孔',
    base: '正六棱柱,棱面朝左右',
    cut: '中部开菱形通孔,左侧切出底面水平、顶面倾斜的缺口',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 H 视省略缺口与通孔以外的截口线',
    build: build8,
  },
  {
    id: 9,
    title: '五棱柱 · 三角通孔',
    base: '五棱柱立放,五边形底,一条棱朝左',
    cut: '前部开三角形通孔,沿前后方向贯通',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 H 视省略通孔投影,V 视只画孔口三角形轮廓,孔壁与棱面交线省略',
    build: build9,
  },
  {
    id: 10,
    title: '棱锥 + 底座 · 台阶缺口',
    base: '四棱锥立在菱形底四棱柱上',
    cut: '左上角先斜切、再立切、下部斜切,缺口从左侧贯通',
    given: ['V', 'H'],
    missing: 'W',
    note: '教材 H 视只画底面轮廓,缺口投影省略',
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
