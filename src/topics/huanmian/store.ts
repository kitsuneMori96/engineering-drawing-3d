import { create } from 'zustand';
import type { Vec2, Vec3 } from '../../lib/math';
import { norm2 } from '../../lib/math';
import {
  buildSystem,
  defaultAxisH2Offset,
  planeAxisAngle,
  type AxisH2Mode,
  type PlaneDef,
} from '../../lib/engine';
import { FLOWS, type StepTarget } from './chapters';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** 进入直线章节时的默认新轴:OX₁ ∥ ab,画在 ab 一侧 */
export const DEFAULT_AXIS_V1 = { pos: [0, 6.4] as Vec2, angle: Math.atan2(3.8, 4.2) };
/** 进入平面章节时的默认新轴:画在 H 视图下方,∠O 由平面内水平线方向决定 */
export const DEFAULT_AXIS_V1_PLANE_POS = [0, 11] as Vec2;

function applyTargets(s: State, t: StepTarget): Partial<State> {
  return {
    ...(t.unfoldH !== undefined ? { unfoldH: clamp01(t.unfoldH) } : null),
    ...(t.unfoldV1 !== undefined ? { unfoldV1: clamp01(t.unfoldV1) } : null),
    ...(t.unfoldH2 !== undefined ? { unfoldH2: clamp01(t.unfoldH2) } : null),
    ...(t.showAxis !== undefined ? { showAxis: t.showAxis } : null),
    ...(t.showAxis2 !== undefined ? { showAxis2: t.showAxis2 } : null),
    ...(t.showTL !== undefined ? { showTL: t.showTL } : null),
    ...(t.measures !== undefined
      ? { layers: { ...s.layers, measures: t.measures } }
      : null),
  };
}

interface State {
  points: { A: Vec3; B: Vec3; C: Vec3 };
  /** 新轴 OX₁ 在 H 面局部坐标(x=向右, y=深度)中的位置与角度 */
  axisV1: { pos: Vec2; angle: number };
  /** 二次换面新轴 OX₂:沿哪个方向滑动(直线章 ⊥ a₁b₁,平面章 ∥ 积聚线) */
  axisH2Offset: number;
  /** OX₂ 模式:直线章 'perp',平面章 'parallel'(由 setChapter 切换) */
  axisH2Mode: AxisH2Mode;
  unfoldH: number;
  unfoldV1: number;
  unfoldH2: number;
  /** 当前步是否显示 V₁/OX₁(由讲解目标驱动) */
  showAxis: boolean;
  /** 当前步是否显示 H₂/OX₂ */
  showAxis2: boolean;
  /** 当前步是否显示实长标注(a₁b₁ 与 |AB| 对照) */
  showTL: boolean;
  layers: {
    planes: boolean;
    projectors: boolean;
    labels: boolean;
    construct: boolean;
    measures: boolean;
  };
  chapter: number;
  step: number;
  setPoint: (k: 'A' | 'B' | 'C', p: Vec3) => void;
  setAxisPos: (p: Vec2) => void;
  setAxisAngle: (a: number) => void;
  setAxisH2Offset: (o: number) => void;
  setUnfoldH: (t: number) => void;
  setUnfoldV1: (t: number) => void;
  setUnfoldH2: (t: number) => void;
  toggleLayer: (k: keyof State['layers']) => void;
  setChapter: (id: number) => void;
  /** 跳到某步(应用该步的目标状态) */
  setStep: (i: number) => void;
}

