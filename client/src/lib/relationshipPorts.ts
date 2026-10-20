// ============================================================
// relationshipPorts — shared distributed attachment geometry
// Design: Dark Scholarly Codex — dense relationship lines should fan
// across a box face instead of converging at one midpoint.
// ============================================================
export type PortSide = 'top' | 'right' | 'bottom' | 'left';

export interface PortBox { x: number; y: number; w: number; h: number; }
export interface AllocatedPort { x: number; y: number; side: PortSide; }
export interface RelationshipPortAssignment { source?: AllocatedPort; target?: AllocatedPort; }
interface PortBucketEntry { relationshipId: string; endpoint: 'source' | 'target'; box: PortBox; side: PortSide; }

function getConnectionSides(source: PortBox, target: PortBox): { sourceSide: PortSide; targetSide: PortSide } {
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

function pointOnSide(box: PortBox, side: PortSide, index: number, count: number): AllocatedPort {
  const slot = (index + 1) / (count + 1);
  const inset = 6;
  if (side === 'top' || side === 'bottom') {
    return { x: box.x + inset + (box.w - inset * 2) * slot, y: side === 'top' ? box.y : box.y + box.h, side };
  }
  return { x: side === 'left' ? box.x : box.x + box.w, y: box.y + inset + (box.h - inset * 2) * slot, side };
}

export function allocateRelationshipPorts(
  relationships: Array<{ id: string; sourceId: string; targetId: string }>,
  boxes: Map<string, PortBox>,
): Map<string, RelationshipPortAssignment> {
  const buckets = new Map<string, PortBucketEntry[]>();
  for (const relationship of relationships) {
    const source = boxes.get(relationship.sourceId);
    const target = boxes.get(relationship.targetId);
    if (!source || !target) continue;
    const { sourceSide, targetSide } = getConnectionSides(source, target);
    const endpoints = [
      { nodeId: relationship.sourceId, endpoint: 'source' as const, box: source, side: sourceSide },
      { nodeId: relationship.targetId, endpoint: 'target' as const, box: target, side: targetSide },
    ];
    for (const endpoint of endpoints) {
      const key = `${endpoint.nodeId}:${endpoint.side}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({ relationshipId: relationship.id, endpoint: endpoint.endpoint, box: endpoint.box, side: endpoint.side });
    }
  }

  const ports = new Map<string, RelationshipPortAssignment>();
  for (const entries of Array.from(buckets.values())) {
    entries.sort((a, b) => a.relationshipId.localeCompare(b.relationshipId));
    entries.forEach((entry, index) => {
      const assignment = ports.get(entry.relationshipId) ?? {};
      const port = pointOnSide(entry.box, entry.side, index, entries.length);
      if (entry.endpoint === 'source') assignment.source = port;
      else assignment.target = port;
      ports.set(entry.relationshipId, assignment);
    });
  }
  return ports;
}
