// ============================================================
// Merge a book exported from another device into the copy on this one.
//
// Rules:
//  • Items are matched by ID (IDs survive export/import).
//  • New items from the file are added.
//  • An item edited on both devices keeps whichever edit is newer
//    (per-item updatedAt); with no newer edit, this device's version stays.
//  • Character positions always stay as they are on this device, so the
//    map layout is never disturbed. Characters added on the phone are
//    placed in a column to the right of this device's map.
//  • Items deleted on either device (deletedIds) are removed.
// ============================================================
import { nextQuickPosition } from '@/lib/placement';
import type { BookData, Character } from '@/lib/types';

export interface MergeCounts { added: number; updated: number; removed: number }
export interface MergeSummary {
  characters: MergeCounts;
  relationships: MergeCounts;
  groups: MergeCounts;
  notes: MergeCounts;
}

type WithId = { id: string; updatedAt?: string };

const emptyCounts = (): MergeCounts => ({ added: 0, updated: 0, removed: 0 });

function isNewer(incoming: WithId, local: WithId) {
  return (incoming.updatedAt ?? '') > (local.updatedAt ?? '');
}

function mergeList<T extends WithId>(
  local: T[] | undefined,
  incoming: T[] | undefined,
  deleted: Set<string>,
  counts: MergeCounts,
  combine: (local: T, incoming: T) => T = (_l, i) => i,
): T[] {
  const incomingById = new Map((incoming ?? []).map(item => [item.id, item]));
  const localIds = new Set((local ?? []).map(item => item.id));
  const result: T[] = [];
  for (const item of local ?? []) {
    if (deleted.has(item.id)) { counts.removed++; continue; }
    const other = incomingById.get(item.id);
    if (other && isNewer(other, item)) { result.push(combine(item, other)); counts.updated++; }
    else result.push(item);
  }
  for (const item of incoming ?? []) {
    if (localIds.has(item.id) || deleted.has(item.id)) continue;
    result.push(item);
    counts.added++;
  }
  return result;
}

