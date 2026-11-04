/**
 * Automated tests for every financial formula of the Xidaa Discount
 * Calculator. Tests mirror the required business test cases 1–12.
 */
import { describe, expect, it } from 'vitest';
import type {
  AppSettings,
  BatteryRecord,
  ModelRecord,
  OrderBatteryRow,
  OrderDraft,
  OrderScooterRow,
} from '../types';
import {
  DEFAULT_SETTINGS,
  evaluateOrder,
  suggestTrucks,
  computeTransport,
  computeAllowances,
  computeBatteryAllowance,
} from './calculations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let seq = 0;
const nextId = () => `r${++seq}`;

function model(id: string, name: string, price: number | null, cost: number | null): ModelRecord {
  return { id, name, category: name.includes('DL') ? 'DL' : 'Other', approvedPricePaise: price, costPaise: cost, active: true, sortOrder: 0 };
}

function battery(id: string, name: string, price: number | null, cost: number | null): BatteryRecord {
  return { id, name, capacityAh: 30, tech: 'LFP', approvedPricePaise: price, costPaise: cost, active: true };
}

function scooterRow(modelId: string, modelName: string, qty: number, category: 'DL' | 'Other' = 'Other'): OrderScooterRow {
  return { id: nextId(), modelId, modelName, qty, category };
}

function batteryRow(variantId: string, variantName: string, qty: number, eligible = true): OrderBatteryRow {
  return { id: nextId(), variantId, variantName, capacityAh: 30, qty, eligible };
}

const MODELS: ModelRecord[] = [
  model('dl1', 'DL Model One', 7000000, 6000000),
  model('oth1', 'Other Model One', 7000000, 6000000),
];

const BATTERIES: BatteryRecord[] = [battery('b1', '60V / 30Ah LFP', 5000000, 4000000)];

function draft(rows: OrderScooterRow[], batteryRows: OrderBatteryRow[] = [], distanceKm = 1000): OrderDraft {
  return {
    customerName: 'Test Dealer',
    customerPhone: '9999999999',
    city: 'Delhi',
    scooterRows: rows,
    batteryRows,
    trucks: [
      {
        id: nextId(),
        truckConfigId: 'truck-12',
        label: '12-scooter truck',
        capacity: 12,
        ratePerKmPaise: 4000,
        count: 1,
        distanceKm,
      },
    ],
    notes: '',
  };
}

function dl(qty: number) {
  return scooterRow('dl1', 'DL Model One', qty, 'DL');
}
function oth(qty: number) {
  return scooterRow('oth1', 'Other Model One', qty);
}

