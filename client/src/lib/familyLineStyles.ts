// ============================================================
// familyLineStyles — visual conventions for non-biological family ties
// Adoption/foster: short dashes. Step-parent/step-family: dash-dot.
// Biological family relationships remain solid by default.
// ============================================================
export type FamilyLineConvention = 'biological' | 'adoption' | 'step-parent';

export function getFamilyLineConvention(type: string, label?: string, notes?: string): FamilyLineConvention {
  const text = `${label ?? ''} ${notes ?? ''}`.toLowerCase();
  if (/\badopt|\bfoster/.test(text)) return 'adoption';
  if (type === 'step-family' || /\bstep[- ]?(parent|mother|father|child|son|daughter|sibling)/.test(text)) return 'step-parent';
  return 'biological';
}

export function getFamilySvgDashArray(type: string, label?: string, notes?: string): string | undefined {
  const convention = getFamilyLineConvention(type, label, notes);
  if (convention === 'adoption') return '4 4';
  if (convention === 'step-parent') return '10 4 2 4';
  return undefined;
}

export function getFamilyCanvasDashArray(type: string, label?: string, notes?: string): number[] {
  const convention = getFamilyLineConvention(type, label, notes);
  if (convention === 'adoption') return [4, 4];
  if (convention === 'step-parent') return [10, 4, 2, 4];
  return [];
}
