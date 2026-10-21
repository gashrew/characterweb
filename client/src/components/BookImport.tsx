// ============================================================
// Import flow shared by the map view and the phone view.
// If the file is a book that's already on this device, ask whether to
// merge it into that book or keep it as a separate copy.
// ============================================================
import { useState } from 'react';
import { toast } from 'sonner';
import { useBook, type BookIndex } from '@/contexts/BookContext';
import { describeMerge } from '@/lib/mergeBooks';
import type { BookData } from '@/lib/types';

const C = { bg: '#161b29', border: '#2a3350', text: '#e8e0d0', muted: '#8899aa', gold: '#c9a84c' };

export function useBookImport(onDone?: () => void) {
  const { importBook, findMatchingBook, mergeIntoBook } = useBook();
  const [pending, setPending] = useState<{ text: string; incoming: BookData; match: BookIndex } | null>(null);

  const start = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      file.text().then(text => {
        let incoming: BookData;
        try {
          incoming = JSON.parse(text) as BookData;
          if (!Array.isArray(incoming.characters)) throw new Error('not a book');
        } catch {
          toast.error("That file doesn't look like a CharacterWeb book.");
          return;
        }
        const match = findMatchingBook(incoming);
        if (match) { setPending({ text, incoming, match }); return; }
        importBook(text);
        toast.success(`Imported ${incoming.title || 'book'}`);
        onDone?.();
      });
    };
    input.click();
  };

  const merge = () => {
    if (!pending) return;
    const summary = mergeIntoBook(pending.match.id, pending.incoming);
    setPending(null);
    if (!summary) { toast.error("Couldn't open the book on this device to merge into."); return; }
    toast.success(`Merged into ${pending.match.title || 'book'}`, { description: <span style={{ color: '#cfc7b6' }}>{describeMerge(summary)}</span>, duration: 6000 });
    onDone?.();
  };

  const keepSeparate = () => {
    if (!pending) return;
    importBook(pending.text);
    toast.success(`Imported ${pending.incoming.title || 'book'} as a separate copy`);
    setPending(null);
    onDone?.();
  };

  const dialog = pending ? (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,8,14,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, marginBottom: 8 }}>
          {pending.match.title || 'This book'} is already on this device
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: C.muted, margin: '0 0 18px' }}>
          <b style={{ color: C.text }}>Merge</b> adds the new characters, relationships and groups from the file, takes the newer version of anything edited on both, and keeps your map layout as it is here.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button type="button" onClick={merge} style={{ padding: '13px 14px', borderRadius: 12, background: C.gold, color: '#1a1408', fontWeight: 700, fontSize: 16, border: `1px solid ${C.gold}` }}>
            Merge into existing book
          </button>
          <button type="button" onClick={keepSeparate} style={{ padding: '12px 14px', borderRadius: 12, background: 'transparent', color: C.text, fontSize: 15, border: `1px solid ${C.border}` }}>
            Keep as a separate copy
          </button>
          <button type="button" onClick={() => setPending(null)} style={{ padding: '10px 14px', color: C.muted, fontSize: 15 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { start, dialog };
}
