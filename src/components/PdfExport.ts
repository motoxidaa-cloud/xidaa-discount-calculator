/**
 * Premium A4 portrait PDF order summary generation (pdf-lib).
 * Uses the official Xidaa logo and embedded Inter font (OFL), with the
 * Midnight Navy / Teal visual identity.
 *
 * The PDF never invents figures — everything is drawn from the saved order
 * calculation snapshot. Amounts are formatted in INR from integer paise.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CalcSnapshot, DiscountOptionKey, FullOrder, OrderBatteryRow, OrderScooterRow } from '../types';
import { formatINR, formatIndianNumber } from '../utils/currency';

// Inter static TTFs (OFL) bundled locally for PDF embedding.
const INTER_FONTS = {
  regular: '/fonts/Inter-Regular.ttf',
  semi: '/fonts/Inter-SemiBold.ttf',
  bold: '/fonts/Inter-Bold.ttf',
};
const NAVY = rgb(0.067, 0.094, 0.153); // #111827
const TEAL = rgb(0.059, 0.725, 0.651); // #0FB9A6
const INK = rgb(0.126, 0.161, 0.22); // #202938
const MUTED = rgb(0.45, 0.49, 0.55);
const LINE = rgb(0.86, 0.89, 0.92);
const PAPER = rgb(0.969, 0.98, 0.99);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Ctx {
  doc: PDFDocument;
  regular: PDFFont;
  semi: PDFFont;
  bold: PDFFont;
  logo: PDFImage | null;
  page: PDFPage;
  y: number;
  pageNo: number;
}

function textWidth(font: PDFFont, size: number, text: string): number {
  return font.widthOfTextAtSize(text, size);
}

function wrapText(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const attempt = line ? `${line} ${w}` : w;
    if (textWidth(font, size, attempt) <= maxWidth) {
      line = attempt;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(ctx: Ctx, text: string, x: number, y: number, size: number, color = INK, font?: PDFFont, maxWidth?: number) {
  const f = font ?? ctx.regular;
  const lines = maxWidth ? wrapText(f, size, text, maxWidth) : [text];
  let yy = y;
  for (const line of lines) {
    ctx.page.drawText(line, { x, y: yy, size, font: f, color });
    yy -= size * 1.35;
  }
  return yy;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < 64) newPage(ctx);
}

function newPage(ctx: Ctx) {
  ctx.pageNo += 1;
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
  drawHeader(ctx);
  drawFooter(ctx);
}

function drawHeader(ctx: Ctx) {
  const page = ctx.page;
  // Navy band
  page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_H - 100, width: PAGE_W, height: 4, color: TEAL });
  if (ctx.logo) page.drawImage(ctx.logo, { x: MARGIN, y: PAGE_H - 76, width: 108, height: 32.6 });
  page.drawText('Xidaa Discount Calculator', { x: MARGIN + 120, y: PAGE_H - 56, size: 15, font: ctx.bold, color: WHITE });
  page.drawText('Xidaa Moto Private Limited · Ride The Electric Thunder', {
    x: MARGIN + 120,
    y: PAGE_H - 72,
    size: 8.5,
    font: ctx.regular,
    color: rgb(0.75, 0.82, 0.88),
  });
  page.drawText(`Order Summary · Page ${ctx.pageNo}`, {
    x: PAGE_W - MARGIN - 120,
    y: PAGE_H - 56,
    size: 9,
    font: ctx.semi,
    color: rgb(0.65, 0.85, 0.83),
  });
}

function drawFooter(ctx: Ctx) {
  const page = ctx.page;
  page.drawLine({ start: { x: MARGIN, y: 56 }, end: { x: PAGE_W - MARGIN, y: 56 }, thickness: 1, color: LINE });
  page.drawText('INTERNAL ORDER CALCULATION — SUBJECT TO APPROVAL · NOT A TAX INVOICE', {
    x: MARGIN,
    y: 40,
    size: 8.5,
    font: ctx.semi,
    color: MUTED,
  });
  page.drawText('Confidential · For internal use by authorised Xidaa staff only', {
    x: MARGIN + 40,
    y: 40,
    size: 8.5,
    font: ctx.regular,
    color: MUTED,
  });
  page.drawText(`Page ${ctx.pageNo}`, {
    x: PAGE_W - MARGIN - 30,
    y: 40,
    size: 8.5,
    font: ctx.regular,
    color: MUTED,
  });
}

function sectionTitle(ctx: Ctx, title: string) {
  ensureSpace(ctx, 44);
  ctx.y -= 18;
  drawText(ctx, title, MARGIN, ctx.y, 11.5, NAVY, ctx.bold);
  ctx.y -= 4;
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_W - MARGIN, y: ctx.y }, thickness: 1.2, color: TEAL });
  ctx.y -= 14;
}

function keyValue(ctx: Ctx, key: string, value: string, x = MARGIN, colWidth = CONTENT_W / 2) {
  drawText(ctx, key, x, ctx.y, 9.5, MUTED);
  ctx.y -= 13;
  drawText(ctx, value, x + 110, ctx.y, 9.5, INK, ctx.semi);
  ctx.y -= 6;
}

function tableHeader(ctx: Ctx, cols: { label: string; w: number; align?: 'left' | 'right' }[]) {
  ensureSpace(ctx, 40);
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 18, width: CONTENT_W, height: 20, color: NAVY });
  let x = MARGIN + 8;
  for (const c of cols) {
    const text = c.label;
    const w = textWidth(ctx.semi, 8.5, text);
    ctx.page.drawText(text, { x: c.align === 'right' ? x + c.w - 8 - w : x, y: ctx.y - 13.5, size: 8.5, font: ctx.semi, color: WHITE });
    x += c.w;
  }
  ctx.y -= 22;
}

function tableRow(ctx: Ctx, cols: { text: string; w: number; align?: 'left' | 'right'; bold?: boolean; color?: any }[], zebra: boolean) {
  ensureSpace(ctx, 26);
  if (zebra) ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 15, width: CONTENT_W, height: 17, color: PAPER });
  let x = MARGIN + 8;
  for (const c of cols) {
    const f = c.bold ? ctx.semi : ctx.regular;
    const w = textWidth(f, 9, c.text);
    ctx.page.drawText(c.text, {
      x: c.align === 'right' ? x + c.w - 8 - w : x,
      y: ctx.y - 11,
      size: 9,
      font: f,
      color: c.color ?? INK,
    });
    x += c.w;
  }
  ctx.y -= 17;
}

const MONEY = (p: number) => formatINR(p);

export async function generateOrderPdf(order: FullOrder, selectedKey: DiscountOptionKey | null): Promise<Uint8Array> {
  const s: CalcSnapshot = order.snapshot;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regularBytes, semiBytes, boldBytes] = await Promise.all([
    fetch(INTER_FONTS.regular).then((r) => r.arrayBuffer()),
    fetch(INTER_FONTS.semi).then((r) => r.arrayBuffer()),
    fetch(INTER_FONTS.bold).then((r) => r.arrayBuffer()),
  ]);
  const regular = await doc.embedFont(regularBytes, { subset: true } as any);
  const semi = await doc.embedFont(semiBytes, { subset: true } as any);
  const bold = await doc.embedFont(boldBytes, { subset: true } as any);

  let logo: PDFImage | null = null;
  try {
    const logoRes = await fetch('/assets/xidaa-logo-dark.png');
    const logoBytes = await logoRes.arrayBuffer();
    logo = await doc.embedPng(logoBytes);
  } catch {
    logo = null;
  }

  const ctx: Ctx = { doc, regular, semi, bold, logo, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, pageNo: 1 };
  drawHeader(ctx);
  drawFooter(ctx);

  // --- Header: customer + order meta ---
  sectionTitle(ctx, 'Order');
  ctx.y -= 4;
  keyValue(ctx, 'Order reference', order.orderRef);
  ctx.y -= 6;
  keyValue(ctx, 'Customer', order.customerName);
  ctx.y -= 6;
  keyValue(ctx, 'Phone / City', `${order.customerPhone || '—'}${order.city ? ` · ${order.city}` : ''}`);
  ctx.y -= 6;
  keyValue(ctx, 'Order date', new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
  ctx.y -= 12;

  // --- Scooter items table ---
  if (s.allowances.totalScooterQty > 0) {
    sectionTitle(ctx, 'Scooters');
    const cols = [
      { label: 'Model', w: CONTENT_W * 0.42 },
      { label: 'Category', w: CONTENT_W * 0.16 },
      { label: 'Qty', w: CONTENT_W * 0.14, align: 'right' as const },
      { label: 'Total Qty', w: CONTENT_W * 0.28, align: 'right' as const },
    ];
    tableHeader(ctx, cols);
    const byModel = new Map<string, { row: OrderScooterRow; qty: number }>();
    for (const r of order.scooterRows) {
      const ex = byModel.get(r.modelId);
      if (ex) ex.qty += r.qty;
      else byModel.set(r.modelId, { row: r, qty: r.qty });
    }
    let i = 0;
    for (const { row, qty } of byModel.values()) {
      tableRow(
        ctx,
        [
          { text: row.modelName, w: cols[0].w },
          { text: row.category, w: cols[1].w },
          { text: String(qty), w: cols[2].w, align: 'right', bold: true },
          { text: `₹${qty}`, w: cols[3].w, align: 'right' },
        ],
        i++ % 2 === 1,
      );
    }
    ctx.y -= 6;
    tableRow(
      ctx,
      [
        { text: 'Total scooters', w: cols[0].w + cols[1].w, bold: true },
        { text: `${s.allowances.dlQty} DL / ${s.allowances.otherQty} Other`, w: cols[2].w, align: 'right' },
        { text: `${s.allowances.totalScooterQty}`, w: cols[3].w, align: 'right', bold: true },
      ],
      false,
    );
    ctx.y -= 10;
  }

  // --- Battery items table ---
  if (order.batteryRows.length > 0) {
    sectionTitle(ctx, 'Batteries');
    const cols = [
      { label: 'Variant', w: CONTENT_W * 0.58 },
      { label: 'Eligible', w: CONTENT_W * 0.16 },
      { label: 'Qty', w: CONTENT_W * 0.26, align: 'right' as const },
    ];
    tableHeader(ctx, cols);
    let i = 0;
    for (const r of order.batteryRows) {
      tableRow(
        ctx,
        [
          { text: r.variantName, w: cols[0].w },
          { text: r.eligible ? 'Yes' : 'No', w: cols[1].w },
          { text: String(r.qty), w: cols[2].w, align: 'right', bold: true },
        ],
        i++ % 2 === 1,
      );
    }
    ctx.y -= 10;
  }

  // --- Transport breakdown ---
  sectionTitle(ctx, 'Transport');
  ctx.y -= 6;
  for (const t of s.transport.trucks) {
    keyValue(ctx, `${t.label} × ${t.count}`, `${formatIndianNumber(t.distanceKm)} km @ ₹${(t.ratePerKmPaise / 100).toLocaleString('en-IN')}/km → ${MONEY(t.totalPaise)}`);
    ctx.y -= 8;
  }
  ctx.y -= 4;
  const tCols = [
    { label: 'Base transport', w: CONTENT_W * 0.4 },
    { label: 'Additional 10%', w: CONTENT_W * 0.28, align: 'right' as const },
    { label: 'Subtotal', w: CONTENT_W * 0.16, align: 'right' as const },
    { label: 'GST 5%', w: CONTENT_W * 0.16, align: 'right' as const },
  ];
  tableHeader(ctx, tCols);
  tableRow(ctx, [
    { text: MONEY(s.transport.basePaise), w: tCols[0].w },
    { text: MONEY(s.transport.surchargePaise), w: tCols[1].w, align: 'right' },
    { text: MONEY(s.transport.subtotalPaise), w: tCols[2].w, align: 'right' },
    { text: MONEY(s.transport.gstPaise), w: tCols[3].w, align: 'right' },
  ], false);
  ctx.y -= 4;
  tableRow(ctx, [
    { text: 'FINAL TRANSPORT', w: CONTENT_W * 0.6, bold: true },
    { text: MONEY(s.transport.finalPaise), w: CONTENT_W * 0.4, align: 'right', bold: true, color: NAVY },
  ], false);
  ctx.y -= 12;

  // --- Discount options ---
  sectionTitle(ctx, 'Discount Options');
  ctx.y -= 6;
  const optCols = [
    { label: 'Option', w: CONTENT_W * 0.3 },
    { label: 'Status', w: CONTENT_W * 0.14 },
    { label: 'Scooter discount', w: CONTENT_W * 0.16, align: 'right' as const },
    { label: 'Company support', w: CONTENT_W * 0.14, align: 'right' as const },
    { label: 'Dealer transport', w: CONTENT_W * 0.14, align: 'right' as const },
    { label: 'Profit', w: CONTENT_W * 0.12, align: 'right' as const },
  ];
  tableHeader(ctx, optCols);
  for (const opt of s.options) {
    const status = !opt.eligible ? 'Not eligible' : opt.profitStatus === 'verified' ? 'Verified' : opt.profitStatus === 'below_target' ? 'Below target' : 'Not verified';
    const profit = opt.profitStatus === 'verified' && opt.profit ? MONEY(opt.profit.profitPaise) : '—';
    tableRow(ctx, [
      { text: opt.title, w: optCols[0].w, bold: opt.key === selectedKey },
      { text: status, w: optCols[1].w, color: opt.eligible ? (opt.profitStatus === 'verified' ? rgb(0.03, 0.55, 0.4) : INK) : rgb(0.8, 0.25, 0.25) },
      { text: MONEY(opt.scooterDiscountPaise), w: optCols[2].w, align: 'right' },
      { text: MONEY(opt.companyTransportSupportPaise), w: optCols[3].w, align: 'right' },
      { text: MONEY(opt.dealerTransportPayablePaise), w: optCols[4].w, align: 'right' },
      { text: profit, w: optCols[5].w, align: 'right' },
    ], false);
  }
  ctx.y -= 10;

  const sel = s.options.find((o) => o.key === selectedKey);
  if (sel) {
    ensureSpace(ctx, 46);
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 40, width: CONTENT_W, height: 42, color: rgb(0.94, 0.985, 0.98) });
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 40, width: 3, height: 42, color: TEAL });
    drawText(ctx, 'SELECTED STRATEGY', MARGIN + 14, ctx.y - 16, 9, TEAL, ctx.bold);
    drawText(ctx, `${sel.title} — ₹discount applied: ${MONEY(sel.scooterDiscountPaise)}, company transport support: ${MONEY(sel.companyTransportSupportPaise)}`, MARGIN + 14, ctx.y - 31, 9, INK, ctx.semi);
    ctx.y -= 46;
  }

  // --- Discounts & payables ---
  sectionTitle(ctx, 'Discounts & Payables');
  ctx.y -= 4;
  keyValue(ctx, 'DL discount allowance', MONEY(s.allowances.dlAllowancePaise));
  ctx.y -= 6;
  keyValue(ctx, 'Other model discount allowance', MONEY(s.allowances.otherAllowancePaise));
  ctx.y -= 6;
  keyValue(ctx, 'Total scooter discount allowance', MONEY(s.allowances.scooterAllowanceTotalPaise));
  ctx.y -= 6;
  keyValue(ctx, 'Battery discount allowance', MONEY(s.allowances.batteryDiscountPaise));
  ctx.y -= 8;

  const profitRow = s.options.find((o) => o.key === selectedKey) ?? s.options[0];
  if (profitRow?.profit?.verified) {
    sectionTitle(ctx, 'Profitability (selected strategy)');
    ctx.y -= 4;
    keyValue(ctx, 'Revenue (incl. transport excl. GST)', MONEY(profitRow.profit.revenueTotalPaise));
    ctx.y -= 6;
    keyValue(ctx, 'Total costs', MONEY(profitRow.profit.costTotalPaise));
    ctx.y -= 6;
    keyValue(ctx, 'Company profit', MONEY(profitRow.profit.profitPaise));
    ctx.y -= 6;
    keyValue(ctx, 'Margin', `${profitRow.profit.marginPercent.toFixed(1)}%`);
    ctx.y -= 6;
    keyValue(ctx, 'Minimum profit target met', profitRow.profit.meetsMinimum ? 'Yes' : 'No');
  } else {
    sectionTitle(ctx, 'Profitability (selected strategy)');
    ensureSpace(ctx, 40);
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 30, width: CONTENT_W, height: 28, color: rgb(0.99, 0.96, 0.88) });
    drawText(ctx, 'PROFITABILITY NOT VERIFIED — Administrator cost data required.', MARGIN + 12, ctx.y - 19, 9, rgb(0.72, 0.5, 0.1), ctx.semi);
    ctx.y -= 34;
  }

  // --- Signature lines ---
  ensureSpace(ctx, 120);
  ctx.y -= 40;
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + 140, y: ctx.y }, thickness: 0.8, color: MUTED });
  ctx.page.drawLine({ start: { x: PAGE_W - MARGIN - 140, y: ctx.y }, end: { x: PAGE_W - MARGIN, y: ctx.y }, thickness: 0.8, color: MUTED });
  ctx.y -= 8;
  drawText(ctx, 'Prepared by (Sales Executive)', MARGIN, ctx.y, 8.5, MUTED);
  drawText(ctx, 'Approved by (Authorised Signatory)', PAGE_W - MARGIN - 170, ctx.y, 8.5, MUTED);

  return doc.save();
}
