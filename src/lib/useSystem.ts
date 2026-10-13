import { useMemo } from 'react';
import { planeDefs, useStore } from '../store';
import { buildSystem, computeAxisH2, type PlaneDef, type System } from './engine';
import { useTween } from './useTween';

/**
 * 展开动画:store 里的 unfoldH/unfoldV1/unfoldH2 是"目标值"(讲解步骤直接写),
 * 这里把它们补间到当前值,交给渲染 → 翻页/换步时自动平滑展开。
 *
 * H₂ 面(showAxis2)存在时:先用三面系统求出 OX₂ 轴(它依赖 a₁b₁ 方向),
 * 再构建含 H₂ 的完整投影链。
 */
export function useSystem(animate = true): System {
  const axisV1 = useStore((s) => s.axisV1);
  const unfoldH = useStore((s) => s.unfoldH);
  const unfoldV1 = useStore((s) => s.unfoldV1);
  const unfoldH2 = useStore((s) => s.unfoldH2);
  const showAxis2 = useStore((s) => s.showAxis2);
  const axisH2Offset = useStore((s) => s.axisH2Offset);
  const axisH2Mode = useStore((s) => s.axisH2Mode);
  const points = useStore((s) => s.points);

  const tweenH = useTween(unfoldH, 2.6, animate);
  const tweenV1 = useTween(unfoldV1, 2.6, animate);
  const tweenH2 = useTween(unfoldH2, 2.6, animate);

  const defs = useMemo(() => planeDefs(axisV1), [axisV1]);
  const unfoldOf = useMemo(
    () => (id: string) =>
      id === 'H' ? tweenH : id === 'V1' ? tweenV1 : id === 'H2' ? tweenH2 : 0,
    [tweenH, tweenV1, tweenH2],
  );

  return useMemo(() => {
    if (!showAxis2) return buildSystem(defs, unfoldOf);
    const base = buildSystem(defs, unfoldOf);
    const { pos, dir } = computeAxisH2(base, points.A, points.B, axisH2Offset, axisH2Mode);
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
  }, [defs, unfoldOf, showAxis2, axisH2Offset, axisH2Mode, points]);
}
