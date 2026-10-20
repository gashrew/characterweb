// ============================================================
// HelpOverlay — Keyboard shortcuts & tips
// Design: Dark Scholarly Codex
// ============================================================
import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

const SHORTCUTS = [
  { key: 'Click node', action: 'Select character & highlight connections' },
  { key: 'Double-click node', action: 'Edit character details' },
  { key: 'Drag node', action: 'Reposition character on canvas' },
  { key: 'Click edge', action: 'Select relationship' },
  { key: 'Double-click edge', action: 'Edit relationship' },
  { key: 'Scroll / pinch', action: 'Zoom in and out' },
  { key: 'Click + drag canvas', action: 'Pan the canvas' },
  { key: 'Del / Backspace', action: 'Delete selected element' },
  { key: 'Ctrl + scroll', action: 'Zoom with keyboard' },
];

export function HelpOverlay() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute top-4 right-4 z-40 p-2 rounded-full transition-colors hover:bg-white/10"
        style={{ color: '#8899aa', background: '#1a2035aa', border: '1px solid #2a3350' }}
        title="Help & shortcuts"
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full mx-4"
            style={{ background: '#1a2035', border: '1px solid #2a3350', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#c9a84c', fontWeight: 700 }}>
                How to use CharacterWeb
              </h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10" style={{ color: '#8899aa' }}>
                <X size={15} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-start gap-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs flex-shrink-0"
                    style={{
                      background: '#141824',
                      border: '1px solid #2a3350',
                      color: '#c9a84c',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      minWidth: 120,
                      textAlign: 'center',
                    }}
                  >
                    {s.key}
                  </span>
                  <span style={{ fontSize: 12, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                    {s.action}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2a3350' }}>
              <p style={{ fontSize: 11, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                <strong style={{ color: '#c9a84c' }}>Tip:</strong> Drag a handle from one character node to another to quickly create a new relationship. Then edit it in the Relationships tab to set the type.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
