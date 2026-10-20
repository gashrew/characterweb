// ============================================================
// Home — Main application page
// Design: Dark Scholarly Codex — full-screen canvas + sidebar
// ============================================================
import { useState, useCallback, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useBook } from '@/contexts/BookContext';
import { GraphCanvas } from '@/components/GraphCanvas';
import { CharacterDetailPanel } from '@/components/CharacterDetailPanel';
import { HelpOverlay } from '@/components/HelpOverlay';
import { Sidebar } from '@/components/Sidebar';
import { CharacterDialog } from '@/components/CharacterDialog';
import { RelationshipDialog } from '@/components/RelationshipDialog';
import { GroupDialog } from '@/components/GroupDialog';
import { BookMarked, BookOpen, Camera, CalendarDays, Expand, FileText, List, Quote, X } from 'lucide-react';
import { CharacterListView } from '@/components/CharacterListView';
import { toast } from 'sonner';
import { exportBookAsPng } from '@/lib/exportCanvas';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';
import { ExportScopeControl, type ExportScope } from '@/components/ExportScopeControl';
import { GroupSequenceView } from '@/components/GroupSequenceView';
import { TimelineView } from '@/components/TimelineView';
import { QuotesView } from '@/components/QuotesView';
import { ChapterView } from '@/components/ChapterView';

