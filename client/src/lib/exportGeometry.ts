// ============================================================
// exportGeometry — shared safe measurement for map exports
// Design: Dark Scholarly Codex exports must preserve every visible
// character box, concentric circle outline, group label, and connector.
// ============================================================
import type { AnnotationLayer, BookData, Character, Group } from './types';
import { getAnnotationSize } from './annotationStyles';

export const EXPORT_NODE_HEIGHT = 36;
export const CIRCLE_BASE_PADDING = 28;

export interface ExportRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ExportBounds extends ExportRect {
  width: number;
  height: number;
}

/** Keep this in sync with CharacterNode's compact-width calculation. */
export function calcExportNodeWidth(name: string, title?: string): number {
  const nameChars = name.length;
  const titleChars = title ? title.length + 2 : 0;
  const contentChars = Math.max(nameChars, titleChars);
  return Math.min(Math.max(contentChars * 8 + 28, 120), 220);
}

export function getCircleRankMap(book: BookData, circleGroupOrder: string[] = []): Map<string, number> {
  const circleIds = book.groups.filter(group => group.groupType === 'circle').map(group => group.id);
  const orderedIds = [
    ...circleGroupOrder.filter(id => circleIds.includes(id)),
    ...circleIds.filter(id => !circleGroupOrder.includes(id)),
  ];
  return new Map(orderedIds.map((id, rank) => [id, rank]));
}

export function getVisibleCircleRect(
  group: Group,
  visibleCharacters: Character[],
  charWidths: Map<string, number>,
  circleRanks: Map<string, number>,
  circleOverlapStep: number,
): ExportRect | null {
  const members = visibleCharacters.filter(character => character.groupIds?.includes(group.id));
  if (members.length === 0) return null;

  const rank = circleRanks.get(group.id) ?? 0;
  const padding = CIRCLE_BASE_PADDING + rank * circleOverlapStep;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const member of members) {
    const width = charWidths.get(member.id) ?? 140;
    minX = Math.min(minX, member.x - padding);
    minY = Math.min(minY, member.y - padding);
    maxX = Math.max(maxX, member.x + width + padding);
    maxY = Math.max(maxY, member.y + EXPORT_NODE_HEIGHT + padding);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Measures all visible map content in world coordinates. The guard includes
 * relationship label pills, arrowheads, and Bezier control-point overhangs.
 */
export function calculateExportBounds(
  book: BookData,
  visibleCharacterIds: Set<string>,
  hiddenCircleGroupIds: Set<string> | undefined,
  circleOverlapStep: number,
  circleGroupOrder: string[] = [],
  includeLabels = true,
  includeAnnotations = true,
  visibleAnnotationLayers?: AnnotationLayer[],
): ExportBounds {
  const visibleCharacters = book.characters.filter(character => visibleCharacterIds.has(character.id));
  const charWidths = new Map<string, number>();
  for (const character of visibleCharacters) {
    charWidths.set(character.id, calcExportNodeWidth(character.name, character.title));
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const character of visibleCharacters) {
    const width = charWidths.get(character.id) ?? 140;
    minX = Math.min(minX, character.x);
    minY = Math.min(minY, character.y);
    maxX = Math.max(maxX, character.x + width);
    maxY = Math.max(maxY, character.y + EXPORT_NODE_HEIGHT);
  }

  const circleRanks = getCircleRankMap(book, circleGroupOrder);
  for (const group of book.groups) {
    if (group.groupType !== 'circle' || hiddenCircleGroupIds?.has(group.id)) continue;
    const rect = getVisibleCircleRect(group, visibleCharacters, charWidths, circleRanks, circleOverlapStep);
    if (!rect) continue;

    // Circle labels sit across the top edge and need a little clearance.
    minX = Math.min(minX, rect.minX - 3);
    minY = Math.min(minY, rect.minY - 14);
    maxX = Math.max(maxX, rect.maxX + 3);
    maxY = Math.max(maxY, rect.maxY + 3);
  }

  // Free notes always belong to the export. Linked notes are retained when
  // their character is in the selected export scope.
  for (const annotation of includeAnnotations ? (book.annotations ?? []) : []) {
    if (visibleAnnotationLayers && !annotation.pinToMap && !visibleAnnotationLayers.includes(annotation.layer ?? 'canvas')) continue;
    const anchor = annotation.characterId ? book.characters.find(character => character.id === annotation.characterId) : undefined;
    if (annotation.characterId && (!anchor || !visibleCharacterIds.has(anchor.id))) continue;
    const size = getAnnotationSize(annotation);
    const width = annotation.sizePreset ? size.width : (annotation.width ?? size.width);
    const lineCapacity = Math.max(18, Math.floor(width / Math.max(5, size.fontSize * 0.62)));
    const lineCount = Math.max(1, Math.ceil((annotation.text?.length ?? 0) / lineCapacity));
    const height = 22 + lineCount * (size.fontSize * 1.45) + size.padding * 2;
    const x = (anchor?.x ?? 0) + annotation.x;
    const y = (anchor?.y ?? 0) + annotation.y;
    minX = Math.min(minX, x - 8);
    minY = Math.min(minY, y - 8);
    maxX = Math.max(maxX, x + width + 8);
    maxY = Math.max(maxY, y + height + 8);
  }

  // All connectors are bounded by their endpoints except Bezier handles and
  // label pills. A uniform guard is deliberately generous to prevent cropping.
  const connectorGuard = includeLabels ? 56 : 28;
  minX -= connectorGuard;
  minY -= connectorGuard;
  maxX += connectorGuard;
  maxY += connectorGuard;

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
