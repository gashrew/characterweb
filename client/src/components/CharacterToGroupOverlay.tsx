// ============================================================
// CharacterToGroupOverlay — SVG overlay for character-to-circle
// group relationships. Draws a line from the character's nearest
// face midpoint to the nearest point on the circle boundary rect.
//
// Uses useNodes() to read LIVE node positions during drags so
// the lines track correctly while a character is being moved.
// Design: Dark Scholarly Codex
// ============================================================
import { useMemo, useState } from 'react';
import { useViewport, useNodes, useReactFlow } from '@xyflow/react';
import { useBook } from '@/contexts/BookContext';
import { calcNodeWidth } from './CharacterNode';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import type { GroupRelationship, Character, Group } from '@/lib/types';

const NODE_H = 36;
const CIRCLE_PADDING = 28; // must match CircleOverlay PADDING
const CORNER_R = 18;       // must match CircleOverlay CORNER_R
void CORNER_R;             // suppress unused warning

interface Box { x: number; y: number; w: number; h: number; }
type BoundarySide = 'top' | 'right' | 'bottom' | 'left';

// Get a character's box using live positions where available
function charBoxLive(
  c: Character,
  livePositions: Map<string, { x: number; y: number }>
): Box {
  const live = livePositions.get(c.id);
  return {
    x: live?.x ?? c.x,
    y: live?.y ?? c.y,
    w: calcNodeWidth(c.name, c.title),
    h: NODE_H,
  };
}

// Compute the bounding box (world coords) of a circle group's members
// using live positions so it updates during drags
function circleBBoxLive(
  group: Group,
  characters: Character[],
  livePositions: Map<string, { x: number; y: number }>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const members = characters.filter(c => c.groupIds?.includes(group.id));
  if (members.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of members) {
    const box = charBoxLive(m, livePositions);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + NODE_H);
  }
  return { minX, minY, maxX, maxY };
}

// Find the nearest point on the padded circle boundary rect from a given point
function nearestPointOnRect(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number
): { x: number; y: number; side: BoundarySide } {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const dx = px - cx;
  const dy = py - cy;

  const halfW = rw / 2;
  const halfH = rh / 2;

  if (Math.abs(dx) / halfW > Math.abs(dy) / halfH) {
    const sign = dx > 0 ? 1 : -1;
    const edgeX = cx + sign * halfW;
    const edgeY = cy + dy * (halfW / Math.abs(dx));
    return { x: edgeX, y: Math.max(ry, Math.min(ry + rh, edgeY)), side: sign > 0 ? 'right' : 'left' };
  } else {
    const sign = dy > 0 ? 1 : -1;
    const edgeY = cy + sign * halfH;
    const edgeX = cx + dx * (halfH / Math.abs(dy));
    return { x: Math.max(rx, Math.min(rx + rw, edgeX)), y: edgeY, side: sign > 0 ? 'bottom' : 'top' };
  }
}

function boundaryVector(side: BoundarySide) {
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

// ── Per-relationship renderer ────────────────────────────────

interface CGRelProps {
  rel: GroupRelationship;
  zoom: number;
  vpX: number;
  vpY: number;
  livePositions: Map<string, { x: number; y: number }>;
  characters: Character[];
  groups: Group[];
  showLabels: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<GroupRelationship>) => void;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  arrowheadScale: number;
  /** Extra padding (world px) from concentric stacking — must match CircleOverlay's rank * circleOverlapStep */
  extraPadding: number;
}

function toScreen(wx: number, wy: number, zoom: number, vpX: number, vpY: number) {
  return { x: wx * zoom + vpX, y: wy * zoom + vpY };
}

const WAYPOINT_GRID = 20;
const snapWaypoint = (point: { x: number; y: number }) => ({ x: Math.round(point.x / WAYPOINT_GRID) * WAYPOINT_GRID, y: Math.round(point.y / WAYPOINT_GRID) * WAYPOINT_GRID });

