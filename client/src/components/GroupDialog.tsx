// ============================================================
// GroupDialog — Add / Edit group/family modal
// Design: Dark Scholarly Codex
// Supports two group types: Standard (spotlight filter) and Circle (canvas outline)
// ============================================================
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBook } from '@/contexts/BookContext';
import { GROUP_COLORS, type GroupType } from '@/lib/types';

interface GroupDialogProps {
  open: boolean;
  onClose: () => void;
  groupId?: string | null;
}

export function GroupDialog({ open, onClose, groupId }: GroupDialogProps) {
  const { book, addGroup, updateGroup } = useBook();
  const existing = groupId ? book.groups.find(g => g.id === groupId) : null;

  const [name, setName] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('standard');

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setColor(existing.color);
      setDescription(existing.description || '');
      setGroupType(existing.groupType ?? 'standard');
    } else {
      setName('');
      setColor(GROUP_COLORS[book.groups.length % GROUP_COLORS.length]);
      setDescription('');
      setGroupType('standard');
    }
  }, [existing, open, book.groups.length]);

  const handleSave = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      color,
      description: description.trim() || undefined,
      groupType,
    };
    if (existing) {
      updateGroup(existing.id, data);
    } else {
      addGroup(data);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-sm"
        style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0' }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif", color: '#c9a84c', fontSize: 20 }}>
            {existing ? 'Edit Group' : 'Create a Group'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Group Type selector */}
          <div>
            <Label className="text-xs mb-2 block" style={{ color: '#8899aa' }}>Group Type</Label>
            <div className="flex gap-2">
              {/* Standard */}
              <button
                type="button"
                onClick={() => setGroupType('standard')}
                className="flex-1 rounded-lg px-3 py-2.5 text-left transition-all"
                style={{
                  background: groupType === 'standard' ? `${color}18` : '#141824',
                  border: `1.5px solid ${groupType === 'standard' ? color + '80' : '#2a3350'}`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color, opacity: 0.7 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: groupType === 'standard' ? '#e8e0d0' : '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>Standard</span>
                </div>
                <p style={{ fontSize: 9.5, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                  Label &amp; spotlight filter. Click to show/hide on canvas.
                </p>
              </button>
              {/* Circle */}
              <button
                type="button"
                onClick={() => setGroupType('circle')}
                className="flex-1 rounded-lg px-3 py-2.5 text-left transition-all"
                style={{
                  background: groupType === 'circle' ? `${color}18` : '#141824',
                  border: `1.5px solid ${groupType === 'circle' ? color + '80' : '#2a3350'}`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {/* Mini circle outline preview */}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                    <rect x="1" y="1" width="10" height="10" rx="3" stroke={color} strokeWidth="1.5" strokeDasharray="3 1.5" fill={color} fillOpacity="0.1" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: groupType === 'circle' ? '#e8e0d0' : '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>Circle</span>
                </div>
                <p style={{ fontSize: 9.5, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                  Draws a visible outline around members on the canvas.
                </p>
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Group Name <span style={{ color: '#c94c4c' }}>*</span></Label>
            <Input
              placeholder={groupType === 'circle' ? 'e.g. The Study Group, The Inner Circle…' : 'e.g. The Bennet Family, House Stark…'}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>
              {groupType === 'circle' ? 'Boundary Line Colour' : 'Colour'}
            </Label>
            {groupType === 'circle' && (
              <p style={{ fontSize: 10, color: '#8899aa66', fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
                This colour is used for the dashed outline drawn around the circle's members on the canvas and in exports.
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {GROUP_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
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
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer"
                style={{ border: '1px solid #2a3350', background: 'transparent', padding: 0 }}
              />
            </div>
            {/* Preview */}
            {groupType === 'circle' ? (
              <div className="mt-2 rounded-lg flex items-center justify-center text-xs relative overflow-hidden"
                style={{ background: `${color}0a`, border: `2.5px dashed ${color}`, padding: '10px 16px', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="1" y="1" width="12" height="12" rx="3" stroke={color} strokeWidth="2" strokeDasharray="3 1.5" fill={color} fillOpacity="0.12" />
                </svg>
                <span style={{ color: color, fontWeight: 700, fontSize: 12, fontFamily: "'Playfair Display', serif" }}>{name || 'Circle preview'}</span>
              </div>
            ) : (
              <div className="mt-2 h-6 rounded-md flex items-center justify-center text-xs"
                style={{ background: `${color}18`, border: `1px dashed ${color}50`, color: `${color}cc` }}>
                {name || 'Group preview'}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Description</Label>
            <Textarea
              placeholder="Brief description of this group…"
              value={description}
              onChange={e => setDescription(e.target.value)}
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
            {existing ? 'Save Changes' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
