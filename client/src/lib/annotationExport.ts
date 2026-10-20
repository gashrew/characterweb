// ============================================================
// annotationExport — shared Canvas 2D note rendering for PNG/PDF
// ============================================================
import type { AnnotationLayer, BookData } from './types';
import { getAnnotationPreset, getAnnotationSize } from './annotationStyles';

export interface AnnotationExportBox { x: number; y: number; w: number; h: number; }

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = (text || 'Untitled note').split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawExportAnnotations(
  ctx: CanvasRenderingContext2D,
  book: BookData,
  visibleCharacterIds: Set<string>,
  boxMap: Map<string, AnnotationExportBox>,
  ox: number,
  oy: number,
  mode: 'dark' | 'print',
  visibleLayers?: AnnotationLayer[],
) {
  for (const annotation of book.annotations ?? []) {
    if (visibleLayers && !annotation.pinToMap && !visibleLayers.includes(annotation.layer ?? 'canvas')) continue;
    const anchorBox = annotation.characterId ? boxMap.get(annotation.characterId) : undefined;
    if (annotation.characterId && (!anchorBox || !visibleCharacterIds.has(annotation.characterId))) continue;
    const preset = getAnnotationPreset(annotation);
    const size = getAnnotationSize(annotation);
    const width = annotation.sizePreset ? size.width : (annotation.width ?? size.width);
    const x = anchorBox ? anchorBox.x + annotation.x : annotation.x + ox;
    const y = anchorBox ? anchorBox.y + annotation.y : annotation.y + oy;
    const fontSize = size.fontSize;
    const padding = size.padding;
    const headerH = 20;
    const format = annotation.format ?? {};
    const fontPrefix = `${format.italic ? 'italic ' : ''}${format.bold ? '700 ' : ''}`;

    ctx.save();
    ctx.font = `${fontPrefix}${fontSize}px 'DM Sans', sans-serif`;
    const lines = wrapLines(ctx, annotation.text, width - padding * 2);
    const height = headerH + padding * 2 + lines.length * (fontSize * 1.43);

    if (anchorBox) {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = preset.accent;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(anchorBox.x + anchorBox.w, anchorBox.y + anchorBox.h / 2);
      ctx.lineTo(x, y + headerH / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = mode === 'print' ? '#ffffff' : preset.fill;
    ctx.strokeStyle = preset.accent;
    ctx.lineWidth = mode === 'print' ? 1.4 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = preset.accent;
    ctx.fillRect(x, y, 4, height);
    ctx.fillStyle = mode === 'print' ? '#f7f7f7' : '#101628';
    ctx.fillRect(x + 4, y, width - 4, headerH);
    ctx.fillStyle = preset.accent;
    ctx.font = `700 9px 'DM Sans', sans-serif`;
    ctx.fillText('NOTE', x + 11, y + 13);
    if (annotation.locked) {
      ctx.font = `9px 'DM Sans', sans-serif`;
      ctx.fillText('LOCKED', x + width - 43, y + 13);
    }
    ctx.fillStyle = mode === 'print' ? '#171717' : preset.text;
    ctx.font = `${fontPrefix}${fontSize}px 'DM Sans', sans-serif`;
    const contentX = x + padding + 4;
    const contentWidth = width - padding * 2 - 8;
    if (format.quote) {
      ctx.strokeStyle = preset.accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(contentX, y + headerH + padding - 1); ctx.lineTo(contentX, y + height - padding + 1); ctx.stroke();
    }
    lines.forEach((line, index) => {
      const lineWidth = ctx.measureText(line).width;
      const alignedX = format.align === 'center' ? contentX + (contentWidth - lineWidth) / 2 : format.align === 'right' ? contentX + contentWidth - lineWidth : contentX + (format.quote ? 6 : 0);
      ctx.fillText(line, alignedX, y + headerH + padding + fontSize + index * fontSize * 1.43);
    });
    ctx.restore();
  }
}
