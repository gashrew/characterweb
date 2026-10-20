// ============================================================
// CharacterDetailPanel — Floating info panel for selected character
// Design: Dark Scholarly Codex
// ============================================================
import { X, Pencil, Trash2, GitBranch, Focus, Expand } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface CharacterDetailPanelProps {
  onEdit: (id: string) => void;
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Male', female: 'Female', 'non-binary': 'Non-binary', unknown: 'Unknown',
};

export function CharacterDetailPanel({ onEdit }: CharacterDetailPanelProps) {
  const {
    book, selectedCharacterId, setSelectedCharacterId,
    deleteCharacter, setEditingRelationshipId, setSidebarTab,
    focusedCharacterId, setFocusedCharacterId,
  } = useBook();

  const isFocused = focusedCharacterId === selectedCharacterId;

  if (!selectedCharacterId) return null;
  const char = book.characters.find(c => c.id === selectedCharacterId);
  if (!char) return null;

  // Multi-group: collect all groups this character belongs to
  const charGroups = char.groupIds && char.groupIds.length > 0
    ? book.groups.filter(g => char.groupIds!.includes(g.id))
    : [];
  const group = charGroups[0]; // first group used for accent colour
  const ringColor = char.color || group?.color || '#c9a84c';

  // All relationships involving this character
  const rels = book.relationships.filter(
    r => r.sourceId === selectedCharacterId || r.targetId === selectedCharacterId
  );

  return (
    <div
      className="absolute bottom-6 left-6 z-50 rounded-xl overflow-hidden"
      style={{
        width: 320,
        background: '#1a2035ee',
        border: `1px solid ${ringColor}40`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${ringColor}20`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-3 pb-2" style={{ borderBottom: `1px solid ${ringColor}20` }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: `radial-gradient(circle at 35% 35%, #2a3350, #1a2035)`,
              border: `2px solid ${ringColor}`,
              fontFamily: "'Playfair Display', serif",
              fontSize: 12,
              fontWeight: 700,
              color: '#e8e0d0',
            }}
          >
            {char.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            {char.title && (
              <div style={{ fontSize: 9, color: `${ringColor}99`, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
                {char.title}
              </div>
            )}
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: '#e8e0d0', lineHeight: 1.2 }}>
              {char.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {charGroups.length > 0 && (
                <span className="flex items-center gap-1 flex-wrap">
                  {charGroups.map(g => (
                    <span key={g.id} className="flex items-center gap-1" style={{ fontSize: 10, color: g.color, fontFamily: "'DM Sans', sans-serif" }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: g.color }} />
                      {g.name}
                    </span>
                  ))}
                </span>
              )}
              <span style={{ fontSize: 10, color: '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>
                {GENDER_LABELS[char.gender]}
                {char.age ? ` · ${char.age}` : ''}
              </span>
              {char.status === 'deceased' && (
                <span style={{ fontSize: 10, color: '#c94c4c', fontFamily: "'DM Sans', sans-serif" }}>† Deceased</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setSelectedCharacterId(null)}
          className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
          style={{ color: '#8899aa' }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Description */}
      {char.description && (
        <div className="px-3 py-2" style={{ borderBottom: '1px solid #2a3350' }}>
          <p style={{ fontSize: 11, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
            {char.description}
          </p>
        </div>
      )}

      {/* Relationships */}
      {rels.length > 0 && (
        <div className="px-3 py-2" style={{ borderBottom: '1px solid #2a3350' }}>
          <div style={{ fontSize: 9, color: '#8899aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
            Connections ({rels.length})
          </div>
          <div className="flex flex-col gap-1">
            {rels.slice(0, 5).map(rel => {
              const otherId = rel.sourceId === selectedCharacterId ? rel.targetId : rel.sourceId;
              const other = book.characters.find(c => c.id === otherId);
              const typeInfo = RELATIONSHIP_TYPES[rel.type];
              return (
                <button
                  key={rel.id}
                  className="flex items-center gap-2 text-left rounded px-1.5 py-1 hover:bg-white/5 transition-colors w-full"
                  onClick={() => { setEditingRelationshipId(rel.id); setSidebarTab('relationships'); }}
                >
                  <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                  <span style={{ fontSize: 11, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {other?.name || '?'}
                  </span>
                  <span style={{ fontSize: 9, color: typeInfo.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {rel.label || typeInfo.label}
                  </span>
                </button>
              );
            })}
            {rels.length > 5 && (
              <div style={{ fontSize: 10, color: '#8899aa', paddingLeft: 6 }}>+{rels.length - 5} more…</div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {char.notes && (
        <div className="px-3 py-2" style={{ borderBottom: '1px solid #2a3350' }}>
          <div style={{ fontSize: 9, color: '#8899aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Notes</div>
          <p style={{ fontSize: 11, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, fontStyle: 'italic' }}>
            {char.notes}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-7"
            style={{ background: '#c9a84c20', border: '1px solid #c9a84c40', color: '#c9a84c', fontSize: 11 }}
            onClick={() => onEdit(char.id)}
          >
            <Pencil size={11} /> Edit
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-7"
            style={{ background: '#4cb8c920', border: '1px solid #4cb8c940', color: '#4cb8c9', fontSize: 11 }}
            onClick={() => { setSidebarTab('relationships'); }}
          >
            <GitBranch size={11} /> Relations
          </Button>
          <Button
            size="sm"
            className="h-7 px-2"
            style={{ background: '#c94c4c20', border: '1px solid #c94c4c40', color: '#c94c4c' }}
            onClick={() => deleteCharacter(char.id)}
          >
            <Trash2 size={11} />
          </Button>
        </div>
        {/* Focus mode toggle */}
        <Button
          size="sm"
          className="w-full gap-1.5 h-7"
          style={{
            background: isFocused ? '#c9a84c30' : '#1e2535',
            border: `1px solid ${isFocused ? '#c9a84c80' : '#3a4560'}`,
            color: isFocused ? '#c9a84c' : '#8899aa',
            fontSize: 11,
            transition: 'all 150ms',
          }}
          onClick={() => setFocusedCharacterId(isFocused ? null : char.id)}
        >
          {isFocused ? <Expand size={11} /> : <Focus size={11} />}
          {isFocused ? 'Show all characters' : 'Focus — show only this character & connections'}
        </Button>
      </div>
    </div>
  );
}
