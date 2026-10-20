// ============================================================
// annotationStyles — shared Scholarly Codex annotation presets
// ============================================================
import type { CanvasAnnotation } from './types';

export const ANNOTATION_PRESETS = {
  gold: { label: 'Context', accent: '#c9a84c', fill: '#2a2414', text: '#f2e7c9' },
  blue: { label: 'Scene', accent: '#4cb8c9', fill: '#132831', text: '#d2f1f4' },
  rose: { label: 'Conflict', accent: '#e05c8a', fill: '#321625', text: '#ffd9e6' },
  sage: { label: 'Theme', accent: '#6ec98b', fill: '#183023', text: '#d8f2df' },
} as const;

export const ANNOTATION_SIZES = {
  small: { label: 'S', width: 150, fontSize: 10, padding: 7 },
  medium: { label: 'M', width: 190, fontSize: 12, padding: 9 },
  large: { label: 'L', width: 250, fontSize: 14, padding: 11 },
} as const;

export function getAnnotationPreset(annotation: CanvasAnnotation) {
  return ANNOTATION_PRESETS[annotation.colorPreset ?? 'gold'];
}

export function getAnnotationSize(annotation: CanvasAnnotation) {
  return ANNOTATION_SIZES[annotation.sizePreset ?? 'medium'];
}
