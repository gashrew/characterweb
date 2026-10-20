// ============================================================
// RelationshipEdge — Multi-style routing
// • orthogonal: right-angle segments (default, clearest for hierarchies)
// • curved: smooth cubic bezier (good for abstract/crossing relationships)
// • straight: direct diagonal line (simplest)
// Design: Dark Scholarly Codex
// ============================================================
import { memo, useState } from 'react';
import { EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react';
import type { Relationship } from '@/lib/types';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import { useBook } from '@/contexts/BookContext';
import { getFamilySvgDashArray } from '@/lib/familyLineStyles';

interface Box { x: number; y: number; w: number; h: number; }
type PortSide = 'top' | 'right' | 'bottom' | 'left';
type Point = { x: number; y: number; };
interface EdgePort { x: number; y: number; side: PortSide; }

interface RelationshipEdgeData extends Record<string, unknown> {
  relationship: Relationship;
  isSelected: boolean;
  isDimmed: boolean;
  labelNudge?: number;
  srcBox?: Box | null;
  tgtBox?: Box | null;
  sourcePort?: EdgePort;
  targetPort?: EdgePort;
  obstacles?: Box[];
}

// ── Face-midpoint computation ────────────────────────────────
interface FacePoints {
  sx: number; sy: number;
  tx: number; ty: number;
  exitHorizontal: boolean;
  sourceSide: PortSide;
  targetSide: PortSide;
}

function getFacePoints(src: Box, tgt: Box): FacePoints {
  const srcCx = src.x + src.w / 2;
  const srcCy = src.y + src.h / 2;
  const tgtCx = tgt.x + tgt.w / 2;
  const tgtCy = tgt.y + tgt.h / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const exitHorizontal = absDx > absDy * 1.3;

  if (exitHorizontal) {
    if (dx > 0) {
      return { sx: src.x + src.w, sy: srcCy, tx: tgt.x, ty: tgtCy, exitHorizontal, sourceSide: 'right', targetSide: 'left' };
    } else {
      return { sx: src.x, sy: srcCy, tx: tgt.x + tgt.w, ty: tgtCy, exitHorizontal, sourceSide: 'left', targetSide: 'right' };
    }
  } else {
    if (dy > 0) {
      return { sx: srcCx, sy: src.y + src.h, tx: tgtCx, ty: tgt.y, exitHorizontal, sourceSide: 'bottom', targetSide: 'top' };
    } else {
      return { sx: srcCx, sy: src.y, tx: tgtCx, ty: tgt.y + tgt.h, exitHorizontal, sourceSide: 'top', targetSide: 'bottom' };
    }
  }
}

// ── Path builders ────────────────────────────────────────────

interface PathResult {
  d: string;
  labelX: number;
  labelY: number;
}

const WAYPOINT_GRID = 20;
const snapWaypoint = (point: { x: number; y: number }) => ({ x: Math.round(point.x / WAYPOINT_GRID) * WAYPOINT_GRID, y: Math.round(point.y / WAYPOINT_GRID) * WAYPOINT_GRID });

function sideVector(side: PortSide): Point {
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function routeLength(points: Point[]) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
}

function segmentHitsBox(a: Point, b: Point, box: Box, clearance = 8) {
  const left = box.x - clearance, right = box.x + box.w + clearance;
  const top = box.y - clearance, bottom = box.y + box.h + clearance;
  if (Math.abs(a.y - b.y) < 0.5) return a.y >= top && a.y <= bottom && Math.max(Math.min(a.x, b.x), left) <= Math.min(Math.max(a.x, b.x), right);
  if (Math.abs(a.x - b.x) < 0.5) return a.x >= left && a.x <= right && Math.max(Math.min(a.y, b.y), top) <= Math.min(Math.max(a.y, b.y), bottom);
  return false;
}

function routeBlocked(points: Point[], obstacles: Box[]) {
  return points.slice(1).some((point, index) => obstacles.some(box => segmentHitsBox(points[index], point, box)));
}

function buildOrthoPath(sx: number, sy: number, tx: number, ty: number, sourceSide: PortSide, targetSide: PortSide, obstacles: Box[] = [], manualWaypoints: Point[] = []): PathResult {
  const sourceVector = sideVector(sourceSide);
  const targetVector = sideVector(targetSide);
  const lead = 20;
  const start = { x: sx + sourceVector.x * lead, y: sy + sourceVector.y * lead };
  const end = { x: tx + targetVector.x * lead, y: ty + targetVector.y * lead };
  const sourceHorizontal = sourceVector.x !== 0;
  const targetHorizontal = targetVector.x !== 0;
  const startPoint = { x: sx, y: sy };
  const targetPoint = { x: tx, y: ty };
  if (manualWaypoints.length > 0) {
    const points: Point[] = [startPoint, start];
    let current = start;
    let horizontalFirst = sourceHorizontal;
    for (const waypoint of manualWaypoints) {
      if (horizontalFirst) points.push({ x: waypoint.x, y: current.y });
      else points.push({ x: current.x, y: waypoint.y });
      points.push(waypoint);
      current = waypoint;
      horizontalFirst = !horizontalFirst;
    }
    if (targetHorizontal) points.push({ x: end.x, y: current.y });
    else points.push({ x: current.x, y: end.y });
    points.push(end, targetPoint);
    const compact = points.filter((point, index) => index === 0 || Math.abs(point.x - points[index - 1].x) > 0.5 || Math.abs(point.y - points[index - 1].y) > 0.5);
    const midpoint = manualWaypoints[Math.floor(manualWaypoints.length / 2)];
    return { d: `M ${compact[0].x} ${compact[0].y} ${compact.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ')}`, labelX: midpoint.x, labelY: midpoint.y - 10 };
  }
  const candidates: Point[][] = [];
  if (sourceHorizontal && targetHorizontal) {
    const midX = (start.x + end.x) / 2;
    candidates.push([startPoint, start, { x: midX, y: start.y }, { x: midX, y: end.y }, end, targetPoint]);
    for (const laneX of obstacles.flatMap(box => [box.x - 14, box.x + box.w + 14])) candidates.push([startPoint, start, { x: laneX, y: start.y }, { x: laneX, y: end.y }, end, targetPoint]);
  } else if (!sourceHorizontal && !targetHorizontal) {
    const midY = (start.y + end.y) / 2;
    candidates.push([startPoint, start, { x: start.x, y: midY }, { x: end.x, y: midY }, end, targetPoint]);
    for (const laneY of obstacles.flatMap(box => [box.y - 14, box.y + box.h + 14])) candidates.push([startPoint, start, { x: start.x, y: laneY }, { x: end.x, y: laneY }, end, targetPoint]);
  } else if (sourceHorizontal) {
    candidates.push([startPoint, start, { x: end.x, y: start.y }, end, targetPoint]);
    for (const laneY of obstacles.flatMap(box => [box.y - 14, box.y + box.h + 14])) candidates.push([startPoint, start, { x: start.x, y: laneY }, { x: end.x, y: laneY }, end, targetPoint]);
  } else {
    candidates.push([startPoint, start, { x: start.x, y: end.y }, end, targetPoint]);
    for (const laneX of obstacles.flatMap(box => [box.x - 14, box.x + box.w + 14])) candidates.push([startPoint, start, { x: laneX, y: start.y }, { x: laneX, y: end.y }, end, targetPoint]);
  }
  const points = [...candidates.filter(candidate => !routeBlocked(candidate, obstacles)).sort((a, b) => routeLength(a) - routeLength(b))[0] ?? candidates[0]];
  const compact = points.filter((point, index) => index === 0 || Math.abs(point.x - points[index - 1].x) > 0.5 || Math.abs(point.y - points[index - 1].y) > 0.5);
  return { d: `M ${compact[0].x} ${compact[0].y} ${compact.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ')}`, labelX: (sx + tx) / 2, labelY: (sy + ty) / 2 - 8 };
}

function buildCurvedPath(sx: number, sy: number, tx: number, ty: number, sourceSide: PortSide, targetSide: PortSide): PathResult {
  const sourceVector = sideVector(sourceSide);
  const targetVector = sideVector(targetSide);
  const distance = Math.hypot(tx - sx, ty - sy);
  const tension = Math.max(44, Math.min(150, distance * 0.42));
  const c1x = sx + sourceVector.x * tension;
  const c1y = sy + sourceVector.y * tension;
  const c2x = tx + targetVector.x * tension;
  const c2y = ty + targetVector.y * tension;

  const labelX = (sx + tx) / 2 + (c1x + c2x - sx - tx) * 0.15;
  const labelY = (sy + ty) / 2 + (c1y + c2y - sy - ty) * 0.15 - 10;

  return {
    d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`,
    labelX,
    labelY,
  };
}

function buildStraightPath(sx: number, sy: number, tx: number, ty: number, sourceSide: PortSide, targetSide: PortSide): PathResult {
  const sourceVector = sideVector(sourceSide);
  const targetVector = sideVector(targetSide);
  const landingLead = 12;
  const postSource = { x: sx + sourceVector.x * landingLead, y: sy + sourceVector.y * landingLead };
  const preTarget = { x: tx + targetVector.x * landingLead, y: ty + targetVector.y * landingLead };
  return {
    d: `M ${sx} ${sy} L ${postSource.x} ${postSource.y} L ${preTarget.x} ${preTarget.y} L ${tx} ${ty}`,
    labelX: (sx + tx) / 2,
    labelY: (sy + ty) / 2 - 10,
  };
}

// ── Main component ───────────────────────────────────────────

export const RelationshipEdge = memo(function RelationshipEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps) {
  const edgeData = data as RelationshipEdgeData;
  const { relationship, isSelected, isDimmed, labelNudge = 0, srcBox, tgtBox, sourcePort, targetPort, obstacles = [] } = edgeData;
  const {
    setSelectedRelationshipId, setSidebarTab, setEditingRelationshipId,
    showRelationshipLabels, updateRelationship,
  } = useBook();
  const { screenToFlowPosition } = useReactFlow();
  const [hovered, setHovered] = useState(false);

  const typeInfo = RELATIONSHIP_TYPES[relationship.type];
  const color = typeInfo.color;
  const dashArray = relationship.uncertain ? '7 4' : (getFamilySvgDashArray(relationship.type, relationship.label, relationship.notes) || typeInfo.dashArray || undefined);
  const lineStyle = relationship.lineStyle ?? 'orthogonal';

  // Resolve face attachment points
  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY;
  let sourceSide: PortSide = Math.abs(tx - sx) > Math.abs(ty - sy) * 1.3 ? (tx >= sx ? 'right' : 'left') : (ty >= sy ? 'bottom' : 'top');
  let targetSide: PortSide = sourceSide === 'right' ? 'left' : sourceSide === 'left' ? 'right' : sourceSide === 'bottom' ? 'top' : 'bottom';

  if (sourcePort && targetPort) {
    sx = sourcePort.x; sy = sourcePort.y;
    tx = targetPort.x; ty = targetPort.y;
    sourceSide = sourcePort.side;
    targetSide = targetPort.side;
  } else if (srcBox && tgtBox) {
    const fp = getFacePoints(srcBox, tgtBox);
    sx = fp.sx; sy = fp.sy; tx = fp.tx; ty = fp.ty;
    sourceSide = fp.sourceSide;
    targetSide = fp.targetSide;
  }

  // Build path based on chosen style
  let pathResult: PathResult;
  if (lineStyle === 'curved') {
    pathResult = buildCurvedPath(sx, sy, tx, ty, sourceSide, targetSide);
  } else if (lineStyle === 'straight') {
    pathResult = buildStraightPath(sx, sy, tx, ty, sourceSide, targetSide);
  } else {
    pathResult = buildOrthoPath(sx, sy, tx, ty, sourceSide, targetSide, obstacles, relationship.manualWaypoints);
  }

  const { d: edgePath, labelX, labelY } = pathResult;

  const opacity = isDimmed ? 0.1 : isSelected ? 1 : hovered ? 0.95 : 0.78;
  const strokeWidth = isSelected ? 2.5 : hovered ? 2.2 : 1.8;

  const labelText = relationship.label || typeInfo.label;
  const showLabel = (showRelationshipLabels || hovered || isSelected) && !isDimmed;

  const nudgedLabelX = labelX;
  const nudgedLabelY = labelY + labelNudge;

  return (
    <>
      {/* Invisible wider hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          setSelectedRelationshipId(id);
          setSidebarTab('relationships');
        }}
        onPointerDown={(event) => {
          if (!event.shiftKey) return;
          event.preventDefault();
          event.stopPropagation();
          const point = snapWaypoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
          updateRelationship(relationship.id, { manualWaypoints: [...(relationship.manualWaypoints ?? []), { x: point.x, y: point.y }] });
        }}
        onDoubleClick={() => setEditingRelationshipId(id)}
      />

      {/* Visible edge */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeOpacity={opacity}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{
          transition: 'stroke-opacity 150ms, stroke-width 150ms',
          pointerEvents: 'none',
          filter: isSelected ? `drop-shadow(0 0 4px ${color}80)` : undefined,
        }}
        markerEnd={`url(#arrow-${relationship.type})`}
        markerStart={relationship.bidirectional ? `url(#arrow-${relationship.type})` : undefined}
      />

      {/* Relationship label */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${nudgedLabelX}px, ${nudgedLabelY}px)`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div
              style={{
                background: isSelected ? `${color}28` : '#0d1020e0',
                border: `1px solid ${color}${isSelected ? '90' : '55'}`,
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
                transition: 'background 150ms, border-color 150ms',
                opacity: isSelected ? 1 : hovered ? 1 : 0.9,
              }}
            >
              {labelText}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {relationship.manualWaypoints?.map((waypoint, index) => (
        <EdgeLabelRenderer key={`waypoint-${index}`}>
          <div
            title="Drag to move waypoint"
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${waypoint.x}px, ${waypoint.y}px)`, width: 12, height: 12, borderRadius: '50%', background: '#101628', border: `2px solid ${color}`, boxShadow: `0 0 8px ${color}80`, cursor: 'grab', zIndex: 12 }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const move = (moveEvent: PointerEvent) => {
                const point = snapWaypoint(screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY }));
                const next = [...(relationship.manualWaypoints ?? [])];
                next[index] = { x: point.x, y: point.y };
                updateRelationship(relationship.id, { manualWaypoints: next });
              };
              const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
              window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              updateRelationship(relationship.id, { manualWaypoints: (relationship.manualWaypoints ?? []).filter((_, waypointIndex) => waypointIndex !== index) });
            }}
          />
        </EdgeLabelRenderer>
      ))}

      {hovered && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, 0) translate(${labelX}px, ${labelY + 10}px)`, zIndex: 12, display: 'flex', gap: 4 }}>
            <button type="button" title="Shift-click the line to add a waypoint" style={{ fontSize: 9, color, background: '#101628e8', border: `1px solid ${color}70`, borderRadius: 3, padding: '2px 5px', cursor: 'help' }}>⇧ Click: waypoint</button>
            {(relationship.manualWaypoints?.length ?? 0) > 0 && <button type="button" onClick={() => updateRelationship(relationship.id, { manualWaypoints: [] })} style={{ fontSize: 9, color, background: '#101628e8', border: `1px solid ${color}70`, borderRadius: 3, padding: '2px 5px', cursor: 'pointer' }}>Reset route</button>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
