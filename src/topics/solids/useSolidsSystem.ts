import { useSyncExternalStore } from 'react';
import { buildSystem, type System } from '../../lib/engine';
import { activeBuilt } from './active';
import { useSolidsStore } from './store';
import { solidPlaneDefs, solidX0 } from './views';

/**
 * 立体截切主题的投影系统:与可见性主题同构——模块级单 rAF 补间 + 单份 buildSystem 缓存。
 * store 中 unfoldH/unfoldW 是目标值;H/W 是 V 的子面,两个视图各自绕轴展开。
 */

const SPEED = 2.8;

interface Unfold {
  H: number;
  W: number;
}

const listeners = new Set<() => void>();

function targets(): Unfold {
  const s = useSolidsStore.getState();
  return { H: s.unfoldH, W: s.unfoldW };
}

const cur: Unfold = targets();
let curSnap: Unfold = { ...cur };

function build(): System {
  const s = useSolidsStore.getState();
  const mesh = activeBuilt(s.chapter, s.problemId).mesh;
  const x0 = solidX0(mesh);
  return buildSystem(solidPlaneDefs(x0), (id) => (id === 'H' ? cur.H : id === 'W' ? cur.W : 0));
}

let sys: System = build();

function emit() {
  curSnap = { ...cur };
  for (const l of [...listeners]) l();
}

let raf = 0;
let lastTime = 0;

function tick(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const t = targets();
  let moving = false;
  for (const k of ['H', 'W'] as const) {
    const d = t[k] - cur[k];
    if (Math.abs(d) < 1e-3) {
      cur[k] = t[k];
      continue;
    }
    cur[k] = Math.min(1, Math.max(0, cur[k] + d * Math.min(1, SPEED * dt)));
    moving = true;
  }
  sys = build();
  emit();
  if (moving) raf = requestAnimationFrame(tick);
}

function syncAnimation() {
  const t = targets();
  const settled = t.H === cur.H && t.W === cur.W;
  if (!settled && !raf) {
    lastTime = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

useSolidsStore.subscribe((s, prev) => {
  const inputChanged =
    s.chapter !== prev.chapter || s.problemId !== prev.problemId;
  if (inputChanged) {
    sys = build();
    emit();
  }
  syncAnimation();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => sys;
const getUnfold = () => curSnap;

/** 共享的三面投影系统(含展开补间动画) */
export function useSolidsSystem(): System {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 当前展开进度(0=折成三面,1=摊平为纸面) */
export function useSolidsUnfold(): Unfold {
  return useSyncExternalStore(subscribe, getUnfold, getUnfold);
}
