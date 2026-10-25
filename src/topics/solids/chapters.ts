export interface SolidChapter {
  id: number;
  title: string;
  ready: boolean;
}

/** 8 章:M1(0–4)对应教材 4-3;5–7 为回转体/相贯/组合的后续接入位 */
export const SOLIDS_CHAPTERS: SolidChapter[] = [
  { id: 0, title: '三面体系与补图方法', ready: true },
  { id: 1, title: '平面立体截切规律', ready: true },
  { id: 2, title: '补第三视图的步骤', ready: true },
  { id: 3, title: '截切体表面取点', ready: true },
  { id: 4, title: '例题册 4-3', ready: true },
  { id: 5, title: '回转体截切', ready: false },
  { id: 6, title: '相贯体', ready: false },
  { id: 7, title: '组合体综合', ready: false },
];

export interface Caption {
  title: string;
  text: string;
}

export interface SolidLayers {
  /** 顶点编号(括号表示该投影不可见) */
  labels: boolean;
  /** 不可见轮廓/棱线画虚线 */
  hidden: boolean;
  /** 截交线按截平面着色加粗 */
  cutLines: boolean;
  /** 顶点小圆点 */
  vertices: boolean;
  /** 长对正/高平齐/宽相等(经 45° 线)的对应辅助线 */
  projectors: boolean;
  /** 表面取点 P 与三面投影 */
  points: boolean;
}

export const DEFAULT_SOLID_LAYERS: SolidLayers = {
  labels: true,
  hidden: true,
  cutLines: true,
  vertices: true,
  projectors: false,
  points: true,
};

/** 一步讲解要驱动到的目标状态(未列出的字段保持不变) */
export interface SolidStepTarget {
  unfoldH?: number;
  unfoldW?: number;
  layers?: Partial<SolidLayers>;
  /** 缺图补画进度:0 空白 → 1 轮廓 → 2 可见棱线 → 3 虚线 → 4 截交线 */
  reveal?: number;
}

export interface SolidFlow {
  steps: Caption[];
  targets: SolidStepTarget[];
}

const CH0: SolidFlow = {
  steps: [
    {
      title: '三投影面体系',
      text: 'V(正立)、H(水平)、W(侧立)三个互相垂直的投影面把空间分成八个卦限,物体放在第一卦限:V 之后、H 之上、W 之左。三个投影面两两相交,交线就是 OX、OY、OZ 三根投影轴。先看 3D:三个面互相垂直,物体夹在中间,不带展开。',
    },
    {
      title: 'V 面向下不动,展开 H',
      text: 'V 面保持不动。H 面绕 OX 轴向下旋转 90°,与 V 面摊平——物体在 H 上的投影(俯视图)随之落到 OX 下方。展开后 V 与 H 共享同一根竖直方向:x 坐标不变,这保证"长对正"。',
    },
    {
      title: '展开 W,得到三视图',
      text: 'W 面绕 OZ 轴向右旋转 90°。W 面记录的是高度 y 与深度 z,展开后它的高度方向与 V 面平齐("高平齐"),深度方向则朝右延伸。至此 V(主视图)、H(俯视图)、W(左视图)三个视图排成一张综合投影图。',
    },
    {
      title: '长对正、高平齐',
      text: '打开"对应辅助线":V 与 H 的投影共用同一 x,所以上下对齐——长对正;V 与 W 共用同一高度 y,所以左右平齐——高平齐。这两条恒等式不是口诀,而是同一个空间点在两面体系里的坐标共享。',
    },
    {
      title: '宽相等与 45° 线',
      text: 'H 与 W 都记录深度 z,但方向互相垂直:H 上量到 OX 的距离、W 上量到 OZ 的距离。右下角的 45° 线把这两段深度互相转写:从 H 的投影水平引到 45° 线,再竖直引到 W——"宽相等"。拖动表面点或看 3D,任何一点的三个投影都满足这三条关系。',
    },
  ],
  targets: [
    { unfoldH: 0, unfoldW: 0, reveal: 4, layers: { hidden: true, cutLines: true, labels: true, vertices: true, projectors: false, points: false } },
    { unfoldH: 1, unfoldW: 0, reveal: 4 },
    { unfoldH: 1, unfoldW: 1, reveal: 4 },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { projectors: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { projectors: true } },
  ],
};

const CH1: SolidFlow = {
  steps: [
    {
      title: '截平面与截交线',
      text: '平面立体被截切,本质是"截平面"把立体切去一块。截平面与立体表面的交线叫截交线,由截平面与各棱面的交线段首尾相接围成;截平面与棱线的交点就是截交线的顶点。图中琥珀色面就是本步的截平面,它的边就是截交线。',
    },
    {
      title: '截交线一定是封闭多边形',
      text: '截交线是截平面与立体表面的公有线:既在截平面上,又在立体表面上。它围成一个封闭的多边形,边数等于被截到的棱面数。本章是用一个水平面截正四棱锥,四个棱面各贡献一条边,截交线是正方形。',
    },
    {
      title: '先找棱线上的特殊点',
      text: '画截交线投影的标准顺序:先求截平面与各棱线的交点(截交线顶点),再在需要时补一般点,最后依次连线。对平面立体,棱线是直的,截交线的每个顶点都落在某条棱线上——第 1 章的立体共有 4 个截交点,就是正方形的四个角。',
    },
    {
      title: '截交线之外的棱线也要处理',
      text: '截切后原来的棱线被分成"保留"与"切掉"两段,保留段仍要画出;被挡住的棱线和截交线在视图中画虚线。打开"被挡虚线"观察:同一个立体,主视图、俯视图、左视图里被挡的线并不相同。',
    },
    {
      title: '判别可见性的依据',
      text: '可见性由观察方向与前后位置决定:主视图比深度,俯视图比高度,左视图比左右(x)。截切产生的凹口会遮挡它后面的棱线——这正是后续各章反复使用的判据。',
    },
  ],
  targets: [
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: false, cutLines: true, projectors: false } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: false, cutLines: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: false, cutLines: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true } },
  ],
};

