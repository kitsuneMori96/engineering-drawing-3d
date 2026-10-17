import { create } from 'zustand';
import type { Vec2, Vec3 } from '../../lib/math';
import { norm2 } from '../../lib/math';
import { planeAxisAngle, type PlaneDef } from '../../lib/engine';
import {
  ALL_PTS,
  DEFAULT_LAYERS,
  VIS_FLOWS,
  visFlowOf,
  type PtKey,
  type VisLayers,
  type VisStepTarget,
} from './chapters';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** ch2 默认新轴:画在 H 视图下方,方向由 planeAxisAngle 保证 V₁ ⊥ 平面 */
export const DEFAULT_AXIS_V1_POS = [0, 9] as Vec2;

const PT_KEYS: PtKey[] = ALL_PTS;

function presetPoints(chapter: number): Record<PtKey, Vec3 | null> {
  const preset = visFlowOf(chapter).features.preset;
  const out = {} as Record<PtKey, Vec3 | null>;
  for (const k of PT_KEYS) out[k] = preset[k] ?? null;
  return out;
}

function defaultAxis(chapter: number, points: Record<PtKey, Vec3 | null>) {
  const f = visFlowOf(chapter).features;
  if (f.useV1 && points.A && points.B && points.C) {
    return { pos: DEFAULT_AXIS_V1_POS, angle: planeAxisAngle(points.A, points.B, points.C) };
  }
  return { pos: DEFAULT_AXIS_V1_POS, angle: 0 };
}

function applyTargets(s: State, t: VisStepTarget): Partial<State> {
  return {
    ...(t.unfoldH !== undefined ? { unfoldH: clamp01(t.unfoldH) } : null),
    ...(t.unfoldV1 !== undefined ? { unfoldV1: clamp01(t.unfoldV1) } : null),
    ...(t.showV1 !== undefined ? { showV1: t.showV1 } : null),
    ...(t.layers ? { layers: { ...s.layers, ...t.layers } } : null),
  };
}

interface State {
  points: Record<PtKey, Vec3 | null>;
  /** 新轴 OX₁(H 局部坐标 (x, 深度))位置与角度,仅 ch2 使用 */
  axisV1: { pos: Vec2; angle: number };
  unfoldH: number;
  unfoldV1: number;
  /** 当前步是否显示 V₁/OX₁ */
  showV1: boolean;
  layers: VisLayers;
  chapter: number;
  step: number;
  setPoint: (k: PtKey, p: Vec3) => void;
  setAxisPos: (p: Vec2) => void;
  setAxisAngle: (a: number) => void;
  setUnfoldH: (t: number) => void;
  setUnfoldV1: (t: number) => void;
  toggleLayer: (k: keyof VisLayers) => void;
  setChapter: (id: number) => void;
  setStep: (i: number) => void;
  /** 把拖动过的几何恢复为本章预设(保留当前步) */
  resetGeometry: () => void;
  /** ch1 面板按钮:把 CD 摆成与 AB 真相交(交于 AB 中点) */
  presetTrueIntersection: () => void;
  /** ch3 面板按钮:把 △DEF 摆成与 △ABC 平行(边方向取 ABC 的两边,0.8 倍) */
  presetParallelPlanes: () => void;
}

const initPoints = presetPoints(0);

export const useVisStore = create<State>((set, get) => ({
  points: initPoints,
  axisV1: defaultAxis(0, initPoints),
  unfoldH: 1,
  unfoldV1: 0,
  showV1: false,
  layers: { ...DEFAULT_LAYERS },
  chapter: 0,
  step: 0,
  setPoint: (k, p) => set((s) => ({ points: { ...s.points, [k]: p } })),
  setAxisPos: (p) => set((s) => ({ axisV1: { ...s.axisV1, pos: p } })),
  setAxisAngle: (a) => set((s) => ({ axisV1: { ...s.axisV1, angle: a } })),
  setUnfoldH: (t) => set({ unfoldH: clamp01(t) }),
  setUnfoldV1: (t) => set({ unfoldV1: clamp01(t) }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setChapter: (id) => {
    const s = get();
    const flow = VIS_FLOWS[id];
    if (!flow) return;
    const points = presetPoints(id);
    set({
      chapter: id,
      step: 0,
      points,
      axisV1: defaultAxis(id, points),
      ...applyTargets(s, flow.targets[0] ?? {}),
    });
  },
  setStep: (i) =>
    set((s) => {
      const flow = VIS_FLOWS[s.chapter];
      const n = Math.min(flow ? flow.steps.length - 1 : 0, Math.max(0, i));
      const t = flow?.targets[n] ?? {};
      return { step: n, ...applyTargets(s, t) };
    }),
  resetGeometry: () =>
    set((s) => {
      const points = presetPoints(s.chapter);
      return { points, axisV1: defaultAxis(s.chapter, points) };
    }),
  presetTrueIntersection: () =>
    set((s) => {
      const { A, B, C } = s.points;
      if (!A || !B || !C) return {};
      const P: Vec3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
      const D: Vec3 = [2 * P[0] - C[0], 2 * P[1] - C[1], 2 * P[2] - C[2]];
      return { points: { ...s.points, D } };
    }),
  presetParallelPlanes: () =>
    set((s) => {
      const { A, B, C, D } = s.points;
      if (!A || !B || !C || !D) return {};
      const K = 0.8;
      const E: Vec3 = [D[0] + K * (B[0] - A[0]), D[1] + K * (B[1] - A[1]), D[2] + K * (B[2] - A[2])];
      const F: Vec3 = [D[0] + K * (C[0] - A[0]), D[1] + K * (C[1] - A[1]), D[2] + K * (C[2] - A[2])];
      return { points: { ...s.points, E, F } };
    }),
}));

/** 首屏从 URL 恢复章节/步骤:必须在模块初始化时执行(先于视图的 URL 回写) */
if (typeof window !== 'undefined') {
  const q = new URLSearchParams(window.location.search);
  if (q.get('topic') === 'visibility' && q.get('ch') !== null) {
    const ch = Number(q.get('ch'));
    if (Number.isInteger(ch) && VIS_FLOWS[ch]) {
      useVisStore.getState().setChapter(ch);
      const step = Math.max(0, Number(q.get('step')) || 0);
      if (step > 0) useVisStore.getState().setStep(step);
    }
  }
}

/** 当前章节下的投影面链:V → H(→ 可选 V₁) */
export function visPlaneDefs(
  axisV1: { pos: Vec2; angle: number },
  showV1: boolean,
): PlaneDef[] {
  const defs: PlaneDef[] = [
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
  ];
  if (showV1) {
    defs.push({
      id: 'V1',
      parentId: 'H',
      name: 'V\u2081',
      axisLabel: 'OX\u2081',
      axisPos: axisV1.pos,
      axisDir: norm2([Math.cos(axisV1.angle), Math.sin(axisV1.angle)]),
      side: -1,
      color: '#f59e0b',
    });
  }
  return defs;
}
