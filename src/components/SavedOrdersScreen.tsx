import { useMemo, useState } from 'react';
import { Eye, FolderOpen, Pencil, Search, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import { formatINR, formatIndianNumber } from '../utils/currency';
import { Badge, Button, EmptyState, GlassCard, Input, Modal, Spinner } from './ui';

export function SavedOrdersScreen() {
  const { orders, ordersLoaded, ordersError, refreshOrders, openViewOrder, openEditOrder, deleteOrder } = useApp();
  const { role } = useRole();
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderRef.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.city?.toLowerCase().includes(q) ?? false) ||
        o.customerPhone?.includes(q),
    );
  }, [orders, search]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await deleteOrder(deleting);
      setDeleting(null);
    } catch (e) {
      // Toast comes from adapter? push toast here:
      console.error(e);
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Saved Orders</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{filtered.length} order{filtered.length === 1 ? '' : 's'} · permanently stored in Supabase</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, customer, city…"
            className="pl-10"
          />
        </div>
      </div>

      {ordersError && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">{ordersError}</div>
      )}

      {!ordersLoaded ? (
        <Spinner label="Loading orders…" />
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<FolderOpen className="w-7 h-7" />}
            title={search ? 'No matching orders' : 'No saved orders yet'}
            description={search ? 'Try a different search term.' : 'Orders stay available after refresh, logout and on other devices.'}
          />
        </GlassCard>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o) => (
            <GlassCard key={o.id} className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-green-600 text-white grid place-items-center font-extrabold text-base shrink-0">
                  {o.customerName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{o.customerName}</p>
                    <Badge tone="neutral">{o.orderRef}</Badge>
                    {o.profitVerified && <Badge tone="success">Profit verified</Badge>}
                    {o.selectedOptionKey && (
                      <Badge tone="brand">
                        {o.selectedOptionKey === 'scooter_discount' ? 'Scooter discount' : o.selectedOptionKey === 'transport_support' ? '50% transport support' : 'No discount'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatIndianNumber(o.totalScooters)} scooters · {o.dlQty} DL / {o.otherQty} Other · {formatIndianNumber(o.batteryQty)} batteries ·{' '}
                    {formatIndianNumber(o.distanceKm)} km · {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {o.createdByName ? ` · by ${o.createdByName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-1">
                    <p className="text-[11px] text-slate-400 font-medium">Transport</p>
                    <p className="text-sm font-extrabold text-slate-800 tabular-nums">{formatINR(o.finalTransportPaise)}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => openViewOrder(o.id)}>
                    <Eye className="w-4 h-4" /> View
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEditOrder(o.id)}>
                    <Pencil className="w-4 h-4" /> Edit
                  </Button>
                  {role === 'admin' && (
                    <Button variant="danger" size="sm" onClick={() => setDeleting(o.id)}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete Order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={busyDelete}>Delete permanently</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to permanently delete this order? This action cannot be undone and will be recorded in the audit log.
        </p>
      </Modal>
    </div>
  );
}
