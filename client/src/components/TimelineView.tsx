// ============================================================
// TimelineView — sequential chronology notebook for CharacterWeb
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Pin, StickyNote, Tag } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import { getAnnotationPreset } from '@/lib/annotationStyles';

export function TimelineView({ onExit }: { onExit: () => void }) {
  const { book, setFocusedAnnotationId, updateAnnotation } = useBook();
  const [groupIndex, setGroupIndex] = useState(0);
  const groups = useMemo(() => {
    const timeline = (book.annotations ?? []).filter(annotation => annotation.layer === 'timeline' || Boolean(annotation.timelineDate));
    const map = new Map<string, typeof timeline>();
    for (const annotation of timeline) {
      const key = annotation.timelineGroup?.trim() || 'Ungrouped chronology';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(annotation);
    }
    return Array.from(map.entries()).map(([name, notes]) => ({ name, notes: notes.sort((a, b) => (a.timelineDate ?? '9999-12-31').localeCompare(b.timelineDate ?? '9999-12-31')) })).sort((a, b) => (a.notes[0]?.timelineDate ?? '9999-12-31').localeCompare(b.notes[0]?.timelineDate ?? '9999-12-31'));
  }, [book.annotations]);
  useEffect(() => setGroupIndex(current => Math.min(current, Math.max(0, groups.length - 1))), [groups.length]);
  const activeGroup = groups[groupIndex];
  const jumpToCanvas = (id: string) => { setFocusedAnnotationId(id); onExit(); };

  return <div className="h-screen w-screen overflow-auto" style={{ background: '#0f1117', color: '#e6edf5' }}>
    <header className="sticky top-0 z-20 flex items-center justify-between border-b px-6 py-4 backdrop-blur" style={{ background: '#141824ee', borderColor: '#2c3955' }}>
      <div className="flex items-center gap-3"><button type="button" onClick={onExit} className="flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs" style={{ borderColor: '#3d4b68', color: '#b8c6d9' }}><ArrowLeft size={13} /> Map</button><div><h1 style={{ margin: 0, fontFamily: "'Playfair Display', serif", color: '#d9b957', fontSize: 20 }}>Research Timeline</h1><p style={{ margin: '2px 0 0', color: '#8192aa', fontSize: 11 }}>{book.title || 'Untitled book'} · {groups.length} chronology groups</p></div></div>
      <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px]" style={{ borderColor: '#34415d', color: '#91a3bd' }}><CalendarDays size={12} /> One group at a time</div>
    </header>
    <main className="mx-auto max-w-4xl px-5 py-8">
      {groups.length === 0 ? <div className="rounded-xl border border-dashed px-6 py-16 text-center" style={{ borderColor: '#36435c', color: '#8192aa' }}><CalendarDays className="mx-auto mb-3" size={24} /><div style={{ fontFamily: "'Playfair Display', serif", color: '#d9b957', fontSize: 18 }}>No Timeline notes yet</div><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed">Create a Timeline note in the Notes panel, give it a date and a group, then it will appear here.</p></div> : <>
        <section className="mb-7 rounded-xl border p-4" style={{ borderColor: '#36445f', background: '#151c2b' }}><div className="flex items-center justify-between gap-3"><button type="button" disabled={groupIndex === 0} onClick={() => setGroupIndex(current => current - 1)} className="flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs disabled:opacity-30" style={{ borderColor: '#3a4861', color: '#aebdd0' }}><ChevronLeft size={13} /> Previous</button><div className="min-w-0 text-center"><div className="text-[10px] font-semibold uppercase tracking-[.15em]" style={{ color: '#8fa0b8' }}>Chronology group {groupIndex + 1} of {groups.length}</div><div className="mt-1 truncate" style={{ fontFamily: "'Playfair Display', serif", color: '#d9b957', fontSize: 18 }}>{activeGroup.name}</div><div className="mt-1 text-[10px]" style={{ color: '#8192aa' }}>{activeGroup.notes.length} notes in this sequence</div></div><button type="button" disabled={groupIndex >= groups.length - 1} onClick={() => setGroupIndex(current => current + 1)} className="flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs disabled:opacity-30" style={{ borderColor: '#3a4861', color: '#aebdd0' }}>Next <ChevronRight size={13} /></button></div><div className="mt-3 flex flex-wrap justify-center gap-1.5">{groups.map((group, index) => <button key={group.name} type="button" onClick={() => setGroupIndex(index)} className="rounded-full border px-2 py-0.5 text-[9px]" style={{ borderColor: index === groupIndex ? '#c9a84c90' : '#35425d', color: index === groupIndex ? '#c9a84c' : '#92a3b9', background: index === groupIndex ? '#c9a84c15' : 'transparent' }}>{group.name}</button>)}</div></section>
        <div className="relative ml-3 border-l" style={{ borderColor: '#3a4861' }}>{activeGroup.notes.map(annotation => <TimelineCard key={annotation.id} annotation={annotation} onOpen={() => jumpToCanvas(annotation.id)} onPin={() => updateAnnotation(annotation.id, { pinToMap: !annotation.pinToMap })} linkedName={annotation.characterId ? book.characters.find(character => character.id === annotation.characterId)?.name : undefined} />)}</div>
      </>}
      {(book.annotations ?? []).filter(annotation => annotation.layer === 'timeline' && !annotation.timelineDate).length > 0 && <section className="mt-12"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: '#b6c4d8' }}><StickyNote size={14} /> Undated timeline notes</h2><p className="text-xs leading-relaxed" style={{ color: '#7f91aa' }}>Add a date to include them in a chronology group.</p></section>}
    </main>
  </div>;
}