const CH2: SolidFlow = {
  steps: [
    {
      title: '已知两面,补第三面',
      text: '本题给出主视图 V 与俯视图 H,左视图 W 留空。补图不是"照着立体画轮廓",而是用三视图的三条对应关系反推:先从已知两视图的顶点出发,长对正、宽相等地定位到 W,再判断哪些线可见。',
    },
    {
      title: '第一步:先定外形轮廓',
      text: '只看未被截切部分的"外壳":每个顶点的 W 投影由高度 y(高平齐)与深度 z(宽相等)唯一确定。先画外轮廓——它是整个形体的最大范围,给出后续所有线的边界。',
    },
    {
      title: '第二步:补可见棱线',
      text: '把每个棱线端点的 W 投影连起来。能直接看到的棱线用粗实线;截交线的投影同样要画出。此时已有实线轮廓,但凹口内部的线还没判可见性。',
    },
    {
      title: '第三步:补不可见线',
      text: '从左向右看,被前方棱面挡住的棱线画虚线。判断依据是同一投影位置上有两个候选点时的 x 坐标(左视图比左右)。打开"被挡虚线"即可看到。',
    },
    {
      title: '第四步:截交线单独核对',
      text: '截交线是三视图里最容易漏的线:它在每个视图上都有投影。打开"截交线高亮",确认 W 视图中的截交线投影完整、且与棱线连接闭合——补图到这里才算完成。',
    },
    {
      title: '动手:点表面取点参与核对',
      text: '下一步进入表面取点:在任意已知视图上点选表面点,三个投影会同时出现,并自动判断哪些投影需要加括号。用它检查你补的 W 视图:点若落在你画的实线上,该投影就应当可见。',
    },
  ],
  targets: [
    { unfoldH: 1, unfoldW: 1, reveal: 0, layers: { hidden: false, cutLines: true, projectors: false } },
    { unfoldH: 1, unfoldW: 1, reveal: 1, layers: { hidden: false } },
    { unfoldH: 1, unfoldW: 1, reveal: 2, layers: { hidden: false } },
    { unfoldH: 1, unfoldW: 1, reveal: 3, layers: { hidden: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true, points: true } },
  ],
};

const CH3: SolidFlow = {
  steps: [
    {
      title: '立体表面取点',
      text: '已知立体表面上一点 P 的一个投影,求另外两个投影——这就是表面取点。点必须在表面上(属于某个棱面或截平面),否则三投影没有唯一解。在 V 或 H 视图的实线区域内点击或拖动,即可放置 P。',
    },
    {
      title: '利用面在视图中的投影',
      text: '平面立体的每个面都是平面,它在视图上的投影是平面图形(可能退化成线)。P 属于某个面,就先在该面上作辅助线:连接 P 的投影与面上已知点(常用棱线或平行线),再把辅助线投到另外两个视图,即可反求 P 的投影。',
    },
    {
      title: '第三面由两面坐标唯一确定',
      text: '空间点的三个坐标 (x, y, z) 被三个视图分别记录:V 给 (x,y),H 给 (x,z),W 给 (y,z)。任何两个视图都足以确定第三个,这就是"长对正、高平齐、宽相等"的逆用。拖动 P 观察:三个投影严格同步。',
    },
    {
      title: '不可见投影加括号',
      text: '如果 P 落在立体背面(被前方表面挡住),它在对应视图上的投影是看不见的,工程图写作 (p′)/(p″)。判别方法:沿该视图的观察方向,看 P 与前方表面的前后位置。图中括号由程序实时判断,不是预先写死的。',
    },
    {
      title: '边界与特殊情况',
      text: 'P 落在棱线上时,它同时属于两个面,仍可求;落在截交线上时,它在截平面上,也可求。但如果把 P 拖到轮廓之外,该处根本没有表面,程序便不会放置新点。表面取点的前提永远是:点确实在表面上。',
    },
  ],
  targets: [
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true, points: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true, points: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true, points: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true, points: true } },
    { unfoldH: 1, unfoldW: 1, reveal: 4, layers: { hidden: true, cutLines: true, points: true } },
  ],
};

const CH4: SolidFlow = {
  steps: [
    {
      title: '4-3 完成平面立体被截切后的三面投影',
      text: '10 道题,每道题给出两个视图,要求补画第三个。先在右侧面板选题,再按"轮廓 → 可见棱线 → 虚线 → 截交线"分步显示答案;也可以先隐藏立体图,只看已知两视图自己补,再逐步核对。补图时可用表面取点检验:在任何视图上点选表面点,另外两个投影会同步出现。',
    },
  ],
  targets: [{ unfoldH: 1, unfoldW: 1, reveal: 0 }],
};

export const SOLID_FLOWS: Record<number, SolidFlow> = { 0: CH0, 1: CH1, 2: CH2, 3: CH3, 4: CH4 };

export function solidFlowOf(chapter: number): SolidFlow {
  return SOLID_FLOWS[chapter] ?? { steps: [], targets: [] };
}
