// ============================================================
// Book Character Mapper — Core Types
// Design: Dark Scholarly Codex — Playfair Display + DM Sans
// ============================================================

export type RelationshipType =
  | 'family'
  | 'step-family'
  | 'romance'
  | 'friendship'
  | 'rivalry'
  | 'mentor'
  | 'colleague'
  | 'enemy'
  | 'other';

export type CharacterGender = 'male' | 'female' | 'non-binary' | 'unknown';

export interface Character {
  id: string;
  name: string;
  title?: string;          // e.g. "Lord", "Dr.", "Queen"
  description?: string;
  gender: CharacterGender;
  groupIds?: string[];      // groups/families this character belongs to (multi-membership supported)
  color?: string;          // override colour for the node ring
  age?: string;
  status: 'alive' | 'deceased' | 'unknown';
  notes?: string;
  // Canvas position
  x: number;
  y: number;
  /** Set when added from the phone quick-add view; cleared once moved on the map. */
  placedAutomatically?: boolean;
}

export type RelationshipLineStyle = 'orthogonal' | 'curved' | 'straight';

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label?: string;          // e.g. "married to", "father of", "step-sister"
  bidirectional: boolean;  // true = arrow both ends, false = directed
  uncertain: boolean;      // true = dashed line
  lineStyle?: RelationshipLineStyle; // default: 'orthogonal'
  manualWaypoints?: Array<{ x: number; y: number }>; // optional user-pinned orthogonal route waypoints
  notes?: string;
}

export type GroupType = 'standard' | 'circle';

// Groups whose boundary is currently enforced (non-members nudged outside)
export type EnforcedBoundarySet = Set<string>;

export type CircleStrokeStyle = 'dashed' | 'solid' | 'dotted';

export interface Group {
  id: string;
  name: string;
  color: string;           // accent colour for the group
  description?: string;
  groupType?: GroupType;   // 'standard' = label/filter only; 'circle' = draws outline on canvas
  fillOpacity?: number;    // 0–1, fill tint opacity for circle groups (default ~0.06)
  strokeStyle?: CircleStrokeStyle; // border style for circle groups (default 'dashed')
}

// Hub-and-spoke: one source → many targets, rendered as a branching line
export interface HubRelationship {
  id: string;
  sourceId: string;          // the hub character
  targetIds: string[];       // the spoke characters
  type: RelationshipType;
  label?: string;            // e.g. "tutor of", "parent of"
  notes?: string;
  lineStyle?: 'orthogonal' | 'curved' | 'straight'; // connector routing style
  manualWaypoints?: Array<{ x: number; y: number }>; // optional pinned trunk route waypoints
}

// Converging relationship: multiple source characters → one shared target.
// Intended for relationships such as two parents → one child.
export interface ConvergingRelationship {
  id: string;
  sourceIds: string[];       // the 2+ people sharing the relationship
  targetId: string;          // the shared target character
  type: RelationshipType;
  label?: string;            // e.g. "parents of", "guardians of"
  notes?: string;
  lineStyle?: RelationshipLineStyle;
}

// Family unit: partners are visibly joined first, then one shared branch
// connects their unit to one or more children.
export interface FamilyUnitRelationship {
  id: string;
  partnerIds: string[];      // exactly two partners in the current UI
  childIds: string[];        // one or more children
  type: RelationshipType;
  label?: string;            // e.g. "parents of"
  partnerLabel?: string;     // e.g. "married", "partners"
  marriageDate?: string;     // freeform date or period, e.g. "1885" / "Spring 1891"
  guardianshipContext?: string;
  notes?: string;
  lineStyle?: RelationshipLineStyle;
}

export interface LayoutVariant {
  id: string;
  name: string;
  positions: Record<string, { x: number; y: number }>;
  createdAt: string;
  updatedAt: string;
}