export const useStore = create<State>((set, get) => ({
  points: {
    A: [1.6, 3.2, 3.4],
    B: [5.8, 5.6, 7.2],
    C: [5.0, 2.6, 4.6],
  },
  // OX₁ 画在 H 视图下方,平行于 ab(ab 方向 ≈ (4.2, 3.8))
  axisV1: { ...DEFAULT_AXIS_V1 },
  axisH2Offset: 0,
  axisH2Mode: 'perp',
  unfoldH: 0,
  unfoldV1: 0,
  unfoldH2: 0,
  showAxis: false,
  showAxis2: false,
  showTL: false,
  layers: {
    planes: true,
    projectors: true,
    labels: true,
    construct: true,
    measures: false,
  },
  chapter: 0,
  step: 0,
  setPoint: (k, p) => set((s) => ({ points: { ...s.points, [k]: p } })),
  setAxisPos: (p) => set((s) => ({ axisV1: { ...s.axisV1, pos: p } })),
  setAxisAngle: (a) => set((s) => ({ axisV1: { ...s.axisV1, angle: a } })),
  setAxisH2Offset: (o) => set({ axisH2Offset: o }),
  setUnfoldH: (t) => set({ unfoldH: clamp01(t) }),
  setUnfoldV1: (t) => set({ unfoldV1: clamp01(t) }),
  setUnfoldH2: (t) => set({ unfoldH2: clamp01(t) }),
  toggleLayer: (k) =>
    set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setChapter: (id) => {
    const s = get();
    const flow = FLOWS[id];
    if (!flow) return;
    const f = flow.features;
    // 进入新章节时把新轴复位为几何上正确的默认值(由章节 features 声明)
    const axisV1 =
      f.axisV1Default === 'parallel-ab'
        ? { ...DEFAULT_AXIS_V1 }
        : f.axisV1Default === 'plane-horizontal'
          ? {
              pos: DEFAULT_AXIS_V1_PLANE_POS,
              angle: planeAxisAngle(s.points.A, s.points.B, s.points.C),
            }
          : s.axisV1;
    let axisH2Offset = s.axisH2Offset;
    if (f.axisH2DefaultOffset) {
      const sys = buildSystem(planeDefs(axisV1), () => 1);
      axisH2Offset = defaultAxisH2Offset(sys, s.points.A, s.points.B);
    }
    const step0: StepTarget = flow.targets[0] ?? {};
    set({
      chapter: id,
      step: 0,
      axisV1,
      axisH2Mode: f.axisH2Mode,
      axisH2Offset,
      ...applyTargets(s, step0),
    });
  },
  setStep: (i) => set((s) => {
    const flow = FLOWS[s.chapter];
    const n = Math.min(flow ? flow.steps.length - 1 : 0, Math.max(0, i));
    const t = flow?.targets[n] ?? {};
    return { step: n, ...applyTargets(s, t) };
  }),
}));

/** 首屏从 URL 恢复章节/步骤:必须在模块初始化时执行(先于视图的 URL 回写),
 *  放 useEffect 会与回写竞态导致恢复被覆盖——旧版即败在此。 */
if (typeof window !== 'undefined') {
  const q = new URLSearchParams(window.location.search);
  const topic = q.get('topic');
  const chRaw = q.get('ch');
  if (chRaw !== null && (topic === null || topic === 'huanmian')) {
    const ch = Number(chRaw);
    if (Number.isInteger(ch) && FLOWS[ch]) {
      useStore.getState().setChapter(ch);
      const step = Math.max(0, Number(q.get('step')) || 0);
      if (step > 0) useStore.getState().setStep(step);
    }
  }
}

/** 当前章节下的投影面链(V → H → V₁,可选 H₂) */
export function planeDefs(axisV1: { pos: Vec2; angle: number }): PlaneDef[] {
  return [
    {
      id: 'V',
      parentId: null,
      name: 'V',
      axisLabel: 'OX',
      axisPos: [0, 0],
      axisDir: [1, 0],
      side: -1,
      color: '#3b82f6',
    },
    {
      id: 'H',
      parentId: 'V',
      name: 'H',
      axisLabel: 'OX',
      axisPos: [0, 0],
      axisDir: [1, 0],
      side: -1,
      color: '#10b981',
    },
    {
      id: 'V1',
      parentId: 'H',
      name: 'V\u2081',
      axisLabel: 'OX\u2081',
      axisPos: axisV1.pos,
      axisDir: norm2([Math.cos(axisV1.angle), Math.sin(axisV1.angle)]),
      side: -1,
      color: '#f59e0b',
    },
  ];
}
