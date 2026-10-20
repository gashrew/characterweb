// ============================================================
// RelationshipDialog — Add / Edit relationship modal
// Modes: Standard (1-to-1) | Hub & Spoke (1-to-many) | To Circle Group
// Design: Dark Scholarly Codex
// ============================================================
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useBook } from '@/contexts/BookContext';
import type { RelationshipType, RelationshipLineStyle } from '@/lib/types';
import { RELATIONSHIP_TYPES } from '@/lib/types';

type DialogMode = 'standard' | 'hub' | 'converging' | 'family' | 'group';

interface RelationshipDialogProps {
  open: boolean;
  onClose: () => void;
  relationshipId?: string | null;
  sourceId?: string;
  targetId?: string;
  initialMode?: DialogMode;
}

// Small SVG previews for each line style
const LINE_STYLE_OPTIONS: { value: RelationshipLineStyle; label: string; desc: string; svgPath: string }[] = [
  {
    value: 'orthogonal',
    label: 'Orthogonal',
    desc: 'Right-angle corners — clearest for hierarchies',
    svgPath: 'M 8 28 L 8 18 L 52 18 L 52 8',
  },
  {
    value: 'curved',
    label: 'Curved',
    desc: 'Smooth bezier — good for abstract connections',
    svgPath: 'M 8 28 C 8 8, 52 28, 52 8',
  },
  {
    value: 'straight',
    label: 'Straight',
    desc: 'Direct diagonal — simplest, minimal crossings',
    svgPath: 'M 8 28 L 52 8',
  },
];

const MODE_OPTIONS: { value: DialogMode; label: string; desc: string }[] = [
  { value: 'standard', label: 'Standard', desc: 'One character → one character' },
  { value: 'hub',      label: 'Hub & Spoke', desc: 'One character → multiple characters (branching line)' },
  { value: 'converging', label: 'Shared Target', desc: 'Multiple characters → one character (merging line)' },
  { value: 'family', label: 'Family Unit', desc: 'Join two partners, then branch to children' },
  { value: 'group',    label: 'To Circle Group', desc: 'One character → a circle group boundary' },
];

