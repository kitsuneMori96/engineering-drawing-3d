import { useState } from 'react';
import { fmt1 } from '../lib/math';
import { buildSystem, defaultAxisH2Offset, planeAxisAngle } from '../lib/engine';
import { flowOf } from '../content/chapters';
import { DEFAULT_AXIS_V1_PLANE_POS, planeDefs, useStore } from '../store';

const LAYERS: { key: 'planes' | 'projectors' | 'labels' | 'construct' | 'measures'; label: string }[] = [
  { key: 'planes', label: '投影面' },
  { key: 'projectors', label: '投射线' },
  { key: 'labels', label: '标注' },
  { key: 'construct', label: '作图线' },
  { key: 'measures', label: '等距标注' },
];

export default function Panel() {
  const unfoldH = useStore((s) => s.unfoldH);
  const unfoldV1 = useStore((s) => s.unfoldV1);
  const unfoldH2 = useStore((s) => s.unfoldH2);
  const setUnfoldH = useStore((s) => s.setUnfoldH);
  const setUnfoldV1 = useStore((s) => s.setUnfoldV1);
  const setUnfoldH2 = useStore((s) => s.setUnfoldH2);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const axisV1 = useStore((s) => s.axisV1);
  const setAxisPos = useStore((s) => s.setAxisPos);
  const setAxisAngle = useStore((s) => s.setAxisAngle);
  const showAxis = useStore((s) => s.showAxis);
  const showAxis2 = useStore((s) => s.showAxis2);
  const axisH2Offset = useStore((s) => s.axisH2Offset);
  const axisH2Mode = useStore((s) => s.axisH2Mode);
  const setAxisH2Offset = useStore((s) => s.setAxisH2Offset);
  const points = useStore((s) => s.points);
  const chapter = useStore((s) => s.chapter);
  // 平面章(进章时 OX₁ 对准水平线)复位按钮走"积聚条件"逻辑
  const alignsToPlane = flowOf(chapter).features.axisV1Default === 'plane-horizontal';
  // 独立侧栏列,窄屏(<1200px)默认收起,避免挤压投影图
  const [open, setOpen] = useState(() => window.innerWidth >= 1200);

  if (!open) {
    return (
      <button className="panel-rail" onClick={() => setOpen(true)} title="展开控制面板">
        视图控制 ◀
      </button>
    );
  }

  return (
    <aside className="panel">
      <button className="panel-collapse" onClick={() => setOpen(false)} title="收起控制面板(扩大投影图)">
        ▶ 收起
      </button>
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
      {showAxis2 && (
        <label className="slider-row">
          <span>H₂ 面展开</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={unfoldH2}
            onChange={(e) => setUnfoldH2(Number(e.target.value))}
          />
          <span className="num">{Math.round(unfoldH2 * 100)}%</span>
        </label>
      )}

      {showAxis && (
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
              if (alignsToPlane) {
                // 平面章:OX₁ 必须 ∥ 平面内水平线(⇒ V₁ ⊥ 平面 ⇒ 积聚成线)
                setAxisPos(DEFAULT_AXIS_V1_PLANE_POS);
                setAxisAngle(planeAxisAngle(points.A, points.B, points.C));
              } else {
                setAxisPos([0, 6.4]);
                setAxisAngle(Math.atan2(3.8, 4.2));
              }
            }}
          >
            {alignsToPlane ? '对准水平线(积聚条件)' : '重置为 ∥ ab'}
          </button>
        </>
      )}

      {showAxis2 && (
        <>
          <h3>新轴 OX₂</h3>
          <div className="axis-row">
            <span>{axisH2Mode === 'parallel' ? '沿积聚线法向偏移' : '沿 a₁b₁ 偏移'}</span>
            <span className="num">{fmt1(axisH2Offset)}</span>
          </div>
          <div className="axis-row">
            <span>方向</span>
            <span className="num">
              {axisH2Mode === 'parallel' ? '恒 ∥ 积聚线 p₁' : '恒 ⊥ a₁b₁'}
            </span>
          </div>
          <p className="hint">
            {axisH2Mode === 'parallel'
              ? 'OX₂ 只有一个自由度:在图中沿积聚线法向滑动,方向锁定 ∥ p₁ 以保证 H₂ ∥ 平面(实形的条件)。'
              : 'OX₂ 只有一个自由度:在图中拖动方块手柄沿 a₁b₁ 方向滑动,旋转被锁定以保证 H₂ ⊥ AB。'}
          </p>
          <button
            className="btn"
            onClick={() => {
              const sys = buildSystem(planeDefs(axisV1), () => 1);
              setAxisH2Offset(defaultAxisH2Offset(sys, points.A, points.B));
            }}
          >
            恢复默认位置
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
    </aside>
  );
}
