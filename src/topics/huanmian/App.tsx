import { useEffect } from 'react';
import Scene3D from './Scene3D';
import Sheet2D from './Sheet2D';
import Panel from './Panel';
import { CHAPTERS, flowOf } from './chapters';
import { useStore } from './store';
import { useNav } from '../../nav';

export default function HuanmianApp() {
  const chapter = useStore((s) => s.chapter);
  const setChapter = useStore((s) => s.setChapter);
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const setTopic = useNav((s) => s.setTopic);

  // 章节/步骤变化时写回 URL(replaceState,不产生历史记录);
  // 首屏恢复在 store 模块初始化时完成(避免与回写竞态)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set('ch', String(chapter));
    q.set('step', String(step));
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [chapter, step]);

  const flow = flowOf(chapter);
  const total = Math.max(1, flow.steps.length);
  const caption = flow.steps[Math.min(step, total - 1)] ?? {
    title: '待开放',
    text: '本章尚未开放,先完成前面的章节。',
  };

  const goStep = (i: number) => setStep(Math.min(total - 1, Math.max(0, i)));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⟋</span>
          <h1>换面法 · 3D 交互学习</h1>
        </div>
        <nav className="chapters">
          <button className="chip home-chip" onClick={() => setTopic('home')} title="返回主题首页">
            ⌂ 首页
          </button>
          {CHAPTERS.map((c) => (
            <button
              key={c.id}
              className={`chip ${chapter === c.id ? 'active' : ''} ${c.ready ? '' : 'disabled'}`}
              disabled={!c.ready}
              title={c.ready ? '' : '即将开放'}
              onClick={() => setChapter(c.id)}
            >
              {c.id}. {c.title}
            </button>
          ))}
        </nav>
      </header>

      <main className="views">
        <section className="view view-3d">
          <Scene3D />
          <div className="view-hint">左键旋转 · 滚轮缩放 · 右键单击进入平移(移动鼠标即平移,再点右键退出)</div>
        </section>
        <section className="view view-sheet">
          <Sheet2D />
        </section>
        <Panel />
      </main>

      <footer className="captionbar">
        <div className="stepnav">
          <button className="btn" onClick={() => goStep(step - 1)} disabled={step === 0}>
            ← 上一步
          </button>
          <span className="stepnum">
            {step + 1} / {total}
          </span>
          <button
            className="btn primary"
            onClick={() => goStep(step + 1)}
            disabled={step >= total - 1}
          >
            下一步 →
          </button>
        </div>
        <div className="caption">
          <strong>{caption.title}</strong>
          <p>{caption.text}</p>
        </div>
      </footer>
    </div>
  );
}
