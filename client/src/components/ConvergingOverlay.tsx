// ============================================================
// ConvergingOverlay — SVG overlay for many-to-one relationships
// Multiple sources merge at a junction before one clean trunk reaches
// the shared target (for example, two parents → one child).
// Design: Dark Scholarly Codex
// ============================================================
import { useMemo, useState } from 'react';
import { useNodes, useViewport } from '@xyflow/react';
import { useBook } from '@/contexts/BookContext';
import { calcNodeWidth } from './CharacterNode';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import type { Character, ConvergingRelationship } from '@/lib/types';

const NODE_H = 36;
interface Box { x: number; y: number; w: number; h: number; }

function toScreen(x: number, y: number, zoom: number, vpX: number, vpY: number) {
  return { x: x * zoom + vpX, y: y * zoom + vpY };
}

function charBox(character: Character, livePositions: Map<string, { x: number; y: number }>): Box {
  const live = livePositions.get(character.id);
  return {
    x: live?.x ?? character.x,
    y: live?.y ?? character.y,
    w: calcNodeWidth(character.name, character.title),
    h: NODE_H,
  };
}

function getFacePair(source: Box, target: Box) {
  const sourceCx = source.x + source.w / 2;
  const sourceCy = source.y + source.h / 2;
  const targetCx = target.x + target.w / 2;
  const targetCy = target.y + target.h / 2;
  const dx = targetCx - sourceCx;
  const dy = targetCy - sourceCy;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
  if (horizontal) {
    return dx >= 0
      ? { sx: source.x + source.w, sy: sourceCy, tx: target.x, ty: targetCy, horizontal }
      : { sx: source.x, sy: sourceCy, tx: target.x + target.w, ty: targetCy, horizontal };
  }
  return dy >= 0
    ? { sx: sourceCx, sy: source.y + source.h, tx: targetCx, ty: target.y, horizontal }
    : { sx: sourceCx, sy: source.y, tx: targetCx, ty: target.y + target.h, horizontal };
}

interface ConvergingShapeProps {
  relationship: ConvergingRelationship;
  characters: Character[];
  livePositions: Map<string, { x: number; y: number }>;
  zoom: number;
  vpX: number;
  vpY: number;
  showLabels: boolean;
  onDelete: (id: string) => void;
  arrowheadScale: number;
}

