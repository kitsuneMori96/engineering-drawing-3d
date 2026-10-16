import { useEffect, useMemo, useRef, useState } from 'react';
import type { Vec2, Vec3 } from '../../lib/math';
import { add2, fmt1, mul2, norm2 } from '../../lib/math';
import { projLabel } from '../../lib/engine';
import { useVisSystem } from './useVisSystem';
import { visFlowOf, type PtKey } from './chapters';
import { useVisStore } from './store';
import {
  coincidentPair,
  compareValue,
  crossStub,
  hiddenInterval,
  isTrueIntersection,
  linePoint,
  lineVsPlane,
  parenthesized,
  projH,
  projV,
  segSegCross,
  visibleOfCoincident,
  type Face,
} from './vis';

/** 纸面数学坐标(y 向上)→ SVG 坐标(y 向下) */
const P = (p: Vec2): Vec2 => [p[0], -p[1]];

const C_V = '#2563eb';
const C_H = '#059669';
const C_MEAS = '#c026d3';
const C_BAD = '#dc2626';
const C_DERIVED = '#d97706';

type DragMode = `${PtKey}:V` | `${PtKey}:H` | 'axisMove' | 'axisRot';

const BIG = 200;
const ROT_SENS = 0.15;

function lineP(a: Vec2, b: Vec2) {
  const [x1, y1] = P(a);
  const [x2, y2] = P(b);
  return { x1, y1, x2, y2 };
}

