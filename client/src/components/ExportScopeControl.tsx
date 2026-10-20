// ============================================================
// ExportScopeControl — compact export framing chooser
// Design: Dark Scholarly Codex — explicit, practical controls
// ============================================================
import { CircleDot, Focus, Maximize2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Group } from '@/lib/types';

export type ExportScope = 'all' | 'focus' | 'circle';

interface ExportScopeControlProps {
  scope: ExportScope;
  onScopeChange: (scope: ExportScope) => void;
  characters: Array<{ id: string; name: string }>;
  focusCharacterId: string | null;
  onFocusCharacterChange: (characterId: string) => void;
  groups: Group[];
  groupId: string | null;
  onGroupChange: (groupId: string) => void;
}

export function ExportScopeControl({
  scope,
  onScopeChange,
  characters,
  focusCharacterId,
  onFocusCharacterChange,
  groups,
  groupId,
  onGroupChange,
}: ExportScopeControlProps) {
  const focusedCharacterName = characters.find(character => character.id === focusCharacterId)?.name;
  const buttonStyle = (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 8px',
    borderRadius: 6,
    border: `1px solid ${active ? '#c9a84c70' : '#3a4560'}`,
    background: active ? '#c9a84c18' : '#1e2535',
    color: active ? '#c9a84c' : '#8899aa',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 10,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Export frame
        </span>
        <span style={{ fontSize: 10, color: '#556677', fontFamily: "'DM Sans', sans-serif" }}>
          Fits the selected content
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" onClick={() => onScopeChange('all')} style={buttonStyle(scope === 'all')}>
          <Maximize2 size={11} /> Visible map
        </button>
        <button
          type="button"
          onClick={() => { if (characters.length) { if (!focusCharacterId) onFocusCharacterChange(characters[0].id); onScopeChange('focus'); } }}
          disabled={characters.length === 0}
          title={characters.length ? 'Choose a character cluster for this export' : 'Create a character first'}
          style={{ ...buttonStyle(scope === 'focus'), opacity: characters.length ? 1 : 0.4, cursor: characters.length ? 'pointer' : 'not-allowed' }}
        >
          <Focus size={11} /> Focus a character
        </button>
        <button
          type="button"
          onClick={() => { if (groups.length) { if (!groupId) onGroupChange(groups[0].id); onScopeChange('circle'); } }}
          disabled={groups.length === 0}
          title={groups.length > 0 ? 'Choose a group for this export' : 'Create a group first'}
          style={{ ...buttonStyle(scope === 'circle'), opacity: groups.length > 0 ? 1 : 0.4, cursor: groups.length ? 'pointer' : 'not-allowed' }}
        >
          <CircleDot size={11} /> Group selection
        </button>
      </div>

      {scope === 'focus' && (
        <select
          value={focusCharacterId ?? ''}
          onChange={event => onFocusCharacterChange(event.target.value)}
          style={{ width: '100%', background: '#111724', border: '1px solid #3a4560', color: '#e8e0d0', borderRadius: 6, padding: '6px 8px', outline: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}
        >
          {characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
      )}
      {scope === 'focus' && focusedCharacterName && (
        <p style={{ margin: 0, color: '#718198', fontSize: 10, lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>
          Exporting <strong style={{ color: '#c9a84c' }}>{focusedCharacterName}</strong> and their directly connected cluster.
        </p>
      )}

      {scope === 'circle' && (
        <select
          value={groupId ?? ''}
          onChange={event => onGroupChange(event.target.value)}
          style={{
            width: '100%',
            background: '#111724',
            border: '1px solid #3a4560',
            color: '#e8e0d0',
            borderRadius: 6,
            padding: '6px 8px',
            outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
          }}
        >
          {groups.map(group => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
