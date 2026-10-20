// ============================================================
// CharacterNode — Custom ReactFlow node (rectangle, full name, auto-width)
// Design: Dark Scholarly Codex
// Right-click context menu: Edit, Focus, Hide, Add Relationship, Add to Circle
// ============================================================
import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Character } from '@/lib/types';
import { useBook } from '@/contexts/BookContext';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Pencil, Crosshair, EyeOff, GitBranch, Circle } from 'lucide-react';

interface CharacterNodeData extends Record<string, unknown> {
  character: Character;
  groupColor?: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  isAddingRelSource: boolean;
  routingPorts?: Array<{ left: number; top: number; relationshipId: string }>;
  routingDebug?: boolean;
  onRoutingPortHover?: (relationshipId: string | null) => void;
}

const GENDER_ICONS: Record<string, string> = {
  male: '♂',
  female: '♀',
  'non-binary': '⚧',
  unknown: '',
};

// ── Auto-sizing ──────────────────────────────────────────────
// Approximate character width in Playfair Display at 13px ≈ 8px/char
// Minimum 110px, maximum 220px, with padding for accent bar + gender symbol
export function calcNodeWidth(name: string, _title?: string): number {
  const nameChars = name.length;
  // 8px per char at base font size, plus 36px for left accent bar + gender symbol + padding
  const raw = nameChars * 8 + 36;
  return Math.min(Math.max(raw, 110), 220);
}

const NODE_H = 36;

// Menu item style helper
const menuItemStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12,
  cursor: 'pointer',
};

