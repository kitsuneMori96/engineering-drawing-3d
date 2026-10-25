import { useMemo, useRef, useState } from 'react';
import type { Vec2, Vec3 } from '../../lib/math';
import { projLabel } from '../../lib/engine';
import { activeBuilt, viewPlan } from './active';
import { useSolidsSystem, useSolidsUnfold } from './useSolidsSystem';
import { useSolidsStore } from './store';
import {
  hiddenLines,
  viewBasis,
  type HlrResult,
  type Seg2,
  type ViewId,
} from './hlr';
import { isPointVisible, pickSurface } from './ray';
import { displayVertices } from './mesh';
import { solidX0, sheetLayout, VIEW_COLORS, VIEW_NAMES, type SheetBox } from './views';

/** 纸面数学坐标(y 向上)→ SVG 坐标(y 向下) */
const P = (p: Vec2): Vec2 => [p[0], -p[1]];

const VIEWS: ViewId[] = ['V', 'H', 'W'];
const C_INK = '#1f2937';
const C_HIDDEN = '#64748b';
const C_PROBE = '#c026d3';
const C_GUIDE = '#94a3b8';

const lineP = (a: Vec2, b: Vec2) => {
  const [x1, y1] = P(a);
  const [x2, y2] = P(b);
  return { x1, y1, x2, y2 };
};

