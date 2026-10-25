import { useEffect } from 'react';
import { useNav } from './nav';
import Home from './topics/Home';
import HuanmianApp from './topics/huanmian/App';
import VisibilityApp from './topics/visibility/App';
import SolidsApp from './topics/solids/App';

/**
 * 主题壳:同一时刻只挂载一个主题(模块级单例如换面法 useSystem 依赖这一点)。
 * 只负责写 ?topic=;各主题自己写 ?ch&step,互不删除对方参数。
 */
export default function App() {
  const topic = useNav((s) => s.topic);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set('topic', topic);
    if (topic === 'home') {
      q.delete('ch');
      q.delete('step');
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [topic]);

  if (topic === 'huanmian') return <HuanmianApp />;
  if (topic === 'visibility') return <VisibilityApp />;
  if (topic === 'solids') return <SolidsApp />;
  return <Home />;
}
