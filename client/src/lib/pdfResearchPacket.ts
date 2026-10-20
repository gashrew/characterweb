// ============================================================
// pdfResearchPacket — text-first appendix pages for map PDF exports
// Design: Scholarly Codex reading packet; each research stream begins
// on its own portrait page and flows naturally across subsequent pages.
// ============================================================
import type { jsPDF } from 'jspdf';
import type { BookData, CanvasAnnotation, Character } from './types';

interface PacketEntry {
  heading: string;
  body: string;
  meta?: string;
}

export interface PdfPacketSections {
  map: boolean;
  characters: boolean;
  chapters: boolean;
  timeline: boolean;
  quotes: boolean;
  bibliography: boolean;
}

export type PdfCitationStyle = 'compact' | 'mla' | 'chicago';

export const DEFAULT_PDF_PACKET_SECTIONS: PdfPacketSections = {
  map: true,
  characters: true,
  chapters: true,
  timeline: true,
  quotes: true,
  bibliography: true,
};

export const PDF_PACKET_PRESETS: Record<'reading' | 'study' | 'research', PdfPacketSections> = {
  reading: { map: true, characters: true, chapters: true, timeline: false, quotes: false, bibliography: false },
  study: { map: true, characters: true, chapters: true, timeline: true, quotes: true, bibliography: false },
  research: { ...DEFAULT_PDF_PACKET_SECTIONS },
};

function citationText(annotation: CanvasAnnotation): string {
  const citations = (annotation.citations ?? []).filter(citation => citation.source.trim());
  if (!citations.length) return '';
  return citations.map(citation => [citation.source, citation.locator, citation.url].filter(Boolean).join(' · ')).join(' | ');
}

function linkedCharacterName(annotation: CanvasAnnotation, characters: Character[]): string | undefined {
  return annotation.characterId ? characters.find(character => character.id === annotation.characterId)?.name : undefined;
}

function formatBibliographyEntry(citation: { source: string; locator?: string; url?: string }, style: PdfCitationStyle): PacketEntry {
  const source = citation.source.replace(/[.\s]+$/, '');
  const locator = citation.locator?.trim();
  const url = citation.url?.trim();
  if (style === 'mla') return { heading: source, body: [locator ? `${locator}.` : '', url].filter(Boolean).join(' ') || `${source}.` };
  if (style === 'chicago') return { heading: source, body: [locator, url].filter(Boolean).join('. ') || `${source}.` };
  return { heading: source, body: locator || 'Source cited in the research notes.', meta: url };
}

function addSection(pdf: jsPDF, book: BookData, title: string, subtitle: string, entries: PacketEntry[]) {
  if (!entries.length) return;
  const pageW = 210;
  const pageH = 297;
  const margin = 17;
  const contentW = pageW - margin * 2;
  let y = 0;
  let pageNumber = 0;

  const newPage = () => {
    pdf.addPage('a4', 'portrait');
    pageNumber += 1;
    pdf.setFillColor(248, 247, 243);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.setDrawColor(201, 168, 76);
    pdf.setLineWidth(0.45);
    pdf.line(margin, 21, pageW - margin, 21);
    pdf.setTextColor(42, 43, 46);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(17);
    pdf.text(title, margin, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(104, 106, 112);
    pdf.text(`${book.title || 'Character map'} · ${subtitle}${pageNumber > 1 ? ` · continued` : ''}`, margin, 28);
    y = 38;
  };

  newPage();
  for (const entry of entries) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.2);
    const bodyLines = pdf.splitTextToSize(entry.body || 'No additional notes recorded.', contentW - 10) as string[];
    pdf.setFontSize(8.2);
    const metaLines = entry.meta ? (pdf.splitTextToSize(entry.meta, contentW - 10) as string[]) : [];
    const required = 11 + bodyLines.length * 5.2 + (metaLines.length ? metaLines.length * 4.1 + 6 : 0) + 13;
    if (y + required > pageH - 19) newPage();
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(219, 215, 205);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(margin, y, contentW, required, 2, 2, 'FD');
    pdf.setFillColor(201, 168, 76);
    pdf.rect(margin, y, 1.5, required, 'F');
    pdf.setTextColor(49, 50, 54);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.4);
    pdf.text(entry.heading, margin + 6, y + 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.2);
    pdf.setTextColor(55, 57, 62);
    pdf.text(bodyLines, margin + 6, y + 15);
    if (metaLines.length) {
      const metaY = y + 15 + bodyLines.length * 5.2 + 3;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8.2);
      pdf.setTextColor(111, 92, 48);
      pdf.text(metaLines, margin + 6, metaY);
    }
    y += required + 6;
  }
}

