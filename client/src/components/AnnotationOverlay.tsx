// ============================================================
// AnnotationOverlay — Scholarly Codex canvas annotations
// Free notes stay at world coordinates; linked notes retain an
// offset from a selected character so explanatory callouts follow it.
// ============================================================
import { useMemo, useState } from 'react';
import { useNodes, useReactFlow, useViewport } from '@xyflow/react';
import { Link2, Lock, Palette, Trash2, Unlock, Unlink } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import { calcNodeWidth } from './CharacterNode';
import { ANNOTATION_PRESETS, ANNOTATION_SIZES, getAnnotationPreset, getAnnotationSize } from '@/lib/annotationStyles';

const NODE_H = 36;

export function AnnotationOverlay() {
  const { book, updateAnnotation, deleteAnnotation, visibleAnnotationLayers } = useBook();
  const { x: vpX, y: vpY, zoom } = useViewport();
  const { screenToFlowPosition } = useReactFlow();
  const rfNodes = useNodes();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const livePositions = useMemo(() => new Map(rfNodes.map(node => [node.id, node.position])), [rfNodes]);
  const annotationGeometry = useMemo(() => (book.annotations ?? []).filter(annotation => annotation.pinToMap || visibleAnnotationLayers.includes(annotation.layer ?? 'canvas')).map(annotation => {
    const character = annotation.characterId ? book.characters.find(item => item.id === annotation.characterId) : undefined;
    const live = character ? livePositions.get(character.id) : undefined;
    const anchorX = character ? (live?.x ?? character.x) : 0;
    const anchorY = character ? (live?.y ?? character.y) : 0;
    const worldX = annotation.characterId ? anchorX + annotation.x : annotation.x;
    const worldY = annotation.characterId ? anchorY + annotation.y : annotation.y;
    return { annotation, character, anchorX, anchorY, worldX, worldY, screenX: worldX * zoom + vpX, screenY: worldY * zoom + vpY };
  }), [book.annotations, book.characters, visibleAnnotationLayers, livePositions, vpX, vpY, zoom]);

  const beginDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    annotationId: string,
    character: typeof book.characters[number] | undefined,
    anchorX: number,
    anchorY: number,
    worldX: number,
    worldY: number,
  ) => {
    if ((book.annotations ?? []).find(annotation => annotation.id === annotationId)?.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const start = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const grabX = start.x - worldX;
    const grabY = start.y - worldY;
    const move = (moveEvent: PointerEvent) => {
      const flow = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
      const nextX = flow.x - grabX;
      const nextY = flow.y - grabY;
      updateAnnotation(annotationId, character ? { x: nextX - anchorX, y: nextY - anchorY } : { x: nextX, y: nextY });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!annotationGeometry.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[7] overflow-visible">
      <svg className="absolute inset-0 h-full w-full overflow-visible" style={{ pointerEvents: 'none' }}>
        {annotationGeometry.map(({ annotation, character, anchorX, anchorY, screenX, screenY }) => {
          if (!character) return null;
          const preset = getAnnotationPreset(annotation);
          const nodeLeft = anchorX * zoom + vpX;
          const nodeTop = anchorY * zoom + vpY;
          const nodeWidth = calcNodeWidth(character.name, character.title) * zoom;
          const nodeHeight = NODE_H * zoom;
          const noteWidth = (annotation.sizePreset ? getAnnotationSize(annotation).width : (annotation.width ?? getAnnotationSize(annotation).width)) * zoom;
          const noteHeight = Math.max(52, 68 * zoom);
          const nodeCenterX = nodeLeft + nodeWidth / 2;
          const nodeCenterY = nodeTop + nodeHeight / 2;
          const noteCenterX = screenX + noteWidth / 2;
          const noteCenterY = screenY + noteHeight / 2;
          const dx = noteCenterX - nodeCenterX;
          const dy = noteCenterY - nodeCenterY;
          const horizontal = Math.abs(dx) >= Math.abs(dy);
          const startX = horizontal ? (dx >= 0 ? nodeLeft + nodeWidth : nodeLeft) : nodeCenterX;
          const startY = horizontal ? nodeCenterY : (dy >= 0 ? nodeTop + nodeHeight : nodeTop);
          const endX = horizontal ? (dx >= 0 ? screenX : screenX + noteWidth) : noteCenterX;
          const endY = horizontal ? noteCenterY : (dy >= 0 ? screenY : screenY + noteHeight);
          return <path key={`leader-${annotation.id}`} d={`M ${startX} ${startY} L ${endX} ${endY}`} fill="none" stroke={preset.accent} strokeOpacity="0.62" strokeWidth="1.3" strokeDasharray="4 3" />;
        })}
      </svg>
      {annotationGeometry.map(({ annotation, character, anchorX, anchorY, worldX, worldY, screenX, screenY }) => {
        const isHovered = hoveredId === annotation.id;
        const preset = getAnnotationPreset(annotation);
        const size = getAnnotationSize(annotation);
        const noteWidth = annotation.sizePreset ? size.width : (annotation.width ?? size.width);
        const format = annotation.format ?? {};
        return <div
          key={annotation.id}
          className="pointer-events-auto absolute"
          style={{ transform: `translate(${screenX}px, ${screenY}px)`, width: noteWidth * zoom, minWidth: 115, opacity: annotation.locked ? 0.92 : 0.98 }}
          onMouseEnter={() => setHoveredId(annotation.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div style={{ background: `${preset.fill}f2`, border: `1px solid ${preset.accent}b0`, borderLeft: `4px solid ${preset.accent}`, borderRadius: 5, boxShadow: '0 5px 16px rgba(0,0,0,.42)', backdropFilter: 'blur(8px)' }}>
            <div
              title={annotation.locked ? 'Note movement is locked' : 'Drag note'}
              onPointerDown={event => beginDrag(event, annotation.id, character, anchorX, anchorY, worldX, worldY)}
              style={{ height: Math.max(17, 18 * zoom), padding: `0 ${8 * zoom}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: annotation.locked ? 'not-allowed' : 'grab', touchAction: 'none', userSelect: 'none', borderBottom: `1px solid ${preset.accent}55`, color: preset.accent, fontFamily: "'DM Sans', sans-serif", fontSize: Math.max(8, 9 * zoom), fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#101628c8' }}
            ><span>Note</span><span>{annotation.locked ? <Lock size={10} /> : '⠿'}</span></div>
            <div
              contentEditable
              suppressContentEditableWarning
              onPointerDown={event => event.stopPropagation()}
              onBlur={event => updateAnnotation(annotation.id, { text: event.currentTarget.textContent?.trim() || 'Untitled note' })}
              style={{ color: preset.text, fontFamily: "'DM Sans', sans-serif", fontSize: Math.max(9, size.fontSize * zoom), fontWeight: format.bold ? 700 : 400, fontStyle: format.italic ? 'italic' : 'normal', textAlign: format.align ?? 'left', lineHeight: 1.42, padding: `${size.padding * zoom}px ${size.padding * zoom + 2}px`, outline: 'none', cursor: 'text', minHeight: 32 * zoom, whiteSpace: 'pre-wrap', borderLeft: format.quote ? `2px solid ${preset.accent}80` : 'none' }}
              title="Click to edit text"
            >{annotation.text}</div>
            {isHovered && <div className="flex items-center gap-1 border-t px-1.5 py-1" style={{ borderColor: `${preset.accent}55`, background: '#101628e6' }}>
              <select
                value={annotation.characterId ?? ''}
                onChange={event => {
                  const nextCharacterId = event.target.value || undefined;
                  if (!nextCharacterId) updateAnnotation(annotation.id, { characterId: undefined, x: anchorX + annotation.x, y: anchorY + annotation.y });
                  else {
                    const target = book.characters.find(item => item.id === nextCharacterId);
                    const live = target ? livePositions.get(target.id) : undefined;
                    if (target) updateAnnotation(annotation.id, { characterId: target.id, x: screenX / zoom - vpX / zoom - (live?.x ?? target.x), y: screenY / zoom - vpY / zoom - (live?.y ?? target.y) });
                  }
                }}
                style={{ minWidth: 0, flex: 1, color: '#b9c6d9', background: 'transparent', border: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: 9, outline: 'none' }}
                title="Link this callout to a character"
              >
                <option value="">Free-floating note</option>
                {book.characters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {character ? <Link2 size={12} color="#c9a84c" /> : <Unlink size={12} color="#71829c" />}
              <Palette size={11} color="#8395b2" />
              {Object.entries(ANNOTATION_PRESETS).map(([key, value]) => <button key={key} type="button" onClick={() => updateAnnotation(annotation.id, { colorPreset: key as keyof typeof ANNOTATION_PRESETS })} title={value.label} style={{ width: 10, height: 10, borderRadius: '50%', background: value.accent, border: annotation.colorPreset === key ? '1px solid #fff' : '1px solid transparent' }} />)}
              <select value={annotation.sizePreset ?? 'medium'} onChange={event => { const key = event.target.value as keyof typeof ANNOTATION_SIZES; updateAnnotation(annotation.id, { sizePreset: key, width: ANNOTATION_SIZES[key].width }); }} title="Note size" style={{ width: 24, color: '#c3d1e2', background: 'transparent', border: 'none', fontSize: 9, outline: 'none' }}>
                {Object.entries(ANNOTATION_SIZES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
              <button type="button" onClick={() => updateAnnotation(annotation.id, { locked: !annotation.locked })} title={annotation.locked ? 'Unlock note movement' : 'Lock note movement'} style={{ color: annotation.locked ? '#c9a84c' : '#8293ab' }}>{annotation.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
              <button type="button" onClick={() => deleteAnnotation(annotation.id)} title="Delete note" style={{ color: '#d67575' }}><Trash2 size={12} /></button>
            </div>}
          </div>
        </div>;
      })}
    </div>
  );
}
