import { create } from 'zustand';
import type { Vec3 } from '../../lib/math';
import type { ViewId } from './hlr';
import {
  DEFAULT_SOLID_LAYERS,
  SOLID_FLOWS,
  solidFlowOf,
  type SolidLayers,
  type SolidStepTarget,
} from './chapters';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export interface SurfacePoint {
  /** 在哪个视图上取点(拖拽时沿用该视图) */
  view: ViewId;
  /** 所属面组:拖拽时把点限制在同一面上 */
  group: string;
  point: Vec3;
}

function applyTargets(s: { layers: SolidLayers }, t: SolidStepTarget) {
  return {
    ...(t.unfoldH !== undefined ? { unfoldH: clamp01(t.unfoldH) } : null),
    ...(t.unfoldW !== undefined ? { unfoldW: clamp01(t.unfoldW) } : null),
    ...(t.reveal !== undefined ? { reveal: Math.round(t.reveal) } : null),
    ...(t.layers ? { layers: { ...s.layers, ...t.layers } } : null),
  };
}

interface State {
  chapter: number;
  step: number;
  /** 例题册当前题号 1–10 */
  problemId: number;
  unfoldH: number;
  unfoldW: number;
  layers: SolidLayers;
  /** 缺图补画进度 0–4 */
  reveal: number;
  showSolid3D: boolean;
  probe: SurfacePoint | null;
  setChapter: (id: number) => void;
  setStep: (i: number) => void;
  setProblem: (id: number) => void;
  setUnfoldH: (t: number) => void;
  setUnfoldW: (t: number) => void;
  toggleLayer: (k: keyof SolidLayers) => void;
  setReveal: (n: number) => void;
  bumpReveal: () => void;
  setShowSolid3D: (b: boolean) => void;
  setProbe: (p: SurfacePoint | null) => void;
}

const t0 = solidFlowOf(0).targets[0] ?? {};

export const useSolidsStore = create<State>((set) => ({
  chapter: 0,
  step: 0,
  problemId: 1,
  unfoldH: t0.unfoldH ?? 1,
  unfoldW: t0.unfoldW ?? 1,
  layers: { ...DEFAULT_SOLID_LAYERS, ...(t0.layers ?? {}) },
  reveal: t0.reveal ?? 0,
  showSolid3D: true,
  probe: null,
  setChapter: (id) => {
    const flow = SOLID_FLOWS[id];
    if (!flow) return;
    const base = { ...DEFAULT_SOLID_LAYERS };
    const layerTarget = flow.targets[0]?.layers ?? {};
    const layers = { ...base, ...layerTarget };
    const t = flow.targets[0] ?? {};
    set({
      chapter: id,
      step: 0,
      layers,
      unfoldH: t.unfoldH ?? 1,
      unfoldW: t.unfoldW ?? 1,
      reveal: t.reveal ?? 4,
      probe: null,
      showSolid3D: true,
    });
  },
  setStep: (i) =>
    set((s) => {
      const flow = SOLID_FLOWS[s.chapter];
      const n = Math.min(flow ? flow.steps.length - 1 : 0, Math.max(0, i));
      const t = flow?.targets[n] ?? {};
      return { step: n, ...applyTargets(s, t) };
    }),
  setProblem: (id) =>
    set({
      problemId: id,
      reveal: 0,
      probe: null,
      unfoldH: 1,
      unfoldW: 1,
    }),
  setUnfoldH: (t) => set({ unfoldH: clamp01(t) }),
  setUnfoldW: (t) => set({ unfoldW: clamp01(t) }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setReveal: (n) => set({ reveal: Math.min(4, Math.max(0, Math.round(n))) }),
  bumpReveal: () => set((s) => ({ reveal: Math.min(4, s.reveal + 1) })),
  setShowSolid3D: (b) => set({ showSolid3D: b }),
  setProbe: (p) => set({ probe: p }),
}));

/** 首屏从 URL 恢复章节/步骤/题号(先于视图的 URL 回写) */
if (typeof window !== 'undefined') {
  const q = new URLSearchParams(window.location.search);
  if (q.get('topic') === 'solids' && q.get('ch') !== null) {
    const ch = Number(q.get('ch'));
    if (Number.isInteger(ch) && SOLID_FLOWS[ch]) {
      const s = useSolidsStore.getState();
      s.setChapter(ch);
      const step = Math.max(0, Number(q.get('step')) || 0);
      if (step > 0) s.setStep(step);
      const problem = Number(q.get('problem'));
      if (Number.isInteger(problem) && problem >= 1 && problem <= 10) s.setProblem(problem);
    }
  }
}

export { DEFAULT_SOLID_LAYERS };
export type { SolidLayers };
export const getSolidsState = useSolidsStore.getState;
