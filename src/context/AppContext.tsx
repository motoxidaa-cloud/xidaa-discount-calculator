import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildSnapshot, DEFAULT_SETTINGS, evaluateOrder } from '../domain/calculations';
import { buildSeedModels, BATTERY_VARIANTS_SEED } from '../data/catalog';
import type {
  AppSettings,
  BatteryRecord,
  DiscountOptionKey,
  FullOrder,
  ModelRecord,
  OrderDraft,
  SavedOrder,
  TruckAllocation,
} from '../types';
import { getDataAdapter } from '../storage';
import { roleLabel, useRole } from './RoleContext';

export type View = 'home' | 'neworder' | 'orders' | 'settings' | 'results';

export interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error' | 'info';
}

interface AppContextValue {
  ready: boolean;
  dataError: string | null;

  settings: AppSettings;
  models: ModelRecord[];
  batteries: BatteryRecord[];
  refreshCatalog: () => Promise<void>;
  updateSettings: (s: AppSettings) => Promise<void>;
  upsertModel: (m: ModelRecord) => Promise<void>;
  upsertBattery: (b: BatteryRecord) => Promise<void>;

  view: View;
  editingOrderId: string | null;
  viewOrderId: string | null;
  navigate: (v: View) => void;
  openEditOrder: (id: string) => void;
  openViewOrder: (id: string) => void;

  draft: OrderDraft;
  setDraft: (updater: (d: OrderDraft) => OrderDraft) => void;
  resetDraft: () => void;

  orders: SavedOrder[];
  ordersLoaded: boolean;
  ordersError: string | null;
  refreshOrders: () => Promise<void>;

  saveOrder: (selectedOptionKey: DiscountOptionKey | null) => Promise<string>;
  deleteOrder: (id: string) => Promise<void>;