export default function Sheet2D() {
  const sys = useVisSystem();
  const points = useVisStore((s) => s.points);
  const layers = useVisStore((s) => s.layers);
  const chapter = useVisStore((s) => s.chapter);
  const step = useVisStore((s) => s.step);
  const showV1 = useVisStore((s) => s.showV1);
  const axisV1 = useVisStore((s) => s.axisV1);
  const setPoint = useVisStore((s) => s.setPoint);
  const setAxisPos = useVisStore((s) => s.setAxisPos);
  const setAxisAngle = useVisStore((s) => s.setAxisAngle);

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const [dragStart, setDragStart] = useState<{ p: Vec2; off: number } | null>(null);

  const flow = visFlowOf(chapter);
  const kind = flow.features.kind;
  const draggable = flow.features.draggable;
  const { A, B, C, D, E } = points;

  /* ---- 各点两面投影的纸面位置(跟随展开补间) ---- */
  const sheet = (id: string, k: PtKey): Vec2 | null => {
    const p = points[k];
    return p ? sys.sheetPos(id, p) : null;
  };
  const sV = useMemo(
    () => ({
      A: sheet('V', 'A'),
      B: sheet('V', 'B'),
      C: sheet('V', 'C'),
      D: sheet('V', 'D'),
      E: sheet('V', 'E'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sys, points],
  );
  const sH = useMemo(
    () => ({
      A: sheet('H', 'A'),
      B: sheet('H', 'B'),
      C: sheet('H', 'C'),
      D: sheet('H', 'D'),
      E: sheet('H', 'E'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sys, points],
  );

  /* ---- ch0 重影判别(实时由坐标得出) ---- */
  const abV = A && B && coincidentPair(A, B, 'V');
  const cdH = C && D && coincidentPair(C, D, 'H');
  const abVisV = A && B ? visibleOfCoincident(A, B, 'V') : null;
  const cdVisH = C && D ? visibleOfCoincident(C, D, 'H') : null;
  const showParen = kind === 'coincident' && step >= 1;

  /* ---- ch1 交叉分析 ---- */
  const xV = A && B && C && D ? segSegCross(projV(A), projV(B), projV(C), projV(D)) : null;
  const xH = A && B && C && D ? segSegCross(projH(A), projH(B), projH(C), projH(D)) : null;
  const trueInt =
    A && B && C && D ? isTrueIntersection(A, B, C, D) : { yes: false, P: null };
  /** V 面交点 X 的两个空间候选人 M∈AB, N∈CD */
  const candV = useMemo(() => {
    if (!xV || !A || !B || !C || !D) return null;
    const M = linePoint(A, B, xV.t);
    const N = linePoint(C, D, xV.u);
    return { X: xV.pt, M, N, mVis: compareValue(M, 'V') >= compareValue(N, 'V') };
  }, [xV, A, B, C, D]);
  /** H 面交点 Y 的两个候选人 */
  const candH = useMemo(() => {
    if (!xH || !A || !B || !C || !D) return null;
    const M = linePoint(A, B, xH.t);
    const N = linePoint(C, D, xH.u);
    return { X: xH.pt, M, N, mVis: compareValue(M, 'H') >= compareValue(N, 'H') };
  }, [xH, A, B, C, D]);

  /* ---- ch2 线面相交分析 ---- */
  const lp =
    kind === 'linePlane' && A && B && C && D && E ? lineVsPlane(D, E, A, B, C) : null;
  const hidV =
    kind === 'linePlane' && A && B && C && D && E
      ? hiddenInterval('V', D, E, A, B, C)
      : null;
  const hidH =
    kind === 'linePlane' && A && B && C && D && E
      ? hiddenInterval('H', D, E, A, B, C)
      : null;
  const s1 = useMemo(() => {
    if (!showV1) return null;
    const g = (k: PtKey): Vec2 | null => {
      const p = points[k];
      return p ? sys.sheetPos('V1', p) : null;
    };
    return { A: g('A'), B: g('B'), C: g('C'), D: g('D'), E: g('E') };
  }, [showV1, sys, points]);
  /** V₁ 面上 A/B/C 是否积聚共线(轴已对准平面法向) */
  const collapsed = useMemo(() => {
    if (!s1?.A || !s1.B || !s1.C) return false;
    const ux = s1.B[0] - s1.A[0];
    const uy = s1.B[1] - s1.A[1];
    const un = Math.hypot(ux, uy);
    if (un < 1e-6) return false;
    const dist = Math.abs(ux * (s1.C[1] - s1.A[1]) - uy * (s1.C[0] - s1.A[0])) / un;
    return dist < 0.05;
  }, [s1]);
  const kSheet = (face: Face, s: number): Vec2 | null => {
    if (!D || !E) return null;
    return sys.sheetPos(face, linePoint(D, E, s));
  };

  /* ---- 视口自适应 ---- */
  const viewBox = useMemo(() => {
    const all: Vec2[] = [];
    for (const k of ['A', 'B', 'C', 'D', 'E'] as PtKey[]) {
      if (sV[k]) all.push(sV[k]!);
      if (sH[k]) all.push(sH[k]!);
    }
    if (showV1) {
      all.push(sys.sheetFrame('V1').o);
      for (const k of ['A', 'B', 'C', 'D', 'E'] as PtKey[]) if (s1?.[k]) all.push(s1[k]!);
    }
    const pts = candV ? [candV.X] : [];
    const candHpts = candH && step >= 4 ? [candH.X] : [];
    all.push(...pts, ...candHpts);
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys, -1.2);
    const maxY = Math.max(...ys, 1.2);
    const padX = Math.max(2.4, (maxX - minX) * 0.28);
    const padY = Math.max(2.4, (maxY - minY) * 0.28);
    return {
      x: minX - padX,
      y: -(maxY + padY),
      w: maxX - minX + 2 * padX,
      h: maxY - minY + 2 * padY,
    };
  }, [sV, sH, showV1, sys, candV, candH, step, s1]);

  /* ---- 拖拽(pointermove 高频,每帧只提交最后一次) ---- */
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
    if (drag === 'axisMove') {
      const p = sys.sheetToLocal('H', sp);
      commit(() => setAxisPos(p));
      return;
    }
    if (drag === 'axisRot' && dragStart) {
      const h = sys.sheetToLocal('H', sp);
      const a0 = dragStart.off;
      const n: Vec2 = [-Math.sin(a0), Math.cos(a0)];
      const d: Vec2 = [h[0] - dragStart.p[0], h[1] - dragStart.p[1]];
      const k = e.shiftKey ? ROT_SENS * 0.25 : ROT_SENS;
      commit(() => setAxisAngle(a0 + (d[0] * n[0] + d[1] * n[1]) * k));
      return;
    }
    const [key, view] = drag.split(':') as [PtKey, 'V' | 'H'];
    const cur = points[key];
    if (!cur) return;
    if (view === 'V') {
      const v = sys.sheetToLocal('V', sp);
      commit(() => setPoint(key, [v[0], v[1], cur[2]]));
    } else {
      const h = sys.sheetToLocal('H', sp);
      commit(() => setPoint(key, [h[0], cur[1], h[1]]));
    }
  };

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (mode === 'axisMove' || mode === 'axisRot') {
      const sp = toSheet(e);
      if (sp) {
        const p = sys.sheetToLocal('H', sp);
        setDragStart({ p, off: axisV1.angle });
      }
    }
    setDrag(mode);
  };
  const endDrag = () => {
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

  if (flow.steps.length === 0) {
    return (
      <div className="sheet-empty">
        <p>第 {chapter} 章 · 制作中</p>
        <p className="hint">本章即将开放。</p>
      </div>
    );
  }

  /* ---- 绘图辅助 ---- */
  const dragModeOf = (k: PtKey, view: 'V' | 'H'): DragMode | null =>
    draggable.includes(k) ? (`${k}:${view}` as DragMode) : null;

  const projDot = (
    p: Vec2 | null,
    k: PtKey,
    view: 'V' | 'H',
    color: string,
    label: string,
    labelOff: Vec2,
  ) => {
    if (!p) return null;
    const [x, y] = P(p);
    const mode = dragModeOf(k, view);
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

  /** 被挡投影的教材画法:交点附近一小段粗虚线 */
  const stub = (X: Vec2, dir: Vec2, half = 0.7) => {
    const [p, q] = crossStub(X, dir, half);
    const [x1, y1] = P(p);
    const [x2, y2] = P(q);
    return (
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth={0.11} strokeDasharray="0.16 0.12" />
    );
  };

  const measure = (ft: Vec2, pt: Vec2, label: string): React.ReactNode => {
    const [x1, y1] = P(ft);
    const [x2, y2] = P(pt);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    return (
      <g>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={C_MEAS}
          strokeWidth={0.06}
          markerStart="url(#arrow)"
          markerEnd="url(#arrow)"
        />
        <text className="lbl" x={mx + 0.24} y={my} fill={C_MEAS} fontSize={0.5}>
          {label}
        </text>
      </g>
    );
  };

  const conclusion = (
    at: Vec2,
    text: string,
    color: string,
    dx = 0.6,
    dy = -0.7,
    anchor?: 'start' | 'middle' | 'end',
  ) => {
    const [x, y] = P(at);
    return (
      <text
        className="lbl"
        x={x + dx}
        y={y + dy}
        fill={color}
        fontSize={0.5}
        textAnchor={anchor ?? 'start'}
      >
        {text}
      </text>
    );
  };

  const projLine = (p: Vec2 | null) =>
    p && layers.projectors ? <line {...lineP(p, [p[0], 0])} {...dashed} /> : null;

  const footOfV1 = (pt: Vec3 | null): Vec2 | null => {
    if (!pt || !showV1) return null;
    const [lu] = sys.local('V1', pt);
    const f = sys.sheetFrame('V1');
    return add2(f.o, mul2(f.u, lu));
  };

  /* ---- ch2 三角形/直线图线 ---- */
  const triFill = (pts: [Vec2, Vec2, Vec2], color: string, opacity = 0.13) => {
    const d = pts.map((p) => P(p).join(',')).join(' ');
    return <polygon points={d} fill={color} fillOpacity={opacity} stroke="none" />;
  };
  const triEdges = (
    faces: [Vec2, Vec2, Vec2],
    color: string,
  ): React.ReactNode => {
    const [a, b, c] = faces;
    return (
      <>
        <line {...lineP(a, b)} stroke={color} strokeWidth={0.07} />
        <line {...lineP(b, c)} stroke={color} strokeWidth={0.07} />
        <line {...lineP(c, a)} stroke={color} strokeWidth={0.07} />
      </>
    );
  };

  /** 判别对象的两面图线(线/面) */
  const objectLines = () => {
    if (!layers.construct) return null;
    if (kind === 'coincident') {
      return (
        <g>
          {sV.A && sV.B && <line {...lineP(sV.A, sV.B)} stroke="#64748b" strokeWidth={0.04} />}
          {sH.A && sH.B && <line {...lineP(sH.A, sH.B)} stroke="#64748b" strokeWidth={0.04} />}
          {sV.C && sV.D && <line {...lineP(sV.C, sV.D)} stroke="#64748b" strokeWidth={0.04} />}
          {sH.C && sH.D && <line {...lineP(sH.C, sH.D)} stroke="#64748b" strokeWidth={0.04} />}
        </g>
      );
    }
    if (kind === 'crossing') {
      return (
        <g>
          {sV.A && sV.B && <line {...lineP(sV.A, sV.B)} stroke={C_V} strokeWidth={0.085} />}
          {sV.C && sV.D && <line {...lineP(sV.C, sV.D)} stroke={C_V} strokeWidth={0.085} />}
          {sH.A && sH.B && <line {...lineP(sH.A, sH.B)} stroke={C_H} strokeWidth={0.085} />}
          {sH.C && sH.D && <line {...lineP(sH.C, sH.D)} stroke={C_H} strokeWidth={0.085} />}
        </g>
      );
    }
    /* linePlane */
    if (!A || !B || !C || !D || !E) return null;
    /** DE 投影按被挡区间拆成 实-虚-实 三段(face 视图) */
    const deLine = (face: Face, hidden: [number, number] | null, show: boolean) => {
      const q0 = sys.sheetPos(face, D);
      const q1 = sys.sheetPos(face, E);
      const seg = (t0: number, t1: number, dash: boolean) => {
        const a = hidden ? kSheet(face, t0)! : q0;
        const b = hidden ? kSheet(face, t1)! : q1;
        return (
          <line
            {...lineP(a, b)}
            stroke="#ef4444"
            strokeWidth={0.09}
            strokeDasharray={dash && show ? '0.26 0.2' : undefined}
          />
        );
      };
      if (!hidden || !show) return <g>{seg(0, 1, false)}</g>;
      const [h0, h1] = hidden;
      return (
        <g>
          {h0 > 1e-6 && seg(0, h0, false)}
          {seg(h0, h1, true)}
          {h1 < 1 - 1e-6 && seg(h1, 1, false)}
        </g>
      );
    };
    return (
      <g>
        {sV.A && sV.B && sV.C && triFill([sV.A, sV.B, sV.C], '#3b82f6')}
        {sV.A && sV.B && sV.C && triEdges([sV.A, sV.B, sV.C], '#64748b')}
        {sH.A && sH.B && sH.C && triFill([sH.A, sH.B, sH.C], '#10b981')}
        {sH.A && sH.B && sH.C && triEdges([sH.A, sH.B, sH.C], '#64748b')}
        {deLine('V', hidV, step >= 3 && layers.hidden)}
        {deLine('H', hidH, step >= 4 && layers.hidden)}
      </g>
    );
  };

  /** ch1:交点 X、投影连线、候选人、短虚线、结论 */
  const crossingMarks = () => {
    if (kind !== 'crossing' || !A || !B || !C || !D) return null;
    const out: React.ReactNode[] = [];
    const dirABv = sV.A && sV.B ? norm2([sV.B[0] - sV.A[0], sV.B[1] - sV.A[1]]) : null;
    const dirCDv = sV.C && sV.D ? norm2([sV.D[0] - sV.C[0], sV.D[1] - sV.C[1]]) : null;
    const dirABh = sH.A && sH.B ? norm2([sH.B[0] - sH.A[0], sH.B[1] - sH.A[1]]) : null;
    const dirCDh = sH.C && sH.D ? norm2([sH.D[0] - sH.C[0], sH.D[1] - sH.C[1]]) : null;

    if (trueInt.yes) {
      /* 真相交:两交点落同一根投影连线,两面全实线 */
      if (xV && candV) {
        out.push(
          <g key="true">
            <circle {...{ cx: P(xV.pt)[0], cy: P(xV.pt)[1] }} r={0.17} fill={C_DERIVED} />
            {layers.labels &&
              conclusion(xV.pt, '真相交于 P:两交点同柱', '#0f766e', -1.2, -0.7, 'middle')}
          </g>,
        );
      }
      if (xV && candV && layers.projectors) {
        out.push(
          <line key="projXY" {...lineP(xV.pt, xH ? xH.pt : [xV.pt[0], 0])} stroke={C_MEAS} strokeWidth={0.05} strokeDasharray="0.22 0.16" />,
        );
      }
      return out;
    }

    /* V 面交点 X + 投影连线(向下穿过 H 面两线) */
    if (step >= 1 && xV && candV) {
      if (layers.projectors) {
        out.push(
          <line key="projX" {...lineP(candV.X, [candV.X[0], -Math.max(B[2], D[2], A[2], C[2]) - 1.2])} {...dashed} stroke={C_MEAS} />,
        );
      }
      out.push(
        <circle key="xV" cx={P(candV.X)[0]} cy={P(candV.X)[1]} r={0.16} fill={C_DERIVED} />,
      );
      if (layers.labels) out.push(conclusion(candV.X, 'X', C_DERIVED, 0.4, 0.5));
      /* 候选人 m、n 在 H 面上(派生点,不可拖) */
      const m = sys.sheetPos('H', candV.M);
      const n = sys.sheetPos('H', candV.N);
      out.push(
        <g key="mn">
          <circle cx={P(m)[0]} cy={P(m)[1]} r={0.14} fill={C_DERIVED} />
          <circle cx={P(n)[0]} cy={P(n)[1]} r={0.14} fill={C_DERIVED} />
          {layers.labels && (
            <>
              {conclusion(m, candV.mVis ? 'm' : parenthesized('m'), C_DERIVED, 0.4, 0.4)}
              {conclusion(n, candV.mVis ? parenthesized('n') : 'n', C_DERIVED, 0.4, -0.6)}
            </>
          )}
        </g>,
      );
      /* 比较深度标注:两点到 OX 的距离 = 深度 */
      if (step >= 3 && layers.measures) {
        out.push(
          <g key="mv">
            {measure([m[0], 0], m, `y=${fmt1(candV.M[2])}`)}
            {measure([n[0], 0], n, `y=${fmt1(candV.N[2])}`)}
          </g>,
        );
      }
      /* 被挡线在 X 附近画短虚线 */
      if (step >= 3 && dirABv && dirCDv) {
        const hiddenDir = candV.mVis ? dirABv : dirCDv;
        out.push(
          <g key="stubV">{stub(candV.X, hiddenDir)}</g>,
        );
        if (layers.labels) {
          out.push(
            conclusion(
              candV.X,
              candV.mVis ? '∵ y_M > y_N,(a′b′) 在此被挡' : '∵ y_N > y_M,(c′d′) 在此被挡',
              C_BAD,
              -0.6,
              -0.9,
              'middle',
            ),
          );
        }
      }
    }

    /* H 面交点 Y:同样一套 */
    if (step >= 4 && xH && candH) {
      out.push(
        <circle key="xH" cx={P(candH.X)[0]} cy={P(candH.X)[1]} r={0.16} fill={C_DERIVED} />,
      );
      if (layers.labels) out.push(conclusion(candH.X, 'Y', C_DERIVED, 0.4, 0.5));
      const m2 = sys.sheetPos('V', candH.M);
      const n2 = sys.sheetPos('V', candH.N);
      out.push(
        <g key="m2n2">
          <circle cx={P(m2)[0]} cy={P(m2)[1]} r={0.14} fill={C_DERIVED} />
          <circle cx={P(n2)[0]} cy={P(n2)[1]} r={0.14} fill={C_DERIVED} />
          {layers.labels && (
            <>
              {conclusion(m2, candH.mVis ? 'm' : parenthesized('m'), C_DERIVED, 0.4, 0.4)}
              {conclusion(n2, candH.mVis ? parenthesized('n') : 'n', C_DERIVED, 0.4, -0.6)}
            </>
          )}
        </g>,
      );
      if (layers.measures) {
        out.push(
          <g key="mh">
            {measure([m2[0], 0], m2, `z=${fmt1(candH.M[1])}`)}
            {measure([n2[0], 0], n2, `z=${fmt1(candH.N[1])}`)}
          </g>,
        );
      }
      if (dirABh && dirCDh) {
        const hiddenDirH = candH.mVis ? dirABh : dirCDh;
        out.push(<g key="stubH">{stub(candH.X, hiddenDirH)}</g>);
        if (layers.labels) {
          out.push(
            conclusion(
              candH.X,
              candH.mVis ? '∵ z_M > z_N,(ab) 在此被挡' : '∵ z_N > z_M,(cd) 在此被挡',
              C_BAD,
              -0.6,
              0.9,
              'middle',
            ),
          );
        }
      }
    }
    return out;
  };

  /** ch0:括号、比较标注、结论 */
  const coincidentMarks = () => {
    if (kind !== 'coincident' || !A || !B || !C || !D) return null;
    const out: React.ReactNode[] = [];
    /* 括号:不可见投影改标 (…) */
    if (showParen && abV && abVisV) {
      const aVis = abVisV === A;
      if (sV.A && layers.labels) {
        out.push(
          conclusion(
            sV.A,
            aVis ? 'a′ 可见,(b′) 被挡' : 'b′ 可见,(a′) 被挡',
            C_BAD,
            0.6,
            0.7,
          ),
        );
      }
    }
    if (step >= 1 && layers.measures && abV && sH.A && sH.B) {
      out.push(
        <g key="depth">
          {measure([sH.A[0], 0], sH.A, `y_A=${fmt1(A[2])}`)}
          {measure([sH.B[0], 0], sH.B, `y_B=${fmt1(B[2])}`)}
        </g>,
      );
    }
    if (showParen && cdH && cdVisH && sH.C && layers.labels) {
      const cVis = cdVisH === C;
      out.push(
        conclusion(
          sH.C,
          cVis ? 'c 可见,(d) 被挡' : 'd 可见,(c) 被挡',
          C_BAD,
          -0.5,
          -0.8,
          'end',
        ),
      );
    }
    if (step >= 2 && layers.measures && cdH && sV.C && sV.D) {
      out.push(
        <g key="height">
          {measure([sV.C[0], 0], sV.C, `z_C=${fmt1(C[1])}`)}
          {measure([sV.D[0], 0], sV.D, `z_D=${fmt1(D[1])}`)}
        </g>,
      );
    }
    return out;
  };

  /* ---- ch2 辅助投影面 V₁(积聚线 + k₁ 反投影) ---- */
  const axisDir = showV1 ? norm2(sys.sheetFrame('V1').u) : null;
  const axisO = showV1 ? sys.sheetFrame('V1').o : null;

  /** ch2:V₁ 积聚线、d₁e₁、反投影作图线、K 点两面投影与虚线结论 */
  const linePlaneMarks = () => {
    if (kind !== 'linePlane' || !showV1 || !s1 || !A || !B || !C || !D || !E) return null;
    const out: React.ReactNode[] = [];
    if (layers.construct) {
      /* 积聚线 p₁(V₁ 上 A/B/C 共线)或退化前的投影三角形 */
      if (collapsed && s1.A && s1.B) {
        const d = norm2([s1.B[0] - s1.A[0], s1.B[1] - s1.A[1]]);
        out.push(
          <line
            key="p1"
            {...lineP(add2(s1.A, mul2(d, -6)), add2(s1.B, mul2(d, 6)))}
            stroke="#d97706"
            strokeWidth={0.075}
          />,
        );
        if (layers.labels && s1.C)
          out.push(conclusion(s1.C, 'p₁(平面积聚)', '#b45309', 0.4, 0.45));
      } else if (s1.A && s1.B && s1.C) {
        out.push(<g key="t1">{triEdges([s1.A, s1.B, s1.C], '#d97706')}</g>);
      }
      /* d₁e₁:直线在 V₁ 上的投影 */
      if (s1.D && s1.E)
        out.push(
          <line key="d1e1" {...lineP(s1.D, s1.E)} stroke="#ef4444" strokeWidth={0.075} />,
        );
      /* 投影连线:H 面点 ⟂ OX₁ 到 V₁ 点 */
      if (layers.projectors)
        for (const k of ['A', 'B', 'C', 'D', 'E'] as PtKey[])
          if (sH[k] && s1[k])
            out.push(
              <line key={`hv1${k}`} {...lineP(sH[k]!, s1[k]!)} {...dashed} stroke="#94a3b8" />,
            );
      if (layers.labels) {
        if (s1.D) out.push(conclusion(s1.D, 'd₁', '#ef4444', -0.75, 0.4));
        if (s1.E) out.push(conclusion(s1.E, 'e₁', '#ef4444', 0.4, 0.4));
      }
    }
    /* k₁ → k′、k:交点反投影(解析 K 与辅助面作图等价) */
    if (step >= 2 && lp && lp.insideTri) {
      const k1 = sys.sheetPos('V1', lp.K);
      const kv = sys.sheetPos('V', lp.K);
      const kh = sys.sheetPos('H', lp.K);
      out.push(
        <g key="kback">
          <line {...lineP(k1, kv)} {...dashed} stroke="#94a3b8" />
          <line {...lineP(kv, kh)} {...dashed} stroke="#94a3b8" />
          <circle cx={P(k1)[0]} cy={P(k1)[1]} r={0.15} fill={C_DERIVED} />
          <circle cx={P(kv)[0]} cy={P(kv)[1]} r={0.15} fill={C_DERIVED} />
          <circle cx={P(kh)[0]} cy={P(kh)[1]} r={0.15} fill={C_DERIVED} />
          {layers.labels && (
            <>
              {conclusion(k1, 'k₁', C_DERIVED, 0.35, -0.5)}
              {conclusion(kv, 'k′', C_DERIVED, 0.35, 0.55)}
              {conclusion(kh, 'k', C_DERIVED, 0.35, -0.55)}
            </>
          )}
        </g>,
      );
    }
    /* 虚线段结论 */
    if (lp && lp.insideTri) {
      const side = (iv: [number, number]): 'd' | 'e' => (lp.s - iv[0] < iv[1] - lp.s ? 'e' : 'd');
      if (step >= 3 && layers.hidden && hidV && D && E) {
        const mid = kSheet('V', (hidV[0] + hidV[1]) / 2);
        if (mid)
          out.push(
            conclusion(
              mid,
              side(hidV) === 'e' ? '∵ 后方段被挡 → k′e′ 画虚线' : '∵ 后方段被挡 → d′k′ 画虚线',
              C_BAD,
              0,
              -0.7,
              'middle',
            ),
          );
      }
      if (step >= 4 && layers.hidden && hidH && D && E) {
        const mid = kSheet('H', (hidH[0] + hidH[1]) / 2);
        if (mid)
          out.push(
            conclusion(
              mid,
              side(hidH) === 'e' ? '∵ 下方段被挡 → ke 画虚线' : '∵ 下方段被挡 → dk 画虚线',
              C_BAD,
              0,
              0.9,
              'middle',
            ),
          );
      }
    }
    return out;
  };

  /* ---- 标签(带括号判别) ---- */
  const labelV = (k: PtKey, base: string): string => {
    const lbl = projLabel(base, 'V');
    if (!showParen) return lbl;
    if (k === 'A' && abV && abVisV && abVisV !== A) return parenthesized(lbl);
    if (k === 'B' && abV && abVisV && abVisV !== B) return parenthesized(lbl);
    return lbl;
  };
  const labelH = (k: PtKey, base: string): string => {
    const lbl = projLabel(base, 'H');
    if (!showParen) return lbl;
    if (k === 'C' && cdH && cdVisH && cdVisH !== C) return parenthesized(lbl);
    if (k === 'D' && cdH && cdVisH && cdVisH !== D) return parenthesized(lbl);
    return lbl;
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
          <path d="M0,1 L10,5 L0,9 z" fill={C_MEAS} />
        </marker>
        <marker id="xArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
          <path d="M0,1 L10,5 L0,9 z" fill="#475569" />
        </marker>
      </defs>

      {/* OX 轴 */}
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

      {/* 对象图线 */}
      {objectLines()}

      {/* 投影连线(点 → OX) */}
      {kind === 'coincident' &&
        ['A', 'B', 'C', 'D'].map((k) => (
          <g key={k}>
            {projLine(sV[k as PtKey])}
            {projLine(sH[k as PtKey])}
          </g>
        ))}
      {kind === 'crossing' &&
        ['A', 'B', 'C', 'D'].map((k) => (
          <g key={k}>
            {projLine(sV[k as PtKey])}
            {projLine(sH[k as PtKey])}
          </g>
        ))}
      {kind === 'linePlane' &&
        ['A', 'B', 'C', 'D', 'E'].map((k) => (
          <g key={k}>
            {projLine(sV[k as PtKey])}
            {projLine(sH[k as PtKey])}
          </g>
        ))}

      {/* 章专属判别标注 */}
      {coincidentMarks()}
      {crossingMarks()}
      {linePlaneMarks()}

      {/* 新轴 OX₁(ch2) */}
      {showV1 && axisO && axisDir && (
        <g>
          <line
            {...lineP(add2(axisO, mul2(axisDir, -BIG)), add2(axisO, mul2(axisDir, BIG)))}
            stroke="#475569"
            strokeWidth={0.055}
            markerEnd="url(#xArrow)"
          />
          <text
            className="lbl"
            x={P(add2(add2(axisO, mul2(axisDir, 3.5)), [-axisDir[1] * 0.4, axisDir[0] * 0.4]))[0]}
            y={P(add2(add2(axisO, mul2(axisDir, 3.5)), [-axisDir[1] * 0.4, axisDir[0] * 0.4]))[1]}
            fill="#475569"
            fontSize={0.55}
          >
            X₁
          </text>
          <rect
            x={P(axisO)[0] - 0.22}
            y={P(axisO)[1] - 0.22}
            width={0.44}
            height={0.44}
            fill="#64748b"
            style={{ cursor: drag === 'axisMove' ? 'grabbing' : 'grab' }}
            onPointerDown={startDrag('axisMove')}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
          {footOfV1(A) && (
            <circle
              cx={P(add2(axisO, mul2(axisDir, 2.6)))[0]}
              cy={P(add2(axisO, mul2(axisDir, 2.6)))[1]}
              r={0.24}
              fill="#64748b"
              style={{ cursor: drag === 'axisRot' ? 'grabbing' : 'grab' }}
              onPointerDown={startDrag('axisRot')}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          )}
        </g>
      )}

      {/* 投影点(可拖);重影对的两标签错开,避免叠字 */}
      {(['A', 'B', 'C', 'D', 'E'] as PtKey[]).map((k) => {
        const offV: Vec2 = k === 'B' && abV ? [-1.7, 0.25] : [0.45, 0.25];
        const offH: Vec2 = k === 'D' && cdH ? [-1.5, -0.75] : [0.45, -0.75];
        return (
          <g key={k}>
            {projDot(sV[k], k, 'V', C_V, labelV(k, k.toLowerCase()), offV)}
            {projDot(sH[k], k, 'H', C_H, labelH(k, k.toLowerCase()), offH)}
          </g>
        );
      })}

      {/* 面名 */}
      {layers.labels && (
        <g>
          <text className="plane-name" x={viewBox.x + 0.7} y={viewBox.y + 1.0} fill={C_V} fontSize={0.75}>V</text>
          <text className="plane-name" x={viewBox.x + 0.7} y={viewBox.y + viewBox.h - 0.35} fill={C_H} fontSize={0.75}>H</text>
          {showV1 && axisO && (
            <text className="plane-name" x={P(axisO)[0] + 0.9} y={P(axisO)[1] + 1.15} fill="#d97706" fontSize={0.75}>V₁</text>
          )}
        </g>
      )}
    </svg>
  );
}
