// ============================================================
// QuotesView — off-canvas quotation notebook for CharacterWeb
// ============================================================
import { ArrowLeft, ExternalLink, Pin, Quote, Tag } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import { getAnnotationPreset } from '@/lib/annotationStyles';

export function QuotesView({ onExit }: { onExit: () => void }) {
  const { book, setFocusedAnnotationId, updateAnnotation } = useBook();
  const quotes = (book.annotations ?? []).filter(annotation => annotation.layer === 'quotes' || annotation.format?.quote);
  const openOnMap = (id: string) => { setFocusedAnnotationId(id); onExit(); };

  return <div className="h-screen w-screen overflow-auto" style={{ background: '#0f1117', color: '#e6edf5' }}>
    <header className="sticky top-0 z-20 flex items-center justify-between border-b px-6 py-4 backdrop-blur" style={{ background: '#141824ee', borderColor: '#2c3955' }}>
      <div className="flex items-center gap-3"><button type="button" onClick={onExit} className="flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs" style={{ borderColor: '#3d4b68', color: '#b8c6d9' }}><ArrowLeft size={13} /> Map</button><div><h1 style={{ margin: 0, fontFamily: "'Playfair Display', serif", color: '#d9b957', fontSize: 20 }}>Quotation Notebook</h1><p style={{ margin: '2px 0 0', color: '#8192aa', fontSize: 11 }}>{book.title || 'Untitled book'} · {quotes.length} saved quotations</p></div></div>
      <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px]" style={{ borderColor: '#34415d', color: '#91a3bd' }}><Quote size={12} /> Kept off-map until pinned</div>
    </header>
    <main className="mx-auto columns-1 gap-5 px-5 py-10 md:max-w-6xl md:columns-2 lg:columns-3">
      {quotes.length === 0 && <div className="mx-auto max-w-lg break-inside-avoid rounded-xl border border-dashed px-6 py-16 text-center" style={{ borderColor: '#36435c', color: '#8192aa' }}><Quote className="mx-auto mb-3" size={24} /><div style={{ fontFamily: "'Playfair Display', serif", color: '#d9b957', fontSize: 18 }}>No quotation notes yet</div><p className="mt-2 text-sm leading-relaxed">Create a Quote note in the Notes panel. It will be kept in this notebook unless you deliberately pin it to the map.</p></div>}
      {quotes.map(annotation => {
        const preset = getAnnotationPreset(annotation);
        const linked = annotation.characterId ? book.characters.find(character => character.id === annotation.characterId) : undefined;
        return <article key={annotation.id} className="mb-5 break-inside-avoid rounded-xl border p-5" style={{ borderColor: `${preset.accent}85`, borderLeft: `4px solid ${preset.accent}`, background: '#171e2e' }}><Quote size={18} style={{ color: preset.accent, opacity: 0.8 }} /><div className="mt-2 whitespace-pre-wrap text-base leading-relaxed" style={{ color: '#edf1f6', fontStyle: 'italic' }}>{annotation.text}</div>{linked && <div className="mt-3 text-[10px]" style={{ color: '#9bacbf' }}>Linked to {linked.name}</div>}{(annotation.tags ?? []).length > 0 && <div className="mt-3 flex flex-wrap gap-1">{annotation.tags?.map(tag => <span key={tag} className="rounded-full px-2 py-0.5 text-[9px]" style={{ color: preset.accent, background: `${preset.accent}15` }}><Tag className="mr-1 inline" size={9} />{tag}</span>)}</div>}{(annotation.citations ?? []).filter(citation => citation.source).length > 0 && <div className="mt-3 border-t pt-2 text-[10px]" style={{ borderColor: '#30405b', color: '#98a9bc' }}>{annotation.citations?.filter(citation => citation.source).map(citation => <div key={citation.id}>{citation.source}{citation.locator ? ` · ${citation.locator}` : ''}</div>)}</div>}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => updateAnnotation(annotation.id, { pinToMap: !annotation.pinToMap })} className="flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: annotation.pinToMap ? '#c9a84c80' : '#3b4965', color: annotation.pinToMap ? '#c9a84c' : '#a9b8ca' }}><Pin size={11} />{annotation.pinToMap ? 'Pinned' : 'Pin to map'}</button><button type="button" onClick={() => openOnMap(annotation.id)} className="rounded border p-1.5 hover:bg-white/5" style={{ borderColor: '#3b4965', color: '#d9b957' }} title="Show on map"><ExternalLink size={13} /></button></div></article>;
      })}
    </main>
  </div>;
}
