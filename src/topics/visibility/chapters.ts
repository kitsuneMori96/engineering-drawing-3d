import type { Vec3 } from '../../lib/math';

export interface VisChapter {
  id: number;
  title: string;
  ready: boolean;
}

export const VIS_CHAPTERS: VisChapter[] = [
  { id: 0, title: '重影点及其可见性', ready: true },
  { id: 1, title: '交叉两直线', ready: true },
  { id: 2, title: '直线与平面相交', ready: true },
  { id: 3, title: '两平面相交', ready: true },
];

export interface Caption {
  title: string;
  text: string;
}

/** 判别对象点(按章取用,未用的为 null) */
export type PtKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const ALL_PTS: PtKey[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface VisLayers {
  /** 投影连线(细点画线) */
  projectors: boolean;
  labels: boolean;
  /** 作图辅助(交点 X、候选人、短虚线段等) */
  construct: boolean;
  /** 比较标注(深度/高度双箭头) */
  measures: boolean;
  /** 被挡段画虚线(ch2) */
  hidden: boolean;
}

/** 一步讲解要驱动到的目标状态(未列出的字段保持不变) */
export interface VisStepTarget {
  unfoldH?: number;
  unfoldV1?: number;
  showV1?: boolean;
  layers?: Partial<VisLayers>;
}

export type VisKind = 'coincident' | 'crossing' | 'linePlane' | 'planePlane';

/**
 * 章级声明:视图组件只读这些特征,不判断 chapter 编号。
 * 加一章 = 写一份 VisFlow,组件代码零改动。
 */
export interface VisFeatures {
  kind: VisKind;
  /** 本章预设几何(数值由 vis.test.ts 固化校验) */
  preset: Partial<Record<PtKey, Vec3>>;
  /** 哪些点允许自由拖拽(派生候选人不可拖) */
  draggable: PtKey[];
  /** 使用辅助投影面 V₁(ch2 积聚力求交点) */
  useV1: boolean;
}

export interface VisFlow {
  steps: Caption[];
  /** 每步的目标状态;长度与 steps 相同 */
  targets: VisStepTarget[];
  features: VisFeatures;
}

export const DEFAULT_LAYERS: VisLayers = {
  projectors: true,
  labels: true,
  construct: true,
  measures: false,
  hidden: false,
};

/** 第 0 章:重影点——同影异深/同影异高,前遮后、高遮低 */
const CH0: VisFlow = {
  steps: [
    {
      title: '两个点,一个投影',
      text: 'A、B 一前一后(深度不同),正面投影 a′、b′ 却落在同一处;C、D 一高一低,水平投影 c、d 也重合在一起。在某投影面上投影重合的两点,称为对该面的重影点。图上 a′/b′ 叠作一点,c/d 叠作一点——重合本身不告诉你谁被挡住。',
    },
    {
      title: '对 V 面:前遮后',
      text: '看 V 面时视线由前向后,靠观察者近的点挡住远点。比较深度:B 在 A 前方,所以 b′ 可见、a′ 不可见。工程图用括号标注不可见投影,写作 (a′)。图中紫色双箭头就是两点到 V 面的距离对比。',
    },
    {
      title: '对 H 面:高遮低',
      text: '看 H 面时视线由上向下,比的是高度:D 高于 C,c 不可见,写作 (c)。同一个重影点对,在不同投影面上比较的量不同——对 V 比深度,对 H 比高度,两条规则永远不要混用。',
    },
    {
      title: '为什么这样比较?',
      text: '把投影面折回空间:重影点本质是"视线遮挡"。沿前后方向观察,V 面上重合的一点背后藏着另一点,前面的挡住后面的;沿上下方向俯视 H 面,高的挡住低的。3D 视图中可旋转验证这条视线关系。',
    },
    {
      title: '动手验证',
      text: '拖动 a′/b′ 或 c/d:高度差(或对 H 重影的深度差)一旦超过重合容差,两投影不再重合,重影消失、括号自动摘掉;恢复"同高"或"同深",括号立刻回来。判别随拖动实时更新——可见性永远是坐标比较的结果,不是死记的结论。',
    },
  ],
  targets: [
    { unfoldH: 1, showV1: false, layers: { measures: false } },
    { unfoldH: 1, layers: { measures: true } },
    { unfoldH: 1, layers: { measures: true } },
    { unfoldH: 0, layers: { measures: true } },
    { unfoldH: 1, layers: { measures: false } },
  ],
  features: {
    kind: 'coincident',
    preset: {
      A: [3, 4, 1.5],
      B: [3, 4, 5],
      C: [6.5, 1, 3],
      D: [6.5, 4.5, 3],
    },
    draggable: ['A', 'B', 'C', 'D'],
    useV1: false,
  },
};

/** 第 1 章:交叉两直线——投影交点处的候选人比较 */
const CH1: VisFlow = {
  steps: [
    {
      title: '交叉 ≠ 相交',
      text: '直线 AB 与 CD 的正面投影 a′b′、c′d′ 看起来"相交",水平投影同样交叉——但两线在空间既不相交也不平行,是一对交叉直线(异面)。判据:V 面交点与 H 面交点不在同一根投影连线上,说明两个"交点"根本不是同一个空间点。',
    },
    {
      title: '锁定 V 面交点 X',
      text: 'a′b′ 与 c′d′ 交于 X。过 X 作垂直于 OX 的投影连线,它同时穿过 ab 与 cd——X 在 H 面投影柱面上对应一整条前后方向的线,AB 与 CD 各有一点落在这条连线上。',
    },
    {
      title: '两个空间候选人',
      text: '投影连线与 ab 交于 m、与 cd 交于 n:AB 上的空间点 M 与 CD 上的空间点 N,正面投影都是 X,谁在谁前面?M、N 由投影交点派生,不可拖动。',
    },
    {
      title: '比深度:定 V 面可见性',
      text: '对 V 面,前遮后。比较 M、N 的深度:N 在 M 前方,c′d′ 在 X 处可见,a′b′ 被挡——教材画法是在 X 附近的 a′b′ 上画一小段粗虚线。紫色箭头给出两点的深度对比。',
    },
    {
      title: '对 H 面比高度:结论反过来',
      text: '用同样办法处理 H 面交点 Y:比较两候选点的高度,本章预设下 AB 更高,故 ab 全实线,cd 在 Y 附近画短虚线。注意:哪个面遮哪根线,两个视图要各判一次,结论未必相同——这正是交叉直线比单个重影点进一阶的地方。',
    },
    {
      title: '真相交特例与动手验证',
      text: '点面板「构造真相交」:把 CD 摆成与 AB 真交于一点 P,此时 V、H 两交点恰好落进同一根投影连线,两面全实线——"两交点同柱"就是相交与交叉的分界。再自由拖动 A/B/C/D:投影不再交叉时虚线段自动消失。',
    },
  ],
  targets: [
    { unfoldH: 1, showV1: false, layers: { measures: false } },
    { unfoldH: 1, layers: { construct: true } },
    { unfoldH: 1 },
    { unfoldH: 1, layers: { measures: true } },
    { unfoldH: 1, layers: { measures: true } },
    { unfoldH: 1, layers: { measures: false } },
  ],
  features: {
    kind: 'crossing',
    preset: {
      A: [1, 5, 2],
      B: [6, 2, 6],
      C: [4.5, 3, 5],
      D: [0.5, 1, 1],
    },
    draggable: ['A', 'B', 'C', 'D'],
    useV1: false,
  },
};

/** 第 2 章:直线与一般位置平面相交——辅助面定交点,两面判遮挡 */
const CH2: VisFlow = {
  steps: [
    {
      title: '直线的哪一段被挡住?',
      text: '直线 DE 与一般位置平面 △ABC 相交于 K。图上 d′e′ 的投影"穿过"三角形边框:穿进边框到 K 之间,直线在平面前还是后?被挡的一段要画虚线,但先得求出交点 K——一般位置平面量不出积聚,k′ 无法直接读。',
    },
    {
      title: '作辅助面 V₁,积聚力求交点',
      text: '经典办法:作新投影面 V₁ 垂直于 △ABC(新轴 OX₁ ∥ 平面内水平线),平面在 V₁ 上积聚成直线 p₁。直线与平面的交点,在积聚视图中退化为两线交点——一步锁定。',
    },
    {
      title: '交点 k₁ → k′、k',
      text: '展开 V₁:d₁e₁ 与积聚线 p₁ 交于 k₁。由 k₁ 反投影回 V、H 面得 k′、k,交点的两面投影全部确定。3D 视图中的红色 K 球由解析线面相交算出,与辅助面作图完全等价——面板实时显示 K 在三角形内还是外。',
    },
    {
      title: 'V 面可见性:比深度',
      text: 'K 把 DE 分成两段,平面背后的一段被挡。对 V 面比较深度:K 之后直线更靠平面后方,被 △ABC 遮住——k′e′ 画虚线,其余实线。虚线段起止由"投影落在三角形内的区间 ∩ K 之后的被挡侧"裁出。',
    },
    {
      title: 'H 面可见性:比高度',
      text: '对 H 面比较高度:K 之后直线低于平面,从上向下看同样被挡,ke 画虚线。本例两面被挡的是同一段空间线段,但判别量不同(一个比深度、一个比高度)——拖动 A/B/C 改变平面,看两面虚线如何各自独立地变化。',
    },
    {
      title: '探索与破坏',
      text: '自由拖动 D、E 或三角形顶点:当 DE 与平面平行时面板提示"无交点",虚线全部消失;当 K 落到三角形外,投影不再穿过面形,直线整体可见。线面可见性只依赖两个事实——交点存在,且落在面内。',
    },
  ],
  targets: [
    { unfoldH: 1, showV1: false, unfoldV1: 0, layers: { hidden: false } },
    { unfoldH: 1, showV1: true, unfoldV1: 0, layers: { hidden: false } },
    { unfoldH: 1, showV1: true, unfoldV1: 1, layers: { hidden: false } },
    { unfoldH: 1, showV1: true, unfoldV1: 1, layers: { hidden: true } },
    { unfoldH: 1, showV1: true, unfoldV1: 1, layers: { hidden: true } },
    { unfoldH: 1, showV1: true, unfoldV1: 1, layers: { hidden: true } },
  ],
  features: {
    kind: 'linePlane',
    preset: {
      A: [0, 4, 0],
      B: [4, 0, 0],
      C: [0, 0, 4],
      D: [8, 8, 8],
      E: [0, 0, 0],
    },
    draggable: ['A', 'B', 'C', 'D', 'E'],
    useV1: true,
  },
};

/** 第 3 章:两平面相交——辅助投影面法求交线,两面逐边判遮挡 */
const CH3: VisFlow = {
  steps: [
    {
      title: '两平面的公有交线在哪里?',
      text: '△ABC 与 △DEF 互相穿透,交线是两平面的公有直线——两端正好落在对方图形的边上。一般位置平面没有积聚性,交线的两面投影都不能直接读出,需要先把"求两面交线"化为"求直线与平面的交点"。',
    },
    {
      title: '过 DE 作铅垂辅助面 R',
      text: '过 △DEF 的边 DE 作辅助投影面 R 垂直于 H 面:R 的水平投影积聚在直线 de 上。R 与 △ABC 的交线 MN 由边 AB、BC 与 de 的交点 m、n 决定——m、n 在 H 面直接量出,再引投影连线回到 a′b′、b′c′ 得 m′、n′。',
    },
    {
      title: '穿透点 K = DE × △ABC',
      text: '交线 M N 与辅助面内的直线 DE 共面,它们的正面投影 m′n′ 与 d′e′ 交于 k′——这就是 DE 穿过平面 ABC 的穿透点。由 k′ 引投影连线落回 de 得 k。K 同时在 DE 与 △ABC 上,是交线的一个端点。',
    },
    {
      title: '同法过 DF 求 L',
      text: '再过另一条边 DF 作铅垂辅助面:积聚线 df 与边 AC、BC 交得第二对点 m₂、n₂,正面连线 m₂′n₂′ 交 d′f′ 于 l′,落回得 l。两个穿透点就足以确定整条交线——不必再找第三个。',
    },
    {
      title: '连 KL:交线的两面投影',
      text: 'k′l′ 与 kl 就是交线 KL 的两面投影(图中加粗琥珀线)。核对:K、L 都落在 △ABC 的正面与水平投影范围内,也在 △DEF 的边上——两平面沿这条公有线互相穿过。3D 视图里琥珀色线段就是它。',
    },
    {
      title: 'V 面可见性:比深度',
      text: '交线是可见性分界线。对 V 面逐边比较深度:某边的水平投影落在另一三角形投影之内、且该处它更靠后,这段被挡画虚线;穿过交线(K、L)后被挡侧切换。图中每个被挡段都起止于"边界投影 × 对面投影重叠区"。',
    },
    {
      title: 'H 面可见性:比高度',
      text: '对 H 面改比高度,六个边各自再判一次:V 面被挡的边,H 面未必被挡——两个视图的结论彼此独立。拖动任一顶点观察虚线段如何随形状移动,体会"交线定分界、坐标定谁挡"。',
    },
    {
      title: '探索与破坏',
      text: '自由拖动 A–F:两平面趋于平行时交线消失(面板显示"两平面平行");穿入量变小时交线段缩短。点面板「构造平行平面」可一键验证平行特例。交线只依赖两个事实——两平面不平行,且交线落在两个图形范围内。',
    },
  ],
  targets: [
    { unfoldH: 1, showV1: false, layers: { hidden: false } },
    { unfoldH: 1, layers: { construct: true, hidden: false } },
    { unfoldH: 1, layers: { construct: true, hidden: false } },
    { unfoldH: 1, layers: { construct: true, hidden: false } },
    { unfoldH: 1, layers: { construct: true, hidden: false } },
    { unfoldH: 1, layers: { hidden: true } },
    { unfoldH: 1, layers: { hidden: true } },
    { unfoldH: 1, layers: { hidden: true } },
  ],
  features: {
    kind: 'planePlane',
    preset: {
      A: [5, 6, 1],
      B: [1, 4, 2],
      C: [4, 1, 5],
      D: [2.6, 6.4, 6.4],
      E: [4.6, 3.8, 1.2],
      F: [4.2, 1.2, 3.6],
    },
    draggable: ['A', 'B', 'C', 'D', 'E', 'F'],
    useV1: false,
  },
};

export const VIS_FLOWS: Record<number, VisFlow> = { 0: CH0, 1: CH1, 2: CH2, 3: CH3 };

/** 当前章节的讲解流程(空流程兜底,便于渐进接入新章) */
export function visFlowOf(chapter: number): VisFlow {
  return (
    VIS_FLOWS[chapter] ?? {
      steps: [],
      targets: [],
      features: { kind: 'coincident', preset: {}, draggable: [], useV1: false },
    }
  );
}
