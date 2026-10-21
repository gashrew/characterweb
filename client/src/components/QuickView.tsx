// ============================================================
// QuickView — phone layout for capturing characters while reading.
// No map: quick add, search, relationships and groups, all saved to
// the same book data the full map view uses.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeftRight, ArrowRight, BookOpen, Check, ChevronLeft, Download, Map as MapIcon,
  Plus, Search, Trash2, Upload, Users, Waypoints, X,
} from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import { useBookImport } from '@/components/BookImport';
import { nextQuickPosition } from '@/lib/placement';
import {
  GROUP_COLORS, RELATIONSHIP_TYPES,
  type BookData, type Character, type CharacterGender, type Group, type Relationship, type RelationshipType,
} from '@/lib/types';

// ── Palette (matches the map view) ──────────────────────────
const C = {
  bg: '#0f131d',
  panel: '#161b29',
  card: '#1a2035',
  border: '#2a3350',
  text: '#e8e0d0',
  muted: '#8899aa',
  faint: '#5b6a80',
  gold: '#c9a84c',
  danger: '#d16464',
};
const serif = "'Playfair Display', Georgia, serif";
const sans = "'DM Sans', system-ui, sans-serif";

const GENDERS: { value: CharacterGender; symbol: string; label: string; color: string }[] = [
  { value: 'male', symbol: '♂', label: 'Male', color: '#5c8ae0' },
  { value: 'female', symbol: '♀', label: 'Female', color: '#e05c8a' },
  { value: 'non-binary', symbol: '⚥', label: 'Non-binary', color: '#9b6ec9' },
  { value: 'unknown', symbol: '?', label: 'Unknown', color: '#8899aa' },
];
const genderInfo = (g: CharacterGender) => GENDERS.find(x => x.value === g) ?? GENDERS[3];

const LABEL_SUGGESTIONS: Record<RelationshipType, string[]> = {
  family: ['Spouse', 'Sibling', 'Parent of', 'Child of', 'Cousin', 'Grandparent of', 'Aunt/Uncle of', 'In-law'],
  'step-family': ['Step-parent of', 'Step-child of', 'Step-sibling'],
  romance: ['Lover', 'Engaged', 'Admirer of', 'Former lover'],
  friendship: ['Friend', 'Close friend', 'Acquaintance'],
  rivalry: ['Rival'],
  mentor: ['Mentor of', 'Tutor of', 'Patron of'],
  colleague: ['Colleague', 'Employer of', 'Servant of'],
  enemy: ['Enemy'],
  other: ['Neighbour', 'Knows'],
};

type Tab = 'characters' | 'relationships' | 'groups' | 'book';
type Sheet =
  | { kind: 'character'; id: string }
  | { kind: 'relationship'; id?: string; sourceId?: string; targetId?: string }
  | { kind: 'group'; id?: string }
  | null;

function displayName(c?: Character) {
  if (!c) return 'Unknown';
  return c.title ? `${c.title} ${c.name}` : c.name;
}

