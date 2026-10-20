// ============================================================
// LayoutThumbnail — compact visual signature for a saved map arrangement
// Design: Dark Scholarly Codex with a restrained miniature star-chart view.
// ============================================================
import type { Character } from '@/lib/types';
import { calcNodeWidth } from './CharacterNode';

interface LayoutThumbnailProps {
  characters: Character[];
  positions: Record<string, { x: number; y: number }>;
  active?: boolean;
}

export function LayoutThumbnail({ characters, positions, active = false }: LayoutThumbnailProps) {
  const placed = characters.filter(character => positions[character.id]);
  if (placed.length === 0) return <div className="w-[72px] h-[46px] rounded" style={{ background: '#0d1020', border: `1px solid ${active ? '#4cb8c970' : '#2a3350'}` }} />;

  const minX = Math.min(...placed.map(character => positions[character.id].x));
  const maxX = Math.max(...placed.map(character => positions[character.id].x + calcNodeWidth(character.name, character.title)));
  const minY = Math.min(...placed.map(character => positions[character.id].y));
  const maxY = Math.max(...placed.map(character => positions[character.id].y + 36));
  const worldW = Math.max(1, maxX - minX);
  const worldH = Math.max(1, maxY - minY);
  const pad = 5;
  const innerW = 70, innerH = 42;
  const scale = Math.min(innerW / worldW, innerH / worldH);

  return <svg viewBox="0 0 80 52" className="w-[72px] h-[46px] rounded flex-shrink-0" style={{ background: '#0d1020', border: `1px solid ${active ? '#4cb8c970' : '#2a3350'}` }} aria-label="Layout preview">
    <rect x="0" y="0" width="80" height="52" fill="#0d1020" />
    {placed.map(character => {
      const position = positions[character.id];
      const w = Math.max(5, calcNodeWidth(character.name, character.title) * scale);
      const h = Math.max(3, 36 * scale);
      const x = pad + (position.x - minX) * scale;
      const y = pad + (position.y - minY) * scale;
      return <rect key={character.id} x={x} y={y} width={w} height={h} rx={1.5} fill={active ? '#4cb8c9' : '#c9a84c'} fillOpacity={active ? 0.85 : 0.7} />;
    })}
  </svg>;
}
