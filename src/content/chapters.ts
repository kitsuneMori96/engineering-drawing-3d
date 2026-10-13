import type { AxisH2Mode } from '../lib/engine';

export interface Chapter {
  id: number;
  title: string;
  ready: boolean;
}

export const CHAPTERS: Chapter[] = [
  { id: 0, title: '原理:点的换面', ready: true },
  { id: 1, title: '换直线:求实长', ready: true },
  { id: 2, title: '再换:积聚成点', ready: true },
  { id: 3, title: '换平面:积聚成线', ready: true },
  { id: 4, title: '再换:求实形', ready: true },
  { id: 5, title: '综合应用', ready: true },
  { id: 6, title: '探索沙盒', ready: true },
];

export interface Caption {
  title: string;
  text: string;
}

/** 一步讲解要驱动到的目标状态(未列出的字段保持不变) */
export interface StepTarget {
  unfoldH?: number;
  unfoldV1?: number;
  unfoldH2?: number;
  showAxis?: boolean;
  showAxis2?: boolean;
  /** 等距标注(章内两条相等距离) */
  measures?: boolean;
  /** 实长标注(a₁b₁ 与 |AB| 对照) */
  showTL?: boolean;
}

/**
 * 章级声明:视图组件只读这些特征,不再判断 chapter 编号。
 * 加一章 = 写一份 ChapterFlow,组件代码零改动。
 */
export interface ChapterFeatures {
  /** 引入第三点 C 与 △ABC(平面章) */
  thirdPoint: boolean;
  /** 等距规律标注:a′→OX 与 a₁→OX₁ 同值 */
  measuresV1: boolean;
  /** 等距链标注:a→OX₁ 与 a₂→OX₂ 同值 */
  measuresH2: boolean;
  /** 实形对照标注画在 H₂(a₂b₂/a₂c₂);false 且 showTL 时画 V₁ 实长 a₁b₁ */
  realShape: boolean;
  /** 积聚成线时高亮共线直线 p₁ */
  collapseLine: boolean;
  /** 积聚线与 OX₁ 夹角 δ 标注 */
  tiltAngle: boolean;
  /** 进章时 OX₁ 复位方式 */
  axisV1Default: 'keep' | 'parallel-ab' | 'plane-horizontal';
  /** OX₂ 方向模式 */
  axisH2Mode: AxisH2Mode;
  /** 进章时自动计算默认 OX₂ 偏移 */
  axisH2DefaultOffset: boolean;
}

export interface ChapterFlow {
  steps: Caption[];
  /** 每步的目标状态;长度与 steps 相同 */
  targets: StepTarget[];
  features: ChapterFeatures;
}

/** 第 0 章:一次换面的完整流程 */
const CH0: ChapterFlow = {
  steps: [
    {
      title: '空间与投影面',
      text: '空间点 A 与线段 AB 位于 V(正立面)、H(水平面)投影面体系中。先把 H 面绕 OX 轴向下旋转 90°,就得到图纸上的综合投影图——请务必建立"空间 ↔ 纸面"的对应关系。',
    },
    {
      title: '放置新投影面 V₁',
      text: '换面法第一步:作新投影面 V₁。V₁ 必须垂直于保留的 H 面(体系直角性不能破坏),它与 H 的交线 OX₁ 称为新轴。拖动轴上手柄可平移、旋转新轴。',
    },
    {
      title: '作投影连线',
      text: '过 A 的各投影向 V₁ 作投影连线:连线垂直于新轴 OX₁(因为投射线垂直于 V₁,而 V₁⊥H,故连线在 H 内⊥OX₁)。',
    },
    {
      title: '等距规律(核心!)',
      text: '量取 a₁ 到 OX₁ 的距离,它必须等于被替换的投影 a′ 到旧轴 OX 的距离(图中两段紫色标注相等)。这就是"换面不换距"——新投影到新轴的距离,等于被替换投影到原轴的距离。',
    },
    {
      title: '展开成图',
      text: '把 V₁ 绕 OX₁ 旋转摊平到 H 面内,得到 a₁。至此完成一次换面。拖动点 a / a′ 试试:a₁ 会始终遵守等距规律自动更新。',
    },
  ],
  targets: [
    { unfoldH: 0, showAxis: false, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, showAxis: true, showAxis2: false, measures: true, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: true, showTL: false },
  ],
  features: {
    thirdPoint: false,
    measuresV1: true,
    measuresH2: false,
    realShape: false,
    collapseLine: false,
    tiltAngle: false,
    axisV1Default: 'keep',
    axisH2Mode: 'perp',
    axisH2DefaultOffset: false,
  },
};