function ConvergingShape({ relationship, characters, livePositions, zoom, vpX, vpY, showLabels, onDelete, arrowheadScale }: ConvergingShapeProps) {
  const [hovered, setHovered] = useState(false);
  const targetCharacter = characters.find(character => character.id === relationship.targetId);
  const sourceCharacters = relationship.sourceIds
    .map(id => characters.find(character => character.id === id))
    .filter(Boolean) as Character[];
  if (!targetCharacter || sourceCharacters.length < 2) return null;

  const targetBox = charBox(targetCharacter, livePositions);
  const sourceBoxes = sourceCharacters.map(character => charBox(character, livePositions));
  const averageSource = sourceBoxes.reduce(
    (sum, box) => ({ x: sum.x + box.x + box.w / 2, y: sum.y + box.y + box.h / 2 }),
    { x: 0, y: 0 },
  );
  averageSource.x /= sourceBoxes.length;
  averageSource.y /= sourceBoxes.length;

  // The target face is decided from the average source position, while each
  // individual source gets its own face attachment for a visibly separate branch.
  const targetProxy: Box = { x: averageSource.x, y: averageSource.y, w: 0, h: 0 };
  const targetPair = getFacePair(targetProxy, targetBox);
  const targetAttachment = { x: targetPair.tx, y: targetPair.ty };
  const sourceAttachments = sourceBoxes.map(sourceBox => {
    const pair = getFacePair(sourceBox, targetBox);
    return { x: pair.sx, y: pair.sy, horizontal: pair.horizontal };
  });

  const averageAttach = sourceAttachments.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  averageAttach.x /= sourceAttachments.length;
  averageAttach.y /= sourceAttachments.length;
  const junction = { x: (averageAttach.x + targetAttachment.x) / 2, y: (averageAttach.y + targetAttachment.y) / 2 };

  const s = (x: number, y: number) => toScreen(x, y, zoom, vpX, vpY);
  const sJunction = s(junction.x, junction.y);
  const sTarget = s(targetAttachment.x, targetAttachment.y);
  const lineStyle = relationship.lineStyle ?? 'orthogonal';
  const typeInfo = RELATIONSHIP_TYPES[relationship.type];
  const color = typeInfo.color;
  const opacity = hovered ? 0.96 : 0.8;
  const strokeWidth = hovered ? 2.3 : 1.8;
  const markerId = `converging-arrow-${relationship.id}`;

  const trunkPath = (() => {
    if (lineStyle === 'straight') return `M ${sJunction.x} ${sJunction.y} L ${sTarget.x} ${sTarget.y}`;
    const horizontal = Math.abs(sTarget.x - sJunction.x) > Math.abs(sTarget.y - sJunction.y);
    if (lineStyle === 'curved') {
      const cpx = horizontal ? (sJunction.x + sTarget.x) / 2 : sJunction.x;
      const cpy = horizontal ? sJunction.y : (sJunction.y + sTarget.y) / 2;
      return `M ${sJunction.x} ${sJunction.y} C ${cpx} ${cpy}, ${cpx} ${cpy}, ${sTarget.x} ${sTarget.y}`;
    }
    return horizontal
      ? `M ${sJunction.x} ${sJunction.y} L ${(sJunction.x + sTarget.x) / 2} ${sJunction.y} L ${(sJunction.x + sTarget.x) / 2} ${sTarget.y} L ${sTarget.x} ${sTarget.y}`
      : `M ${sJunction.x} ${sJunction.y} L ${sJunction.x} ${(sJunction.y + sTarget.y) / 2} L ${sTarget.x} ${(sJunction.y + sTarget.y) / 2} L ${sTarget.x} ${sTarget.y}`;
  })();

  const sourcePaths = sourceAttachments.map(attachment => {
    const start = s(attachment.x, attachment.y);
    if (lineStyle === 'straight') return `M ${start.x} ${start.y} L ${sJunction.x} ${sJunction.y}`;
    if (lineStyle === 'curved') {
      const cpx = attachment.horizontal ? sJunction.x : start.x;
      const cpy = attachment.horizontal ? start.y : sJunction.y;
      return `M ${start.x} ${start.y} C ${cpx} ${cpy}, ${cpx} ${cpy}, ${sJunction.x} ${sJunction.y}`;
    }
    return attachment.horizontal
      ? `M ${start.x} ${start.y} L ${sJunction.x} ${start.y} L ${sJunction.x} ${sJunction.y}`
      : `M ${start.x} ${start.y} L ${start.x} ${sJunction.y} L ${sJunction.x} ${sJunction.y}`;
  });

  const labelPoint = s((junction.x + targetAttachment.x) / 2, (junction.y + targetAttachment.y) / 2 - 4);
  const labelText = relationship.label || typeInfo.label;

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ cursor: 'default' }}>
      <defs>
        <marker id={markerId} markerWidth={8 * arrowheadScale} markerHeight={8 * arrowheadScale} refX={6 * arrowheadScale} refY={3 * arrowheadScale} orient="auto" markerUnits="strokeWidth">
          <path d={`M0,0 L0,${6 * arrowheadScale} L${8 * arrowheadScale},${3 * arrowheadScale} z`} fill={color} fillOpacity={opacity} />
        </marker>
      </defs>
      {[...sourcePaths, trunkPath].map((path, index) => <path key={`hit-${index}`} d={path} fill="none" stroke="transparent" strokeWidth={14} />)}
      {sourcePaths.map((path, index) => <path key={`source-${index}`} d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />)}
      <path d={trunkPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${markerId})`} style={{ pointerEvents: 'none' }} />
      <circle cx={sJunction.x} cy={sJunction.y} r={3 * zoom} fill={color} fillOpacity={opacity} style={{ pointerEvents: 'none' }} />
      {(showLabels || hovered) && (
        <foreignObject x={labelPoint.x - 60} y={labelPoint.y - 18} width={120} height={22} style={{ pointerEvents: 'none', overflow: 'visible' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ background: '#0d1020e0', border: `1px solid ${color}55`, color, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', padding: '2px 8px', borderRadius: 4, boxShadow: '0 1px 8px rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>{labelText}</div></div>
        </foreignObject>
      )}
      {hovered && (
        <g style={{ cursor: 'pointer' }} onClick={() => onDelete(relationship.id)}>
          <circle cx={sJunction.x + 12} cy={sJunction.y - 12} r={8} fill="#1a1f35" stroke={color} strokeWidth={1} />
          <text x={sJunction.x + 12} y={sJunction.y - 8} textAnchor="middle" fontSize={10} fill={color} style={{ userSelect: 'none', pointerEvents: 'none' }}>×</text>
        </g>
      )}
    </g>
  );
}

export function ConvergingOverlay() {
  const { book, showRelationshipLabels, hiddenCharacterIds, spotlightGroupIds, focusedCharacterId, hiddenRelationshipTypes, deleteConvergingRelationship, arrowheadScale, arrowheadTypeScales } = useBook();
  const { x: vpX, y: vpY, zoom } = useViewport();
  const nodes = useNodes();
  const livePositions = useMemo(() => new Map(nodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])), [nodes]);
  const visibleIds = useMemo(() => new Set(book.characters.filter(character => {
    if (hiddenCharacterIds.has(character.id)) return false;
    return spotlightGroupIds.size === 0 || character.groupIds?.some(groupId => spotlightGroupIds.has(groupId));
  }).map(character => character.id)), [book.characters, hiddenCharacterIds, spotlightGroupIds]);
  const visibleRelationships = useMemo(() => (book.convergingRelationships ?? []).filter(relationship => {
    if (hiddenRelationshipTypes.has(relationship.type)) return false;
    if (!visibleIds.has(relationship.targetId)) return false;
    if (relationship.sourceIds.filter(id => visibleIds.has(id)).length < 2) return false;
    return !focusedCharacterId || relationship.targetId === focusedCharacterId || relationship.sourceIds.includes(focusedCharacterId);
  }).map(relationship => ({ ...relationship, sourceIds: relationship.sourceIds.filter(id => visibleIds.has(id)) })), [book.convergingRelationships, hiddenRelationshipTypes, visibleIds, focusedCharacterId]);
  if (visibleRelationships.length === 0) return null;

  return <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2, overflow: 'visible' }}>
    {visibleRelationships.map(relationship => <ConvergingShape key={relationship.id} relationship={relationship} characters={book.characters} livePositions={livePositions} zoom={zoom} vpX={vpX} vpY={vpY} showLabels={showRelationshipLabels} onDelete={deleteConvergingRelationship} arrowheadScale={arrowheadScale * (arrowheadTypeScales[relationship.type] ?? 1)} />)}
  </svg>;
}