// ── Small shared pieces ─────────────────────────────────────
function Chip({ active, color = C.gold, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 12px', borderRadius: 999, fontSize: 14, fontFamily: sans, lineHeight: 1.1,
        border: `1px solid ${active ? color : C.border}`,
        background: active ? `${color}26` : 'transparent',
        color: active ? color : C.muted, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 16, padding: '11px 12px', borderRadius: 10,
  background: C.card, border: `1px solid ${C.border}`, color: C.text, fontFamily: sans, outline: 'none',
};

function PrimaryButton({ onClick, children, disabled, subtle }: { onClick: () => void; children: React.ReactNode; disabled?: boolean; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '13px 14px', borderRadius: 12, fontSize: 16, fontWeight: 600, fontFamily: sans,
        background: subtle ? 'transparent' : C.gold, color: subtle ? C.gold : '#1a1408',
        border: `1px solid ${C.gold}`, opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Full-screen sheet used for every detail/edit screen. */
function SheetFrame({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', paddingTop: 'max(10px, env(safe-area-inset-top))', borderBottom: `1px solid ${C.border}`, background: C.panel }}>
        <button type="button" onClick={onClose} aria-label="Back" style={{ padding: 8, color: C.gold, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16 }}>
          <ChevronLeft size={22} /> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 18, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 64 }}>{title}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>{children}</div>
      {footer && (
        <div style={{ display: 'flex', gap: 10, padding: 12, paddingBottom: 'max(12px, env(safe-area-inset-bottom))', borderTop: `1px solid ${C.border}`, background: C.panel }}>{footer}</div>
      )}
    </div>
  );
}

// ── Character picker (used inside the relationship sheet) ───
function CharacterPicker({ label, value, onChange, exclude }: { label: string; value?: string; onChange: (id: string) => void; exclude?: string }) {
  const { book, addCharacter } = useBook();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = book.characters.find(c => c.id === value);
  const q = query.trim().toLowerCase();
  const matches = book.characters
    .filter(c => c.id !== exclude)
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.title ?? '').toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exact = book.characters.some(c => c.name.toLowerCase() === q);

  const createNew = () => {
    const name = query.trim();
    if (!name) return;
    const created = addCharacter({ name, gender: 'unknown', status: 'alive', ...nextQuickPosition(book.characters), placedAutomatically: true });
    toast.success(`Added ${name}`);
    onChange(created.id);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Field label={label}>
        <button type="button" onClick={() => setOpen(true)} style={{ ...inputStyle, textAlign: 'left', color: selected ? C.text : C.faint }}>
          {selected ? displayName(selected) : 'Choose a character…'}
        </button>
      </Field>
      {open && (
        <SheetFrame title={label} onClose={() => { setOpen(false); setQuery(''); }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: C.faint }} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q && !exact && matches.length === 0) createNew(); }} placeholder="Search, or type a new name" style={{ ...inputStyle, paddingLeft: 36 }} />
          </div>
          {q && !exact && (
            <button type="button" onClick={createNew} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 10, borderRadius: 10, border: `1px dashed ${C.gold}`, color: C.gold, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} /> Add “{query.trim()}” as a new character
            </button>
          )}
          {matches.map(c => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }} style={{ width: '100%', textAlign: 'left', padding: '12px 4px', borderBottom: `1px solid ${C.border}`, fontSize: 16, color: c.id === value ? C.gold : C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 18, textAlign: 'center', color: genderInfo(c.gender).color }}>{genderInfo(c.gender).symbol}</span>
              {displayName(c)}
              {c.id === value && <Check size={16} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
          {matches.length === 0 && !q && <div style={{ color: C.muted, fontSize: 15 }}>No characters yet — type a name to add one.</div>}
        </SheetFrame>
      )}
    </>
  );
}

// ── Relationship text helpers ───────────────────────────────
function useRelationshipText() {
  const { book } = useBook();
  const byId = useMemo(() => new Map(book.characters.map(c => [c.id, c])), [book.characters]);
  const name = (id: string) => displayName(byId.get(id));
  const names = (ids: string[]) => ids.map(name).join(', ');
  return { name, names, byId };
}

/** Readable lines for the connection types that can only be edited on the map. */
function useOtherConnections(characterId?: string) {
  const { book } = useBook();
  const { name, names } = useRelationshipText();
  const groupName = (id: string) => book.groups.find(g => g.id === id)?.name ?? 'a group';
  const lines: { id: string; color: string; text: string }[] = [];
  const involves = (ids: string[]) => !characterId || ids.includes(characterId);
  for (const r of book.familyUnitRelationships ?? []) {
    if (!involves([...r.partnerIds, ...r.childIds])) continue;
    lines.push({ id: r.id, color: RELATIONSHIP_TYPES[r.type]?.color ?? C.gold, text: `${names(r.partnerIds)} → ${r.guardianshipContext || r.label || 'parents of'} ${names(r.childIds)}` });
  }
  for (const r of book.hubRelationships ?? []) {
    if (!involves([r.sourceId, ...r.targetIds])) continue;
    lines.push({ id: r.id, color: RELATIONSHIP_TYPES[r.type]?.color ?? C.muted, text: `${name(r.sourceId)} → ${r.label || RELATIONSHIP_TYPES[r.type]?.label} → ${names(r.targetIds)}` });
  }
  for (const r of book.convergingRelationships ?? []) {
    if (!involves([...r.sourceIds, r.targetId])) continue;
    lines.push({ id: r.id, color: RELATIONSHIP_TYPES[r.type]?.color ?? C.muted, text: `${names(r.sourceIds)} → ${r.label || RELATIONSHIP_TYPES[r.type]?.label} → ${name(r.targetId)}` });
  }
  for (const r of book.groupRelationships ?? []) {
    if (!involves([r.sourceId])) continue;
    lines.push({ id: r.id, color: RELATIONSHIP_TYPES[r.type]?.color ?? C.muted, text: `${name(r.sourceId)} → ${r.label || RELATIONSHIP_TYPES[r.type]?.label} → ${groupName(r.groupId)} (group)` });
  }
  return lines;
}