export const CharacterNode = memo(function CharacterNode({ data }: NodeProps) {
  const nodeData = data as CharacterNodeData;
  const { character, groupColor, isSelected, isHighlighted, isDimmed, isAddingRelSource, routingPorts = [], routingDebug = false, onRoutingPortHover } = nodeData;
  const {
    book,
    setSelectedCharacterId, setEditingCharacterId,
    isAddingRelationship, setRelationshipSourceId, setIsAddingRelationship, setSidebarTab,
    setFocusedCharacterId,
    toggleCharacterVisibility,
    updateCharacter,
  } = useBook();

  const ringColor = character.color || groupColor || '#c9a84c';
  const isDeceased = character.status === 'deceased';
  const nodeW = calcNodeWidth(character.name, character.title);

  // Circle groups this character could be added to / removed from
  const circleGroups = book.groups.filter(g => g.groupType === 'circle');

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAddingRelationship) {
      setRelationshipSourceId(character.id);
      setIsAddingRelationship(false);
    } else {
      setSelectedCharacterId(character.id);
      setSidebarTab('characters');
    }
  }, [character.id, isAddingRelationship, setRelationshipSourceId, setIsAddingRelationship, setSelectedCharacterId, setSidebarTab]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCharacterId(character.id);
  }, [character.id, setEditingCharacterId]);

  const borderColor = isAddingRelSource
    ? '#4cb8c9'
    : isSelected
    ? ringColor
    : isHighlighted
    ? `${ringColor}cc`
    : `${ringColor}60`;

  const glowShadow = isAddingRelSource
    ? `0 0 0 2px #4cb8c9, 0 0 16px 4px #4cb8c940, 0 4px 16px rgba(0,0,0,0.5)`
    : isSelected
    ? `0 0 0 2px ${ringColor}, 0 0 20px 6px ${ringColor}50, 0 4px 16px rgba(0,0,0,0.5)`
    : isHighlighted
    ? `0 0 0 1px ${ringColor}80, 0 0 12px 3px ${ringColor}25, 0 4px 12px rgba(0,0,0,0.4)`
    : `0 2px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`;

  // Font size scales down slightly for very long names
  const nameFontSize = character.name.length > 20 ? 11 : character.name.length > 14 ? 12 : 13;

  const nodeBox = (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        width: nodeW,
        height: NODE_H,
        opacity: isDimmed ? 0.2 : 1,
        transition: 'opacity 200ms ease, box-shadow 150ms ease',
        cursor: isAddingRelationship ? 'crosshair' : 'pointer',
        position: 'relative',
        borderRadius: 6,
        background: isSelected
          ? `linear-gradient(135deg, #1e2840, #1a2035)`
          : `linear-gradient(135deg, #1c2238, #161d2e)`,
        border: `1.5px solid ${borderColor}`,
        boxShadow: glowShadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        filter: isDeceased ? 'grayscale(0.5)' : undefined,
        userSelect: 'none',
        overflow: 'visible',
      }}
    >
      {/* ── Handles: one per side, centred — Freeform-style attachment ── */}
      <Handle type="source" position={Position.Top}    id="t" style={{ opacity: 0, width: 10, height: 10, top: -5,    left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Top}    id="t" style={{ opacity: 0, width: 10, height: 10, top: -5,    left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0, width: 10, height: 10, bottom: -5, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Bottom} id="b" style={{ opacity: 0, width: 10, height: 10, bottom: -5, left: '50%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Left}   id="l" style={{ opacity: 0, width: 10, height: 10, left: -5,   top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="target" position={Position.Left}   id="l" style={{ opacity: 0, width: 10, height: 10, left: -5,   top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Right}  id="r" style={{ opacity: 0, width: 10, height: 10, right: -5,  top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="target" position={Position.Right}  id="r" style={{ opacity: 0, width: 10, height: 10, right: -5,  top: '50%', transform: 'translateY(-50%)' }} />

      {/* Optional distributed attachment markers for dense relationship routing */}
      {routingPorts.map((port, index) => (
        <span
          key={`${port.left.toFixed(1)}-${port.top.toFixed(1)}-${index}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${port.left}%`, top: `${port.top}%`,
            width: routingDebug ? 13 : 5, height: routingDebug ? 13 : 5, borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            background: routingDebug ? '#0f1424ee' : '#0f1424', border: `1.25px solid ${ringColor}`,
            boxShadow: `0 0 5px ${ringColor}90`,
            pointerEvents: routingDebug ? 'auto' : 'none', cursor: routingDebug ? 'crosshair' : 'default', zIndex: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: ringColor, fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fontWeight: 800,
          }}
          onMouseEnter={() => routingDebug && onRoutingPortHover?.(port.relationshipId)}
          onMouseLeave={() => routingDebug && onRoutingPortHover?.(null)}
        >{routingDebug ? index + 1 : null}</span>
      ))}

      {/* Deceased diagonal stripe */}
      {isDeceased && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 5,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.15) 6px, rgba(0,0,0,0.15) 7px)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Coloured left accent bar */}
      <div style={{
        position: 'absolute',
        left: 0, top: 5, bottom: 5,
        width: 3,
        borderRadius: '0 2px 2px 0',
        background: ringColor,
        opacity: isSelected ? 1 : 0.75,
      }} />

      {/* Name + gender symbol + deceased dagger — single compact row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 12,
        paddingRight: 8,
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: nameFontSize,
          fontWeight: 600,
          color: isSelected ? '#fff' : '#e8e0d0',
          lineHeight: 1,
          transition: 'color 150ms',
        }}>
          {character.name}
        </span>
        {(GENDER_ICONS[character.gender] || isDeceased) && (
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 10,
            color: `${ringColor}88`,
            lineHeight: 1,
            flexShrink: 0,
          }}>
            {GENDER_ICONS[character.gender] || ''}{isDeceased ? '†' : ''}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {nodeBox}
      </ContextMenuTrigger>
      <ContextMenuContent
        style={{
          background: '#1a2035',
          border: '1px solid #2a3350',
          borderRadius: 8,
          minWidth: 180,
          padding: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Character name header */}
        <div style={{
          padding: '6px 10px 4px',
          fontFamily: "'Playfair Display', serif",
          fontSize: 13,
          fontWeight: 700,
          color: ringColor,
          borderBottom: '1px solid #2a3350',
          marginBottom: 2,
        }}>
          {character.name}
        </div>

        {/* Edit */}
        <ContextMenuItem
          style={menuItemStyle}
          onSelect={() => setEditingCharacterId(character.id)}
        >
          <Pencil size={12} style={{ marginRight: 8, color: '#c9a84c' }} />
          Edit details
        </ContextMenuItem>

        {/* Focus */}
        <ContextMenuItem
          style={menuItemStyle}
          onSelect={() => {
            setFocusedCharacterId(character.id);
            setSidebarTab('characters');
          }}
        >
          <Crosshair size={12} style={{ marginRight: 8, color: '#4cb8c9' }} />
          Focus on this character
        </ContextMenuItem>

        {/* Add relationship from here */}
        <ContextMenuItem
          style={menuItemStyle}
          onSelect={() => {
            setIsAddingRelationship(true);
            setRelationshipSourceId(character.id);
            setSidebarTab('relationships');
          }}
        >
          <GitBranch size={12} style={{ marginRight: 8, color: '#6ec98b' }} />
          Add relationship from here
        </ContextMenuItem>

        <ContextMenuSeparator style={{ background: '#2a3350', margin: '3px 0' }} />

        {/* Add to / Remove from Circle */}
        {circleGroups.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger style={menuItemStyle}>
              <Circle size={12} style={{ marginRight: 8, color: '#c9a84c' }} />
              Add / remove from circle
            </ContextMenuSubTrigger>
            <ContextMenuSubContent
              style={{
                background: '#1a2035',
                border: '1px solid #2a3350',
                borderRadius: 8,
                minWidth: 160,
                padding: '4px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              {circleGroups.map(group => {
                const isMember = character.groupIds?.includes(group.id) ?? false;
                return (
                  <ContextMenuItem
                    key={group.id}
                    style={menuItemStyle}
                    onSelect={() => {
                      const current = character.groupIds ?? [];
                      const next = isMember
                        ? current.filter(id => id !== group.id)
                        : [...current, group.id];
                      updateCharacter(character.id, { groupIds: next });
                    }}
                  >
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isMember ? group.color : 'transparent',
                        border: `1.5px solid ${group.color}`,
                        marginRight: 8, flexShrink: 0,
                      }}
                    />
                    <span style={{ color: isMember ? '#e8e0d0' : '#8899aa' }}>
                      {isMember ? '✓ ' : ''}{group.name}
                    </span>
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator style={{ background: '#2a3350', margin: '3px 0' }} />

        {/* Hide */}
        <ContextMenuItem
          style={{ ...menuItemStyle, color: '#c94c4c' }}
          onSelect={() => toggleCharacterVisibility(character.id)}
        >
          <EyeOff size={12} style={{ marginRight: 8 }} />
          Hide this character
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
