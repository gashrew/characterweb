// ============================================================
// HubSpokeOverlay — SVG overlay for hub-and-spoke relationships
// One source character → multiple target characters via a
// branching forked line: trunk from hub to junction, then
// individual spokes to each target.
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
import type { HubRelationship, Character } from '@/lib/types';

const NODE_H = 36;

interface Box { x: number; y: number; w: number; h: number; }
type PortSide = 'top' | 'right' | 'bottom' | 'left';

// Compute which face midpoint to use for a single source→target pair
function getFaceMidpoint(src: Box, tgt: Box): { sx: number; sy: number; tx: number; ty: number; targetSide: PortSide } {
  const srcCx = src.x + src.w / 2;
  const srcCy = src.y + src.h / 2;
  const tgtCx = tgt.x + tgt.w / 2;
  const tgtCy = tgt.y + tgt.h / 2;
  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  const exitHorizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
  if (exitHorizontal) {
    if (dx > 0) return { sx: src.x + src.w, sy: srcCy, tx: tgt.x, ty: tgtCy, targetSide: 'left' };
    else         return { sx: src.x,         sy: srcCy, tx: tgt.x + tgt.w, ty: tgtCy, targetSide: 'right' };
  } else {
    if (dy > 0) return { sx: srcCx, sy: src.y + src.h, tx: tgtCx, ty: tgt.y, targetSide: 'top' };
    else        return { sx: srcCx, sy: src.y,          tx: tgtCx, ty: tgt.y + NODE_H, targetSide: 'bottom' };
  }
}

function sideVector(side: PortSide) {
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

// ── Per-hub renderer ─────────────────────────────────────────

interface HubSpokeProps {
  hub: HubRelationship;
  zoom: number;
  vpX: number;
  vpY: number;
  // livePositions: map from character id → {x, y} from React Flow nodes
  livePositions: Map<string, { x: number; y: number }>;
  characters: Character[];
  showLabels: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<HubRelationship>) => void;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  arrowheadScale: number;
}

function toScreen(wx: number, wy: number, zoom: number, vpX: number, vpY: number) {
  return { x: wx * zoom + vpX, y: wy * zoom + vpY };
}

function charBoxLive(c: Character, livePositions: Map<string, { x: number; y: number }>): Box {
  const live = livePositions.get(c.id);
  return {
    x: live?.x ?? c.x,
    y: live?.y ?? c.y,
    w: calcNodeWidth(c.name, c.title),
    h: NODE_H,
  };
}

const WAYPOINT_GRID = 20;
const snapWaypoint = (point: { x: number; y: number }) => ({ x: Math.round(point.x / WAYPOINT_GRID) * WAYPOINT_GRID, y: Math.round(point.y / WAYPOINT_GRID) * WAYPOINT_GRID });

