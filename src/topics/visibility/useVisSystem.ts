import { useSyncExternalStore } from 'react';
import { buildSystem, type System } from '../../lib/engine';
import { useVisStore, visPlaneDefs } from './store';

/**
 * 可见性主题的投影系统:模块级单 rAF 补间 + 单份 buildSystem 缓存。
 * store 中 unfoldH/unfoldV1 是"目标值",这里补间到当前值并重建系统,
 * 2D 纸面与 3D 场景订阅同一份快照,两视图展开动画严格同步。
 * (不复用换面法 useSystem:那个与换面法 store 硬耦合。)
 */

const SPEED = 2.6;

interface Unfold {
  H: number;
  V1: number;
}

const listeners = new Set<() => void>();

function targets(): Unfold {
  const s = useVisStore.getState();
  return { H: s.unfoldH, V1: s.showV1 ? s.unfoldV1 : 0 };
}

const cur: Unfold = targets();

function build(): System {
  const s = useVisStore.getState();
  const defs = visPlaneDefs(s.axisV1, s.showV1);
  const unfoldOf = (id: string) => (id === 'H' ? cur.H : id === 'V1' ? cur.V1 : 0);
  return buildSystem(defs, unfoldOf);
}

let sys: System = build();

function emit() {
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
  for (const k of ['H', 'V1'] as const) {
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
  const settled = t.H === cur.H && t.V1 === cur.V1;
  if (!settled && !raf) {
    lastTime = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

useVisStore.subscribe((s, prev) => {
  const inputChanged =
    s.points !== prev.points ||
    s.axisV1 !== prev.axisV1 ||
    s.showV1 !== prev.showV1 ||
    s.chapter !== prev.chapter;
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

/** 共享的投影系统(含展开补间动画) */
export function useVisSystem(): System {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