export function mergeBooks(local: BookData, incoming: BookData): { book: BookData; summary: MergeSummary } {
  const summary: MergeSummary = {
    characters: emptyCounts(), relationships: emptyCounts(), groups: emptyCounts(), notes: emptyCounts(),
  };
  const localDeleted = new Set(local.deletedIds ?? []);
  const incomingDeleted = new Set(incoming.deletedIds ?? []);
  const deleted = new Set([...Array.from(localDeleted), ...Array.from(incomingDeleted)]);
  // Only removals caused by the other device count as "removed" in the summary.
  const removedHere = (list?: WithId[]) => (list ?? []).filter(i => incomingDeleted.has(i.id) && !localDeleted.has(i.id)).length;

  // Characters: details follow the newer edit, position always stays local.
  const localCharIds = new Set(local.characters.map(c => c.id));
  let characters = mergeList(local.characters, incoming.characters, deleted, summary.characters, (l, i) => {
    const merged: Character = { ...i, x: l.x, y: l.y };
    if (l.placedAutomatically) merged.placedAutomatically = true; else delete merged.placedAutomatically;
    return merged;
  });
  // Re-place characters that were auto-placed on the other device, relative to this device's map.
  const placed: Character[] = characters.filter(c => localCharIds.has(c.id) || !c.placedAutomatically);
  characters = characters.map(c => {
    if (localCharIds.has(c.id) || !c.placedAutomatically) return c;
    const next = { ...c, ...nextQuickPosition(placed) };
    placed.push(next);
    return next;
  });
  summary.characters.removed = removedHere(local.characters);

  const rel = summary.relationships;
  let relationships = mergeList(local.relationships, incoming.relationships, deleted, rel);
  let hubRelationships = mergeList(local.hubRelationships, incoming.hubRelationships, deleted, rel);
  let convergingRelationships = mergeList(local.convergingRelationships, incoming.convergingRelationships, deleted, rel);
  let familyUnitRelationships = mergeList(local.familyUnitRelationships, incoming.familyUnitRelationships, deleted, rel);
  let groupRelationships = mergeList(local.groupRelationships, incoming.groupRelationships, deleted, rel);
  rel.removed = removedHere([
    ...local.relationships, ...(local.hubRelationships ?? []), ...(local.convergingRelationships ?? []),
    ...(local.familyUnitRelationships ?? []), ...(local.groupRelationships ?? []),
  ]);

  const groups = mergeList(local.groups, incoming.groups, deleted, summary.groups);
  summary.groups.removed = removedHere(local.groups);
  const annotations = mergeList(local.annotations, incoming.annotations, deleted, summary.notes);
  summary.notes.removed = removedHere(local.annotations);

  // Tidy up anything left pointing at removed characters or groups.
  const charIds = new Set(characters.map(c => c.id));
  const groupIds = new Set(groups.map(g => g.id));
  characters = characters.map(c => {
    if (!c.groupIds) return c;
    const kept = c.groupIds.filter(id => groupIds.has(id));
    return kept.length === c.groupIds.length ? c : { ...c, groupIds: kept.length ? kept : undefined };
  });
  relationships = relationships.filter(r => charIds.has(r.sourceId) && charIds.has(r.targetId));
  hubRelationships = hubRelationships
    .map(r => ({ ...r, targetIds: r.targetIds.filter(id => charIds.has(id)) }))
    .filter(r => charIds.has(r.sourceId) && r.targetIds.length > 0);
  convergingRelationships = convergingRelationships
    .map(r => ({ ...r, sourceIds: r.sourceIds.filter(id => charIds.has(id)) }))
    .filter(r => charIds.has(r.targetId) && r.sourceIds.length > 0);
  familyUnitRelationships = familyUnitRelationships
    .map(r => ({ ...r, partnerIds: r.partnerIds.filter(id => charIds.has(id)), childIds: r.childIds.filter(id => charIds.has(id)) }))
    .filter(r => r.partnerIds.length > 0 && r.childIds.length > 0);
  groupRelationships = groupRelationships.filter(r => charIds.has(r.sourceId) && groupIds.has(r.groupId));

  const localVariantIds = new Set((local.layoutVariants ?? []).map(v => v.id));
  const sequence = [...(local.groupSequenceOrder ?? [])];
  for (const id of incoming.groupSequenceOrder ?? []) if (!sequence.includes(id)) sequence.push(id);

  const book: BookData = {
    ...local,
    title: local.title || incoming.title,
    author: local.author || incoming.author,
    series: local.series || incoming.series,
    description: local.description || incoming.description,
    characters,
    relationships,
    hubRelationships,
    convergingRelationships,
    familyUnitRelationships,
    groupRelationships,
    groups,
    annotations,
    groupSequenceOrder: sequence.filter(id => groupIds.has(id)),
    layoutVariants: [...(local.layoutVariants ?? []), ...(incoming.layoutVariants ?? []).filter(v => !localVariantIds.has(v.id))],
    deletedIds: Array.from(deleted).slice(-2000),
    updatedAt: new Date().toISOString(),
  };
  return { book, summary };
}

/** One-line description of a merge for a notification. */
export function describeMerge(s: MergeSummary): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string, verb: string) => { if (n) parts.push(`${n} ${n === 1 ? one : many} ${verb}`); };
  add(s.characters.added, 'character', 'characters', 'added');
  add(s.relationships.added, 'relationship', 'relationships', 'added');
  add(s.groups.added, 'group', 'groups', 'added');
  add(s.notes.added, 'note', 'notes', 'added');
  const updated = s.characters.updated + s.relationships.updated + s.groups.updated + s.notes.updated;
  const removed = s.characters.removed + s.relationships.removed + s.groups.removed + s.notes.removed;
  if (updated) parts.push(`${updated} updated`);
  if (removed) parts.push(`${removed} removed`);
  return parts.length ? parts.join(', ') : 'Already up to date — nothing new in the file';
}
