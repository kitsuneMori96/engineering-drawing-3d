import { useEffect, useMemo, useRef, useState } from 'react';
import type { Vec2, Vec3 } from '../lib/math';
import { add2, fmt1, mul2, norm2 } from '../lib/math';
import { projLabel } from '../lib/engine';
import { useSystem } from '../lib/useSystem';
import { flowOf } from '../content/chapters';
import { useStore } from '../store';

/** 纸面数学坐标(y 向上)→ SVG 坐标(y 向下) */
const P = (p: Vec2): Vec2 => [p[0], -p[1]];

type DragMode = 'a' | 'b' | 'c' | 'ap' | 'bp' | 'cp' | 'axisMove' | 'axisRot' | 'axis2Move';

const BIG = 200;
/** 增量旋转灵敏度:rad / 纸面单位(垂直于轴方向的位移) */
const ROT_SENS = 0.15;

function lineP(a: Vec2, b: Vec2) {
  const [x1, y1] = P(a);
  const [x2, y2] = P(b);
  return { x1, y1, x2, y2 };
}

export default function Sheet2D() {
  const sys = useSystem();
  const points = useStore((s) => s.points);
  const axisV1 = useStore((s) => s.axisV1);
  const layers = useStore((s) => s.layers);
  const chapter = useStore((s) => s.chapter);
  const showAxis = useStore((s) => s.showAxis);
  const showAxis2 = useStore((s) => s.showAxis2);
  const showTL = useStore((s) => s.showTL);
  const axisH2Offset = useStore((s) => s.axisH2Offset);
  const axisH2Mode = useStore((s) => s.axisH2Mode);
  const setPoint = useStore((s) => s.setPoint);
  const setAxisPos = useStore((s) => s.setAxisPos);
  const setAxisAngle = useStore((s) => s.setAxisAngle);
  const setAxisH2Offset = useStore((s) => s.setAxisH2Offset);

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const [dragStart, setDragStart] = useState<{ p: Vec2; off: number } | null>(null);

  const { A, B, C } = points;
  const features = flowOf(chapter).features;
  // 平面章节(第 3/4 章)才画第三点与三角形
  const isPlane = features.thirdPoint;
  // 各面纸面投影位置:随 sys/点位置 memo,无关状态变化时保持引用稳定
  const sA: Record<string, Vec2> = useMemo(
    () => ({
      V: sys.sheetPos('V', A),
      H: sys.sheetPos('H', A),
      V1: sys.sheetPos('V1', A),
      ...(showAxis2 ? { H2: sys.sheetPos('H2', A) } : null),
    }),
    [sys, A, showAxis2],
  );
  const sB: Record<string, Vec2> = useMemo(
    () => ({
      V: sys.sheetPos('V', B),
      H: sys.sheetPos('H', B),
      V1: sys.sheetPos('V1', B),
      ...(showAxis2 ? { H2: sys.sheetPos('H2', B) } : null),
    }),
    [sys, B, showAxis2],
  );
  const sC: Record<string, Vec2> = useMemo(
    () => ({
      V: sys.sheetPos('V', C),
      H: sys.sheetPos('H', C),
      V1: sys.sheetPos('V1', C),
      ...(showAxis2 ? { H2: sys.sheetPos('H2', C) } : null),
    }),
    [sys, C, showAxis2],
  );
  const fV1 = useMemo(() => sys.sheetFrame('V1'), [sys]);
  /** OX₂ 的纸面几何(仅当 H₂ 体系激活) */
  const fH2 = showAxis2 ? sys.sheetFrame('H2') : null;

  const footOf = (id: string, pt: Vec3): Vec2 => {
    const [lu] = sys.local(id, pt);
    const f = sys.sheetFrame(id);
    return add2(f.o, mul2(f.u, lu));
  };

  /* ---- 视口自适应 ---- */
  const axisSheet = useMemo(() => {
    const fH = sys.sheetFrame('H');
    return add2(fH.o, add2(mul2(fH.u, axisV1.pos[0]), mul2(fH.v, axisV1.pos[1])));
  }, [sys, axisV1.pos]);

  /** 倾角章:积聚线 p₁ 与 OX₁ 的交点(倾角 δ 的顶点) */
  const ch5X = useMemo(() => {
    if (!features.tiltAngle || !showAxis) return null;
    const d1 = norm2([sB.V1[0] - sA.V1[0], sB.V1[1] - sA.V1[1]]);
    const axisD = norm2(fV1.u);
    const denom = d1[0] * axisD[1] - d1[1] * axisD[0];
    if (Math.abs(denom) < 1e-6) return null;
    const t =
      ((fV1.o[0] - sA.V1[0]) * axisD[1] - (fV1.o[1] - sA.V1[1]) * axisD[0]) / denom;
    return [sA.V1[0] + d1[0] * t, sA.V1[1] + d1[1] * t] as Vec2;
  }, [features, showAxis, sA.V1, sB.V1, fV1]);

  const viewBox = useMemo(() => {
    const fH2v = showAxis2 ? sys.sheetFrame('H2') : null;
    const all = [
      ...Object.values(sA),
      ...Object.values(sB),
      ...(isPlane ? Object.values(sC) : []),
      axisSheet,
      ...(fH2v ? [fH2v.o] : []),
      ...(ch5X ? [ch5X] : []),
    ];
    const minX = Math.min(...all.map((p) => p[0]));
    const maxX = Math.max(...all.map((p) => p[0]));
    const minY = Math.min(...all.map((p) => p[1]));
    const maxY = Math.max(...all.map((p) => p[1]));
    const padX = Math.max(2.4, (maxX - minX) * 0.28);
    const padY = Math.max(2.4, (maxY - minY) * 0.28);
    return {
      x: minX - padX,
      y: -(maxY + padY),
      w: maxX - minX + 2 * padX,
      h: maxY - minY + 2 * padY,
    };
  }, [sA, sB, sC, isPlane, axisSheet, ch5X, sys, showAxis2]);

  /* ---- 拖拽 ---- */
  const toSheet = (e: { clientX: number; clientY: number }): Vec2 | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return [p.x, -p.y];
  };

  /* 拖拽提交合并:pointermove 可达 1000Hz,只在每帧提交最后一次更新,
     使高频拖拽期间的"系统重建 + 2D/3D 双视图重渲染"上限为每帧一次。 */
  const pendingCommit = useRef<(() => void) | null>(null);
  const commitRaf = useRef(0);
  const commit = (fn: () => void) => {
    pendingCommit.current = fn;
    if (!commitRaf.current) {
      commitRaf.current = requestAnimationFrame(() => {
        commitRaf.current = 0;
        const f = pendingCommit.current;
        pendingCommit.current = null;
        f?.();
      });
    }
  };
  useEffect(
    () => () => {
      if (commitRaf.current) cancelAnimationFrame(commitRaf.current);
    },
    [],
  );

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const sp = toSheet(e);
    if (!sp) return;
    if (drag === 'a' || drag === 'b') {
      const k = drag === 'a' ? 'A' : 'B';
      const cur = points[k];
      const h = sys.sheetToLocal('H', sp);
      commit(() => setPoint(k, [h[0], cur[1], h[1]]));
    } else if (drag === 'ap' || drag === 'bp') {
      const k = drag === 'ap' ? 'A' : 'B';
      const cur = points[k];
      const v = sys.sheetToLocal('V', sp);
      commit(() => setPoint(k, [v[0], v[1], cur[2]]));
    } else if (drag === 'c' || drag === 'cp') {
      const cur = points.C;
      if (drag === 'c') {
        const h = sys.sheetToLocal('H', sp);
        commit(() => setPoint('C', [h[0], cur[1], h[1]]));
      } else {
        const v = sys.sheetToLocal('V', sp);
        commit(() => setPoint('C', [v[0], v[1], cur[2]]));
      }
    } else if (drag === 'axisMove') {
      const p = sys.sheetToLocal('H', sp);
      commit(() => setAxisPos(p));
    } else if (drag === 'axisRot' && dragStart) {
      // 增量式 1D 旋转:只取指针相对按下点的"垂直于轴"位移分量,
      // 灵敏度与柄到转轴的距离(力臂)解耦,近轴拖拽不再过敏;Shift 精细调节
      const h = sys.sheetToLocal('H', sp);
      const a0 = dragStart.off;
      const n: Vec2 = [-Math.sin(a0), Math.cos(a0)];
      const d: Vec2 = [h[0] - dragStart.p[0], h[1] - dragStart.p[1]];
      const k = e.shiftKey ? ROT_SENS * 0.25 : ROT_SENS;
      commit(() => setAxisAngle(a0 + (d[0] * n[0] + d[1] * n[1]) * k));
    } else if (drag === 'axis2Move' && dragStart) {
      // OX₂ 只有 1 个自由度,滑动方向由模式决定:
      // 'perp'(直线章)沿 a₁b₁;'parallel'(平面章)沿积聚线的法向
      const m = sys.sheetToLocal('V1', sp);
      const d: Vec2 = [m[0] - dragStart.p[0], m[1] - dragStart.p[1]];
      const lA = sys.local('V1', A);
      const lB = sys.local('V1', B);
      const e = norm2([lB[0] - lA[0], lB[1] - lA[1]]);
      const dir: Vec2 = axisH2Mode === 'parallel' ? [-e[1], e[0]] : e;
      const off = dragStart.off + d[0] * dir[0] + d[1] * dir[1];
      commit(() => setAxisH2Offset(off));
    }
  };

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (mode === 'axis2Move') {
      const sp = toSheet(e);
      if (sp) setDragStart({ p: sys.sheetToLocal('V1', sp), off: axisH2Offset });
    }
    if (mode === 'axisRot') {
      const sp = toSheet(e);
      if (sp) setDragStart({ p: sys.sheetToLocal('H', sp), off: axisV1.angle });
    }
    setDrag(mode);
  };
  const endDrag = () => {
    // 松开前把最后一帧的待提交更新立即落盘,避免丢终点
    if (commitRaf.current) {
      cancelAnimationFrame(commitRaf.current);
      commitRaf.current = 0;
    }
    const f = pendingCommit.current;
    pendingCommit.current = null;
    f?.();
    setDrag(null);
    setDragStart(null);
  };

  if (flowOf(chapter).steps.length === 0) {
    return (
      <div className="sheet-empty">
        <p>第 {chapter} 章 · 制作中</p>
        <p className="hint">后续章节将复用同一套投影引擎,依次开放。</p>
      </div>
    );
  }

  /* ---- 绘图辅助 ---- */
  const projDot = (
    p: Vec2,
    color: string,
    mode: DragMode | null,
    label: string,
    labelOff: Vec2,
  ) => {
    const [x, y] = P(p);
    return (
      <g>
        <circle cx={x} cy={y} r={0.15} fill={color} />
        {layers.labels && (
          <text className="lbl" x={x + labelOff[0]} y={y - labelOff[1]} fill={color} fontSize={0.62}>
            {label}
          </text>
        )}
        {mode && (
          <circle
            cx={x}
            cy={y}
            r={0.5}
            fill="transparent"
            style={{ cursor: drag === mode ? 'grabbing' : 'grab' }}
            onPointerDown={startDrag(mode)}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        )}
      </g>
    );
  };

  const dashed = {
    stroke: '#94a3b8',
    strokeWidth: 0.045,
    strokeDasharray: '0.22 0.16',
    fill: 'none',
  } as const;

  const footTick = (ft: Vec2, toward: Vec2, dirU: Vec2): React.ReactNode => {
    const a = add2(ft, mul2(dirU, 0.24));
    const b = add2(a, mul2(toward, 0.24));
    const c = add2(ft, mul2(toward, 0.24));
    const [ax, ay] = P(a);
    const [bx, by] = P(b);
    const [cx, cy] = P(c);
    return (
      <polyline
        points={`${ax},${ay} ${bx},${by} ${cx},${cy}`}
        stroke="#94a3b8"
        strokeWidth={0.045}
        fill="none"
      />
    );
  };

  const measure = (ft: Vec2, pt: Vec2, value: number): React.ReactNode => {
    const [x1, y1] = P(ft);
    const [x2, y2] = P(pt);
    const mid: Vec2 = [(x1 + x2) / 2, (y1 + y2) / 2];
    return (
      <g>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#c026d3"
          strokeWidth={0.06}
          markerStart="url(#arrow)"
          markerEnd="url(#arrow)"
        />
        <text className="lbl" x={mid[0] + 0.28} y={mid[1]} fill="#c026d3" fontSize={0.5}>
          {fmt1(value)}
        </text>
      </g>
    );
  };

  /* OX₁ 轴的纸面几何 */
  const axisDir = norm2(fV1.u);
  const axisO: Vec2 = fV1.o;
  const [ax1, ay1] = P(add2(axisO, mul2(axisDir, -BIG)));
  const [ax2, ay2] = P(add2(axisO, mul2(axisDir, BIG)));
  const [mhx, mhy] = P(axisO);
  const [rhx, rhy] = P(add2(axisO, mul2(axisDir, 2.6)));
  const [lbx, lby] = P(
    add2(add2(axisO, mul2(axisDir, 3.5)), [-axisDir[1] * 0.4, axisDir[0] * 0.4]),
  );

  const footA1 = footOf('V1', A);
  const footB1 = footOf('V1', B);
  const footC1 = footOf('V1', C);
  const towardA = norm2([sA.V1[0] - footA1[0], sA.V1[1] - footA1[1]]);
  const towardB = norm2([sB.V1[0] - footB1[0], sB.V1[1] - footB1[1]]);
  const towardC = norm2([sC.V1[0] - footC1[0], sC.V1[1] - footC1[1]]);

  /* OX₂ 与 H₂ 投影(仅 showAxis2) */
  const footA2 = fH2 ? footOf('H2', A) : null;
  const footB2 = fH2 ? footOf('H2', B) : null;
  const footC2 = fH2 ? footOf('H2', C) : null;
  const axisDir2 = fH2 ? norm2(fH2.u) : null;
  const towardA2 =
    footA2 && sA.H2 ? norm2([sA.H2[0] - footA2[0], sA.H2[1] - footA2[1]]) : null;
  const towardB2 =
    footB2 && sB.H2 ? norm2([sB.H2[0] - footB2[0], sB.H2[1] - footB2[1]]) : null;
  const towardC2 =
    footC2 && sC.H2 ? norm2([sC.H2[0] - footC2[0], sC.H2[1] - footC2[1]]) : null;

  /** 三角形在某个投影面上的填充半透明多边形(积聚时自动塌缩成线,正好展示积聚性) */
  const triFill = (pts: [Vec2, Vec2, Vec2], color: string, opacity = 0.13) => {
    const d = pts.map((p) => P(p).join(',')).join(' ');
    return (
      <polygon points={d} fill={color} fillOpacity={opacity} stroke="none" />
    );
  };

  return (
    <svg
      ref={svgRef}
      className="sheet"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 z" fill="#c026d3" />
        </marker>
        <marker id="xArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
          <path d="M0,1 L10,5 L0,9 z" fill="#475569" />
        </marker>
      </defs>

      {/* OX 轴(V/H 交线) */}
      <line
        x1={viewBox.x + 0.6}
        y1={0}
        x2={viewBox.x + viewBox.w - 1.3}
        y2={0}
        stroke="#475569"
        strokeWidth={0.055}
        markerEnd="url(#xArrow)"
      />
      <text className="lbl" x={viewBox.x + viewBox.w - 1.1} y={-0.25} fill="#475569" fontSize={0.55}>X</text>
      <text className="lbl" x={viewBox.x + 0.7} y={-0.25} fill="#475569" fontSize={0.55}>O</text>

      {/* 连线与投影连线 */}
      {layers.construct && (
        <g>
          <line {...lineP(sA.V, sB.V)} stroke="#64748b" strokeWidth={0.04} />
          <line {...lineP(sA.H, sB.H)} stroke="#64748b" strokeWidth={0.04} />
          {isPlane && (
            <>
              {triFill([sA.V, sB.V, sC.V], '#3b82f6')}
              {triFill([sA.H, sB.H, sC.H], '#10b981')}
              <line {...lineP(sB.V, sC.V)} stroke="#64748b" strokeWidth={0.04} />
              <line {...lineP(sC.V, sA.V)} stroke="#64748b" strokeWidth={0.04} />
              <line {...lineP(sB.H, sC.H)} stroke="#64748b" strokeWidth={0.04} />
              <line {...lineP(sC.H, sA.H)} stroke="#64748b" strokeWidth={0.04} />
            </>
          )}
          <line {...lineP(sA.V, [sA.V[0], 0])} {...dashed} />
          <line {...lineP(sB.V, [sB.V[0], 0])} {...dashed} />
          <line {...lineP(sA.H, [sA.H[0], 0])} {...dashed} />
          <line {...lineP(sB.H, [sB.H[0], 0])} {...dashed} />
          {isPlane && (
            <>
              <line {...lineP(sC.V, [sC.V[0], 0])} {...dashed} />
              <line {...lineP(sC.H, [sC.H[0], 0])} {...dashed} />
            </>
          )}
          {showAxis && (
            <>
              <line {...lineP(sA.V1, sB.V1)} stroke="#64748b" strokeWidth={0.04} />
              <line {...lineP(sA.H, sA.V1)} {...dashed} />
              <line {...lineP(sB.H, sB.V1)} {...dashed} />
              {footTick(footA1, towardA, axisDir)}
              {footTick(footB1, towardB, axisDir)}
              {isPlane && (
                <>
                  {triFill([sA.V1, sB.V1, sC.V1], '#d97706', 0.2)}
                  <line {...lineP(sB.V1, sC.V1)} stroke="#64748b" strokeWidth={0.04} />
                  <line {...lineP(sC.V1, sA.V1)} stroke="#64748b" strokeWidth={0.04} />
                  <line {...lineP(sC.H, sC.V1)} {...dashed} />
                  {footTick(footC1, towardC, axisDir)}
                </>
              )}
            </>
          )}
          {showAxis2 && footA2 && footB2 && towardA2 && towardB2 && axisDir2 && (
            <>
              <line {...lineP(sA.V1, sA.H2!)} {...dashed} />
              <line {...lineP(sB.V1, sB.H2!)} {...dashed} />
              {footTick(footA2, towardA2, axisDir2)}
              {footTick(footB2, towardB2, axisDir2)}
              {isPlane && footC2 && towardC2 && (
                <>
                  {triFill([sA.H2!, sB.H2!, sC.H2!], '#8b5cf6', 0.2)}
                  <line {...lineP(sB.H2!, sC.H2!)} stroke="#64748b" strokeWidth={0.04} />
                  <line {...lineP(sC.H2!, sA.H2!)} stroke="#64748b" strokeWidth={0.04} />
                  <line {...lineP(sC.V1, sC.H2!)} {...dashed} />
                  {footTick(footC2, towardC2, axisDir2)}
                </>
              )}
            </>
          )}
        </g>
      )}

      {/* 新轴 OX₁(可平移 / 旋转) */}
      {showAxis && (
        <g>
          <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke="#475569" strokeWidth={0.055} markerEnd="url(#xArrow)" />
          <text className="lbl" x={lbx} y={lby} fill="#475569" fontSize={0.55}>X₁</text>
        <rect
          x={mhx - 0.22}
          y={mhy - 0.22}
          width={0.44}
          height={0.44}
          fill="#64748b"
          style={{ cursor: drag === 'axisMove' ? 'grabbing' : 'grab' }}
          onPointerDown={startDrag('axisMove')}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        <circle
          cx={rhx}
          cy={rhy}
          r={0.24}
          fill="#64748b"
          style={{ cursor: drag === 'axisRot' ? 'grabbing' : 'grab' }}
          onPointerDown={startDrag('axisRot')}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        </g>
      )}

      {/* 二次换面新轴 OX₂(仅沿 a₁b₁ 方向平移,方向恒 ⊥) */}
      {showAxis2 && fH2 && axisDir2 && (
        <g>
          <line
            x1={P(add2(fH2.o, mul2(axisDir2, -BIG)))[0]}
            y1={P(add2(fH2.o, mul2(axisDir2, -BIG)))[1]}
            x2={P(add2(fH2.o, mul2(axisDir2, BIG)))[0]}
            y2={P(add2(fH2.o, mul2(axisDir2, BIG)))[1]}
            stroke="#475569"
            strokeWidth={0.055}
            markerEnd="url(#xArrow)"
          />
          <text
            className="lbl"
            x={P(add2(add2(fH2.o, mul2(axisDir2, 3.5)), [-axisDir2[1] * 0.4, axisDir2[0] * 0.4]))[0]}
            y={P(add2(add2(fH2.o, mul2(axisDir2, 3.5)), [-axisDir2[1] * 0.4, axisDir2[0] * 0.4]))[1]}
            fill="#475569"
            fontSize={0.55}
          >
            X₂
          </text>
          <rect
            x={P(fH2.o)[0] - 0.22}
            y={P(fH2.o)[1] - 0.22}
            width={0.44}
            height={0.44}
            fill="#64748b"
            style={{ cursor: drag === 'axis2Move' ? 'grabbing' : 'grab' }}
            onPointerDown={startDrag('axis2Move')}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </g>
      )}

      {/* 等距规律标注(features.measuresV1:a₁ 到 OX₁ = a′ 到 OX) */}
      {showAxis && layers.measures && features.measuresV1 && (
        <g>
          {measure([sA.V[0], 0], sA.V, Math.abs(A[1]))}
          {measure(footA1, sA.V1, Math.abs(sys.local('V1', A)[1]))}
        </g>
      )}

      {/* 等距链标注(features.measuresH2:a₂ 到 OX₂ = a 到 OX₁) */}
      {showAxis && showAxis2 && footA2 && layers.measures && features.measuresH2 && (
        <g>
          {measure(footA1, sA.H, Math.hypot(sA.H[0] - footA1[0], sA.H[1] - footA1[1]))}
          {measure(footA2, sA.H2!, Math.hypot(sA.H2![0] - footA2[0], sA.H2![1] - footA2[1]))}
        </g>
      )}

      {/* 倾角 δ 弧线(features.tiltAngle:p₁ 与 OX₁ 的夹角;条件破坏时变红警告) */}
      {showAxis && layers.measures && features.tiltAngle && ch5X && (() => {
        const d1 = norm2([sB.V1[0] - sA.V1[0], sB.V1[1] - sA.V1[1]]);
        const axisD = norm2(fV1.u);
        const a0 = Math.atan2(axisD[1], axisD[0]);
        const a1 = Math.atan2(d1[1], d1[0]);
        // 最短转角(带符号)
        let sweep = a1 - a0;
        while (sweep > Math.PI) sweep -= 2 * Math.PI;
        while (sweep < -Math.PI) sweep += 2 * Math.PI;
        const R = 1.2;
        const N = 16;
        const arc: Vec2[] = Array.from({ length: N + 1 }, (_, i) =>
          add2(ch5X, [
            Math.cos(a0 + (sweep * i) / N) * R,
            Math.sin(a0 + (sweep * i) / N) * R,
          ]),
        );
        // 共线性检查:c₁ 是否仍在 p₁ 上(条件破坏判定)
        const dev = Math.abs(
          (sC.V1[0] - sA.V1[0]) * d1[1] - (sC.V1[1] - sA.V1[1]) * d1[0],
        );
        const ok = dev < 0.1;
        const col = ok ? '#c026d3' : '#dc2626';
        const deg = Math.abs((sweep * 180) / Math.PI).toFixed(1);
        const midA = a0 + sweep / 2;
        const [lx, ly] = P(
          add2(ch5X, [Math.cos(midA) * (R + 0.85), Math.sin(midA) * (R + 0.85)]),
        );
        const d = arc.map((p) => P(p).join(',')).join(' ');
        return (
          <g>
            <polyline points={d} fill="none" stroke={col} strokeWidth={0.07} />
            <text className="lbl" x={lx} y={ly} fill={col} fontSize={0.6}>
              {ok ? `δ = ${deg}°` : `δ = ${deg}°(条件已破坏)`}
            </text>
          </g>
        );
      })()}

      {/* 实长/实形标注 */}
      {showTL && showAxis && (
        features.realShape && sA.H2 && sB.H2 && sC.H2 ? (
          /* 实形章:对应边对照 —— a₂b₂ = |AB|、a₂c₂ = |AC|(两组对应边相等 ⇒ 实形) */
          (() => {
            const pairs: Array<[Vec2, Vec2, number, string]> = [
              [sA.H2, sB.H2, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), 'a₂b₂'],
              [sA.H2, sC.H2, Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]), 'a₂c₂'],
            ];
            return (
              <g>
                {pairs.map(([p, q, real, name]) => {
                  const proj = Math.hypot(p[0] - q[0], p[1] - q[1]);
                  const eq = Math.abs(proj - real) < 0.05;
                  const d = norm2([q[0] - p[0], q[1] - p[1]]);
                  const off: Vec2 = [-d[1] * 0.35, d[0] * 0.35];
                  const a = add2(p, off);
                  const b = add2(q, off);
                  const [x1, y1] = P(a);
                  const [x2, y2] = P(b);
                  const mid: Vec2 = [(x1 + x2) / 2, (y1 + y2) / 2];
                  return (
                    <g key={name}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c026d3" strokeWidth={0.06} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      <text className="lbl" x={mid[0]} y={mid[1] - 0.35} fill={eq ? '#c026d3' : '#dc2626'} fontSize={0.5} textAnchor="middle">
                        {eq ? `${name} = ${fmt1(real)}(实形)` : `${name} = ${fmt1(proj)} ≠ ${fmt1(real)}`}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()
        ) : (
        (() => {
          const tl = Math.hypot(sA.V1[0] - sB.V1[0], sA.V1[1] - sB.V1[1]);
          const real = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
          const eq = Math.abs(tl - real) < 0.05;
          const text = eq
            ? `a₁b₁ = |AB| = ${fmt1(real)}`
            : `a₁b₁ = ${fmt1(tl)} ≠ 实长 ${fmt1(real)}`;
          const d = norm2([sB.V1[0] - sA.V1[0], sB.V1[1] - sA.V1[1]]);
          const off: Vec2 = [-d[1] * 0.4, d[0] * 0.4];
          const a = add2(sA.V1, off);
          const b = add2(sB.V1, off);
          const midP: Vec2 = [(a[0] + b[0]) / 2 - d[1] * 0.4, (a[1] + b[1]) / 2 + d[0] * 0.4];
          const [x1, y1] = P(a);
          const [x2, y2] = P(b);
          const [mx, my] = P(midP);
          return (
            <g>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c026d3" strokeWidth={0.06} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
              <text className="lbl" x={mx} y={my} fill={eq ? '#c026d3' : '#dc2626'} fontSize={0.55} textAnchor="middle">
                {text}
              </text>
            </g>
          );
        })()
        )
      )}

      {/* 投影点:A 可拖拽,a₁ 为派生点(不可拖) */}
      {projDot(sA.V, '#2563eb', 'ap', projLabel('a', 'V'), [-0.85, 0.2])}
      {projDot(sA.H, '#059669', 'a', projLabel('a', 'H'), [-0.25, -0.9])}
      {projDot(sB.V, '#2563eb', 'bp', projLabel('b', 'V'), [0.4, 0.2])}
      {projDot(sB.H, '#059669', 'b', projLabel('b', 'H'), [-0.25, -0.9])}
      {isPlane && projDot(sC.V, '#2563eb', 'cp', projLabel('c', 'V'), [0.4, 0.2])}
      {isPlane && projDot(sC.H, '#059669', 'c', projLabel('c', 'H'), [0.4, -0.9])}
      {showAxis && projDot(sA.V1, '#d97706', null, projLabel('a', 'V1'), [0.4, -0.3])}
      {showAxis && projDot(sB.V1, '#d97706', null, projLabel('b', 'V1'), [0.4, -0.3])}
      {showAxis && isPlane && projDot(sC.V1, '#d97706', null, projLabel('c', 'V1'), [0.4, -0.3])}
      {showAxis2 && projDot(sA.H2!, '#8b5cf6', null, projLabel('a', 'H2'), [0.45, 0.4])}
      {showAxis2 && projDot(sB.H2!, '#8b5cf6', null, projLabel('b', 'H2'), [-1.2, -0.5])}
      {showAxis2 && isPlane && projDot(sC.H2!, '#8b5cf6', null, projLabel('c', 'H2'), [-1.2, -0.5])}

      {/* 面名 */}
      {layers.labels && (
        <g>
          <text className="plane-name" x={viewBox.x + 0.7} y={viewBox.y + 1.0} fill="#3b82f6" fontSize={0.75}>V</text>
          <text className="plane-name" x={viewBox.x + 0.7} y={viewBox.y + viewBox.h - 0.35} fill="#10b981" fontSize={0.75}>H</text>
          {showAxis && (
            <text className="plane-name" x={P(axisO)[0] + 0.9} y={P(axisO)[1] + 1.15} fill="#d97706" fontSize={0.75}>V₁</text>
          )}
          {showAxis2 && sA.H2 && (
            <text className="plane-name" x={P(sA.H2)[0] + 1.5} y={P(sA.H2)[1] + 1.05} fill="#8b5cf6" fontSize={0.75}>H₂</text>
          )}
        </g>
      )}
    </svg>
  );
}
