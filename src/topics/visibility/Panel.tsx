import { useState } from 'react';
import { fmt1 } from '../../lib/math';
import { planeAxisAngle } from '../../lib/engine';
import { visFlowOf } from './chapters';
import { DEFAULT_AXIS_V1_POS, useVisStore } from './store';
import { isTrueIntersection, lineVsPlane } from './vis';

const LAYERS: { key: 'projectors' | 'labels' | 'construct' | 'measures' | 'hidden'; label: string }[] = [
  { key: 'projectors', label: '投影连线' },
  { key: 'labels', label: '标注' },
  { key: 'construct', label: '作图辅助' },
  { key: 'measures', label: '比较标注' },
  { key: 'hidden', label: '被挡虚线' },
];

export default function Panel() {
  const unfoldH = useVisStore((s) => s.unfoldH);
  const unfoldV1 = useVisStore((s) => s.unfoldV1);
  const setUnfoldH = useVisStore((s) => s.setUnfoldH);
  const setUnfoldV1 = useVisStore((s) => s.setUnfoldV1);
  const layers = useVisStore((s) => s.layers);
  const toggleLayer = useVisStore((s) => s.toggleLayer);
  const points = useVisStore((s) => s.points);
  const chapter = useVisStore((s) => s.chapter);
  const showV1 = useVisStore((s) => s.showV1);
  const axisV1 = useVisStore((s) => s.axisV1);
  const setAxisPos = useVisStore((s) => s.setAxisPos);
  const setAxisAngle = useVisStore((s) => s.setAxisAngle);
  const resetGeometry = useVisStore((s) => s.resetGeometry);
  const presetTrueIntersection = useVisStore((s) => s.presetTrueIntersection);

  const flow = visFlowOf(chapter);
  const kind = flow.features.kind;
  const { A, B, C, D, E } = points;
  const trueNow =
    kind === 'crossing' && A && B && C && D ? isTrueIntersection(A, B, C, D).yes : false;
  const lpNow =
    kind === 'linePlane' && A && B && C && D && E ? lineVsPlane(D, E, A, B, C) : null;
  // 独立侧栏列,窄屏默认收起
  const [open, setOpen] = useState(() => window.innerWidth >= 1200);

  return (
    <aside className={`panel${open ? '' : ' collapsed'}`}>
      <button
        className="panel-toggle"
        onClick={() => setOpen((o) => !o)}
        title={open ? '收起控制面板(扩大投影图)' : '展开控制面板'}
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
        <h3>视图控制</h3>
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
        {showV1 && (
          <label className="slider-row">
            <span>V₁ 面展开</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={unfoldV1}
              onChange={(e) => setUnfoldV1(Number(e.target.value))}
            />
            <span className="num">{Math.round(unfoldV1 * 100)}%</span>
          </label>
        )}

        {kind === 'crossing' && (
          <>
            <h3>判别状态</h3>
            <div className="axis-row">
              <span>两直线位置</span>
              <span className="num" style={{ color: trueNow ? '#0f766e' : '#b45309' }}>
                {trueNow ? '真相交' : '交叉(异面)'}
              </span>
            </div>
            <button className="btn" onClick={presetTrueIntersection}>
              构造真相交
            </button>
          </>
        )}

        {kind === 'linePlane' && (
          <>
            <h3>判别状态</h3>
            <div className="axis-row">
              <span>直线与平面</span>
              <span
                className="num"
                style={{ color: !lpNow ? '#dc2626' : lpNow.insideTri ? '#0f766e' : '#b45309' }}
              >
                {!lpNow ? 'DE ∥ 平面(无交点)' : lpNow.insideTri ? 'K 在三角形内(有挡段)' : 'K 在三角形外(全可见)'}
              </span>
            </div>
          </>
        )}

        {showV1 && A && B && C && (
          <>
            <h3>新轴 OX₁</h3>
            <div className="axis-row">
              <span>位置</span>
              <span className="num">({fmt1(axisV1.pos[0])}, {fmt1(axisV1.pos[1])})</span>
            </div>
            <div className="axis-row">
              <span>角度</span>
              <span className="num">{fmt1((axisV1.angle * 180) / Math.PI)}°</span>
            </div>
            <button
              className="btn"
              onClick={() => {
                setAxisPos(DEFAULT_AXIS_V1_POS);
                setAxisAngle(planeAxisAngle(A, B, C));
              }}
            >
              对准积聚方向(V₁ ⊥ 平面)
            </button>
          </>
        )}

        <h3>图层</h3>
        {LAYERS.map(({ key, label }) => (
          <label key={key} className="check-row">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => toggleLayer(key)}
            />
            <span>{label}</span>
          </label>
        ))}

        <h3>几何</h3>
        <button className="btn" onClick={resetGeometry}>
          复位本章预设
        </button>
        <p className="panel-hint">
          拖动右侧投影图上的点即可改变空间位置,判别结果(括号标注、虚线段)实时更新。
        </p>
      </div>
      <span className="panel-rail-label">视图控制</span>
    </aside>
  );
}