/** 第 1 章:一次换面求一般位置直线实长 */
const CH1: ChapterFlow = {
  steps: [
    {
      title: '一般位置直线',
      text: '直线 AB 与 H、V 面都倾斜,是一般位置直线。它的两面投影 ab、a′b′ 都比实长短,量不出真实长度。本章目标:通过一次换面求出 AB 的实长。',
    },
    {
      title: '作 V₁ ∥ AB',
      text: '在 H 面内作新轴 OX₁ ∥ ab,过 OX₁ 作新投影面 V₁。OX₁ ∥ ab 保证了 V₁ 平行于空间直线 AB,同时 V₁⊥H 破坏不了体系直角性。试试:拖动 OX₁ 旋转手柄让它不平行 ab,后面 a₁b₁ 就不再反映实长。',
    },
    {
      title: 'a₁b₁ = 实长',
      text: '过 a、b 向 OX₁ 作垂线得到 a₁、b₁。因为 V₁ ∥ AB,直线 AB 在 V₁ 上的投影 a₁b₁ 就是实长——图中 magenta 标注与 |AB| 完全相等。改变 OX₁ 角度或拖动 a/b,观察实长何时失真。',
    },
    {
      title: '等距规律照常成立',
      text: '一次换面的等距规律依然生效:a₁ 到 OX₁ = a′ 到 OX(两段紫色标注相等)。换面法两根支柱:实长靠"平行条件",位置靠"等距规律"。',
    },
  ],
  targets: [
    { unfoldH: 1, unfoldV1: 0, showAxis: false, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 0, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: false, showTL: true },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: true, showTL: true },
  ],
  features: {
    thirdPoint: false,
    measuresV1: true,
    measuresH2: false,
    realShape: false,
    collapseLine: false,
    tiltAngle: false,
    axisV1Default: 'parallel-ab',
    axisH2Mode: 'perp',
    axisH2DefaultOffset: false,
  },
};

/** 第 2 章:二次换面把实长直线积聚成点 */
const CH2: ChapterFlow = {
  steps: [
    {
      title: '回顾:已得实长',
      text: '承上一章:OX₁ ∥ ab 已使 a₁b₁ = 实长 |AB|。现在做第二次换面——保留 V₁,把 H 面换成新投影面 H₂,目标是让 AB 积聚成一个点。',
    },
    {
      title: '作 H₂ ⊥ V₁',
      text: '在 V₁ 面内作新轴 OX₂ ⊥ a₁b₁,过 OX₂ 作新投影面 H₂(OX₂ ⊥ a₁b₁ 保证 H₂ 垂直于直线 AB,且 H₂⊥V₁,体系直角性依旧)。图中 OX₂ 只能沿 a₁b₁ 方向平移,方向恒保持 ⊥。',
    },
    {
      title: '投影连线,积聚成点',
      text: '过 a₁、b₁ 向 OX₂ 作垂线投影到 H₂。因为 AB ⊥ H₂,直线上所有点的投影重合——a₂ 与 b₂ 完全重合为一点,这就是积聚性。',
    },
    {
      title: '等距链',
      text: '换面规律沿体系链条延续:a₂ 到 OX₂ = a 到 OX₁(第二次被替换的是 H 面上的投影 a,它原来的轴是 OX₁)——图中两段紫色标注相等。',
    },
    {
      title: '展开成图',
      text: '把 H₂ 绕 OX₂ 摊平,得到重合点 a₂ ≡ b₂。两次换面完成:一般位置直线 → 求实长 → 积聚成点,这是换面法解题的经典三部曲。',
    },
  ],
  targets: [
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 0, showAxis: true, showAxis2: false, measures: false, showTL: true },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 0, showAxis: true, showAxis2: true, measures: false, showTL: true },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 0, showAxis: true, showAxis2: true, measures: false, showTL: true },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 0, showAxis: true, showAxis2: true, measures: true, showTL: true },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 1, showAxis: true, showAxis2: true, measures: true, showTL: true },
  ],
  features: {
    thirdPoint: false,
    measuresV1: false,
    measuresH2: true,
    realShape: false,
    collapseLine: false,
    tiltAngle: false,
    axisV1Default: 'parallel-ab',
    axisH2Mode: 'perp',
    axisH2DefaultOffset: true,
  },
};

