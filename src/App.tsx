import { useEffect } from 'react';
import Scene3D from './components/Scene3D';
import Sheet2D from './components/Sheet2D';
import Panel from './components/Panel';
import { CHAPTERS, FLOWS, flowOf } from './content/chapters';
import { useStore } from './store';

/** 从 URL 读取 ?ch=&step=(分享/刷新后恢复现场) */
function readUrl(): { ch: number; step: number } | null {
  const q = new URLSearchParams(window.location.search);
  const chRaw = q.get('ch');
  if (chRaw === null) return null;
  const ch = Number(chRaw);
  if (!Number.isInteger(ch) || !FLOWS[ch]) return null;
  const step = Math.max(0, Number(q.get('step')) || 0);
  return { ch, step };
}

export default function App() {
  const chapter = useStore((s) => s.chapter);
  const setChapter = useStore((s) => s.setChapter);
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);

  // 挂载时恢复 URL 指定的章节/步骤
  useEffect(() => {
    const init = readUrl();
    if (!init) return;
    if (init.ch !== useStore.getState().chapter) setChapter(init.ch);
    if (init.step > 0) setStep(init.step);
  }, [setChapter, setStep]);

  // 章节/步骤变化时写回 URL(replaceState,不产生历史记录)
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