function CGRelShape({ rel, zoom, vpX, vpY, livePositions, characters, groups, showLabels, onDelete, onUpdate, screenToFlowPosition, extraPadding, arrowheadScale }: CGRelProps) {
  const [hovered, setHovered] = useState(false);

  const typeInfo = RELATIONSHIP_TYPES[rel.type];
  const color = typeInfo.color;
  const labelText = rel.label || typeInfo.label;

  const srcChar = characters.find(c => c.id === rel.sourceId);
  const group = groups.find(g => g.id === rel.groupId);
  if (!srcChar || !group) return null;

  const bbox = circleBBoxLive(group, characters, livePositions);
  if (!bbox) return null;

  // Padded rect in world coords — include concentric offset so endpoint matches the visual outline
  const totalPad = CIRCLE_PADDING + extraPadding;
  const rx = bbox.minX - totalPad;
  const ry = bbox.minY - totalPad;
  const rw = bbox.maxX - bbox.minX + totalPad * 2;
  const rh = bbox.maxY - bbox.minY + totalPad * 2;

  const srcB = charBoxLive(srcChar, livePositions);
  const srcCx = srcB.x + srcB.w / 2;
  const srcCy = srcB.y + srcB.h / 2;

  // Nearest point on circle boundary from character center
  const tgtPt = nearestPointOnRect(srcCx, srcCy, rx, ry, rw, rh);

  // Source face attachment: use tgtPt to determine which face
  const dx = tgtPt.x - srcCx;
  const dy = tgtPt.y - srcCy;
  const exitHorizontal = Math.abs(dx) > Math.abs(dy) * 1.3;

  let srcAttachX: number, srcAttachY: number;
  if (exitHorizontal) {
    srcAttachX = dx > 0 ? srcB.x + srcB.w : srcB.x;
    srcAttachY = srcCy;
  } else {
    srcAttachX = srcCx;
    srcAttachY = dy > 0 ? srcB.y + srcB.h : srcB.y;
  }

  // Convert to screen
  const sAttach = toScreen(srcAttachX, srcAttachY, zoom, vpX, vpY);
  const sTgt = toScreen(tgtPt.x, tgtPt.y, zoom, vpX, vpY);
  const targetNormal = boundaryVector(tgtPt.side);
  const targetLead = 16 * zoom;
  const preTarget = { x: sTgt.x + targetNormal.x * targetLead, y: sTgt.y + targetNormal.y * targetLead };

  const lineStyle = rel.lineStyle ?? 'orthogonal';
  const screenPath = (() => {
    const sx = sAttach.x, sy = sAttach.y, tx = sTgt.x, ty = sTgt.y;
    const manualWaypoint = rel.manualWaypoints?.[0];
    if (manualWaypoint) {
      const waypoint = toScreen(manualWaypoint.x, manualWaypoint.y, zoom, vpX, vpY);
      return `M ${sx} ${sy} L ${waypoint.x} ${sy} L ${waypoint.x} ${waypoint.y} L ${preTarget.x} ${waypoint.y} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`;
    }
    const adx = Math.abs(tx - sx);
    const ady = Math.abs(ty - sy);
    if (lineStyle === 'straight') {
      return `M ${sx} ${sy} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`;
    }
    if (lineStyle === 'curved') {
      const tension = Math.max(34 * zoom, Math.min(110 * zoom, Math.hypot(tx - sx, ty - sy) * 0.42));
      const c1x = exitHorizontal ? sx + Math.sign(tx - sx) * tension : sx;
      const c1y = exitHorizontal ? sy : sy + Math.sign(ty - sy) * tension;
      const c2x = tx + targetNormal.x * tension;
      const c2y = ty + targetNormal.y * tension;
      return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
    }
    // orthogonal (default)
    if (ady < 2) return `M ${sx} ${sy} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`;
    if (adx < 2) return `M ${sx} ${sy} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`;
    if (exitHorizontal) {
      const midX = (sx + tx) / 2;
      return targetNormal.x !== 0
        ? `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${preTarget.y} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`
        : `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${preTarget.y} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`;
    } else {
      const midY = (sy + ty) / 2;
      return `M ${sx} ${sy} L ${sx} ${midY} L ${preTarget.x} ${midY} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`;
    }
  })();

  // Label at midpoint of path
  const labelSX = rel.manualWaypoints?.[0] ? toScreen(rel.manualWaypoints[0].x, rel.manualWaypoints[0].y, zoom, vpX, vpY).x : (sAttach.x + sTgt.x) / 2;
  const labelSY = rel.manualWaypoints?.[0] ? toScreen(rel.manualWaypoints[0].x, rel.manualWaypoints[0].y, zoom, vpX, vpY).y - 14 : (sAttach.y + sTgt.y) / 2 - 14;

  const strokeWidth = hovered ? 2.2 : 1.8;
  const opacity = hovered ? 0.95 : 0.78;
  const markerId = `cg-arrow-${rel.type}-${rel.id}`;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'default' }}
    >
      <defs>
        <marker
          id={markerId}
          markerWidth={8 * arrowheadScale} markerHeight={8 * arrowheadScale}
          refX={6 * arrowheadScale} refY={3 * arrowheadScale}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d={`M0,0 L0,${6 * arrowheadScale} L${8 * arrowheadScale},${3 * arrowheadScale} z`} fill={color} fillOpacity={opacity} />
        </marker>
      </defs>

      {/* Hit area */}
      <path d={screenPath} fill="none" stroke="transparent" strokeWidth={14} onPointerDown={(event) => {
        if (!event.shiftKey) return;
        event.preventDefault(); event.stopPropagation();
        onUpdate(rel.id, { manualWaypoints: [snapWaypoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }))] });
      }} />

      {rel.manualWaypoints?.[0] && (() => {
        const point = toScreen(rel.manualWaypoints[0].x, rel.manualWaypoints[0].y, zoom, vpX, vpY);
        return <circle cx={point.x} cy={point.y} r={6} fill="#101628" stroke={color} strokeWidth={2} style={{ pointerEvents: 'all', cursor: 'grab' }} onPointerDown={(event) => {
          event.preventDefault(); event.stopPropagation();
          const move = (moveEvent: PointerEvent) => onUpdate(rel.id, { manualWaypoints: [snapWaypoint(screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY }))] });
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        }} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); onUpdate(rel.id, { manualWaypoints: [] }); }} />;
      })()}

      {/* Visible line */}
      <path
        d={screenPath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeLinejoin="round"
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        style={{ transition: 'stroke-opacity 150ms, stroke-width 150ms', pointerEvents: 'none' }}
      />

      {/* Dot at group boundary attachment */}
      <circle
        cx={sTgt.x} cy={sTgt.y}
        r={3 * zoom}
        fill={color}
        fillOpacity={opacity}
        style={{ pointerEvents: 'none' }}
      />

      {/* Label */}
      {(showLabels || hovered) && (
        <foreignObject
          x={labelSX - 60}
          y={labelSY - 18}
          width={120}
          height={22}
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div
              style={{
                background: '#0d1020e0',
                border: `1px solid ${color}55`,
                color: color,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.02em',
                padding: '2px 8px',
                borderRadius: 4,
                boxShadow: '0 1px 8px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
              }}
            >
              {labelText}
            </div>
          </div>
        </foreignObject>
      )}

      {/* Delete button on hover */}
      {hovered && (
        <g style={{ cursor: 'pointer' }} onClick={() => onDelete(rel.id)}>
          <circle
            cx={(sAttach.x + sTgt.x) / 2 + 12}
            cy={(sAttach.y + sTgt.y) / 2 - 12}
            r={8}
            fill="#1a1f35"
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={(sAttach.x + sTgt.x) / 2 + 12}
            y={(sAttach.y + sTgt.y) / 2 - 8}
            textAnchor="middle"
            fontSize={10}
            fill={color}
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >×</text>
        </g>
      )}
    </g>
  );
}

