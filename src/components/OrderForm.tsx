import { useEffect, useMemo, useState } from 'react';
import { BatteryCharging, Plus, Trash2, Truck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { newRowId } from '../context/AppContext';
import type { OrderBatteryRow, OrderScooterRow, TruckAllocation } from '../types';
import { suggestTrucks } from '../domain/calculations';
import { Badge, Button, Divider, Field, GlassCard, Input, Select } from './ui';
import { QuantitySelector } from './QuantitySelector';

export function OrderForm() {
  const { draft, setDraft, models, batteries, settings, navigate, editingOrderId, openEditOrder, orders, pushToast } = useApp();
  const [loadingOrder, setLoadingOrder] = useState(Boolean(editingOrderId));

  // Load saved order when editing.
  useEffect(() => {
    let cancelled = false;
    if (editingOrderId) {
      setLoadingOrder(true);
      (async () => {
        try {
          const { getDataAdapter } = await import('../storage');
          const order = await getDataAdapter().getOrder(editingOrderId);
          if (!cancelled) {
            setDraft(() => ({
              customerName: order.customerName,
              customerPhone: order.customerPhone ?? '',
              city: order.city ?? '',
              notes: order.notes ?? '',
              scooterRows: order.scooterRows.map((r) => ({ ...r, id: newRowId() })),
              batteryRows: order.batteryRows.map((r) => ({ ...r, id: newRowId() })),
              trucks: order.trucks.map((t) => ({ ...t, id: newRowId() })),
            }));
          }
        } catch {
          if (!cancelled) pushToast('Could not open the saved order.', 'error');
        } finally {
          if (!cancelled) setLoadingOrder(false);
        }
      })();
    } else {
      setLoadingOrder(false);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingOrderId]);

  const activeModels = useMemo(() => models.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder), [models]);
  const activeBatteries = useMemo(() => batteries.filter((b) => b.active), [batteries]);

  const totals = useMemo(() => {
    let dl = 0;
    let other = 0;
    for (const r of draft.scooterRows) {
      if (r.category === 'DL') dl += r.qty;
      else other += r.qty;
    }
    const battery = draft.batteryRows.reduce((s, r) => s + r.qty, 0);
    return { dl, other, total: dl + other, battery };
  }, [draft.scooterRows, draft.batteryRows]);

  const truckCapacity = draft.trucks.reduce((s, t) => s + t.capacity * t.count, 0);
  const capacityWarning = totals.total > 0 && truckCapacity > 0 && truckCapacity < totals.total;
  const hasScooters = totals.total > 0;
  const hasDistance = draft.trucks.some((t) => t.distanceKm > 0);
  const hasTrucks = draft.trucks.length > 0 && draft.trucks.every((t) => t.count > 0);
  const nameOk = draft.customerName.trim().length > 0;
  const valid = nameOk && hasScooters && hasDistance && hasTrucks;

  function addScooterRow() {
    const model = activeModels[0];
    if (!model) return;
    setDraft((d) => ({
      ...d,
      scooterRows: [
        ...d.scooterRows,
        { id: newRowId(), modelId: model.id, modelName: model.name, category: model.category, qty: 1 },
      ],
    }));
  }

  function updateScooterRow(id: string, patch: Partial<OrderScooterRow>) {
    setDraft((d) => ({
      ...d,
      scooterRows: d.scooterRows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function removeScooterRow(id: string) {
    setDraft((d) => ({ ...d, scooterRows: d.scooterRows.filter((r) => r.id !== id) }));
  }

  function addBatteryRow() {
    const b = activeBatteries[0];
    if (!b) return;
    setDraft((d) => ({
      ...d,
      batteryRows: [...d.batteryRows, { id: newRowId(), variantId: b.id, variantName: b.name, capacityAh: b.capacityAh, qty: 1, eligible: true }],
    }));
  }

  function updateBatteryRow(id: string, patch: Partial<OrderBatteryRow>) {
    setDraft((d) => ({ ...d, batteryRows: d.batteryRows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }

  function removeBatteryRow(id: string) {
    setDraft((d) => ({ ...d, batteryRows: d.batteryRows.filter((r) => r.id !== id) }));
  }

  function addTruckRow() {
    const cfg = settings.transport.trucks.find((t) => t.active);
    if (!cfg) return;
    setDraft((d) => ({
      ...d,
      trucks: [
        ...d.trucks,
        {
          id: newRowId(),
          truckConfigId: cfg.id,
          label: cfg.label,
          capacity: cfg.capacity,
          ratePerKmPaise: cfg.ratePerKmPaise,
          count: 1,
          distanceKm: d.trucks[0]?.distanceKm ?? 0,
        },
      ],
    }));
  }

  function updateTruckAlloc(id: string, patch: Partial<TruckAllocation>) {
    setDraft((d) => ({ ...d, trucks: d.trucks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }

  function removeTruck(id: string) {
    setDraft((d) => ({ ...d, trucks: d.trucks.filter((t) => t.id !== id) }));
  }

  function applySuggestion() {
    const suggestion = suggestTrucks(totals.total, settings.transport.trucks);
    if (suggestion.length === 0) return;
    const distance = draft.trucks[0]?.distanceKm ?? 0;
    setDraft((d) => ({
      ...d,
      trucks: suggestion.map((s) => ({
        id: newRowId(),
        truckConfigId: s.truckConfigId,
        label: s.label,
        capacity: s.capacity,
        ratePerKmPaise: s.ratePerKmPaise,
        count: s.count,
        distanceKm: distance,
      })),
    }));
  }

  function goToResults() {
    if (!valid) return;
    navigate('results');
  }

  if (loadingOrder) {
    return <div className="py-20 text-center text-slate-400 text-sm">Loading order…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Customer */}
      <GlassCard className="p-4 sm:p-5">
        <h2 className="text-[15px] font-bold text-slate-800 mb-3">Customer / Dealer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Customer name" required>
            <Input
              value={draft.customerName}
              onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))}
              placeholder="e.g. Sharma Auto Motors"
              invalid={!nameOk}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={draft.customerPhone}
              onChange={(e) => setDraft((d) => ({ ...d, customerPhone: e.target.value }))}
              placeholder="Optional"
              inputMode="tel"
            />
          </Field>
          <Field label="City">
            <Input
              value={draft.city}
              onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
              placeholder="Optional"
            />
          </Field>
        </div>
      </GlassCard>

      {/* Scooters */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-slate-800">Scooters</h2>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Badge tone="brand">DL: {totals.dl}</Badge>
            <Badge tone="info">Other: {totals.other}</Badge>
            <Badge tone="neutral">Total: {totals.total}</Badge>
          </div>
        </div>

        {draft.scooterRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400">
            Add at least one scooter model to build the order.
          </div>
        )}

        <div className="space-y-3">
          {draft.scooterRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 sm:p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Select
                    value={row.modelId}
                    onChange={(e) => {
                      const model = models.find((m) => m.id === e.target.value);
                      if (model) updateScooterRow(row.id, { modelId: model.id, modelName: model.name, category: model.category });
                    }}
                  >
                    {(['DL', 'Other'] as const).map((cat) => (
                      <optgroup key={cat} label={`${cat} models`}>
                        {activeModels
                          .filter((m) => m.category === cat)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Select>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={row.category === 'DL' ? 'brand' : 'info'}>{row.category} Model</Badge>
                    <span className="text-xs text-slate-400">{row.modelName}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => removeScooterRow(row.id)}
                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 grid place-items-center transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <QuantitySelector value={row.qty} onChange={(v) => updateScooterRow(row.id, { qty: v })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="secondary" onClick={addScooterRow} className="mt-3 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add scooter model
        </Button>
      </GlassCard>

      {/* Batteries */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
            <BatteryCharging className="w-4.5 h-4.5 text-green-600" /> Batteries
          </h2>
          <Badge tone="neutral">Separate from scooters</Badge>
        </div>

        {draft.batteryRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-5 text-center text-sm text-slate-400">
            Battery quantity is independent of scooter quantity. Add batteries when the order includes them.
          </div>
        )}

        <div className="space-y-3">
          {draft.batteryRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <Select
                  value={row.variantId}
                  onChange={(e) => {
                    const b = batteries.find((x) => x.id === e.target.value);
                    if (b) updateBatteryRow(row.id, { variantId: b.id, variantName: b.name, capacityAh: b.capacityAh });
                  }}
                >
                  {activeBatteries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={row.eligible}
                  onChange={(e) => updateBatteryRow(row.id, { eligible: e.target.checked })}
                  className="w-4 h-4 accent-green-600"
                />
                Eligible
              </label>
              <QuantitySelector value={row.qty} onChange={(v) => updateBatteryRow(row.id, { qty: v })} label="Qty" />
              <button
                onClick={() => removeBatteryRow(row.id)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 grid place-items-center transition-colors"
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <Button variant="secondary" onClick={addBatteryRow} className="mt-3">
          <Plus className="w-4 h-4" /> Add battery variant
        </Button>
      </GlassCard>

      {/* Transport */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-4.5 h-4.5 text-green-600" /> Transport
          </h2>
          {draft.scooterRows.length > 0 && (
            <Button variant="secondary" size="sm" onClick={applySuggestion}>
              Auto-allocate trucks
            </Button>
          )}
        </div>

        {draft.trucks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-5 text-center text-sm text-slate-400 mb-3">
            Add a truck and enter the transport distance. Multiple trucks are supported.
          </div>
        )}

        <div className="space-y-3">
          {draft.trucks.map((truck) => (
            <div key={truck.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3 space-y-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <Select
                    value={truck.truckConfigId}
                    onChange={(e) => {
                      const cfg = settings.transport.trucks.find((t) => t.id === e.target.value);
                      if (cfg)
                        updateTruckAlloc(truck.id, {
                          truckConfigId: cfg.id,
                          label: cfg.label,
                          capacity: cfg.capacity,
                          ratePerKmPaise: cfg.ratePerKmPaise,
                        });
                    }}
                  >
                    {settings.transport.trucks
                      .filter((t) => t.active)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} — ₹{(t.ratePerKmPaise / 100).toLocaleString('en-IN')}/km
                        </option>
                      ))}
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400">Trucks</span>
                  <QuantitySelector value={truck.count} onChange={(v) => updateTruckAlloc(truck.id, { count: v })} label="Count" />
                </div>
                <button
                  onClick={() => removeTruck(truck.id)}
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 grid place-items-center transition-colors"
                  aria-label="Remove truck"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Field label="Transport distance (km)" required>
                <Input
                  type="number"
                  min={1}
                  value={truck.distanceKm || ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const distance = Number.isFinite(v) ? Math.max(0, v) : 0;
                    setDraft((d) => ({
                      ...d,
                      trucks: d.trucks.map((t) => ({ ...t, distanceKm: distance })),
                    }));
                  }}
                  placeholder="e.g. 500"
                  invalid={!hasDistance}
                />
              </Field>
            </div>
          ))}
        </div>

        <Button variant="secondary" onClick={addTruckRow} className="mt-3">
          <Plus className="w-4 h-4" /> Add another truck
        </Button>

        {capacityWarning && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[13px] px-3.5 py-2.5">
            Truck capacity ({truckCapacity}) is less than total scooters ({totals.total}). Add more trucks or adjust counts.
          </div>
        )}
      </GlassCard>

      <Divider />

      <div className="flex flex-col sm:flex-row gap-3 pb-2">
        <Button size="lg" fullWidth onClick={goToResults} disabled={!valid}>
          View Discount Options
        </Button>
        {!valid && (
          <p className="text-[13px] text-slate-400 text-center sm:text-right sm:self-center">
            {!nameOk ? 'Add a customer name. ' : ''}
            {!hasScooters ? 'Add at least one scooter. ' : ''}
            {!hasTrucks ? 'Add a truck. ' : ''}
            {!hasDistance ? 'Enter transport distance. ' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
