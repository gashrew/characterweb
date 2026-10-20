// ============================================================
// CircleOrderPanel — drag-to-reorder list of circle groups
// Design: Dark Scholarly Codex
//
// Shows circle groups in their current concentric order
// (index 0 = innermost). The user can drag rows up/down to
// change which circle is drawn innermost vs outermost.
// Uses pointer events — no external DnD library required.
// ============================================================
import { useRef, useState, useCallback } from 'react';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { useBook } from '@/contexts/BookContext';

export function CircleOrderPanel() {
  const { book, circleGroupOrder, setCircleGroupOrder, hiddenCircleGroupIds, toggleCircleGroupVisibility } = useBook();

  // Build the ordered list of circle groups
  const allCircleGroups = book.groups.filter(g => g.groupType === 'circle');
  if (allCircleGroups.length < 2) return null; // only useful with 2+ circles

  const allCircleIds = allCircleGroups.map(g => g.id);
  // Merge user order with any unordered groups
  const orderedIds = [
    ...circleGroupOrder.filter(id => allCircleIds.includes(id)),
    ...allCircleIds.filter(id => !circleGroupOrder.includes(id)),
  ];
  const orderedGroups = orderedIds
    .map(id => allCircleGroups.find(g => g.id === id))
    .filter(Boolean) as typeof allCircleGroups;

  // ── Drag state ──────────────────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowHeightRef = useRef(30); // approximate row height in px

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragIndex(index);
    setOverIndex(index);
    // Measure actual row height from the list
    if (listRef.current) {
      const rows = listRef.current.querySelectorAll('[data-row]');
      if (rows[0]) rowHeightRef.current = (rows[0] as HTMLElement).offsetHeight;
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIndex === null || !listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const newOver = Math.max(0, Math.min(orderedGroups.length - 1, Math.floor(relY / rowHeightRef.current)));
    setOverIndex(newOver);
  }, [dragIndex, orderedGroups.length]);

  const handlePointerUp = useCallback(() => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const next = [...orderedIds];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      setCircleGroupOrder(next);
    }
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, overIndex, orderedIds, setCircleGroupOrder]);

  const handlePointerCancel = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: '#1a2035', border: '1px solid #2a3350' }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <GripVertical size={11} style={{ color: '#c9a84c' }} />
        <span style={{ fontSize: 10, color: '#c8c0b0', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
          Concentric order
        </span>
        <span style={{ fontSize: 9, color: '#556677', fontFamily: "'DM Sans', sans-serif", marginLeft: 'auto' }}>
          drag to reorder
        </span>
        {/* Show all / Hide all */}
        <button
          type="button"
          title="Show all circles"
          onClick={() => orderedGroups.forEach(g => { if (hiddenCircleGroupIds.has(g.id)) toggleCircleGroupVisibility(g.id); })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 3, display: 'flex', alignItems: 'center', color: '#8899aa' }}
        >
          <Eye size={11} />
        </button>
        <button
          type="button"
          title="Hide all circles"
          onClick={() => orderedGroups.forEach(g => { if (!hiddenCircleGroupIds.has(g.id)) toggleCircleGroupVisibility(g.id); })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 3, display: 'flex', alignItems: 'center', color: '#8899aa' }}
        >
          <EyeOff size={11} />
        </button>
      </div>

      {/* Ordered rows */}
      <div
        ref={listRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ userSelect: 'none' }}
      >
        {orderedGroups.map((group, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          const label = index === 0 ? 'innermost' : index === orderedGroups.length - 1 ? 'outermost' : `ring ${index + 1}`;

          return (
            <div
              key={group.id}
              data-row
              onPointerDown={e => handlePointerDown(e, index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 4px',
                borderRadius: 5,
                cursor: isDragging ? 'grabbing' : 'grab',
                background: isDragging
                  ? `${group.color}28`
                  : isOver
                  ? '#ffffff0a'
                  : 'transparent',
                borderTop: isOver && overIndex! < dragIndex!
                  ? `2px solid ${group.color}80`
                  : '2px solid transparent',
                borderBottom: isOver && overIndex! > dragIndex!
                  ? `2px solid ${group.color}80`
                  : '2px solid transparent',
                opacity: isDragging ? 0.55 : 1,
                transition: 'background 120ms, opacity 120ms',
                touchAction: 'none',
              }}
            >
              {/* Rank badge */}
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color: group.color,
                  background: `${group.color}22`,
                  borderRadius: 3,
                  padding: '1px 5px',
                  minWidth: 20,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>

              {/* Colour dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: group.color,
                  flexShrink: 0,
                }}
              />

              {/* Name */}
              <span
                style={{
                  fontSize: 11,
                  color: '#c8c0b0',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.name}
              </span>

              {/* Inner/outer label */}
              <span
                style={{
                  fontSize: 8,
                  color: '#556677',
                  fontFamily: "'DM Sans', sans-serif",
                  flexShrink: 0,
                }}
              >
                {label}
              </span>

              {/* Drag handle */}
              <GripVertical
                size={12}
                style={{ color: '#556677', flexShrink: 0 }}
              />
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 8, color: '#445566', fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
        Row 1 = innermost circle · last row = outermost
      </p>
    </div>
  );
}