/** 第 3 章:一次换面把一般位置平面积聚成线 */
const CH3: ChapterFlow = {
  steps: [
    {
      title: '一般位置平面',
      text: '△ABC 与 H、V 都倾斜,是"一般位置平面"——三个投影都是缩小的三角形,量不出真实形状。本章目标:作一次换面,让平面在新投影面上积聚成一条直线。',
    },
    {
      title: '作 V₁ ⊥ 平面',
      text: '关键条件:新轴 OX₁ 必须平行于平面内的水平线(其 H 投影方向)。这样 V₁ 才垂直于整个平面,平面的投影才会"侧立"成线。进章时已自动对准,面板有"对准水平线"按钮可随时复位。',
    },
    {
      title: '积聚成线',
      text: '展开 V₁:三角形的三个顶点 a₁、b₁、c₁ 落在同一条直线上——这就是积聚性。这条线正是平面与 V₁ 的交线,它同时反映平面内所有直线的方向关系。',
    },
    {
      title: '等距规律照常成立',
      text: '换面规律不因对象是平面而改变:a₁ 到 OX₁ = a′ 到 OX(两段紫色标注相等),三个顶点各自满足。位置精度由等距规律保证,形状"侧立"由垂直条件保证。',
    },
    {
      title: '条件不可破坏',
      text: '试试:拖动 OX₁ 旋转手柄,让 OX₁ 不再平行水平线——三点立刻散开,积聚消失;点面板"对准水平线"复位,三点重新共线。换面法每个结论都挂在明确的几何条件上。',
    },
  ],
  targets: [
    { unfoldH: 0, unfoldV1: 0, showAxis: false, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 0, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: true, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: true, showTL: false },
  ],
  features: {
    thirdPoint: true,
    measuresV1: true,
    measuresH2: false,
    realShape: false,
    collapseLine: true,
    tiltAngle: false,
    axisV1Default: 'plane-horizontal',
    axisH2Mode: 'perp',
    axisH2DefaultOffset: false,
  },
};

/** 第 4 章:二次换面把"积聚成线"的平面变换为实形 */
const CH4: ChapterFlow = {
  steps: [
    {
      title: '回顾:已积聚成线',
      text: '承上一章:OX₁ ∥ 平面内水平线,平面在 V₁ 上积聚成直线 p₁。现在做第二次换面——保留 V₁,作 H₂,目标是画出 △ABC 的真实形状。',
    },
    {
      title: '作 H₂ ∥ 平面',
      text: '新轴 OX₂ 必须平行于积聚线 p₁(图中 OX₂ 只能沿 p₁ 的法向滑动,方向被锁定)。由此 H₂ ⊥ V₁ 且 ∥ 平面——体系直角性保持,而平行保证投影反映实形。',
    },
    {
      title: '展开得实形',
      text: '展开 H₂,得到 a₂b₂c₂。因为 H₂ ∥ △ABC,投影与原形全等——图中标注显示 a₂b₂ = |AB|、a₂c₂ = |AC|(对应边相等,三角形全等)。',
    },
    {
      title: '等距链延续',
      text: '等距规律沿链条继续:a₂ 到 OX₂ = a 到 OX₁(第二次被替换的是 H 面上的投影 a,其原轴为 OX₁)——两段紫色标注相等。',
    },
    {
      title: '完成:实形图',
      text: '两次换面收官:一般位置平面 → 积聚成线(一次换面,靠 ⊥ 条件)→ 实形(二次换面,靠 ∥ 条件)。拖动 OX₂ 方块滑动新轴,实形只会平移不会变形——这就是条件的威力。',
    },
  ],
  targets: [
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 0, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 0, showAxis: true, showAxis2: true, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 1, showAxis: true, showAxis2: true, measures: false, showTL: true },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 1, showAxis: true, showAxis2: true, measures: true, showTL: true },
    { unfoldH: 1, unfoldV1: 1, unfoldH2: 1, showAxis: true, showAxis2: true, measures: true, showTL: true },
  ],
  features: {
    thirdPoint: true,
    measuresV1: false,
    measuresH2: true,
    realShape: true,
    collapseLine: false,
    tiltAngle: false,
    axisV1Default: 'plane-horizontal',
    axisH2Mode: 'parallel',
    axisH2DefaultOffset: true,
  },
};

