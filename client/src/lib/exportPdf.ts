// ============================================================
// exportPdf — reMarkable-optimised PDF exporter
// Renders the character map onto an HTML5 canvas in a clean
// white/light-grey print theme, then wraps it in a jsPDF page.
// High-contrast black-on-white for e-ink readability.
//
// Public API:
//   renderPdfCanvas(book, visibleIds, showLabels, showLegend)
//     → Promise<HTMLCanvasElement>   (for preview)
//   downloadPdfFromCanvas(canvas, filename, contentW, contentH)
//     → void                         (wraps into PDF and saves)
//   exportBookAsPdf(...)             (convenience: render + download)
// ============================================================
import { jsPDF } from 'jspdf';
import type { AnnotationLayer, BookData } from './types';
import { RELATIONSHIP_TYPES } from './types';
import { calculateExportBounds } from './exportGeometry';
import { allocateRelationshipPorts } from './relationshipPorts';
import { getFamilyCanvasDashArray } from './familyLineStyles';
import { drawExportAnnotations } from './annotationExport';
import { appendResearchPacket, DEFAULT_PDF_PACKET_SECTIONS, type PdfCitationStyle, type PdfPacketSections } from './pdfResearchPacket';

// ── Print theme colours ──────────────────────────────────────
const BG          = '#ffffff';
const DOT_COLOR   = '#e0e0e0';
const NODE_BG     = '#ffffff';
const NODE_BORDER = '#1a1a1a';
const NODE_TEXT   = '#000000';
const TITLE_TEXT  = '#333333';
const LABEL_BG    = '#ffffffee';
const WATERMARK   = '#bbbbbb';

const NODE_H      = 36;
const FONT_TITLE  = "'Playfair Display', serif";
const FONT_UI     = "'DM Sans', sans-serif";
const SCALE       = 4; // high DPI for crisp PDF embedding
const MAX_RENDER_DIMENSION = 12000;

// ── Helpers ──────────────────────────────────────────────────

function calcNodeWidth(name: string, title?: string): number {
  const nameChars = name.length;
  const titleChars = title ? title.length + 2 : 0;
  const contentChars = Math.max(nameChars, titleChars);
  const raw = contentChars * 8 + 28;
  return Math.min(Math.max(raw, 120), 220);
}

interface Box { x: number; y: number; w: number; h: number; }
type PortSide = 'top' | 'right' | 'bottom' | 'left';
interface FacePoints { sx: number; sy: number; tx: number; ty: number; sourceSide: PortSide; targetSide: PortSide; }
interface PathRenderResult { labelX: number; labelY: number; sourceAngle: number; targetAngle: number; }

function getFacePoints(src: Box, tgt: Box): FacePoints {
  const srcCx = src.x + src.w / 2, srcCy = src.y + src.h / 2;
  const tgtCx = tgt.x + tgt.w / 2, tgtCy = tgt.y + tgt.h / 2;
  const dx = tgtCx - srcCx, dy = tgtCy - srcCy;
  if (Math.abs(dx) > Math.abs(dy) * 1.3) {
    if (dx > 0) return { sx: src.x + src.w, sy: srcCy, tx: tgt.x, ty: tgtCy, sourceSide: 'right', targetSide: 'left' };
    else        return { sx: src.x, sy: srcCy, tx: tgt.x + tgt.w, ty: tgtCy, sourceSide: 'left', targetSide: 'right' };
  } else {
    if (dy > 0) return { sx: srcCx, sy: src.y + src.h, tx: tgtCx, ty: tgt.y, sourceSide: 'bottom', targetSide: 'top' };
    else        return { sx: srcCx, sy: src.y, tx: tgtCx, ty: tgt.y + tgt.h, sourceSide: 'top', targetSide: 'bottom' };
  }
}