// ---------------------------------------------------------------------------
// Test 1 — DL-only allowance
// ---------------------------------------------------------------------------
describe('Test 1: DL-only discount allowance', () => {
  it('12 DL scooters → ₹6,000', () => {
    const a = computeAllowances([dl(12)], DEFAULT_SETTINGS.discounts);
    expect(a.dlQty).toBe(12);
    expect(a.otherQty).toBe(0);
    expect(a.dlAllowancePaise).toBe(600000);
    expect(a.scooterAllowanceTotalPaise).toBe(600000);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — Other-model-only allowance
// ---------------------------------------------------------------------------
describe('Test 2: Other-model-only discount allowance', () => {
  it('12 Other model scooters → ₹12,000', () => {
    const a = computeAllowances([oth(12)], DEFAULT_SETTINGS.discounts);
    expect(a.otherQty).toBe(12);
    expect(a.otherAllowancePaise).toBe(1200000);
    expect(a.scooterAllowanceTotalPaise).toBe(1200000);
  });
});

// ---------------------------------------------------------------------------
// Tests 3 & 7 — Mixed order allowance
// ---------------------------------------------------------------------------
describe('Test 3/7: Mixed order allowance', () => {
  it('10 DL + 12 Other → ₹17,000', () => {
    const a = computeAllowances([dl(10), oth(12)], DEFAULT_SETTINGS.discounts);
    expect(a.dlQty).toBe(10);
    expect(a.otherQty).toBe(12);
    expect(a.scooterAllowanceTotalPaise).toBe(1700000);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Transport formula
// ---------------------------------------------------------------------------
describe('Test 4: Transport calculation', () => {
  it('12-scooter truck @ ₹40/km over 1,000 km → final ₹46,200', () => {
    const t = computeTransport(draft([oth(12)], [], 1000).trucks, DEFAULT_SETTINGS.transport);
    expect(t.basePaise).toBe(4000000); // ₹40,000
    expect(t.surchargePaise).toBe(400000); // ₹4,000
    expect(t.subtotalPaise).toBe(4400000); // ₹44,000
    expect(t.gstPaise).toBe(220000); // ₹2,200
    expect(t.finalPaise).toBe(4620000); // ₹46,200
  });

  it('multiple trucks are summed once, never GST twice', () => {
    const twoTrucks: OrderDraft['trucks'] = [
      { id: nextId(), truckConfigId: 'truck-12', label: '12-scooter truck', capacity: 12, ratePerKmPaise: 4000, count: 2, distanceKm: 1000 },
      { id: nextId(), truckConfigId: 'truck-32', label: '32-scooter truck', capacity: 32, ratePerKmPaise: 5500, count: 1, distanceKm: 500 },
    ];
    const t = computeTransport(twoTrucks, DEFAULT_SETTINGS.transport);
    expect(t.trucks).toHaveLength(2);
    expect(t.basePaise).toBe(2 * 4000000 + 2750000);
    expect(t.subtotalPaise).toBe(Math.round(t.basePaise * 1.1));
    expect(t.finalPaise).toBe(Math.round(t.subtotalPaise * 1.05));
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Eligible transport support
// ---------------------------------------------------------------------------
describe('Test 5: Eligible 50% transport support', () => {
  it('12 Other + ₹18,480 final → eligible; unused allowance stays unused', () => {
    // distance 400 km → base 16,000; surcharge 1,600; subtotal 17,600; GST 880; final 18,480
    const res = evaluateOrder(draft([oth(12)], [], 400), MODELS, BATTERIES, DEFAULT_SETTINGS);
    expect(res.transport.finalPaise).toBe(1848000);
    const optionB = res.options.find((o) => o.key === 'transport_support')!;
    expect(optionB.eligible).toBe(true);
    expect(optionB.companyTransportSupportPaise).toBe(924000); // 50% of final
    expect(optionB.dealerTransportPayablePaise).toBe(924000);
    // Unused allowance must NOT be auto-applied to scooter prices.
    expect(optionB.scooterDiscountPaise).toBe(0);
    expect(res.allowances.scooterAllowanceTotalPaise).toBe(1200000);
    expect(res.allowances.scooterAllowanceTotalPaise - optionB.companyTransportSupportPaise).toBe(276000);
  });
});

// ---------------------------------------------------------------------------
// Test 6 — Ineligible transport support
// ---------------------------------------------------------------------------
describe('Test 6: Ineligible 50% transport support', () => {
  it('12 Other + ₹30,030 final → not eligible; shortfall ₹3,015', () => {
    // distance 650 km → base 26,000; surcharge 2,600; subtotal 28,600; GST 1,430; final 30,030
    const res = evaluateOrder(draft([oth(12)], [], 650), MODELS, BATTERIES, DEFAULT_SETTINGS);
    expect(res.transport.finalPaise).toBe(3003000);
    const optionB = res.options.find((o) => o.key === 'transport_support')!;
    expect(optionB.eligible).toBe(false);
    expect(optionB.shortfallPaise).toBe(301500);
    expect(optionB.ineligibleReason).toBeTruthy();
    // Option A and C remain available.
    expect(res.options.find((o) => o.key === 'scooter_discount')!.eligible).toBe(true);
    expect(res.options.find((o) => o.key === 'no_discount')!.eligible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 8 — Battery discount is separate
// ---------------------------------------------------------------------------
describe('Test 8: Battery discount', () => {
  it('10 eligible batteries → ₹5,000, separate from scooter discount', () => {
    const a = computeBatteryAllowance([batteryRow('b1', '60V / 30Ah LFP', 10)], DEFAULT_SETTINGS.discounts);
    expect(a.batteryEligibleQty).toBe(10);
    expect(a.batteryDiscountPaise).toBe(500000);
  });

  it('battery discount does not qualify transport sharing', () => {
    // Same scooter order with and without batteries → identical support eligibility.
    const without = evaluateOrder(draft([oth(12)], [], 400), MODELS, BATTERIES, DEFAULT_SETTINGS);
    const withBattery = evaluateOrder(draft([oth(12)], [batteryRow('b1', '60V / 30Ah LFP', 10)], 400), MODELS, BATTERIES, DEFAULT_SETTINGS);
    const b0 = without.options.find((o) => o.key === 'transport_support')!;
    const b1 = withBattery.options.find((o) => o.key === 'transport_support')!;
    expect(b0.eligible).toBe(b1.eligible);
    expect(b1.batteryDiscountPaise).toBe(500000);
    // Battery appears in every option independently (never merged into scooter discount).
    for (const opt of withBattery.options) {
      expect(opt.batteryDiscountPaise).toBe(500000);
      expect(opt.scooterDiscountPaise).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 9 — Missing financial data
// ---------------------------------------------------------------------------
describe('Test 9: Missing cost data', () => {
  const noPriceModels = [model('dl1', 'DL Model One', null, null), model('oth1', 'Other Model One', null, null)];

  it('all options still calculated; profit NOT VERIFIED; provisional recommendation', () => {
    const res = evaluateOrder(draft([oth(12)], [batteryRow('b1', '60V / 30Ah LFP', 5)], 1000), noPriceModels, BATTERIES, DEFAULT_SETTINGS);
    expect(res.options).toHaveLength(3);
    for (const opt of res.options) {
      expect(opt.profitStatus).toBe('not_verified');
      expect(opt.profit!.verified).toBe(false);
      expect(opt.profit!.missingData.length).toBeGreaterThan(0);
      // No invented profit figures: profit may be computed but must be flagged.
      expect(opt.profit!.missingData.some((m) => m.includes('Approved selling price') || m.includes('Cost'))).toBe(true);
    }
    expect(res.recommendation.provisional).toBe(true);
    expect(res.recommendation.recommendedKey).toBe('scooter_discount'); // default fallback preference
    expect(res.profitVerified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 10 — Profit comparison & recommendation
// ---------------------------------------------------------------------------
describe('Test 10: Profit comparison and recommendation', () => {
  it('recommends highest-profit eligible option meeting minimum profit', () => {
    // 12 Other, distance 1,000 km → final ₹46,200; subtotal ₹44,000
    // Price ₹70,000, cost ₹60,000.
    //   A (scooter discount ₹12,000): rev = 840,000 − 12,000 + 44,000 = 872,000 ; cost 720,000 → profit 152,000
    //   B (support 50% = 23,100): rev = 840,000 + 22,000 = 862,000 ; cost 720,000 + 22,000 = 742,000 → profit 120,000
    //   C (no discount): rev = 840,000 + 44,000 = 884,000 ; cost 720,000 → profit 164,000
    // Min profit ₹100,000 → all meet; C has the highest profit → recommended = no_discount.
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      profit: { ...DEFAULT_SETTINGS.profit, minProfitMode: 'amount', minProfitAmountPaise: 10000000 },
    };
    const res = evaluateOrder(draft([oth(12)], [], 1000), MODELS, BATTERIES, settings);
    const a = res.options.find((o) => o.key === 'scooter_discount')!;
    const b = res.options.find((o) => o.key === 'transport_support')!;
    const c = res.options.find((o) => o.key === 'no_discount')!;
    expect(c.profit!.profitPaise).toBe(16400000);
    expect(a.profit!.profitPaise).toBe(15200000);
    expect(b.profit!.profitPaise).toBe(12000000);
    expect(res.recommendation.recommendedKey).toBe('no_discount');
  });

  it('below-target options are never recommended', () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      profit: { ...DEFAULT_SETTINGS.profit, minProfitMode: 'amount', minProfitAmountPaise: 17000000 },
    };
    const res = evaluateOrder(draft([oth(12)], [], 1000), MODELS, BATTERIES, settings);
    for (const opt of res.options) {
      expect(opt.profitStatus).toBe('below_target');
    }
    expect(res.recommendation.recommendedKey).toBeNull();
    expect(res.recommendation.rationale).toContain('below');
  });

  it('equal-profit options are handled safely; max verified profit wins', () => {
    // 11 DL → allowance ₹5,500. distance 125 km → base 5,000; surcharge 500; subtotal 5,500; GST 275; final 5,775.
    //   A: rev = 770,000 − 5,500 + 5,500 = 770,000 ; cost 660,000 → profit 110,000
    //   B: rev = 770,000 + 2,750 = 772,750 ; cost 660,000 + 2,750 = 662,750 → profit 110,000
    // A and B tie, but C (no discount) yields 115,500 — under the linear model the
    // full-freight baseline always maximises verified profit, so C is recommended.
    const res = evaluateOrder(draft([dl(11)], [], 125), MODELS, BATTERIES, DEFAULT_SETTINGS);
    const a = res.options.find((o) => o.key === 'scooter_discount')!;
    const b = res.options.find((o) => o.key === 'transport_support')!;
    const c = res.options.find((o) => o.key === 'no_discount')!;
    expect(res.transport.subtotalPaise).toBe(550000);
    expect(a.profit!.profitPaise).toBe(b.profit!.profitPaise);
    expect(c.profit!.profitPaise).toBeGreaterThan(a.profit!.profitPaise);
    expect(res.recommendation.recommendedKey).toBe('no_discount');
  });
});

// ---------------------------------------------------------------------------
// Truck suggestion
// ---------------------------------------------------------------------------
describe('Suggested truck allocation', () => {
  const cfgs = DEFAULT_SETTINGS.transport.trucks;
  const cap = (a: { capacity: number; count: number }[]) => a.reduce((s, t) => s + t.capacity * t.count, 0);

  it('fits any quantity and covers capacity', () => {
    for (const n of [1, 5, 12, 13, 32, 33, 55, 56, 60, 70, 100, 120, 500]) {
      const s = suggestTrucks(n, cfgs);
      expect(cap(s)).toBeGreaterThanOrEqual(n);
      expect(s.reduce((sum, t) => sum + t.count, 0)).toBeGreaterThan(0);
    }
  });

  it('12 → one 12-truck; 32 → one 32-truck; 55 → one 55-truck', () => {
    expect(suggestTrucks(12, cfgs)).toHaveLength(1);
    expect(suggestTrucks(12, cfgs)[0].capacity).toBe(12);
    expect(suggestTrucks(32, cfgs)[0].capacity).toBe(32);
    expect(suggestTrucks(55, cfgs)[0].capacity).toBe(55);
  });

  it('27 → one 32-truck (smallest that fits the whole order)', () => {
    const s = suggestTrucks(27, cfgs);
    expect(s).toHaveLength(1);
    expect(s[0].capacity).toBe(32);
  });

  it('60 → 55 + 12', () => {
    const s = suggestTrucks(60, cfgs);
    expect(s.map((t) => t.capacity).sort((a, b) => a - b)).toEqual([12, 55]);
  });
});

// ---------------------------------------------------------------------------
// Option invariants
// ---------------------------------------------------------------------------
describe('Option invariants', () => {
  it('A: dealer pays full transport; C: baseline; B supports only when eligible', () => {
    const res = evaluateOrder(draft([oth(12)], [], 1000), MODELS, BATTERIES, DEFAULT_SETTINGS);
    const a = res.options.find((o) => o.key === 'scooter_discount')!;
    const b = res.options.find((o) => o.key === 'transport_support')!;
    const c = res.options.find((o) => o.key === 'no_discount')!;
    expect(a.dealerTransportPayablePaise).toBe(res.transport.finalPaise);
    expect(b.dealerTransportPayablePaise + b.companyTransportSupportPaise).toBe(res.transport.finalPaise);
    expect(c.scooterDiscountPaise).toBe(0);
    expect(c.companyTransportSupportPaise).toBe(0);
    expect(c.dealerTransportPayablePaise).toBe(res.transport.finalPaise);
  });

  it('no discount is ever counted twice (A and B are mutually exclusive)', () => {
    const res = evaluateOrder(draft([oth(12)], [], 1000), MODELS, BATTERIES, DEFAULT_SETTINGS);
    const a = res.options.find((o) => o.key === 'scooter_discount')!;
    const b = res.options.find((o) => o.key === 'transport_support')!;
    expect(a.scooterDiscountPaise).toBeGreaterThan(0);
    expect(a.companyTransportSupportPaise).toBe(0);
    expect(b.scooterDiscountPaise).toBe(0);
    expect(b.companyTransportSupportPaise).toBeGreaterThan(0);
  });
});