function RelationshipRow({ rel, onClick }: { rel: Relationship; onClick: () => void }) {
  const { name } = useRelationshipText();
  const meta = RELATIONSHIP_TYPES[rel.type] ?? RELATIONSHIP_TYPES.other;
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: '12px 2px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: meta.color, opacity: rel.uncertain ? 0.5 : 1, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 16, color: C.text }}>
          {name(rel.sourceId)}
          {rel.bidirectional ? <ArrowLeftRight size={14} color={meta.color} /> : <ArrowRight size={14} color={meta.color} />}
          {name(rel.targetId)}
        </span>
        <span style={{ fontSize: 13, color: meta.color }}>
          {rel.label || meta.label}{rel.uncertain ? ' · uncertain' : ''}
        </span>
      </span>
    </button>
  );
}

// ── Character sheet ─────────────────────────────────────────
function CharacterSheet({ id, onClose, openRelationship }: { id: string; onClose: () => void; openRelationship: (s: Sheet) => void }) {
  const { book, updateCharacter, deleteCharacter, addGroup } = useBook();
  const character = book.characters.find(c => c.id === id);
  const [nameDraft, setNameDraft] = useState(character?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const other = useOtherConnections(id);

  useEffect(() => { if (!character) onClose(); }, [character, onClose]);
  if (!character) return null;

  const groupIds = character.groupIds ?? [];
  const toggleGroup = (gid: string) => {
    const next = groupIds.includes(gid) ? groupIds.filter(g => g !== gid) : [...groupIds, gid];
    updateCharacter(id, { groupIds: next.length ? next : undefined });
  };
  const createGroup = () => {
    const nameText = newGroupName.trim();
    if (!nameText) return;
    const g = addGroup({ name: nameText, color: GROUP_COLORS[book.groups.length % GROUP_COLORS.length], groupType: 'standard' });
    updateCharacter(id, { groupIds: [...groupIds, g.id] });
    setNewGroupName('');
  };
  const rels = book.relationships.filter(r => r.sourceId === id || r.targetId === id);

  return (
    <SheetFrame
      title={displayName(character)}
      onClose={onClose}
      footer={<PrimaryButton onClick={() => openRelationship({ kind: 'relationship', sourceId: id })}><Plus size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: -3 }} />Add relationship</PrimaryButton>}
    >
      <Field label="Name">
        <input
          value={nameDraft}
          onChange={e => { setNameDraft(e.target.value); if (e.target.value.trim()) updateCharacter(id, { name: e.target.value.trim() }); }}
          onBlur={() => setNameDraft(character.name)}
          style={inputStyle}
        />
      </Field>
      <Field label="Title (optional)">
        <input value={character.title ?? ''} onChange={e => updateCharacter(id, { title: e.target.value || undefined })} placeholder="e.g. Baroness, Dr, Lord" style={inputStyle} />
      </Field>
      <Field label="Gender">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GENDERS.map(g => (
            <Chip key={g.value} active={character.gender === g.value} color={g.color} onClick={() => updateCharacter(id, { gender: g.value })}>{g.symbol} {g.label}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Status">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['alive', 'deceased', 'unknown'] as const).map(s => (
            <Chip key={s} active={character.status === s} onClick={() => updateCharacter(id, { status: s })}>{s[0].toUpperCase() + s.slice(1)}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Description">
        <textarea value={character.description ?? ''} onChange={e => updateCharacter(id, { description: e.target.value || undefined })} rows={3} placeholder="Who they are, where they appear…" style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
      <Field label="Groups">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {book.groups.map(g => (
            <Chip key={g.id} active={groupIds.includes(g.id)} color={g.color} onClick={() => toggleGroup(g.id)}>{g.name}</Chip>
          ))}
          {book.groups.length === 0 && <span style={{ color: C.faint, fontSize: 14 }}>No groups yet.</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createGroup(); }} placeholder="New group…" style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={createGroup} disabled={!newGroupName.trim()} style={{ padding: '0 14px', borderRadius: 10, border: `1px solid ${C.gold}`, color: C.gold, opacity: newGroupName.trim() ? 1 : 0.4 }}>Add</button>
        </div>
      </Field>
      <Field label="Notes">
        <textarea value={character.notes ?? ''} onChange={e => updateCharacter(id, { notes: e.target.value || undefined })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>

      <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, margin: '8px 0 2px' }}>Relationships ({rels.length + other.length})</div>
      {rels.map(r => <RelationshipRow key={r.id} rel={r} onClick={() => openRelationship({ kind: 'relationship', id: r.id })} />)}
      {other.map(o => (
        <div key={o.id} style={{ padding: '10px 2px', borderBottom: `1px solid ${C.border}`, fontSize: 14, color: C.muted, display: 'flex', gap: 10 }}>
          <span style={{ width: 4, borderRadius: 2, background: o.color, flexShrink: 0 }} />{o.text}
        </div>
      ))}
      {rels.length + other.length === 0 && <div style={{ color: C.faint, fontSize: 14, padding: '6px 0' }}>None yet.</div>}

      <div style={{ marginTop: 28, marginBottom: 8 }}>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: C.danger, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={16} /> Delete character</button>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: C.text, fontSize: 15 }}>Delete {character.name} and their relationships?</span>
            <button type="button" onClick={() => { deleteCharacter(id); toast(`Deleted ${character.name}`); onClose(); }} style={{ color: '#fff', background: C.danger, borderRadius: 8, padding: '8px 14px', fontSize: 15 }}>Delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={{ color: C.muted, fontSize: 15, padding: '8px 6px' }}>Cancel</button>
          </div>
        )}
      </div>
    </SheetFrame>
  );
}

