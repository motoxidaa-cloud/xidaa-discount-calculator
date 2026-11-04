import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { History, Lock, Plus, Save, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import type { AppSettings, AuditEntry, BatteryRecord, DiscountOptionKey, ModelRecord } from '../types';
import { rupeesToPaise } from '../utils/currency';
import { Badge, Button, Field, GlassCard, Input, Modal, Select, Spinner } from './ui';

type Tab = 'models' | 'discounts' | 'transport' | 'profit' | 'audit';

const TABS: { key: Tab; label: string; icon: typeof Wrench }[] = [
  { key: 'models', label: 'Scooter Models', icon: Wrench },
  { key: 'discounts', label: 'Discounts', icon: Wrench },
  { key: 'transport', label: 'Transport', icon: Wrench },
  { key: 'profit', label: 'Profit Protection', icon: Wrench },
  { key: 'audit', label: 'Audit Log', icon: History },
];

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

export function SettingsScreen() {
  const { role } = useRole();
  const [tab, setTab] = useState<Tab>('models');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  if (role !== 'admin') {
    return (
      <GlassCard className="p-8 text-center">
        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h2 className="text-[16px] font-bold text-slate-700">Administrator access required</h2>
        <p className="text-sm text-slate-400 mt-1">Financial rules and user management are restricted to administrators.</p>
      </GlassCard>
    );
  }

  function requireConfirm(state: ConfirmState) {
    setConfirm(state);
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

      const tabContent: Record<Tab, ReactNode> = {
    models: <ModelsTab requireConfirm={requireConfirm} />,
    discounts: <DiscountsTab requireConfirm={requireConfirm} />,
    transport: <TransportTab requireConfirm={requireConfirm} />,
    profit: <ProfitTab requireConfirm={requireConfirm} />,
    audit: <AuditTab />,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Settings</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">Financial rules, catalogue configuration and team access</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-semibold transition-colors ${
              tab === t.key ? 'bg-teal-600 text-white shadow-md' : 'bg-white/70 text-slate-500 hover:text-slate-800 border border-white/60'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tabContent[tab]}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button onClick={runConfirm} loading={busy}>{confirm?.confirmLabel ?? 'Confirm'}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirm?.message}</p>
        <p className="text-[13px] text-amber-600 mt-3 font-medium">This change will be recorded in the audit log.</p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

function ModelsTab({ requireConfirm }: { requireConfirm: (s: ConfirmState) => void }) {
  const { models, upsertModel, pushToast } = useApp();
  const [drafts, setDrafts] = useState<Record<string, ModelRecord>>({});
  const [newName, setNewName] = useState('');

  function draftOf(m: ModelRecord): ModelRecord {
    return drafts[m.id] ?? m;
  }

  function patch(id: string, patch: Partial<ModelRecord>) {
    setDrafts((prev) => {
      const base = models.find((m) => m.id === id);
      return { ...prev, [id]: { ...(prev[id] ?? base!), ...patch } };
    });
  }

  function rupeeToPaiseInput(v: string): number | null {
    if (v.trim() === '') return null;
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? rupeesToPaise(n) : null;
  }

  function saveModel(m: ModelRecord) {
    const draft = draftOf(m);
    const changedFinancial = draft.approvedPricePaise !== m.approvedPricePaise || draft.costPaise !== m.costPaise;
    const doSave = () => upsertModel(draft).then(() => setDrafts((prev) => ({ ...prev, [m.id]: draft })));
    if (changedFinancial) {
      requireConfirm({
        title: 'Change approved price / cost',
        message: `Update price and cost data for ${draft.name}? Profitability calculations for future orders will use these values.`,
        confirmLabel: 'Save changes',
        onConfirm: doSave,
      });
    } else {
      void doSave();
    }
  }

  function addModel() {
    const name = newName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `model-${Date.now()}`;
    const existing = models.find((m) => m.id === slug);
    if (existing) {
      pushToast('A model with this name already exists.', 'error');
      return;
    }
    void upsertModel({ id: slug, name, category: 'Other', approvedPricePaise: null, costPaise: null, active: true, sortOrder: models.length });
    setNewName('');
  }

  return (
    <GlassCard className="p-4 sm:p-5">
      <p className="text-[13px] text-slate-500 mb-4">
        Map every model to <span className="font-bold text-slate-700">DL</span> or <span className="font-bold text-slate-700">Other</span> and configure approved selling prices and procurement/manufacturing costs. Leave price/cost empty while they are unknown â€” profitability then shows as Not Verified.
      </p>
      <div className="space-y-3">
        {models.map((m) => {
          const d = draftOf(m);
          return (
            <div key={m.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <p className="text-sm font-bold text-slate-800">{d.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{m.id}</p>
                </div>
                <Field label="Category">
                  <Select value={d.category} onChange={(e) => patch(m.id, { category: e.target.value as 'DL' | 'Other' })} className="h-10">
                    <option value="Other">Other Model</option>
                    <option value="DL">DL Model</option>
                  </Select>
                </Field>
                <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 cursor-pointer select-none mt-5">
                  <input type="checkbox" checked={d.active} onChange={(e) => patch(m.id, { active: e.target.checked })} className="w-4 h-4 accent-green-600" />
                  Active
                </label>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Approved selling price (â‚¹)">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={d.approvedPricePaise == null ? '' : (d.approvedPricePaise / 100).toFixed(0)}
                    onChange={(e) => patch(m.id, { approvedPricePaise: rupeeToPaiseInput(e.target.value) })}
                    placeholder="Not set"
                  />
                </Field>
                <Field label="Procurement / manufacturing cost (â‚¹)">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={d.costPaise == null ? '' : (d.costPaise / 100).toFixed(0)}
                    onChange={(e) => patch(m.id, { costPaise: rupeeToPaiseInput(e.target.value) })}
                    placeholder="Not set"
                  />
                </Field>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => saveModel(m)} disabled={JSON.stringify(d) === JSON.stringify(m)}>
                  <Save className="w-4 h-4" /> Save model
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4">
        <p className="text-[13px] font-semibold text-slate-600 mb-2">Add a new model</p>
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. X-New Model" className="flex-1" />
          <Button onClick={addModel} disabled={!newName.trim()}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </div>

      {/* Battery catalogue */}
      <BatteryCatalogue requireConfirm={requireConfirm} />
    </GlassCard>
  );
}

function BatteryCatalogue({ requireConfirm }: { requireConfirm: (s: ConfirmState) => void }) {
  const { batteries, upsertBattery } = useApp();
  const [drafts, setDrafts] = useState<Record<string, BatteryRecord>>({});

  function draftOf(b: BatteryRecord): BatteryRecord {
    return drafts[b.id] ?? b;
  }

  function patch(id: string, patch: Partial<BatteryRecord>) {
    setDrafts((prev) => {
      const base = batteries.find((b) => b.id === id);
      return { ...prev, [id]: { ...(prev[id] ?? base!), ...patch } };
    });
  }

  function rupeeToPaiseInput(v: string): number | null {
    if (v.trim() === '') return null;
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? rupeesToPaise(n) : null;
  }

  function save(b: BatteryRecord) {
    const draft = draftOf(b);
    const changedFinancial = draft.approvedPricePaise !== b.approvedPricePaise || draft.costPaise !== b.costPaise;
    const doSave = () => upsertBattery(draft).then(() => setDrafts((prev) => ({ ...prev, [b.id]: draft })));
    if (changedFinancial) {
      requireConfirm({
        title: 'Change battery price / cost',
        message: `Update approved price and cost for ${draft.name}? Profitability calculations for future orders will use these values.`,
        confirmLabel: 'Save changes',
        onConfirm: doSave,
      });
    } else {
      void doSave();
    }
  }

  return (
    <div className="mt-6">
      <h3 className="text-[15px] font-bold text-slate-800 mb-1">Battery Catalogue</h3>
      <p className="text-[13px] text-slate-500 mb-3">Approved battery prices and costs are used for profitability verification.</p>
      <div className="space-y-3">
        {batteries.map((b) => {
          const d = draftOf(b);
          return (
            <div key={b.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-800">{d.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{b.id}</p>
                </div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={d.active} onChange={(e) => patch(b.id, { active: e.target.checked })} className="w-4 h-4 accent-green-600" />
                  Active
                </label>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Approved selling price (â‚¹)">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={d.approvedPricePaise == null ? '' : (d.approvedPricePaise / 100).toFixed(0)}
                    onChange={(e) => patch(b.id, { approvedPricePaise: rupeeToPaiseInput(e.target.value) })}
                    placeholder="Not set"
                  />
                </Field>
                <Field label="Battery cost (â‚¹)">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={d.costPaise == null ? '' : (d.costPaise / 100).toFixed(0)}
                    onChange={(e) => patch(b.id, { costPaise: rupeeToPaiseInput(e.target.value) })}
                    placeholder="Not set"
                  />
                </Field>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => save(b)} disabled={JSON.stringify(d) === JSON.stringify(b)}>
                  <Save className="w-4 h-4" /> Save battery
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

function DiscountsTab({ requireConfirm }: { requireConfirm: (s: ConfirmState) => void }) {
  const { settings, updateSettings } = useApp();
  const [s, setS] = useState<AppSettings>(settings);

  useEffect(() => setS(settings), [settings]);

  function save() {
    requireConfirm({
      title: 'Update discount rules',
      message: 'These values affect all future order calculations. Current saved orders keep their original calculation snapshots.',
      confirmLabel: 'Save discount rules',
      onConfirm: () => updateSettings(s),
    });
  }

  return (
    <GlassCard className="p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="DL model discount (â‚¹ per scooter)" hint="Default â‚¹500">
          <Input type="number" min={0} step="any" value={s.discounts.dlDiscountPaise / 100} onChange={(e) => setS({ ...s, discounts: { ...s.discounts, dlDiscountPaise: rupeesToPaise(parseFloat(e.target.value)) } })} />
        </Field>
        <Field label="Other model discount (â‚¹ per scooter)" hint="Default â‚¹1,000">
          <Input type="number" min={0} step="any" value={s.discounts.otherDiscountPaise / 100} onChange={(e) => setS({ ...s, discounts: { ...s.discounts, otherDiscountPaise: rupeesToPaise(parseFloat(e.target.value)) } })} />
        </Field>
        <Field label="Battery discount (â‚¹ per eligible battery)" hint="Default â‚¹500">
          <Input type="number" min={0} step="any" value={s.discounts.batteryDiscountPaise / 100} onChange={(e) => setS({ ...s, discounts: { ...s.discounts, batteryDiscountPaise: rupeesToPaise(parseFloat(e.target.value)) } })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Transport support percentage" hint="Company share of final transport cost">
          <Input type="number" min={0} max={100} value={s.discounts.transportSupportPercent} onChange={(e) => setS({ ...s, discounts: { ...s.discounts, transportSupportPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) } })} />
        </Field>
        <Field label="Fallback recommendation preference" hint="Used when profitability cannot be verified (missing price/cost data)">
          <Select value={s.discounts.fallbackPreference} onChange={(e) => setS({ ...s, discounts: { ...s.discounts, fallbackPreference: e.target.value as DiscountOptionKey } })}>
            <option value="scooter_discount">Scooter price discount</option>
            <option value="transport_support">50% transport support</option>
            <option value="no_discount">No discount</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={JSON.stringify(s) === JSON.stringify(settings)}>
          <Save className="w-4 h-4" /> Save discount rules
        </Button>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function TransportTab({ requireConfirm }: { requireConfirm: (s: ConfirmState) => void }) {
  const { settings, updateSettings } = useApp();
  const [s, setS] = useState<AppSettings>(settings);

  useEffect(() => setS(settings), [settings]);

  function patchTruck(id: string, patch: Partial<AppSettings['transport']['trucks'][number]>) {
    setS((prev) => ({
      ...prev,
      transport: { ...prev.transport, trucks: prev.transport.trucks.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
    }));
  }

  function save() {
    requireConfirm({
      title: 'Update transport rules',
      message: 'Truck rates, capacities and tax percentages affect all future transport calculations.',
      confirmLabel: 'Save transport rules',
      onConfirm: () => updateSettings(s),
    });
  }

  return (
    <GlassCard className="p-4 sm:p-5 space-y-4">
      <p className="text-[13px] text-slate-500">Configure truck capacities and per-km rates. The suggested allocation in the order form uses these capacities.</p>
      <div className="space-y-3">
        {s.transport.trucks.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Field label="Label">
              <Input value={t.label} onChange={(e) => patchTruck(t.id, { label: e.target.value })} />
            </Field>
            <Field label="Capacity (scooters)">
              <Input type="number" min={1} value={t.capacity} onChange={(e) => patchTruck(t.id, { capacity: Math.max(1, parseInt(e.target.value) || 1) })} />
            </Field>
            <Field label="Rate â‚¹/km">
              <Input type="number" min={0} step="any" value={t.ratePerKmPaise / 100} onChange={(e) => patchTruck(t.id, { ratePerKmPaise: rupeesToPaise(parseFloat(e.target.value)) })} />
            </Field>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={t.active} onChange={(e) => patchTruck(t.id, { active: e.target.checked })} className="w-4 h-4 accent-green-600" />
                Active
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Additional charge %" hint="Default 10%">
          <Input type="number" min={0} max={100} value={s.transport.surchargePercent} onChange={(e) => setS({ ...s, transport: { ...s.transport, surchargePercent: Math.max(0, parseFloat(e.target.value) || 0) } })} />
        </Field>
        <Field label="Transport GST %" hint="Default 5%">
          <Input type="number" min={0} max={100} value={s.transport.gstPercent} onChange={(e) => setS({ ...s, transport: { ...s.transport, gstPercent: Math.max(0, parseFloat(e.target.value) || 0) } })} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={JSON.stringify(s) === JSON.stringify(settings)}>
          <Save className="w-4 h-4" /> Save transport rules
        </Button>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Profit protection
// ---------------------------------------------------------------------------

function ProfitTab({ requireConfirm }: { requireConfirm: (s: ConfirmState) => void }) {
  const { settings, updateSettings } = useApp();
  const [s, setS] = useState<AppSettings>(settings);

  useEffect(() => setS(settings), [settings]);

  function save() {
    requireConfirm({
      title: 'Update profit protection rules',
      message: 'The minimum profit requirement is used by the recommendation engine to decide whether a strategy is acceptable.',
      confirmLabel: 'Save profit rules',
      onConfirm: () => updateSettings(s),
    });
  }

  return (
    <GlassCard className="p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Minimum profit mode">
          <Select value={s.profit.minProfitMode} onChange={(e) => setS({ ...s, profit: { ...s.profit, minProfitMode: e.target.value as 'amount' | 'margin' } })}>
            <option value="amount">Minimum profit amount</option>
            <option value="margin">Minimum profit margin (%)</option>
          </Select>
        </Field>
        <Field label="Minimum profit amount (â‚¹)" hint="Recommended by the recommendation engine">
          <Input type="number" min={0} step="any" value={s.profit.minProfitAmountPaise / 100} onChange={(e) => setS({ ...s, profit: { ...s.profit, minProfitAmountPaise: rupeesToPaise(parseFloat(e.target.value)) } })} />
        </Field>
        <Field label="Minimum profit margin (%)">
          <Input type="number" min={0} max={100} step="any" value={s.profit.minProfitMarginPercent} onChange={(e) => setS({ ...s, profit: { ...s.profit, minProfitMarginPercent: Math.max(0, parseFloat(e.target.value) || 0) } })} />
        </Field>
        <Field label="Other company expenses per order (â‚¹)" hint="Flat expenses (e.g. handling) included in every calculation">
          <Input type="number" min={0} step="any" value={s.profit.companyExpensesPaise / 100} onChange={(e) => setS({ ...s, profit: { ...s.profit, companyExpensesPaise: rupeesToPaise(parseFloat(e.target.value)) } })} />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-[14px] font-medium text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={s.profit.gstRecoverable}
          onChange={(e) => setS({ ...s, profit: { ...s.profit, gstRecoverable: e.target.checked } })}
          className="w-4.5 h-4.5 accent-green-600"
        />
        Transport GST is recoverable (company transport expense excludes GST)
      </label>
      <div className="flex justify-end">
        <Button onClick={save} disabled={JSON.stringify(s) === JSON.stringify(settings)}>
          <Save className="w-4 h-4" /> Save profit rules
        </Button>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

let adapterPromise: Promise<import('../storage/types').DataAdapter> | null = null;
function dataAdapter(): Promise<import('../storage/types').DataAdapter> {
  adapterPromise ??= import('../storage').then((m) => m.getDataAdapter());
  return adapterPromise;
}


// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await (await dataAdapter()).fetchAudits(200);
        if (!cancelled) setEntries(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load audit log.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner label="Loading audit historyâ€¦" />;
  if (error) return <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">{error}</div>;

  const actionTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'brand'> = {
    settings_update: 'warning',
    model_update: 'warning',
    battery_update: 'warning',
    user_create: 'brand',
    user_update: 'brand',
    pin_change: 'brand',
    order_delete: 'danger',
    login_success: 'success',
    login_failure: 'danger',
    logout: 'neutral',
  };

  return (
    <GlassCard className="p-4 sm:p-5">
      <p className="text-[13px] text-slate-500 mb-4">All financial rule changes, user management actions and security events are recorded here.</p>
      <div className="divide-y divide-slate-100">
        {entries.map((e) => (
          <div key={e.id} className="py-3 flex items-start gap-3">
            <Badge tone={actionTone[e.action] ?? 'neutral'} className="mt-0.5 shrink-0">{e.action}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] text-slate-700">{e.details}</p>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                {e.entity} Â· {e.actorName} Â· {new Date(e.actedAt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No audit entries yet.</p>}
      </div>
    </GlassCard>
  );
}
