// ============================================================
// GraphCanvas — Main interactive canvas
// Design: Dark Scholarly Codex — infinite panning, node dragging
// ============================================================
import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useBook } from '@/contexts/BookContext';
import { CharacterNode, calcNodeWidth } from './CharacterNode';
import { RelationshipEdge } from './RelationshipEdge';
import { RELATIONSHIP_TYPES } from '@/lib/types';
import { Users, GitBranch, Plus, StickyNote } from 'lucide-react';
import { CircleOverlay } from './CircleOverlay';
import { HubSpokeOverlay } from './HubSpokeOverlay';
import { ConvergingOverlay } from './ConvergingOverlay';
import { FamilyUnitOverlay } from './FamilyUnitOverlay';
import { CharacterToGroupOverlay } from './CharacterToGroupOverlay';
import { AnnotationOverlay } from './AnnotationOverlay';
import { toast } from 'sonner';

const nodeTypes = { character: CharacterNode };
const edgeTypes = { relationship: RelationshipEdge };

// Arrow marker defs for each relationship type
function ArrowDefs({ scale, typeScales }: { scale: number; typeScales: Record<string, number> }) {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {Object.entries(RELATIONSHIP_TYPES).map(([type, info]) => {
          const markerScale = scale * (typeScales[type] ?? 1);
          return <marker
            key={type}
            id={`arrow-${type}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth={6 * markerScale}
            markerHeight={6 * markerScale}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={info.color} opacity={0.8} />
          </marker>;
        })}
      </defs>
    </svg>
  );
}

// ── Label collision nudge computation ───────────────────────
// For each pair of edges that share the same source+target midpoint
// (within a tolerance), spread their labels apart perpendicularly.
// Returns a map of edgeId → nudge offset in pixels.
const NODE_H = 36;
const LABEL_SPREAD = 18; // px between stacked labels on orthogonal segments
type PortSide = 'top' | 'right' | 'bottom' | 'left';
interface NodeBox { x: number; y: number; w: number; h: number; }
interface AllocatedPort { x: number; y: number; side: PortSide; }
interface PortBucketEntry { relationshipId: string; endpoint: 'source' | 'target'; box: NodeBox; side: PortSide; }

function getConnectionSides(source: NodeBox, target: NodeBox): { sourceSide: PortSide; targetSide: PortSide } {
  const sourceCx = source.x + source.w / 2;
  const sourceCy = source.y + source.h / 2;
  const targetCx = target.x + target.w / 2;
  const targetCy = target.y + target.h / 2;
  const dx = targetCx - sourceCx;
  const dy = targetCy - sourceCy;
  if (Math.abs(dx) > Math.abs(dy) * 1.3) {
    return dx >= 0 ? { sourceSide: 'right', targetSide: 'left' } : { sourceSide: 'left', targetSide: 'right' };
  }
  return dy >= 0 ? { sourceSide: 'bottom', targetSide: 'top' } : { sourceSide: 'top', targetSide: 'bottom' };
}

function pointOnSide(box: NodeBox, side: PortSide, index: number, count: number): AllocatedPort {
  // Distribute equally inside the usable face rather than placing every line
  // at the midpoint. The inset protects rounded corners and accent strips.
  const slot = (index + 1) / (count + 1);
  const inset = 6;
  if (side === 'top' || side === 'bottom') {
    const x = box.x + inset + (box.w - inset * 2) * slot;
    return { x, y: side === 'top' ? box.y : box.y + box.h, side };
  }
  const y = box.y + inset + (box.h - inset * 2) * slot;
  return { x: side === 'left' ? box.x : box.x + box.w, y, side };
}

function allocateRelationshipPorts(
  relationships: Array<{ id: string; sourceId: string; targetId: string }>,
  boxes: Map<string, NodeBox>,
): Map<string, { source?: AllocatedPort; target?: AllocatedPort }> {
  const buckets = new Map<string, PortBucketEntry[]>();
  for (const relationship of relationships) {
    const source = boxes.get(relationship.sourceId);
    const target = boxes.get(relationship.targetId);
    if (!source || !target) continue;
    const { sourceSide, targetSide } = getConnectionSides(source, target);
    const entries = [
      { nodeId: relationship.sourceId, endpoint: 'source' as const, box: source, side: sourceSide },
      { nodeId: relationship.targetId, endpoint: 'target' as const, box: target, side: targetSide },
    ];
    for (const entry of entries) {
      const key = `${entry.nodeId}:${entry.side}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({ relationshipId: relationship.id, endpoint: entry.endpoint, box: entry.box, side: entry.side });
    }
  }
  const ports = new Map<string, { source?: AllocatedPort; target?: AllocatedPort }>();
  for (const entries of Array.from(buckets.values())) {
    entries.sort((a: PortBucketEntry, b: PortBucketEntry) => a.relationshipId.localeCompare(b.relationshipId));
    entries.forEach((entry: PortBucketEntry, index: number) => {
      const assigned: { source?: AllocatedPort; target?: AllocatedPort } = ports.get(entry.relationshipId) ?? {};
      const port = pointOnSide(entry.box, entry.side, index, entries.length);
      if (entry.endpoint === 'source') assigned.source = port;
      else assigned.target = port;
      ports.set(entry.relationshipId, assigned);
    });
  }
  return ports;
}

function computeLabelNudges(
  relationships: Array<{ id: string; sourceId: string; targetId: string }>,
  charPositions: Map<string, { x: number; y: number; w: number }>,
): Map<string, number> {
  const nudges = new Map<string, number>();

  // Group edges that share the same source node — they likely share the same
  // exit segment and need their labels spread along that segment.
  // Also group edges that share the same target node for the same reason.
  // Use the pair (srcId sorted, tgtId sorted) as the bucket key so that
  // edges between the same pair of nodes are always grouped together.
  const buckets = new Map<string, string[]>();
  for (const rel of relationships) {
    const src = charPositions.get(rel.sourceId);
    const tgt = charPositions.get(rel.targetId);
    if (!src || !tgt) continue;
    // Bucket by shared source node — edges leaving the same node cluster
    const srcKey = `src:${rel.sourceId}`;
    if (!buckets.has(srcKey)) buckets.set(srcKey, []);
    buckets.get(srcKey)!.push(rel.id);
  }

  for (const ids of Array.from(buckets.values())) {
    if (ids.length <= 1) continue;
    const count = ids.length;
    ids.forEach((id: string, i: number) => {
      const offset = (i - (count - 1) / 2) * LABEL_SPREAD;
      nudges.set(id, offset);
    });
  }

  return nudges;
}

export function GraphCanvas() {
  const {
    book,
    moveCharacter,
    selectedCharacterId, setSelectedCharacterId,
    selectedRelationshipId, setSelectedRelationshipId,
    focusedAnnotationId, setFocusedAnnotationId,
    isAddingRelationship, setIsAddingRelationship,
    relationshipSourceId, setRelationshipSourceId,
    addRelationship,
    addAnnotation,
    setSidebarTab,
    setEditingCharacterId,
    hiddenCharacterIds,
    spotlightGroupIds,
    hiddenRelationshipTypes,
    focusedCharacterId,
    focusCircleGroupId,
    showRoutingPorts,
    arrowheadScale,
    arrowheadTypeScales,
    showRoutingDebug,
    setShowRoutingDebug,
    familyTreePreviewPositions,
  } = useBook();

  const { fitView, screenToFlowPosition, setCenter } = useReactFlow();

  const displayCharacters = useMemo(() => book.characters.map(character => (
    familyTreePreviewPositions?.[character.id]
      ? { ...character, ...familyTreePreviewPositions[character.id] }
      : character
  )), [book.characters, familyTreePreviewPositions]);

  // The Notes panel can request a one-off viewport jump to an annotation.
  useEffect(() => {
    if (!focusedAnnotationId) return;
    const annotation = (book.annotations ?? []).find(item => item.id === focusedAnnotationId);
    if (!annotation) return;
    const character = annotation.characterId ? displayCharacters.find(item => item.id === annotation.characterId) : undefined;
    const x = (character?.x ?? 0) + annotation.x + 90;
    const y = (character?.y ?? 0) + annotation.y + 30;
    setCenter(x, y, { zoom: 1.15, duration: 420 });
    const timer = window.setTimeout(() => setFocusedAnnotationId(null), 520);
    return () => window.clearTimeout(timer);
  }, [focusedAnnotationId, book.annotations, displayCharacters, setCenter, setFocusedAnnotationId]);

  // When a Circle is focused, fit the viewport to its members after the next render
  useEffect(() => {
    if (!focusCircleGroupId) return;
    const timer = setTimeout(() => {
      const memberIds = book.characters
        .filter(c => c.groupIds?.includes(focusCircleGroupId))
        .map(c => c.id);
      if (memberIds.length === 0) return;
      fitView({ nodes: memberIds.map(id => ({ id })), padding: 0.35, duration: 500 });
    }, 80); // small delay to let ReactFlow settle the filtered node set
    return () => clearTimeout(timer);
  }, [focusCircleGroupId, book.characters, fitView]);

  // Pre-compute per-character node widths
  const charWidths = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of displayCharacters) {
      m.set(c.id, calcNodeWidth(c.name, c.title));
    }
    return m;
  }, [displayCharacters]);

  // Pre-compute label nudge offsets
  const labelNudges = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; w: number }>();
    for (const c of displayCharacters) {
      positions.set(c.id, { x: c.x, y: c.y, w: charWidths.get(c.id) ?? 140 });
    }
    return computeLabelNudges(book.relationships, positions);
  }, [book.relationships, displayCharacters, charWidths]);

  // Every standard relationship is assigned its own stable attachment point on
  // the appropriate node face. Dense maps therefore fan connectors out instead
  // of collapsing them into one central port.
  const relationshipPorts = useMemo(() => {
    const boxes = new Map<string, NodeBox>();
    for (const character of displayCharacters) {
      boxes.set(character.id, { x: character.x, y: character.y, w: charWidths.get(character.id) ?? 140, h: NODE_H });
    }
    return allocateRelationshipPorts(book.relationships, boxes);
  }, [book.relationships, displayCharacters, charWidths]);

  const routingPortsByCharacter = useMemo(() => {
    const ports = new Map<string, Array<{ left: number; top: number; relationshipId: string }>>();
    const addPort = (characterId: string, point: { x: number; y: number }, relationshipId: string) => {
      const character = displayCharacters.find(item => item.id === characterId);
      if (!character) return;
      const width = charWidths.get(characterId) ?? 140;
      const next = ports.get(characterId) ?? [];
      next.push({ left: ((point.x - character.x) / width) * 100, top: ((point.y - character.y) / NODE_H) * 100, relationshipId });
      ports.set(characterId, next);
    };
    for (const relationship of book.relationships) {
      const assignment = relationshipPorts.get(relationship.id);
      if (assignment?.source) addPort(relationship.sourceId, assignment.source, relationship.id);
      if (assignment?.target) addPort(relationship.targetId, assignment.target, relationship.id);
    }
    // Dots clarify dense routing; a single relationship retains the clean node silhouette.
    for (const [characterId, nodePorts] of Array.from(ports.entries())) {
      if (nodePorts.length < 2) ports.delete(characterId);
    }
    return ports;
  }, [book.relationships, displayCharacters, charWidths, relationshipPorts]);

  // Compute the set of character IDs that should be visible on the canvas
  const visibleCharacterIds = useMemo(() => {
    // If focus mode is active, only show the focused character and their direct neighbours
    if (focusedCharacterId) {
      const neighbourIds = new Set<string>([focusedCharacterId]);
      for (const rel of book.relationships) {
        if (rel.sourceId === focusedCharacterId) neighbourIds.add(rel.targetId);
        if (rel.targetId === focusedCharacterId) neighbourIds.add(rel.sourceId);
      }
      for (const rel of (book.convergingRelationships ?? [])) {
        if (rel.targetId === focusedCharacterId) rel.sourceIds.forEach(id => neighbourIds.add(id));
        if (rel.sourceIds.includes(focusedCharacterId)) {
          neighbourIds.add(rel.targetId);
          rel.sourceIds.forEach(id => neighbourIds.add(id));
        }
      }
      for (const rel of (book.familyUnitRelationships ?? [])) {
        if (rel.partnerIds.includes(focusedCharacterId) || rel.childIds.includes(focusedCharacterId)) {
          rel.partnerIds.forEach(id => neighbourIds.add(id));
          rel.childIds.forEach(id => neighbourIds.add(id));
        }
      }
      return neighbourIds;
    }
    // Circle focus: if a circle group is focused, show only its members
    if (focusCircleGroupId) {
      const circleMembers = new Set(
        book.characters
          .filter(c => c.groupIds?.includes(focusCircleGroupId))
          .map(c => c.id)
      );
      return circleMembers;
    }
    return new Set(
      book.characters
        .filter(c => {
          if (hiddenCharacterIds.has(c.id)) return false;
          // Spotlight mode: if any groups are spotlighted, hide chars not in any spotlighted group
          if (spotlightGroupIds.size > 0) {
            const inSpotlight = c.groupIds && c.groupIds.some(gid => spotlightGroupIds.has(gid));
            if (!inSpotlight) return false;
          }
          return true;
        })
        .map(c => c.id)
    );
  }, [book.characters, book.relationships, book.convergingRelationships, book.familyUnitRelationships, hiddenCharacterIds, spotlightGroupIds, focusedCharacterId, focusCircleGroupId]);

  // Build ReactFlow nodes from characters
  const [debugHoveredRelationshipId, setDebugHoveredRelationshipId] = useState<string | null>(null);

  const rfNodes: Node[] = useMemo(() => {
    return displayCharacters
      .filter(c => visibleCharacterIds.has(c.id))
      .map(char => {
      // Use the first group's colour as the accent (multi-group: first visible group wins)
      const group = char.groupIds && char.groupIds.length > 0
        ? book.groups.find(g => char.groupIds!.includes(g.id))
        : undefined;
      const isSelected = char.id === selectedCharacterId;
      const isRelSource = char.id === relationshipSourceId;
      let isHighlighted = false;
      let isDimmed = false;

      if (selectedCharacterId && char.id !== selectedCharacterId) {
        const connected = book.relationships.some(
          r => (r.sourceId === selectedCharacterId && r.targetId === char.id) ||
               (r.targetId === selectedCharacterId && r.sourceId === char.id)
        );
        isHighlighted = connected;
        isDimmed = !connected;
      }

      const w = charWidths.get(char.id) ?? 140;

      return {
        id: char.id,
        type: 'character',
        position: { x: char.x, y: char.y },
        data: {
          character: char,
          groupColor: group?.color,
          isSelected,
          isHighlighted,
          isDimmed,
          isAddingRelSource: isRelSource,
          routingPorts: (showRoutingPorts || showRoutingDebug) ? (routingPortsByCharacter.get(char.id) ?? []) : [],
          routingDebug: showRoutingDebug,
          onRoutingPortHover: setDebugHoveredRelationshipId,
        },
        style: { width: w, height: NODE_H, background: 'transparent', border: 'none', transition: 'transform 400ms cubic-bezier(0.23, 1, 0.32, 1)' },
      };
    });
  }, [displayCharacters, book.groups, book.relationships, selectedCharacterId, relationshipSourceId, charWidths, visibleCharacterIds, showRoutingPorts, showRoutingDebug, routingPortsByCharacter]);

  // Build ReactFlow edges from relationships (only between visible characters and non-hidden types)
  const rfEdges: Edge[] = useMemo(() => {
    return book.relationships
      .filter(rel =>
        visibleCharacterIds.has(rel.sourceId) &&
        visibleCharacterIds.has(rel.targetId) &&
        !hiddenRelationshipTypes.has(rel.type)
      )
      .map(rel => {
      const isSelected = rel.id === selectedRelationshipId;
      let isDimmed = false;
      if (selectedCharacterId) {
        isDimmed = rel.sourceId !== selectedCharacterId && rel.targetId !== selectedCharacterId;
      }
      // Pass node geometry so the edge can compute exact face-midpoint attachment
      const srcChar = displayCharacters.find(c => c.id === rel.sourceId);
      const tgtChar = displayCharacters.find(c => c.id === rel.targetId);
      const srcW = srcChar ? (charWidths.get(srcChar.id) ?? 140) : 140;
      const tgtW = tgtChar ? (charWidths.get(tgtChar.id) ?? 140) : 140;
      const allocatedPorts = relationshipPorts.get(rel.id);
      return {
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        type: 'relationship',
        // Tell ReactFlow to use our custom handles so it passes correct coords
        sourceHandle: null,
        targetHandle: null,
        data: {
          relationship: rel,
          isSelected: isSelected || rel.id === debugHoveredRelationshipId,
          isDimmed: isDimmed || (debugHoveredRelationshipId !== null && rel.id !== debugHoveredRelationshipId),
          labelNudge: labelNudges.get(rel.id) ?? 0,
          // Node bounding boxes for precise face-midpoint routing
          srcBox: srcChar ? { x: srcChar.x, y: srcChar.y, w: srcW, h: NODE_H } : null,
          tgtBox: tgtChar ? { x: tgtChar.x, y: tgtChar.y, w: tgtW, h: NODE_H } : null,
          sourcePort: allocatedPorts?.source,
          targetPort: allocatedPorts?.target,
          obstacles: displayCharacters
            .filter(character => character.id !== rel.sourceId && character.id !== rel.targetId && visibleCharacterIds.has(character.id))
            .map(character => ({ x: character.x, y: character.y, w: charWidths.get(character.id) ?? 140, h: NODE_H })),
        },
      };
    });
  }, [book.relationships, displayCharacters, selectedRelationshipId, selectedCharacterId, debugHoveredRelationshipId, labelNudges, charWidths, relationshipPorts, visibleCharacterIds, hiddenRelationshipTypes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Sync external state → ReactFlow
  useEffect(() => { setNodes(rfNodes); }, [rfNodes, setNodes]);
  useEffect(() => { setEdges(rfEdges); }, [rfEdges, setEdges]);

  // Persist node position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    changes.forEach(change => {
      if (!familyTreePreviewPositions && change.type === 'position' && change.position && !change.dragging) {
        moveCharacter(change.id, change.position.x, change.position.y);
      }
    });
  }, [onNodesChange, moveCharacter, familyTreePreviewPositions]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  // Click on empty canvas — deselect
  const handlePaneClick = useCallback(() => {
    setSelectedCharacterId(null);
    setSelectedRelationshipId(null);
    if (isAddingRelationship) {
      setIsAddingRelationship(false);
      setRelationshipSourceId(null);
    }
  }, [setSelectedCharacterId, setSelectedRelationshipId, isAddingRelationship, setIsAddingRelationship, setRelationshipSourceId]);

  // Handle connecting two nodes to create a relationship
  const handleConnect = useCallback((params: { source: string | null; target: string | null }) => {
    if (!params.source || !params.target) return;
    if (params.source === params.target) return;
    const exists = book.relationships.some(
      r => (r.sourceId === params.source && r.targetId === params.target) ||
           (r.sourceId === params.target && r.targetId === params.source)
    );
    if (exists) {
      toast.error('A relationship between these characters already exists.');
      return;
    }
    addRelationship({
      sourceId: params.source,
      targetId: params.target,
      type: 'other',
      bidirectional: false,
      uncertain: false,
    });
    toast.success('Relationship added — edit it in the sidebar to set the type.');
    setSidebarTab('relationships');
  }, [book.relationships, addRelationship, setSidebarTab]);

  // Group halos — bounding box uses actual node widths
  const isEmpty = book.characters.length === 0;

  return (
    <div className="relative w-full h-full">
      <ArrowDefs scale={arrowheadScale} typeScales={arrowheadTypeScales} />
      <CircleOverlay />
      <HubSpokeOverlay />
      <ConvergingOverlay />
      <FamilyUnitOverlay />
      <CharacterToGroupOverlay />
      <AnnotationOverlay />
      <button
        type="button"
        onClick={() => {
          const point = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addAnnotation({ text: 'New note — click to edit', x: point.x, y: point.y, width: 190 });
        }}
        title="Add a free-floating explanatory note"
        className="absolute top-3 right-24 z-30 flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
        style={{ background: '#101628e8', color: '#c9a84c', border: '1px solid #66542b', boxShadow: '0 4px 14px rgba(0,0,0,0.35)', fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}
      ><StickyNote size={13} /> Note</button>
      <button
        type="button"
        onClick={() => setShowRoutingDebug(!showRoutingDebug)}
        title={showRoutingDebug ? 'Hide routing debug' : 'Show routing debug'}
        className="absolute top-3 right-3 z-30 flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
        style={{ background: showRoutingDebug ? '#4cb8c9e8' : '#101628e8', color: showRoutingDebug ? '#071018' : '#9fb0c8', border: `1px solid ${showRoutingDebug ? '#8ce5f0' : '#3b4869'}`, boxShadow: '0 4px 14px rgba(0,0,0,0.35)', fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}
      ><GitBranch size={13} /> Ports</button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={!isEmpty}
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{ type: 'relationship' }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
        deleteKeyCode={['Backspace', 'Delete']}
        onNodeDoubleClick={(_, node) => setEditingCharacterId(node.id)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="#2a3350"
        />

        <Controls
          style={{
            background: '#1e2535',
            border: '1px solid #2a3350',
            borderRadius: 8,
          }}
        />

        <MiniMap
          style={{
            background: '#141824',
            border: '1px solid #2a3350',
            borderRadius: 8,
          }}
          nodeColor={(node) => {
            const char = book.characters.find(c => c.id === node.id);
            const group = char?.groupIds && char.groupIds.length > 0
              ? book.groups.find(g => char.groupIds!.includes(g.id))
              : null;
            return char?.color || group?.color || '#c9a84c';
          }}
          maskColor="#0f111780"
        />

        {/* Adding relationship banner */}
        {isAddingRelationship && (
          <Panel position="top-center">
            <div
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: '#1e2535',
                border: '1px solid #4cb8c9',
                color: '#4cb8c9',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}
            >
              Click a character to start the relationship, then drag to the target
            </div>
          </Panel>
        )}

        {/* Empty state */}
        {isEmpty && (
          <Panel position="top-center">
            <div className="flex flex-col items-center gap-3 mt-16" style={{ pointerEvents: 'none' }}>
              <div className="flex items-center gap-2 opacity-30">
                <Users size={32} style={{ color: '#c9a84c' }} />
                <GitBranch size={24} style={{ color: '#4cb8c9' }} />
              </div>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#e8e0d050', textAlign: 'center' }}>
                Begin mapping your story
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#e8e0d030', textAlign: 'center' }}>
                Add characters from the sidebar to place them on the canvas
              </p>
              <div className="flex items-center gap-1 mt-1" style={{ color: '#c9a84c50', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                <Plus size={14} />
                <span>Use the Characters tab to add your first character</span>
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
