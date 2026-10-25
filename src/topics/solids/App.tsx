import { useEffect } from 'react';
import Scene3D from './Scene3D';
import Sheet2D from './Sheet2D';
import Panel from './Panel';
import { SOLIDS_CHAPTERS, solidFlowOf } from './chapters';
import { useSolidsStore } from './store';
import { useNav } from '../../nav';

export default function SolidsApp() {
  const chapter = useSolidsStore((s) => s.chapter);
  const setChapter = useSolidsStore((s) => s.setChapter);
  const step = useSolidsStore((s) => s.step);
  const setStep = useSolidsStore((s) => s.setStep);
  const problemId = useSolidsStore((s) => s.problemId);
  const setTopic = useNav((s) => s.setTopic);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set('ch', String(chapter));
    q.set('step', String(step));
    if (chapter === 4) q.set('problem', String(problemId));
    else q.delete('problem');
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [chapter, step, problemId]);

  const flow = solidFlowOf(chapter);
  const total = Math.max(1, flow.steps.length);
  const caption = flow.steps[Math.min(step, total - 1)] ?? {
    title: '待开放',
    text: '本章尚未开放。',
  };

  const goStep = (i: number) => setStep(Math.min(total - 1, Math.max(0, i)));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◪</span>
          <h1>立体截切 · 三面投影与表面取点</h1>
        </div>
        <nav className="chapters">
          <button className="chip home-chip" onClick={() => setTopic('home')} title="返回主题首页">
            ⌂ 首页
          </button>
          {SOLIDS_CHAPTERS.map((c) => (
            <button
              key={c.id}
              className={`chip ${chapter === c.id ? 'active' : ''} ${c.ready ? '' : 'disabled'}`}
              disabled={!c.ready}
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
          <button className="btn primary" onClick={() => goStep(step + 1)} disabled={step >= total - 1}>
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
