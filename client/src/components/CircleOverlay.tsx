// ============================================================
// CircleOverlay — SVG outline drawn around Circle group members
// Design: Dark Scholarly Codex
//
// Features:
//  • Skips circles that are toggled hidden via hiddenCircleGroupIds
//  • Detects overlapping circles and offsets each outline concentrically
//    so borders don't stack on top of each other — each overlapping
//    group gets an additional outward expansion step (OVERLAP_STEP px)
//  • Uses ReactFlow's viewport transform to stay in sync with pan/zoom
// ============================================================
import { useMemo } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useBook } from '@/contexts/BookContext';
import { calcNodeWidth } from './CharacterNode';

const NODE_H = 36;
const BASE_PADDING = 28;   // base space around the bounding box
const CORNER_R = 18;       // border-radius of the outline

interface BBox {
  minX: number; minY: number; maxX: number; maxY: number;
}

/** Axis-aligned bounding box intersection test */
function bboxOverlaps(a: BBox, b: BBox): boolean {
  return a.minX < b.maxX && a.maxX > b.minX &&
         a.minY < b.maxY && a.maxY > b.minY;
}

interface CircleOutlineProps {
  groupName: string;
  groupColor: string;
  memberIds: string[];
  isFocused: boolean;
  /** Extra outward padding added for concentric stacking (world-space px) */
  extraPadding: number;
  /** Per-group fill opacity override (0–1). Defaults to 0.04 / 0.08 when focused. */
  fillOpacity?: number;
  /** Border stroke style for this circle group */
  strokeStyle?: 'dashed' | 'solid' | 'dotted';
}

function CircleOutline({ groupName, groupColor, memberIds, isFocused, extraPadding, fillOpacity: fillOpacityProp, strokeStyle }: CircleOutlineProps) {
  const { book } = useBook();
  const { x: vpX, y: vpY, zoom } = useViewport();

  const padding = BASE_PADDING + extraPadding;

  // Compute bounding box in world coordinates
  const bbox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of memberIds) {
      const c = book.characters.find(ch => ch.id === id);
      if (!c) continue;
      const w = calcNodeWidth(c.name, c.title);
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + w);
      maxY = Math.max(maxY, c.y + NODE_H);
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }, [memberIds, book.characters]);

  if (!bbox) return null;

  // Convert world coords → screen coords using the current viewport transform
  const sx = (bbox.minX - padding) * zoom + vpX;
  const sy = (bbox.minY - padding) * zoom + vpY;
  const sw = (bbox.maxX - bbox.minX + padding * 2) * zoom;
  const sh = (bbox.maxY - bbox.minY + padding * 2) * zoom;
  const r = CORNER_R * zoom;

  // Label position — top-left of the outline
  const labelX = sx + r;
  const labelY = sy - 6 * zoom;
  const fontSize = Math.max(9, Math.min(14, 12 * zoom));

  return (
    <g>
      {/* Fill — very subtle */}
      <rect
        x={sx} y={sy} width={sw} height={sh} rx={r} ry={r}
        fill={groupColor}
        fillOpacity={fillOpacityProp !== undefined ? fillOpacityProp : (isFocused ? 0.08 : 0.04)}
        stroke={groupColor}
        strokeWidth={isFocused ? 2.5 * zoom : 1.5 * zoom}
        strokeOpacity={isFocused ? 0.9 : 0.55}
        strokeDasharray={isFocused ? 'none' : (
          strokeStyle === 'solid' ? 'none' :
          strokeStyle === 'dotted' ? `${2 * zoom} ${4 * zoom}` :
          `${6 * zoom} ${3 * zoom}` // default: dashed
        )}
        style={{ transition: 'stroke-opacity 300ms, fill-opacity 300ms' }}
      />
      {/* Label pill */}
      <rect
        x={labelX - 5 * zoom}
        y={labelY - fontSize - 3 * zoom}
        width={(groupName.length * fontSize * 0.6 + 12) * zoom}
        height={(fontSize + 6) * zoom}
        rx={4 * zoom}
        fill={groupColor}
        fillOpacity={0.85}
      />
      <text
        x={labelX}
        y={labelY - 4 * zoom}
        fontSize={fontSize}
        fontFamily="'DM Sans', sans-serif"
        fontWeight={700}
        fill="#0f1117"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {groupName}
      </text>
    </g>
  );
}

