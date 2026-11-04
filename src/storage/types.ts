/**
 * Storage abstraction. Two implementations exist:
 *  - SupabaseAdapter: production persistence (PostgreSQL).
 *  - DemoAdapter: browser-local persistence used ONLY in development when
 *    Supabase is not configured. It is never used silently — the UI always
 *    shows a persistent "demo mode" banner.
 *
 * The app has NO login system: the user picks a role (Admin/Sales) on entry
 * and data access is not per-user isolated.
 */
import type {
  AppSettings,
  AuditEntry,
  BatteryRecord,
  ModelRecord,
  FullOrder,
  SavedOrder,
} from '../types';

export type StorageMode = 'supabase' | 'demo' | 'unconfigured';

export interface DataAdapter {
  readonly mode: StorageMode;

  // Reference data
  fetchSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<void>;
  fetchModels(): Promise<ModelRecord[]>;
  upsertModel(model: ModelRecord): Promise<void>;
  fetchBatteries(): Promise<BatteryRecord[]>;
  upsertBattery(battery: BatteryRecord): Promise<void>;

  // Orders
  listOrders(opts?: { search?: string; limit?: number; offset?: number }): Promise<SavedOrder[]>;
  getOrder(id: string): Promise<FullOrder>;
  saveOrder(order: FullOrder): Promise<string>;
  deleteOrder(id: string): Promise<void>;

  // Audit
  fetchAudits(limit?: number): Promise<AuditEntry[]>;
}