  toasts: Toast[];
  pushToast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function emptyDraft(): OrderDraft {
  return {
    customerName: '',
    customerPhone: '',
    city: '',
    scooterRows: [],
    batteryRows: [],
    trucks: [],
    notes: '',
  };
}

function newRowId(): string {
  return `r${Math.random().toString(36).slice(2, 9)}`;
}

function makeOrderRef(): string {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `XID-${y}${m}${day}-${rand}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { role } = useRole();
  const [ready, setReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<ModelRecord[]>(() => buildSeedModels());
  const [batteries, setBatteries] = useState<BatteryRecord[]>(() => BATTERY_VARIANTS_SEED);

  const [view, setView] = useState<View>('home');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<OrderDraft>(() => emptyDraft());

  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const pushToast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = `t${++toastSeq.current}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const adapter = getDataAdapter();
      const [s, m, b] = await Promise.all([adapter.fetchSettings(), adapter.fetchModels(), adapter.fetchBatteries()]);
      setSettings(s);
      setModels(m.length ? m : buildSeedModels());
      setBatteries(b.length ? b : BATTERY_VARIANTS_SEED);
      setDataError(null);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : 'Failed to load configuration.');
    }
  }, []);

  useEffect(() => {
    if (role) {
      refreshCatalog().finally(() => setReady(true));
    } else {
      setReady(false);
      // Reset per-session UI state on role change.
      setView('home');
      setEditingOrderId(null);
      setViewOrderId(null);
      setDraftState(emptyDraft());
    }
  }, [role, refreshCatalog]);

  const updateSettings = useCallback(
    async (s: AppSettings) => {
      await getDataAdapter().updateSettings(s);
      setSettings(s);
      pushToast('Financial settings saved.', 'success');
    },
    [pushToast],
  );

  const upsertModel = useCallback(
    async (m: ModelRecord) => {
      await getDataAdapter().upsertModel(m);
      setModels((prev) => {
        const idx = prev.findIndex((x) => x.id === m.id);
        const next = [...prev];
        if (idx >= 0) next[idx] = m;
        else next.push(m);
        return next;
      });
      pushToast(`Model "${m.name}" saved.`, 'success');
    },
    [pushToast],
  );

  const upsertBattery = useCallback(
    async (b: BatteryRecord) => {
      await getDataAdapter().upsertBattery(b);
      setBatteries((prev) => {
        const idx = prev.findIndex((x) => x.id === b.id);
        const next = [...prev];
        if (idx >= 0) next[idx] = b;
        else next.push(b);
        return next;
      });
      pushToast(`Battery "${b.name}" saved.`, 'success');
    },
    [pushToast],
  );

  const navigate = useCallback((v: View) => {
    setView(v);
    const hash = v === 'home' ? '' : `#/${v}`;
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
    } catch {
      /* ignore */
    }
  }, []);

  const openEditOrder = useCallback((id: string) => {
    setViewOrderId(null);
    setEditingOrderId(id);
    setView('neworder');
  }, []);

  const openViewOrder = useCallback((id: string) => {
    setEditingOrderId(null);
    setViewOrderId(id);
    setView('results');
  }, []);

  const setDraft = useCallback((updater: (d: OrderDraft) => OrderDraft) => {
    setDraftState((prev) => updater(prev));
  }, []);

  const resetDraft = useCallback(() => {
    setEditingOrderId(null);
    setViewOrderId(null);
    setDraftState(emptyDraft());
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const list = await getDataAdapter().listOrders({ limit: 200 });
      setOrders(list);
      setOrdersError(null);
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : 'Could not load orders.');
    } finally {
      setOrdersLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (role) refreshOrders();
  }, [role, refreshOrders]);

  const saveOrder = useCallback(
    async (selectedOptionKey: DiscountOptionKey | null): Promise<string> => {
      const adapter = getDataAdapter();
      // Build the full order record from the current draft.
      const isEdit = Boolean(editingOrderId);
      const id = editingOrderId || crypto.randomUUID();
      const evaluation = evaluateOrder(draft, models, batteries, settings);
      const full: FullOrder = {
        id,
        orderRef: isEdit ? orders.find((o) => o.id === id)?.orderRef ?? makeOrderRef() : makeOrderRef(),
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        city: draft.city.trim(),
        status: 'saved',
        notes: draft.notes,
        totalScooters: evaluation.allowances.totalScooterQty,
        dlQty: evaluation.allowances.dlQty,
        otherQty: evaluation.allowances.otherQty,
        batteryQty: draft.batteryRows.reduce((s, r) => s + r.qty, 0),
        distanceKm: draft.trucks[0]?.distanceKm ?? 0,
        finalTransportPaise: evaluation.transport.finalPaise,
        selectedOptionKey,
        recommendedKey: evaluation.recommendation.recommendedKey,
        profitVerified: evaluation.profitVerified,
        createdBy: role ?? 'sales',
        createdByName: roleLabel(role),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scooterRows: draft.scooterRows,
        batteryRows: draft.batteryRows,
        trucks: draft.trucks,
        snapshot: buildSnapshot(draft, models, batteries, settings, selectedOptionKey),
      };
      const savedId = await adapter.saveOrder(full);
      await refreshOrders();
      return savedId;
    },
    [draft, models, batteries, settings, editingOrderId, orders, role, refreshOrders],
  );

  const deleteOrder = useCallback(
    async (id: string) => {
      await getDataAdapter().deleteOrder(id);
      await refreshOrders();
      pushToast('Order deleted.', 'success');
    },
    [refreshOrders, pushToast],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      dataError,
      settings,
      models,
      batteries,
      refreshCatalog,
      updateSettings,
      upsertModel,
      upsertBattery,
      view,
      editingOrderId,
      viewOrderId,
      navigate,
      openEditOrder,
      openViewOrder,
      draft,
      setDraft,
      resetDraft,
      orders,
      ordersLoaded,
      ordersError,
      refreshOrders,
      saveOrder,
      deleteOrder,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      ready,
      dataError,
      settings,
      models,
      batteries,
      refreshCatalog,
      updateSettings,
      upsertModel,
      upsertBattery,
      view,
      editingOrderId,
      viewOrderId,
      navigate,
      openEditOrder,
      openViewOrder,
      draft,
      setDraft,
      resetDraft,
      orders,
      ordersLoaded,
      ordersError,
      refreshOrders,
      saveOrder,
      deleteOrder,
      toasts,
      pushToast,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { newRowId };
