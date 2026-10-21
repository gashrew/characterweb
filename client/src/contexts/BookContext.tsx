// ============================================================
// Book Character Mapper — Global State Context
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { calcNodeWidth } from '@/components/CharacterNode';
import type { AnnotationLayer, AnnotationLayerPreset, BookData, Character, Relationship, Group, HubRelationship, ConvergingRelationship, FamilyUnitRelationship, GroupRelationship, CanvasAnnotation } from '@/lib/types';
import { DEFAULT_BOOK } from '@/lib/types';
import { SAMPLE_BOOK } from '@/lib/sampleData';

const STORAGE_KEY = 'book-character-mapper-data';
const STORAGE_INDEX_KEY = 'book-character-mapper-index';
const STORAGE_HIDDEN_CIRCLES_KEY = 'book-character-mapper-hidden-circles';
const STORAGE_OVERLAP_STEP_KEY = 'book-character-mapper-overlap-step';
const STORAGE_CIRCLE_ORDER_KEY = 'book-character-mapper-circle-order';
const STORAGE_ROUTING_PORTS_KEY = 'book-character-mapper-routing-ports';
const STORAGE_ARROWHEAD_SCALE_KEY = 'book-character-mapper-arrowhead-scale';
const STORAGE_ARROWHEAD_TYPE_SCALES_KEY = 'book-character-mapper-arrowhead-type-scales';
const STORAGE_ROUTING_DEBUG_KEY = 'book-character-mapper-routing-debug';

interface BookIndex {
  id: string;
  title: string;
  author: string;
  updatedAt: string;
}

interface BookContextValue {
  book: BookData;
  savedBooks: BookIndex[];
  // Book operations
  updateBookMeta: (meta: Partial<Pick<BookData, 'title' | 'author' | 'series' | 'description'>>) => void;
  saveBook: () => void;
  loadBook: (id: string) => void;
  newBook: () => void;
  deleteBook: (id: string) => void;
  exportBook: () => void;
  importBook: (json: string) => void;
  // Named character-position variants saved within the current book
  saveLayoutVariant: (name: string) => void;
  duplicateLayoutVariant: (id: string, name?: string) => void;
  applyLayoutVariant: (id: string) => void;
  renameLayoutVariant: (id: string, name: string) => void;
  deleteLayoutVariant: (id: string) => void;
  // Character operations
  addCharacter: (char: Omit<Character, 'id'>) => Character;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  moveCharacter: (id: string, x: number, y: number) => void;
  // Relationship operations
  addRelationship: (rel: Omit<Relationship, 'id'>) => Relationship;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;
  // Hub-and-spoke relationship operations
  addHubRelationship: (rel: Omit<HubRelationship, 'id'>) => HubRelationship;
  updateHubRelationship: (id: string, updates: Partial<HubRelationship>) => void;
  deleteHubRelationship: (id: string) => void;
  // Converging relationship operations (multiple sources → one target)
  addConvergingRelationship: (rel: Omit<ConvergingRelationship, 'id'>) => ConvergingRelationship;
  updateConvergingRelationship: (id: string, updates: Partial<ConvergingRelationship>) => void;
  deleteConvergingRelationship: (id: string) => void;
  // Family-unit relationship operations (partners → shared child branch)
  addFamilyUnitRelationship: (rel: Omit<FamilyUnitRelationship, 'id'>) => FamilyUnitRelationship;
  updateFamilyUnitRelationship: (id: string, updates: Partial<FamilyUnitRelationship>) => void;
  deleteFamilyUnitRelationship: (id: string) => void;
  // Character-to-group relationship operations
  addGroupRelationship: (rel: Omit<GroupRelationship, 'id'>) => GroupRelationship;
  updateGroupRelationship: (id: string, updates: Partial<GroupRelationship>) => void;
  deleteGroupRelationship: (id: string) => void;
  // Canvas annotation operations
  addAnnotation: (annotation: Omit<CanvasAnnotation, 'id'>) => CanvasAnnotation;
  updateAnnotation: (id: string, updates: Partial<CanvasAnnotation>) => void;
  deleteAnnotation: (id: string) => void;
  annotationLayerPreset: AnnotationLayerPreset;
  visibleAnnotationLayers: AnnotationLayer[];
  setAnnotationLayerPreset: (preset: AnnotationLayerPreset) => void;
  setVisibleAnnotationLayers: (layers: AnnotationLayer[]) => void;
  // Group operations
  addGroup: (group: Omit<Group, 'id'>) => Group;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  bulkConnectCircle: (groupId: string, relType: string, bidirectional: boolean) => number;
  autoArrangeFamilyTree: () => void;
  familyTreePreviewPositions: Record<string, { x: number; y: number }> | null;
  previewFamilyTreeLayout: () => void;
  applyFamilyTreePreview: () => void;
  discardFamilyTreePreview: () => void;
  undoFamilyTreeLayout: () => void;
  canUndoFamilyTreeLayout: boolean;
  // UI state
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string | null) => void;
  selectedRelationshipId: string | null;
  setSelectedRelationshipId: (id: string | null) => void;
  focusedAnnotationId: string | null;
  setFocusedAnnotationId: (id: string | null) => void;
  sidebarTab: 'book' | 'characters' | 'relationships' | 'groups' | 'annotations';
  setSidebarTab: (tab: 'book' | 'characters' | 'relationships' | 'groups' | 'annotations') => void;
  editingCharacterId: string | null;
  setEditingCharacterId: (id: string | null) => void;
  editingRelationshipId: string | null;
  setEditingRelationshipId: (id: string | null) => void;
  isAddingRelationship: boolean;
  setIsAddingRelationship: (v: boolean) => void;
  relationshipSourceId: string | null;
  setRelationshipSourceId: (id: string | null) => void;
  showRelationshipLabels: boolean;
  setShowRelationshipLabels: (v: boolean) => void;
  showRoutingPorts: boolean;
  setShowRoutingPorts: (v: boolean) => void;
  arrowheadScale: number;
  setArrowheadScale: (scale: number) => void;
  arrowheadTypeScales: Record<string, number>;
  setArrowheadTypeScale: (type: string, scale: number) => void;
  showRoutingDebug: boolean;
  setShowRoutingDebug: (v: boolean) => void;
  // Visibility
  hiddenCharacterIds: Set<string>;
  toggleCharacterVisibility: (id: string) => void;
  // Spotlight: empty = show everything; non-empty = show only these groups (ungrouped chars hidden too)
  spotlightGroupIds: Set<string>;
  toggleGroupSpotlight: (id: string) => void;
  clearGroupSpotlight: () => void;
  hiddenRelationshipTypes: Set<string>;
  toggleRelationshipTypeVisibility: (type: string) => void;
  // Focus mode — show only one character and their direct connections
  focusedCharacterId: string | null;
  setFocusedCharacterId: (id: string | null) => void;
  // Circle focus — zoom canvas to a circle group, hiding all others
  focusCircleGroupId: string | null;
  setFocusCircleGroupId: (id: string | null) => void;
  // Enforced boundary — non-members are nudged outside the circle's bounding box
  enforcedBoundaryGroupIds: Set<string>;
  toggleBoundaryEnforcement: (groupId: string) => void;
  // Per-circle visibility — hidden circles are not drawn on the canvas
  hiddenCircleGroupIds: Set<string>;
  toggleCircleGroupVisibility: (groupId: string) => void;
  // Global concentric gap between overlapping circle outlines (px)
  circleOverlapStep: number;
  setCircleOverlapStep: (step: number) => void;
  // User-defined concentric order for circle groups (array of group IDs, index 0 = innermost)
  circleGroupOrder: string[];
  setCircleGroupOrder: (order: string[]) => void;
  // Reading order for the Group Sequence view (all group types)
  groupSequenceOrder: string[];
  setGroupSequenceOrder: (order: string[]) => void;
}

