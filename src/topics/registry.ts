export type TopicId = 'home' | 'huanmian' | 'visibility' | 'basics';

export interface TopicMeta {
  id: TopicId;
  title: string;
  summary: string;
  chapterCount: number;
  ready: boolean;
}

/** 主题注册表:首页卡片按此渲染;新增主题 = 加一条 + 在 App 壳挂载对应组件 */
export const TOPICS: TopicMeta[] = [
  {
    id: 'huanmian',
    title: '换面法',
    summary: '点的换面原理 → 直线求实长、积聚成点 → 平面积聚成线、求实形 → 倾角综合应用,7 章渐进 + 探索沙盒。',
    chapterCount: 7,
    ready: true,
  },
  {
    id: 'visibility',
    title: '判别可见性',
    summary:
      '重影点与括号标注 → 两直线投影交叉的可见性判别 → 直线与平面相交 → 两平面交线(辅助投影面法)与逐边可见性,拖拽实时验证。',
    chapterCount: 4,
    ready: true,
  },
  {
    id: 'basics',
    title: '点、直线、平面的投影',
    summary: '投影基础:直角坐标体系、点线面的基本投影特性与从属关系。',
    chapterCount: 0,
    ready: false,
  },
];