export function CircleOverlay() {
  const {
    book,
    focusCircleGroupId,
    spotlightGroupIds,
    hiddenCharacterIds,
    hiddenCircleGroupIds,
    circleOverlapStep,
    circleGroupOrder,
  } = useBook();
  const { getViewport } = useReactFlow();
  void getViewport; // keep import used

  // Compute visible character IDs (mirrors GraphCanvas logic)
  const visibleIds = useMemo(() => {
    return new Set(
      book.characters
        .filter(c => {
          if (hiddenCharacterIds.has(c.id)) return false;
          if (spotlightGroupIds.size > 0) {
            const inSpotlight = c.groupIds && c.groupIds.some(gid => spotlightGroupIds.has(gid));
            if (!inSpotlight) return false;
          }
          return true;
        })
        .map(c => c.id)
    );
  }, [book.characters, hiddenCharacterIds, spotlightGroupIds]);

  // All circle-type groups that are not hidden
  const visibleCircleGroups = useMemo(
    () => book.groups.filter(g => g.groupType === 'circle' && !hiddenCircleGroupIds.has(g.id)),
    [book.groups, hiddenCircleGroupIds]
  );

  // Compute the base bounding box for each visible circle group
  const groupBBoxes = useMemo<Map<string, BBox>>(() => {
    const map = new Map<string, BBox>();
    for (const group of visibleCircleGroups) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of book.characters) {
        if (!c.groupIds?.includes(group.id)) continue;
        if (!visibleIds.has(c.id)) continue;
        const w = calcNodeWidth(c.name, c.title);
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + w);
        maxY = Math.max(maxY, c.y + NODE_H);
      }
      if (isFinite(minX)) {
        map.set(group.id, { minX, minY, maxX, maxY });
      }
    }
    return map;
  }, [visibleCircleGroups, book.characters, visibleIds]);

  // Assign concentric rank from user-defined order.
  // circleGroupOrder[0] = innermost (rank 0), circleGroupOrder[1] = rank 1, etc.
  // Groups not yet in the order list fall back to their position in book.groups.
  const overlapRanks = useMemo<Map<string, number>>(() => {
    const ranks = new Map<string, number>();
    // Build a complete ordered list: user-ordered IDs first, then any unordered circle groups
    const allCircleIds = book.groups
      .filter(g => g.groupType === 'circle')
      .map(g => g.id);
    const ordered = [
      ...circleGroupOrder.filter(id => allCircleIds.includes(id)),
      ...allCircleIds.filter(id => !circleGroupOrder.includes(id)),
    ];
    ordered.forEach((id, index) => ranks.set(id, index));
    return ranks;
  }, [book.groups, circleGroupOrder]);

  if (visibleCircleGroups.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1, // below nodes (z-index 2+) but above the background
      }}
    >
      {visibleCircleGroups.map(group => {
        const memberIds = book.characters
          .filter(c => c.groupIds?.includes(group.id) && visibleIds.has(c.id))
          .map(c => c.id);
        if (memberIds.length === 0) return null;
        const isFocused = focusCircleGroupId === group.id;
        const rank = overlapRanks.get(group.id) ?? 0;
        const extraPadding = rank * circleOverlapStep;
        return (
          <CircleOutline
            key={group.id}
            groupName={group.name}
            groupColor={group.color}
            memberIds={memberIds}
            isFocused={isFocused}
            extraPadding={extraPadding}
            fillOpacity={group.fillOpacity}
            strokeStyle={group.strokeStyle}
          />
        );
      })}
    </svg>
  );
}
