/**
 * Currency utilities — all arithmetic is done in integer paise.
 * Never use floats for money in this codebase.
 */

export type Paise = number;

/** Convert rupees (may be fractional) to whole paise. */
export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees) || rupees < 0) return 0;
  return Math.round(rupees * 100);
}

/** Convert paise to rupees (display only, never for arithmetic). */
export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/**
 * Apply a percentage to a paise amount using integer math:
 * round(base * pct / 100) with half-up convention.
 */
export function pctOf(basePaise: Paise, pct: number): Paise {
  if (!Number.isFinite(pct) || basePaise <= 0) return 0;
  return Math.round((basePaise * pct) / 100);
}

/** Safe sum of paise values. */
export function sumPaise(values: Paise[]): Paise {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const inrFormatterPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format paise as ₹ with Indian digit grouping, e.g. ₹46,200. */
export function formatINR(paise: Paise, opts: { decimals?: boolean } = {}): string {
  return (opts.decimals ? inrFormatterPaise : inrFormatter).format(paise / 100);
}

/** Compact format for large amounts, e.g. ₹1.2L. */
export function formatINRCompact(paise: Paise): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return formatINR(paise);
}

/** Plain number with Indian grouping: 46,200 */
export function formatIndianNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