function sideVector(side: PortSide) {
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function drawRelationshipPath(ctx: CanvasRenderingContext2D, style: string | undefined, sx: number, sy: number, tx: number, ty: number, sourceSide: PortSide, targetSide: PortSide, manualWaypoints: Array<{ x: number; y: number }> = []): PathRenderResult {
  const sourceVector = sideVector(sourceSide);
  const targetVector = sideVector(targetSide);
  const sourceAngle = Math.atan2(sourceVector.y, sourceVector.x);
  const targetAngle = Math.atan2(targetVector.y, targetVector.x);
  const lineStyle = style ?? 'orthogonal';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  if (manualWaypoints.length > 0) {
    const lead = 20;
    const start = { x: sx + sourceVector.x * lead, y: sy + sourceVector.y * lead };
    const end = { x: tx + targetVector.x * lead, y: ty + targetVector.y * lead };
    const sourceHorizontal = sourceVector.x !== 0;
    const targetHorizontal = targetVector.x !== 0;
    ctx.lineTo(start.x, start.y);
    let current = start;
    let horizontalFirst = sourceHorizontal;
    for (const waypoint of manualWaypoints) {
      if (horizontalFirst) ctx.lineTo(waypoint.x, current.y);
      else ctx.lineTo(current.x, waypoint.y);
      ctx.lineTo(waypoint.x, waypoint.y);
      current = waypoint;
      horizontalFirst = !horizontalFirst;
    }
    if (targetHorizontal) ctx.lineTo(end.x, current.y);
    else ctx.lineTo(current.x, end.y);
    ctx.lineTo(end.x, end.y); ctx.lineTo(tx, ty);
    const labelWaypoint = manualWaypoints[Math.floor(manualWaypoints.length / 2)];
    return { labelX: labelWaypoint.x, labelY: labelWaypoint.y - 10, sourceAngle, targetAngle };
  }
  if (lineStyle === 'curved') {
    const tension = Math.max(44, Math.min(150, Math.hypot(tx - sx, ty - sy) * 0.42));
    const c1x = sx + sourceVector.x * tension, c1y = sy + sourceVector.y * tension;
    const c2x = tx + targetVector.x * tension, c2y = ty + targetVector.y * tension;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
    return { labelX: (sx + tx) / 2 + (c1x + c2x - sx - tx) * 0.15, labelY: (sy + ty) / 2 + (c1y + c2y - sy - ty) * 0.15 - 10, sourceAngle, targetAngle };
  }
  const lead = lineStyle === 'straight' ? 12 : 20;
  const start = { x: sx + sourceVector.x * lead, y: sy + sourceVector.y * lead };
  const end = { x: tx + targetVector.x * lead, y: ty + targetVector.y * lead };
  if (lineStyle === 'straight') {
    ctx.lineTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.lineTo(tx, ty);
    return { labelX: (sx + tx) / 2, labelY: (sy + ty) / 2 - 10, sourceAngle, targetAngle };
  }
  const sourceHorizontal = sourceVector.x !== 0;
  const targetHorizontal = targetVector.x !== 0;
  ctx.lineTo(start.x, start.y);
  if (sourceHorizontal && targetHorizontal) {
    const midX = (start.x + end.x) / 2;
    ctx.lineTo(midX, start.y); ctx.lineTo(midX, end.y);
  } else if (!sourceHorizontal && !targetHorizontal) {
    const midY = (start.y + end.y) / 2;
    ctx.lineTo(start.x, midY); ctx.lineTo(end.x, midY);
  } else if (sourceHorizontal) ctx.lineTo(end.x, start.y);
  else ctx.lineTo(start.x, end.y);
  ctx.lineTo(end.x, end.y); ctx.lineTo(tx, ty);
  return { labelX: (sx + tx) / 2, labelY: (sy + ty) / 2 - 8, sourceAngle, targetAngle };
}

function darkenColor(hex: string): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.55);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.55);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.55);
  return `rgb(${r},${g},${b})`;
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-9, -4);
  ctx.lineTo(-9, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Render to canvas ─────────────────────────────────────────

export interface RenderPdfCanvasResult {
  canvas: HTMLCanvasElement;
  contentW: number;
  contentH: number;
}

export async function renderPdfCanvas(
  book: BookData,
  visibleCharacterIds: Set<string>,
  showLabels: boolean,
  showLegend: boolean,
  hiddenCircleGroupIds?: Set<string>,
  circleOverlapStep = 14,
  circleGroupOrder: string[] = [],
  includeAnnotations = true,
  visibleAnnotationLayers?: AnnotationLayer[],
): Promise<RenderPdfCanvasResult> {
  const visibleChars = book.characters.filter(c => visibleCharacterIds.has(c.id));
  if (visibleChars.length === 0) throw new Error('No visible characters to export.');

  const charWidths = new Map<string, number>();
  for (const c of visibleChars) charWidths.set(c.id, calcNodeWidth(c.name, c.title));

  const PADDING = 76;
  const HEADER_H = 56;
  const LEGEND_H = showLegend ? 36 : 0;
  const safeBounds = calculateExportBounds(
    book,
    visibleCharacterIds,
    hiddenCircleGroupIds,
    circleOverlapStep,
    circleGroupOrder,
    showLabels,
    includeAnnotations,
    visibleAnnotationLayers,
  );
  const minX = safeBounds.minX;
  const minY = safeBounds.minY;
  const contentW = safeBounds.width + PADDING * 2;
  const contentH = safeBounds.height + PADDING * 2 + HEADER_H + LEGEND_H;

  // Prefer 4× detail for print, but reduce the scale for unusually large maps
  // so the browser never creates an unreliable oversized offscreen canvas.
  const renderScale = Math.max(
    1,
    Math.min(SCALE, Math.floor(MAX_RENDER_DIMENSION / Math.max(contentW, contentH))),
  );
  const canvas = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.ceil(contentW * renderScale));
  canvas.height = Math.max(1, Math.ceil(contentH * renderScale));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, contentW, contentH);

  // Dot grid
  ctx.fillStyle = DOT_COLOR;
  const gap = 24;
  for (let gx = 0; gx < contentW; gx += gap)
    for (let gy = HEADER_H; gy < contentH - LEGEND_H; gy += gap) {
      ctx.beginPath(); ctx.arc(gx, gy, 0.6, 0, Math.PI * 2); ctx.fill();
    }

  // Header gold rule
  ctx.fillStyle = '#c9a84c';
  ctx.fillRect(PADDING, HEADER_H - 2, contentW - PADDING * 2, 1.5);

  // Load Playfair Display
  try {
    const ff = new FontFace('Playfair Display',
      "url(https://fonts.gstatic.com/s/playfairdisplay/v37/nuFiD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.woff2)");
    await ff.load();
    document.fonts.add(ff);
    await document.fonts.ready;
  } catch { /* fall back */ }

  // Book title
  if (book.title) {
    ctx.save();
    ctx.font = `700 22px ${FONT_TITLE}`;
    ctx.fillStyle = TITLE_TEXT;
    ctx.fillText(book.title, PADDING, HEADER_H - 14);
    if (book.author) {
      ctx.font = `400 13px ${FONT_UI}`;
      ctx.fillStyle = '#666666';
      const titleW = ctx.measureText(book.title).width;
      ctx.fillText(`by ${book.author}`, PADDING + titleW + 14, HEADER_H - 14);
    }
    ctx.restore();
  }

  // Character count
  const visibleRels = book.relationships.filter(
    r => visibleCharacterIds.has(r.sourceId) && visibleCharacterIds.has(r.targetId)
  );
  ctx.save();
  ctx.font = `400 10px ${FONT_UI}`;
  ctx.fillStyle = WATERMARK;
  ctx.fillText(`${visibleChars.length} characters · ${visibleRels.length} relationships`, PADDING, HEADER_H - 2);
  ctx.restore();

  // Offsets
  const ox = -minX + PADDING;
  const oy = -minY + PADDING + HEADER_H;

  const boxMap = new Map<string, Box>();
  for (const c of visibleChars) {
    const w = charWidths.get(c.id) ?? 140;
    boxMap.set(c.id, { x: c.x + ox, y: c.y + oy, w, h: NODE_H });
  }
  const allocatedRelationshipPorts = allocateRelationshipPorts(visibleRels, boxMap);

  // Draw edges
  for (const rel of visibleRels) {
    const src = boxMap.get(rel.sourceId), tgt = boxMap.get(rel.targetId);
    if (!src || !tgt) continue;
    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = darkenColor(typeInfo.color);
    const fallback = getFacePoints(src, tgt);
    const allocated = allocatedRelationshipPorts.get(rel.id);
    const sx = allocated?.source?.x ?? fallback.sx;
    const sy = allocated?.source?.y ?? fallback.sy;
    const tx = allocated?.target?.x ?? fallback.tx;
    const ty = allocated?.target?.y ?? fallback.ty;
    const sourceSide = allocated?.source?.side ?? fallback.sourceSide;
    const targetSide = allocated?.target?.side ?? fallback.targetSide;

    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.0; // thicker lines for e-ink
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(rel.uncertain ? [6, 4] : getFamilyCanvasDashArray(rel.type, rel.label, rel.notes));
    const manualWaypoints = (rel.manualWaypoints ?? []).map(point => ({ x: point.x + ox, y: point.y + oy }));
    const path = drawRelationshipPath(ctx, rel.lineStyle, sx, sy, tx, ty, sourceSide, targetSide, manualWaypoints);
    ctx.stroke();
    ctx.restore();

    drawArrow(ctx, tx, ty, path.targetAngle, color);
    if (rel.bidirectional) {
      drawArrow(ctx, sx, sy, path.sourceAngle + Math.PI, color);
    }

    if (showLabels) {
      const labelText = rel.label || typeInfo.label;
      ctx.save();
      ctx.font = `bold 11px ${FONT_UI}`;
      const tw = ctx.measureText(labelText).width;
      const lx = path.labelX - tw / 2 - 5, ly = path.labelY - 17, lw = tw + 10, lh = 16;
      ctx.fillStyle = LABEL_BG; ctx.strokeStyle = color; ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(labelText, lx + 5, ly + 11);
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
    const color = darkenColor(typeInfo.color);
    const labelText = hub.label || typeInfo.label;
    const srcCx = srcBox.x + srcBox.w / 2, srcCy = srcBox.y + srcBox.h / 2;
    const avgTX = tgtBoxes.reduce((s, b) => s + b.x + b.w / 2, 0) / tgtBoxes.length;
    const avgTY = tgtBoxes.reduce((s, b) => s + b.y + b.h / 2, 0) / tgtBoxes.length;
    const dxH = avgTX - srcCx, dyH = avgTY - srcCy;
    const exitH = Math.abs(dxH) > Math.abs(dyH) * 1.3;
    let sax: number, say: number;
    if (exitH) { sax = dxH > 0 ? srcBox.x + srcBox.w : srcBox.x; say = srcCy; }
    else { sax = srcCx; say = dyH > 0 ? srcBox.y + srcBox.h : srcBox.y; }
    const tgtAttach = tgtBoxes.map(tb => { const fp = getFacePoints(srcBox, tb); return { tx: fp.tx, ty: fp.ty }; });
    const avgTA_X = tgtAttach.reduce((s, a) => s + a.tx, 0) / tgtAttach.length;
    const avgTA_Y = tgtAttach.reduce((s, a) => s + a.ty, 0) / tgtAttach.length;
    const jx = hub.manualWaypoints?.[0] ? hub.manualWaypoints[0].x + ox : (sax + avgTA_X) / 2;
    const jy = hub.manualWaypoints?.[0] ? hub.manualWaypoints[0].y + oy : (say + avgTA_Y) / 2;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.0; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    ctx.beginPath();
    if (exitH) { ctx.moveTo(sax, say); ctx.lineTo(jx, say); ctx.lineTo(jx, jy); }
    else { ctx.moveTo(sax, say); ctx.lineTo(sax, jy); ctx.lineTo(jx, jy); }
    ctx.stroke();
    for (const { tx, ty } of tgtAttach) {
      const dxS = tx - jx, dyS = ty - jy;
      const hS = Math.abs(dxS) > Math.abs(dyS);
      ctx.beginPath();
      if (hS) { ctx.moveTo(jx, jy); ctx.lineTo(tx, jy); ctx.lineTo(tx, ty); }
      else { ctx.moveTo(jx, jy); ctx.lineTo(jx, ty); ctx.lineTo(tx, ty); }
      ctx.stroke();
      drawArrow(ctx, tx, ty, Math.atan2(ty - jy, tx - jx), color);
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(jx, jy, 3, 0, Math.PI * 2); ctx.fill();
    if (showLabels && labelText) {
      ctx.font = `bold 11px ${FONT_UI}`;
      const tw = ctx.measureText(labelText).width;
      const lx = (sax + jx) / 2 - tw / 2 - 5, ly = say - 20;
      ctx.fillStyle = LABEL_BG; ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.setLineDash([]);
      ctx.beginPath(); ctx.roundRect(lx, ly, tw + 10, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.fillText(labelText, lx + 5, ly + 11);
    }
    ctx.restore();
  }

  // ── Draw Converging relationships (multiple sources → one target) ──
  for (const rel of (book.convergingRelationships ?? [])) {
    const targetBox = boxMap.get(rel.targetId);
    const sourceBoxes = rel.sourceIds.map(id => boxMap.get(id)).filter(Boolean) as Box[];
    if (!targetBox || sourceBoxes.length < 2) continue;
    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = darkenColor(typeInfo.color);
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
    ctx.strokeStyle = color; ctx.lineWidth = 2.0; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    sourcePoints.forEach(point => drawPath(point, junction));
    drawPath(junction, targetPoint);
    ctx.restore();
    const horizontalTarget = Math.abs(targetPoint.x - junction.x) > Math.abs(targetPoint.y - junction.y);
    const arrowPrev = lineStyle === 'orthogonal'
      ? (horizontalTarget ? { x: (junction.x + targetPoint.x) / 2, y: targetPoint.y } : { x: targetPoint.x, y: (junction.y + targetPoint.y) / 2 })
      : junction;
    drawArrow(ctx, targetPoint.x, targetPoint.y, Math.atan2(targetPoint.y - arrowPrev.y, targetPoint.x - arrowPrev.x), color);
    ctx.save();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(junction.x, junction.y, 3, 0, Math.PI * 2); ctx.fill();
    if (showLabels) {
      const labelText = rel.label || typeInfo.label;
      ctx.font = `bold 11px ${FONT_UI}`;
      const textWidth = ctx.measureText(labelText).width;
      const labelX = (junction.x + targetPoint.x) / 2 - textWidth / 2 - 5;
      const labelY = (junction.y + targetPoint.y) / 2 - 20;
      ctx.fillStyle = LABEL_BG; ctx.strokeStyle = color; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(labelX, labelY, textWidth + 10, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.fillText(labelText, labelX + 5, labelY + 11);
    }
    ctx.restore();
  }

  // ── Draw Family-unit relationships (partners → shared children) ──
  for (const rel of (book.familyUnitRelationships ?? [])) {
    const partners = rel.partnerIds.map(id => boxMap.get(id)).filter(Boolean) as Box[];
    const children = rel.childIds.map(id => boxMap.get(id)).filter(Boolean) as Box[];
    if (partners.length !== 2 || children.length === 0) continue;
    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = darkenColor(typeInfo.color);
    const pair = getFacePoints(partners[0], partners[1]);
    const partnerStart = { x: pair.sx, y: pair.sy }, partnerEnd = { x: pair.tx, y: pair.ty };
    const union = { x: (partnerStart.x + partnerEnd.x) / 2, y: (partnerStart.y + partnerEnd.y) / 2 };
    const childPoints = children.map(child => { const attach = getFacePoints({ x: union.x, y: union.y, w: 0, h: 0 }, child); return { x: attach.tx, y: attach.ty }; });
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
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(getFamilyCanvasDashArray(rel.type, rel.label, rel.notes));
    drawPath(partnerStart, partnerEnd); drawPath(union, junction); childPoints.forEach(point => drawPath(junction, point));
    ctx.restore();
    childPoints.forEach(point => drawArrow(ctx, point.x, point.y, Math.atan2(point.y - junction.y, point.x - junction.x), color));
    ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(union.x, union.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(junction.x, junction.y, 3, 0, Math.PI * 2); ctx.fill();
    if (showLabels) {
      const drawLabel = (text: string, x: number, y: number) => { ctx.font = `bold 11px ${FONT_UI}`; const width = ctx.measureText(text).width; ctx.fillStyle = LABEL_BG; ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.roundRect(x - width / 2 - 5, y - 13, width + 10, 16, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.fillText(text, x - width / 2, y - 2); };
      if (rel.partnerLabel) drawLabel(rel.partnerLabel, union.x, union.y);
      drawLabel(rel.label || 'parents of', (union.x + junction.x) / 2, (union.y + junction.y) / 2);
    }
    ctx.restore();
  }

  // ── Draw Character-to-Group relationships ─────────────────────
  const cgRanksPdf = new Map<string, number>();
  const allCGIdsPdf = book.groups.filter(g => g.groupType === 'circle').map(g => g.id);
  const cgOrderedPdf = [
    ...circleGroupOrder.filter(id => allCGIdsPdf.includes(id)),
    ...allCGIdsPdf.filter(id => !circleGroupOrder.includes(id)),
  ];
  cgOrderedPdf.forEach((id, i) => cgRanksPdf.set(id, i));
  const CG_BASE_PAD_PDF = 28;
  for (const rel of (book.groupRelationships ?? [])) {
    const srcBox = boxMap.get(rel.sourceId);
    const group = book.groups.find(g => g.id === rel.groupId && g.groupType === 'circle');
    if (!srcBox || !group) continue;
    if (hiddenCircleGroupIds?.has(group.id)) continue;
    const members = visibleChars.filter(c => c.groupIds?.includes(group.id));
    if (members.length === 0) continue;
    const rank = cgRanksPdf.get(group.id) ?? 0;
    const totalPad = CG_BASE_PAD_PDF + rank * circleOverlapStep;
    let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
    for (const m of members) {
      const mw = charWidths.get(m.id) ?? 140;
      gMinX = Math.min(gMinX, m.x + ox - totalPad); gMinY = Math.min(gMinY, m.y + oy - totalPad);
      gMaxX = Math.max(gMaxX, m.x + ox + mw + totalPad); gMaxY = Math.max(gMaxY, m.y + oy + NODE_H + totalPad);
    }
    const rx = gMinX, ry = gMinY, rw = gMaxX - gMinX, rh = gMaxY - gMinY;
    const srcCx = srcBox.x + srcBox.w / 2, srcCy = srcBox.y + srcBox.h / 2;
    const rcx = rx + rw / 2, rcy = ry + rh / 2;
    const ddx = srcCx - rcx, ddy = srcCy - rcy;
    const halfW = rw / 2, halfH = rh / 2;
    let tpx: number, tpy: number;
    if (Math.abs(ddx) / halfW > Math.abs(ddy) / halfH) {
      const sign = ddx > 0 ? 1 : -1;
      tpx = rcx + sign * halfW; tpy = rcy + ddy * (halfW / Math.abs(ddx));
      tpy = Math.max(ry, Math.min(ry + rh, tpy));
    } else {
      const sign = ddy > 0 ? 1 : -1;
      tpy = rcy + sign * halfH; tpx = rcx + ddx * (halfH / Math.abs(ddy));
      tpx = Math.max(rx, Math.min(rx + rw, tpx));
    }
    const dxCG = tpx - srcCx, dyCG = tpy - srcCy;
    const exitHCG = Math.abs(dxCG) > Math.abs(dyCG) * 1.3;
    let saxCG: number, sayCG: number;
    if (exitHCG) { saxCG = dxCG > 0 ? srcBox.x + srcBox.w : srcBox.x; sayCG = srcCy; }
    else { saxCG = srcCx; sayCG = dyCG > 0 ? srcBox.y + srcBox.h : srcBox.y; }
    const typeInfo = RELATIONSHIP_TYPES[rel.type];
    const color = darkenColor(typeInfo.color);
    const labelText = rel.label || typeInfo.label;
    const lineStyle = rel.lineStyle ?? 'orthogonal';
    const sx = saxCG, sy = sayCG, tx = tpx, ty = tpy;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.0; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    ctx.beginPath();
    const manualWaypoint = rel.manualWaypoints?.[0] ? { x: rel.manualWaypoints[0].x + ox, y: rel.manualWaypoints[0].y + oy } : null;
    if (manualWaypoint) {
      ctx.moveTo(sx, sy); ctx.lineTo(manualWaypoint.x, sy); ctx.lineTo(manualWaypoint.x, manualWaypoint.y); ctx.lineTo(tx, manualWaypoint.y); ctx.lineTo(tx, ty);
    } else if (lineStyle === 'straight') {
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
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
    if (showLabels && labelText) {
      ctx.font = `bold 11px ${FONT_UI}`;
      const tw2 = ctx.measureText(labelText).width;
      const lx2 = (sx + tx) / 2 - tw2 / 2 - 5, ly2 = (sy + ty) / 2 - 20;
      ctx.fillStyle = LABEL_BG; ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.setLineDash([]);
      ctx.beginPath(); ctx.roundRect(lx2, ly2, tw2 + 10, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.fillText(labelText, lx2 + 5, ly2 + 11);
    }
    ctx.restore();
  }

  // Draw Circle group outlines (respects hidden circles + concentric offsets)
  const BASE_CIRCLE_PAD = 28;
  const visibleCircleGroups = book.groups.filter(
    g => g.groupType === 'circle' && !(hiddenCircleGroupIds?.has(g.id))
  );
  type CBBox2 = { minX: number; minY: number; maxX: number; maxY: number };
  const circleBBoxes2 = new Map<string, CBBox2>();
  for (const group of visibleCircleGroups) {
    const members = visibleChars.filter(c => c.groupIds?.includes(group.id));
    if (members.length === 0) continue;
    let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
    for (const m of members) {
      const mw = charWidths.get(m.id) ?? 140;
      bMinX = Math.min(bMinX, m.x); bMinY = Math.min(bMinY, m.y);
      bMaxX = Math.max(bMaxX, m.x + mw); bMaxY = Math.max(bMaxY, m.y + NODE_H);
    }
    if (isFinite(bMinX)) circleBBoxes2.set(group.id, { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY });
  }
  // User-defined concentric order: circleGroupOrder[0] = innermost (rank 0)
  const circleRanks2 = new Map<string, number>();
  const allCircleIdsPdf = book.groups.filter(g => g.groupType === 'circle').map(g => g.id);
  const orderedForPdf = [
    ...circleGroupOrder.filter(id => allCircleIdsPdf.includes(id)),
    ...allCircleIdsPdf.filter(id => !circleGroupOrder.includes(id)),
  ];
  orderedForPdf.forEach((id, index) => circleRanks2.set(id, index));
  for (const group of visibleCircleGroups) {
    const members = visibleChars.filter(c => c.groupIds?.includes(group.id));
    if (members.length === 0) continue;
    const rank = circleRanks2.get(group.id) ?? 0;
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
    const outlineColor = darkenColor(group.color);
    ctx.save();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    const strokeStylePdf = group.strokeStyle ?? 'dashed';
    ctx.setLineDash(
      strokeStylePdf === 'solid' ? [] :
      strokeStylePdf === 'dotted' ? [2, 5] :
      [10, 6]
    );
    ctx.globalAlpha = 0.85;
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
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, labelH, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = outlineColor;
    ctx.fillText(group.name, labelX + 8, labelY + 12);
    ctx.restore();
  }
  // Draw nodes
  for (const c of visibleChars) {
    const box = boxMap.get(c.id)!;
    const group = c.groupIds?.length ? book.groups.find(g => c.groupIds!.includes(g.id)) : undefined;
    const accentColor = darkenColor(c.color || group?.color || '#c9a84c');
    const { x, y, w, h } = box;

    ctx.save();
    // White fill with bold black border for crisp e-ink rendering
    ctx.fillStyle = NODE_BG; ctx.strokeStyle = NODE_BORDER; ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();

    // Thicker accent bar (5px) for visibility on e-ink
    ctx.fillStyle = accentColor;
    ctx.beginPath(); ctx.roundRect(x, y + 6, 5, h - 12, [0, 3, 3, 0]); ctx.fill();

    if (c.title) {
      ctx.font = `700 8px ${FONT_UI}`; ctx.fillStyle = '#444444';
      ctx.fillText(c.title.toUpperCase(), x + w - ctx.measureText(c.title.toUpperCase()).width - 9, y + 13);
    }

    // Bold, larger name text for crisp e-ink reading
    const nameFontSize = c.name.length > 20 ? 12 : c.name.length > 14 ? 13 : 14;
    ctx.font = `800 ${nameFontSize}px ${FONT_TITLE}`; ctx.fillStyle = NODE_TEXT;
    const nameW = ctx.measureText(c.name).width;
    ctx.fillText(c.name, x + w / 2 - nameW / 2 + 4, y + h / 2 + 5);

    const GENDER_ICONS: Record<string, string> = { male: '♂', female: '♀', 'non-binary': '⚧', unknown: '' };
    const gIcon = GENDER_ICONS[c.gender] || '';
    if (gIcon) {
      ctx.font = `bold 9px ${FONT_UI}`; ctx.fillStyle = '#555555';
      const gW = ctx.measureText(gIcon).width;
      ctx.fillText(gIcon, x + w / 2 - gW / 2 + 4, y + h / 2 + 17);
    }
    ctx.restore();
  }

  // Draw explanatory notes above nodes in the print theme.
  if (includeAnnotations) drawExportAnnotations(ctx, book, visibleCharacterIds, boxMap, ox, oy, 'print', visibleAnnotationLayers);

  // Legend
  if (showLegend) {
    const usedTypes = Array.from(new Set(visibleRels.map(r => r.type)));
    if (usedTypes.length > 0) {
      const legendY = contentH - LEGEND_H / 2 + 4;
      // Light separator line
      ctx.save();
      ctx.strokeStyle = '#dddddd'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, contentH - LEGEND_H);
      ctx.lineTo(contentW - PADDING, contentH - LEGEND_H);
      ctx.stroke();

      let legendX = PADDING;
      ctx.font = `500 9px ${FONT_UI}`;
      for (const type of usedTypes) {
        const info = RELATIONSHIP_TYPES[type as keyof typeof RELATIONSHIP_TYPES];
        if (!info) continue;
        const color = darkenColor(info.color);
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(legendX, legendY); ctx.lineTo(legendX + 16, legendY); ctx.stroke();
        ctx.fillStyle = '#555555';
        ctx.fillText(info.label, legendX + 20, legendY + 3);
        legendX += ctx.measureText(info.label).width + 44;
        if (legendX > contentW - PADDING) break;
      }
      ctx.restore();
    }
  }

  return { canvas, contentW, contentH };
}

// ── Download canvas as PDF ────────────────────────────────────

export function downloadPdfFromCanvas(
  canvas: HTMLCanvasElement,
  contentW: number,
  contentH: number,
  filename: string,
  packet?: { book: BookData; visibleCharacterIds: Set<string>; sections?: PdfPacketSections; citationStyle?: PdfCitationStyle },
): void {
  // Character maps are spatial diagrams. Always use the wider A4 orientation
  // instead of switching to portrait for a tall arrangement.
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const availW = pageW - margin * 2, availH = pageH - margin * 2;
  const scaleToFit = Math.min(availW / contentW, availH / contentH);
  const imgW = contentW * scaleToFit, imgH = contentH * scaleToFit;
  const imgX = margin + (availW - imgW) / 2, imgY = margin + (availH - imgH) / 2;
  const sections = packet?.sections ?? DEFAULT_PDF_PACKET_SECTIONS;
  if (sections.map || !packet) {
    pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');
  }
  if (packet) {
    appendResearchPacket(pdf, packet.book, packet.visibleCharacterIds, sections, packet.citationStyle);
    // jsPDF starts with an initial page. If the map is excluded, remove that
    // otherwise blank landscape page after the requested portrait sections exist.
    if (!sections.map && pdf.getNumberOfPages() > 1) pdf.deletePage(1);
  }
  pdf.save(`${filename}.pdf`);
}

// ── Convenience wrapper (render + download) ───────────────────

export async function exportBookAsPdf(
  book: BookData,
  visibleCharacterIds: Set<string>,
  showLabels: boolean,
  filename: string,
  hiddenCircleGroupIds?: Set<string>,
  circleOverlapStep = 14,
  circleGroupOrder: string[] = [],
  includeAnnotations = true,
  visibleAnnotationLayers?: AnnotationLayer[],
  packetSections: PdfPacketSections = DEFAULT_PDF_PACKET_SECTIONS,
  citationStyle: PdfCitationStyle = 'compact',
): Promise<void> {
  const { canvas, contentW, contentH } = await renderPdfCanvas(book, visibleCharacterIds, showLabels, true, hiddenCircleGroupIds, circleOverlapStep, circleGroupOrder, includeAnnotations, visibleAnnotationLayers);
  downloadPdfFromCanvas(canvas, contentW, contentH, filename, { book, visibleCharacterIds, sections: packetSections, citationStyle });
}
