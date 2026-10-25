import { useState } from 'react';
import { activeBuilt, viewPlan } from './active';
import { SOLID_PROBLEMS, problemById } from './problems';
import { useSolidsStore } from './store';
import { VIEW_NAMES } from './views';

const LAYERS: { key: 'labels' | 'vertices' | 'hidden' | 'cutLines' | 'projectors' | 'points'; label: string }[] = [
  { key: 'labels', label: '顶点编号 / 括号' },
  { key: 'vertices', label: '顶点小圆点' },
  { key: 'hidden', label: '不可见线画虚线' },
  { key: 'cutLines', label: '截交线着色' },
  { key: 'projectors', label: '长对正 / 高平齐 / 宽相等' },
  { key: 'points', label: '表面取点 P' },
];

const STAGE_LABEL = ['空白第三视图', '外形轮廓', '可见棱线', '不可见虚线', '截交线'];

export default function Panel() {
  const unfoldH = useSolidsStore((s) => s.unfoldH);
  const unfoldW = useSolidsStore((s) => s.unfoldW);
  const setUnfoldH = useSolidsStore((s) => s.setUnfoldH);
  const setUnfoldW = useSolidsStore((s) => s.setUnfoldW);
  const layers = useSolidsStore((s) => s.layers);
  const toggleLayer = useSolidsStore((s) => s.toggleLayer);
  const chapter = useSolidsStore((s) => s.chapter);
  const step = useSolidsStore((s) => s.step);
  const problemId = useSolidsStore((s) => s.problemId);
  const setProblem = useSolidsStore((s) => s.setProblem);
  const reveal = useSolidsStore((s) => s.reveal);
  const setReveal = useSolidsStore((s) => s.setReveal);
  const bumpReveal = useSolidsStore((s) => s.bumpReveal);
  const showSolid3D = useSolidsStore((s) => s.showSolid3D);
  const setShowSolid3D = useSolidsStore((s) => s.setShowSolid3D);
  const probe = useSolidsStore((s) => s.probe);
  const setProbe = useSolidsStore((s) => s.setProbe);

  const plan = viewPlan(chapter, problemId);
  const problem = problemById(problemId);
  const missingName = plan.missing ? VIEW_NAMES[plan.missing] : null;
  const probeFaceName = probe
    ? (activeBuilt(chapter, problemId).mesh.groups.find((g) => g.id === probe.group)?.name ?? probe.group)
    : null;
  const [open, setOpen] = useState(() => window.innerWidth >= 1200);

  return (
    <aside className={`panel${open ? '' : ' collapsed'}`}>
      <button
        className="panel-toggle"
        onClick={() => setOpen((o) => !o)}
        title={open ? '收起控制面板(扩大三视图)' : '展开控制面板'}
        aria-expanded={open}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
      <div className="panel-body">
        <h3>投影面展开</h3>
        <label className="slider-row">
          <span>H 面展开</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={unfoldH}
            onChange={(e) => setUnfoldH(Number(e.target.value))}
          />
          <span className="num">{Math.round(unfoldH * 100)}%</span>
        </label>
        <label className="slider-row">
          <span>W 面展开</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={unfoldW}
            onChange={(e) => setUnfoldW(Number(e.target.value))}
          />
          <span className="num">{Math.round(unfoldW * 100)}%</span>
        </label>

        <h3>缺图补画</h3>
        <div className="axis-row">
          <span>已知视图</span>
          <span className="num">
            {plan.given ? plan.given.map((v) => VIEW_NAMES[v]).join(' / ') : '三视图完整'}
          </span>
        </div>
        <div className="axis-row">
          <span>待补视图</span>
          <span className="num" style={{ color: reveal >= 4 ? '#0f766e' : '#b45309' }}>
            {missingName ?? '—'}
          </span>
        </div>
        {plan.missing && (
          <>
            <div className="axis-row">
              <span>当前进度</span>
              <span className="num">{reveal} / 4 · {STAGE_LABEL[reveal]}</span>
            </div>
            <div className="btn-row">
              <button className="btn primary" onClick={() => setReveal(4)}>
                显示答案
              </button>
              <button className="btn" onClick={bumpReveal} disabled={reveal >= 4}>
                分步显示 →
              </button>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => setReveal(0)}>
                重置缺图
              </button>
              <button className="btn" onClick={() => setShowSolid3D(!showSolid3D)}>
                {showSolid3D ? '隐藏立体图' : '显示立体图'}
              </button>
            </div>
          </>
        )}

        {chapter === 4 && (
          <>
            <h3>例题 4-3 · 选择题号</h3>
            <div className="problem-grid">
              {SOLID_PROBLEMS.map((p) => (
                <button
                  key={p.id}
                  className={`problem-chip${p.id === problemId ? ' active' : ''}`}
                  onClick={() => setProblem(p.id)}
                  title={`${p.title} — ${p.given.join('/')} 已知,补 ${p.missing}`}
                >
                  ({p.id})
                </button>
              ))}
            </div>
            <div className="solid-note">
              <strong>{problem.title}</strong>
              <p>{problem.cut}</p>
              {problem.note && <p className="hint">{problem.note}</p>}
            </div>
          </>
        )}

        {plan.pickable && (
          <>
            <h3>表面取点</h3>
            <div className="axis-row">
              <span>P 所在面</span>
              <span className="num">{probeFaceName ?? '未取点'}</span>
            </div>
            <button className="btn" onClick={() => setProbe(null)} disabled={!probe}>
              清除取点
            </button>
            <p className="panel-hint">
              在任一视图的实线区域内点击/拖动:点会贴在同一棱面上,三个投影同步更新;被挡投影自动加括号。
            </p>
          </>
        )}

        <h3>图层</h3>
        {LAYERS.map(({ key, label }) => (
          <label key={key} className="check-row">
            <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />
            <span>{label}</span>
          </label>
        ))}

        <p className="panel-hint">
          {chapter === 4
            ? '先隐藏立体图,只看已知两视图自己补;再点「分步显示」逐层核对。'
            : `第 ${chapter} 章 · 第 ${step + 1} 步`}
        </p>
      </div>
      <span className="panel-rail-label">视图控制</span>
    </aside>
  );
}
