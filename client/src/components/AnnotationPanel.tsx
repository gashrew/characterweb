// ============================================================
// AnnotationPanel — searchable Scholarly Codex note manager
// ============================================================
import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { AlignCenter, AlignLeft, AlignRight, Bold, CalendarDays, Eye, Italic, Lock, MapPinned, Pin, Plus, Quote, Tag, Trash2, Unlock } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ANNOTATION_PRESETS, ANNOTATION_SIZES, getAnnotationPreset } from '@/lib/annotationStyles';
import type { AnnotationCitation, CanvasAnnotation, AnnotationLayer, AnnotationLayerPreset } from '@/lib/types';

type AnnotationTemplate = 'blank' | 'timeline' | 'quotation' | 'chapter';

const TEMPLATES: Record<AnnotationTemplate, Omit<CanvasAnnotation, 'id' | 'x' | 'y'>> = {
  blank: { text: 'New note', colorPreset: 'gold', sizePreset: 'medium', layer: 'canvas' },
  timeline: { text: 'Timeline event\nDescribe the event and its consequence.', colorPreset: 'blue', sizePreset: 'medium', layer: 'timeline', timelineDate: '', tags: ['timeline'], format: { bold: true } },
  quotation: { text: '“Quotation”\n— Speaker', colorPreset: 'rose', sizePreset: 'medium', layer: 'quotes', format: { italic: true, quote: true } },
  chapter: { text: 'Chapter [Number]\nHeading or turning point', colorPreset: 'sage', sizePreset: 'large', layer: 'chapters', format: { bold: true, align: 'center' } },
};

