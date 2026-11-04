/**
 * Xidaa Discount Calculator — centralized business logic.
 *
 * Every financial formula lives here (never in UI components). All amounts are
 * integer paise. The engine is framework-agnostic and fully unit-tested.
 */
import type {
  AppSettings,
  AllowanceSummary,
  BatteryRecord,
  CalcSnapshot,
  CalculatedTruck,
  DiscountOption,
  DiscountOptionKey,
  DiscountSettings,
  ModelRecord,
  OrderBatteryRow,
  OrderCalc,
  OrderDraft,
  OrderScooterRow,
  ProfitSnapshot,
  Recommendation,
  TransportCalc,
  TransportSettings,
  TruckAllocation,
  TruckConfig,
} from '../types';
import { pctOf, sumPaise } from '../utils/currency';

export const OPTION_ORDER: DiscountOptionKey[] = [
  'scooter_discount',
  'transport_support',
  'no_discount',
];

// Simpler settlement order for tie-breaking (lower = simpler).
const SIMPLICITY_ORDER: Record<DiscountOptionKey, number> = {
  no_discount: 0,
  scooter_discount: 1,
  transport_support: 2,
};

export const OPTION_META: Record<DiscountOptionKey, { title: string; short: string }> = {
  scooter_discount: { title: 'Scooter Price Discount', short: 'Scooter discount' },
  transport_support: { title: '50% Transport Support', short: 'Transport support' },
  no_discount: { title: 'No Discount', short: 'No discount' },
};

// ---------------------------------------------------------------------------
// Allowances
// ---------------------------------------------------------------------------

export function computeAllowances(
  scooterRows: OrderScooterRow[],
  discounts: DiscountSettings,
): AllowanceSummary {
  let dlQty = 0;
  let otherQty = 0;
  for (const row of scooterRows) {
    if (row.qty <= 0) continue;
    if (row.category === 'DL') dlQty += row.qty;
    else otherQty += row.qty;
  }
  const dlAllowancePaise = dlQty * discounts.dlDiscountPaise;
  const otherAllowancePaise = otherQty * discounts.otherDiscountPaise;
  const batteryEligibleQty = 0;
  const batteryDiscountPaise = 0;
  return {
    dlQty,
    otherQty,
    totalScooterQty: dlQty + otherQty,
    dlAllowancePaise,
    otherAllowancePaise,
    scooterAllowanceTotalPaise: dlAllowancePaise + otherAllowancePaise,
    batteryEligibleQty,
    batteryDiscountPaise,
  };
}

