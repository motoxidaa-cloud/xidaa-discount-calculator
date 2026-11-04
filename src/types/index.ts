/**
 * Xidaa Discount Calculator — core domain types.
 * All money values are expressed in integer paise (₹1 = 100 paise) to keep
 * calculations exact and free of floating-point rounding errors.
 */

export type Role = 'admin' | 'sales';

export type ModelCategory = 'DL' | 'Other';

export type OrderStatus = 'draft' | 'saved' | 'approved';

export type DiscountOptionKey = 'scooter_discount' | 'transport_support' | 'no_discount';

export type ProfitStatus = 'verified' | 'below_target' | 'not_verified';

export type OptionEligibility = 'eligible' | 'not_eligible';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  mustChangePin: boolean;
  createdAt: string;
}

/** Admin-configured scooter model row (from Supabase or seed). */
export interface ModelRecord {
  id: string; // stable slug e.g. "x-single-light"
  name: string;
  category: ModelCategory;
  approvedPricePaise: number | null;
  costPaise: number | null;
  active: boolean;
  sortOrder: number;
}

export interface BatteryRecord {
  id: string;
  name: string;
  capacityAh: number;
  tech: string;
  approvedPricePaise: number | null;
  costPaise: number | null;
  active: boolean;
}

export interface TruckConfig {
  id: string;
  label: string;
  capacity: number;
  ratePerKmPaise: number;
  active: boolean;
}

export interface OrderScooterRow {
  id: string;
  modelId: string;
  modelName: string;
  category: ModelCategory;
  qty: number;
}

export interface OrderBatteryRow {
  id: string;
  variantId: string;
  variantName: string;
  capacityAh: number;
  qty: number;
  eligible: boolean;
}

export interface TruckAllocation {
  id: string;
  truckConfigId: string;
  label: string;
  capacity: number;
  ratePerKmPaise: number;
  count: number;
  distanceKm: number;
}

export interface OrderDraft {
  customerName: string;
  customerPhone: string;
  city: string;
  scooterRows: OrderScooterRow[];
  batteryRows: OrderBatteryRow[];
  trucks: TruckAllocation[];
  notes: string;
}

export interface DiscountSettings {
  dlDiscountPaise: number;
  otherDiscountPaise: number;
  batteryDiscountPaise: number;
  transportSupportPercent: number;
  fallbackPreference: DiscountOptionKey;
}

export interface TransportSettings {
  trucks: TruckConfig[];
  surchargePercent: number;
  gstPercent: number;
}

export interface ProfitSettings {
  minProfitMode: 'amount' | 'margin';
  minProfitAmountPaise: number;
  minProfitMarginPercent: number;
  companyExpensesPaise: number;
  gstRecoverable: boolean;
}

export interface AppSettings {
  discounts: DiscountSettings;
  transport: TransportSettings;
  profit: ProfitSettings;
  updatedBy?: string;
  updatedAt?: string;
}

export interface CalculatedTruck {
  truckConfigId: string;
  label: string;
  capacity: number;
  count: number;
  distanceKm: number;
  ratePerKmPaise: number;
  basePaise: number;
  surchargePaise: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
}

export interface TransportCalc {
  trucks: CalculatedTruck[];
  basePaise: number;
  surchargePaise: number;
  subtotalPaise: number;
  gstPaise: number;
  finalPaise: number;
}

export interface AllowanceSummary {
  dlQty: number;
  otherQty: number;
  totalScooterQty: number;
  dlAllowancePaise: number;
  otherAllowancePaise: number;
  scooterAllowanceTotalPaise: number;
  batteryEligibleQty: number;
  batteryDiscountPaise: number;
}

export interface ProfitSnapshot {
  verified: boolean;
  missingData: string[];
  revenueTotalPaise: number;
  scooterRevenuePaise: number;
  batteryRevenuePaise: number;
  transportCollectedExGstPaise: number;
  costTotalPaise: number;
  scooterCostPaise: number;
  batteryCostPaise: number;
  companyTransportExpensePaise: number;
  otherExpensesPaise: number;
  profitPaise: number;
  marginPercent: number;
  meetsMinimum: boolean;
  belowByPaise: number;
}

export interface DiscountOption {
  key: DiscountOptionKey;
  title: string;
  eligible: boolean;
  ineligibleReason?: string;
  shortfallPaise?: number;
  scooterDiscountPaise: number;
  companyTransportSupportPaise: number;
  dealerTransportPayablePaise: number;
  batteryDiscountPaise: number;
  profitStatus: ProfitStatus;
  profit?: ProfitSnapshot;
}

export interface Recommendation {
  recommendedKey: DiscountOptionKey | null;
  provisional: boolean;
  rationale: string;
}

export interface OrderCalc {
  allowances: AllowanceSummary;
  transport: TransportCalc;
  options: DiscountOption[]; // A, B, C always present in order
  batteryOptionPresent: boolean;
  recommendation: Recommendation;
  profitVerified: boolean;
}

/** Full persisted calculation snapshot stored with an order. */
export interface CalcSnapshot {
  v: number;
  allowances: AllowanceSummary;
  transport: TransportCalc;
  options: DiscountOption[];
  recommendation: Recommendation;
  selectedOptionKey: DiscountOptionKey | null;
  settings: {
    discounts: DiscountSettings;
    transport: TransportSettings;
    profit: ProfitSettings;
  };
  createdAt: string;
}

export interface SavedOrder {
  id: string;
  orderRef: string;
  customerName: string;
  customerPhone: string;
  city: string;
  status: OrderStatus;
  totalScooters: number;
  dlQty: number;
  otherQty: number;
  batteryQty: number;
  distanceKm: number;
  finalTransportPaise: number;
  selectedOptionKey: DiscountOptionKey | null;
  recommendedKey: DiscountOptionKey | null;
  profitVerified: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface FullOrder extends SavedOrder {
  scooterRows: OrderScooterRow[];
  batteryRows: OrderBatteryRow[];
  trucks: TruckAllocation[];
  snapshot: CalcSnapshot;
}

export type AuditAction =
  | 'settings_update'
  | 'model_update'
  | 'battery_update'
  | 'user_create'
  | 'user_update'
  | 'pin_change'
  | 'order_delete'
  | 'login_success'
  | 'login_failure'
  | 'logout';

export interface AuditEntry {
  id: string;
  actedAt: string;
  actorUserId: string | null;
  actorName: string;
  action: AuditAction;
  entity: string;
  details: string;
}

export type RouteName = 'home' | 'neworder' | 'orders' | 'settings' | 'results';