function HubSpokeShape({ hub, zoom, vpX, vpY, livePositions, characters, showLabels, onDelete, onUpdate, screenToFlowPosition, arrowheadScale }: HubSpokeProps) {
  const [hovered, setHovered] = useState(false);

  const typeInfo = RELATIONSHIP_TYPES[hub.type];
  const color = typeInfo.color;
  const labelText = hub.label || typeInfo.label;

  // Gather source and valid targets using live positions
  const srcChar = characters.find(c => c.id === hub.sourceId);
  const tgtChars = hub.targetIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];

  if (!srcChar || tgtChars.length === 0) return null;

  const srcBox = charBoxLive(srcChar, livePositions);

  // For each target, compute the face attachment on the target side.
  const tgtAttachments = tgtChars.map(tc => {
    const tgtBox = charBoxLive(tc, livePositions);
    const fp = getFaceMidpoint(srcBox, tgtBox);
    return { tx: fp.tx, ty: fp.ty, targetSide: fp.targetSide, tgtBox };
  });

  // Determine source attachment: use the average target position to decide face
  const avgTgtX = tgtAttachments.reduce((s, a) => s + a.tx, 0) / tgtAttachments.length;
  const avgTgtY = tgtAttachments.reduce((s, a) => s + a.ty, 0) / tgtAttachments.length;
  const srcCx = srcBox.x + srcBox.w / 2;
  const srcCy = srcBox.y + srcBox.h / 2;
  const dx = avgTgtX - srcCx;
  const dy = avgTgtY - srcCy;
  const exitHorizontal = Math.abs(dx) > Math.abs(dy) * 1.3;

  let srcAttachX: number, srcAttachY: number;
  if (exitHorizontal) {
    srcAttachX = dx > 0 ? srcBox.x + srcBox.w : srcBox.x;
    srcAttachY = srcCy;
  } else {
    srcAttachX = srcCx;
    srcAttachY = dy > 0 ? srcBox.y + srcBox.h : srcBox.y;
  }

  // Junction point: midpoint between source attachment and average target attachment
  const junctionX = hub.manualWaypoints?.[0]?.x ?? (srcAttachX + avgTgtX) / 2;
  const junctionY = hub.manualWaypoints?.[0]?.y ?? (srcAttachY + avgTgtY) / 2;

  // Label position: midpoint of trunk
  const labelWX = exitHorizontal ? (srcAttachX + junctionX) / 2 : srcAttachX;
  const labelWY = exitHorizontal ? srcAttachY - 2 : (srcAttachY + junctionY) / 2 - 2;

  // Convert all to screen space
  const s = (wx: number, wy: number) => toScreen(wx, wy, zoom, vpX, vpY);

  const sAttach = s(srcAttachX, srcAttachY);
  const sJunction = s(junctionX, junctionY);
  const sLabel = s(labelWX, labelWY);

  const ls = hub.lineStyle ?? 'orthogonal';

  // Trunk path
  let trunkScreenPath: string;
  if (ls === 'straight') {
    trunkScreenPath = `M ${sAttach.x} ${sAttach.y} L ${sJunction.x} ${sJunction.y}`;
  } else if (ls === 'curved') {
    const cpx = exitHorizontal ? sJunction.x : sAttach.x;
    const cpy = exitHorizontal ? sAttach.y : sJunction.y;
    trunkScreenPath = `M ${sAttach.x} ${sAttach.y} C ${cpx} ${cpy}, ${cpx} ${cpy}, ${sJunction.x} ${sJunction.y}`;
  } else {
    trunkScreenPath = exitHorizontal
      ? `M ${sAttach.x} ${sAttach.y} L ${sJunction.x} ${sAttach.y} L ${sJunction.x} ${sJunction.y}`
      : `M ${sAttach.x} ${sAttach.y} L ${sAttach.x} ${sJunction.y} L ${sJunction.x} ${sJunction.y}`;
  }

  const spokeScreenPaths = tgtAttachments.map(({ tx, ty, targetSide }) => {
    const sTgt = s(tx, ty);
    const sJ = sJunction;
    const normal = sideVector(targetSide);
    const landingLead = 16 * zoom;
    const preTarget = { x: sTgt.x + normal.x * landingLead, y: sTgt.y + normal.y * landingLead };
    if (ls === 'straight') {
      return `M ${sJ.x} ${sJ.y} L ${preTarget.x} ${preTarget.y} L ${sTgt.x} ${sTgt.y}`;
    } else if (ls === 'curved') {
      const tension = Math.max(34 * zoom, Math.min(110 * zoom, Math.hypot(sTgt.x - sJ.x, sTgt.y - sJ.y) * 0.42));
      const c1x = (sJ.x + preTarget.x) / 2, c1y = (sJ.y + preTarget.y) / 2;
      const c2x = sTgt.x + normal.x * tension, c2y = sTgt.y + normal.y * tension;
      return `M ${sJ.x} ${sJ.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${sTgt.x} ${sTgt.y}`;
    } else {
      const targetHorizontal = normal.x !== 0;
      return targetHorizontal
        ? `M ${sJ.x} ${sJ.y} L ${preTarget.x} ${sJ.y} L ${preTarget.x} ${preTarget.y} L ${sTgt.x} ${sTgt.y}`
        : `M ${sJ.x} ${sJ.y} L ${sJ.x} ${preTarget.y} L ${preTarget.x} ${preTarget.y} L ${sTgt.x} ${sTgt.y}`;
    }
  });

  const strokeWidth = hovered ? 2.2 : 1.8;
  const opacity = hovered ? 0.95 : 0.78;
  const markerId = `hub-arrow-${hub.type}`;

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

      {/* Invisible hit area for trunk */}
      <path d={trunkScreenPath} fill="none" stroke="transparent" strokeWidth={14} />

      {/* Trunk */}
      <path
        d={trunkScreenPath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: 'stroke-opacity 150ms, stroke-width 150ms', pointerEvents: 'none' }}
      />

      {/* Spokes */}
      {spokeScreenPaths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={opacity}
          strokeLinejoin="round"
          strokeLinecap="round"
          markerEnd={`url(#${markerId})`}
          style={{ transition: 'stroke-opacity 150ms, stroke-width 150ms', pointerEvents: 'none' }}
        />
      ))}

      {/* Junction dot */}
      <circle
        cx={sJunction.x} cy={sJunction.y}
        r={3 * zoom}
        fill={color}
        fillOpacity={opacity}
        style={{ pointerEvents: hovered ? 'all' : 'none', cursor: hovered ? 'grab' : 'default' }}
        onPointerDown={(event) => {
          event.preventDefault(); event.stopPropagation();
          const move = (moveEvent: PointerEvent) => onUpdate(hub.id, { manualWaypoints: [snapWaypoint(screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY }))] });
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        }}
        onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); onUpdate(hub.id, { manualWaypoints: [] }); }}
      />

      {/* Label */}
      {(showLabels || hovered) && (
        <foreignObject
          x={sLabel.x - 60}
          y={sLabel.y - 18}
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
        <g style={{ cursor: 'pointer' }} onClick={() => onDelete(hub.id)}>
          <circle cx={sJunction.x + 12} cy={sJunction.y - 12} r={8} fill="#1a1f35" stroke={color} strokeWidth={1} />
          <text
            x={sJunction.x + 12} y={sJunction.y - 8}
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

export function HubSpokeOverlay() {
  const {
    book,
    showRelationshipLabels,
    hiddenCharacterIds,
    spotlightGroupIds,
    focusedCharacterId,
    hiddenRelationshipTypes,
    deleteHubRelationship,
    updateHubRelationship,
    arrowheadScale,
    arrowheadTypeScales,
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

  const visibleIds = useMemo(() => {
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

  const visibleHubs = useMemo(() => {
    return (book.hubRelationships ?? []).filter(hub => {
      if (hiddenRelationshipTypes.has(hub.type)) return false;
      if (!visibleIds.has(hub.sourceId)) return false;
      const visibleTargets = hub.targetIds.filter(id => visibleIds.has(id));
      if (visibleTargets.length === 0) return false;
      if (focusedCharacterId) {
        const involved = hub.sourceId === focusedCharacterId || hub.targetIds.includes(focusedCharacterId);
        if (!involved) return false;
      }
      return true;
    }).map(hub => ({
      ...hub,
      targetIds: hub.targetIds.filter(id => visibleIds.has(id)),
    }));
  }, [book.hubRelationships, visibleIds, hiddenRelationshipTypes, focusedCharacterId]);

  if (visibleHubs.length === 0) return null;

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
      {visibleHubs.map(hub => (
        <HubSpokeShape
          key={hub.id}
          hub={hub}
          zoom={zoom}
          vpX={vpX}
          vpY={vpY}
          livePositions={livePositions}
          characters={book.characters}
          showLabels={showRelationshipLabels}
          onDelete={deleteHubRelationship}
          onUpdate={updateHubRelationship}
          screenToFlowPosition={screenToFlowPosition}
          arrowheadScale={arrowheadScale * (arrowheadTypeScales[hub.type] ?? 1)}
        />
      ))}
    </svg>
  );
}
