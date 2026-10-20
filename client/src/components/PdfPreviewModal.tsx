// ============================================================
// PdfPreviewModal — PDF export preview with live toggles
// Design: Dark Scholarly Codex
// Shows a white-theme canvas preview of the PDF output.
// Toggles: relationship labels on lines, relationship legend.
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download, RefreshCw, Eye, EyeOff, List, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { renderPdfCanvas, downloadPdfFromCanvas } from '@/lib/exportPdf';
import { useBook } from '@/contexts/BookContext';
import type { BookData, Character, Group } from '@/lib/types';
import { ExportScopeControl, type ExportScope } from '@/components/ExportScopeControl';
import { DEFAULT_PDF_PACKET_SECTIONS, PDF_PACKET_PRESETS, type PdfCitationStyle, type PdfPacketSections } from '@/lib/pdfResearchPacket';

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  book: BookData;
  visibleCharacterIds: Set<string>;
  defaultShowLabels: boolean;
  filename: string;
  exportScope: ExportScope;
  onExportScopeChange: (scope: ExportScope) => void;
  characters: Character[];
  focusCharacterId: string | null;
  onFocusCharacterChange: (characterId: string) => void;
  groups: Group[];
  groupId: string | null;
  onGroupChange: (groupId: string) => void;
  hiddenCircleGroupIdsOverride?: Set<string>;
}

