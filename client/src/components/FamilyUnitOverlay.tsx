// ============================================================
// FamilyUnitOverlay — SVG overlay for a partner-first family unit
// Partners are joined visibly before one shared branch reaches children.
// Design: Dark Scholarly Codex
// ============================================================
import { useMemo, useState } from 'react';
import { useNodes, useViewport } from '@xyflow/react';
import { useBook } from '@/contexts/BookContext';
import { calcNodeWidth } from './CharacterNode';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import type { Character, FamilyUnitRelationship } from '@/lib/types';
import { getFamilySvgDashArray } from '@/lib/familyLineStyles';

const NODE_H = 36;
interface Box { x: number; y: number; w: number; h: number; }
type Point = { x: number; y: number };

function toScreen(x: number, y: number, zoom: number, vpX: number, vpY: number): Point {
  return { x: x * zoom + vpX, y: y * zoom + vpY };
}

function boxFor(character: Character, positions: Map<string, Point>): Box {
  const live = positions.get(character.id);
  return { x: live?.x ?? character.x, y: live?.y ?? character.y, w: calcNodeWidth(character.name, character.title), h: NODE_H };
}

function facePair(source: Box, target: Box) {
  const scx = source.x + source.w / 2, scy = source.y + source.h / 2;
  const tcx = target.x + target.w / 2, tcy = target.y + target.h / 2;
  const dx = tcx - scx, dy = tcy - scy;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
  if (horizontal) return dx >= 0
    ? { sx: source.x + source.w, sy: scy, tx: target.x, ty: tcy, horizontal }
    : { sx: source.x, sy: scy, tx: target.x + target.w, ty: tcy, horizontal };
  return dy >= 0
    ? { sx: scx, sy: source.y + source.h, tx: tcx, ty: target.y, horizontal }
    : { sx: scx, sy: source.y, tx: tcx, ty: target.y + target.h, horizontal };
}