/** Appends configured research sections after the optional landscape map page. */
export function appendResearchPacket(
  pdf: jsPDF,
  book: BookData,
  visibleCharacterIds: Set<string>,
  sections: PdfPacketSections = DEFAULT_PDF_PACKET_SECTIONS,
  citationStyle: PdfCitationStyle = 'compact',
) {
  const characters = book.characters.filter(character => visibleCharacterIds.has(character.id));
  const characterEntries: PacketEntry[] = characters.sort((a, b) => a.name.localeCompare(b.name)).map(character => {
    const linkedNotes = (book.annotations ?? []).filter(annotation => annotation.characterId === character.id).map(annotation => `${annotation.layer === 'chapters' ? `Chapter ${annotation.chapterNumber ?? '—'}` : annotation.layer === 'timeline' ? annotation.timelineDate || 'Timeline' : annotation.layer === 'quotes' ? 'Quote' : 'Note'}: ${annotation.text}`);
    return {
      heading: `${character.name}${character.title ? ` · ${character.title}` : ''}`,
      body: [character.description, character.notes, ...linkedNotes].filter(Boolean).join('\n\n'),
      meta: character.groupIds?.length ? `Groups: ${character.groupIds.map(id => book.groups.find(group => group.id === id)?.name ?? id).join(', ')}` : undefined,
    };
  });
  if (sections.characters) addSection(pdf, book, 'Character Notes', 'character list and observations', characterEntries);

  const chapters = (book.annotations ?? []).filter(annotation => annotation.layer === 'chapters').sort((a, b) => (a.chapterNumber ?? Number.MAX_SAFE_INTEGER) - (b.chapterNumber ?? Number.MAX_SAFE_INTEGER));
  if (sections.chapters) addSection(pdf, book, 'Chapters', 'chapter notes in reading order', chapters.map(annotation => ({
    heading: `Chapter ${annotation.chapterNumber ?? '—'}${linkedCharacterName(annotation, book.characters) ? ` · ${linkedCharacterName(annotation, book.characters)}` : ''}`,
    body: annotation.text,
    meta: [annotation.tags?.length ? `Tags: ${annotation.tags.join(', ')}` : '', citationText(annotation)].filter(Boolean).join(' | ') || undefined,
  })));

  const timeline = (book.annotations ?? []).filter(annotation => annotation.layer === 'timeline').sort((a, b) => (a.timelineDate ?? '').localeCompare(b.timelineDate ?? '') || (a.timelineGroup ?? '').localeCompare(b.timelineGroup ?? ''));
  if (sections.timeline) addSection(pdf, book, 'Timeline', 'chronological research notes', timeline.map(annotation => ({
    heading: `${annotation.timelineDate || 'Undated'}${annotation.timelineGroup ? ` · ${annotation.timelineGroup}` : ''}`,
    body: annotation.text,
    meta: [linkedCharacterName(annotation, book.characters), annotation.tags?.length ? `Tags: ${annotation.tags.join(', ')}` : '', citationText(annotation)].filter(Boolean).join(' | ') || undefined,
  })));

  const quotes = (book.annotations ?? []).filter(annotation => annotation.layer === 'quotes' || annotation.format?.quote);
  if (sections.quotes) addSection(pdf, book, 'Quotations', 'selected excerpts and references', quotes.map(annotation => ({
    heading: linkedCharacterName(annotation, book.characters) ? `Quote · ${linkedCharacterName(annotation, book.characters)}` : 'Quotation',
    body: `“${annotation.text}”`,
    meta: [annotation.tags?.length ? `Tags: ${annotation.tags.join(', ')}` : '', citationText(annotation)].filter(Boolean).join(' | ') || undefined,
  })));

  if (sections.bibliography) {
    const sources = new Map<string, { source: string; locator?: string; url?: string }>();
    for (const annotation of book.annotations ?? []) {
      for (const citation of annotation.citations ?? []) {
        const source = citation.source.trim();
        if (!source) continue;
        const locator = citation.locator?.trim();
        const url = citation.url?.trim();
        const key = `${source.toLocaleLowerCase()}|${locator?.toLocaleLowerCase() ?? ''}|${url?.toLocaleLowerCase() ?? ''}`;
        if (!sources.has(key)) sources.set(key, { source, locator, url });
      }
    }
    const bibliography = Array.from(sources.values()).sort((a, b) => a.source.localeCompare(b.source) || (a.locator ?? '').localeCompare(b.locator ?? '')).map(citation => formatBibliographyEntry(citation, citationStyle));
    addSection(pdf, book, 'Bibliography', `${citationStyle === 'mla' ? 'MLA' : citationStyle === 'chicago' ? 'Chicago' : 'Compact'} sources cited in annotations`, bibliography);
  }
}