export default function Sheet2D() {
  const sys = useSolidsSystem();
  const unfold = useSolidsUnfold();
  const chapter = useSolidsStore((s) => s.chapter);
  const problemId = useSolidsStore((s) => s.problemId);
  const step = useSolidsStore((s) => s.step);
  const layers = useSolidsStore((s) => s.layers);
  const reveal = useSolidsStore((s) => s.reveal);
  const probe = useSolidsStore((s) => s.probe);
  const setProbe = useSolidsStore((s) => s.setProbe);

  const built = useMemo(() => activeBuilt(chapter, problemId), [chapter, problemId]);
  const mesh = built.mesh;
  const x0 = useMemo(() => solidX0(mesh), [mesh]);
  const layout = useMemo(() => sheetLayout(mesh, x0), [mesh, x0]);
  const plan = useMemo(() => viewPlan(chapter, problemId), [chapter, problemId]);
  const bases = useMemo(
    () => ({ V: viewBasis('V', x0), H: viewBasis('H', x0), W: viewBasis('W', x0) }),
    [x0],
  );
  const hlr = useMemo(
    () => ({
      V: hiddenLines(mesh, bases.V),
      H: hiddenLines(mesh, bases.H),
      W: hiddenLines(mesh, bases.W),
    }),
    [mesh, bases],
  );
  const cutGroups = useMemo(
    () => new Set(mesh.groups.filter((g) => g.kind === 'cut').map((g) => g.id)),
    [mesh],
  );
  /** 去掉三角化分点后的真实角点,用于顶点编号 */
  const dverts = useMemo(() => displayVertices(mesh), [mesh]);
  /** 各视图中投影重合的角点只标一个(优先标可见的那个) */
  const marks = useMemo(() => {
    const out = {} as Record<ViewId, { p: Vec3; vis: boolean; idx: number }[]>;
    for (const view of VIEWS) {
      const base = bases[view];
      const groups = new Map<string, { p: Vec3; vis: boolean; idx: number }>();
      dverts.forEach((p, i) => {
        const q = base.project(p);
        const key = `${Math.round(q[0] * 40)}|${Math.round(q[1] * 40)}`;
        const vis = isPointVisible(mesh, base, p);
        const prev = groups.get(key);
        if (!prev || (!prev.vis && vis)) groups.set(key, { p, vis, idx: i });
      });
      out[view] = [...groups.values()];
    }
    return out;
  }, [mesh, bases, dverts]);
  const groupColor = (id: string) => mesh.groups.find((g) => g.id === id)?.color ?? '#f59e0b';
  const cutColor = (groups: string[]): string | null => {
    const id = groups.find((g) => cutGroups.has(g));
    return id ? groupColor(id) : null;
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<string | null>(null);
  const [dragView, setDragView] = useState<ViewId | null>(null);

  /* ---- 展开补间:局部投影坐标 → 当前纸面位置 ---- */
  const to3 = (view: ViewId, q: Vec2): Vec3 =>
    view === 'V' ? [q[0], q[1], 0] : view === 'H' ? [q[0], 0, -q[1]] : [0, q[1], q[0] - x0];
  const anim = (view: ViewId, q: Vec2): Vec2 => sys.sheetPos(view, to3(view, q));
  const sheetToView = (view: ViewId, sp: Vec2): Vec2 => {
    const [lu, lv] = sys.sheetToLocal(view, sp);
    return view === 'V' ? [lu, lv] : view === 'H' ? [lu, -lv] : [x0 + lv, lu];
  };

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

  const inBox = (b: SheetBox, p: Vec2) =>
    p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;

  const viewAt = (p: Vec2): ViewId | null => {
    for (const v of VIEWS) if (inBox(layout[v], p)) return v;
    return null;
  };
  const viewDrawn = (v: ViewId) =>
    v === 'V' ? true : v === 'H' ? unfold.H > 0.98 : unfold.W > 0.98;

  const placeProbe = (view: ViewId, sp: Vec2, keepGroup: string | null) => {
    const q = sheetToView(view, sp);
    const hit = pickSurface(mesh, bases[view], q, keepGroup ?? undefined);
    if (!hit) return;
    groupRef.current = hit.group;
    setProbe({ view, group: hit.group, point: hit.point });
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!plan.pickable || !layers.points) return;
    const sp = toSheet(e);
    if (!sp) return;
    const view = viewAt(sp);
    if (!view || !viewDrawn(view)) {
      setProbe(null);
      return;
    }
    groupRef.current = null;
    placeProbe(view, sp, null);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragView(view);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragView) return;
    const sp = toSheet(e);
    if (!sp) return;
    placeProbe(dragView, sp, groupRef.current);
  };

  const endDrag = () => setDragView(null);

  /* ---- 视图范围 ---- */
  const viewBox = useMemo(() => {
    const { V, H, W } = layout;
    const minX = Math.min(V.x, H.x) - 1.6;
    const maxX = Math.max(W.x + W.w, V.x + V.w) + 1.4;
    const top = V.y + V.h + 1.3;
    const bottom = H.y - 1.3;
    return { x: minX, y: -top, w: maxX - minX, h: top - bottom };
  }, [layout]);

  /* ---- 可见/虚线线段 ---- */
  const segLine = (view: ViewId, s: Seg2, kind: 'vis' | 'hid', emphasizeCut = true) => {
    const cut = cutColor(s.groups);
    const colored = emphasizeCut && kind === 'vis' && cut && layers.cutLines;
    return (
      <line
        key={`${view}-${kind}-${s.a[0].toFixed(3)},${s.a[1].toFixed(3)}-${s.b[0].toFixed(3)},${s.b[1].toFixed(3)}`}
        {...lineP(anim(view, s.a), anim(view, s.b))}
        stroke={colored ? cut : kind === 'hid' ? C_HIDDEN : C_INK}
        strokeWidth={colored ? 0.1 : kind === 'hid' ? 0.05 : 0.072}
        strokeDasharray={kind === 'hid' ? '0.24 0.16' : undefined}
        strokeLinecap="round"
      />
    );
  };

  const stageOf = (view: ViewId): number => {
    if (plan.given === null || plan.given.includes(view)) return 4;
    return reveal;
  };

  const drawView = (view: ViewId) => {
    const stage = stageOf(view);
    if (stage <= 0) return null;
    const res: HlrResult = hlr[view];
    const base = bases[view];
    const fade = view === 'V' ? 1 : view === 'H' ? unfold.H : unfold.W;
    if (fade < 0.02) return null;
    const showHidden = layers.hidden && stage >= 3;

    const labels: React.ReactNode[] = [];
    if (layers.labels && stage >= 2) {
      marks[view].forEach(({ p, vis, idx }) => {
        const q = anim(view, base.project(p));
        const [x, y] = P(q);
        const txt = projLabel(String(idx + 1), view);
        labels.push(
          <text
            key={`vl-${view}-${idx}`}
            className="lbl"
            x={x + 0.16}
            y={y - 0.18}
            fontSize={0.42}
            fill={vis ? C_INK : '#94a3b8'}
          >
            {vis ? txt : `(${txt})`}
          </text>,
        );
      });
    }

    return (
      <g opacity={fade}>
        {stage === 1
          ? res.visible.filter((s) => s.outline).map((s) => segLine(view, s, 'vis', stage >= 4))
          : res.visible.map((s) => segLine(view, s, 'vis', stage >= 4))}
        {showHidden && res.hidden.map((s) => segLine(view, s, 'hid'))}
        {layers.vertices &&
          stage >= 2 &&
          marks[view].map(({ p, idx }) => {
            const q = anim(view, base.project(p));
            const [x, y] = P(q);
            return <circle key={`v-${view}-${idx}`} cx={x} cy={y} r={0.055} fill={C_INK} />;
          })}
        {labels}
        {probe && layers.points && viewDrawn(view) &&
          (() => {
            const q = anim(view, base.project(probe.point));
            const [x, y] = P(q);
            const vis = isPointVisible(mesh, base, probe.point);
            const txt = projLabel('P', view);
            return (
              <g>
                <circle cx={x} cy={y} r={0.15} fill={C_PROBE} stroke="#fff" strokeWidth={0.035} />
                <text className="lbl" x={x + 0.24} y={y - 0.24} fontSize={0.56} fill={C_PROBE}>
                  {vis ? txt : `(${txt})`}
                </text>
              </g>
            );
          })()}
      </g>
    );
  };

  /* ---- 边框、轴、45° 线 ---- */
  const boxRect = (b: SheetBox, color: string, view: ViewId) => {
    const [x, y] = P([b.x, b.y + b.h]);
    const stage = stageOf(view);
    const missing = plan.missing === view;
    return (
      <g>
        <rect x={x} y={y} width={b.w} height={b.h} fill={color} fillOpacity={0.035} />
        <rect
          x={x}
          y={y}
          width={b.w}
          height={b.h}
          fill="none"
          stroke={color}
          strokeOpacity={0.35}
          strokeWidth={0.04}
          strokeDasharray={missing && stage < 4 ? '0.28 0.2' : undefined}
        />
        <text
          className="lbl"
          x={x + 0.35}
          y={view === 'H' ? y + b.h + 0.75 : y + 0.7}
          fontSize={0.6}
          fill={color}
        >
          {VIEW_NAMES[view]}
        </text>
        <text className="lbl" x={x + b.w - 0.35} y={y + 0.7} fontSize={0.46} fill={color} textAnchor="end">
          {missing ? (stage >= 4 ? '已补全' : `待补 · 第 ${stage}/4 步`) : '已知'}
        </text>
        {missing && stage === 0 && (
          <text
            className="lbl"
            x={x + b.w / 2}
            y={y + b.h / 2}
            fontSize={0.55}
            fill={color}
            textAnchor="middle"
            opacity={0.7}
          >
            用面板「分步显示」补画此视图
          </text>
        )}
      </g>
    );
  };

  const miterFade = Math.min(unfold.H, unfold.W);
  const axes = (
    <g>
      <line {...lineP([layout.V.x - 0.8, 0], [x0 + 0.4, 0])} stroke="#475569" strokeWidth={0.05} />
      <line {...lineP([x0, layout.H.y - 0.6], [x0, layout.V.y + layout.V.h + 0.5])} stroke="#475569" strokeWidth={0.05} />
      <text className="lbl" x={layout.V.x + 0.5} y={-0.55} fontSize={0.5} fill="#475569">OX</text>
      <text className="lbl" x={x0 + 0.3} y={-(layout.V.y + layout.V.h + 0.2)} fontSize={0.5} fill="#475569">OZ</text>
      <text className="lbl" x={x0 + 0.3} y={-(layout.H.y - 0.3)} fontSize={0.5} fill="#475569">OY</text>
      {miterFade > 0.02 && (
        <g opacity={miterFade}>
          <line
            {...lineP([x0, 0], [x0 + layout.W.w, -layout.W.w])}
            stroke={C_GUIDE}
            strokeWidth={0.045}
            strokeDasharray="0.28 0.2"
          />
          <text
            className="lbl"
            x={x0 + layout.W.w * 0.62}
            y={layout.W.w * 0.62 - 0.55}
            fontSize={0.5}
            fill={C_GUIDE}
          >
            45°
          </text>
        </g>
      )}
    </g>
  );

  /* ---- 对应辅助线:长对正 / 高平齐 / 宽相等(经 45° 线转写) ---- */
  const projectors = () => {
    if (!layers.projectors) return null;
    const out: React.ReactNode[] = [];
    dverts.forEach((p, i) => {
      const v = anim('V', bases.V.project(p));
      const h = anim('H', bases.H.project(p));
      const w = anim('W', bases.W.project(p));
      const miterAt: Vec2 = [x0 - h[1], h[1]];
      out.push(
        <line
          key={`pj-vh-${i}`}
          {...lineP([v[0], Math.min(v[1], h[1])], [v[0], Math.max(v[1], h[1])])}
          stroke={C_GUIDE}
          strokeWidth={0.03}
          strokeDasharray="0.2 0.18"
          opacity={0.75}
        />,
        <line
          key={`pj-vw-${i}`}
          {...lineP([v[0], v[1]], [w[0], v[1]])}
          stroke={C_GUIDE}
          strokeWidth={0.03}
          strokeDasharray="0.2 0.18"
          opacity={0.75}
        />,
        <line
          key={`pj-hm-${i}`}
          {...lineP(h, miterAt)}
          stroke={C_GUIDE}
          strokeWidth={0.03}
          strokeDasharray="0.2 0.18"
          opacity={0.75}
        />,
        <line
          key={`pj-mw-${i}`}
          {...lineP(miterAt, [w[0], w[1]])}
          stroke={C_GUIDE}
          strokeWidth={0.03}
          strokeDasharray="0.2 0.18"
          opacity={0.75}
        />,
      );
    });
    return <g>{out}</g>;
  };

  /* ---- 取点的三面对应(宽相等的 45° 转写) ---- */
  const probeGuides = () => {
    if (!probe || !layers.points) return null;
    if (unfold.H < 0.98 || unfold.W < 0.98) return null;
    const v = anim('V', bases.V.project(probe.point));
    const h = anim('H', bases.H.project(probe.point));
    const w = anim('W', bases.W.project(probe.point));
    const d = -h[1];
    const miterAt: Vec2 = [x0 + d, -d];
    return (
      <g stroke={C_PROBE} strokeWidth={0.035} strokeDasharray="0.22 0.16" opacity={0.8} fill="none">
        <line {...lineP([v[0], v[1]], [v[0], h[1]])} />
        <line {...lineP([v[0], v[1]], [w[0], v[1]])} />
        <line {...lineP(h, miterAt)} />
        <line {...lineP(miterAt, [w[0], w[1]])} />
      </g>
    );
  };

  return (
    <div className="sheet-solid">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: dragView ? 'grabbing' : plan.pickable && layers.points ? 'crosshair' : 'default' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {VIEWS.map((v) => {
          const fade = v === 'V' ? 1 : v === 'H' ? unfold.H : unfold.W;
          if (fade < 0.02) return null;
          return (
            <g key={v} opacity={fade}>
              {boxRect(layout[v], VIEW_COLORS[v], v)}
            </g>
          );
        })}
        {axes}
        {VIEWS.map((v) => (
          <g key={v}>{drawView(v)}</g>
        ))}
        {projectors()}
        {probeGuides()}
      </svg>
      {plan.pickable && layers.points && (
        <div className="sheet-probe-hint">
          {probe ? '拖动 P 可在同一棱面上移动 · 点击视图空白处取消' : '在任一视图的实线区域内点击放置表面点 P'}
          <span className="mono"> · 第 {step + 1} 步</span>
        </div>
      )}
    </div>
  );
}