// ── Relationship sheet (add or edit) ────────────────────────
function RelationshipSheet({ sheet, onClose }: { sheet: Extract<Sheet, { kind: 'relationship' }>; onClose: () => void }) {
  const { book, addRelationship, updateRelationship, deleteRelationship } = useBook();
  const existing = sheet.id ? book.relationships.find(r => r.id === sheet.id) : undefined;
  const [sourceId, setSourceId] = useState<string | undefined>(existing?.sourceId ?? sheet.sourceId);
  const [targetId, setTargetId] = useState<string | undefined>(existing?.targetId ?? sheet.targetId);
  const [type, setType] = useState<RelationshipType>(existing?.type ?? 'family');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [bidirectional, setBidirectional] = useState(existing?.bidirectional ?? true);
  const [uncertain, setUncertain] = useState(existing?.uncertain ?? false);

  const canSave = !!sourceId && !!targetId && sourceId !== targetId;
  const pickLabel = (l: string) => { setLabel(l); setBidirectional(!/ of$/i.test(l)); };

  const save = (another: boolean) => {
    if (!canSave) return;
    const data = { sourceId: sourceId!, targetId: targetId!, type, label: label.trim() || undefined, bidirectional, uncertain };
    if (existing) updateRelationship(existing.id, data);
    else addRelationship({ ...data, lineStyle: 'orthogonal' });
    toast.success(existing ? 'Relationship updated' : 'Relationship added');
    if (another) { setTargetId(undefined); setLabel(''); setUncertain(false); }
    else onClose();
  };

  const src = book.characters.find(c => c.id === sourceId);
  const tgt = book.characters.find(c => c.id === targetId);

  return (
    <SheetFrame
      title={existing ? 'Edit relationship' : 'New relationship'}
      onClose={onClose}
      footer={existing ? (
        <PrimaryButton onClick={() => save(false)} disabled={!canSave}>Save</PrimaryButton>
      ) : (
        <>
          <PrimaryButton subtle onClick={() => save(true)} disabled={!canSave}>Save + another</PrimaryButton>
          <PrimaryButton onClick={() => save(false)} disabled={!canSave}>Save</PrimaryButton>
        </>
      )}
    >
      <CharacterPicker label="From" value={sourceId} onChange={setSourceId} exclude={targetId} />
      <CharacterPicker label="To" value={targetId} onChange={setTargetId} exclude={sourceId} />
      <Field label="Type">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(RELATIONSHIP_TYPES) as RelationshipType[]).map(t => (
            <Chip key={t} active={type === t} color={RELATIONSHIP_TYPES[t].color} onClick={() => setType(t)}>{RELATIONSHIP_TYPES[t].label}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Label">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Spouse, Parent of" style={inputStyle} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {LABEL_SUGGESTIONS[type].map(l => <Chip key={l} active={label === l} color={RELATIONSHIP_TYPES[type].color} onClick={() => pickLabel(l)}>{l}</Chip>)}
        </div>
      </Field>
      <Field label="Direction">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip active={bidirectional} onClick={() => setBidirectional(true)}>↔ Both ways</Chip>
          <Chip active={!bidirectional} onClick={() => setBidirectional(false)}>→ One way</Chip>
          <Chip active={uncertain} color={C.muted} onClick={() => setUncertain(v => !v)}>? Uncertain</Chip>
        </div>
      </Field>
      {src && tgt && (
        <div style={{ padding: 12, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, fontSize: 15, color: C.text }}>
          {displayName(src)} {bidirectional ? '↔' : '→'} <span style={{ color: RELATIONSHIP_TYPES[type].color }}>{label.trim() || RELATIONSHIP_TYPES[type].label}</span> {bidirectional ? '↔' : '→'} {displayName(tgt)}
        </div>
      )}
      {existing && (
        <button type="button" onClick={() => { deleteRelationship(existing.id); toast('Relationship deleted'); onClose(); }} style={{ marginTop: 24, color: C.danger, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trash2 size={16} /> Delete relationship
        </button>
      )}
    </SheetFrame>
  );
}

// ── Group sheet (create or edit + membership) ───────────────
function GroupSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const { book, addGroup, updateGroup, deleteGroup, updateCharacter } = useBook();
  const [groupId, setGroupId] = useState<string | undefined>(id);
  const group = book.groups.find(g => g.id === groupId);
  const [name, setName] = useState(group?.name ?? '');
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = () => {
    if (!name.trim()) return;
    const g = addGroup({ name: name.trim(), color: GROUP_COLORS[book.groups.length % GROUP_COLORS.length], groupType: 'standard' });
    setGroupId(g.id);
  };

  if (!group) {
    return (
      <SheetFrame title="New group" onClose={onClose} footer={<PrimaryButton onClick={create} disabled={!name.trim()}>Create group</PrimaryButton>}>
        <Field label="Group name">
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} placeholder="e.g. The Hulot family" style={inputStyle} />
        </Field>
        <div style={{ color: C.muted, fontSize: 14 }}>You can choose members once it's created.</div>
      </SheetFrame>
    );
  }

  const q = query.trim().toLowerCase();
  const members = book.characters.filter(c => c.groupIds?.includes(group.id));
  const list = [...book.characters]
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.groupIds?.includes(group.id)) - Number(!!a.groupIds?.includes(group.id)) || a.name.localeCompare(b.name));
  const toggle = (c: Character) => {
    const ids = c.groupIds ?? [];
    const next = ids.includes(group.id) ? ids.filter(g => g !== group.id) : [...ids, group.id];
    updateCharacter(c.id, { groupIds: next.length ? next : undefined });
  };

  return (
    <SheetFrame title={group.name} onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={e => { setName(e.target.value); if (e.target.value.trim()) updateGroup(group.id, { name: e.target.value.trim() }); }} style={inputStyle} />
      </Field>
      <Field label="Colour">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {GROUP_COLORS.map(col => (
            <button key={col} type="button" aria-label={col} onClick={() => updateGroup(group.id, { color: col })} style={{ width: 32, height: 32, borderRadius: 999, background: col, border: group.color === col ? '3px solid #fff' : '3px solid transparent' }} />
          ))}
        </div>
      </Field>
      <Field label="On the map">
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip active={group.groupType !== 'circle'} onClick={() => updateGroup(group.id, { groupType: 'standard' })}>Label only</Chip>
          <Chip active={group.groupType === 'circle'} color={group.color} onClick={() => updateGroup(group.id, { groupType: 'circle' })}>Draw a circle</Chip>
        </div>
      </Field>
      <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, margin: '6px 0 8px' }}>Members ({members.length}) — tap to add or remove</div>
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: C.faint }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a character" style={{ ...inputStyle, paddingLeft: 36 }} />
      </div>
      {list.map(c => {
        const inGroup = !!c.groupIds?.includes(group.id);
        return (
          <button key={c.id} type="button" onClick={() => toggle(c)} style={{ width: '100%', textAlign: 'left', padding: '12px 4px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, color: inGroup ? C.text : C.muted }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${inGroup ? group.color : C.border}`, background: inGroup ? group.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {inGroup && <Check size={14} color="#141824" strokeWidth={3} />}
            </span>
            {displayName(c)}
          </button>
        );
      })}
      <div style={{ marginTop: 28 }}>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: C.danger, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={16} /> Delete group</button>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: C.text, fontSize: 15 }}>Delete this group? Characters are kept.</span>
            <button type="button" onClick={() => { deleteGroup(group.id); onClose(); }} style={{ color: '#fff', background: C.danger, borderRadius: 8, padding: '8px 14px', fontSize: 15 }}>Delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={{ color: C.muted, fontSize: 15, padding: '8px 6px' }}>Cancel</button>
          </div>
        )}
      </div>
    </SheetFrame>
  );
}

