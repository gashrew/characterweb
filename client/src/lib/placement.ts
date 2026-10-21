import { calcNodeWidth } from '@/components/CharacterNode';
import type { Character } from '@/lib/types';

/** Where a phone-added character should sit on the map: a tidy column to the right. */
export function nextQuickPosition(chars: Character[]): { x: number; y: number } {
  const staged = chars.filter(c => c.placedAutomatically);
  if (staged.length > 0) {
    const last = staged[staged.length - 1];
    const columnTop = Math.min(...staged.map(c => c.y));
    const inColumn = staged.filter(c => Math.abs(c.x - last.x) < 1);
    if (inColumn.length >= 12) return { x: last.x + 240, y: columnTop };
    return { x: last.x, y: last.y + 64 };
  }
  if (chars.length === 0) return { x: 100, y: 100 };
  const right = Math.max(...chars.map(c => c.x + calcNodeWidth(c.name)));
  const top = Math.min(...chars.map(c => c.y));
  return { x: right + 140, y: top };
}

