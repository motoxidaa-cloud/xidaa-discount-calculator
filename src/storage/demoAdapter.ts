/**
 * DemoAdapter — browser-local persistence used ONLY in development when
 * Supabase is not configured. Every write is tagged; the UI always displays
 * a persistent, visible demo-mode banner so this can never be mistaken for
 * production persistence.
 */
import { buildSeedModels, BATTERY_VARIANTS_SEED } from '../data/catalog';
import { DEFAULT_SETTINGS } from '../domain/calculations';
import type { AppSettings, AuditEntry, BatteryRecord, ModelRecord, FullOrder, SavedOrder } from '../types';
import type { DataAdapter, StorageMode } from './types';

const KEYS = {
  settings: 'xidaa.demo.settings.v1',
  models: 'xidaa.demo.models.v1',
  batteries: 'xidaa.demo.batteries.v1',
  orders: 'xidaa.demo.orders.v1',
  audits: 'xidaa.demo.audits.v1',
};

interface DemoAuditEntry extends AuditEntry {
  id: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayRef(): string {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `XID-${y}${m}${day}-${rand}`;
}

async function pushAudit(action: DemoAuditEntry['action'], entity: string, details: string, actorName: string) {
  const audits = read<DemoAuditEntry[]>(KEYS.audits, []);
  audits.unshift({
    id: crypto.randomUUID(),
    actedAt: new Date().toISOString(),
    actorUserId: null,
    actorName,
    action,
    entity,
    details,
  });
  write(KEYS.audits, audits.slice(0, 500));
}

export class DemoAdapter implements DataAdapter {
  readonly mode: StorageMode = 'demo';

  // --- Reference data ----------------------------------------------------
  async fetchSettings(): Promise<AppSettings> {
    return read<AppSettings>(KEYS.settings, DEFAULT_SETTINGS);
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    write(KEYS.settings, settings);
    await pushAudit('settings_update', 'settings', 'Financial settings updated.', 'Administrator');
  }

  async fetchModels(): Promise<ModelRecord[]> {
    return read<ModelRecord[]>(KEYS.models, buildSeedModels());
  }

  async upsertModel(model: ModelRecord): Promise<void> {
    const models = read<ModelRecord[]>(KEYS.models, buildSeedModels());
    const idx = models.findIndex((m) => m.id === model.id);
    if (idx >= 0) models[idx] = model;
    else models.push(model);
    write(KEYS.models, models);
    await pushAudit('model_update', 'model', `Model "${model.name}" updated.`, 'Administrator');
  }

  async fetchBatteries(): Promise<BatteryRecord[]> {
    return read<BatteryRecord[]>(KEYS.batteries, BATTERY_VARIANTS_SEED);
  }

  async upsertBattery(battery: BatteryRecord): Promise<void> {
    const batteries = read<BatteryRecord[]>(KEYS.batteries, BATTERY_VARIANTS_SEED);
    const idx = batteries.findIndex((b) => b.id === battery.id);
    if (idx >= 0) batteries[idx] = battery;
    else batteries.push(battery);
    write(KEYS.batteries, batteries);
    await pushAudit('battery_update', 'battery', `Battery "${battery.name}" updated.`, 'Administrator');
  }

  // --- Orders ------------------------------------------------------------
  async listOrders(opts?: { search?: string; limit?: number; offset?: number }): Promise<SavedOrder[]> {
    const orders = read<FullOrder[]>(KEYS.orders, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const q = (opts?.search ?? '').trim().toLowerCase();
    let filtered = orders;
    if (q) {
      filtered = orders.filter(
        (o) =>
          o.orderRef.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q) ||
          o.customerPhone.includes(q),
      );
    }
    const start = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return filtered.slice(start, start + limit).map((o) => toSavedOrder(o));
  }

  async getOrder(id: string): Promise<FullOrder> {
    const orders = read<FullOrder[]>(KEYS.orders, []);
    const order = orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found.');
    return JSON.parse(JSON.stringify(order)) as FullOrder;
  }

  async saveOrder(order: FullOrder): Promise<string> {
    const orders = read<FullOrder[]>(KEYS.orders, []);
    const idx = orders.findIndex((o) => o.id === order.id);
    const stamped = {
      ...order,
      updatedAt: new Date().toISOString(),
      createdAt: order.createdAt || new Date().toISOString(),
    };
    if (idx >= 0) orders[idx] = stamped;
    else orders.unshift(stamped);
    write(KEYS.orders, orders);
    return stamped.id;
  }

  async deleteOrder(id: string): Promise<void> {
    const orders = read<FullOrder[]>(KEYS.orders, []);
    const order = orders.find((o) => o.id === id);
    write(
      KEYS.orders,
      orders.filter((o) => o.id !== id),
    );
    await pushAudit('order_delete', 'order', `Deleted order ${order?.orderRef ?? id}.`, 'Administrator');
  }

  // --- Audit -------------------------------------------------------------
  async fetchAudits(limit = 100): Promise<AuditEntry[]> {
    return read<DemoAuditEntry[]>(KEYS.audits, []).slice(0, limit);
  }
}

function toSavedOrder(o: FullOrder): SavedOrder {
  return {
    id: o.id,
    orderRef: o.orderRef,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    city: o.city,
    status: o.status,
    totalScooters: o.snapshot.allowances.totalScooterQty,
    dlQty: o.snapshot.allowances.dlQty,
    otherQty: o.snapshot.allowances.otherQty,
    batteryQty: o.batteryRows?.reduce((s, r) => s + r.qty, 0) ?? 0,
    distanceKm: o.snapshot.transport.trucks[0]?.distanceKm ?? 0,
    finalTransportPaise: o.snapshot.transport.finalPaise,
    selectedOptionKey: o.snapshot.selectedOptionKey,
    recommendedKey: o.snapshot.recommendation.recommendedKey,
    profitVerified: o.snapshot.options.some((opt) => opt.profitStatus === 'verified'),
    createdBy: o.createdBy,
    createdByName: o.createdByName,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    notes: o.notes,
  };
}