export function AnnotationPanel() {
  const { book, addAnnotation, updateAnnotation, deleteAnnotation, setFocusedAnnotationId, annotationLayerPreset, visibleAnnotationLayers, setAnnotationLayerPreset } = useBook();
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const knownTags = useMemo(() => Array.from(new Set((book.annotations ?? []).flatMap(annotation => annotation.tags ?? []))).sort((a, b) => a.localeCompare(b)), [book.annotations]);

  const annotations = useMemo(() => (book.annotations ?? []).filter(annotation => {
    const linkedName = annotation.characterId ? book.characters.find(character => character.id === annotation.characterId)?.name ?? '' : '';
    const matchesQuery = `${annotation.text} ${linkedName} ${(annotation.tags ?? []).join(' ')} ${(annotation.citations ?? []).map(citation => `${citation.source} ${citation.locator ?? ''}`).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesTags = activeTags.size === 0 || Array.from(activeTags).every(tag => annotation.tags?.includes(tag));
    return matchesQuery && matchesTags;
  }), [book.annotations, book.characters, query, activeTags]);

  const createAnnotation = (template: AnnotationTemplate) => {
    const next = TEMPLATES[template];
    const offset = (book.annotations?.length ?? 0) * 18;
    const annotation = addAnnotation({ ...next, x: 160 + offset, y: 130 + offset });
    setExpandedId(annotation.id);
    setFocusedAnnotationId(annotation.id);
  };

  return <div className="space-y-3 p-3">
    <div className="flex items-center justify-between gap-2">
      <div><div className="text-[11px] font-semibold uppercase tracking-[.14em]" style={{ color: '#c9a84c' }}>Annotations</div><div className="mt-0.5 text-[10px]" style={{ color: '#7f91ab' }}>{book.annotations?.length ?? 0} saved notes</div></div>
      <Button size="sm" onClick={() => createAnnotation('blank')} className="h-7 gap-1 px-2 text-[10px]" style={{ background: '#c9a84c', color: '#17140b' }}><Plus size={12} /> Note</Button>
    </div>
    <div className="rounded border p-2" style={{ borderColor: '#34415e', background: '#111724' }}>
      <div className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#899ab2' }}><MapPinned size={10} /> Map note layers</div>
      <div className="grid grid-cols-3 gap-1">{(['reading', 'study', 'research'] as AnnotationLayerPreset[]).map(preset => <button key={preset} type="button" onClick={() => setAnnotationLayerPreset(preset)} className="rounded border px-1 py-1 text-[9px] font-semibold capitalize" style={{ borderColor: annotationLayerPreset === preset ? '#c9a84c90' : '#35425d', color: annotationLayerPreset === preset ? '#c9a84c' : '#98a9bf', background: annotationLayerPreset === preset ? '#c9a84c15' : 'transparent' }}>{preset}</button>)}</div>
      <div className="mt-1.5 text-[9px] leading-snug" style={{ color: '#71839e' }}>Showing: {visibleAnnotationLayers.join(' · ')}. Timeline and quote notes stay off-map in Reading unless pinned.</div>
    </div>
    <div className="grid grid-cols-3 gap-1">
      {(['timeline', 'quotation', 'chapter'] as AnnotationTemplate[]).map(template => <button key={template} type="button" onClick={() => createAnnotation(template)} className="rounded border px-1.5 py-1.5 text-[9px] font-semibold transition-colors hover:bg-white/5" style={{ borderColor: '#34415e', color: '#b9c6d9' }}>{template === 'timeline' ? 'Timeline' : template === 'quotation' ? 'Quote' : 'Chapter'}</button>)}
    </div>
    <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search notes or linked character…" className="h-8 text-xs" />
    {knownTags.length > 0 && <div className="flex flex-wrap gap-1">
      <Tag size={11} className="mt-1" style={{ color: '#7184a2' }} />
      {knownTags.map(tag => <button key={tag} type="button" onClick={() => setActiveTags(previous => { const next = new Set(previous); next.has(tag) ? next.delete(tag) : next.add(tag); return next; })} className="rounded-full border px-2 py-0.5 text-[9px]" style={{ borderColor: activeTags.has(tag) ? '#c9a84c80' : '#36435d', color: activeTags.has(tag) ? '#c9a84c' : '#96a7bd', background: activeTags.has(tag) ? '#c9a84c16' : 'transparent' }}>{tag}</button>)}
      {activeTags.size > 0 && <button type="button" onClick={() => setActiveTags(new Set())} className="px-1 text-[9px]" style={{ color: '#8b9db5' }}>clear</button>}
    </div>}
    <div className="space-y-2">
      {annotations.length === 0 && <div className="rounded border border-dashed px-3 py-7 text-center text-xs" style={{ borderColor: '#31405f', color: '#788ba5' }}>No matching annotations.</div>}
      {annotations.map(annotation => {
        const preset = getAnnotationPreset(annotation);
        const linkedCharacter = annotation.characterId ? book.characters.find(character => character.id === annotation.characterId) : undefined;
        const expanded = expandedId === annotation.id;
        const format = annotation.format ?? {};
        const updateFormat = (updates: Partial<NonNullable<CanvasAnnotation['format']>>) => updateAnnotation(annotation.id, { format: { ...format, ...updates } });
        return <div key={annotation.id} className="overflow-hidden rounded border" style={{ borderColor: `${preset.accent}70`, background: '#171d2c' }}>
          <div className="flex items-start gap-2 px-2.5 py-2">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: preset.accent }} />
            <button type="button" onClick={() => setExpandedId(expanded ? null : annotation.id)} className="min-w-0 flex-1 text-left"><div className="line-clamp-2 text-xs leading-snug" style={{ color: '#e2e8f1' }}>{annotation.text || 'Untitled note'}</div><div className="mt-1 text-[9px]" style={{ color: '#8193ad' }}>{linkedCharacter ? `Linked to ${linkedCharacter.name}` : 'Free-floating'} · {annotation.locked ? 'Locked' : 'Movable'}</div></button>
            <button type="button" onClick={() => setFocusedAnnotationId(annotation.id)} title="Find on canvas" className="mt-0.5 rounded p-1 hover:bg-white/5" style={{ color: '#c9a84c' }}><Eye size={13} /></button>
            <button type="button" onClick={() => deleteAnnotation(annotation.id)} title="Delete note" className="mt-0.5 rounded p-1 hover:bg-white/5" style={{ color: '#d67575' }}><Trash2 size={13} /></button>
          </div>
          {expanded && <div className="space-y-2 border-t p-2.5" style={{ borderColor: '#34415e' }}>
            <Textarea value={annotation.text} onChange={event => updateAnnotation(annotation.id, { text: event.target.value })} className="min-h-20 text-xs" />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="min-w-0"><span className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#899ab2' }}><CalendarDays size={10} /> Timeline date</span><Input type="date" value={annotation.timelineDate ?? ''} onChange={event => updateAnnotation(annotation.id, { timelineDate: event.target.value || undefined })} className="h-7 text-[10px]" /></label>
              <label className="w-24"><span className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#899ab2' }}><Tag size={10} /> Tags</span><Input value={(annotation.tags ?? []).join(', ')} onChange={event => updateAnnotation(annotation.id, { tags: event.target.value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean) })} placeholder="war, home" className="h-7 text-[10px]" /></label>
            </div>
            {annotation.layer === 'timeline' && <label className="block"><span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#899ab2' }}>Timeline group</span><Input value={annotation.timelineGroup ?? ''} onChange={event => updateAnnotation(annotation.id, { timelineGroup: event.target.value || undefined })} placeholder="e.g. Part I · 1805 / Before the invasion" className="h-7 text-[10px]" /></label>}
            {annotation.layer === 'chapters' && <label className="block"><span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#899ab2' }}>Chapter number</span><Input type="number" min="1" value={annotation.chapterNumber ?? ''} onChange={event => updateAnnotation(annotation.id, { chapterNumber: event.target.value ? Number(event.target.value) : undefined })} placeholder="1" className="h-7 text-[10px]" /></label>}
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => updateFormat({ bold: !format.bold })} title="Bold" className="rounded p-1" style={{ color: format.bold ? '#c9a84c' : '#91a1b7', background: format.bold ? '#c9a84c18' : 'transparent' }}><Bold size={12} /></button>
              <button type="button" onClick={() => updateFormat({ italic: !format.italic })} title="Italic" className="rounded p-1" style={{ color: format.italic ? '#c9a84c' : '#91a1b7', background: format.italic ? '#c9a84c18' : 'transparent' }}><Italic size={12} /></button>
              <button type="button" onClick={() => updateFormat({ quote: !format.quote })} title="Quote styling" className="rounded p-1" style={{ color: format.quote ? '#c9a84c' : '#91a1b7', background: format.quote ? '#c9a84c18' : 'transparent' }}><Quote size={12} /></button>
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => <button key={align} type="button" onClick={() => updateFormat({ align })} title={`Align ${align}`} className="rounded p-1" style={{ color: format.align === align ? '#c9a84c' : '#91a1b7', background: format.align === align ? '#c9a84c18' : 'transparent' }}><Icon size={12} /></button>)}
              <span className="mx-1 h-3 w-px" style={{ background: '#3a4761' }} />
              {Object.entries(ANNOTATION_PRESETS).map(([key, value]) => <button key={key} type="button" onClick={() => updateAnnotation(annotation.id, { colorPreset: key as keyof typeof ANNOTATION_PRESETS })} title={value.label} className="h-3 w-3 rounded-full" style={{ background: value.accent, outline: annotation.colorPreset === key ? '1px solid white' : 'none' }} />)}
              {Object.entries(ANNOTATION_SIZES).map(([key, value]) => <button key={key} type="button" onClick={() => updateAnnotation(annotation.id, { sizePreset: key as keyof typeof ANNOTATION_SIZES, width: value.width })} className="rounded px-1 text-[9px]" style={{ color: annotation.sizePreset === key ? '#c9a84c' : '#91a1b7', background: annotation.sizePreset === key ? '#c9a84c18' : 'transparent' }}>{value.label}</button>)}
            </div>
            <div className="flex items-center gap-2">
              <select value={annotation.characterId ?? ''} onChange={event => {
                const nextId = event.target.value || undefined;
                const currentAnchor = annotation.characterId ? book.characters.find(character => character.id === annotation.characterId) : undefined;
                const nextAnchor = nextId ? book.characters.find(character => character.id === nextId) : undefined;
                const worldX = (currentAnchor?.x ?? 0) + annotation.x;
                const worldY = (currentAnchor?.y ?? 0) + annotation.y;
                updateAnnotation(annotation.id, { characterId: nextId, x: worldX - (nextAnchor?.x ?? 0), y: worldY - (nextAnchor?.y ?? 0) });
              }} className="h-7 min-w-0 flex-1 rounded border px-2 text-[10px]" style={{ background: '#111827', borderColor: '#35425d', color: '#c6d2e1' }}><option value="">Free-floating note</option>{book.characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select>
              <button type="button" onClick={() => updateAnnotation(annotation.id, { locked: !annotation.locked })} className="flex h-7 items-center gap-1 rounded border px-2 text-[10px]" style={{ borderColor: '#3a4761', color: annotation.locked ? '#c9a84c' : '#9badc4' }}>{annotation.locked ? <Lock size={11} /> : <Unlock size={11} />}{annotation.locked ? 'Locked' : 'Lock'}</button>
            </div>
            <label className="flex items-center gap-2 text-[10px]" style={{ color: '#899ab2' }}>Notebook layer <select value={annotation.layer ?? 'canvas'} onChange={event => updateAnnotation(annotation.id, { layer: event.target.value as AnnotationLayer })} className="h-7 min-w-0 flex-1 rounded border px-2 text-[10px]" style={{ background: '#111827', borderColor: '#35425d', color: '#c6d2e1' }}><option value="canvas">Canvas callout</option><option value="timeline">Timeline</option><option value="quotes">Quotes</option><option value="chapters">Chapter / scene</option><option value="research">Research</option></select></label>
            {(annotation.layer === 'timeline' || annotation.layer === 'quotes' || annotation.layer === 'chapters') && <button type="button" onClick={() => updateAnnotation(annotation.id, { pinToMap: !annotation.pinToMap })} className="flex h-7 w-full items-center justify-center gap-1 rounded border text-[10px]" style={{ borderColor: annotation.pinToMap ? '#c9a84c80' : '#3a4761', color: annotation.pinToMap ? '#c9a84c' : '#9badc4', background: annotation.pinToMap ? '#c9a84c12' : 'transparent' }}><Pin size={11} />{annotation.pinToMap ? 'Pinned to map' : 'Pin to map'}</button>}
            <div className="rounded border p-2" style={{ borderColor: '#34415e', background: '#131a29' }}>
              <div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#899ab2' }}>Sources & citations</span><button type="button" onClick={() => updateAnnotation(annotation.id, { citations: [...(annotation.citations ?? []), { id: nanoid(), source: '', locator: '' }] })} className="rounded px-1.5 py-0.5 text-[9px]" style={{ color: '#c9a84c', background: '#c9a84c12' }}>+ source</button></div>
              <div className="space-y-1.5">{(annotation.citations ?? []).map(citation => <CitationEditor key={citation.id} citation={citation} onChange={next => updateAnnotation(annotation.id, { citations: (annotation.citations ?? []).map(item => item.id === citation.id ? next : item) })} onDelete={() => updateAnnotation(annotation.id, { citations: (annotation.citations ?? []).filter(item => item.id !== citation.id) })} />)}</div>
              {(annotation.citations ?? []).length === 0 && <div className="text-[10px]" style={{ color: '#71839e' }}>Add editions, page numbers, archive links, or research notes.</div>}
            </div>
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function CitationEditor({ citation, onChange, onDelete }: { citation: AnnotationCitation; onChange: (citation: AnnotationCitation) => void; onDelete: () => void }) {
  return <div className="grid grid-cols-[1fr_auto] gap-1.5"><div className="space-y-1"><Input value={citation.source} onChange={event => onChange({ ...citation, source: event.target.value })} placeholder="Source / author / edition" className="h-7 text-[10px]" /><div className="grid grid-cols-2 gap-1"><Input value={citation.locator ?? ''} onChange={event => onChange({ ...citation, locator: event.target.value })} placeholder="Page / chapter" className="h-7 text-[10px]" /><Input value={citation.url ?? ''} onChange={event => onChange({ ...citation, url: event.target.value })} placeholder="URL (optional)" className="h-7 text-[10px]" /></div></div><button type="button" onClick={onDelete} title="Remove source" className="mt-1 h-6 rounded p-1 hover:bg-white/5" style={{ color: '#d67575' }}><Trash2 size={12} /></button></div>;
}