/** 第 5 章:综合应用 —— 求平面对 H 面的倾角 δ */
const CH5: ChapterFlow = {
  steps: [
    {
      title: '问题:求平面的倾角 δ',
      text: '△ABC 是一般位置平面,它与 H 面的倾角 δ 在原投影中量不出来(两个投影都"斜着",角度被扭曲)。本章综合运用前面的方法:先积聚成线,再直接读出 δ。',
    },
    {
      title: '作 V₁ ⊥ 平面(承第 3 章)',
      text: '作 OX₁ ∥ 平面内水平线,得 V₁ ⊥ △ABC。进章时已自动对准,面板"对准水平线"按钮可复位。这一步是后面一切的前置条件。',
    },
    {
      title: '积聚成线',
      text: '展开 V₁,三点 a₁、b₁、c₁ 共线(p₁)。平面被"侧立"起来之后,它与 H 面的二面角会被 V₁ 完整地拍平在自己面内——这是能读出倾角的关键。',
    },
    {
      title: '读出倾角 δ',
      text: 'p₁ 与 OX₁ 的夹角,就是 △ABC 对 H 面的真实倾角 δ(图中弧线标注)。原理:V₁⊥H,交线是 OX₁;平面与 H 的二面角被 V₁ 截出的"平面角"正是这两条迹线的夹角。拖动 a / b / c 改变平面,δ 实时跟随。',
    },
    {
      title: '条件不可破坏',
      text: '拖 OX₁ 旋转手柄破坏 ⊥ 条件:三点散开、不再积聚,此时 p₁ 与 OX₁ 的夹角失去意义(弧线变红警告)。点"对准水平线"复位,δ 恢复真实。综合问题的每一步都建立在前一步的条件上。',
    },
  ],
  targets: [
    { unfoldH: 1, unfoldV1: 0, showAxis: false, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 0, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: false, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: true, showTL: false },
    { unfoldH: 1, unfoldV1: 1, showAxis: true, showAxis2: false, measures: true, showTL: false },
  ],
  features: {
    thirdPoint: true,
    measuresV1: false,
    measuresH2: false,
    realShape: false,
    collapseLine: false,
    tiltAngle: true,
    axisV1Default: 'plane-horizontal',
    axisH2Mode: 'perp',
    axisH2DefaultOffset: false,
  },
};

/** 第 6 章:探索沙盒 —— 全要素就位,自由探索 */
const CH6: ChapterFlow = {
  steps: [
    {
      title: '自由探索',
      text: '所有工具已就位:拖动 a/a′/b/b′/c/c′ 改变空间几何;拖 OX₁ 平移与旋转、拖 OX₂ 滑动新轴;左侧面板控制各面展开与图层开关。自己构造问题试试:让 OX₁ ∥ ab 看实长;对准水平线看积聚;再换面看实形;把条件破坏看结论如何失效——所有规律随拖动实时验证。',
    },
  ],
  targets: [
    {
      unfoldH: 1,
      unfoldV1: 1,
      unfoldH2: 1,
      showAxis: true,
      showAxis2: true,
      measures: true,
      showTL: true,
    },
  ],
  features: {
    thirdPoint: true,
    measuresV1: true,
    measuresH2: true,
    realShape: false,
    collapseLine: false,
    tiltAngle: false,
    axisV1Default: 'plane-horizontal',
    axisH2Mode: 'parallel',
    axisH2DefaultOffset: true,
  },
};

export const FLOWS: Record<number, ChapterFlow> = {
  0: CH0,
  1: CH1,
  2: CH2,
  3: CH3,
  4: CH4,
  5: CH5,
  6: CH6,
};

/** 当前章节的讲解流程(无则为空流程,便于新章节渐进接入) */
export function flowOf(chapter: number): ChapterFlow {
  return (
    FLOWS[chapter] ?? {
      steps: [],
      targets: [],
      features: {
        thirdPoint: false,
        measuresV1: false,
        measuresH2: false,
        realShape: false,
        collapseLine: false,
        tiltAngle: false,
        axisV1Default: 'keep',
        axisH2Mode: 'perp',
        axisH2DefaultOffset: false,
      },
    }
  );
}
