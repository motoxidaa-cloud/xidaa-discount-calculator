import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, Info, Save, Sparkles, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { evaluateOrder } from '../domain/calculations';
import type { DiscountOption, DiscountOptionKey, FullOrder, OrderDraft } from '../types';
import { formatINR, formatIndianNumber } from '../utils/currency';
import { Badge, Button, Divider, ExpandableSection, GlassCard, Money, MoneyLarge, Modal } from './ui';
import { generateOrderPdf } from './PdfExport';

interface ResultsScreenProps {
  mode: 'compute' | 'snapshot';
  order?: FullOrder;
}

const OPTION_ORDER: DiscountOptionKey[] = ['scooter_discount', 'transport_support', 'no_discount'];

export function ResultsScreen({ mode, order }: ResultsScreenProps) {
  const { draft, models, batteries, settings, navigate, saveOrder, editingOrderId, viewOrderId, openEditOrder, pushToast } = useApp();
  const [loadedOrder, setLoadedOrder] = useState<FullOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Load the saved order when viewing a snapshot.
  useEffect(() => {
    let cancelled = false;
    if (mode === 'snapshot' && viewOrderId) {
      setLoadingOrder(true);
      (async () => {
        try {
          const { getDataAdapter } = await import('../storage');
          const o = await getDataAdapter().getOrder(viewOrderId);
          if (!cancelled) setLoadedOrder(o);
        } catch {
          if (!cancelled) pushToast('Could not load the saved order.', 'error');
        } finally {
          if (!cancelled) setLoadingOrder(false);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, viewOrderId]);

  const effectiveOrder = mode === 'snapshot' ? (order ?? loadedOrder) : undefined;
  const snapshot = effectiveOrder ? effectiveOrder.snapshot : undefined;
  const evaluation = useMemo(() => {
    if (mode === 'snapshot' && snapshot) return null;
    return evaluateOrder(draft, models, batteries, settings);
  }, [mode, snapshot, draft, models, batteries, settings]);

  const [selectedKey, setSelectedKey] = useState<DiscountOptionKey | null>(() => {
    if (mode === 'snapshot' && snapshot) return snapshot.selectedOptionKey ?? snapshot.recommendation.recommendedKey;
    return null;
  });
  const [saving, setSaving] = useState(false);
  const [savedRef, setSavedRef] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showSaveError, setShowSaveError] = useState<string | null>(null);

  if (mode === 'snapshot' && loadingOrder && !effectiveOrder) {
    return <div className="py-20 text-center text-slate-400 text-sm">Loading saved order…</div>;
  }
  if (mode === 'snapshot' && !effectiveOrder) {
    return <div className="py-20 text-center text-slate-400 text-sm">Order not found.</div>;
  }

  const options: DiscountOption[] = evaluation ? evaluation.options : (snapshot?.options ?? []);
  const recommendation = evaluation ? evaluation.recommendation : (snapshot?.recommendation ?? { recommendedKey: null, provisional: false, rationale: '' });
  const allowances = evaluation ? evaluation.allowances : (snapshot?.allowances ?? null);
  const transport = evaluation ? evaluation.transport : (snapshot?.transport ?? null);
  const batteryOptionPresent = evaluation ? evaluation.batteryOptionPresent : Boolean(snapshot && snapshot.allowances.batteryEligibleQty > 0);

  const activeSelection: DiscountOptionKey | null = selectedKey ?? recommendation.recommendedKey;
  const selectedOption = options.find((o) => o.key === activeSelection) ?? null;

  async function handleSave() {
    if (mode === 'snapshot') return;
    setSaving(true);
    setShowSaveError(null);
    try {
      const id = await saveOrder(activeSelection);
      if (editingOrderId) {
        setSavedRef(editingOrderId);
      } else {
        setSavedRef(id);
      }
      pushToast('Order saved.', 'success');
      // Refresh order list so Saved Orders is current.
      const { getDataAdapter } = await import('../storage');
      await getDataAdapter().listOrders({ limit: 1 }).catch(() => undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The order could not be saved.';
      setShowSaveError(message);
      pushToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePdf() {
    setPdfBusy(true);
    try {
      const targetOrder =
        mode === 'snapshot' && effectiveOrder
          ? effectiveOrder
          : {
              id: editingOrderId ?? '',
              orderRef: editingOrderId ? `Editing ${editingOrderId.slice(0, 8)}` : 'DRAFT',
              customerName: draft.customerName,
              customerPhone: draft.customerPhone,
              city: draft.city,
              status: 'saved' as const,
              notes: draft.notes,
              totalScooters: draft.scooterRows.reduce((s, r) => s + r.qty, 0),
              dlQty: allowances?.dlQty ?? 0,
              otherQty: allowances?.otherQty ?? 0,
              batteryQty: draft.batteryRows.reduce((s, r) => s + r.qty, 0),
              distanceKm: draft.trucks[0]?.distanceKm ?? 0,
              finalTransportPaise: transport?.finalPaise ?? 0,
              selectedOptionKey: activeSelection,
              recommendedKey: recommendation.recommendedKey,
              profitVerified: evaluation?.profitVerified ?? Boolean(snapshot?.options.some((o) => o.profitStatus === 'verified')),              createdBy: '',
              createdByName: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              scooterRows: draft.scooterRows,
              batteryRows: draft.batteryRows,
              trucks: draft.trucks,
              snapshot: evaluation
                ? (await import('../domain/calculations')).buildSnapshot(draft, models, batteries, settings, activeSelection)
                : snapshot!,
            };
      const bytes = await generateOrderPdf(targetOrder as FullOrder, activeSelection);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${targetOrder.orderRef.replace(/\s+/g, '-')}-summary.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      pushToast('PDF generated.', 'success');
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'PDF generation failed.', 'error');
    } finally {
      setPdfBusy(false);
    }
  }

  if (!transport || !allowances) {
    return <div className="py-20 text-center text-slate-400 text-sm">Calculation not available.</div>;
  }

  const selectedOptionLabel = selectedOption ? selectedOption.title : null;

  return (
    <div className="space-y-4 mb-24 md:mb-0">
      {/* Back row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => (mode === 'snapshot' ? navigate('orders') : navigate('neworder'))}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {mode === 'snapshot' ? 'Saved Orders' : 'Edit order'}
        </button>
        {mode === 'compute' && (
          <Badge tone="warning">Internal calculation — subject to approval</Badge>
        )}
      </div>

      {/* ORDER SUMMARY */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-[15px] font-bold text-slate-800">Order Summary</h2>
          {(mode === 'snapshot' && effectiveOrder) && (
            <Badge tone="brand">{effectiveOrder.orderRef}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
          <div>
            <p className="text-slate-400 text-xs font-medium">Customer</p>
            <p className="font-semibold text-slate-800 mt-0.5 truncate">{mode === 'snapshot' && effectiveOrder ? effectiveOrder.customerName : draft.customerName || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium">Scooters</p>
            <p className="font-semibold text-slate-800 mt-0.5">{formatIndianNumber(allowances.totalScooterQty)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium">DL / Other</p>
            <p className="font-semibold text-slate-800 mt-0.5">
              {allowances.dlQty} / {allowances.otherQty}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium">Batteries</p>
            <p className="font-semibold text-slate-800 mt-0.5">{formatIndianNumber(allowances.batteryEligibleQty)} eligible</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium">Distance</p>
            <p className="font-semibold text-slate-800 mt-0.5">{formatIndianNumber(transport.trucks[0]?.distanceKm ?? 0)} km</p>
          </div>
          <div className="col-span-2">
            <p className="text-slate-400 text-xs font-medium">Truck allocation</p>
            <p className="font-semibold text-slate-800 mt-0.5">
              {transport.trucks.map((t) => `${t.count}×${t.capacity}`).join(' · ') || '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium">Phone</p>
            <p className="font-semibold text-slate-800 mt-0.5 truncate">
              {mode === 'snapshot' && effectiveOrder ? effectiveOrder.customerPhone || '—' : draft.customerPhone || '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium">City</p>
            <p className="font-semibold text-slate-800 mt-0.5 truncate">
              {mode === 'snapshot' && effectiveOrder ? effectiveOrder.city || '—' : draft.city || '—'}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* TRANSPORT COST */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-[15px] font-bold text-slate-800">Transport Cost</h2>
          <MoneyLarge paise={transport.finalPaise} className="text-2xl text-slate-900" />
        </div>
        <div className="mt-3">
          <ExpandableSection title="View Calculation Details">
            <div className="space-y-1.5 text-[13.5px]">
              {transport.trucks.map((t) => (
                <div key={t.truckConfigId + t.count + t.distanceKm} className="flex items-center justify-between text-slate-600">
                  <span>
                    {t.label} × {t.count} · {formatIndianNumber(t.distanceKm)} km · ₹{(t.ratePerKmPaise / 100).toLocaleString('en-IN')}/km
                  </span>
                  <span className="font-semibold tabular-nums text-slate-700">{formatINR(t.totalPaise)}</span>
                </div>
              ))}
              <Divider className="my-1.5" />
              <div className="flex items-center justify-between text-slate-600">
                <span>Base transport</span>
                <span className="font-semibold tabular-nums">{formatINR(transport.basePaise)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Additional 10%</span>
                <span className="font-semibold tabular-nums">{formatINR(transport.surchargePaise)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Transport subtotal</span>
                <span className="font-semibold tabular-nums">{formatINR(transport.subtotalPaise)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>GST 5%</span>
                <span className="font-semibold tabular-nums">{formatINR(transport.gstPaise)}</span>
              </div>
              <Divider className="my-1.5" />
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Final transport</span>
                <span className="tabular-nums">{formatINR(transport.finalPaise)}</span>
              </div>
            </div>
          </ExpandableSection>
        </div>
      </GlassCard>

      {/* DISCOUNT OPTIONS */}
      <div>
        <h2 className="text-[15px] font-bold text-slate-800 mb-3">Available Discount Options</h2>
        {recommendation.recommendedKey && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3">
            <Sparkles className="w-4.5 h-4.5 text-teal-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[13.5px] font-bold text-teal-800">
                Recommended strategy: {options.find((o) => o.key === recommendation.recommendedKey)?.title}
              </p>
              <p className="text-[13px] text-teal-700/80 mt-0.5">{recommendation.rationale}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {options.map((opt) => (
            <OptionCard
              key={opt.key}
              option={opt}
              recommended={recommendation.recommendedKey === opt.key}
              selected={activeSelection === opt.key}
              onSelect={() => {
                if (opt.eligible) setSelectedKey(opt.key);
              }}
              selectable={mode === 'compute' && opt.eligible}
            />
          ))}
        </div>

        {batteryOptionPresent && (
          <GlassCard className="mt-3 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="success">Option D</Badge>
                <p className="text-sm font-bold text-slate-800">Battery Discount</p>
              </div>
              <Money paise={allowances.batteryDiscountPaise} />
            </div>
            <p className="text-[13px] text-slate-500 mt-1.5">
              {formatIndianNumber(allowances.batteryEligibleQty)} eligible batteries × ₹{formatIndianNumber((settings.discounts.batteryDiscountPaise) / 100)}. This discount is separate and is included in every option above — it does not qualify the order for transport sharing.
            </p>
          </GlassCard>
        )}

        {!evaluation?.profitVerified && mode === 'compute' && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <Info className="w-4.5 h-4.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[13.5px] text-amber-800">
              <span className="font-bold">Profitability Not Verified</span> — Administrator cost data required (approved prices and costs are not configured for every item in this order).
            </p>
          </div>
        )}
      </div>

      <Divider />

      {/* ACTIONS */}
      <div className="space-y-3">
        {selectedOption && (
          <div className="rounded-xl border border-slate-200 bg-white/70 backdrop-blur px-4 py-3.5 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[13px] text-slate-400 font-medium">Selected strategy</p>
              <p className="text-sm font-bold text-slate-800">{selectedOptionLabel}</p>
            </div>
            <Badge tone={selectedOption.eligible ? 'success' : 'danger'}>{selectedOption.eligible ? 'Eligible' : 'Not eligible'}</Badge>
          </div>
        )}

        {mode === 'compute' && (
          <Button size="lg" fullWidth onClick={handleSave} loading={saving} disabled={!selectedOption?.eligible}>
            <Save className="w-4.5 h-4.5" />
            {recommendation.recommendedKey === activeSelection && selectedOption?.eligible
              ? 'Use Recommended Option'
              : 'Use This Option'}
          </Button>
        )}

        <div className="flex gap-2.5">
          <Button variant="secondary" size="lg" onClick={handlePdf} loading={pdfBusy} className="flex-1">
            <Download className="w-4.5 h-4.5" /> PDF
          </Button>
          {mode === 'snapshot' && effectiveOrder && (
            <Button variant="secondary" size="lg" onClick={() => openEditOrder(effectiveOrder.id)} className="flex-1">
              <FileText className="w-4.5 h-4.5" /> Edit Order
            </Button>
          )}
        </div>

        {savedRef && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold justify-center">
            <CheckCircle2 className="w-4.5 h-4.5" /> Order saved successfully.
          </div>
        )}
      </div>

      {/* Save error modal */}
      <Modal open={Boolean(showSaveError)} onClose={() => setShowSaveError(null)} title="Order Not Saved">
        <div className="flex items-start gap-2.5 text-red-600">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700">
            <span className="font-bold text-red-600">The order could not be saved to the database.</span>
            <br />
            {showSaveError}
          </p>
        </div>
        <p className="text-sm text-slate-500 mt-3">Please check your connection and the Supabase configuration, then try again.</p>
      </Modal>
    </div>
  );
}

function OptionCard({
  option,
  recommended,
  selected,
  onSelect,
  selectable,
}: {
  option: DiscountOption;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
  selectable: boolean;
}) {
  const letter = OPTION_ORDER.indexOf(option.key) + 1;
  return (
    <GlassCard
      className={`p-4 ${selected ? 'ring-2 ring-teal-500/70' : ''} ${selectable && option.eligible ? 'hover:ring-1 hover:ring-teal-400/40' : ''}`}
      onClick={selectable ? onSelect : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 h-10 w-10 rounded-xl grid place-items-center font-extrabold text-[15px] ${
            recommended ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {String.fromCharCode(64 + letter)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-bold text-slate-800">{option.title}</h3>
            {recommended && <Badge tone="brand">Recommended</Badge>}
            {selected && <Badge tone="success">Selected</Badge>}
          </div>

          {option.eligible ? (
            <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
              <Stat label="Scooter discount" value={formatINR(option.scooterDiscountPaise)} />
              <Stat label="Company transport support" value={formatINR(option.companyTransportSupportPaise)} />
              <Stat label="Dealer transport payable" value={formatINR(option.dealerTransportPayablePaise)} />
              <Stat label="Battery discount" value={formatINR(option.batteryDiscountPaise)} />
            </div>
          ) : (
            <div className="mt-2.5 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-[13px] text-red-600">
              <span className="font-bold">NOT ELIGIBLE</span>
              {option.ineligibleReason ? ` — ${option.ineligibleReason}` : ''}
              {option.shortfallPaise ? ` Shortfall: ${formatINR(option.shortfallPaise)}` : ''}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {option.profitStatus === 'verified' && option.profit && (
              <Badge tone="success">
                Profit Verified · {formatINR(option.profit.profitPaise)} ({option.profit.marginPercent.toFixed(1)}%)
              </Badge>
            )}
            {option.profitStatus === 'below_target' && option.profit && (
              <Badge tone="warning">Below Profit Target · {formatINR(option.profit.profitPaise)}</Badge>
            )}
            {option.profitStatus === 'not_verified' && <Badge tone="neutral">Profitability Not Verified</Badge>}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="text-[13px] font-bold text-slate-800 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