// ── Tabs ────────────────────────────────────────────────────
function CharactersTab({ open }: { open: (s: Sheet) => void }) {
  const { book, addCharacter } = useBook();
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<CharacterGender>('unknown');
  const [sort, setSort] = useState<'recent' | 'az'>('recent');
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const exact = book.characters.find(c => c.name.toLowerCase() === q);

  const list = useMemo(() => {
    const filtered = book.characters.filter(c =>
      !q || c.name.toLowerCase().includes(q) || (c.title ?? '').toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q));
    return sort === 'az' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : [...filtered].reverse();
  }, [book.characters, q, sort]);

  const relCount = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
    book.relationships.forEach(r => { bump(r.sourceId); bump(r.targetId); });
    (book.familyUnitRelationships ?? []).forEach(r => [...r.partnerIds, ...r.childIds].forEach(bump));
    (book.hubRelationships ?? []).forEach(r => [r.sourceId, ...r.targetIds].forEach(bump));
    (book.convergingRelationships ?? []).forEach(r => [...r.sourceIds, r.targetId].forEach(bump));
    return counts;
  }, [book]);

  const add = () => {
    const name = query.trim();
    if (!name) { inputRef.current?.focus(); return; }
    const created = addCharacter({ name, gender, status: 'alive', ...nextQuickPosition(book.characters), placedAutomatically: true });
    toast.success(`Added ${name}`, { action: { label: 'Details', onClick: () => open({ kind: 'character', id: created.id }) } });
    setQuery('');
    setGender('unknown');
    inputRef.current?.focus();
  };

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: C.bg, padding: '12px 16px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: C.faint }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
              placeholder="New name, or search"
              enterKeyHint="done"
              autoCapitalize="words"
              autoCorrect="off"
              style={{ ...inputStyle, paddingLeft: 36, paddingRight: query ? 36 : 12 }}
            />
            {query && (
              <button type="button" aria-label="Clear" onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: 10, color: C.faint, padding: 2 }}><X size={18} /></button>
            )}
          </div>
          <button type="button" onClick={add} disabled={!q} style={{ padding: '0 16px', borderRadius: 10, background: C.gold, color: '#1a1408', fontWeight: 700, fontSize: 16, opacity: q ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={18} /> Add
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, overflowX: 'auto' }}>
          {GENDERS.map(g => (
            <Chip key={g.value} active={gender === g.value} color={g.color} onClick={() => setGender(g.value)}>{g.symbol}{g.value === 'unknown' ? ' Not sure' : ''}</Chip>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setSort(s => s === 'recent' ? 'az' : 'recent')} style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap', padding: '6px 2px' }}>
            {sort === 'recent' ? 'Newest first' : 'A–Z'} ⇅
          </button>
        </div>
        {exact && q && <div style={{ marginTop: 8, fontSize: 13, color: C.gold }}>“{exact.name}” is already in this book — tap Add only if it's a different person.</div>}
      </div>

      <div style={{ padding: '0 16px' }}>
        {list.map(c => {
          const g = genderInfo(c.gender);
          const groups = (c.groupIds ?? []).map(id => book.groups.find(x => x.id === id)).filter(Boolean) as Group[];
          const n = relCount.get(c.id) ?? 0;
          return (
            <button key={c.id} type="button" onClick={() => open({ kind: 'character', id: c.id })} style={{ width: '100%', textAlign: 'left', padding: '12px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${g.color}66`, color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{g.symbol}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, color: c.status === 'deceased' ? C.muted : C.text, fontFamily: serif, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title && <span style={{ fontFamily: sans, fontSize: 13, color: C.muted, marginRight: 6 }}>{c.title}</span>}
                  {c.name}{c.status === 'deceased' ? ' †' : ''}
                </span>
                {(groups.length > 0 || c.description) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 13, color: C.muted, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {groups.map(gr => <span key={gr.id} style={{ color: gr.color }}>● {gr.name}</span>)}
                    {groups.length === 0 && c.description && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</span>}
                  </span>
                )}
              </span>
              {n > 0 && <span style={{ fontSize: 13, color: C.faint, display: 'flex', alignItems: 'center', gap: 3 }}><Waypoints size={13} />{n}</span>}
            </button>
          );
        })}
        {book.characters.length === 0 && (
          <div style={{ color: C.muted, fontSize: 15, padding: '28px 4px', lineHeight: 1.5 }}>
            No characters yet. Type a name above and tap <b style={{ color: C.gold }}>Add</b> — you can fill in details later.
          </div>
        )}
        {book.characters.length > 0 && list.length === 0 && (
          <div style={{ color: C.muted, fontSize: 15, padding: '20px 4px' }}>No match — tap <b style={{ color: C.gold }}>Add</b> to add “{query.trim()}”.</div>
        )}
      </div>
    </div>
  );
}

function RelationshipsTab({ open }: { open: (s: Sheet) => void }) {
  const { book } = useBook();
  const { name } = useRelationshipText();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const other = useOtherConnections();
  const rels = [...book.relationships].reverse().filter(r =>
    !q || name(r.sourceId).toLowerCase().includes(q) || name(r.targetId).toLowerCase().includes(q) || (r.label ?? '').toLowerCase().includes(q));
  const otherFiltered = other.filter(o => !q || o.text.toLowerCase().includes(q));

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: C.faint }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by name or label" style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <button type="button" onClick={() => open({ kind: 'relationship' })} style={{ padding: '0 16px', borderRadius: 10, background: C.gold, color: '#1a1408', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={18} /> Add
        </button>
      </div>
      {rels.map(r => <RelationshipRow key={r.id} rel={r} onClick={() => open({ kind: 'relationship', id: r.id })} />)}
      {otherFiltered.length > 0 && (
        <>
          <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, margin: '22px 0 4px' }}>Family units & multi-way links (edit on the map)</div>
          {otherFiltered.map(o => (
            <div key={o.id} style={{ padding: '10px 2px', borderBottom: `1px solid ${C.border}`, fontSize: 15, color: C.text, display: 'flex', gap: 10 }}>
              <span style={{ width: 4, borderRadius: 2, background: o.color, flexShrink: 0 }} />{o.text}
            </div>
          ))}
        </>
      )}
      {rels.length + otherFiltered.length === 0 && (
        <div style={{ color: C.muted, fontSize: 15, padding: '24px 4px', lineHeight: 1.5 }}>
          {q ? 'Nothing matches.' : 'No relationships yet. Tap Add, or open a character and add one from there.'}
        </div>
      )}
    </div>
  );
}

