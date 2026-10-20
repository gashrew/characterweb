// ============================================================
// CharacterListView — Printable character list panel
// Design: Dark Scholarly Codex
// Shows all characters with title, name, description, notes,
// status, age, and group memberships. Exportable as PDF.
// ============================================================
import { useCallback, useState } from 'react';
import { jsPDF } from 'jspdf';
import { X, Download, Users, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';
import type { Character, BookData } from '@/lib/types';
import { toast } from 'sonner';

// ── PDF export for character list ────────────────────────────

async function exportCharacterListAsPdf(book: BookData, groupByGroup: boolean): Promise<void> {
  const SCALE = 3;
  const PAGE_W = 794;  // A4 portrait at 96dpi
  const MARGIN = 60;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const FONT_TITLE = "'Playfair Display', serif";
  const FONT_UI = "'DM Sans', sans-serif";

  // Load font
  try {
    const ff = new FontFace('Playfair Display',
      "url(https://fonts.gstatic.com/s/playfairdisplay/v37/nuFiD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.woff2)");
    await ff.load();
    document.fonts.add(ff);
  } catch { /* fallback */ }

  // Build ordered list
  type Section = { title: string; color: string; chars: Character[] };
  const sections: Section[] = [];

  if (groupByGroup && book.groups.length > 0) {
    for (const group of book.groups) {
      const members = book.characters.filter(c => c.groupIds?.includes(group.id));
      if (members.length > 0) sections.push({ title: group.name, color: group.color, chars: members });
    }
    const ungrouped = book.characters.filter(c => !c.groupIds || c.groupIds.length === 0);
    if (ungrouped.length > 0) sections.push({ title: 'Ungrouped', color: '#8899aa', chars: ungrouped });
  } else {
    sections.push({ title: '', color: '#c9a84c', chars: [...book.characters] });
  }

  // Measure total height needed
  const ROW_H = 20;
  const SECTION_H = 30;
  const HEADER_H = 70;
  const FOOTER_H = 30;

  let totalH = HEADER_H + FOOTER_H;
  for (const sec of sections) {
    if (sec.title) totalH += SECTION_H;
    for (const c of sec.chars) {
      const descLines = wrapText(c.description || '', CONTENT_W - 20, 11);
      const noteLines = wrapText(c.notes || '', CONTENT_W - 20, 10);
      totalH += ROW_H * 2 + descLines.length * 14 + (noteLines.length > 0 ? noteLines.length * 13 + 6 : 0) + 18;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, totalH);

  // Header
  ctx.fillStyle = '#c9a84c';
  ctx.fillRect(MARGIN, 46, CONTENT_W, 1.5);

  if (book.title) {
    ctx.font = `700 20px ${FONT_TITLE}`;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(book.title, MARGIN, 34);
    if (book.author) {
      ctx.font = `400 12px ${FONT_UI}`;
      ctx.fillStyle = '#666666';
      const tw = ctx.measureText(book.title).width;
      ctx.fillText(`by ${book.author}`, MARGIN + tw + 12, 34);
    }
  }
  ctx.font = `400 10px ${FONT_UI}`;
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('Character List', MARGIN, 44);

  let y = HEADER_H;

  for (const sec of sections) {
    // Section header
    if (sec.title) {
      ctx.fillStyle = sec.color + '22';
      ctx.fillRect(MARGIN, y, CONTENT_W, SECTION_H - 4);
      ctx.fillStyle = darken(sec.color);
      ctx.font = `700 12px ${FONT_UI}`;
      ctx.fillText(sec.title.toUpperCase(), MARGIN + 10, y + 18);
      y += SECTION_H;
    }

    for (const c of sec.chars) {
      const rowTop = y;
      const descLines = wrapText(c.description || '', CONTENT_W - 20, 11);
      const noteLines = wrapText(c.notes || '', CONTENT_W - 20, 10);
      const rowH = ROW_H * 2 + descLines.length * 14 + (noteLines.length > 0 ? noteLines.length * 13 + 6 : 0) + 14;

      // Row background (alternating)
      const idx = sec.chars.indexOf(c);
      if (idx % 2 === 0) {
        ctx.fillStyle = '#f9f9f9';
        ctx.fillRect(MARGIN, rowTop, CONTENT_W, rowH);
      }

      // Left accent bar
      const accentColor = darken(c.color || sec.color);
      ctx.fillStyle = accentColor;
      ctx.fillRect(MARGIN, rowTop, 4, rowH);

      // Name line
      const displayName = [c.title, c.name].filter(Boolean).join(' ');
      ctx.font = `700 13px ${FONT_TITLE}`;
      ctx.fillStyle = '#111111';
      ctx.fillText(displayName, MARGIN + 14, rowTop + 16);

      // Status / age badges
      let badgeX = MARGIN + 14 + ctx.measureText(displayName).width + 10;
      if (c.status && c.status !== 'unknown') {
        const statusColor = c.status === 'alive' ? '#2a7a4a' : '#7a2a2a';
        ctx.font = `600 8px ${FONT_UI}`;
        ctx.fillStyle = statusColor;
        ctx.fillText(c.status.toUpperCase(), badgeX, rowTop + 15);
        badgeX += ctx.measureText(c.status.toUpperCase()).width + 10;
      }
      if (c.age) {
        ctx.font = `400 9px ${FONT_UI}`;
        ctx.fillStyle = '#888888';
        ctx.fillText(`Age: ${c.age}`, badgeX, rowTop + 15);
      }

      // Group memberships
      if (c.groupIds && c.groupIds.length > 0) {
        const groupNames = c.groupIds
          .map(gid => book.groups.find(g => g.id === gid)?.name)
          .filter(Boolean).join(', ');
        ctx.font = `400 9px ${FONT_UI}`;
        ctx.fillStyle = '#888888';
        const gw = ctx.measureText(groupNames).width;
        ctx.fillText(groupNames, MARGIN + CONTENT_W - gw - 4, rowTop + 16);
      }

      // Description
      let lineY = rowTop + 30;
      if (descLines.length > 0) {
        ctx.font = `400 11px ${FONT_UI}`;
        ctx.fillStyle = '#333333';
        for (const line of descLines) {
          ctx.fillText(line, MARGIN + 14, lineY);
          lineY += 14;
        }
      } else {
        ctx.font = `italic 10px ${FONT_UI}`;
        ctx.fillStyle = '#bbbbbb';
        ctx.fillText('No description added.', MARGIN + 14, lineY);
        lineY += 14;
      }

      // Notes
      if (noteLines.length > 0) {
        lineY += 4;
        ctx.font = `italic 10px ${FONT_UI}`;
        ctx.fillStyle = '#888888';
        ctx.fillText('Notes:', MARGIN + 14, lineY);
        lineY += 13;
        for (const line of noteLines) {
          ctx.fillText(line, MARGIN + 24, lineY);
          lineY += 13;
        }
      }

      // Bottom separator
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN, rowTop + rowH);
      ctx.lineTo(MARGIN + CONTENT_W, rowTop + rowH);
      ctx.stroke();

      y += rowH;
    }
    y += 8; // gap between sections
  }

  // Footer
  ctx.font = `400 9px ${FONT_UI}`;
  ctx.fillStyle = '#cccccc';
  ctx.fillText(
    `${book.characters.length} characters · Generated by CharacterWeb`,
    MARGIN, totalH - 12
  );

  // Wrap into multi-page PDF
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW_mm = pdf.internal.pageSize.getWidth();
  const pageH_mm = pdf.internal.pageSize.getHeight();
  const margin_mm = 8;
  const availW_mm = pageW_mm - margin_mm * 2;

  // Scale canvas width to fit A4 width
  const mmPerPx = availW_mm / PAGE_W;
  const totalH_mm = totalH * mmPerPx;
  const pageH_px = pageH_mm / mmPerPx;

  // Split canvas into pages
  let pageTop = 0;
  let isFirstPage = true;
  while (pageTop < totalH) {
    const sliceH = Math.min(pageH_px, totalH - pageTop);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = PAGE_W * SCALE;
    sliceCanvas.height = sliceH * SCALE;
    const sliceCtx = sliceCanvas.getContext('2d')!;
    sliceCtx.drawImage(canvas, 0, pageTop * SCALE, PAGE_W * SCALE, sliceH * SCALE, 0, 0, PAGE_W * SCALE, sliceH * SCALE);
    const dataUrl = sliceCanvas.toDataURL('image/png', 1.0);
    if (!isFirstPage) pdf.addPage();
    pdf.addImage(dataUrl, 'PNG', margin_mm, margin_mm, availW_mm, sliceH * mmPerPx);
    pageTop += sliceH;
    isFirstPage = false;
  }

  pdf.save(`${(book.title || 'characters').replace(/\s+/g, '-')}-character-list.pdf`);
}

// ── Text wrapping helper ──────────────────────────────────────
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  if (!text) return [];
  const avgCharW = fontSize * 0.55;
  const charsPerLine = Math.floor(maxWidth / avgCharW);
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > charsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function darken(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return '#333333';
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.55);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.55);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.55);
  return `rgb(${r},${g},${b})`;
}

