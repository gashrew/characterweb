// ============================================================
// exportCanvas — Custom HTML5 Canvas PNG exporter
// Draws the character map directly onto a 2D canvas,
// bypassing html2canvas / DOM capture entirely.
// Works regardless of zoom, SVG content, or cross-origin assets.
// ============================================================
import type { BookData } from './types';
import { RELATIONSHIP_TYPES } from './types';
import { calculateExportBounds } from './exportGeometry';
import { allocateRelationshipPorts } from './relationshipPorts';
import { getFamilyCanvasDashArray } from './familyLineStyles';
import { drawExportAnnotations } from './annotationExport';

const BG = '#0f1117';
const NODE_H = 36;
const FONT_TITLE = "'Playfair Display', serif";
const FONT_UI = "'DM Sans', sans-serif";
const SCALE = 2; // retina

// ── Helpers ──────────────────────────────────────────────────

function calcNodeWidth(name: string, title?: string): number {
  const nameChars = name.length;
  const titleChars = title ? title.length + 2 : 0;
  const contentChars = Math.max(nameChars, titleChars);
  const raw = contentChars * 8 + 28;
  return Math.min(Math.max(raw, 120), 220);
}

interface Box { x: number; y: number; w: number; h: number; }

interface FacePoints {
  sx: number; sy: number;
  tx: number; ty: number;
}

function getFacePoints(src: Box, tgt: Box): FacePoints {
  const srcCx = src.x + src.w / 2;
  const srcCy = src.y + src.h / 2;
  const tgtCx = tgt.x + tgt.w / 2;
  const tgtCy = tgt.y + tgt.h / 2;
  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > absDy * 1.3) {
    if (dx > 0) return { sx: src.x + src.w, sy: srcCy, tx: tgt.x, ty: tgtCy };
    else        return { sx: src.x, sy: srcCy, tx: tgt.x + tgt.w, ty: tgtCy };
  } else {
    if (dy > 0) return { sx: srcCx, sy: src.y + src.h, tx: tgtCx, ty: tgt.y };
    else        return { sx: srcCx, sy: src.y, tx: tgtCx, ty: tgt.y + tgt.h };
  }
}

interface OrthoResult {
  segments: [number, number][];   // list of [x,y] waypoints
  labelX: number;
  labelY: number;
}

function buildOrthoPath(sx: number, sy: number, tx: number, ty: number, forcedExitHorizontal?: boolean): OrthoResult {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);

  if (dy < 2) {
    return { segments: [[sx, sy], [tx, ty]], labelX: (sx + tx) / 2, labelY: sy - 1 };
  }
  if (dx < 2) {
    return { segments: [[sx, sy], [tx, ty]], labelX: sx + 14, labelY: (sy + ty) / 2 };
  }

  const exitHorizontal = forcedExitHorizontal ?? (Math.abs(tx - sx) > Math.abs(ty - sy) * 1.3);
  if (exitHorizontal) {
    const midX = (sx + tx) / 2;
    return {
      segments: [[sx, sy], [midX, sy], [midX, ty], [tx, ty]],
      labelX: (sx + midX) / 2,
      labelY: sy - 1,
    };
  } else {
    const midY = (sy + ty) / 2;
    return {
      segments: [[sx, sy], [sx, midY], [tx, midY], [tx, ty]],
      labelX: (sx + tx) / 2,
      labelY: midY - 1,
    };
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-10, -5);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Main export function ─────────────────────────────────────