function GroupsTab({ open }: { open: (s: Sheet) => void }) {
  const { book } = useBook();
  return (
    <div style={{ padding: '12px 16px' }}>
      <button type="button" onClick={() => open({ kind: 'group' })} style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px dashed ${C.gold}`, color: C.gold, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
        <Plus size={18} /> New group
      </button>
      {book.groups.map(g => {
        const members = book.characters.filter(c => c.groupIds?.includes(g.id));
        return (
          <button key={g.id} type="button" onClick={() => open({ kind: 'group', id: g.id })} style={{ width: '100%', textAlign: 'left', padding: '12px 2px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ width: 14, height: 14, marginTop: 4, borderRadius: g.groupType === 'circle' ? 999 : 4, background: g.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, color: C.text }}>{g.name} <span style={{ color: C.faint, fontSize: 14 }}>· {members.length}</span></span>
              <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {members.length ? members.map(m => m.name).join(', ') : 'No members yet'}
              </span>
            </span>
          </button>
        );
      })}
      {book.groups.length === 0 && <div style={{ color: C.muted, fontSize: 15, padding: '20px 4px' }}>No groups yet — e.g. a family, a household, a set of friends.</div>}
    </div>
  );
}

function BookTab({ onSwitchToFull, onDone }: { onSwitchToFull: () => void; onDone: () => void }) {
  const { book, savedBooks, loadBook, newBook, updateBookMeta, exportBook } = useBook();
  const others = [...savedBooks].filter(b => b.id !== book.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const { start: handleImport, dialog: importDialog } = useBookImport(onDone);

  return (
    <div style={{ padding: 16 }}>
      <Field label="Title">
        <input value={book.title} onChange={e => updateBookMeta({ title: e.target.value })} placeholder="Book title" style={{ ...inputStyle, fontFamily: serif, fontSize: 18 }} />
      </Field>
      <Field label="Author">
        <input value={book.author} onChange={e => updateBookMeta({ author: e.target.value })} style={inputStyle} />
      </Field>
      <Field label="Series (optional)">
        <input value={book.series ?? ''} onChange={e => updateBookMeta({ series: e.target.value })} style={inputStyle} />
      </Field>

      {others.length > 0 && (
        <>
          <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, margin: '10px 0 4px' }}>Switch book</div>
          {others.map(b => (
            <button key={b.id} type="button" onClick={() => { loadBook(b.id); onDone(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 2px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ display: 'block', fontFamily: serif, fontSize: 16, color: C.text }}>{b.title || 'Untitled'}</span>
              {b.author && <span style={{ fontSize: 13, color: C.muted }}>{b.author}</span>}
            </button>
          ))}
        </>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
        <ActionRow icon={<BookOpen size={18} />} onClick={() => { newBook(); onDone(); }}>Start a new book</ActionRow>
        <ActionRow icon={<Download size={18} />} onClick={exportBook}>Export this book (JSON)</ActionRow>
        <ActionRow icon={<Upload size={18} />} onClick={handleImport}>Import a book (JSON)</ActionRow>
        <ActionRow icon={<MapIcon size={18} />} onClick={onSwitchToFull}>Open the full map view</ActionRow>
      </div>
      <p style={{ color: C.faint, fontSize: 13, lineHeight: 1.5, marginTop: 18 }}>
        Books are saved on this device. To bring additions onto the map, export here and import on your iPad or laptop, choosing <b>Merge</b> — new characters appear in a column to the right of your existing layout.
      </p>
      {importDialog}
    </div>
  );
}

function ActionRow({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 16, textAlign: 'left' }}>
      <span style={{ color: C.gold }}>{icon}</span>{children}
    </button>
  );
}

// ── Main view ───────────────────────────────────────────────
export function QuickView({ onSwitchToFull }: { onSwitchToFull: () => void }) {
  const { book } = useBook();
  const [tab, setTab] = useState<Tab>('characters');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [stack, setStack] = useState<Sheet[]>([]);

  // Sheets can open other sheets (character → relationship); Back returns to the previous one.
  const open = (s: Sheet) => { setStack(prev => (sheet ? [...prev, sheet] : prev)); setSheet(s); };
  const close = () => { setSheet(stack[stack.length - 1] ?? null); setStack(prev => prev.slice(0, -1)); };

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = C.bg;
    return () => { document.body.style.background = prev; };
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'characters', label: 'Characters', icon: <Users size={20} />, count: book.characters.length },
    { key: 'relationships', label: 'Links', icon: <Waypoints size={20} />, count: book.relationships.length + (book.familyUnitRelationships?.length ?? 0) + (book.hubRelationships?.length ?? 0) + (book.convergingRelationships?.length ?? 0) + (book.groupRelationships?.length ?? 0) },
    { key: 'groups', label: 'Groups', icon: <span style={{ fontSize: 18, lineHeight: '20px' }}>◎</span>, count: book.groups.length },
    { key: 'book', label: 'Book', icon: <BookOpen size={20} /> },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: sans, display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '10px 16px', paddingTop: 'max(10px, env(safe-area-inset-top))', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <button type="button" onClick={() => setTab('book')} style={{ textAlign: 'left', width: '100%' }}>
          <div style={{ fontFamily: serif, fontSize: 20, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title || 'Untitled book'}</div>
          <div style={{ fontSize: 13, color: C.muted }}>{book.author || 'Tap to set title and author, or switch book'}</div>
        </button>
      </header>

      <main style={{ flex: 1, paddingBottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
        {tab === 'characters' && <CharactersTab open={open} />}
        {tab === 'relationships' && <RelationshipsTab open={open} />}
        {tab === 'groups' && <GroupsTab open={open} />}
        {tab === 'book' && <BookTab onSwitchToFull={onSwitchToFull} onDone={() => setTab('characters')} />}
      </main>

      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, display: 'flex', background: C.panel, borderTop: `1px solid ${C.border}`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{ flex: 1, padding: '8px 0 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: tab === t.key ? C.gold : C.muted, fontSize: 11 }}>
            {t.icon}
            <span>{t.label}{t.count !== undefined ? ` · ${t.count}` : ''}</span>
          </button>
        ))}
      </nav>

      {sheet?.kind === 'character' && <CharacterSheet key={sheet.id} id={sheet.id} onClose={close} openRelationship={open} />}
      {sheet?.kind === 'relationship' && <RelationshipSheet key={sheet.id ?? `new-${sheet.sourceId ?? ''}`} sheet={sheet} onClose={close} />}
      {sheet?.kind === 'group' && <GroupSheet key={sheet.id ?? 'new'} id={sheet.id} onClose={close} />}
    </div>
  );
}