export function computeBatteryAllowance(
  batteryRows: OrderBatteryRow[],
  discounts: DiscountSettings,
): { batteryEligibleQty: number; batteryDiscountPaise: number } {
  let eligibleQty = 0;
  for (const row of batteryRows) {
    if (row.qty > 0 && row.eligible) eligibleQty += row.qty;
  }
  return {
    batteryEligibleQty: eligibleQty,
    batteryDiscountPaise: eligibleQty * discounts.batteryDiscountPaise,
  };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/**
 * Calculate one truck line: distance × rate = base, +surcharge%, +GST%.
 * The same 10% surcharge and 5% GST never get applied twice.
 */
export function calculateTruck(
  truck: TruckAllocation,
  transport: TransportSettings,
): CalculatedTruck {
  const distanceKm = Math.max(0, Math.round(truck.distanceKm));
  const count = Math.max(1, Math.round(truck.count));
  const basePaise = distanceKm * truck.ratePerKmPaise * count;
  const surchargePaise = pctOf(basePaise, transport.surchargePercent);
  const subtotalPaise = basePaise + surchargePaise;
  const gstPaise = pctOf(subtotalPaise, transport.gstPercent);
  const totalPaise = subtotalPaise + gstPaise;
  return {
    truckConfigId: truck.truckConfigId,
    label: truck.label,
    capacity: truck.capacity,
    count,
    distanceKm,
    ratePerKmPaise: truck.ratePerKmPaise,
    basePaise,
    surchargePaise,
    subtotalPaise,
    gstPaise,
    totalPaise,
  };
}

export function computeTransport(
  trucks: TruckAllocation[],
  transport: TransportSettings,
): TransportCalc {
  const calculated = trucks
    .filter((t) => t.count > 0 && t.distanceKm > 0)
    .sort((a, b) => b.capacity - a.capacity)
    .map((t) => calculateTruck(t, transport));

  const basePaise = sumPaise(calculated.map((t) => t.basePaise));
  const surchargePaise = sumPaise(calculated.map((t) => t.surchargePaise));
  const subtotalPaise = sumPaise(calculated.map((t) => t.subtotalPaise));
  const gstPaise = sumPaise(calculated.map((t) => t.gstPaise));
  const finalPaise = subtotalPaise + gstPaise;

  return {
    trucks: calculated,
    basePaise,
    surchargePaise,
    subtotalPaise,
    gstPaise,
    finalPaise,
  };
}

/**
 * Suggest a truck configuration for N scooters using available capacities.
 * Strategy: if N fits in a single truck, use the SMALLEST truck that fits.
 * Otherwise fill with the largest trucks and cover the remainder with the
 * smallest truck that fits. The user can always adjust the suggestion.
 */
export function suggestTrucks(
  totalScooters: number,
  configs: TruckConfig[],
): { truckConfigId: string; label: string; capacity: number; ratePerKmPaise: number; count: number }[] {
  const active = configs.filter((c) => c.active).sort((a, b) => b.capacity - a.capacity);
  if (active.length === 0 || totalScooters <= 0) return [];

  const result: { truckConfigId: string; label: string; capacity: number; ratePerKmPaise: number; count: number }[] = [];
  const largest = active[0];

  // Whole order fits in one truck → smallest truck that fits.
  const smallestFit = [...active].reverse().find((c) => c.capacity >= totalScooters);
  if (smallestFit) {
    return [
      {
        truckConfigId: smallestFit.id,
        label: smallestFit.label,
        capacity: smallestFit.capacity,
        ratePerKmPaise: smallestFit.ratePerKmPaise,
        count: 1,
      },
    ];
  }

  let remaining = totalScooters;
  for (const cfg of active) {
    if (remaining <= 0) break;
    const fits = Math.floor(remaining / cfg.capacity);
    if (fits > 0) {
      result.push({ truckConfigId: cfg.id, label: cfg.label, capacity: cfg.capacity, ratePerKmPaise: cfg.ratePerKmPaise, count: fits });
      remaining -= fits * cfg.capacity;
    }
  }

  if (remaining > 0) {
    const smallestRemainder = [...active].reverse().find((c) => c.capacity >= remaining) ?? largest;
    const existing = result.find((r) => r.truckConfigId === smallestRemainder.id);
    if (existing) existing.count += 1;
    else
      result.push({
        truckConfigId: smallestRemainder.id,
        label: smallestRemainder.label,
        capacity: smallestRemainder.capacity,
        ratePerKmPaise: smallestRemainder.ratePerKmPaise,
        count: 1,
      });
  }

  return result.sort((a, b) => b.capacity - a.capacity);
}

// ---------------------------------------------------------------------------
// Profitability
// ---------------------------------------------------------------------------

export interface ProfitInput {
  scooterRows: OrderScooterRow[];
  batteryRows: OrderBatteryRow[];
  models: ModelRecord[];
  batteries: BatteryRecord[];
  transportSubtotalPaise: number;
  transportFinalPaise: number;
  companySupportFraction: number; // 0..1 share of FINAL transport borne by company
  scooterDiscountPaise: number;
  batteryDiscountPaise: number;
  settings: AppSettings;
}

/**
 * Build a profit snapshot for one strategy. Returns `verified: false` and a
 * list of the missing admin values when price/cost data is incomplete — the
 * engine never invents profit figures.
 */
export function computeProfit(input: ProfitInput): ProfitSnapshot {
  const missingData: string[] = [];
  const modelById = new Map(input.models.map((m) => [m.id, m]));
  const batteryById = new Map(input.batteries.map((b) => [b.id, b]));

  let scooterRevenuePaise = 0;
  let scooterCostPaise = 0;
  let batteryRevenuePaise = 0;
  let batteryCostPaise = 0;

  for (const row of input.scooterRows) {
    if (row.qty <= 0) continue;
    const model = modelById.get(row.modelId);
    if (!model) {
      missingData.push(`Catalogue entry missing for ${row.modelName}`);
      continue;
    }
    if (model.approvedPricePaise == null) missingData.push(`Approved selling price missing for ${model.name}`);
    else scooterRevenuePaise += row.qty * model.approvedPricePaise;
    if (model.costPaise == null) missingData.push(`Cost missing for ${model.name}`);
    else scooterCostPaise += row.qty * model.costPaise;
  }

  for (const row of input.batteryRows) {
    if (row.qty <= 0) continue;
    const battery = batteryById.get(row.variantId);
    if (!battery) {
      missingData.push(`Battery entry missing for ${row.variantName}`);
      continue;
    }
    if (battery.approvedPricePaise == null) missingData.push(`Approved battery price missing for ${battery.name}`);
    else batteryRevenuePaise += row.qty * battery.approvedPricePaise;
    if (battery.costPaise == null) missingData.push(`Battery cost missing for ${battery.name}`);
    else batteryCostPaise += row.qty * battery.costPaise;
  }

  const verified = missingData.length === 0;

  const transportCollectedExGstPaise = Math.round(
    input.transportSubtotalPaise * (1 - input.companySupportFraction),
  );
  // When GST is recoverable the company's transport expense excludes GST;
  // otherwise the full (GST-inclusive) supported portion is an expense.
  const companyTransportExpensePaise = input.settings.profit.gstRecoverable
    ? Math.round(input.transportSubtotalPaise * input.companySupportFraction)
    : Math.round(input.transportFinalPaise * input.companySupportFraction);

  const revenueTotalPaise =
    scooterRevenuePaise -
    input.scooterDiscountPaise +
    batteryRevenuePaise -
    input.batteryDiscountPaise +
    transportCollectedExGstPaise;

  const costTotalPaise =
    scooterCostPaise +
    batteryCostPaise +
    input.settings.profit.companyExpensesPaise +
    companyTransportExpensePaise;

  const profitPaise = revenueTotalPaise - costTotalPaise;
  const marginPercent = revenueTotalPaise > 0 ? (profitPaise / revenueTotalPaise) * 100 : 0;

  const { minProfitMode, minProfitAmountPaise, minProfitMarginPercent } = input.settings.profit;
  const meetsMinimum =
    minProfitMode === 'amount' ? profitPaise >= minProfitAmountPaise : marginPercent >= minProfitMarginPercent;
  const belowByPaise =
    minProfitMode === 'amount'
      ? Math.max(0, minProfitAmountPaise - profitPaise)
      : revenueTotalPaise > 0
        ? Math.max(0, Math.ceil(((minProfitMarginPercent - marginPercent) * revenueTotalPaise) / 100))
        : 0;

  return {
    verified,
    missingData,
    revenueTotalPaise,
    scooterRevenuePaise,
    batteryRevenuePaise,
    transportCollectedExGstPaise,
    costTotalPaise,
    scooterCostPaise,
    batteryCostPaise,
    companyTransportExpensePaise,
    otherExpensesPaise: input.settings.profit.companyExpensesPaise,
    profitPaise,
    marginPercent,
    meetsMinimum,
    belowByPaise,
  };
}

// ---------------------------------------------------------------------------
// Options + recommendation
// ---------------------------------------------------------------------------

export interface EvaluateResult {
  allowances: AllowanceSummary;
  transport: TransportCalc;
  options: DiscountOption[];
  batteryOptionPresent: boolean;
  recommendation: Recommendation;
  profitVerified: boolean;
}

const FALLBACK_PREFERENCE_ORDER: DiscountOptionKey[] = [
  'scooter_discount',
  'transport_support',
  'no_discount',
];

/**
 * Evaluate every discount strategy for an order and pick the recommended one.
 */
export function evaluateOrder(
  draft: OrderDraft,
  models: ModelRecord[],
  batteries: BatteryRecord[],
  settings: AppSettings,
): EvaluateResult {
  const allowances = computeAllowances(draft.scooterRows, settings.discounts);
  const battery = computeBatteryAllowance(draft.batteryRows, settings.discounts);
  allowances.batteryEligibleQty = battery.batteryEligibleQty;
  allowances.batteryDiscountPaise = battery.batteryDiscountPaise;

  const transport = computeTransport(draft.trucks, settings.transport);
  const supportPercent = settings.discounts.transportSupportPercent;
  const supportPaise = pctOf(transport.finalPaise, supportPercent);

  const buildOption = (
    key: DiscountOptionKey,
    scooterDiscountPaise: number,
    companySupportPaise: number,
  ): DiscountOption => {
    const dealerTransportPayablePaise = Math.max(0, transport.finalPaise - companySupportPaise);
    let eligible = true;
    let ineligibleReason: string | undefined;
    let shortfallPaise: number | undefined;

    if (key === 'scooter_discount') {
      eligible = allowances.totalScooterQty > 0;
      if (!eligible) ineligibleReason = 'No scooters in this order.';
    } else if (key === 'transport_support') {
      eligible = allowances.scooterAllowanceTotalPaise >= supportPaise;
      if (!eligible) {
        shortfallPaise = supportPaise - allowances.scooterAllowanceTotalPaise;
        ineligibleReason = `Scooter discount allowance is insufficient for ${supportPercent}% transport support.`;
      }
      if (allowances.totalScooterQty === 0) {
        eligible = false;
        ineligibleReason = 'No scooters in this order, so no scooter discount allowance is available.';
      }
    }

    const profit = computeProfit({
      scooterRows: draft.scooterRows,
      batteryRows: draft.batteryRows,
      models,
      batteries,
      transportSubtotalPaise: transport.subtotalPaise,
      transportFinalPaise: transport.finalPaise,
      companySupportFraction: transport.finalPaise > 0 ? companySupportPaise / transport.finalPaise : 0,
      scooterDiscountPaise,
      batteryDiscountPaise: allowances.batteryDiscountPaise,
      settings,
    });

    const profitStatus = profit.verified
      ? profit.meetsMinimum
        ? 'verified'
        : 'below_target'
      : 'not_verified';

    return {
      key,
      title: OPTION_META[key].title,
      eligible,
      ineligibleReason,
      shortfallPaise,
      scooterDiscountPaise,
      companyTransportSupportPaise: companySupportPaise,
      dealerTransportPayablePaise,
      batteryDiscountPaise: allowances.batteryDiscountPaise,
      profitStatus,
      profit,
    };
  };

  const optionA = buildOption('scooter_discount', allowances.scooterAllowanceTotalPaise, 0);
  const optionB = buildOption('transport_support', 0, supportPaise);
  const optionC = buildOption('no_discount', 0, 0);
  const options: DiscountOption[] = [optionA, optionB, optionC];

  // --- Recommendation -----------------------------------------------------
  const candidates = options.filter((o) => o.eligible);
  const verifiedCandidates = candidates.filter((o) => o.profitStatus === 'verified');
  const belowCandidates = candidates.filter((o) => o.profitStatus === 'below_target');
  const anyProfitVerified = verifiedCandidates.length > 0;

  let recommendedKey: DiscountOptionKey | null = null;
  let provisional = false;
  let rationale = '';

  if (candidates.length === 0) {
    rationale = 'No discount strategy is eligible for this order.';
  } else if (anyProfitVerified) {
    const meeting = verifiedCandidates.filter((o) => o.profit!.meetsMinimum);
    if (meeting.length === 0) {
      recommendedKey = null;
      rationale = 'Every eligible option is below the configured minimum profit requirement — no discount is recommended.';
    } else {
      const sorted = [...meeting].sort((a, b) => {
        const pa = a.profit!.profitPaise;
        const pb = b.profit!.profitPaise;
        if (pb !== pa) return pb - pa;
        // Tie-break: lower company-borne transport expense, then simpler settlement.
        const borneDiff = a.companyTransportSupportPaise - b.companyTransportSupportPaise;
        if (borneDiff !== 0) return borneDiff;
        return SIMPLICITY_ORDER[a.key] - SIMPLICITY_ORDER[b.key];
      });
      recommendedKey = sorted[0].key;
      const winner = sorted[0];
      rationale = `${OPTION_META[winner.key].title} yields the highest verified company profit (₹${(winner.profit!.profitPaise / 100).toLocaleString('en-IN')}) while meeting the minimum profit requirement.`;
    }
  } else if (belowCandidates.length > 0) {
    // Profit data exists, but every eligible option fails the minimum target.
    recommendedKey = null;
    rationale = 'Every eligible option is below the configured minimum profit requirement — no discount is recommended.';
  } else {
    provisional = true;
    const preference = settings.discounts.fallbackPreference;
    const preferred = candidates.find((o) => o.key === preference) ?? candidates[0];
    recommendedKey = preferred.key;
    rationale = 'Provisional recommendation — admin pricing/cost data is incomplete, so profitability is not verified.';
  }

  return {
    allowances,
    transport,
    options,
    batteryOptionPresent: allowances.batteryEligibleQty > 0,
    recommendation: { recommendedKey, provisional, rationale },
    profitVerified: anyProfitVerified,
  };
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export function buildSnapshot(
  draft: OrderDraft,
  models: ModelRecord[],
  batteries: BatteryRecord[],
  settings: AppSettings,
  selectedOptionKey: DiscountOptionKey | null,
): CalcSnapshot {
  const evaluation = evaluateOrder(draft, models, batteries, settings);
  return {
    v: 1,
    allowances: evaluation.allowances,
    transport: evaluation.transport,
    options: evaluation.options,
    recommendation: evaluation.recommendation,
    selectedOptionKey,
    settings: {
      discounts: settings.discounts,
      transport: settings.transport,
      profit: settings.profit,
    },
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_TRUCK_CONFIGS: TruckConfig[] = [
  { id: 'truck-12', label: '12-scooter truck', capacity: 12, ratePerKmPaise: 4000, active: true },
  { id: 'truck-32', label: '32-scooter truck', capacity: 32, ratePerKmPaise: 5500, active: true },
  { id: 'truck-55', label: '55-scooter truck', capacity: 55, ratePerKmPaise: 6500, active: true },
];

export const DEFAULT_SETTINGS: AppSettings = {
  discounts: {
    dlDiscountPaise: 50000,
    otherDiscountPaise: 100000,
    batteryDiscountPaise: 50000,
    transportSupportPercent: 50,
    fallbackPreference: 'scooter_discount',
  },
  transport: {
    trucks: DEFAULT_TRUCK_CONFIGS,
    surchargePercent: 10,
    gstPercent: 5,
  },
  profit: {
    minProfitMode: 'amount',
    minProfitAmountPaise: 1500000,
    minProfitMarginPercent: 5,
    companyExpensesPaise: 0,
    gstRecoverable: true,
  },
};
