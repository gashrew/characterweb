// ============================================================
// Sidebar — Left panel: Book meta, Characters, Relationships, Groups
// Design: Dark Scholarly Codex
// ============================================================
import { useState } from 'react';
import { useBook } from '@/contexts/BookContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BookOpen, Users, GitBranch, Layers, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, Upload, FilePlus, GitMerge, Tag,
  Eye, EyeOff, Crosshair, Circle,
  StickyNote, Smartphone,
} from 'lucide-react';
import { setViewMode } from '@/lib/viewMode';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { CircleOrderPanel } from '@/components/CircleOrderPanel';
import { LayoutThumbnail } from '@/components/LayoutThumbnail';
import { AnnotationPanel } from '@/components/AnnotationPanel';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import { toast } from 'sonner';

const TABS = [
  { id: 'book', icon: BookOpen, label: 'Book' },
  { id: 'characters', icon: Users, label: 'Characters' },
  { id: 'relationships', icon: GitBranch, label: 'Relationships' },
  { id: 'groups', icon: Layers, label: 'Groups' },
  { id: 'annotations', icon: StickyNote, label: 'Notes' },
] as const;

interface SidebarProps {
  onAddCharacter: () => void;
  onEditCharacter: (id: string) => void;
  onAddRelationship: () => void;
  onEditRelationship: (id: string) => void;
  onAddGroup: () => void;
  onEditGroup: (id: string) => void;
}

