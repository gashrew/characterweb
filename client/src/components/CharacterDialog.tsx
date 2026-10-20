// ============================================================
// CharacterDialog — Add / Edit character modal
// Design: Dark Scholarly Codex
// Supports multi-group membership via checkboxes
// ============================================================
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBook } from '@/contexts/BookContext';
import type { Character, CharacterGender } from '@/lib/types';
import { GROUP_COLORS } from '@/lib/types';

const GENDER_OPTIONS: { value: CharacterGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'unknown', label: 'Unknown' },
];

const STATUS_OPTIONS = [
  { value: 'alive', label: 'Alive' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'unknown', label: 'Unknown' },
];

const PRESET_COLORS = GROUP_COLORS;

interface CharacterDialogProps {
  open: boolean;
  onClose: () => void;
  characterId?: string | null;
}

export function CharacterDialog({ open, onClose, characterId }: CharacterDialogProps) {
  const { book, addCharacter, updateCharacter } = useBook();
  const existing = characterId ? book.characters.find(c => c.id === characterId) : null;

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<CharacterGender>('unknown');
  const [age, setAge] = useState('');
  const [status, setStatus] = useState<Character['status']>('alive');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setTitle(existing.title || '');
      setDescription(existing.description || '');
      setGender(existing.gender);
      setAge(existing.age || '');
      setStatus(existing.status);
      // Support legacy groupId (single) migrating to groupIds (array)
      const legacyId = (existing as unknown as { groupId?: string }).groupId;
      setSelectedGroupIds(existing.groupIds ?? (legacyId ? [legacyId] : []));
      setColor(existing.color || '');
      setNotes(existing.notes || '');
    } else {
      setName(''); setTitle(''); setDescription(''); setGender('unknown');
      setAge(''); setStatus('alive'); setSelectedGroupIds([]); setColor(''); setNotes('');
    }
  }, [existing, open]);

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const data: Omit<Character, 'id'> = {
      name: name.trim(),
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      gender,
      age: age.trim() || undefined,
      status,
      groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
      color: color || undefined,
      notes: notes.trim() || undefined,
      x: existing?.x ?? Math.random() * 600 + 100,
      y: existing?.y ?? Math.random() * 400 + 100,
    };
    if (existing) {
      updateCharacter(existing.id, data);
    } else {
      addCharacter(data);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{
          background: '#1a2035',
          border: '1px solid #2a3350',
          color: '#e8e0d0',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif", color: '#c9a84c', fontSize: 20 }}>
            {existing ? 'Edit Character' : 'Add a Character to the Web'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name + Title row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Title / Rank</Label>
              <Input
                placeholder="Lord, Dr., Lady…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Full Name <span style={{ color: '#c94c4c' }}>*</span></Label>
              <Input
                placeholder="Character name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Description</Label>
            <Textarea
              placeholder="Brief description of this character…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13, resize: 'none' }}
            />
          </div>

          {/* Gender / Age / Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Gender</Label>
              <Select value={gender} onValueChange={v => setGender(v as CharacterGender)}>
                <SelectTrigger style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                  {GENDER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} style={{ color: '#e8e0d0' }}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Age</Label>
              <Input
                placeholder="e.g. 34"
                value={age}
                onChange={e => setAge(e.target.value)}
                style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as Character['status'])}>
                <SelectTrigger style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} style={{ color: '#e8e0d0' }}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Groups — multi-select checkboxes */}
          <div>
            <Label className="text-xs mb-1.5 block" style={{ color: '#8899aa' }}>
              Groups / Families
              <span style={{ color: '#556070', marginLeft: 6 }}>— select one or more</span>
            </Label>
            {book.groups.length === 0 ? (
              <div style={{ fontSize: 11, color: '#556070', fontStyle: 'italic' }}>
                No groups yet — create them in the Groups tab first.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {book.groups.map(g => {
                  const checked = selectedGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all"
                      style={{
                        background: checked ? `${g.color}25` : '#141824',
                        border: `1.5px solid ${checked ? g.color : '#2a3350'}`,
                        color: checked ? g.color : '#8899aa',
                        fontSize: 11,
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: checked ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: g.color, opacity: checked ? 1 : 0.4 }}
                      />
                      {g.name}
                      {checked && (
                        <span style={{ fontSize: 10, marginLeft: 2 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Node colour override */}
          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Node Colour (optional override)</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(color === c ? '' : c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    border: color === c ? '2px solid #e8e0d0' : '2px solid transparent',
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
              <input
                type="color"
                value={color || '#c9a84c'}
                onChange={e => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer"
                style={{ border: '1px solid #2a3350', background: 'transparent', padding: 0 }}
                title="Custom colour"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Notes</Label>
            <Textarea
              placeholder="Private notes, plot spoilers, etc."
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
            disabled={!name.trim()}
            style={{ background: '#c9a84c', color: '#0f1117', fontWeight: 600 }}
          >
            {existing ? 'Save Changes' : 'Add Character'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
