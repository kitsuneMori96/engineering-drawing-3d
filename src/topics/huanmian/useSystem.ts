import { useSyncExternalStore } from 'react';
import { planeDefs, useStore } from './store';
import { buildSystem, computeAxisH2, type PlaneDef, type System } from '../../lib/engine';

/**
 * 投影系统的唯一来源:模块级单 rAF 补间 + 单份 buildSystem 缓存。
 * store 中的 unfoldH/unfoldV1/unfoldH2 是"目标值"(讲解步骤/滑杆直接写),
 * 这里补间到当前值并重建系统,2D 纸面与 3D 场景订阅同一份快照——
 * 既消除每组件重复计算,也保证两视图展开动画严格同步。
 */

const SPEED = 2.6;

interface Unfold {
  H: number;
  V1: number;
  H2: number;
}

const listeners = new Set<() => void>();

function targets(): Unfold {
  const s = useStore.getState();
  return { H: s.unfoldH, V1: s.unfoldV1, H2: s.unfoldH2 };
}

const cur: Unfold = targets();

function build(): System {
  const s = useStore.getState();
  const defs = planeDefs(s.axisV1);
  const unfoldOf = (id: string) =>
    id === 'H' ? cur.H : id === 'V1' ? cur.V1 : id === 'H2' ? cur.H2 : 0;
  if (!s.showAxis2) return buildSystem(defs, unfoldOf);
  const base = buildSystem(defs, unfoldOf);
  const { pos, dir } = computeAxisH2(
    base,
    s.points.A,
    s.points.B,
    s.axisH2Offset,
    s.axisH2Mode,
  );
  const h2def: PlaneDef = {
    id: 'H2',
    parentId: 'V1',
    name: 'H\u2082',
    axisLabel: 'OX\u2082',
    axisPos: pos,
    axisDir: dir,
    side: -1,
    color: '#8b5cf6',
  };
  return buildSystem([...defs, h2def], unfoldOf);
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
  for (const k of ['H', 'V1', 'H2'] as const) {
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
  const settled = t.H === cur.H && t.V1 === cur.V1 && t.H2 === cur.H2;
  if (!settled && !raf) {
    lastTime = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

useStore.subscribe((s, prev) => {
  const inputChanged =
    s.points !== prev.points ||
    s.axisV1 !== prev.axisV1 ||
    s.axisH2Offset !== prev.axisH2Offset ||
    s.axisH2Mode !== prev.axisH2Mode ||
    s.showAxis2 !== prev.showAxis2;
  if (inputChanged) {
    sys = build();
    emit();
  }
  // unfold 目标值(讲解步骤/滑杆)变化时启动补间循环
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
export function useSystem(): System {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
