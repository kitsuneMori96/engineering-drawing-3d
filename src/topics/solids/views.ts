import type { PlaneDef } from '../../lib/engine';
import type { Vec3 } from '../../lib/math';
import type { TriMesh } from './mesh';
import { meshBounds } from './mesh';
import type { ViewId } from './hlr';

export const VIEW_COLORS: Record<ViewId, string> = {
  V: '#2563eb',
  H: '#059669',
  W: '#b45309',
};

export const VIEW_NAMES: Record<ViewId, string> = {
  V: '主视图(V)',
  H: '俯视图(H)',
  W: '左视图(W)',
};

/** W 轴纸面 x 位置:在实体右边界之外留一点富余 */
export function solidX0(mesh: TriMesh): number {
  const { max } = meshBounds(mesh);
  return Math.max(4.5, max[0] + 2.2);
}

/** V(根)、H、W = 三面体系 */
export function solidPlaneDefs(x0: number): PlaneDef[] {
  return [
    {
      id: 'V',
      parentId: null,
      name: 'V',
      axisLabel: 'OX',
      axisPos: [0, 0],
      axisDir: [1, 0],
      side: -1,
      color: VIEW_COLORS.V,
    },
    {
      id: 'H',
      parentId: 'V',
      name: 'H',
      axisLabel: 'OX',
      axisPos: [0, 0],
      axisDir: [1, 0],
      side: -1,
      color: VIEW_COLORS.H,
    },
    {
      id: 'W',
      parentId: 'V',
      name: 'W',
      axisLabel: 'OZ',
      axisPos: [x0, 0],
      axisDir: [0, 1],
      side: -1,
      color: VIEW_COLORS.W,
    },
  ];
}

export interface SheetBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 纸面布局:V 在左上,H 在左下,W 在右上。
 * 只画三个视图所在的矩形区域,避免投影面互相压住。
 */
export function sheetLayout(mesh: TriMesh, x0: number): Record<ViewId, SheetBox> {
  const { min, max } = meshBounds(mesh);
  const left = Math.min(min[0], 0) - 1.2;
  const right = x0;
  const wDepth = Math.max(max[2] - min[2], 1) + 2.4;
  const hH = Math.max(max[1], 1) + 2.0;
  return {
    V: { x: left, y: 0, w: right - left, h: hH },
    H: { x: left, y: -wDepth, w: right - left, h: wDepth },
    W: { x: x0, y: 0, w: wDepth, h: hH },
  };
}

/** W 轴纸面 x 位置(45° 线交点) */
export const VIEW_ORDER: ViewId[] = ['V', 'H', 'W'];

/** 投影面上点的纸面坐标(与 engine 的 sheetPos 一致) */
export type Projector = (view: ViewId, p: Vec3) => readonly [number, number];