export async function exportBookAsPng(
  book: BookData,
  visibleCharacterIds: Set<string>,
  showLabels: boolean,
  filename: string,
  hiddenCircleGroupIds?: Set<string>,
  circleOverlapStep = 14,
  circleGroupOrder: string[] = [],
  exportScale = SCALE,
  includeAnnotations = true,
): Promise<void> {
  // Compute all visible map content, including expanded circle outlines,
  // circle labels, arrowheads, and relationship label clearance.
  const visibleChars = book.characters.filter(c => visibleCharacterIds.has(c.id));
  if (visibleChars.length === 0) throw new Error('No visible characters to export.');

  const charWidths = new Map<string, number>();
  for (const c of visibleChars) {
    charWidths.set(c.id, calcNodeWidth(c.name, c.title));
  }

  const PADDING = 60;
  const safeBounds = calculateExportBounds(
    book,
    visibleCharacterIds,
    hiddenCircleGroupIds,
    circleOverlapStep,
    circleGroupOrder,
    showLabels,
    includeAnnotations,
  );
  const minX = safeBounds.minX;
  const minY = safeBounds.minY;
  const contentW = safeBounds.width + PADDING * 2;
  const contentH = safeBounds.height + PADDING * 2;

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(contentW * exportScale));
  canvas.height = Math.max(1, Math.ceil(contentH * exportScale));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Load the display font before drawing text so relationship labels and
  // character names are rasterised sharply rather than with a fallback face.
  try {
    const ff = new FontFace(
      'Playfair Display',
      "url(https://fonts.gstatic.com/s/playfairdisplay/v37/nuFiD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.woff2)",
    );
    await ff.load();
    document.fonts.add(ff);
    await document.fonts.ready;
  } catch {
    // Font loading is optional; the export remains usable with the serif fallback.
  }

  // ── Background ──────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, contentW, contentH);

  // Subtle dot grid
  ctx.fillStyle = '#2a3350';
  const gap = 28;
  for (let gx = 0; gx < contentW; gx += gap) {
    for (let gy = 0; gy < contentH; gy += gap) {
      ctx.beginPath();
      ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Offset: translate world coords → canvas coords
  const ox = -minX + PADDING;
  const oy = -minY + PADDING;

  // Build box map for edge routing
  const boxMap = new Map<string, Box>();
  for (const c of visibleChars) {
    const w = charWidths.get(c.id) ?? 140;
    boxMap.set(c.id, { x: c.x + ox, y: c.y + oy, w, h: NODE_H });
  }

  // ── Draw edges ──────────────────────────────────────────────
  const visibleRels = book.relationships.filter(
    r => visibleCharacterIds.has(r.sourceId) && visibleCharacterIds.has(r.targetId)
  );
  const allocatedRelationshipPorts = allocateRelationshipPorts(visibleRels, boxMap);

  for (const rel of visibleRels) {
    const src = boxMap.get(rel.sourceId);
    const tgt = boxMap.get(rel.targetId);
    if (!src || !tgt) continue;

    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = typeInfo.color;
    const fallback = getFacePoints(src, tgt);
    const allocated = allocatedRelationshipPorts.get(rel.id);
    const sx = allocated?.source?.x ?? fallback.sx;
    const sy = allocated?.source?.y ?? fallback.sy;
    const tx = allocated?.target?.x ?? fallback.tx;
    const ty = allocated?.target?.y ?? fallback.ty;
    const exitHorizontal = allocated?.source ? (allocated.source.side === 'left' || allocated.source.side === 'right') : undefined;
    const { segments, labelX, labelY } = buildOrthoPath(sx, sy, tx, ty, exitHorizontal);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.82;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.setLineDash(rel.uncertain ? [7, 4] : getFamilyCanvasDashArray(rel.type, rel.label, rel.notes));

    ctx.beginPath();
    ctx.moveTo(segments[0][0], segments[0][1]);
    for (let i = 1; i < segments.length; i++) {
      ctx.lineTo(segments[i][0], segments[i][1]);
    }
    ctx.stroke();
    ctx.restore();

    // Arrow at target end
    const last = segments[segments.length - 1];
    const prev = segments[segments.length - 2];
    const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    drawArrow(ctx, last[0], last[1], angle, color);

    // Arrow at source end for bidirectional
    if (rel.bidirectional) {
      const first = segments[0];
      const second = segments[1];
      const aAngle = Math.atan2(first[1] - second[1], first[0] - second[0]);
      drawArrow(ctx, first[0], first[1], aAngle, color);
    }

    // Label
    if (showLabels) {
      const labelText = rel.label || typeInfo.label;
      ctx.save();
      ctx.font = `bold 11px ${FONT_UI}`;
      const tw = ctx.measureText(labelText).width;
      const lx = labelX - tw / 2 - 6;
      const ly = labelY - 18;
      const lw = tw + 12;
      const lh = 18;

      // Label background pill
      ctx.fillStyle = '#0d1020e0';
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, lh, 4);
      ctx.fill();
      ctx.stroke();

      // Label text
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.fillText(labelText, lx + 6, ly + 12);
      ctx.restore();
    }
  }

  // ── Draw Hub-and-Spoke relationships ────────────────────────
  for (const hub of (book.hubRelationships ?? [])) {
    const srcBox = boxMap.get(hub.sourceId);
    if (!srcBox) continue;
    const tgtBoxes = hub.targetIds.map(id => boxMap.get(id)).filter(Boolean) as Box[];
    if (tgtBoxes.length === 0) continue;
    const typeInfo = RELATIONSHIP_TYPES[hub.type];
    const color = typeInfo.color;
    const labelText = hub.label || typeInfo.label;
    const srcCx = srcBox.x + srcBox.w / 2;
    const srcCy = srcBox.y + srcBox.h / 2;
    // Average target attachment
    const avgTX = tgtBoxes.reduce((s, b) => s + b.x + b.w / 2, 0) / tgtBoxes.length;
    const avgTY = tgtBoxes.reduce((s, b) => s + b.y + b.h / 2, 0) / tgtBoxes.length;
    const dxH = avgTX - srcCx, dyH = avgTY - srcCy;
    const exitH = Math.abs(dxH) > Math.abs(dyH) * 1.3;
    let sax: number, say: number;
    if (exitH) { sax = dxH > 0 ? srcBox.x + srcBox.w : srcBox.x; say = srcCy; }
    else { sax = srcCx; say = dyH > 0 ? srcBox.y + srcBox.h : srcBox.y; }
    // Target attachments
    const tgtAttach = tgtBoxes.map(tb => {
      const fp = getFacePoints(srcBox, tb);
      return { tx: fp.tx, ty: fp.ty };
    });
    const avgTA_X = tgtAttach.reduce((s, a) => s + a.tx, 0) / tgtAttach.length;
    const avgTA_Y = tgtAttach.reduce((s, a) => s + a.ty, 0) / tgtAttach.length;
    const jx = (sax + avgTA_X) / 2, jy = (say + avgTA_Y) / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.82;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    // Trunk
    ctx.beginPath();
    if (exitH) { ctx.moveTo(sax, say); ctx.lineTo(jx, say); ctx.lineTo(jx, jy); }
    else { ctx.moveTo(sax, say); ctx.lineTo(sax, jy); ctx.lineTo(jx, jy); }
    ctx.stroke();
    // Spokes
    for (const { tx, ty } of tgtAttach) {
      const dxS = tx - jx, dyS = ty - jy;
      const hS = Math.abs(dxS) > Math.abs(dyS);
      ctx.beginPath();
      if (hS) { ctx.moveTo(jx, jy); ctx.lineTo(tx, jy); ctx.lineTo(tx, ty); }
      else { ctx.moveTo(jx, jy); ctx.lineTo(jx, ty); ctx.lineTo(tx, ty); }
      ctx.stroke();
      drawArrow(ctx, tx, ty, Math.atan2(ty - jy, tx - jx), color);
    }
    // Junction dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(jx, jy, 3, 0, Math.PI * 2);
    ctx.fill();
    if (showLabels && labelText) {
      ctx.font = `bold 11px ${FONT_UI}`;
      const tw = ctx.measureText(labelText).width;
      const lx = (sax + jx) / 2 - tw / 2 - 6;
      const ly = say - 22;
      ctx.fillStyle = '#0d1020e0';
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 12, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.fillText(labelText, lx + 6, ly + 12);
    }
    ctx.restore();
  }

  // ── Draw Character-to-Group relationships ─────────────────────
  // ── Draw Converging relationships (multiple sources → one target) ──
  for (const rel of (book.convergingRelationships ?? [])) {
    const targetBox = boxMap.get(rel.targetId);
    const sourceBoxes = rel.sourceIds.map(id => boxMap.get(id)).filter(Boolean) as Box[];
    if (!targetBox || sourceBoxes.length < 2) continue;
    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = typeInfo.color;
    const averageSource = sourceBoxes.reduce((sum, box) => ({ x: sum.x + box.x + box.w / 2, y: sum.y + box.y + box.h / 2 }), { x: 0, y: 0 });
    averageSource.x /= sourceBoxes.length;
    averageSource.y /= sourceBoxes.length;
    const targetPair = getFacePoints({ x: averageSource.x, y: averageSource.y, w: 0, h: 0 }, targetBox);
    const targetPoint = { x: targetPair.tx, y: targetPair.ty };
    const sourcePoints = sourceBoxes.map(sourceBox => {
      const pair = getFacePoints(sourceBox, targetBox);
      return { x: pair.sx, y: pair.sy };
    });
    const averageAttach = sourcePoints.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    averageAttach.x /= sourcePoints.length;
    averageAttach.y /= sourcePoints.length;
    const junction = { x: (averageAttach.x + targetPoint.x) / 2, y: (averageAttach.y + targetPoint.y) / 2 };
    const lineStyle = rel.lineStyle ?? 'orthogonal';
    const drawPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      if (lineStyle === 'straight') ctx.lineTo(to.x, to.y);
      else if (lineStyle === 'curved') {
        const cpx = horizontal ? (from.x + to.x) / 2 : from.x;
        const cpy = horizontal ? from.y : (from.y + to.y) / 2;
        ctx.bezierCurveTo(cpx, cpy, cpx, cpy, to.x, to.y);
      } else if (horizontal) {
        ctx.lineTo((from.x + to.x) / 2, from.y);
        ctx.lineTo((from.x + to.x) / 2, to.y);
        ctx.lineTo(to.x, to.y);
      } else {
        ctx.lineTo(from.x, (from.y + to.y) / 2);
        ctx.lineTo(to.x, (from.y + to.y) / 2);
        ctx.lineTo(to.x, to.y);
      }
      ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.82;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    sourcePoints.forEach(point => drawPath(point, junction));
    drawPath(junction, targetPoint);
    ctx.restore();
    const horizontalTarget = Math.abs(targetPoint.x - junction.x) > Math.abs(targetPoint.y - junction.y);
    const arrowPrev = lineStyle === 'orthogonal'
      ? (horizontalTarget ? { x: (junction.x + targetPoint.x) / 2, y: targetPoint.y } : { x: targetPoint.x, y: (junction.y + targetPoint.y) / 2 })
      : junction;
    drawArrow(ctx, targetPoint.x, targetPoint.y, Math.atan2(targetPoint.y - arrowPrev.y, targetPoint.x - arrowPrev.x), color);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(junction.x, junction.y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (showLabels) {
      const labelText = rel.label || typeInfo.label;
      ctx.font = `bold 11px ${FONT_UI}`;
      const textWidth = ctx.measureText(labelText).width;
      const labelX = (junction.x + targetPoint.x) / 2 - textWidth / 2 - 6;
      const labelY = (junction.y + targetPoint.y) / 2 - 22;
      ctx.fillStyle = '#0d1020e0';
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(labelX, labelY, textWidth + 12, 18, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.fillText(labelText, labelX + 6, labelY + 12);
    }
    ctx.restore();
  }

  // ── Draw Family-unit relationships (partners → shared children) ──
  for (const rel of (book.familyUnitRelationships ?? [])) {
    const partners = rel.partnerIds.map(id => boxMap.get(id)).filter(Boolean) as Box[];
    const children = rel.childIds.map(id => boxMap.get(id)).filter(Boolean) as Box[];
    if (partners.length !== 2 || children.length === 0) continue;
    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = typeInfo.color;
    const pair = getFacePoints(partners[0], partners[1]);
    const partnerStart = { x: pair.sx, y: pair.sy };
    const partnerEnd = { x: pair.tx, y: pair.ty };
    const union = { x: (partnerStart.x + partnerEnd.x) / 2, y: (partnerStart.y + partnerEnd.y) / 2 };
    const childPoints = children.map(child => {
      const attach = getFacePoints({ x: union.x, y: union.y, w: 0, h: 0 }, child);
      return { x: attach.tx, y: attach.ty };
    });
    const averageChild = childPoints.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    averageChild.x /= childPoints.length; averageChild.y /= childPoints.length;
    const junction = { x: (union.x + averageChild.x) / 2, y: (union.y + averageChild.y) / 2 };
    const lineStyle = rel.lineStyle ?? 'orthogonal';
    const drawPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
      ctx.beginPath(); ctx.moveTo(from.x, from.y);
      if (lineStyle === 'straight') ctx.lineTo(to.x, to.y);
      else if (lineStyle === 'curved') { const cx = horizontal ? (from.x + to.x) / 2 : from.x; const cy = horizontal ? from.y : (from.y + to.y) / 2; ctx.bezierCurveTo(cx, cy, cx, cy, to.x, to.y); }
      else if (horizontal) { ctx.lineTo((from.x + to.x) / 2, from.y); ctx.lineTo((from.x + to.x) / 2, to.y); ctx.lineTo(to.x, to.y); }
      else { ctx.lineTo(from.x, (from.y + to.y) / 2); ctx.lineTo(to.x, (from.y + to.y) / 2); ctx.lineTo(to.x, to.y); }
      ctx.stroke();
    };
    ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = 0.84; ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(getFamilyCanvasDashArray(rel.type, rel.label, rel.notes));
    drawPath(partnerStart, partnerEnd); drawPath(union, junction); childPoints.forEach(point => drawPath(junction, point));
    ctx.restore();
    childPoints.forEach(point => drawArrow(ctx, point.x, point.y, Math.atan2(point.y - junction.y, point.x - junction.x), color));
    ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(union.x, union.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(junction.x, junction.y, 3, 0, Math.PI * 2); ctx.fill();
    if (showLabels) {
      const drawLabel = (text: string, x: number, y: number) => { ctx.font = `bold 11px ${FONT_UI}`; const width = ctx.measureText(text).width; ctx.fillStyle = '#0d1020e0'; ctx.strokeStyle = `${color}55`; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - width / 2 - 6, y - 14, width + 12, 18, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.fillText(text, x - width / 2, y - 2); };
      if (rel.partnerLabel) drawLabel(rel.partnerLabel, union.x, union.y);
      drawLabel(rel.label || 'parents of', (union.x + junction.x) / 2, (union.y + junction.y) / 2);
    }
    ctx.restore();
  }

  // ── Draw Character-to-Group relationships ─────────────────────
  const cgCircleRanks2 = new Map<string, number>();
  const allCGCircleIds = book.groups.filter(g => g.groupType === 'circle').map(g => g.id);
  const cgOrdered = [
    ...circleGroupOrder.filter(id => allCGCircleIds.includes(id)),
    ...allCGCircleIds.filter(id => !circleGroupOrder.includes(id)),
  ];
  cgOrdered.forEach((id, i) => cgCircleRanks2.set(id, i));
  const CG_BASE_PAD = 28;
  for (const rel of (book.groupRelationships ?? [])) {
    const srcBox = boxMap.get(rel.sourceId);
    const group = book.groups.find(g => g.id === rel.groupId && g.groupType === 'circle');
    if (!srcBox || !group) continue;
    if (hiddenCircleGroupIds?.has(group.id)) continue;
    const members = visibleChars.filter(c => c.groupIds?.includes(group.id));
    if (members.length === 0) continue;
    const rank = cgCircleRanks2.get(group.id) ?? 0;
    const totalPad = CG_BASE_PAD + rank * circleOverlapStep;
    let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
    for (const m of members) {
      const mw = charWidths.get(m.id) ?? 140;
      gMinX = Math.min(gMinX, m.x + ox - totalPad);
      gMinY = Math.min(gMinY, m.y + oy - totalPad);
      gMaxX = Math.max(gMaxX, m.x + ox + mw + totalPad);
      gMaxY = Math.max(gMaxY, m.y + oy + NODE_H + totalPad);
    }
    const rx = gMinX, ry = gMinY, rw = gMaxX - gMinX, rh = gMaxY - gMinY;
    const srcCx = srcBox.x + srcBox.w / 2, srcCy = srcBox.y + srcBox.h / 2;
    // Nearest point on rect
    const rcx = rx + rw / 2, rcy = ry + rh / 2;
    const ddx = srcCx - rcx, ddy = srcCy - rcy;
    const halfW = rw / 2, halfH = rh / 2;
    let tpx: number, tpy: number;
    if (Math.abs(ddx) / halfW > Math.abs(ddy) / halfH) {
      const sign = ddx > 0 ? 1 : -1;
      tpx = rcx + sign * halfW;
      tpy = rcy + ddy * (halfW / Math.abs(ddx));
      tpy = Math.max(ry, Math.min(ry + rh, tpy));
    } else {
      const sign = ddy > 0 ? 1 : -1;
      tpy = rcy + sign * halfH;
      tpx = rcx + ddx * (halfH / Math.abs(ddy));
      tpx = Math.max(rx, Math.min(rx + rw, tpx));
    }
    const dxCG = tpx - srcCx, dyCG = tpy - srcCy;
    const exitHCG = Math.abs(dxCG) > Math.abs(dyCG) * 1.3;
    let saxCG: number, sayCG: number;
    if (exitHCG) { saxCG = dxCG > 0 ? srcBox.x + srcBox.w : srcBox.x; sayCG = srcCy; }
    else { saxCG = srcCx; sayCG = dyCG > 0 ? srcBox.y + srcBox.h : srcBox.y; }
    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = typeInfo.color;
    const labelText = rel.label || typeInfo.label;
    const lineStyle = rel.lineStyle ?? 'orthogonal';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.82;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    const sx = saxCG, sy = sayCG, tx = tpx, ty = tpy;
    if (lineStyle === 'straight') {
      ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
    } else if (lineStyle === 'curved') {
      if (exitHCG) { const cpx = (sx + tx) / 2; ctx.moveTo(sx, sy); ctx.bezierCurveTo(cpx, sy, cpx, ty, tx, ty); }
      else { const cpy = (sy + ty) / 2; ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx, cpy, tx, cpy, tx, ty); }
    } else {
      const adx = Math.abs(tx - sx), ady = Math.abs(ty - sy);
      if (ady < 2 || adx < 2) { ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); }
      else if (exitHCG) { const midX = (sx + tx) / 2; ctx.moveTo(sx, sy); ctx.lineTo(midX, sy); ctx.lineTo(midX, ty); ctx.lineTo(tx, ty); }
      else { const midY = (sy + ty) / 2; ctx.moveTo(sx, sy); ctx.lineTo(sx, midY); ctx.lineTo(tx, midY); ctx.lineTo(tx, ty); }
    }
    ctx.stroke();
    drawArrow(ctx, tx, ty, Math.atan2(ty - sy, tx - sx), color);
    // Dot at boundary
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();
    if (showLabels && labelText) {
      ctx.font = `bold 11px ${FONT_UI}`;
      const tw2 = ctx.measureText(labelText).width;
      const lx2 = (sx + tx) / 2 - tw2 / 2 - 6;
      const ly2 = (sy + ty) / 2 - 22;
      ctx.fillStyle = '#0d1020e0';
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx2, ly2, tw2 + 12, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.fillText(labelText, lx2 + 6, ly2 + 12);
    }
    ctx.restore();
  }

  // ── Draw Circle group outlines (respects hidden circles + concentric offsets) ──────────
  const BASE_CIRCLE_PAD = 28;
  const visibleCircleGroups = book.groups.filter(
    g => g.groupType === 'circle' && !(hiddenCircleGroupIds?.has(g.id))
  );
  // Compute base bboxes for overlap-rank assignment
  type CBBox = { minX: number; minY: number; maxX: number; maxY: number };
  const circleBBoxes = new Map<string, CBBox>();
  for (const group of visibleCircleGroups) {
    const members = visibleChars.filter(c => c.groupIds?.includes(group.id));
    if (members.length === 0) continue;
    let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
    for (const m of members) {
      const mw = charWidths.get(m.id) ?? 140;
      bMinX = Math.min(bMinX, m.x); bMinY = Math.min(bMinY, m.y);
      bMaxX = Math.max(bMaxX, m.x + mw); bMaxY = Math.max(bMaxY, m.y + NODE_H);
    }
    if (isFinite(bMinX)) circleBBoxes.set(group.id, { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY });
  }
  // User-defined concentric order: circleGroupOrder[0] = innermost (rank 0)
  const circleRanks = new Map<string, number>();
  const allCircleIds = book.groups.filter(g => g.groupType === 'circle').map(g => g.id);
  const orderedForExport = [
    ...circleGroupOrder.filter(id => allCircleIds.includes(id)),
    ...allCircleIds.filter(id => !circleGroupOrder.includes(id)),
  ];
  orderedForExport.forEach((id, index) => circleRanks.set(id, index));
  for (const group of visibleCircleGroups) {
    const members = visibleChars.filter(c => c.groupIds?.includes(group.id));
    if (members.length === 0) continue;
    const rank = circleRanks.get(group.id) ?? 0;
    const CIRCLE_PAD = BASE_CIRCLE_PAD + rank * circleOverlapStep;
    let cMinX = Infinity, cMinY = Infinity, cMaxX = -Infinity, cMaxY = -Infinity;
    for (const m of members) {
      const mw = charWidths.get(m.id) ?? 140;
      cMinX = Math.min(cMinX, m.x + ox - CIRCLE_PAD);
      cMinY = Math.min(cMinY, m.y + oy - CIRCLE_PAD);
      cMaxX = Math.max(cMaxX, m.x + ox + mw + CIRCLE_PAD);
      cMaxY = Math.max(cMaxY, m.y + oy + NODE_H + CIRCLE_PAD);
    }
    const cW = cMaxX - cMinX, cH = cMaxY - cMinY;
    ctx.save();
    ctx.strokeStyle = group.color;
    ctx.lineWidth = 2;
    const strokeStyle = group.strokeStyle ?? 'dashed';
    ctx.setLineDash(
      strokeStyle === 'solid' ? [] :
      strokeStyle === 'dotted' ? [2, 5] :
      [10, 6]
    );
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.roundRect(cMinX, cMinY, cW, cH, 18);
    ctx.stroke();
    // Label pill
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.font = `bold 11px ${FONT_UI}`;
    const labelW = ctx.measureText(group.name).width + 16;
    const labelH = 18;
    const labelX = cMinX + 16;
    const labelY = cMinY - labelH / 2;
    ctx.fillStyle = BG;
    ctx.strokeStyle = group.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, labelH, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = group.color;
    ctx.fillText(group.name, labelX + 8, labelY + 12);
    ctx.restore();
  }
  // ── Draw nodes ──────────────────────────────────────────────

  for (const c of visibleChars) {
    const box = boxMap.get(c.id)!;
    const group = c.groupIds && c.groupIds.length > 0
      ? book.groups.find(g => c.groupIds!.includes(g.id))
      : undefined;
    const ringColor = c.color || group?.color || '#c9a84c';
    const { x, y, w, h } = box;

    ctx.save();

    // Node background
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#1c2238');
    grad.addColorStop(1, '#161d2e');
    ctx.fillStyle = grad;
    ctx.strokeStyle = `${ringColor}60`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Left accent bar
    ctx.fillStyle = ringColor;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.roundRect(x, y + 5, 3, h - 10, [0, 2, 2, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Title badge (top-right)
    if (c.title) {
      ctx.font = `600 8px ${FONT_UI}`;
      ctx.fillStyle = `${ringColor}99`;
      ctx.fillText(c.title.toUpperCase(), x + w - ctx.measureText(c.title.toUpperCase()).width - 7, y + 13);
    }

    // Character name
    const nameFontSize = c.name.length > 20 ? 11 : c.name.length > 14 ? 12 : 13;
    ctx.font = `600 ${nameFontSize}px ${FONT_TITLE}`;
    ctx.fillStyle = '#e8e0d0';
    const nameW = ctx.measureText(c.name).width;
    ctx.fillText(c.name, x + w / 2 - nameW / 2 + 4, y + h / 2 + 4);

    // Gender symbol
    const GENDER_ICONS: Record<string, string> = { male: '♂', female: '♀', 'non-binary': '⚧', unknown: '' };
    const gIcon = GENDER_ICONS[c.gender] || '';
    if (gIcon) {
      ctx.font = `9px ${FONT_UI}`;
      ctx.fillStyle = `${ringColor}77`;
      const gW = ctx.measureText(gIcon).width;
      ctx.fillText(gIcon, x + w / 2 - gW / 2 + 4, y + h / 2 + 16);
    }

    ctx.restore();
  }

  // ── Draw annotations above the map ───────────────────────────
  if (includeAnnotations) drawExportAnnotations(ctx, book, visibleCharacterIds, boxMap, ox, oy, 'dark');

  // ── Book title watermark ─────────────────────────────────────
  if (book.title) {
    ctx.save();
    ctx.font = `italic 13px ${FONT_TITLE}`;
    ctx.fillStyle = '#c9a84c40';
    ctx.fillText(`${book.title}${book.author ? ` · ${book.author}` : ''}`, 16, contentH - 12);
    ctx.restore();
  }

  // ── Download ─────────────────────────────────────────────────
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