export function PdfPreviewModal({
  open,
  onClose,
  book,
  visibleCharacterIds,
  defaultShowLabels,
  filename,
  exportScope,
  onExportScopeChange,
  characters,
  focusCharacterId,
  onFocusCharacterChange,
  groups,
  groupId,
  onGroupChange,
  hiddenCircleGroupIdsOverride,
}: PdfPreviewModalProps) {
  const { hiddenCircleGroupIds: storedHiddenCircleGroupIds, circleOverlapStep, circleGroupOrder, visibleAnnotationLayers } = useBook();
  const hiddenCircleGroupIds = hiddenCircleGroupIdsOverride ?? storedHiddenCircleGroupIds;
  const [showLabels, setShowLabels] = useState(defaultShowLabels);
  const [showLegend, setShowLegend] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [packetSections, setPacketSections] = useState<PdfPacketSections>(DEFAULT_PDF_PACKET_SECTIONS);
  const [citationStyle, setCitationStyle] = useState<PdfCitationStyle>('compact');
  const [rendering, setRendering] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contentSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const render = useCallback(async () => {
    if (book.characters.length === 0) return;
    setRendering(true);
    try {
      const { canvas, contentW, contentH } = await renderPdfCanvas(
        book, visibleCharacterIds, showLabels, showLegend, hiddenCircleGroupIds, circleOverlapStep, circleGroupOrder, showAnnotations, visibleAnnotationLayers
      );
      canvasRef.current = canvas;
      contentSizeRef.current = { w: contentW, h: contentH };
      setPreviewDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      toast.error(`Preview failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setRendering(false);
    }
  }, [book, visibleCharacterIds, showLabels, showLegend, hiddenCircleGroupIds, circleOverlapStep, circleGroupOrder, showAnnotations, visibleAnnotationLayers]);

  // Re-render whenever modal opens or toggles change
  useEffect(() => {
    if (open) render();
  }, [open, showLabels, showLegend, showAnnotations, render]);

  // Sync initial preview controls when the modal opens.
  useEffect(() => {
    if (open) {
      setShowLabels(defaultShowLabels);
      setShowAnnotations(true);
      setPreviewZoom(100);
      setPacketSections(DEFAULT_PDF_PACKET_SECTIONS);
      setCitationStyle('compact');
    }
  }, [open, defaultShowLabels]);

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) { toast.error('Preview not ready yet.'); return; }
    downloadPdfFromCanvas(canvasRef.current, contentSizeRef.current.w, contentSizeRef.current.h, filename, { book, visibleCharacterIds, sections: packetSections, citationStyle });
    toast.success('PDF downloaded — ready for reMarkable!');
    onClose();
  }, [book, citationStyle, filename, onClose, packetSections, visibleCharacterIds]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-5xl w-[92vw] p-0 overflow-hidden"
        style={{
          background: '#141824',
          border: '1px solid #2a3350',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          borderRadius: 12,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader
          className="flex-shrink-0 px-5 py-3 flex flex-row items-center justify-between"
          style={{ borderBottom: '1px solid #2a3350', background: '#0f1117' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: '#c9a84c' }} />
            <DialogTitle
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#e8e0d0',
              }}
            >
              PDF Preview
            </DialogTitle>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: '#8899aa', marginLeft: 4 }}>
              — {filename}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8899aa',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
            title="Close"
          >
            ×
          </button>
        </DialogHeader>

        {/* Toggle controls */}
        <div
          className="flex-shrink-0 flex flex-wrap items-center gap-3 px-5 py-2.5"
          style={{ borderBottom: '1px solid #1e2535', background: '#141824' }}
        >
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: '#8899aa' }}>
            Preview options:
          </span>

          {/* Labels toggle */}
          <button
            onClick={() => setShowLabels(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all"
            style={{
              background: showLabels ? '#c9a84c18' : '#1e2535',
              border: `1px solid ${showLabels ? '#c9a84c60' : '#3a4560'}`,
              color: showLabels ? '#c9a84c' : '#8899aa',
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {showLabels ? <Eye size={11} /> : <EyeOff size={11} />}
            Relationship labels
          </button>

          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all"
            style={{
              background: showLegend ? '#c9a84c18' : '#1e2535',
              border: `1px solid ${showLegend ? '#c9a84c60' : '#3a4560'}`,
              color: showLegend ? '#c9a84c' : '#8899aa',
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            <List size={11} />
            Relationship legend
          </button>

          <button
            onClick={() => setShowAnnotations(value => !value)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all"
            style={{
              background: showAnnotations ? '#c9a84c18' : '#1e2535',
              border: `1px solid ${showAnnotations ? '#c9a84c60' : '#3a4560'}`,
              color: showAnnotations ? '#c9a84c' : '#8899aa',
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {showAnnotations ? <Eye size={11} /> : <EyeOff size={11} />}
            Annotations
          </button>

          <div className="flex items-center gap-1" style={{ borderLeft: '1px solid #2a3350', paddingLeft: 12 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: '#8899aa', marginRight: 3 }}>Print zoom</span>
            <button
              type="button"
              onClick={() => setPreviewZoom(value => Math.max(50, value - 25))}
              disabled={previewZoom <= 50}
              title="Zoom out"
              style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#a9b6c8', borderRadius: 5, padding: 4, lineHeight: 0, cursor: previewZoom <= 50 ? 'not-allowed' : 'pointer', opacity: previewZoom <= 50 ? 0.45 : 1 }}
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(100)}
              title="Reset preview zoom to 100%"
              style={{ minWidth: 42, background: previewZoom === 100 ? '#c9a84c18' : '#1e2535', border: `1px solid ${previewZoom === 100 ? '#c9a84c60' : '#3a4560'}`, color: previewZoom === 100 ? '#c9a84c' : '#a9b6c8', borderRadius: 5, padding: '3px 5px', fontSize: 10, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
            >
              {previewZoom}%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(value => Math.min(200, value + 25))}
              disabled={previewZoom >= 200}
              title="Zoom in"
              style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#a9b6c8', borderRadius: 5, padding: 4, lineHeight: 0, cursor: previewZoom >= 200 ? 'not-allowed' : 'pointer', opacity: previewZoom >= 200 ? 0.45 : 1 }}
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Re-render indicator */}
          {rendering && (
            <div className="flex items-center gap-1.5" style={{ color: '#8899aa', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
              <RefreshCw size={10} className="animate-spin" />
              Rendering…
            </div>
          )}

          {/* Spacer + Download */}
          <div className="flex-1" />
          <button
            onClick={handleDownload}
            disabled={rendering || !previewDataUrl}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all"
            style={{
              background: rendering || !previewDataUrl ? '#1e2535' : '#c9a84c',
              border: 'none',
              color: rendering || !previewDataUrl ? '#8899aa' : '#0f1117',
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              cursor: rendering || !previewDataUrl ? 'not-allowed' : 'pointer',
              opacity: rendering || !previewDataUrl ? 0.5 : 1,
            }}
          >
            <Download size={12} />
            Download PDF
          </button>
        </div>

        <div className="flex-shrink-0 px-5 py-3" style={{ borderBottom: '1px solid #1e2535', background: '#111724' }}>
          <ExportScopeControl
            scope={exportScope}
            onScopeChange={onExportScopeChange}
            characters={characters}
            focusCharacterId={focusCharacterId}
            onFocusCharacterChange={onFocusCharacterChange}
            groups={groups}
            groupId={groupId}
            onGroupChange={onGroupChange}
          />
        </div>

        <div className="flex-shrink-0 flex flex-wrap items-center gap-1.5 px-5 py-2.5" style={{ borderBottom: '1px solid #1e2535', background: '#111724' }}>
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8899aa' }}>Packet</span>
          {([
            ['reading', 'Reading'], ['study', 'Study'], ['research', 'Research'],
          ] as Array<[keyof typeof PDF_PACKET_PRESETS, string]>).map(([key, label]) => <button key={key} type="button" onClick={() => setPacketSections({ ...PDF_PACKET_PRESETS[key] })} className="rounded border px-2 py-1 text-[10px] transition-colors" style={{ borderColor: JSON.stringify(packetSections) === JSON.stringify(PDF_PACKET_PRESETS[key]) ? '#c9a84c80' : '#34415e', color: JSON.stringify(packetSections) === JSON.stringify(PDF_PACKET_PRESETS[key]) ? '#d9b957' : '#8190a7', background: JSON.stringify(packetSections) === JSON.stringify(PDF_PACKET_PRESETS[key]) ? '#c9a84c14' : 'transparent' }}>{label}</button>)}
          <span className="ml-1 mr-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8899aa' }}>Citation</span>
          <select value={citationStyle} onChange={event => setCitationStyle(event.target.value as PdfCitationStyle)} className="h-7 rounded border px-2 text-[10px]" style={{ background: '#151d2c', borderColor: '#3a4761', color: '#c6d2e1' }}><option value="compact">Compact</option><option value="mla">MLA</option><option value="chicago">Chicago</option></select>
        </div>

        <div className="flex-shrink-0 flex flex-wrap items-center gap-1.5 px-5 py-2.5" style={{ borderBottom: '1px solid #1e2535', background: '#111724' }}>
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8899aa' }}>Include pages</span>
          {([
            ['map', 'Map'], ['characters', 'Characters'], ['chapters', 'Chapters'], ['timeline', 'Timeline'], ['quotes', 'Quotes'], ['bibliography', 'Bibliography'],
          ] as Array<[keyof PdfPacketSections, string]>).map(([key, label]) => <button key={key} type="button" onClick={() => setPacketSections(current => ({ ...current, [key]: !current[key] }))} className="rounded border px-2 py-1 text-[10px] transition-colors" style={{ borderColor: packetSections[key] ? '#c9a84c80' : '#34415e', color: packetSections[key] ? '#d9b957' : '#8190a7', background: packetSections[key] ? '#c9a84c14' : 'transparent' }}>{packetSections[key] ? '✓ ' : ''}{label}</button>)}
          <span className="ml-1 text-[9px]" style={{ color: '#64738b' }}>Map preview only; selected reading sections follow in the download.</span>
        </div>

        {/* Preview area */}
        <div
          className="flex-1 overflow-auto"
          style={{
            background: '#0a0d14',
            minHeight: 0,
            padding: 20,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          {rendering && !previewDataUrl ? (
            <div
              className="flex flex-col items-center justify-center gap-3"
              style={{ color: '#8899aa', fontFamily: "'DM Sans', sans-serif", fontSize: 13, minHeight: 300 }}
            >
              <RefreshCw size={24} className="animate-spin" style={{ color: '#c9a84c' }} />
              Rendering preview…
            </div>
          ) : previewDataUrl ? (
            <div style={{ width: '100%', minWidth: '100%', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: `${previewZoom}%`, flex: '0 0 auto', opacity: packetSections.map ? 1 : 0.38 }}>
              {/* Subtle re-rendering overlay */}
              {rendering && (
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(10,13,20,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 4, zIndex: 10,
                  }}
                >
                  <RefreshCw size={20} className="animate-spin" style={{ color: '#c9a84c' }} />
                </div>
              )}
              <img
                src={previewDataUrl}
                alt="PDF preview"
                style={{
                  width: '100%',
                  maxWidth: 'none',
                  borderRadius: 4,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                  display: 'block',
                  border: '1px solid #2a3350',
                }}
              />
              <p style={{
                marginTop: 10, textAlign: 'center',
                fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: '#556070',
              }}>
                {packetSections.map ? `Preview zoom is ${previewZoom}%. It does not change the downloaded A4 landscape PDF.` : 'Map page is excluded; selected reading sections will be downloaded.'}
              </p>
            </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