// Character-to-circle: one character → one circle group boundary
export interface GroupRelationship {
  id: string;
  sourceId: string;          // the character
  groupId: string;           // the circle group
  type: RelationshipType;
  label?: string;            // e.g. "leads", "member of"
  notes?: string;
  lineStyle?: 'orthogonal' | 'curved' | 'straight'; // connector routing style
  manualWaypoints?: Array<{ x: number; y: number }>; // optional pinned route waypoints
}

/** A movable explanatory note; attach to a character when it should travel with that person. */
export interface CanvasAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  characterId?: string;
  colorPreset?: 'gold' | 'blue' | 'rose' | 'sage';
  sizePreset?: 'small' | 'medium' | 'large';
  locked?: boolean;
  /** ISO-like chronology key used by the dedicated Timeline view, e.g. 1812-06-24. */
  timelineDate?: string;
  /** Named chronological segment, e.g. "Part I · 1805" or "Before the invasion". */
  timelineGroup?: string;
  /** Chapter ordering key used by the chapter-by-chapter notebook page. */
  chapterNumber?: number;
  /** Research keywords for filtering related notes across a large book. */
  tags?: string[];
  /** One or more research references supporting the annotation. */
  citations?: AnnotationCitation[];
  /** Existing notes default to the canvas layer; notebook templates choose their own layer. */
  layer?: AnnotationLayer;
  /** Selectively show a notebook note on the main map irrespective of preset. */
  pinToMap?: boolean;
  format?: {
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    quote?: boolean;
  };
}

export interface AnnotationCitation {
  id: string;
  source: string;
  locator?: string;
  url?: string;
}

/** Notes can live in a notebook layer and be selectively pinned onto the map. */
export type AnnotationLayer = 'canvas' | 'timeline' | 'quotes' | 'chapters' | 'research';
export type AnnotationLayerPreset = 'reading' | 'study' | 'research' | 'custom';

export interface BookData {
  id: string;
  title: string;
  author: string;
  series?: string;
  description?: string;
  characters: Character[];
  relationships: Relationship[];
  hubRelationships: HubRelationship[];
  convergingRelationships: ConvergingRelationship[];
  familyUnitRelationships: FamilyUnitRelationship[];
  groupRelationships: GroupRelationship[];
  annotations: CanvasAnnotation[];
  annotationLayerPreset?: AnnotationLayerPreset;
  visibleAnnotationLayers?: AnnotationLayer[];
  groups: Group[];
  /** Reading order for the focused Group Sequence view. */
  groupSequenceOrder?: string[];
  layoutVariants?: LayoutVariant[];
  activeLayoutVariantId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Relationship type metadata ──────────────────────────────

export const RELATIONSHIP_TYPES: Record<RelationshipType, {
  label: string;
  color: string;
  dashArray?: string;
}> = {
  family:       { label: 'Family',       color: '#c9a84c' },
  'step-family':{ label: 'Step-Family',  color: '#e07b39' },
  romance:      { label: 'Romance',      color: '#e05c8a' },
  friendship:   { label: 'Friendship',   color: '#4cb8c9' },
  rivalry:      { label: 'Rivalry',      color: '#c94c4c' },
  mentor:       { label: 'Mentor',       color: '#9b6ec9' },
  colleague:    { label: 'Colleague',    color: '#6ec98b' },
  enemy:        { label: 'Enemy',        color: '#c94c4c', dashArray: '6 3' },
  other:        { label: 'Other',        color: '#8899aa' },
};

export const GROUP_COLORS = [
  '#c9a84c', '#e05c8a', '#4cb8c9', '#9b6ec9',
  '#6ec98b', '#e07b39', '#c94c4c', '#5c8ae0',
  '#c9c94c', '#8899aa',
];

export const DEFAULT_BOOK: BookData = {
  id: 'default',
  title: '',
  author: '',
  series: '',
  description: '',
  characters: [],
  relationships: [],
  hubRelationships: [],
  convergingRelationships: [],
  familyUnitRelationships: [],
  groupRelationships: [],
  annotations: [],
  groups: [],
  groupSequenceOrder: [],
  layoutVariants: [],
  activeLayoutVariantId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