function TimelineCard({ annotation, linkedName, onOpen, onPin }: { annotation: ReturnType<typeof useBook>['book']['annotations'][number]; linkedName?: string; onOpen: () => void; onPin: () => void }) {
  const preset = getAnnotationPreset(annotation);
  return <article className="relative mb-7 ml-8"><span className="absolute -left-[39px] top-5 h-4 w-4 rounded-full border-4" style={{ background: '#0f1117', borderColor: preset.accent }} /><div className="rounded-xl border p-4 transition-transform hover:-translate-y-0.5" style={{ borderColor: `${preset.accent}80`, background: '#171e2e' }}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: preset.accent }}><CalendarDays size={12} /> {annotation.timelineDate}</div><div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: '#e5ecf5', fontWeight: annotation.format?.bold ? 700 : 400, fontStyle: annotation.format?.italic ? 'italic' : 'normal', textAlign: annotation.format?.align ?? 'left' }}>{annotation.text}</div></div><button type="button" onClick={onOpen} title="Show on map" className="rounded border p-1.5 hover:bg-white/5" style={{ borderColor: '#3b4965', color: '#d9b957' }}><ExternalLink size={13} /></button></div>{(annotation.tags ?? []).length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{annotation.tags?.map(tag => <span key={tag} className="rounded-full px-2 py-0.5 text-[9px]" style={{ background: `${preset.accent}16`, color: preset.accent }}><Tag className="mr-1 inline" size={9} />{tag}</span>)}</div>}{linkedName && <div className="mt-3 text-[10px]" style={{ color: '#92a3ba' }}>Linked to {linkedName}</div>}{(annotation.citations ?? []).filter(citation => citation.source).length > 0 && <div className="mt-3 border-t pt-2 text-[10px]" style={{ borderColor: '#30405b', color: '#99a9bc' }}>{annotation.citations?.filter(citation => citation.source).map(citation => <div key={citation.id}>Source: {citation.source}{citation.locator ? ` · ${citation.locator}` : ''}</div>)}</div>}<div className="mt-3 flex justify-end"><button type="button" onClick={onPin} className="flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: annotation.pinToMap ? '#c9a84c80' : '#3b4965', color: annotation.pinToMap ? '#c9a84c' : '#a9b8ca' }}><Pin size={11} />{annotation.pinToMap ? 'Pinned to map' : 'Pin to map'}</button></div></div></article>;
}