// ── Component ─────────────────────────────────────────────────

interface CharacterListViewProps {
  onClose: () => void;
}

export function CharacterListView({ onClose }: CharacterListViewProps) {
  const { book } = useBook();
  const [groupByGroup, setGroupByGroup] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(book.characters.map(c => c.id)));
  const collapseAll = () => setExpandedIds(new Set());

  const handleExport = useCallback(async () => {
    if (book.characters.length === 0) { toast.error('No characters to export.'); return; }
    setExporting(true);
    try {
      await exportCharacterListAsPdf(book, groupByGroup);
      toast.success('Character list PDF downloaded!');
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setExporting(false);
    }
  }, [book, groupByGroup]);

  // Build display sections
  type DisplaySection = { title: string; color: string; chars: Character[] };
  const sections: DisplaySection[] = [];
  if (groupByGroup && book.groups.length > 0) {
    for (const group of book.groups) {
      const members = book.characters.filter(c => c.groupIds?.includes(group.id));
      if (members.length > 0) sections.push({ title: group.name, color: group.color, chars: members });
    }
    const ungrouped = book.characters.filter(c => !c.groupIds || c.groupIds.length === 0);
    if (ungrouped.length > 0) sections.push({ title: 'Ungrouped', color: '#8899aa', chars: ungrouped });
  } else {
    sections.push({ title: '', color: '#c9a84c', chars: [...book.characters] });
  }

  const GENDER_ICONS: Record<string, string> = { male: '♂', female: '♀', 'non-binary': '⚧', unknown: '' };
  const STATUS_COLORS: Record<string, string> = { alive: '#6ec98b', deceased: '#c94c4c', unknown: '#8899aa' };

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col"
      style={{ background: '#0f1117' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ background: '#141824', borderBottom: '1px solid #2a3350' }}
      >
        <div className="flex items-center gap-3">
          <BookOpen size={16} style={{ color: '#c9a84c' }} />
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: '#e8e0d0' }}>
            Character List
          </span>
          {book.title && (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#8899aa' }}>
              — {book.title}
            </span>
          )}
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              color: '#8899aa', background: '#1e2535',
              border: '1px solid #3a4560', borderRadius: 4, padding: '1px 7px',
            }}
          >
            {book.characters.length} characters
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Group by group toggle */}
          <button
            onClick={() => setGroupByGroup(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all"
            style={{
              background: groupByGroup ? '#c9a84c18' : '#1e2535',
              border: `1px solid ${groupByGroup ? '#c9a84c60' : '#3a4560'}`,
              color: groupByGroup ? '#c9a84c' : '#8899aa',
              fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
            }}
          >
            <Users size={11} /> Group by group
          </button>
          {/* Expand/collapse all */}
          <button
            onClick={expandAll}
            className="px-2.5 py-1 rounded-lg"
            style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#8899aa', fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1 rounded-lg"
            style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#8899aa', fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
          >
            Collapse all
          </button>
          {/* Export PDF */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: exporting ? '#1e2535' : '#c9a84c',
              border: 'none',
              color: exporting ? '#8899aa' : '#0f1117',
              fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.5 : 1,
            }}
          >
            <Download size={11} />
            {exporting ? 'Exporting…' : 'Export as PDF'}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#8899aa', cursor: 'pointer' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 24px' }}>
        {book.characters.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full gap-3"
            style={{ color: '#8899aa', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
          >
            <BookOpen size={32} style={{ color: '#3a4560' }} />
            <p>No characters yet. Add characters from the sidebar.</p>
          </div>
        ) : (
          sections.map((sec, si) => (
            <div key={si} style={{ marginBottom: 20 }}>
              {/* Section header */}
              {sec.title && (
                <div
                  className="flex items-center gap-2 mb-2 pb-1"
                  style={{ borderBottom: `2px solid ${sec.color}40` }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: sec.color, flexShrink: 0 }} />
                  <span style={{
                    fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700,
                    color: sec.color, letterSpacing: '0.05em',
                  }}>
                    {sec.title}
                  </span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: '#556070' }}>
                    {sec.chars.length} {sec.chars.length === 1 ? 'character' : 'characters'}
                  </span>
                </div>
              )}

              {/* Character rows */}
              {sec.chars.map((c) => {
                const isExpanded = expandedIds.has(c.id);
                const accentColor = c.color || sec.color;
                const displayName = [c.title, c.name].filter(Boolean).join(' ');
                const groupNames = c.groupIds?.map(gid => book.groups.find(g => g.id === gid)?.name).filter(Boolean).join(', ');

                return (
                  <div
                    key={c.id}
                    style={{
                      background: '#141824',
                      border: '1px solid #2a3350',
                      borderLeft: `4px solid ${accentColor}`,
                      borderRadius: 6,
                      marginBottom: 6,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Row header — always visible */}
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      {/* Name */}
                      <span style={{
                        fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700,
                        color: '#e8e0d0', flex: 1, minWidth: 0,
                      }}>
                        {displayName}
                        {GENDER_ICONS[c.gender] && (
                          <span style={{ fontSize: 10, color: '#8899aa', marginLeft: 6 }}>
                            {GENDER_ICONS[c.gender]}
                          </span>
                        )}
                      </span>
                      {/* Status badge */}
                      {c.status && c.status !== 'unknown' && (
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600,
                          color: STATUS_COLORS[c.status], background: STATUS_COLORS[c.status] + '20',
                          border: `1px solid ${STATUS_COLORS[c.status]}40`,
                          borderRadius: 3, padding: '1px 5px', flexShrink: 0,
                        }}>
                          {c.status.toUpperCase()}
                        </span>
                      )}
                      {/* Age */}
                      {c.age && (
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: '#8899aa', flexShrink: 0 }}>
                          Age {c.age}
                        </span>
                      )}
                      {/* Group tags */}
                      {groupNames && (
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: '#8899aa',
                          background: '#1e2535', border: '1px solid #3a4560',
                          borderRadius: 3, padding: '1px 5px', flexShrink: 0, maxWidth: 140,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {groupNames}
                        </span>
                      )}
                      {/* Description preview (collapsed) */}
                      {!isExpanded && c.description && (
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: '#556070',
                          maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', flexShrink: 1,
                        }}>
                          {c.description}
                        </span>
                      )}
                      {/* Expand icon */}
                      <span style={{ color: '#556070', flexShrink: 0 }}>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </span>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0 16px 14px 16px',
                          borderTop: '1px solid #1e2535',
                        }}
                      >
                        {c.description ? (
                          <p style={{
                            fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#c8d0dc',
                            lineHeight: 1.6, marginTop: 10, marginBottom: 0,
                          }}>
                            {c.description}
                          </p>
                        ) : (
                          <p style={{
                            fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                            color: '#556070', fontStyle: 'italic', marginTop: 10,
                          }}>
                            No description added.
                          </p>
                        )}
                        {c.notes && (
                          <div style={{ marginTop: 8 }}>
                            <span style={{
                              fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                              color: '#8899aa', fontWeight: 600, letterSpacing: '0.05em',
                            }}>
                              NOTES
                            </span>
                            <p style={{
                              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                              color: '#8899aa', fontStyle: 'italic', lineHeight: 1.5,
                              marginTop: 3,
                            }}>
                              {c.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
