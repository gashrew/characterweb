// ============================================================
// GroupSequenceView — Dark Scholarly Codex reading mode
// Design: ordered, chapter-like focused maps; shared characters
// intentionally recur in every group to make large casts legible.
// ============================================================
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import type { Character, Group } from '@/lib/types';
import { calcNodeWidth } from './CharacterNode';

const NODE_H = 36;
const MAP_W = 1080;
const MAP_H = 620;
const PAD = 82;

interface GroupSequenceViewProps {
  onExit: () => void;
}

function SequenceMap({ group, characters }: { group: Group; characters: Character[] }) {
  const { book, showRelationshipLabels } = useBook();
  const members = useMemo(() => characters.filter(character => character.groupIds?.includes(group.id)), [characters, group.id]);
  const memberIds = useMemo(() => new Set(members.map(character => character.id)), [members]);
  const relationships = useMemo(
    () => book.relationships.filter(relationship => memberIds.has(relationship.sourceId) && memberIds.has(relationship.targetId)),
    [book.relationships, memberIds],
  );
  const familyUnits = useMemo(
    () => (book.familyUnitRelationships ?? []).filter(relationship => relationship.partnerIds.every(id => memberIds.has(id)) && relationship.childIds.every(id => memberIds.has(id))),
    [book.familyUnitRelationships, memberIds],
  );
  const hiddenConnectionCount = useMemo(
    () => book.relationships.filter(relationship => (memberIds.has(relationship.sourceId) || memberIds.has(relationship.targetId)) && !(memberIds.has(relationship.sourceId) && memberIds.has(relationship.targetId))).length,
    [book.relationships, memberIds],
  );

  const layout = useMemo(() => {
    if (!members.length) return new Map<string, { x: number; y: number; w: number }>();
    const minX = Math.min(...members.map(character => character.x));
    const minY = Math.min(...members.map(character => character.y));
    const maxX = Math.max(...members.map(character => character.x + calcNodeWidth(character.name, character.title)));
    const maxY = Math.max(...members.map(character => character.y + NODE_H));
    const scale = Math.min((MAP_W - PAD * 2) / Math.max(1, maxX - minX), (MAP_H - PAD * 2) / Math.max(1, maxY - minY), 1.18);
    const offsetX = (MAP_W - (maxX - minX) * scale) / 2;
    const offsetY = (MAP_H - (maxY - minY) * scale) / 2;
    return new Map(members.map(character => [character.id, {
      x: offsetX + (character.x - minX) * scale,
      y: offsetY + (character.y - minY) * scale,
      w: calcNodeWidth(character.name, character.title) * scale,
    }]));
  }, [members]);

  const groupBounds = useMemo(() => {
    const nodes = Array.from(layout.values());
    if (!nodes.length) return null;
    const padding = 32;
    const minX = Math.max(12, Math.min(...nodes.map(node => node.x)) - padding);
    const minY = Math.max(28, Math.min(...nodes.map(node => node.y)) - padding);
    const maxX = Math.min(MAP_W - 12, Math.max(...nodes.map(node => node.x + node.w)) + padding);
    const maxY = Math.min(MAP_H - 12, Math.max(...nodes.map(node => node.y + NODE_H)) + padding);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [layout]);

  if (!members.length) {
    return <div className="flex h-full items-center justify-center" style={{ color: '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>This group has no members yet.</div>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl" style={{ background: '#0b1020', border: '1px solid #263250' }}>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id={`sequence-grid-${group.id}`} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#8397c018" /></pattern>
          <marker id={`sequence-arrow-${group.id}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill={group.color} /></marker>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill={`url(#sequence-grid-${group.id})`} />
        {groupBounds && <g>
          <rect x={groupBounds.x} y={groupBounds.y} width={groupBounds.w} height={groupBounds.h} rx="18" fill={`${group.color}12`} stroke={group.color} strokeOpacity="0.78" strokeWidth="1.5" strokeDasharray="8 5" />
          <rect x={groupBounds.x + 12} y={groupBounds.y - 15} width={Math.max(78, group.name.length * 7 + 18)} height="20" rx="4" fill="#101628" stroke={group.color} strokeOpacity="0.75" />
          <text x={groupBounds.x + 21} y={groupBounds.y - 1} fill={group.color} fontSize="11" fontWeight="700" style={{ fontFamily: "'DM Sans', sans-serif" }}>{group.name}</text>
        </g>}
        {relationships.map(relationship => {
          const source = layout.get(relationship.sourceId);
          const target = layout.get(relationship.targetId);
          if (!source || !target) return null;
          const sx = source.x + source.w / 2;
          const sy = source.y + NODE_H / 2;
          const tx = target.x + target.w / 2;
          const ty = target.y + NODE_H / 2;
          const info = RELATIONSHIP_TYPES[relationship.type];
          const label = relationship.label || info.label;
          return <g key={relationship.id}>
            <path d={`M ${sx} ${sy} L ${tx} ${ty}`} fill="none" stroke={info.color} strokeWidth="2" strokeOpacity="0.82" markerEnd={relationship.bidirectional ? `url(#sequence-arrow-${group.id})` : `url(#sequence-arrow-${group.id})`} />
            {showRelationshipLabels && <text x={(sx + tx) / 2} y={(sy + ty) / 2 - 7} textAnchor="middle" fontSize="11" fill={info.color} style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, paintOrder: 'stroke', stroke: '#0b1020', strokeWidth: 5 }}>{label}</text>}
          </g>;
        })}
        {familyUnits.map(relationship => {
          const partners = relationship.partnerIds.map(id => layout.get(id)).filter(Boolean) as { x: number; y: number; w: number }[];
          const children = relationship.childIds.map(id => layout.get(id)).filter(Boolean) as { x: number; y: number; w: number }[];
          if (partners.length < 2 || children.length === 0) return null;
          const info = RELATIONSHIP_TYPES[relationship.type];
          const p1 = partners[0];
          const p2 = partners[1];
          const joinX = ((p1.x + p1.w / 2) + (p2.x + p2.w / 2)) / 2;
          const joinY = ((p1.y + NODE_H / 2) + (p2.y + NODE_H / 2)) / 2;
          const branchY = joinY + Math.max(36, Math.min(...children.map(child => child.y)) - joinY - 22);
          const label = relationship.label || info.label;
          return <g key={relationship.id}>
            <path d={`M ${p1.x + p1.w / 2} ${p1.y + NODE_H / 2} L ${p2.x + p2.w / 2} ${p2.y + NODE_H / 2}`} fill="none" stroke={info.color} strokeWidth="2" strokeOpacity="0.88" />
            <circle cx={joinX} cy={joinY} r="3" fill={info.color} />
            {children.map((child, childIndex) => <path key={`${relationship.id}-${childIndex}`} d={`M ${joinX} ${joinY} L ${joinX} ${branchY} L ${child.x + child.w / 2} ${branchY} L ${child.x + child.w / 2} ${child.y}`} fill="none" stroke={info.color} strokeWidth="2" strokeOpacity="0.88" markerEnd={`url(#sequence-arrow-${group.id})`} />)}
            {showRelationshipLabels && <text x={joinX} y={joinY - 8} textAnchor="middle" fontSize="11" fill={info.color} style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, paintOrder: 'stroke', stroke: '#0b1020', strokeWidth: 5 }}>{label}</text>}
          </g>;
        })}
        {members.map(character => {
          const node = layout.get(character.id);
          if (!node) return null;
          const accent = character.color ?? group.color;
          return <g key={character.id}>
            <rect x={node.x} y={node.y} width={node.w} height={NODE_H} rx="6" fill="#161d31" stroke={accent} strokeOpacity="0.7" />
            <rect x={node.x} y={node.y} width="4" height={NODE_H} rx="2" fill={accent} />
            <text x={node.x + node.w / 2} y={node.y + 23} textAnchor="middle" fill="#ece4d3" fontSize="13" fontWeight="700" style={{ fontFamily: "'Playfair Display', serif" }}>{character.name}</text>
          </g>;
        })}
      </svg>
      {hiddenConnectionCount > 0 && <div className="absolute bottom-3 right-3 rounded border px-2 py-1" style={{ background: '#11182ce6', borderColor: '#394767', color: '#9aaac2', fontFamily: "'DM Sans', sans-serif", fontSize: 10 }}>{hiddenConnectionCount} connection{hiddenConnectionCount === 1 ? '' : 's'} to other groups omitted in this focused map</div>}
    </div>
  );
}

export function GroupSequenceView({ onExit }: GroupSequenceViewProps) {
  const { book, groupSequenceOrder, setGroupSequenceOrder } = useBook();
  const groups = useMemo(() => {
    const known = new Map(book.groups.map(group => [group.id, group]));
    const ordered = groupSequenceOrder.map(id => known.get(id)).filter(Boolean) as Group[];
    return [...ordered, ...book.groups.filter(group => !groupSequenceOrder.includes(group.id))];
  }, [book.groups, groupSequenceOrder]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeGroup = groups[Math.min(activeIndex, Math.max(0, groups.length - 1))];
  const sharedCount = activeGroup ? book.characters.filter(character => (character.groupIds?.length ?? 0) > 1 && character.groupIds?.includes(activeGroup.id)).length : 0;

  const moveGroup = (groupId: string, direction: -1 | 1) => {
    const current = groups.map(group => group.id);
    const index = current.indexOf(groupId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    setGroupSequenceOrder(current);
    setActiveIndex(target);
  };

  if (!activeGroup) {
    return <div className="flex h-screen items-center justify-center" style={{ background: '#0f1117', color: '#b8c3d8', fontFamily: "'DM Sans', sans-serif" }}><div className="text-center"><BookOpen size={32} className="mx-auto mb-3" /><p>Create at least one group to use Group Sequence.</p><button onClick={onExit} className="mt-4 rounded border px-3 py-1.5" style={{ borderColor: '#c9a84c80', color: '#c9a84c' }}>Return to map</button></div></div>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0f1117' }}>
      <aside className="flex w-80 shrink-0 flex-col border-r" style={{ background: '#141824', borderColor: '#2a3350' }}>
        <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: '#2a3350' }}>
          <div><div style={{ color: '#e9dfcb', fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>Group Sequence</div><div style={{ color: '#8594ad', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>Read one focused map at a time</div></div>
          <button onClick={onExit} title="Return to full map" className="rounded p-1.5" style={{ color: '#c9a84c', background: '#c9a84c12' }}><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-2 px-1" style={{ color: '#7789a8', fontFamily: "'DM Sans', sans-serif", fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Sequence order</div>
          {groups.map((group, index) => {
            const count = book.characters.filter(character => character.groupIds?.includes(group.id)).length;
            const isActive = index === activeIndex;
            return <div key={group.id} className="mb-2 flex items-center gap-2 rounded-lg border p-2" style={{ borderColor: isActive ? `${group.color}80` : '#29334c', background: isActive ? `${group.color}12` : '#101628' }}>
              <button onClick={() => setActiveIndex(index)} className="min-w-0 flex-1 text-left"><div className="truncate" style={{ color: isActive ? '#f0e7d5' : '#bdc8da', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700 }}><span style={{ color: group.color, marginRight: 6 }}>{index + 1}.</span>{group.name}</div><div style={{ color: '#71819b', fontFamily: "'DM Sans', sans-serif", fontSize: 10 }}>{count} characters</div></button>
              <div className="flex flex-col gap-1"><button disabled={index === 0} onClick={() => moveGroup(group.id, -1)} title="Move earlier" style={{ color: index === 0 ? '#43516a' : '#a8b8d0' }}><ArrowUp size={13} /></button><button disabled={index === groups.length - 1} onClick={() => moveGroup(group.id, 1)} title="Move later" style={{ color: index === groups.length - 1 ? '#43516a' : '#a8b8d0' }}><ArrowDown size={13} /></button></div>
            </div>;
          })}
        </div>
        <div className="border-t p-3" style={{ borderColor: '#2a3350', color: '#7f90a9', fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>Characters in multiple groups appear again in each relevant map.</div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-4" style={{ background: '#141824', borderColor: '#2a3350' }}>
          <div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: activeGroup.color }} /><h1 style={{ color: '#ebe1cf', fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 700 }}>{activeGroup.name}</h1></div><p style={{ color: '#91a1b9', fontFamily: "'DM Sans', sans-serif", fontSize: 12, marginTop: 3 }}>{activeGroup.description || 'Focused character map'} · {book.characters.filter(character => character.groupIds?.includes(activeGroup.id)).length} members{sharedCount > 0 ? ` · ${sharedCount} shared with other groups` : ''}</p></div>
          <div className="flex items-center gap-2"><button disabled={activeIndex === 0} onClick={() => setActiveIndex(index => Math.max(0, index - 1))} className="flex items-center gap-1 rounded border px-3 py-1.5" style={{ borderColor: '#394767', color: activeIndex === 0 ? '#546078' : '#c5d0e0', fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}><ChevronLeft size={14} /> Previous</button><span style={{ color: '#8090aa', fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>{activeIndex + 1} / {groups.length}</span><button disabled={activeIndex === groups.length - 1} onClick={() => setActiveIndex(index => Math.min(groups.length - 1, index + 1))} className="flex items-center gap-1 rounded border px-3 py-1.5" style={{ borderColor: '#394767', color: activeIndex === groups.length - 1 ? '#546078' : '#c5d0e0', fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>Next <ChevronRight size={14} /></button></div>
        </header>
        <section className="min-h-0 flex-1 p-6"><SequenceMap group={activeGroup} characters={book.characters} /></section>
        <footer className="flex items-center gap-2 px-6 pb-5" style={{ color: '#74839c', fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}><ArrowLeft size={13} /> Use Previous/Next to follow the sequence; use the order arrows to set your own reading path.</footer>
      </main>
    </div>
  );
}