export function Sidebar({
  onAddCharacter, onEditCharacter,
  onAddRelationship, onEditRelationship,
  onAddGroup, onEditGroup,
}: SidebarProps) {
  const {
    book, updateBookMeta, deleteCharacter, deleteRelationship, deleteGroup,
    updateCharacter,
    sidebarTab, setSidebarTab,
    selectedCharacterId, setSelectedCharacterId,
    selectedRelationshipId, setSelectedRelationshipId,
    exportBook, importBook, newBook, savedBooks, loadBook, deleteBook,
    saveLayoutVariant, duplicateLayoutVariant, applyLayoutVariant, renameLayoutVariant, deleteLayoutVariant,
    setIsAddingRelationship,
    showRelationshipLabels, setShowRelationshipLabels,
    showRoutingPorts, setShowRoutingPorts,
    arrowheadScale, setArrowheadScale, showRoutingDebug, setShowRoutingDebug,
    arrowheadTypeScales, setArrowheadTypeScale,
    hiddenCharacterIds, toggleCharacterVisibility,
    spotlightGroupIds, toggleGroupSpotlight, clearGroupSpotlight,
    hiddenRelationshipTypes, toggleRelationshipTypeVisibility,
    focusCircleGroupId, setFocusCircleGroupId,
    enforcedBoundaryGroupIds, toggleBoundaryEnforcement,
    hiddenCircleGroupIds, toggleCircleGroupVisibility,
    circleOverlapStep, setCircleOverlapStep,
    bulkConnectCircle,
    autoArrangeFamilyTree,
    familyTreePreviewPositions, previewFamilyTreeLayout, applyFamilyTreePreview, discardFamilyTreePreview, undoFamilyTreeLayout, canUndoFamilyTreeLayout,
    deleteHubRelationship, deleteConvergingRelationship, deleteFamilyUnitRelationship, deleteGroupRelationship, updateFamilyUnitRelationship,
    updateGroup,
  } = useBook();

  const [collapsed, setCollapsed] = useState(false);
  const [showSavedBooks, setShowSavedBooks] = useState(false);
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null);
  const [expandedFamilyUnitId, setExpandedFamilyUnitId] = useState<string | null>(null);
  const [expandedFamilyContextId, setExpandedFamilyContextId] = useState<string | null>(null);
  const [bulkConnectGroupId, setBulkConnectGroupId] = useState<string | null>(null);
  const [bulkConnectType, setBulkConnectType] = useState<string>('friendship');
  const [bulkConnectBidi, setBulkConnectBidi] = useState(true);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [renamingLayoutId, setRenamingLayoutId] = useState<string | null>(null);
  const [layoutRenameValue, setLayoutRenameValue] = useState('');

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        importBook(text);
        toast.success('Book imported successfully.');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-4 gap-3"
        style={{ width: 48, background: '#141824', borderRight: '1px solid #2a3350', flexShrink: 0 }}
      >
        <button onClick={() => setCollapsed(false)} className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: '#c9a84c' }}>
          <ChevronRight size={16} />
        </button>
        {TABS.map(tab => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setSidebarTab(tab.id); setCollapsed(false); }}
                className="p-2 rounded transition-colors hover:bg-white/5"
                style={{ color: sidebarTab === tab.id ? '#c9a84c' : '#8899aa' }}
              >
                <tab.icon size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{tab.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{ width: 'clamp(336px, 27vw, 368px)', background: '#141824', borderRight: '1px solid #2a3350', flexShrink: 0 }}
    >
      {/* Header */}
      <div className="relative z-30 flex shrink-0 items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2a3350', background: '#141824' }}>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 28 28" className="w-7 h-7" aria-label="CharacterWeb logo" role="img">
            <g stroke="#c9a84c" strokeWidth="1.4" fill="none" opacity="0.75">
              <line x1="14" y1="6" x2="6" y2="20" />
              <line x1="14" y1="6" x2="22" y2="20" />
              <line x1="6" y1="20" x2="22" y2="20" />
            </g>
            <circle cx="14" cy="6" r="3.4" fill="#c9a84c" />
            <circle cx="6" cy="20" r="3.4" fill="#e05c8a" />
            <circle cx="22" cy="20" r="3.4" fill="#6ec9c4" />
          </svg>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: '#c9a84c', letterSpacing: '0.02em' }}>
            CharacterWeb
          </span>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: '#8899aa' }}>
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="relative z-30 grid shrink-0 grid-cols-5" style={{ borderBottom: '1px solid #2a3350', background: '#141824', boxShadow: '0 5px 12px rgba(0,0,0,0.16)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className="flex min-w-0 flex-col items-center gap-0.5 py-2 text-xs transition-colors hover:bg-white/[0.035]"
            style={{
              color: sidebarTab === tab.id ? '#c9a84c' : '#8899aa',
              borderBottom: sidebarTab === tab.id ? '2px solid #c9a84c' : '2px solid transparent',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 9,
              letterSpacing: '0.04em',
            }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea type="always" className="min-h-0 flex-1 [&>[data-slot=scroll-area-scrollbar]]:z-40 [&>[data-slot=scroll-area-scrollbar]]:border-l-[#2a3350] [&>[data-slot=scroll-area-scrollbar]]:bg-[#111724] [&>[data-slot=scroll-area-scrollbar]_[data-slot=scroll-area-thumb]]:bg-[#60708c]">
        <div className="min-w-0 p-4 pb-8">
          {/* ── BOOK TAB ── */}
          {sidebarTab === 'book' && (
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Book Title</Label>
                <Input
                  placeholder="Enter book title…"
                  value={book.title}
                  onChange={e => updateBookMeta({ title: e.target.value })}
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Author</Label>
                <Input
                  placeholder="Author name…"
                  value={book.author}
                  onChange={e => updateBookMeta({ author: e.target.value })}
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Series</Label>
                <Input
                  placeholder="Series name (optional)…"
                  value={book.series || ''}
                  onChange={e => updateBookMeta({ series: e.target.value })}
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13 }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: '#8899aa' }}>Description</Label>
                <Textarea
                  placeholder="Brief synopsis…"
                  value={book.description || ''}
                  onChange={e => updateBookMeta({ description: e.target.value })}
                  rows={3}
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 13, resize: 'none' }}
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { label: 'Characters', value: book.characters.length },
                  { label: 'Relationships', value: book.relationships.length + (book.hubRelationships?.length ?? 0) + (book.convergingRelationships?.length ?? 0) + (book.familyUnitRelationships?.length ?? 0) + (book.groupRelationships?.length ?? 0) },
                  { label: 'Groups', value: book.groups.length },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#c9a84c', fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: '#8899aa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Named layout variants */}
              <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Layers size={13} style={{ color: '#4cb8c9' }} /><span style={{ fontSize: 11, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>Layout variants</span></div>
                  <span style={{ fontSize: 9, color: '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>{(book.layoutVariants ?? []).length} saved</span>
                </div>
                <div className="flex gap-1.5">
                  <Input value={newLayoutName} onChange={event => setNewLayoutName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && newLayoutName.trim()) { saveLayoutVariant(newLayoutName); setNewLayoutName(''); toast.success('Layout variant saved.'); } }} placeholder="Name this arrangement…" style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 11, height: 30 }} />
                  <Button size="sm" disabled={!newLayoutName.trim()} onClick={() => { saveLayoutVariant(newLayoutName); setNewLayoutName(''); toast.success('Layout variant saved.'); }} style={{ height: 30, background: '#4cb8c9', color: '#0f1117', fontSize: 10 }}>Save</Button>
                </div>
                {(book.layoutVariants ?? []).length === 0 ? <p style={{ fontSize: 10, color: '#667085', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Save arrangements before experimenting with a new layout.</p> : <div className="flex flex-col gap-1">
                  {(book.layoutVariants ?? []).map(variant => {
                    const active = book.activeLayoutVariantId === variant.id;
                    const isRenaming = renamingLayoutId === variant.id;
                    return <div key={variant.id} className="rounded px-1.5 py-1.5" style={{ background: active ? '#4cb8c914' : '#141824', border: `1px solid ${active ? '#4cb8c950' : 'transparent'}` }}>
                      {isRenaming ? <div className="flex gap-1"><Input autoFocus value={layoutRenameValue} onChange={event => setLayoutRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && layoutRenameValue.trim()) { renameLayoutVariant(variant.id, layoutRenameValue); setRenamingLayoutId(null); } }} style={{ background: '#0f1424', border: '1px solid #4cb8c980', color: '#e8e0d0', fontSize: 10, height: 24 }} /><button onClick={() => { if (layoutRenameValue.trim()) renameLayoutVariant(variant.id, layoutRenameValue); setRenamingLayoutId(null); }} className="px-1.5" style={{ color: '#6ec98b', fontSize: 10 }}>✓</button></div> : <div className="flex items-center gap-1.5"><button onClick={() => { applyLayoutVariant(variant.id); toast.success(`Switched to “${variant.name}”.`); }} className="flex items-center gap-1.5 flex-1 text-left min-w-0"><LayoutThumbnail characters={book.characters} positions={variant.positions} active={active} /><span className="min-w-0" style={{ fontSize: 10, color: active ? '#4cb8c9' : '#e8e0d0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{variant.name}{active && <span style={{ fontSize: 8, marginLeft: 5, color: '#4cb8c9' }}>ACTIVE</span>}</span></button><span className="flex flex-col gap-0.5"><button onClick={() => { duplicateLayoutVariant(variant.id); toast.success('Layout duplicated.'); }} className="p-0.5 hover:bg-white/10" style={{ color: '#4cb8c9' }} title="Duplicate layout"><FilePlus size={10} /></button><button onClick={() => { setRenamingLayoutId(variant.id); setLayoutRenameValue(variant.name); }} className="p-0.5 hover:bg-white/10" style={{ color: '#c9a84c' }} title="Rename"><Pencil size={10} /></button><button onClick={() => { deleteLayoutVariant(variant.id); toast.success('Layout variant deleted.'); }} className="p-0.5 hover:bg-red-500/20" style={{ color: '#c94c4c' }} title="Delete"><Trash2 size={10} /></button></span></div>}
                    </div>;
                  })}
                </div>}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 12 }}
                  onClick={exportBook}
                >
                  <Download size={13} /> Export as JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 12 }}
                  onClick={handleImport}
                >
                  <Upload size={13} /> Import JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 12 }}
                  onClick={() => setViewMode('quick')}
                >
                  <Smartphone size={13} /> Quick-add view (phone layout)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  style={{ background: '#1a2035', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 12 }}
                  onClick={newBook}
                >
                  <FilePlus size={13} /> New Book
                </Button>
              </div>

              {/* Saved books */}
              {savedBooks.length > 0 && (
                <div>
                  <button
                    className="text-xs flex items-center gap-1 mb-2"
                    style={{ color: '#8899aa', fontFamily: "'DM Sans', sans-serif" }}
                    onClick={() => setShowSavedBooks(v => !v)}
                  >
                    <GitMerge size={11} />
                    {showSavedBooks ? 'Hide' : 'Show'} saved books ({savedBooks.length})
                  </button>
                  {showSavedBooks && (
                    <div className="flex flex-col gap-1">
                      {savedBooks.map(b => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded px-2 py-1.5 group"
                          style={{ background: book.id === b.id ? '#1e2535' : '#1a2035', border: `1px solid ${book.id === b.id ? '#c9a84c40' : '#2a3350'}` }}
                        >
                          <button
                            className="flex-1 text-left"
                            onClick={() => loadBook(b.id)}
                          >
                            <div style={{ fontSize: 12, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif" }}>{b.title || 'Untitled'}</div>
                            <div style={{ fontSize: 10, color: '#8899aa' }}>{b.author}</div>
                          </button>
                          <button
                            onClick={() => deleteBook(b.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
                            style={{ color: '#c94c4c' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── CHARACTERS TAB ── */}
          {sidebarTab === 'characters' && (
            <div className="flex flex-col gap-3">
              <Button
                size="sm"
                className="w-full gap-2"
                style={{ background: '#c9a84c', color: '#0f1117', fontWeight: 600, fontSize: 12 }}
                onClick={onAddCharacter}
              >
                <Plus size={13} /> Add a Character to the Web
              </Button>

              {book.characters.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#8899aa', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  No characters yet.<br />Add your first character above.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {book.characters.map(char => {
                    const group = char.groupIds && char.groupIds.length > 0
                      ? book.groups.find(g => char.groupIds!.includes(g.id))
                      : undefined;
                    const ringColor = char.color || group?.color || '#c9a84c';
                    const isSelected = char.id === selectedCharacterId;
                    return (
                      <div
                        key={char.id}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 group cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? '#1e2535' : '#1a2035',
                          border: `1px solid ${isSelected ? ringColor + '60' : '#2a3350'}`,
                        }}
                        onClick={() => setSelectedCharacterId(isSelected ? null : char.id)}
                      >
                        {/* Mini node */}
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: '#141824', border: `2px solid ${ringColor}`, fontSize: 9, color: '#e8e0d0', fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                          {char.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            {char.title && <span style={{ fontSize: 9, color: `${ringColor}99`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{char.title}</span>}
                            <span style={{ fontSize: 12, color: '#e8e0d0', fontFamily: "'Playfair Display', serif", fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{char.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* Show all group dots */}
                            {char.groupIds && char.groupIds.length > 0
                              ? char.groupIds.map(gid => {
                                  const grp = book.groups.find(g => g.id === gid);
                                  return grp ? <span key={gid} className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: grp.color }} title={grp.name} /> : null;
                                })
                              : null
                            }
                            <span style={{ fontSize: 10, color: '#8899aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {char.groupIds && char.groupIds.length > 0
                                ? char.groupIds.map(gid => book.groups.find(g => g.id === gid)?.name).filter(Boolean).join(', ')
                                : char.description?.slice(0, 30) || char.gender
                              }
                            </span>
                            {char.status === 'deceased' && <span style={{ fontSize: 9, color: '#c94c4c' }}>†</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); toggleCharacterVisibility(char.id); }}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            style={{ color: hiddenCharacterIds.has(char.id) ? '#c94c4c' : '#8899aa' }}
                            title={hiddenCharacterIds.has(char.id) ? 'Show on canvas' : 'Hide from canvas'}
                          >
                            {hiddenCharacterIds.has(char.id) ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                          <button onClick={e => { e.stopPropagation(); onEditCharacter(char.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#c9a84c' }}>
                            <Pencil size={11} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteCharacter(char.id); }} className="p-1 rounded hover:bg-red-500/20" style={{ color: '#c94c4c' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── RELATIONSHIPS TAB ── */}
          {sidebarTab === 'relationships' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  style={{ background: '#c9a84c', color: '#0f1117', fontWeight: 600, fontSize: 12 }}
                  onClick={onAddRelationship}
                >
                  <Plus size={13} /> Add Relationship
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      style={{ background: '#1a2035', border: '1px solid #4cb8c9', color: '#4cb8c9' }}
                      onClick={() => setIsAddingRelationship(true)}
                    >
                      <GitBranch size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Draw on canvas</TooltipContent>
                </Tooltip>
              </div>

              {familyTreePreviewPositions ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" className="gap-1.5" style={{ background: '#6ec98b', color: '#0f1117', fontSize: 11 }} onClick={() => { applyFamilyTreePreview(); toast.success('Family-tree layout applied.'); }}><GitMerge size={13} /> Apply preview</Button>
                  <Button size="sm" variant="outline" className="gap-1.5" style={{ background: '#1a2035', border: '1px solid #c94c4c80', color: '#c94c4c', fontSize: 11 }} onClick={discardFamilyTreePreview}>Discard</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="w-full gap-2" style={{ background: '#1a2035', border: '1px solid #6ec98b80', color: '#6ec98b', fontSize: 11 }} onClick={() => { previewFamilyTreeLayout(); toast.info('Previewing family-tree layout — apply or discard when ready.'); }}><GitMerge size={13} /> Preview family tree</Button>
              )}
              {canUndoFamilyTreeLayout && !familyTreePreviewPositions && <Button size="sm" variant="outline" className="w-full gap-2" style={{ background: '#1a2035', border: '1px solid #c9a84c80', color: '#c9a84c', fontSize: 11 }} onClick={() => { undoFamilyTreeLayout(); toast.success('Family-tree layout restored.'); }}>Undo family layout</Button>}

              {/* Label visibility toggle */}
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ background: '#1a2035', border: '1px solid #2a3350' }}
              >
                <div className="flex items-center gap-2">
                  <Tag size={12} style={{ color: '#c9a84c' }} />
                  <span style={{ fontSize: 11, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif" }}>
                    Show labels on lines
                  </span>
                </div>
                <Switch
                  checked={showRelationshipLabels}
                  onCheckedChange={setShowRelationshipLabels}
                  style={{ transform: 'scale(0.85)' }}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                <div className="flex items-center gap-2">
                  <GitBranch size={12} style={{ color: '#4cb8c9' }} />
                  <span style={{ fontSize: 11, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif" }}>Show routing ports</span>
                </div>
                <Switch checked={showRoutingPorts} onCheckedChange={setShowRoutingPorts} style={{ transform: 'scale(0.85)' }} />
              </div>

              <div className="rounded-lg px-3 py-2.5" style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                <div className="flex items-center justify-between mb-2"><span style={{ fontSize: 11, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif" }}>Arrowhead size</span><span style={{ fontSize: 10, color: '#4cb8c9', fontFamily: "'JetBrains Mono', monospace" }}>{arrowheadScale.toFixed(1)}×</span></div>
                <Slider min={0.6} max={2} step={0.1} value={[arrowheadScale]} onValueChange={values => setArrowheadScale(values[0])} />
              </div>

              <details className="rounded-lg px-3 py-2.5" style={{ background: '#171d31', border: '1px solid #2a3350' }}>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif" }}>Arrowhead emphasis by type</summary>
                <div className="mt-2.5 space-y-2">
                  {Object.entries(RELATIONSHIP_TYPES).map(([type, info]) => {
                    const scale = arrowheadTypeScales[type] ?? 1;
                    return <div key={type} className="grid grid-cols-[minmax(0,1fr)_74px_28px] items-center gap-2"><span className="truncate" style={{ fontSize: 10, color: info.color, fontFamily: "'DM Sans', sans-serif" }}>{info.label}</span><input aria-label={`${info.label} arrowhead size`} type="range" min="0.6" max="2" step="0.1" value={scale} onChange={event => setArrowheadTypeScale(type, Number(event.target.value))} style={{ accentColor: info.color }} /><span style={{ fontSize: 9, textAlign: 'right', color: '#8899aa', fontFamily: "'JetBrains Mono', monospace" }}>{scale.toFixed(1)}×</span></div>;
                  })}
                </div>
              </details>

              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: showRoutingDebug ? '#4cb8c912' : '#1a2035', border: `1px solid ${showRoutingDebug ? '#4cb8c980' : '#2a3350'}` }}>
                <div className="flex items-center gap-2"><GitBranch size={12} style={{ color: '#9b6ec9' }} /><div><div style={{ fontSize: 11, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif" }}>Routing debug</div><div style={{ fontSize: 9, color: '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>Number occupied ports</div></div></div>
                <Switch checked={showRoutingDebug} onCheckedChange={setShowRoutingDebug} style={{ transform: 'scale(0.85)' }} />
              </div>

              {/* Relationship type filter chips */}
              <div className="rounded-lg p-3" style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 9, color: '#8899aa', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Filter by type</span>
                  {hiddenRelationshipTypes.size > 0 && (
                    <button
                      onClick={() => Object.keys(RELATIONSHIP_TYPES).forEach(t => hiddenRelationshipTypes.has(t) && toggleRelationshipTypeVisibility(t))}
                      style={{ fontSize: 9, color: '#c9a84c', fontFamily: "'DM Sans', sans-serif", background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Show all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(RELATIONSHIP_TYPES).map(([key, info]) => {
                    const hidden = hiddenRelationshipTypes.has(key);
                    // Count across all relationship types
                    const count = book.relationships.filter(r => r.type === key).length
                      + (book.hubRelationships ?? []).filter(r => r.type === key).length
                      + (book.convergingRelationships ?? []).filter(r => r.type === key).length
                      + (book.familyUnitRelationships ?? []).filter(r => r.type === key).length
                      + (book.groupRelationships ?? []).filter(r => r.type === key).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleRelationshipTypeVisibility(key)}
                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all"
                        style={{
                          background: hidden ? '#141824' : `${info.color}22`,
                          border: `1.5px solid ${hidden ? '#2a3350' : info.color}`,
                          cursor: 'pointer',
                          opacity: hidden ? 0.5 : 1,
                        }}
                        title={hidden ? `Show ${info.label} relationships` : `Hide ${info.label} relationships`}
                      >
                        <span
                          className="inline-block rounded-full flex-shrink-0"
                          style={{ width: 7, height: 7, background: hidden ? '#4a5568' : info.color }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 600, color: hidden ? '#556070' : info.color, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                          {info.label}
                        </span>
                        <span style={{ fontSize: 9, color: hidden ? '#445060' : `${info.color}99`, fontFamily: "'DM Sans', sans-serif" }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {book.relationships.length === 0 && (book.hubRelationships?.length ?? 0) === 0 && (book.convergingRelationships?.length ?? 0) === 0 && (book.familyUnitRelationships?.length ?? 0) === 0 && (book.groupRelationships?.length ?? 0) === 0 ? (
                <div className="text-center py-8" style={{ color: '#8899aa', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  No relationships yet.<br />Add one above or drag between nodes.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {/* Standard pairwise relationships */}
                  {book.relationships.map(rel => {
                    const source = book.characters.find(c => c.id === rel.sourceId);
                    const target = book.characters.find(c => c.id === rel.targetId);
                    const typeInfo = RELATIONSHIP_TYPES[rel.type];
                    const isSelected = rel.id === selectedRelationshipId;
                    return (
                      <div
                        key={rel.id}
                        className="rounded-lg px-2.5 py-2 group cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? '#1e2535' : '#1a2035',
                          border: `1px solid ${isSelected ? typeInfo.color + '60' : '#2a3350'}`,
                        }}
                        onClick={() => setSelectedRelationshipId(isSelected ? null : rel.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                            <span style={{ fontSize: 11, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {source?.name || '?'} {rel.bidirectional ? '↔' : '→'} {target?.name || '?'}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <button onClick={e => { e.stopPropagation(); onEditRelationship(rel.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#c9a84c' }}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteRelationship(rel.id); }} className="p-1 rounded hover:bg-red-500/20" style={{ color: '#c94c4c' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span style={{ fontSize: 9, color: typeInfo.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {rel.label || typeInfo.label}
                          </span>
                          {rel.uncertain && <span style={{ fontSize: 9, color: '#8899aa' }}>· uncertain</span>}
                        </div>
                      </div>
                    );
                  })}

                  {/* Hub-and-spoke relationships */}
                  {(book.hubRelationships ?? []).map(hub => {
                    const source = book.characters.find(c => c.id === hub.sourceId);
                    const typeInfo = RELATIONSHIP_TYPES[hub.type];
                    const targetNames = hub.targetIds
                      .map(id => book.characters.find(c => c.id === id)?.name)
                      .filter(Boolean).join(', ');
                    return (
                      <div
                        key={hub.id}
                        className="rounded-lg px-2.5 py-2 group"
                        style={{ background: '#1a2035', border: `1px solid #2a3350` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                            <span style={{ fontSize: 11, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {source?.name || '?'} → [{hub.targetIds.length} chars]
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <button onClick={e => { e.stopPropagation(); onEditRelationship(hub.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#c9a84c' }}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteHubRelationship(hub.id); }} className="p-1 rounded hover:bg-red-500/20" style={{ color: '#c94c4c' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span style={{ fontSize: 9, color: typeInfo.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {hub.label || typeInfo.label}
                          </span>
                          <span style={{ fontSize: 9, color: '#8899aa' }}>· hub</span>
                        </div>
                        <div style={{ fontSize: 9, color: '#556070', marginTop: 2, fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {targetNames}
                        </div>
                      </div>
                    );
                  })}

                  {/* Shared-target / converging relationships */}
                  {(book.convergingRelationships ?? []).map(rel => {
                    const target = book.characters.find(character => character.id === rel.targetId);
                    const typeInfo = RELATIONSHIP_TYPES[rel.type];
                    const sourceNames = rel.sourceIds
                      .map(id => book.characters.find(character => character.id === id)?.name)
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <div key={rel.id} className="rounded-lg px-2.5 py-2 group" style={{ background: '#1a2035', border: `1px solid ${typeInfo.color}45` }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                            <span style={{ fontSize: 11, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              [{rel.sourceIds.length} chars] → {target?.name || '?'}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <button onClick={event => { event.stopPropagation(); onEditRelationship(rel.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#c9a84c' }}><Pencil size={11} /></button>
                            <button onClick={event => { event.stopPropagation(); deleteConvergingRelationship(rel.id); }} className="p-1 rounded hover:bg-red-500/20" style={{ color: '#c94c4c' }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span style={{ fontSize: 9, color: typeInfo.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>{rel.label || typeInfo.label}</span>
                          <span style={{ fontSize: 9, color: '#8899aa' }}>· shared target</span>
                        </div>
                        <div style={{ fontSize: 9, color: '#556070', marginTop: 2, fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sourceNames}</div>
                      </div>
                    );
                  })}

                  {/* Partner-first family-unit relationships */}
                  {(book.familyUnitRelationships ?? []).map(rel => {
                    const partners = rel.partnerIds.map(id => book.characters.find(character => character.id === id)?.name).filter(Boolean).join(' + ');
                    const childCount = rel.childIds.length;
                    const typeInfo = RELATIONSHIP_TYPES[rel.type];
                    return (
                      <div key={rel.id} className="rounded-lg px-2.5 py-2 group" style={{ background: '#1a2035', border: `1px solid ${typeInfo.color}65` }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                            <span style={{ fontSize: 11, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partners} → [{childCount} child{childCount === 1 ? '' : 'ren'}]</span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            {childCount > 1 && <button onClick={event => { event.stopPropagation(); setExpandedFamilyUnitId(current => current === rel.id ? null : rel.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#4cb8c9' }} title="Order siblings"><GitMerge size={11} /></button>}
                            <button onClick={event => { event.stopPropagation(); setExpandedFamilyContextId(current => current === rel.id ? null : rel.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#9b6ec9' }} title="Family context"><BookOpen size={11} /></button>
                            <button onClick={event => { event.stopPropagation(); onEditRelationship(rel.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#c9a84c' }}><Pencil size={11} /></button>
                            <button onClick={event => { event.stopPropagation(); deleteFamilyUnitRelationship(rel.id); }} className="p-1 rounded hover:bg-red-500/20" style={{ color: '#c94c4c' }}><Trash2 size={11} /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5"><span style={{ fontSize: 9, color: typeInfo.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>{rel.label || 'parents of'}</span><span style={{ fontSize: 9, color: '#8899aa' }}>· family unit</span></div>
                        {expandedFamilyUnitId === rel.id && <div className="mt-2 pt-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid #2a3350' }}>
                          <div style={{ fontSize: 9, color: '#8899aa', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Sibling order (left → right)</div>
                          {rel.childIds.map((childId, index) => {
                            const child = book.characters.find(character => character.id === childId);
                            const move = (direction: -1 | 1) => {
                              const next = [...rel.childIds];
                              const targetIndex = index + direction;
                              [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
                              updateFamilyUnitRelationship(rel.id, { childIds: next });
                            };
                            return <div key={childId} className="flex items-center justify-between rounded px-1.5 py-1" style={{ background: '#141824' }}>
                              <span style={{ fontSize: 10, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif" }}>{index + 1}. {child?.name || '?'}</span>
                              <span className="flex gap-0.5"><button disabled={index === 0} onClick={() => move(-1)} className="p-0.5 disabled:opacity-20" style={{ color: '#c9a84c' }} title="Move earlier"><ChevronUp size={12} /></button><button disabled={index === rel.childIds.length - 1} onClick={() => move(1)} className="p-0.5 disabled:opacity-20" style={{ color: '#c9a84c' }} title="Move later"><ChevronDown size={12} /></button></span>
                            </div>;
                          })}
                        </div>}
                        {expandedFamilyContextId === rel.id && <div className="mt-2 pt-2 flex flex-col gap-2" style={{ borderTop: '1px solid #2a3350' }}>
                          <div className="flex items-center gap-1.5"><BookOpen size={11} style={{ color: '#9b6ec9' }} /><span style={{ fontSize: 9, color: '#bda7d8', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Family context</span></div>
                          <div><Label className="text-[9px] mb-1 block" style={{ color: '#8899aa' }}>Marriage / partnership date</Label><Input value={rel.marriageDate || ''} onChange={event => updateFamilyUnitRelationship(rel.id, { marriageDate: event.target.value })} placeholder="e.g. 1885, Spring 1891" style={{ height: 27, background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 10 }} /></div>
                          <div><Label className="text-[9px] mb-1 block" style={{ color: '#8899aa' }}>Guardianship or caregiving context</Label><Input value={rel.guardianshipContext || ''} onChange={event => updateFamilyUnitRelationship(rel.id, { guardianshipContext: event.target.value })} placeholder="e.g. legal guardian after 1893" style={{ height: 27, background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 10 }} /></div>
                          <div><Label className="text-[9px] mb-1 block" style={{ color: '#8899aa' }}>Family note</Label><Textarea value={rel.notes || ''} onChange={event => updateFamilyUnitRelationship(rel.id, { notes: event.target.value })} placeholder="Marriage, custody, guardianship, or household details…" rows={3} style={{ background: '#141824', border: '1px solid #2a3350', color: '#e8e0d0', fontSize: 10, resize: 'none' }} /></div>
                        </div>}
                      </div>
                    );
                  })}

                  {/* Character-to-group relationships */}
                  {(book.groupRelationships ?? []).map(rel => {
                    const source = book.characters.find(c => c.id === rel.sourceId);
                    const group = book.groups.find(g => g.id === rel.groupId);
                    const typeInfo = RELATIONSHIP_TYPES[rel.type];
                    return (
                      <div
                        key={rel.id}
                        className="rounded-lg px-2.5 py-2 group"
                        style={{ background: '#1a2035', border: `1px solid #2a3350` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeInfo.color }} />
                            <span style={{ fontSize: 11, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {source?.name || '?'} → {group?.name || '?'}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <button onClick={e => { e.stopPropagation(); onEditRelationship(rel.id); }} className="p-1 rounded hover:bg-white/10" style={{ color: '#c9a84c' }}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteGroupRelationship(rel.id); }} className="p-1 rounded hover:bg-red-500/20" style={{ color: '#c94c4c' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span style={{ fontSize: 9, color: typeInfo.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {rel.label || typeInfo.label}
                          </span>
                          <span style={{ fontSize: 9, color: '#8899aa' }}>· to group</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              {book.relationships.length > 0 && (
                <div className="mt-2 rounded-lg p-3" style={{ background: '#1a2035', border: '1px solid #2a3350' }}>
                  <div style={{ fontSize: 9, color: '#8899aa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Legend</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {Object.entries(RELATIONSHIP_TYPES).map(([key, info]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 rounded-full" style={{ background: info.color }} />
                        <span style={{ fontSize: 10, color: '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>{info.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── GROUPS TAB ── */}
          {sidebarTab === 'groups' && (
            <div className="flex flex-col gap-3">
              <Button
                size="sm"
                className="w-full gap-2"
                style={{ background: '#c9a84c', color: '#0f1117', fontWeight: 600, fontSize: 12 }}
                onClick={onAddGroup}
              >
                <Plus size={13} /> Create a Group
              </Button>

              {/* Concentric order panel — drag to reorder circle groups */}
              <CircleOrderPanel />

              {/* Concentric gap slider — only shown when there are circle groups */}
              {book.groups.some(g => g.groupType === 'circle') && (
                <div
                  className="rounded-lg px-3 py-2.5"
                  style={{ background: '#1a2035', border: '1px solid #2a3350' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Circle size={11} style={{ color: '#c9a84c' }} />
                      <span style={{ fontSize: 10, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                        Overlap gap
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#c9a84c', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      {circleOverlapStep}px
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={60}
                    step={1}
                    value={[circleOverlapStep]}
                    onValueChange={([v]) => setCircleOverlapStep(v)}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1">
                    <span style={{ fontSize: 9, color: '#556677', fontFamily: "'DM Sans', sans-serif" }}>0 — stacked</span>
                    <span style={{ fontSize: 9, color: '#556677', fontFamily: "'DM Sans', sans-serif" }}>60 — spread</span>
                  </div>
                </div>
              )}

              {/* Spotlight hint + clear button */}
              {spotlightGroupIds.size > 0 && (
                <div className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: '#c9a84c18', border: '1px solid #c9a84c40' }}>
                  <span style={{ fontSize: 10, color: '#c9a84c', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                    Showing {spotlightGroupIds.size} group{spotlightGroupIds.size !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={clearGroupSpotlight}
                    className="rounded px-2 py-0.5 transition-colors hover:bg-white/10"
                    style={{ fontSize: 10, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, border: '1px solid #2a3350' }}
                  >
                    Show All
                  </button>
                </div>
              )}

              {/* Circle focus banner */}
              {focusCircleGroupId && (() => {
                const cg = book.groups.find(g => g.id === focusCircleGroupId);
                return cg ? (
                  <div className="flex items-center justify-between rounded px-2 py-1.5" style={{ background: `${cg.color}18`, border: `1px solid ${cg.color}60` }}>
                    <span style={{ fontSize: 10, color: cg.color, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                      Focused: {cg.name}
                    </span>
                    <button
                      onClick={() => setFocusCircleGroupId(null)}
                      className="rounded px-2 py-0.5 transition-colors hover:bg-white/10"
                      style={{ fontSize: 10, color: '#e8e0d0', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, border: '1px solid #2a3350' }}
                    >
                      Show All
                    </button>
                  </div>
                ) : null;
              })()}

              {book.groups.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#8899aa', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  No groups yet.<br />Create a group to organise your characters.
                  <br /><br />
                  <span style={{ fontSize: 11, color: '#556677' }}>Tip: use <strong style={{color:'#c9a84c'}}>Circle</strong> type to draw a visible outline around a group on the canvas.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {book.groups.map(group => {
                    const members = book.characters.filter(c => c.groupIds?.includes(group.id));
                    const isSpotlit = spotlightGroupIds.has(group.id);
                    const anySpotlit = spotlightGroupIds.size > 0;
                    const isCircle = group.groupType === 'circle';
                    const isFocusedCircle = focusCircleGroupId === group.id;
                    const isExpanded = expandedCircleId === group.id;
                    const isCircleHidden = isCircle && hiddenCircleGroupIds.has(group.id);
                    return (
                      <div
                        key={group.id}
                        className="rounded-lg px-2.5 py-2 group"
                        style={{
                          background: isSpotlit || isFocusedCircle ? `${group.color}18` : '#1a2035',
                          border: `1.5px solid ${(isSpotlit || isFocusedCircle) ? group.color + '80' : '#2a3350'}`,
                          opacity: (anySpotlit && !isSpotlit) ? 0.4 : isCircleHidden ? 0.55 : 1,
                          transition: 'opacity 200ms, border-color 200ms, background 200ms',
                        }}
                      >
                        {/* Header row */}
                        <div className="flex items-center justify-between" onClick={() => !isCircle && toggleGroupSpotlight(group.id)} style={{ cursor: isCircle ? 'default' : 'pointer' }}>
                          <div className="flex items-center gap-2">
                            {/* Spotlight indicator (standard groups only) */}
                            {!isCircle && (
                              <div
                                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: isSpotlit ? group.color : 'transparent',
                                  border: `1.5px solid ${isSpotlit ? group.color : '#4a5568'}`,
                                  transition: 'all 150ms',
                                }}
                              >
                                {isSpotlit && (
                                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                    <path d="M1 3.5L3.5 6L8 1" stroke="#0f1117" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            )}
                            {/* Circle icon badge */}
                            {isCircle && (
                              <Circle size={13} style={{ color: group.color, flexShrink: 0 }} />
                            )}
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: group.color }} />
                            <span style={{ fontSize: 12, color: (isSpotlit || isFocusedCircle) ? '#e8e0d0' : anySpotlit ? '#8899aa' : '#e8e0d0', fontFamily: "'Playfair Display', serif", fontWeight: 600, transition: 'color 150ms' }}>{group.name}</span>
                            {isCircle && <span style={{ fontSize: 9, color: group.color, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: '0.05em', background: `${group.color}20`, borderRadius: 3, padding: '1px 4px' }}>CIRCLE</span>}
                            {isCircleHidden && <span style={{ fontSize: 9, color: '#c94c4c', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: '0.05em', background: '#c94c4c20', borderRadius: 3, padding: '1px 4px' }}>HIDDEN</span>}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            {/* Circle-specific: Visibility toggle */}
                            {isCircle && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => toggleCircleGroupVisibility(group.id)}
                                    className="p-1 rounded hover:bg-white/10"
                                    style={{ color: isCircleHidden ? '#c94c4c' : '#8899aa' }}
                                  >
                                    {isCircleHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{isCircleHidden ? 'Show circle outline' : 'Hide circle outline'}</TooltipContent>
                              </Tooltip>
                            )}
                            {/* Circle-specific: Focus button */}
                            {isCircle && (
                              <button
                                onClick={() => setFocusCircleGroupId(isFocusedCircle ? null : group.id)}
                                className="p-1 rounded hover:bg-white/10"
                                style={{ color: isFocusedCircle ? group.color : '#8899aa' }}
                                title={isFocusedCircle ? 'Exit focus' : 'Focus on this circle'}
                              >
                                <Crosshair size={11} />
                              </button>
                            )}
                            {/* Circle-specific: expand member picker */}
                            {isCircle && (
                              <button
                                onClick={() => setExpandedCircleId(isExpanded ? null : group.id)}
                                className="p-1 rounded hover:bg-white/10"
                                style={{ color: '#c9a84c' }}
                                title="Manage members"
                              >
                                <Users size={11} />
                              </button>
                            )}
                            {/* Circle-specific: fully-connected shortcut */}
                            {isCircle && (
                              <button
                                onClick={() => setBulkConnectGroupId(bulkConnectGroupId === group.id ? null : group.id)}
                                className="p-1 rounded hover:bg-white/10"
                                style={{ color: bulkConnectGroupId === group.id ? group.color : '#8899aa' }}
                                title="Connect all members with a relationship"
                              >
                                <GitMerge size={11} />
                              </button>
                            )}
                            <button onClick={() => onEditGroup(group.id)} className="p-1 rounded hover:bg-white/10" style={{ color: '#c9a84c' }}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => deleteGroup(group.id)} className="p-1 rounded hover:bg-red-500/20" style={{ color: '#c94c4c' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Member count line */}
                        <div style={{ fontSize: 10, color: '#8899aa', marginTop: 3, paddingLeft: isCircle ? 20 : 24 }}>
                          {members.length} member{members.length !== 1 ? 's' : ''}
                          {!isCircle && members.length > 0 && ': ' + members.map(m => m.name).join(', ')}
                        </div>

                        {/* Circle boundary enforcement toggle */}
                        {isCircle && (
                          <div
                            className="flex items-center justify-between mt-2 px-1 py-1.5 rounded"
                            style={{ background: '#141824', border: '1px solid #2a3350' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: enforcedBoundaryGroupIds.has(group.id) ? group.color : '#8899aa', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em' }}>
                                ENFORCE BOUNDARY
                              </div>
                              <div style={{ fontSize: 9, color: '#556677', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.3, marginTop: 1 }}>
                                {enforcedBoundaryGroupIds.has(group.id)
                                  ? 'Non-members moved outside outline'
                                  : 'Move non-members outside outline'}
                              </div>
                            </div>
                            <Switch
                              checked={enforcedBoundaryGroupIds.has(group.id)}
                              onCheckedChange={() => toggleBoundaryEnforcement(group.id)}
                              style={{ transform: 'scale(0.8)', transformOrigin: 'right center' }}
                            />
                          </div>
                        )}

                        {/* Per-circle fill opacity slider */}
                        {isCircle && (
                          <div
                            className="mt-2 px-1 py-1.5 rounded"
                            style={{ background: '#141824', border: '1px solid #2a3350' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>Fill opacity</span>
                              <span style={{ fontSize: 9, color: group.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                                {Math.round((group.fillOpacity ?? 0.04) * 100)}%
                              </span>
                            </div>
                            <Slider
                              min={0} max={40} step={1}
                              value={[Math.round((group.fillOpacity ?? 0.04) * 100)]}
                              onValueChange={([v]) => updateGroup(group.id, { fillOpacity: v / 100 })}
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Per-circle stroke style toggle */}
                        {isCircle && (
                          <div
                            className="mt-2 px-1 py-1.5 rounded"
                            style={{ background: '#141824', border: '1px solid #2a3350' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#8899aa', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>Border style</span>
                            </div>
                            <div className="flex gap-1">
                              {(['dashed', 'solid', 'dotted'] as const).map(style => (
                                <button
                                  key={style}
                                  type="button"
                                  onClick={() => updateGroup(group.id, { strokeStyle: style })}
                                  style={{
                                    flex: 1,
                                    fontSize: 9,
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontWeight: 600,
                                    padding: '3px 0',
                                    borderRadius: 4,
                                    border: `1px solid ${(group.strokeStyle ?? 'dashed') === style ? group.color : '#2a3350'}`,
                                    background: (group.strokeStyle ?? 'dashed') === style ? `${group.color}22` : 'transparent',
                                    color: (group.strokeStyle ?? 'dashed') === style ? group.color : '#556677',
                                    cursor: 'pointer',
                                    transition: 'all 120ms',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {style}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Circle bulk-connect panel */}
                        {isCircle && bulkConnectGroupId === group.id && (
                          <div className="mt-2 p-2 rounded" style={{ background: '#141824', border: '1px solid #2a3350' }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: group.color, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em', marginBottom: 6 }}>CONNECT ALL MEMBERS</div>
                            <div style={{ fontSize: 9, color: '#8899aa', marginBottom: 8, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                              Creates a relationship between every pair of members that don't already have one.
                            </div>
                            {/* Relationship type picker */}
                            <div style={{ fontSize: 9, color: '#8899aa', marginBottom: 3, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>RELATIONSHIP TYPE</div>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {Object.entries(RELATIONSHIP_TYPES).map(([key, info]) => (
                                <button
                                  key={key}
                                  onClick={() => setBulkConnectType(key)}
                                  className="px-2 py-0.5 rounded-full text-xs transition-all"
                                  style={{
                                    fontSize: 9,
                                    background: bulkConnectType === key ? info.color + '30' : 'transparent',
                                    border: `1px solid ${bulkConnectType === key ? info.color : '#2a3350'}`,
                                    color: bulkConnectType === key ? info.color : '#8899aa',
                                    fontFamily: "'DM Sans', sans-serif",
                                  }}
                                >
                                  {info.label}
                                </button>
                              ))}
                            </div>
                            {/* Bidirectional toggle */}
                            <div className="flex items-center justify-between mb-3">
                              <span style={{ fontSize: 9, color: '#8899aa', fontFamily: "'DM Sans', sans-serif" }}>Bidirectional arrows</span>
                              <Switch
                                checked={bulkConnectBidi}
                                onCheckedChange={setBulkConnectBidi}
                                style={{ transform: 'scale(0.75)', transformOrigin: 'right center' }}
                              />
                            </div>
                            {/* Apply button */}
                            <button
                              onClick={() => {
                                const n = bulkConnectCircle(group.id, bulkConnectType, bulkConnectBidi);
                                if (n === 0) toast.info('All members are already connected.');
                                else toast.success(`Created ${n} new relationship${n !== 1 ? 's' : ''}.`);
                                setBulkConnectGroupId(null);
                              }}
                              className="w-full py-1.5 rounded text-xs font-semibold transition-colors hover:opacity-90"
                              style={{ background: group.color, color: '#0f1117', fontFamily: "'DM Sans', sans-serif", fontSize: 10 }}
                            >
                              Connect {members.length} members
                            </button>
                          </div>
                        )}

                        {/* Circle member picker — expanded */}
                        {isCircle && isExpanded && (
                          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #2a3350' }}>
                            <div style={{ fontSize: 10, color: '#8899aa', marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>MEMBERS — click to add/remove</div>
                            <div className="flex flex-col gap-0.5">
                              {book.characters.map(char => {
                                const isMember = char.groupIds?.includes(group.id) ?? false;
                                return (
                                  <button
                                    key={char.id}
                                    className="flex items-center gap-2 px-2 py-1 rounded text-left transition-colors hover:bg-white/5"
                                    onClick={() => {
                                      const current = char.groupIds ?? [];
                                      const next = isMember
                                        ? current.filter(id => id !== group.id)
                                        : [...current, group.id];
                                      updateCharacter(char.id, { groupIds: next });
                                    }}
                                  >
                                    <div
                                      className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                                      style={{
                                        background: isMember ? group.color : 'transparent',
                                        border: `1.5px solid ${isMember ? group.color : '#4a5568'}`,
                                        transition: 'all 120ms',
                                      }}
                                    >
                                      {isMember && (
                                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                          <path d="M1 3L3 5.5L7 1" stroke="#0f1117" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 11, color: isMember ? '#e8e0d0' : '#8899aa', fontFamily: "'DM Sans', sans-serif", transition: 'color 120ms' }}>
                                      {char.title ? `${char.title} ` : ''}{char.name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ANNOTATIONS TAB ── */}
          {sidebarTab === 'annotations' && <AnnotationPanel />}
        </div>
      </ScrollArea>
    </div>
  );
}