// ── Main overlay ─────────────────────────────────────────────

export function CharacterToGroupOverlay() {
  const {
    book,
    showRelationshipLabels,
    hiddenCharacterIds,
    spotlightGroupIds,
    focusedCharacterId,
    hiddenRelationshipTypes,
    deleteGroupRelationship,
    updateGroupRelationship,
    arrowheadScale,
    arrowheadTypeScales,
    circleGroupOrder,
    circleOverlapStep,
  } = useBook();
  const { screenToFlowPosition } = useReactFlow();
  const { x: vpX, y: vpY, zoom } = useViewport();

  // Live node positions from React Flow — updated every frame during drags
  const rfNodes = useNodes();
  const livePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of rfNodes) {
      map.set(node.id, { x: node.position.x, y: node.position.y });
    }
    return map;
  }, [rfNodes]);

  const visibleCharIds = useMemo(() => {
    return new Set(
      book.characters
        .filter(c => {
          if (hiddenCharacterIds.has(c.id)) return false;
          if (spotlightGroupIds.size > 0) {
            const inSpotlight = c.groupIds?.some(gid => spotlightGroupIds.has(gid));
            if (!inSpotlight) return false;
          }
          return true;
        })
        .map(c => c.id)
    );
  }, [book.characters, hiddenCharacterIds, spotlightGroupIds]);

  const visibleRels = useMemo(() => {
    return (book.groupRelationships ?? []).filter(rel => {
      if (hiddenRelationshipTypes.has(rel.type)) return false;
      if (!visibleCharIds.has(rel.sourceId)) return false;
      const group = book.groups.find(g => g.id === rel.groupId);
      if (!group || group.groupType !== 'circle') return false;
      if (focusedCharacterId && rel.sourceId !== focusedCharacterId) return false;
      return true;
    });
  }, [book.groupRelationships, book.groups, visibleCharIds, hiddenRelationshipTypes, focusedCharacterId]);

  if (visibleRels.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'visible',
      }}
    >
      {visibleRels.map(rel => {
        // Compute the same concentric rank used by CircleOverlay so endpoint matches the visual outline
        const allCircleIds = book.groups.filter(g => g.groupType === 'circle').map(g => g.id);
        const ordered = [
          ...circleGroupOrder.filter(id => allCircleIds.includes(id)),
          ...allCircleIds.filter(id => !circleGroupOrder.includes(id)),
        ];
        const rank = ordered.indexOf(rel.groupId);
        const extraPadding = rank >= 0 ? rank * circleOverlapStep : 0;
        return (
          <CGRelShape
            key={rel.id}
            rel={rel}
            zoom={zoom}
            vpX={vpX}
            vpY={vpY}
            livePositions={livePositions}
            characters={book.characters}
            groups={book.groups}
            showLabels={showRelationshipLabels}
            onDelete={deleteGroupRelationship}
            onUpdate={updateGroupRelationship}
            screenToFlowPosition={screenToFlowPosition}
            arrowheadScale={arrowheadScale * (arrowheadTypeScales[rel.type] ?? 1)}
            extraPadding={extraPadding}
          />
        );
      })}
    </svg>
  );
}