export function RelationshipDialog({
  open, onClose, relationshipId, sourceId, targetId, initialMode,
}: RelationshipDialogProps) {
  const {
    book,
    addRelationship, updateRelationship,
    addHubRelationship, updateHubRelationship,
    addConvergingRelationship, updateConvergingRelationship,
    addFamilyUnitRelationship, updateFamilyUnitRelationship,
    addGroupRelationship, updateGroupRelationship,
  } = useBook();

  const existingStd = relationshipId ? book.relationships.find(r => r.id === relationshipId) : null;
  const existingHub = relationshipId ? (book.hubRelationships ?? []).find(r => r.id === relationshipId) : null;
  const existingConverging = relationshipId ? (book.convergingRelationships ?? []).find(r => r.id === relationshipId) : null;
  const existingFamily = relationshipId ? (book.familyUnitRelationships ?? []).find(r => r.id === relationshipId) : null;
  const existingGrp = relationshipId ? (book.groupRelationships ?? []).find(r => r.id === relationshipId) : null;

  // Determine initial mode
  const detectMode = (): DialogMode => {
    if (existingHub) return 'hub';
    if (existingConverging) return 'converging';
    if (existingFamily) return 'family';
    if (existingGrp) return 'group';
    return initialMode ?? 'standard';
  };

  const [mode, setMode] = useState<DialogMode>(detectMode);

  // Shared fields
  const [source, setSource] = useState(sourceId || '');
  const [type, setType] = useState<RelationshipType>('other');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  // Standard-only fields
  const [target, setTarget] = useState(targetId || '');
  const [bidirectional, setBidirectional] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [lineStyle, setLineStyle] = useState<RelationshipLineStyle>('orthogonal');

  // Hub-only fields
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [hubLineStyle, setHubLineStyle] = useState<'orthogonal' | 'curved' | 'straight'>('orthogonal');

  // Converging-only fields
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [convergingLineStyle, setConvergingLineStyle] = useState<RelationshipLineStyle>('orthogonal');

  // Family-unit fields
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [partnerLabel, setPartnerLabel] = useState('');
  const [marriageDate, setMarriageDate] = useState('');
  const [guardianshipContext, setGuardianshipContext] = useState('');
  const [familyLineStyle, setFamilyLineStyle] = useState<RelationshipLineStyle>('orthogonal');

  // Group-only fields
  const [groupId, setGroupId] = useState('');
  const [groupLineStyle, setGroupLineStyle] = useState<'orthogonal' | 'curved' | 'straight'>('orthogonal');

  const circleGroups = book.groups.filter(g => g.groupType === 'circle');

  useEffect(() => {
    if (!open) return;
    // Re-derive existing records inside the effect using fresh book state
    const freshHub = relationshipId ? (book.hubRelationships ?? []).find(r => r.id === relationshipId) : null;
    const freshConverging = relationshipId ? (book.convergingRelationships ?? []).find(r => r.id === relationshipId) : null;
    const freshFamily = relationshipId ? (book.familyUnitRelationships ?? []).find(r => r.id === relationshipId) : null;
    const freshGrp = relationshipId ? (book.groupRelationships ?? []).find(r => r.id === relationshipId) : null;
    const freshStd = relationshipId ? book.relationships.find(r => r.id === relationshipId) : null;
    const freshCircleGroups = book.groups.filter(g => g.groupType === 'circle');

    if (freshHub) {
      setMode('hub');
      setSource(freshHub.sourceId);
      setType(freshHub.type);
      setLabel(freshHub.label || '');
      setNotes(freshHub.notes || '');
      setTargetIds(freshHub.targetIds);
      setHubLineStyle(freshHub.lineStyle ?? 'orthogonal');
    } else if (freshConverging) {
      setMode('converging');
      setSourceIds(freshConverging.sourceIds);
      setTarget(freshConverging.targetId);
      setType(freshConverging.type);
      setLabel(freshConverging.label || '');
      setNotes(freshConverging.notes || '');
      setConvergingLineStyle(freshConverging.lineStyle ?? 'orthogonal');
    } else if (freshFamily) {
      setMode('family');
      setPartnerIds(freshFamily.partnerIds);
      setChildIds(freshFamily.childIds);
      setType(freshFamily.type);
      setLabel(freshFamily.label || '');
      setPartnerLabel(freshFamily.partnerLabel || '');
      setMarriageDate(freshFamily.marriageDate || '');
      setGuardianshipContext(freshFamily.guardianshipContext || '');
      setNotes(freshFamily.notes || '');
      setFamilyLineStyle(freshFamily.lineStyle ?? 'orthogonal');
    } else if (freshGrp) {
      setMode('group');
      setSource(freshGrp.sourceId);
      setType(freshGrp.type);
      setLabel(freshGrp.label || '');
      setNotes(freshGrp.notes || '');
      setGroupId(freshGrp.groupId);
      setGroupLineStyle(freshGrp.lineStyle ?? 'orthogonal');
    } else if (freshStd) {
      setMode('standard');
      setSource(freshStd.sourceId);
      setTarget(freshStd.targetId);
      setType(freshStd.type);
      setLabel(freshStd.label || '');
      setBidirectional(freshStd.bidirectional);
      setUncertain(freshStd.uncertain);
      setLineStyle(freshStd.lineStyle ?? 'orthogonal');
      setNotes(freshStd.notes || '');
    } else {
      setMode(initialMode ?? 'standard');
      setSource(sourceId || '');
      setTarget(targetId || '');
      setType('other');
      setLabel('');
      setBidirectional(false);
      setUncertain(false);
      setLineStyle('orthogonal');
      setNotes('');
      setTargetIds([]);
      setSourceIds([]);
      setPartnerIds([]);
      setChildIds([]);
      setPartnerLabel('');
      setMarriageDate('');
      setGuardianshipContext('');
      setGroupId(freshCircleGroups[0]?.id || '');
      setGroupLineStyle('orthogonal');
      setHubLineStyle('orthogonal');
      setConvergingLineStyle('orthogonal');
      setFamilyLineStyle('orthogonal');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, relationshipId, sourceId, targetId]);

  const handleSave = () => {
    const shared = {
      type,
      label: label.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (mode === 'hub') {
      if (!source) return;
      if (targetIds.length < 2) return;
      if (existingHub) {
        updateHubRelationship(existingHub.id, { ...shared, sourceId: source, targetIds, lineStyle: hubLineStyle });
      } else {
        addHubRelationship({ ...shared, sourceId: source, targetIds, lineStyle: hubLineStyle });
      }
    } else if (mode === 'converging') {
      if (sourceIds.length < 2 || !target) return;
      const data = { ...shared, sourceIds, targetId: target, lineStyle: convergingLineStyle };
      if (existingConverging) updateConvergingRelationship(existingConverging.id, data);
      else addConvergingRelationship(data);
    } else if (mode === 'family') {
      if (partnerIds.length !== 2 || childIds.length === 0) return;
      const data = { ...shared, partnerIds, childIds, partnerLabel: partnerLabel.trim() || undefined, marriageDate: marriageDate.trim() || undefined, guardianshipContext: guardianshipContext.trim() || undefined, lineStyle: familyLineStyle };
      if (existingFamily) updateFamilyUnitRelationship(existingFamily.id, data);
      else addFamilyUnitRelationship(data);
    } else if (mode === 'group') {
      if (!source) return;
      if (!groupId) return;
      if (existingGrp) {
        updateGroupRelationship(existingGrp.id, { ...shared, sourceId: source, groupId, lineStyle: groupLineStyle });
      } else {
        addGroupRelationship({ ...shared, sourceId: source, groupId, lineStyle: groupLineStyle });
      }
    } else {
      if (!source) return;
      if (!target) return;
      const data = { ...shared, sourceId: source, targetId: target, bidirectional, uncertain, lineStyle };
      if (existingStd) {
        updateRelationship(existingStd.id, data);
      } else {
        addRelationship(data);
      }
    }
    onClose();
  };

  const isEditing = !!(existingStd || existingHub || existingConverging || existingFamily || existingGrp);
  const typeInfo = RELATIONSHIP_TYPES[type];

  const canSave = () => {
    if (mode === 'hub') return targetIds.length >= 2;
    if (mode === 'converging') return sourceIds.length >= 2 && !!target;
    if (mode === 'family') return partnerIds.length === 2 && childIds.length > 0;
    if (mode === 'group') return !!groupId;
    return !!source && !!target;
  };

  const toggleTargetId = (id: string) => {
    setTargetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSourceId = (id: string) => {
    setSourceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const togglePartnerId = (id: string) => {
    setPartnerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 2 ? [...prev.slice(1), id] : [...prev, id]);
  };

  const toggleChildId = (id: string) => {
    setChildIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg"
        style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif", color: '#c9a84c', fontSize: 20 }}>
            {isEditing ? 'Edit Relationship' : 'Add a Relationship'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Mode selector — only shown when creating */}
          {!isEditing && (
            <div>
              <Label className="text-xs mb-2 block" style={{ color: '#8899aa' }}>Relationship Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODE_OPTIONS.map(opt => {
                  const isActive = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className="flex flex-col items-start gap-1 rounded-lg p-2.5 transition-all text-left"
                      style={{
                        background: isActive ? '#c9a84c18' : '#141824',
                        border: `1.5px solid ${isActive ? '#c9a84c' : '#2a3350'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#c9a84c' : '#e8e0d0',
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.3 }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source character — single-source modes */}
          {mode !== 'converging' && mode !== 'family' && <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>
              From Character <span style={{ color: '#c94c4c' }}>*</span>
            </Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                {book.characters.map(c => (
                  <SelectItem key={c.id} value={c.id} style={{ color: '#e8e0d0' }}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>}

          {/* Standard: single target */}
          {mode === 'standard' && (
            <div>
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>
                To Character <span style={{ color: '#c94c4c' }}>*</span>
              </Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                  {book.characters.filter(c => c.id !== source).map(c => (
                    <SelectItem key={c.id} value={c.id} style={{ color: '#e8e0d0' }}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Shared Target: multi-select sources converge into one character */}
          {mode === 'converging' && (
            <>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>
                  From Characters (select 2 or more) <span style={{ color: '#c94c4c' }}>*</span>
                </Label>
                <div className="rounded-lg p-2 flex flex-col gap-1" style={{ background: '#141824', border: '1px solid #2a3350', maxHeight: 160, overflowY: 'auto' }}>
                  {book.characters.filter(character => character.id !== target).map(character => {
                    const checked = sourceIds.includes(character.id);
                    return (
                      <label key={character.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer" style={{ background: checked ? `${typeInfo.color}18` : 'transparent', border: `1px solid ${checked ? typeInfo.color + '55' : 'transparent'}` }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSourceId(character.id)} style={{ accentColor: typeInfo.color }} />
                        <span style={{ fontSize: 13, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif" }}>{character.name}</span>
                      </label>
                    );
                  })}
                </div>
                {sourceIds.length > 0 && sourceIds.length < 2 && <p style={{ fontSize: 11, color: '#e07b39', marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>Select at least two source characters.</p>}
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>
                  Shared Target Character <span style={{ color: '#c94c4c' }}>*</span>
                </Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}>
                    <SelectValue placeholder="Select child or shared target…" />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                    {book.characters.filter(character => !sourceIds.includes(character.id)).map(character => (
                      <SelectItem key={character.id} value={character.id} style={{ color: '#e8e0d0' }}>{character.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sourceIds.length >= 2 && target && <p style={{ fontSize: 11, color: typeInfo.color, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{sourceIds.length} sources will merge into one shared connector.</p>}
              </div>
            </>
          )}

          {/* Family Unit: exactly two partners joined before branching to children */}
          {mode === 'family' && (
            <>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Partners (select 2) <span style={{ color: '#c94c4c' }}>*</span></Label>
                <div className="rounded-lg p-2 flex flex-col gap-1" style={{ background: '#141824', border: '1px solid #2a3350', maxHeight: 140, overflowY: 'auto' }}>
                  {book.characters.filter(character => !childIds.includes(character.id)).map(character => {
                    const checked = partnerIds.includes(character.id);
                    return <label key={character.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer" style={{ background: checked ? `${typeInfo.color}18` : 'transparent', border: `1px solid ${checked ? typeInfo.color + '55' : 'transparent'}` }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePartnerId(character.id)} style={{ accentColor: typeInfo.color }} />
                      <span style={{ fontSize: 13, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif" }}>{character.name}</span>
                    </label>;
                  })}
                </div>
                <p style={{ fontSize: 10, color: partnerIds.length === 2 ? typeInfo.color : '#556070', marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{partnerIds.length}/2 partners selected{partnerIds.length === 2 ? ' — their link becomes the family unit.' : ''}</p>
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Children (select one or more) <span style={{ color: '#c94c4c' }}>*</span></Label>
                <div className="rounded-lg p-2 flex flex-col gap-1" style={{ background: '#141824', border: '1px solid #2a3350', maxHeight: 160, overflowY: 'auto' }}>
                  {book.characters.filter(character => !partnerIds.includes(character.id)).map(character => {
                    const checked = childIds.includes(character.id);
                    return <label key={character.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer" style={{ background: checked ? `${typeInfo.color}18` : 'transparent', border: `1px solid ${checked ? typeInfo.color + '55' : 'transparent'}` }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleChildId(character.id)} style={{ accentColor: typeInfo.color }} />
                      <span style={{ fontSize: 13, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif" }}>{character.name}</span>
                    </label>;
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Partner Link Label (optional)</Label>
                <Input placeholder='e.g. "married", "partners"' value={partnerLabel} onChange={event => setPartnerLabel(event.target.value)} style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }} />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Marriage / partnership date (optional)</Label>
                <Input placeholder='e.g. 1885, Spring 1891' value={marriageDate} onChange={event => setMarriageDate(event.target.value)} style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }} />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Guardianship context (optional)</Label>
                <Input placeholder='e.g. guardian after 1893' value={guardianshipContext} onChange={event => setGuardianshipContext(event.target.value)} style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }} />
              </div>
            </>
          )}

          {/* Hub: multi-select targets */}
          {mode === 'hub' && (
            <div>
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>
                To Characters (select 2 or more) <span style={{ color: '#c94c4c' }}>*</span>
              </Label>
              <div
                className="rounded-lg p-2 flex flex-col gap-1"
                style={{ background: '#141824', border: '1px solid #2a3350', maxHeight: 180, overflowY: 'auto' }}
              >
                {book.characters.filter(c => c.id !== source).map(c => {
                  const checked = targetIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
                      style={{
                        background: checked ? `${typeInfo.color}18` : 'transparent',
                        border: `1px solid ${checked ? typeInfo.color + '55' : 'transparent'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTargetId(c.id)}
                        style={{ accentColor: typeInfo.color }}
                      />
                      <span style={{ fontSize: 13, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif" }}>
                        {c.name}
                        {c.title && <span style={{ color: '#8899aa', marginLeft: 4 }}>{c.title}</span>}
                      </span>
                    </label>
                  );
                })}
                {book.characters.filter(c => c.id !== source).length === 0 && (
                  <p style={{ fontSize: 12, color: '#556070', padding: '4px 8px' }}>No other characters available.</p>
                )}
              </div>
              {targetIds.length > 0 && targetIds.length < 2 && (
                <p style={{ fontSize: 11, color: '#e07b39', marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                  Select at least 2 targets for a hub-and-spoke relationship.
                </p>
              )}
              {targetIds.length >= 2 && (
                <p style={{ fontSize: 11, color: typeInfo.color, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                  {targetIds.length} targets selected — will draw a branching line.
                </p>
              )}
            </div>
          )}

          {/* Group: circle group select */}
          {mode === 'group' && (
            <div>
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>
                To Circle Group <span style={{ color: '#c94c4c' }}>*</span>
              </Label>
              {circleGroups.length === 0 ? (
                <p style={{ fontSize: 12, color: '#e07b39', fontFamily: "'DM Sans', sans-serif" }}>
                  No circle groups exist yet. Create a Circle-type group in the Groups tab first.
                </p>
              ) : (
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}>
                    <SelectValue placeholder="Select circle group…" />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                    {circleGroups.map(g => (
                      <SelectItem key={g.id} value={g.id} style={{ color: '#e8e0d0' }}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                          {g.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Relationship type — always shown */}
          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Relationship Type</Label>
            <Select value={type} onValueChange={v => setType(v as RelationshipType)}>
              <SelectTrigger style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                {Object.entries(RELATIONSHIP_TYPES).map(([key, info]) => (
                  <SelectItem key={key} value={key} style={{ color: '#e8e0d0' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: info.color }} />
                      {info.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-1.5 h-1 rounded-full" style={{ background: typeInfo.color, opacity: 0.6 }} />
          </div>

          {/* Custom label — always shown */}
          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Custom Label (optional)</Label>
            <Input
              placeholder={mode === 'hub' ? `e.g. "parent of", "tutor of"` : mode === 'converging' || mode === 'family' ? `e.g. "parents of", "guardians of"` : mode === 'group' ? `e.g. "leads", "member of"` : `e.g. "father of", "married to"`}
              value={label}
              onChange={e => setLabel(e.target.value)}
              style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
            />
          </div>

          {/* Line style — standard, hub, converging, family, and group modes */}
          {(mode === 'standard' || mode === 'hub' || mode === 'converging' || mode === 'family' || mode === 'group') && (
            <div>
              <Label className="text-xs mb-2 block" style={{ color: '#8899aa' }}>Line Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {LINE_STYLE_OPTIONS.map(opt => {
                  const activeStyle = mode === 'group' ? groupLineStyle : mode === 'hub' ? hubLineStyle : mode === 'converging' ? convergingLineStyle : mode === 'family' ? familyLineStyle : lineStyle;
                  const isActive = activeStyle === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (mode === 'group') setGroupLineStyle(opt.value as 'orthogonal' | 'curved' | 'straight');
                        else if (mode === 'hub') setHubLineStyle(opt.value as 'orthogonal' | 'curved' | 'straight');
                        else if (mode === 'converging') setConvergingLineStyle(opt.value);
                        else if (mode === 'family') setFamilyLineStyle(opt.value);
                        else setLineStyle(opt.value);
                      }}
                      className="flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all"
                      style={{
                        background: isActive ? `${typeInfo.color}18` : '#141824',
                        border: `1.5px solid ${isActive ? typeInfo.color : '#2a3350'}`,
                        cursor: 'pointer',
                      }}
                      title={opt.desc}
                    >
                      <svg width="60" height="36" viewBox="0 0 60 36" fill="none" style={{ overflow: 'visible' }}>
                        <rect x="0" y="22" width="16" height="12" rx="2"
                          fill="#1a2035" stroke={isActive ? typeInfo.color : '#4a5568'} strokeWidth="1.5" />
                        <rect x="44" y="2" width="16" height="12" rx="2"
                          fill="#1a2035" stroke={isActive ? typeInfo.color : '#4a5568'} strokeWidth="1.5" />
                        <path
                          d={opt.svgPath}
                          stroke={isActive ? typeInfo.color : '#4a5568'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                        <polygon
                          points="52,4 48,8 56,8"
                          fill={isActive ? typeInfo.color : '#4a5568'}
                          transform="translate(0,-4)"
                        />
                      </svg>
                      <span style={{
                        fontSize: 10,
                        fontWeight: isActive ? 700 : 400,
                        color: isActive ? typeInfo.color : '#8899aa',
                        fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: '0.02em',
                      }}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: '#556070', marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                {LINE_STYLE_OPTIONS.find(o => o.value === (mode === 'group' ? groupLineStyle : mode === 'hub' ? hubLineStyle : mode === 'converging' ? convergingLineStyle : mode === 'family' ? familyLineStyle : lineStyle))?.desc}
              </div>
            </div>
          )}

          {/* Toggles — standard only */}
          {mode === 'standard' && (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={bidirectional} onCheckedChange={setBidirectional} id="bidir" />
                <Label htmlFor="bidir" className="text-sm cursor-pointer" style={{ color: '#e8e0d0' }}>Bidirectional</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={uncertain} onCheckedChange={setUncertain} id="uncertain" />
                <Label htmlFor="uncertain" className="text-sm cursor-pointer" style={{ color: '#e8e0d0' }}>Uncertain / rumoured</Label>
              </div>
            </div>
          )}

          {/* Notes — always shown */}
          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Notes</Label>
            <Textarea
              placeholder="Context, page references, spoilers…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13, resize: 'none' }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} style={{ color: '#8899aa' }}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!canSave()}
            style={{ background: '#c9a84c', color: '#0f1117', fontWeight: 600 }}
          >
            {isEditing ? 'Save Changes' : 'Add Relationship'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