function route(from: Point, to: Point, style: string, horizontalHint?: boolean): string {
  const horizontal = horizontalHint ?? Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
  if (style === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  if (style === 'curved') {
    const cpx = horizontal ? (from.x + to.x) / 2 : from.x;
    const cpy = horizontal ? from.y : (from.y + to.y) / 2;
    return `M ${from.x} ${from.y} C ${cpx} ${cpy}, ${cpx} ${cpy}, ${to.x} ${to.y}`;
  }
  return horizontal
    ? `M ${from.x} ${from.y} L ${(from.x + to.x) / 2} ${from.y} L ${(from.x + to.x) / 2} ${to.y} L ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${from.x} ${(from.y + to.y) / 2} L ${to.x} ${(from.y + to.y) / 2} L ${to.x} ${to.y}`;
}

interface ShapeProps {
  relationship: FamilyUnitRelationship;
  characters: Character[];
  positions: Map<string, Point>;
  zoom: number; vpX: number; vpY: number;
  showLabels: boolean;
  onDelete: (id: string) => void;
  arrowheadScale: number;
}

function FamilyUnitShape({ relationship, characters, positions, zoom, vpX, vpY, showLabels, onDelete, arrowheadScale }: ShapeProps) {
  const [hovered, setHovered] = useState(false);
  const partnerChars = relationship.partnerIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
  const childChars = relationship.childIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
  if (partnerChars.length !== 2 || childChars.length === 0) return null;
  const [partnerA, partnerB] = partnerChars.map(c => boxFor(c, positions));
  const children = childChars.map(c => boxFor(c, positions));
  const partnerPair = facePair(partnerA, partnerB);
  const partnerStart = { x: partnerPair.sx, y: partnerPair.sy };
  const partnerEnd = { x: partnerPair.tx, y: partnerPair.ty };
  const union = { x: (partnerStart.x + partnerEnd.x) / 2, y: (partnerStart.y + partnerEnd.y) / 2 };
  const childAttachments = children.map(child => {
    const pair = facePair({ x: union.x, y: union.y, w: 0, h: 0 }, child);
    return { point: { x: pair.tx, y: pair.ty }, horizontal: pair.horizontal };
  });
  const avgChild = childAttachments.reduce((sum, child) => ({ x: sum.x + child.point.x, y: sum.y + child.point.y }), { x: 0, y: 0 });
  avgChild.x /= childAttachments.length; avgChild.y /= childAttachments.length;
  const junction = { x: (union.x + avgChild.x) / 2, y: (union.y + avgChild.y) / 2 };
  const s = (point: Point) => toScreen(point.x, point.y, zoom, vpX, vpY);
  const style = relationship.lineStyle ?? 'orthogonal';
  const typeInfo = RELATIONSHIP_TYPES[relationship.type];
  const color = typeInfo.color;
  const dashArray = getFamilySvgDashArray(relationship.type, relationship.label, relationship.notes);
  const opacity = hovered ? 0.96 : 0.82;
  const strokeWidth = hovered ? 2.4 : 1.9;
  const sStart = s(partnerStart), sEnd = s(partnerEnd), sUnion = s(union), sJunction = s(junction);
  const partnerPath = route(sStart, sEnd, style, partnerPair.horizontal);
  const trunkPath = route(sUnion, sJunction, style, Math.abs(sJunction.x - sUnion.x) > Math.abs(sJunction.y - sUnion.y));
  const childPaths = childAttachments.map(child => route(sJunction, s(child.point), style, child.horizontal));
  const markerId = `family-unit-arrow-${relationship.id}`;
  const mainLabel = relationship.label || 'parents of';
  const partnerLabel = relationship.partnerLabel || '';
  const hasContext = Boolean(relationship.marriageDate || relationship.guardianshipContext || relationship.notes);

  return <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ cursor: 'default', pointerEvents: 'all' }}>
    <defs><marker id={markerId} markerWidth={8 * arrowheadScale} markerHeight={8 * arrowheadScale} refX={6 * arrowheadScale} refY={3 * arrowheadScale} orient="auto" markerUnits="strokeWidth"><path d={`M0,0 L0,${6 * arrowheadScale} L${8 * arrowheadScale},${3 * arrowheadScale} z`} fill={color} /></marker></defs>
    {[partnerPath, trunkPath, ...childPaths].map((path, index) => <path key={`hit-${index}`} d={path} fill="none" stroke="transparent" strokeWidth={14} />)}
    <path d={partnerPath} fill="none" stroke={color} strokeWidth={strokeWidth + 0.3} strokeDasharray={dashArray} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
    <path d={trunkPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
    {childPaths.map((path, index) => <path key={`child-${index}`} d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${markerId})`} style={{ pointerEvents: 'none' }} />)}
    <circle cx={sUnion.x} cy={sUnion.y} r={3 * zoom} fill={color} fillOpacity={opacity} />
    <circle cx={sJunction.x} cy={sJunction.y} r={3 * zoom} fill={color} fillOpacity={opacity} />
    {(showLabels || hovered) && <>
      {partnerLabel && <LabelPill x={(sStart.x + sEnd.x) / 2} y={(sStart.y + sEnd.y) / 2 - 18} text={partnerLabel} color={color} />}
      <LabelPill x={(sUnion.x + sJunction.x) / 2} y={(sUnion.y + sJunction.y) / 2 - 18} text={mainLabel} color={color} />
    </>}
    {hovered && hasContext && <foreignObject x={sJunction.x + 16} y={sJunction.y + 12} width={235} height={150} style={{ pointerEvents: 'none', overflow: 'visible' }}>
      <div style={{ background: '#101526f5', border: `1px solid ${color}95`, borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.55)', color: '#e8e0d0', padding: '9px 10px', fontFamily: "'DM Sans', sans-serif", fontSize: 11, lineHeight: 1.35 }}>
        <div style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Family context</div>
        {relationship.marriageDate && <div><span style={{ color: '#8899aa' }}>Date: </span>{relationship.marriageDate}</div>}
        {relationship.guardianshipContext && <div style={{ marginTop: 3 }}><span style={{ color: '#8899aa' }}>Care: </span>{relationship.guardianshipContext}</div>}
        {relationship.notes && <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid #2a3350', color: '#c6cfdd' }}>{relationship.notes}</div>}
      </div>
    </foreignObject>}
    {hovered && <g style={{ cursor: 'pointer' }} onClick={() => onDelete(relationship.id)}><circle cx={sJunction.x + 12} cy={sJunction.y - 12} r={8} fill="#1a1f35" stroke={color} strokeWidth={1} /><text x={sJunction.x + 12} y={sJunction.y - 8} textAnchor="middle" fontSize={10} fill={color}>×</text></g>}
  </g>;
}

function LabelPill({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return <foreignObject x={x - 60} y={y - 12} width={120} height={22} style={{ pointerEvents: 'none', overflow: 'visible' }}><div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ background: '#0d1020e0', border: `1px solid ${color}55`, color, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, boxShadow: '0 1px 8px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>{text}</div></div></foreignObject>;
}

export function FamilyUnitOverlay() {
  const { book, showRelationshipLabels, hiddenCharacterIds, spotlightGroupIds, focusedCharacterId, hiddenRelationshipTypes, deleteFamilyUnitRelationship, arrowheadScale, arrowheadTypeScales } = useBook();
  const { x: vpX, y: vpY, zoom } = useViewport();
  const nodes = useNodes();
  const positions = useMemo(() => new Map(nodes.map(node => [node.id, { x: node.position.x, y: node.position.y }])), [nodes]);
  const visibleIds = useMemo(() => {
    return new Set(book.characters
      .filter(character => !hiddenCharacterIds.has(character.id) && (spotlightGroupIds.size === 0 || character.groupIds?.some(groupId => spotlightGroupIds.has(groupId))))
      .map(character => character.id));
  }, [book.characters, hiddenCharacterIds, spotlightGroupIds]);
  const visible = useMemo(() => {
    return (book.familyUnitRelationships ?? [])
      .filter(relationship => !hiddenRelationshipTypes.has(relationship.type))
      .filter(relationship => relationship.partnerIds.every(id => visibleIds.has(id)))
      .filter(relationship => relationship.childIds.some(id => visibleIds.has(id)))
      .filter(relationship => !focusedCharacterId || relationship.partnerIds.includes(focusedCharacterId) || relationship.childIds.includes(focusedCharacterId))
      .map(relationship => ({ ...relationship, childIds: relationship.childIds.filter(id => visibleIds.has(id)) }));
  }, [book.familyUnitRelationships, hiddenRelationshipTypes, visibleIds, focusedCharacterId]);
  if (visible.length === 0) return null;
  return <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2, overflow: 'visible' }}>{visible.map(relationship => <FamilyUnitShape key={relationship.id} relationship={relationship} characters={book.characters} positions={positions} zoom={zoom} vpX={vpX} vpY={vpY} showLabels={showRelationshipLabels} onDelete={deleteFamilyUnitRelationship} arrowheadScale={arrowheadScale * (arrowheadTypeScales[relationship.type] ?? 1)} />)}</svg>;
}
