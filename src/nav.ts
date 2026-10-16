import { create } from 'zustand';
import type { TopicId } from './topics/registry';

/**
 * 主题导航:home(卡片首页)与具体主题学习页互斥挂载
 * (换面法 useSystem 等模块级单例依赖"同一时刻只有一个主题在场")。
 * 初始主题在模块加载时同步读 URL——放 useEffect 会与各视图的 URL 回写竞态。
 */

function bootTopic(): TopicId {
  const q = new URLSearchParams(window.location.search);
  const t = q.get('topic');
  if (t === 'huanmian' || t === 'visibility' || t === 'basics' || t === 'home') return t;
  // 旧版分享链接只有 ?ch=,回落到换面法
  if (q.get('ch') !== null) return 'huanmian';
  return 'home';
}

interface NavState {
  topic: TopicId;
  setTopic: (t: TopicId) => void;
}

export const useNav = create<NavState>((set) => ({
  topic: typeof window === 'undefined' ? 'home' : bootTopic(),
  setTopic: (t) => set({ topic: t }),
}));
