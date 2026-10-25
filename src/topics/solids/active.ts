import type { ViewId } from './hlr';
import { problemById, problemSolid, teachSolid, type Built } from './problems';

/** 当前章节用哪个立体:0/1 章教学简例,2/3 章用例题 2,例题册用所选题 */
export type SolidSource = { kind: 'teach'; id: number } | { kind: 'problem'; id: number };

export function activeSource(chapter: number, problemId: number): SolidSource {
  if (chapter === 0) return { kind: 'teach', id: 0 };
  if (chapter === 1) return { kind: 'teach', id: 1 };
  if (chapter === 2 || chapter === 3) return { kind: 'problem', id: 2 };
  return { kind: 'problem', id: problemId };
}

export function activeBuilt(chapter: number, problemId: number): Built {
  const s = activeSource(chapter, problemId);
  return s.kind === 'teach' ? teachSolid(s.id) : problemSolid(s.id);
}

export interface ViewPlan {
  /** null = 三视图都是已知条件,不需要补图 */
  given: ViewId[] | null;
  missing: ViewId | null;
  pickable: boolean;
}

export function viewPlan(chapter: number, problemId: number): ViewPlan {
  if (chapter <= 1) return { given: null, missing: null, pickable: false };
  if (chapter === 2) return { given: ['V', 'H'], missing: 'W', pickable: false };
  if (chapter === 3) return { given: ['V', 'H'], missing: 'W', pickable: true };
  const p = problemById(problemId);
  return { given: p.given, missing: p.missing, pickable: true };
}