const BookContext = createContext<BookContextValue | null>(null);

function loadFromStorage(id: string): BookData | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(book: BookData) {
  localStorage.setItem(`${STORAGE_KEY}-${book.id}`, JSON.stringify(book));
  // Update index
  const indexRaw = localStorage.getItem(STORAGE_INDEX_KEY);
  const index: BookIndex[] = indexRaw ? JSON.parse(indexRaw) : [];
  const existing = index.findIndex(b => b.id === book.id);
  const entry: BookIndex = { id: book.id, title: book.title || 'Untitled', author: book.author || '', updatedAt: book.updatedAt };
  if (existing >= 0) index[existing] = entry;
  else index.push(entry);
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
}

function getIndex(): BookIndex[] {
  try {
    const raw = localStorage.getItem(STORAGE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

type LayoutPositions = Record<string, { x: number; y: number }>;

function calculateFamilyTreePositions(book: BookData): LayoutPositions {
  const parentToChildren = new Map<string, Set<string>>();
  const childIds = new Set<string>();
  const siblingRanks = new Map<string, number>();
  const addParentChild = (parentId: string, childId: string) => {
    if (parentId === childId) return;
    if (!parentToChildren.has(parentId)) parentToChildren.set(parentId, new Set());
    parentToChildren.get(parentId)!.add(childId);
    childIds.add(childId);
  };
  const inferParentChild = (sourceId: string, targetId: string, label?: string) => {
    const text = (label ?? '').toLowerCase();
    if (/\b(child|daughter|son)\s+of\b/.test(text)) addParentChild(targetId, sourceId);
    else if (/\b(parent|father|mother|guardian)\b/.test(text)) addParentChild(sourceId, targetId);
  };
  for (const rel of book.relationships) if (rel.type === 'family' && !rel.bidirectional) inferParentChild(rel.sourceId, rel.targetId, rel.label);
  for (const rel of (book.hubRelationships ?? [])) if (rel.type === 'family') rel.targetIds.forEach(childId => addParentChild(rel.sourceId, childId));
  for (const rel of (book.convergingRelationships ?? [])) if (rel.type === 'family') rel.sourceIds.forEach(parentId => addParentChild(parentId, rel.targetId));
  for (const rel of (book.familyUnitRelationships ?? [])) {
    rel.partnerIds.forEach(parentId => rel.childIds.forEach(childId => addParentChild(parentId, childId)));
    rel.childIds.forEach((childId, index) => { if (!siblingRanks.has(childId)) siblingRanks.set(childId, index); });
  }
  if (parentToChildren.size === 0) return {};
  const familyIds = new Set<string>([...Array.from(parentToChildren.keys()), ...Array.from(childIds)]);
  const level = new Map<string, number>();
  const roots = Array.from(familyIds).filter(id => !childIds.has(id));
  roots.forEach(id => level.set(id, 0));
  const queue = [...roots];
  while (queue.length) {
    const parentId = queue.shift()!;
    const parentLevel = level.get(parentId) ?? 0;
    for (const childId of Array.from(parentToChildren.get(parentId) ?? [])) {
      const nextLevel = parentLevel + 1;
      if ((level.get(childId) ?? -1) < nextLevel) { level.set(childId, nextLevel); queue.push(childId); }
    }
  }
  for (const id of Array.from(familyIds)) if (!level.has(id)) level.set(id, 0);
  const byLevel = new Map<number, string[]>();
  for (const id of Array.from(familyIds)) {
    const generation = level.get(id) ?? 0;
    if (!byLevel.has(generation)) byLevel.set(generation, []);
    byLevel.get(generation)!.push(id);
  }
  const charactersById = new Map(book.characters.map(character => [character.id, character]));
  const positions: LayoutPositions = {};
  for (const generation of Array.from(byLevel.keys()).sort((a, b) => a - b)) {
    const ids = byLevel.get(generation)!;
    ids.sort((a, b) => {
      const aRank = siblingRanks.get(a), bRank = siblingRanks.get(b);
      if (aRank !== undefined && bRank !== undefined && aRank !== bRank) return aRank - bRank;
      return (charactersById.get(a)?.x ?? 0) - (charactersById.get(b)?.x ?? 0);
    });
    const startX = 180 - ((ids.length - 1) * 175) / 2;
    ids.forEach((id, index) => { positions[id] = { x: startX + index * 175, y: 140 + generation * 150 }; });
  }
  return positions;
}

export function BookProvider({ children }: { children: React.ReactNode }) {
  const [book, setBook] = useState<BookData>(() => {
    const index = getIndex();
    if (index.length > 0) {
      const loaded = loadFromStorage(index[index.length - 1].id);
      if (loaded) return loaded;
    }
    // Seed sample data on first load
    saveToStorage(SAMPLE_BOOK);
    return SAMPLE_BOOK;
  });
  const [savedBooks, setSavedBooks] = useState<BookIndex[]>(getIndex);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'book' | 'characters' | 'relationships' | 'groups' | 'annotations'>('book');
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [isAddingRelationship, setIsAddingRelationship] = useState(false);
  const [relationshipSourceId, setRelationshipSourceId] = useState<string | null>(null);
  const [showRelationshipLabels, setShowRelationshipLabels] = useState(true);
  const [showRoutingPorts, setShowRoutingPortsState] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_ROUTING_PORTS_KEY) === 'true'; } catch { return false; }
  });
  const [arrowheadScale, setArrowheadScaleState] = useState<number>(() => {
    try {
      const value = Number(localStorage.getItem(STORAGE_ARROWHEAD_SCALE_KEY) ?? '1');
      return Number.isFinite(value) ? Math.max(0.6, Math.min(2, value)) : 1;
    } catch { return 1; }
  });
  const [arrowheadTypeScales, setArrowheadTypeScales] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_ARROWHEAD_TYPE_SCALES_KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
  });
  const [showRoutingDebug, setShowRoutingDebugState] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_ROUTING_DEBUG_KEY) === 'true'; } catch { return false; }
  });
  const [familyTreePreviewPositions, setFamilyTreePreviewPositions] = useState<LayoutPositions | null>(null);
  const [familyTreeUndoPositions, setFamilyTreeUndoPositions] = useState<LayoutPositions | null>(null);
  const [hiddenCharacterIds, setHiddenCharacterIds] = useState<Set<string>>(new Set());
  const [spotlightGroupIds, setSpotlightGroupIds] = useState<Set<string>>(new Set());
  const [hiddenRelationshipTypes, setHiddenRelationshipTypes] = useState<Set<string>>(new Set());
  const [focusedCharacterId, setFocusedCharacterId] = useState<string | null>(null);
  const [focusCircleGroupId, setFocusCircleGroupId] = useState<string | null>(null);
  const [enforcedBoundaryGroupIds, setEnforcedBoundaryGroupIds] = useState<Set<string>>(new Set());
  const [hiddenCircleGroupIds, setHiddenCircleGroupIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HIDDEN_CIRCLES_KEY);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [circleGroupOrder, setCircleGroupOrderState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CIRCLE_ORDER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [circleOverlapStep, setCircleOverlapStepState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_OVERLAP_STEP_KEY);
      const n = raw ? Number(raw) : 14;
      return isNaN(n) ? 14 : Math.max(0, Math.min(60, n));
    } catch { return 14; }
  });

  const annotationLayerPreset = book.annotationLayerPreset ?? 'reading';
  const visibleAnnotationLayers = book.visibleAnnotationLayers ?? ['canvas'];

  const setVisibleAnnotationLayers = useCallback((layers: AnnotationLayer[]) => {
    const uniqueLayers = Array.from(new Set(layers));
    setBook(current => ({ ...current, annotationLayerPreset: 'custom', visibleAnnotationLayers: uniqueLayers, updatedAt: new Date().toISOString() }));
  }, []);

  const setAnnotationLayerPreset = useCallback((preset: AnnotationLayerPreset) => {
    const presetLayers: Record<Exclude<AnnotationLayerPreset, 'custom'>, AnnotationLayer[]> = {
      reading: ['canvas'],
      study: ['canvas', 'chapters', 'timeline'],
      research: ['canvas', 'chapters', 'timeline', 'quotes', 'research'],
    };
    if (preset === 'custom') return;
    setBook(current => ({ ...current, annotationLayerPreset: preset, visibleAnnotationLayers: presetLayers[preset], updatedAt: new Date().toISOString() }));
  }, []);

  const toggleCharacterVisibility = useCallback((id: string) => {
    setHiddenCharacterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // When groups change, sync circleGroupOrder: remove deleted groups, append new circle groups
  useEffect(() => {
    const groupIds = new Set(book.groups.map(g => g.id));
    const circleIds = book.groups.filter(g => g.groupType === 'circle').map(g => g.id);
    setSpotlightGroupIds(prev => {
      const next = new Set(Array.from(prev).filter(id => groupIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setHiddenCircleGroupIds(prev => {
      const next = new Set(Array.from(prev).filter(id => groupIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setCircleGroupOrderState(prev => {
      // Keep existing order for known IDs, append any new circle IDs at the end
      const filtered = prev.filter(id => groupIds.has(id));
      const newIds = circleIds.filter(id => !filtered.includes(id));
      const next = [...filtered, ...newIds];
      // Only update if something changed
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      try { localStorage.setItem(STORAGE_CIRCLE_ORDER_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [book.groups]);

  const toggleCircleGroupVisibility = useCallback((groupId: string) => {
    setHiddenCircleGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      try { localStorage.setItem(STORAGE_HIDDEN_CIRCLES_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);

  const setCircleGroupOrder = useCallback((order: string[]) => {
    setCircleGroupOrderState(order);
    try { localStorage.setItem(STORAGE_CIRCLE_ORDER_KEY, JSON.stringify(order)); } catch {};
  }, []);

  const setGroupSequenceOrder = useCallback((order: string[]) => {
    setBook(current => ({ ...current, groupSequenceOrder: order, updatedAt: new Date().toISOString() }));
  }, []);

  const setCircleOverlapStep = useCallback((step: number) => {
    const clamped = Math.max(0, Math.min(60, Math.round(step)));
    setCircleOverlapStepState(clamped);
    try { localStorage.setItem(STORAGE_OVERLAP_STEP_KEY, String(clamped)); } catch {};
  }, []);

  const setShowRoutingPorts = useCallback((visible: boolean) => {
    setShowRoutingPortsState(visible);
    try { localStorage.setItem(STORAGE_ROUTING_PORTS_KEY, String(visible)); } catch {}
  }, []);

  const setArrowheadScale = useCallback((scale: number) => {
    const next = Math.max(0.6, Math.min(2, Math.round(scale * 10) / 10));
    setArrowheadScaleState(next);
    try { localStorage.setItem(STORAGE_ARROWHEAD_SCALE_KEY, String(next)); } catch {}
  }, []);

  const setArrowheadTypeScale = useCallback((type: string, scale: number) => {
    const nextScale = Math.max(0.6, Math.min(2, Math.round(scale * 10) / 10));
    setArrowheadTypeScales(previous => {
      const next = { ...previous, [type]: nextScale };
      try { localStorage.setItem(STORAGE_ARROWHEAD_TYPE_SCALES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setShowRoutingDebug = useCallback((visible: boolean) => {
    setShowRoutingDebugState(visible);
    try { localStorage.setItem(STORAGE_ROUTING_DEBUG_KEY, String(visible)); } catch {}
  }, []);

  const toggleGroupSpotlight = useCallback((groupId: string) => {
    setSpotlightGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }, []);

  const clearGroupSpotlight = useCallback(() => {
    setSpotlightGroupIds(new Set());
  }, []);

  // Nudge non-members outside a circle's padded bounding box
  const toggleBoundaryEnforcement = useCallback((groupId: string) => {
    setEnforcedBoundaryGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        return next;
      }
      // Switching ON — compute bounding box of members and nudge non-members out
      next.add(groupId);
      return next;
    });

    // Run the nudge as a separate state update so we have the latest book state
    setBook(prev => {
      const group = prev.groups.find(g => g.id === groupId);
      if (!group || group.groupType !== 'circle') return prev;

      const NODE_H = 52;
      const PADDING = 36; // matches CircleOverlay padding
      const GAP = 24;    // extra gap between nudged node and boundary edge

      // Compute bounding box of circle members using real node widths
      const members = prev.characters.filter(c => c.groupIds?.includes(groupId));
      if (members.length === 0) return prev;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const m of members) {
        const w = calcNodeWidth(m.name, m.title);
        minX = Math.min(minX, m.x);
        minY = Math.min(minY, m.y);
        maxX = Math.max(maxX, m.x + w);
        maxY = Math.max(maxY, m.y + NODE_H);
      }
      // Padded boundary
      const bLeft   = minX - PADDING;
      const bTop    = minY - PADDING;
      const bRight  = maxX + PADDING;
      const bBottom = maxY + PADDING;
      const bCx = (bLeft + bRight) / 2;
      const bCy = (bTop + bBottom) / 2;

      // For each non-member, check if their box overlaps the boundary
      const updatedChars = prev.characters.map(c => {
        if (c.groupIds?.includes(groupId)) return c; // member — don't touch
        const cw = calcNodeWidth(c.name, c.title);
        const nodeLeft   = c.x;
        const nodeTop    = c.y;
        const nodeRight  = c.x + cw;
        const nodeBottom = c.y + NODE_H;

        // Check overlap
        const overlaps =
          nodeLeft < bRight && nodeRight > bLeft &&
          nodeTop  < bBottom && nodeBottom > bTop;

        if (!overlaps) return c; // already outside — leave it

        // Determine which side of the boundary is nearest to the node's centre
        const ncx = c.x + cw / 2;
        const ncy = c.y + NODE_H / 2;
        const dLeft   = Math.abs(ncx - bLeft);
        const dRight  = Math.abs(ncx - bRight);
        const dTop    = Math.abs(ncy - bTop);
        const dBottom = Math.abs(ncy - bBottom);
        const minDist = Math.min(dLeft, dRight, dTop, dBottom);

        let nx = c.x;
        let ny = c.y;

        if (minDist === dLeft) {
          // Push left
          nx = bLeft - cw - GAP;
        } else if (minDist === dRight) {
          // Push right
          nx = bRight + GAP;
        } else if (minDist === dTop) {
          // Push up
          ny = bTop - NODE_H - GAP;
        } else {
          // Push down
          ny = bBottom + GAP;
        }

        // Bias away from boundary centre to avoid clustering on one edge
        void bCx; void bCy;

        return { ...c, x: nx, y: ny };
      });

      return { ...prev, characters: updatedChars, updatedAt: new Date().toISOString() };
    });
  }, [setBook]);

  const toggleRelationshipTypeVisibility = useCallback((type: string) => {
    setHiddenRelationshipTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }, []);

  // Auto-save debounced
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (book.title || book.characters.length > 0) {
        saveToStorage(book);
        setSavedBooks(getIndex());
      }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [book]);

  // Phones often suspend a page before the debounced save runs, so save
  // immediately whenever the app is hidden or closed.
  const latestBook = useRef(book);
  latestBook.current = book;
  useEffect(() => {
    const flush = () => {
      const current = latestBook.current;
      if (current.title || current.characters.length > 0) {
        try { saveToStorage(current); } catch { /* storage unavailable */ }
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const mutate = useCallback((updater: (b: BookData) => BookData) => {
    setBook(prev => updater({ ...prev, updatedAt: new Date().toISOString() }));
  }, []);

  // Book meta
  const updateBookMeta = useCallback((meta: Partial<Pick<BookData, 'title' | 'author' | 'series' | 'description'>>) => {
    mutate(b => ({ ...b, ...meta }));
  }, [mutate]);

  const saveBook = useCallback(() => {
    saveToStorage(book);
    setSavedBooks(getIndex());
  }, [book]);

  const migrateBook = (b: BookData): BookData => ({
    ...b,
    hubRelationships: b.hubRelationships ?? [],
    convergingRelationships: b.convergingRelationships ?? [],
    familyUnitRelationships: b.familyUnitRelationships ?? [],
    groupRelationships: b.groupRelationships ?? [],
    annotations: b.annotations ?? [],
    annotationLayerPreset: b.annotationLayerPreset ?? 'reading',
    visibleAnnotationLayers: b.visibleAnnotationLayers ?? ['canvas'],
    groupSequenceOrder: b.groupSequenceOrder ?? [],
    layoutVariants: b.layoutVariants ?? [],
    activeLayoutVariantId: b.activeLayoutVariantId ?? null,
  });

  const loadBook = useCallback((id: string) => {
    const loaded = loadFromStorage(id);
    if (loaded) {
      setBook(migrateBook(loaded));
      setSelectedCharacterId(null);
      setSelectedRelationshipId(null);
    }
  }, []);

  const newBook = useCallback(() => {
    setBook({ ...DEFAULT_BOOK, id: nanoid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setSelectedCharacterId(null);
    setSelectedRelationshipId(null);
  }, []);

  const deleteBook = useCallback((id: string) => {
    localStorage.removeItem(`${STORAGE_KEY}-${id}`);
    const indexRaw = localStorage.getItem(STORAGE_INDEX_KEY);
    const index: BookIndex[] = indexRaw ? JSON.parse(indexRaw) : [];
    const updated = index.filter(b => b.id !== id);
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(updated));
    setSavedBooks(updated);
    if (book.id === id) newBook();
  }, [book.id, newBook]);

  const exportBook = useCallback(() => {
    const json = JSON.stringify(book, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title || 'book'}-characters.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [book]);

  const importBook = useCallback((json: string) => {
    try {
      const parsed = migrateBook(JSON.parse(json) as BookData);
      parsed.id = nanoid();
      parsed.updatedAt = new Date().toISOString();
      setBook(parsed);
      saveToStorage(parsed);
      setSavedBooks(getIndex());
    } catch {
      // ignore parse errors
    }
  }, []);

  const saveLayoutVariant = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutate(current => {
      const now = new Date().toISOString();
      const positions: LayoutPositions = {};
      current.characters.forEach(character => { positions[character.id] = { x: character.x, y: character.y }; });
      const variant = { id: nanoid(), name: trimmed, positions, createdAt: now, updatedAt: now };
      return { ...current, layoutVariants: [...(current.layoutVariants ?? []), variant], activeLayoutVariantId: variant.id };
    });
  }, [mutate]);

  const duplicateLayoutVariant = useCallback((id: string, name?: string) => {
    mutate(current => {
      const source = (current.layoutVariants ?? []).find(variant => variant.id === id);
      if (!source) return current;
      const now = new Date().toISOString();
      const positions: LayoutPositions = {};
      Object.entries(source.positions).forEach(([characterId, position]) => { positions[characterId] = { ...position }; });
      const clone = { ...source, id: nanoid(), name: name?.trim() || `${source.name} copy`, positions, createdAt: now, updatedAt: now };
      return { ...current, layoutVariants: [...(current.layoutVariants ?? []), clone], activeLayoutVariantId: clone.id };
    });
  }, [mutate]);

  const applyLayoutVariant = useCallback((id: string) => {
    mutate(current => {
      const variant = (current.layoutVariants ?? []).find(item => item.id === id);
      if (!variant) return current;
      return { ...current, activeLayoutVariantId: id, characters: current.characters.map(character => variant.positions[character.id] ? { ...character, ...variant.positions[character.id] } : character) };
    });
  }, [mutate]);

  const renameLayoutVariant = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutate(current => ({ ...current, layoutVariants: (current.layoutVariants ?? []).map(variant => variant.id === id ? { ...variant, name: trimmed, updatedAt: new Date().toISOString() } : variant) }));
  }, [mutate]);

  const deleteLayoutVariant = useCallback((id: string) => {
    mutate(current => ({ ...current, layoutVariants: (current.layoutVariants ?? []).filter(variant => variant.id !== id), activeLayoutVariantId: current.activeLayoutVariantId === id ? null : current.activeLayoutVariantId }));
  }, [mutate]);

  // Characters
  const addCharacter = useCallback((char: Omit<Character, 'id'>): Character => {
    const newChar: Character = { ...char, id: nanoid() };
    mutate(b => ({ ...b, characters: [...b.characters, newChar] }));
    return newChar;
  }, [mutate]);

  const updateCharacter = useCallback((id: string, updates: Partial<Character>) => {
    mutate(b => ({ ...b, characters: b.characters.map(c => c.id === id ? { ...c, ...updates } : c) }));
  }, [mutate]);

  const deleteCharacter = useCallback((id: string) => {
    mutate(b => ({
      ...b,
      characters: b.characters.filter(c => c.id !== id),
      relationships: b.relationships.filter(r => r.sourceId !== id && r.targetId !== id),
      hubRelationships: (b.hubRelationships ?? []).filter(r => r.sourceId !== id && !r.targetIds.includes(id)),
      convergingRelationships: (b.convergingRelationships ?? []).filter(r => r.targetId !== id && !r.sourceIds.includes(id)),
      familyUnitRelationships: (b.familyUnitRelationships ?? []).filter(r => !r.partnerIds.includes(id) && !r.childIds.includes(id)),
      groupRelationships: (b.groupRelationships ?? []).filter(r => r.sourceId !== id),
    }));
    if (selectedCharacterId === id) setSelectedCharacterId(null);
  }, [mutate, selectedCharacterId]);

  const moveCharacter = useCallback((id: string, x: number, y: number) => {
    mutate(b => ({ ...b, characters: b.characters.map(c => {
      if (c.id !== id) return c;
      const { placedAutomatically: _placed, ...rest } = c;
      return { ...rest, x, y };
    }) }));
  }, [mutate]);

  // Relationships
  const addRelationship = useCallback((rel: Omit<Relationship, 'id'>): Relationship => {
    const newRel: Relationship = { ...rel, id: nanoid() };
    mutate(b => ({ ...b, relationships: [...b.relationships, newRel] }));
    return newRel;
  }, [mutate]);

  const updateRelationship = useCallback((id: string, updates: Partial<Relationship>) => {
    mutate(b => ({ ...b, relationships: b.relationships.map(r => r.id === id ? { ...r, ...updates } : r) }));
  }, [mutate]);

  const deleteRelationship = useCallback((id: string) => {
    mutate(b => ({ ...b, relationships: b.relationships.filter(r => r.id !== id) }));
    if (selectedRelationshipId === id) setSelectedRelationshipId(null);
  }, [mutate, selectedRelationshipId]);

  // Hub relationships
  const addHubRelationship = useCallback((rel: Omit<HubRelationship, 'id'>): HubRelationship => {
    const newRel: HubRelationship = { ...rel, id: nanoid() };
    mutate(b => ({ ...b, hubRelationships: [...(b.hubRelationships ?? []), newRel] }));
    return newRel;
  }, [mutate]);

  const updateHubRelationship = useCallback((id: string, updates: Partial<HubRelationship>) => {
    mutate(b => ({ ...b, hubRelationships: (b.hubRelationships ?? []).map(r => r.id === id ? { ...r, ...updates } : r) }));
  }, [mutate]);

  const deleteHubRelationship = useCallback((id: string) => {
    mutate(b => ({ ...b, hubRelationships: (b.hubRelationships ?? []).filter(r => r.id !== id) }));
  }, [mutate]);

  // Converging relationships
  const addConvergingRelationship = useCallback((rel: Omit<ConvergingRelationship, 'id'>): ConvergingRelationship => {
    const newRel: ConvergingRelationship = { ...rel, id: nanoid() };
    mutate(b => ({ ...b, convergingRelationships: [...(b.convergingRelationships ?? []), newRel] }));
    return newRel;
  }, [mutate]);

  const updateConvergingRelationship = useCallback((id: string, updates: Partial<ConvergingRelationship>) => {
    mutate(b => ({ ...b, convergingRelationships: (b.convergingRelationships ?? []).map(r => r.id === id ? { ...r, ...updates } : r) }));
  }, [mutate]);

  const deleteConvergingRelationship = useCallback((id: string) => {
    mutate(b => ({ ...b, convergingRelationships: (b.convergingRelationships ?? []).filter(r => r.id !== id) }));
  }, [mutate]);

  // Family-unit relationships
  const addFamilyUnitRelationship = useCallback((rel: Omit<FamilyUnitRelationship, 'id'>): FamilyUnitRelationship => {
    const newRel: FamilyUnitRelationship = { ...rel, id: nanoid() };
    mutate(b => ({ ...b, familyUnitRelationships: [...(b.familyUnitRelationships ?? []), newRel] }));
    return newRel;
  }, [mutate]);

  const updateFamilyUnitRelationship = useCallback((id: string, updates: Partial<FamilyUnitRelationship>) => {
    mutate(b => ({ ...b, familyUnitRelationships: (b.familyUnitRelationships ?? []).map(r => r.id === id ? { ...r, ...updates } : r) }));
  }, [mutate]);

  const deleteFamilyUnitRelationship = useCallback((id: string) => {
    mutate(b => ({ ...b, familyUnitRelationships: (b.familyUnitRelationships ?? []).filter(r => r.id !== id) }));
  }, [mutate]);

  // Group relationships
  const addGroupRelationship = useCallback((rel: Omit<GroupRelationship, 'id'>): GroupRelationship => {
    const newRel: GroupRelationship = { ...rel, id: nanoid() };
    mutate(b => ({ ...b, groupRelationships: [...(b.groupRelationships ?? []), newRel] }));
    return newRel;
  }, [mutate]);

  const updateGroupRelationship = useCallback((id: string, updates: Partial<GroupRelationship>) => {
    mutate(b => ({ ...b, groupRelationships: (b.groupRelationships ?? []).map(r => r.id === id ? { ...r, ...updates } : r) }));
  }, [mutate]);

  const deleteGroupRelationship = useCallback((id: string) => {
    mutate(b => ({ ...b, groupRelationships: (b.groupRelationships ?? []).filter(r => r.id !== id) }));
  }, [mutate]);

  // Canvas annotations
  const addAnnotation = useCallback((annotation: Omit<CanvasAnnotation, 'id'>): CanvasAnnotation => {
    const newAnnotation: CanvasAnnotation = { ...annotation, id: nanoid() };
    mutate(b => ({ ...b, annotations: [...(b.annotations ?? []), newAnnotation] }));
    return newAnnotation;
  }, [mutate]);

  const updateAnnotation = useCallback((id: string, updates: Partial<CanvasAnnotation>) => {
    mutate(b => ({ ...b, annotations: (b.annotations ?? []).map(annotation => annotation.id === id ? { ...annotation, ...updates } : annotation) }));
  }, [mutate]);

  const deleteAnnotation = useCallback((id: string) => {
    mutate(b => ({ ...b, annotations: (b.annotations ?? []).filter(annotation => annotation.id !== id) }));
  }, [mutate]);

  // Groups
  const addGroup = useCallback((group: Omit<Group, 'id'>): Group => {
    const newGroup: Group = { ...group, id: nanoid() };
    mutate(b => ({ ...b, groups: [...b.groups, newGroup] }));
    return newGroup;
  }, [mutate]);

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    mutate(b => ({ ...b, groups: b.groups.map(g => g.id === id ? { ...g, ...updates } : g) }));
  }, [mutate]);

  const deleteGroup = useCallback((id: string) => {
    mutate(b => ({
      ...b,
      groups: b.groups.filter(g => g.id !== id),
      characters: b.characters.map(c => ({
        ...c,
        groupIds: c.groupIds ? c.groupIds.filter(gid => gid !== id) : undefined,
      })),
    }));
  }, [mutate]);

  // Create a relationship of relType between every pair of Circle members that don't already have one
  const bulkConnectCircle = useCallback((groupId: string, relType: string, bidirectional: boolean): number => {
    let created = 0;
    mutate(b => {
      const members = b.characters.filter(c => c.groupIds?.includes(groupId));
      const newRels: Relationship[] = [];
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i].id, bId = members[j].id;
          const exists = b.relationships.some(
            r => (r.sourceId === a && r.targetId === bId) || (r.sourceId === bId && r.targetId === a)
          );
          if (!exists) {
            newRels.push({ id: nanoid(), sourceId: a, targetId: bId, type: relType as Relationship['type'], bidirectional, uncertain: false });
            created++;
          }
        }
      }
      return { ...b, relationships: [...b.relationships, ...newRels] };
    });
    return created;
  }, [mutate]);

  // Arrange parent/child relationships in generations while preserving unrelated characters.
  const autoArrangeFamilyTree = useCallback(() => {
    mutate(b => {
      const parentToChildren = new Map<string, Set<string>>();
      const childIds = new Set<string>();
      const addParentChild = (parentId: string, childId: string) => {
        if (parentId === childId) return;
        if (!parentToChildren.has(parentId)) parentToChildren.set(parentId, new Set());
        parentToChildren.get(parentId)!.add(childId);
        childIds.add(childId);
      };
      const inferParentChild = (sourceId: string, targetId: string, label?: string) => {
        const text = (label ?? '').toLowerCase();
        if (/\b(child|daughter|son)\s+of\b/.test(text)) addParentChild(targetId, sourceId);
        else if (/\b(parent|father|mother|guardian)\b/.test(text)) addParentChild(sourceId, targetId);
      };
      for (const rel of b.relationships) if (rel.type === 'family' && !rel.bidirectional) inferParentChild(rel.sourceId, rel.targetId, rel.label);
      for (const rel of (b.hubRelationships ?? [])) if (rel.type === 'family') rel.targetIds.forEach(childId => addParentChild(rel.sourceId, childId));
      for (const rel of (b.convergingRelationships ?? [])) if (rel.type === 'family') rel.sourceIds.forEach(parentId => addParentChild(parentId, rel.targetId));
      for (const rel of (b.familyUnitRelationships ?? [])) rel.partnerIds.forEach(parentId => rel.childIds.forEach(childId => addParentChild(parentId, childId)));
      if (parentToChildren.size === 0) return b;

      const familyIds = new Set<string>([...Array.from(parentToChildren.keys()), ...Array.from(childIds)]);
      const level = new Map<string, number>();
      const roots = Array.from(familyIds).filter(id => !childIds.has(id));
      roots.forEach(id => level.set(id, 0));
      const queue = [...roots];
      while (queue.length) {
        const parentId = queue.shift()!;
        const parentLevel = level.get(parentId) ?? 0;
        for (const childId of Array.from(parentToChildren.get(parentId) ?? [])) {
          const nextLevel = parentLevel + 1;
          if ((level.get(childId) ?? -1) < nextLevel) {
            level.set(childId, nextLevel);
            queue.push(childId);
          }
        }
      }
      // Include cyclic / ambiguous family members at the first available generation.
      for (const id of Array.from(familyIds)) if (!level.has(id)) level.set(id, 0);

      const byLevel = new Map<number, string[]>();
      for (const id of Array.from(familyIds)) {
        const generation = level.get(id) ?? 0;
        if (!byLevel.has(generation)) byLevel.set(generation, []);
        byLevel.get(generation)!.push(id);
      }
      const charactersById = new Map(b.characters.map(character => [character.id, character]));
      const positions = new Map<string, { x: number; y: number }>();
      const generationGap = 150;
      const siblingGap = 175;
      const orderedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
      for (const generation of orderedLevels) {
        const ids = byLevel.get(generation)!;
        ids.sort((a, b) => (charactersById.get(a)?.x ?? 0) - (charactersById.get(b)?.x ?? 0));
        const startX = 180 - ((ids.length - 1) * siblingGap) / 2;
        ids.forEach((id, index) => positions.set(id, { x: startX + index * siblingGap, y: 140 + generation * generationGap }));
      }
      return { ...b, characters: b.characters.map(character => positions.has(character.id) ? { ...character, ...positions.get(character.id)! } : character) };
    });
  }, [mutate]);

  const previewFamilyTreeLayout = useCallback(() => {
    const positions = calculateFamilyTreePositions(book);
    setFamilyTreePreviewPositions(Object.keys(positions).length > 0 ? positions : null);
  }, [book]);

  const discardFamilyTreePreview = useCallback(() => {
    setFamilyTreePreviewPositions(null);
  }, []);

  const applyFamilyTreePreview = useCallback(() => {
    if (!familyTreePreviewPositions) return;
    const originalPositions: LayoutPositions = {};
    for (const character of book.characters) {
      if (familyTreePreviewPositions[character.id]) originalPositions[character.id] = { x: character.x, y: character.y };
    }
    setFamilyTreeUndoPositions(originalPositions);
    mutate(current => ({ ...current, characters: current.characters.map(character => familyTreePreviewPositions[character.id] ? { ...character, ...familyTreePreviewPositions[character.id] } : character) }));
    setFamilyTreePreviewPositions(null);
  }, [book.characters, familyTreePreviewPositions, mutate]);

  const undoFamilyTreeLayout = useCallback(() => {
    if (!familyTreeUndoPositions) return;
    mutate(current => ({ ...current, characters: current.characters.map(character => familyTreeUndoPositions[character.id] ? { ...character, ...familyTreeUndoPositions[character.id] } : character) }));
    setFamilyTreeUndoPositions(null);
  }, [familyTreeUndoPositions, mutate]);

  return (
    <BookContext.Provider value={{
      book, savedBooks,
      updateBookMeta, saveBook, loadBook, newBook, deleteBook, exportBook, importBook,
      saveLayoutVariant, duplicateLayoutVariant, applyLayoutVariant, renameLayoutVariant, deleteLayoutVariant,
      addCharacter, updateCharacter, deleteCharacter, moveCharacter,
      addRelationship, updateRelationship, deleteRelationship,
      addHubRelationship, updateHubRelationship, deleteHubRelationship,
      addConvergingRelationship, updateConvergingRelationship, deleteConvergingRelationship,
       addFamilyUnitRelationship, updateFamilyUnitRelationship, deleteFamilyUnitRelationship,
       addGroupRelationship, updateGroupRelationship, deleteGroupRelationship,
       addAnnotation, updateAnnotation, deleteAnnotation,
       annotationLayerPreset, visibleAnnotationLayers, setAnnotationLayerPreset, setVisibleAnnotationLayers,
       addGroup, updateGroup, deleteGroup,
       selectedCharacterId, setSelectedCharacterId,
       selectedRelationshipId, setSelectedRelationshipId,
       focusedAnnotationId, setFocusedAnnotationId,
       sidebarTab, setSidebarTab,
      editingCharacterId, setEditingCharacterId,
      editingRelationshipId, setEditingRelationshipId,
      isAddingRelationship, setIsAddingRelationship,
      relationshipSourceId, setRelationshipSourceId,
      showRelationshipLabels, setShowRelationshipLabels,
      showRoutingPorts, setShowRoutingPorts,
      arrowheadScale, setArrowheadScale, arrowheadTypeScales, setArrowheadTypeScale, showRoutingDebug, setShowRoutingDebug,
      hiddenCharacterIds, toggleCharacterVisibility,
      spotlightGroupIds, toggleGroupSpotlight, clearGroupSpotlight,
      hiddenRelationshipTypes, toggleRelationshipTypeVisibility,
      focusedCharacterId, setFocusedCharacterId,
      focusCircleGroupId, setFocusCircleGroupId,
      enforcedBoundaryGroupIds, toggleBoundaryEnforcement,
       hiddenCircleGroupIds, toggleCircleGroupVisibility,
       circleOverlapStep, setCircleOverlapStep,
       circleGroupOrder, setCircleGroupOrder,
       groupSequenceOrder: book.groupSequenceOrder ?? [], setGroupSequenceOrder,
       bulkConnectCircle,
      autoArrangeFamilyTree,
      familyTreePreviewPositions, previewFamilyTreeLayout, applyFamilyTreePreview, discardFamilyTreePreview, undoFamilyTreeLayout,
      canUndoFamilyTreeLayout: !!familyTreeUndoPositions,
    }}>
      {children}
    </BookContext.Provider>
  );
}

export function useBook() {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error('useBook must be used within BookProvider');
  return ctx;
}