export default function Home() {
  const {
    editingCharacterId, setEditingCharacterId,
    editingRelationshipId, setEditingRelationshipId,
    book,
    focusedCharacterId, setFocusedCharacterId,
    hiddenCharacterIds, spotlightGroupIds, showRelationshipLabels,
    clearGroupSpotlight, focusCircleGroupId, setFocusCircleGroupId,
    hiddenCircleGroupIds, circleOverlapStep, circleGroupOrder,
  } = useBook();

  const focusedId = focusedCharacterId;

  // The map-wide display respects hidden characters and group spotlighting.
  const allMapCharacterIds = useMemo(() => {
    return new Set(
      book.characters
        .filter(c => {
          if (hiddenCharacterIds.has(c.id)) return false;
          if (spotlightGroupIds.size > 0 && !(c.groupIds && c.groupIds.some(gid => spotlightGroupIds.has(gid)))) return false;
          return true;
        })
        .map(c => c.id)
    );
  }, [book.characters, hiddenCharacterIds, spotlightGroupIds]);

  // A focused cluster contains the character and every directly connected
  // standard relationship endpoint, matching the current focus-mode view.
  const focusedClusterCharacterIds = useMemo(() => {
    if (!focusedCharacterId) return new Set<string>();
    const ids = new Set<string>([focusedCharacterId]);
    for (const rel of book.relationships) {
      if (rel.sourceId === focusedCharacterId) ids.add(rel.targetId);
      if (rel.targetId === focusedCharacterId) ids.add(rel.sourceId);
    }
    for (const rel of (book.convergingRelationships ?? [])) {
      if (rel.targetId === focusedCharacterId) rel.sourceIds.forEach(id => ids.add(id));
      if (rel.sourceIds.includes(focusedCharacterId)) {
        ids.add(rel.targetId);
        rel.sourceIds.forEach(id => ids.add(id));
      }
    }
    for (const rel of (book.familyUnitRelationships ?? [])) {
      if (rel.partnerIds.includes(focusedCharacterId) || rel.childIds.includes(focusedCharacterId)) {
        rel.partnerIds.forEach(id => ids.add(id));
        rel.childIds.forEach(id => ids.add(id));
      }
    }
    return ids;
  }, [book.relationships, book.convergingRelationships, book.familyUnitRelationships, focusedCharacterId]);

  const visibleCharacterIds = focusedCharacterId ? focusedClusterCharacterIds : allMapCharacterIds;

  const circleGroups = useMemo(
    () => book.groups.filter(group => group.groupType === 'circle'),
    [book.groups],
  );
  const exportGroups = book.groups;
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportGroupId, setExportGroupId] = useState<string | null>(null);
  const [exportFocusCharacterId, setExportFocusCharacterId] = useState<string | null>(null);
  const selectedExportGroupId = exportGroups.some(group => group.id === exportGroupId)
    ? exportGroupId
    : exportGroups[0]?.id ?? null;
  const selectedExportFocusId = book.characters.some(character => character.id === exportFocusCharacterId)
    ? exportFocusCharacterId
    : focusedCharacterId ?? book.characters[0]?.id ?? null;

  const handleExportScopeChange = useCallback((scope: ExportScope) => {
    if (scope === 'circle' && !exportGroupId && exportGroups[0]) {
      setExportGroupId(exportGroups[0].id);
    }
    if (scope === 'focus' && !exportFocusCharacterId) {
      setExportFocusCharacterId(focusedCharacterId ?? book.characters[0]?.id ?? null);
    }
    setExportScope(scope);
  }, [book.characters, exportFocusCharacterId, exportGroupId, exportGroups, focusedCharacterId]);

  const exportVisibleCharacterIds = useMemo(() => {
    if (exportScope === 'focus' && selectedExportFocusId) {
      const ids = new Set<string>([selectedExportFocusId]);
      for (const rel of book.relationships) {
        if (rel.sourceId === selectedExportFocusId) ids.add(rel.targetId);
        if (rel.targetId === selectedExportFocusId) ids.add(rel.sourceId);
      }
      for (const rel of (book.convergingRelationships ?? [])) {
        if (rel.targetId === selectedExportFocusId || rel.sourceIds.includes(selectedExportFocusId)) {
          rel.sourceIds.forEach(id => ids.add(id));
          ids.add(rel.targetId);
        }
      }
      for (const rel of (book.familyUnitRelationships ?? [])) {
        if (rel.partnerIds.includes(selectedExportFocusId) || rel.childIds.includes(selectedExportFocusId)) {
          rel.partnerIds.forEach(id => ids.add(id));
          rel.childIds.forEach(id => ids.add(id));
        }
      }
      return ids;
    }
    if (exportScope === 'circle' && selectedExportGroupId) {
      return new Set(
        book.characters
          .filter(character => character.groupIds?.includes(selectedExportGroupId))
          .map(character => character.id),
      );
    }
    return allMapCharacterIds;
  }, [allMapCharacterIds, book.characters, book.convergingRelationships, book.familyUnitRelationships, book.relationships, exportScope, selectedExportFocusId, selectedExportGroupId]);

  const exportHiddenCircleGroupIds = useMemo(() => {
    if (exportScope !== 'circle' || !selectedExportGroupId) return hiddenCircleGroupIds;
    return new Set(circleGroups.filter(group => group.id !== selectedExportGroupId).map(group => group.id));
  }, [circleGroups, exportScope, hiddenCircleGroupIds, selectedExportGroupId]);

  const doExportPng = useCallback(async (scale: number, includeAnnotations: boolean) => {
    if (book.characters.length === 0) { toast.error('No characters to export.'); return; }
    const toastId = toast.loading('Rendering character map…');
    try {
      await exportBookAsPng(
        book,
        exportVisibleCharacterIds,
        showRelationshipLabels,
        book.title || 'character-map',
        exportHiddenCircleGroupIds,
        circleOverlapStep,
        circleGroupOrder,
        scale,
        includeAnnotations,
      );
      toast.dismiss(toastId);
      toast.success('Image downloaded!');
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [book, exportVisibleCharacterIds, showRelationshipLabels, exportHiddenCircleGroupIds, circleOverlapStep, circleGroupOrder]);

  const handleExportPng = useCallback(() => {
    if (book.characters.length === 0) { toast.error('No characters to export.'); return; }
    setShowPngDialog(true);
  }, [book.characters.length]);

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showCharacterList, setShowCharacterList] = useState(false);
  const [showGroupSequence, setShowGroupSequence] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showPngDialog, setShowPngDialog] = useState(false);
  const [pngScale, setPngScale] = useState(3);
  const [pngShowAnnotations, setPngShowAnnotations] = useState(true);

  const handleExportPdf = useCallback(() => {
    if (book.characters.length === 0) { toast.error('No characters to export.'); return; }
    setShowPdfPreview(true);
  }, [book.characters.length]);

  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  if (showGroupSequence) {
    return <GroupSequenceView onExit={() => setShowGroupSequence(false)} />;
  }
  if (showTimeline) {
    return <TimelineView onExit={() => setShowTimeline(false)} />;
  }
  if (showQuotes) {
    return <QuotesView onExit={() => setShowQuotes(false)} />;
  }
  if (showChapters) {
    return <ChapterView onExit={() => setShowChapters(false)} />;
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: '#0f1117' }}
    >
      {/* Left Sidebar */}
      <Sidebar
        onAddCharacter={() => setShowAddCharacter(true)}
        onEditCharacter={(id) => setEditingCharacterId(id)}
        onAddRelationship={() => setShowAddRelationship(true)}
        onEditRelationship={(id) => setEditingRelationshipId(id)}
        onAddGroup={() => setShowAddGroup(true)}
        onEditGroup={(id) => setEditingGroupId(id)}
      />

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-2.5"
          style={{ background: '#141824', borderBottom: '1px solid #2a3350', flexShrink: 0 }}
        >
          <div>
            {book.title ? (
              <div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: '#e8e0d0' }}>
                  {book.title}
                </span>
                {book.author && (
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#8899aa', marginLeft: 10 }}>
                    by {book.author}
                  </span>
                )}
                {book.series && (
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: '#c9a84c80', marginLeft: 8 }}>
                    · {book.series}
                  </span>
                )}
              </div>
            ) : (
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: '#8899aa', fontStyle: 'italic' }}>
                Untitled book — add details in the Book tab
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: '#8899aa' }}>
              {book.characters.length} characters · {book.relationships.length} relationships
            </span>
            {/* Character List View button */}
            <button
              onClick={() => setShowCharacterList(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: showCharacterList ? '#c9a84c18' : '#1e2535',
                border: `1px solid ${showCharacterList ? '#c9a84c60' : '#3a4560'}`,
                color: showCharacterList ? '#c9a84c' : '#8899aa',
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
              }}
              title="Toggle character list view"
            >
              <List size={12} /> Character List
            </button>
            <button
              onClick={() => setShowGroupSequence(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: '#1e2535',
                border: '1px solid #3a4560',
                color: '#8899aa',
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c9a84c'; (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8899aa'; (e.currentTarget as HTMLElement).style.borderColor = '#3a4560'; }}
              title="Read each group as a separate focused map"
            >
              <BookOpen size={12} /> Group Sequence
            </button>
            <button
              onClick={() => setShowTimeline(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#8899aa', fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c9a84c'; (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8899aa'; (e.currentTarget as HTMLElement).style.borderColor = '#3a4560'; }}
              title="Read dated research notes chronologically"
            >
              <CalendarDays size={12} /> Timeline
            </button>
            <button
              onClick={() => setShowQuotes(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#8899aa', fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c9a84c'; (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8899aa'; (e.currentTarget as HTMLElement).style.borderColor = '#3a4560'; }}
              title="Read quotation notes in a separate notebook"
            >
              <Quote size={12} /> Quotes
            </button>
            <button
              onClick={() => setShowChapters(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{ background: '#1e2535', border: '1px solid #3a4560', color: '#8899aa', fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c9a84c'; (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8899aa'; (e.currentTarget as HTMLElement).style.borderColor = '#3a4560'; }}
              title="Read chapter notes in order"
            >
              <BookMarked size={12} /> Chapters
            </button>
            {/* Export PDF button (reMarkable) */}
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: '#1e2535',
                border: '1px solid #3a4560',
                color: '#8899aa',
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c9a84c'; (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8899aa'; (e.currentTarget as HTMLElement).style.borderColor = '#3a4560'; }}
              title="Export as PDF (optimised for reMarkable)"
            >
              <FileText size={12} /> Export PDF
            </button>
            {/* Export PNG button */}
            <button
              onClick={handleExportPng}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: '#1e2535',
                border: '1px solid #3a4560',
                color: '#8899aa',
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c9a84c'; (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c60'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8899aa'; (e.currentTarget as HTMLElement).style.borderColor = '#3a4560'; }}
              title="Export canvas as PNG image"
            >
              <Camera size={12} /> Export PNG
            </button>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#6ec98b' }} title="Auto-saved" />
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden" style={{
          background: 'radial-gradient(ellipse at 30% 20%, #1c2438 0%, #121725 55%, #0d111b 100%)',
        }}>
          <ReactFlowProvider>
            <GraphCanvas />
          </ReactFlowProvider>
          <CharacterDetailPanel onEdit={(id) => setEditingCharacterId(id)} />
          <HelpOverlay />
          {/* Character List overlay */}
          {showCharacterList && (
            <CharacterListView onClose={() => setShowCharacterList(false)} />
          )}
          {/* ── Exit Spotlight floating button — visible whenever any spotlight/focus mode is active ── */}
          {(spotlightGroupIds.size > 0 || focusCircleGroupId) && !focusedCharacterId && (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl z-50"
              style={{
                background: '#1e2535ee',
                border: '1px solid #c9a84c80',
                boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                color: '#e8e0d0',
              }}
            >
              {spotlightGroupIds.size > 0 && (
                <span style={{ color: '#8899aa' }}>
                  Spotlighting <strong style={{ color: '#c9a84c' }}>{spotlightGroupIds.size} group{spotlightGroupIds.size > 1 ? 's' : ''}</strong>
                </span>
              )}
              {focusCircleGroupId && (
                <span style={{ color: '#8899aa' }}>
                  Circle focus: <strong style={{ color: '#c9a84c' }}>{book.groups.find(g => g.id === focusCircleGroupId)?.name ?? 'circle'}</strong>
                </span>
              )}
              <button
                onClick={() => { clearGroupSpotlight(); setFocusCircleGroupId(null); }}
                className="flex items-center gap-1.5 ml-2 px-3 py-1 rounded-lg transition-all"
                style={{
                  background: '#c9a84c',
                  color: '#0f1117',
                  fontWeight: 700,
                  fontSize: 11,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <X size={11} /> Exit Spotlight
              </button>
            </div>
          )}

          {/* Focus mode banner */}
          {focusedCharacterId && (() => {
            const focused = book.characters.find(c => c.id === focusedCharacterId);
            return (
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-lg z-50"
                style={{
                  background: '#1e2535ee',
                  border: '1px solid #c9a84c60',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: '#c9a84c',
                }}
              >
                <span style={{ color: '#8899aa' }}>Focused on</span>
                <strong>{focused?.name ?? 'character'}</strong>
                <button
                  onClick={() => setFocusedCharacterId(null)}
                  className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded"
                  style={{ background: '#c9a84c20', border: '1px solid #c9a84c40', color: '#c9a84c', fontSize: 11, cursor: 'pointer' }}
                >
                  <Expand size={10} /> Show all
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Dialogs */}
      <CharacterDialog
        open={showAddCharacter}
        onClose={() => setShowAddCharacter(false)}
      />
      <CharacterDialog
        open={!!editingCharacterId}
        onClose={() => setEditingCharacterId(null)}
        characterId={editingCharacterId}
      />
      <RelationshipDialog
        open={showAddRelationship}
        onClose={() => setShowAddRelationship(false)}
      />
      <RelationshipDialog
        open={!!editingRelationshipId}
        onClose={() => setEditingRelationshipId(null)}
        relationshipId={editingRelationshipId}
      />
      <GroupDialog
        open={showAddGroup}
        onClose={() => setShowAddGroup(false)}
      />
      <GroupDialog
        open={!!editingGroupId}
        onClose={() => setEditingGroupId(null)}
        groupId={editingGroupId}
      />
      <PdfPreviewModal
        open={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        book={book}
        visibleCharacterIds={exportVisibleCharacterIds}
        defaultShowLabels={showRelationshipLabels}
        filename={book.title || 'character-map'}
        exportScope={exportScope}
        onExportScopeChange={handleExportScopeChange}
        characters={book.characters}
        focusCharacterId={selectedExportFocusId}
        onFocusCharacterChange={setExportFocusCharacterId}
        groups={exportGroups}
        groupId={selectedExportGroupId}
        onGroupChange={setExportGroupId}
        hiddenCircleGroupIdsOverride={exportHiddenCircleGroupIds}
      />

      {/* PNG Export Dialog */}
      {showPngDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowPngDialog(false)}
        >
          <div
            className="rounded-xl p-6 flex flex-col gap-4"
            style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', minWidth: 320, maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#c9a84c', fontSize: 18, margin: 0 }}>Export PNG</h2>

            <ExportScopeControl
              scope={exportScope}
              onScopeChange={handleExportScopeChange}
              characters={book.characters}
              focusCharacterId={selectedExportFocusId}
              onFocusCharacterChange={setExportFocusCharacterId}
              groups={exportGroups}
              groupId={selectedExportGroupId}
              onGroupChange={setExportGroupId}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Resolution</span>
                <span style={{ fontSize: 12, color: '#c9a84c', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{pngScale}×</span>
              </div>
              <input
                type="range"
                min={1} max={4} step={1}
                value={pngScale}
                onChange={e => setPngScale(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#c9a84c' }}
              />
              <div className="flex justify-between mt-1">
                {[1,2,3,4].map(v => (
                  <span key={v} style={{ fontSize: 10, color: v === pngScale ? '#c9a84c' : '#556677', fontFamily: "'DM Sans', sans-serif", fontWeight: v === pngScale ? 700 : 400 }}>
                    {v === 1 ? '1× screen' : v === 2 ? '2× retina' : v === 3 ? '3× print' : '4× poster'}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#556677', marginTop: 8, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                Higher values produce sharper images for printing but create larger files.
              </p>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: '#34415e', background: '#111724' }}>
              <span><span style={{ display: 'block', fontSize: 12, color: '#dbe5f1', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Include annotations</span><span style={{ display: 'block', marginTop: 2, fontSize: 10, color: '#7e90ab', fontFamily: "'DM Sans', sans-serif" }}>Notes and linked callouts in the exported map</span></span>
              <input type="checkbox" checked={pngShowAnnotations} onChange={event => setPngShowAnnotations(event.target.checked)} style={{ accentColor: '#c9a84c', width: 15, height: 15 }} />
            </label>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowPngDialog(false)}
                style={{ fontSize: 13, color: '#8899aa', background: 'transparent', border: '1px solid #2a3350', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >Cancel</button>
              <button
                onClick={() => { setShowPngDialog(false); doExportPng(pngScale, pngShowAnnotations); }}
                style={{ fontSize: 13, color: '#0f1117', background: '#c9a84c', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}
              >Download PNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
