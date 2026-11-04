import { useMemo } from 'react';
import { ArrowRight, BatteryFull, FolderOpen, PlusCircle, Truck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { roleLabel, useRole } from '../context/RoleContext';
import { formatINR, formatIndianNumber } from '../utils/currency';
import { Badge, Button, EmptyState, GlassCard } from './ui';

export function HomeScreen() {
  const { role } = useRole();
  const { orders, navigate, openEditOrder } = useApp();

  const stats = useMemo(() => {
    const totalScooters = orders.reduce((s, o) => s + o.totalScooters, 0);
    const totalBatteries = orders.reduce((s, o) => s + o.batteryQty, 0);
    const transportTotal = orders.reduce((s, o) => s + o.finalTransportPaise, 0);
    return { totalOrders: orders.length, totalScooters, totalBatteries, transportTotal };
  }, [orders]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-100 via-white to-green-100 border border-teal-200/70 p-5 sm:p-7 shadow-xl shadow-teal-500/10">
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-teal-400/25 blur-3xl" />
        <div className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-green-300/25 blur-3xl" />
        <p className="text-[13px] text-slate-500">{today}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {greeting}, {roleLabel(role).split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 max-w-md">
          Create a B2B order, compare discount strategies and protect company profit — in seconds.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => navigate('neworder')} className="bg-teal-500 hover:bg-teal-400 shadow-lg shadow-teal-500/30 text-white">
            <PlusCircle className="w-5 h-5" /> Create New Order
          </Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('orders')} className="!bg-white !border-slate-200 !text-slate-700 hover:!bg-slate-50">
            <FolderOpen className="w-5 h-5" /> Saved Orders
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassCard className="p-4">
          <p className="text-xs font-medium text-slate-400">Total saved orders</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{formatIndianNumber(stats.totalOrders)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <FolderOpen className="w-3.5 h-3.5" /> across all sales
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs font-medium text-slate-400">Scooters ordered</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{formatIndianNumber(stats.totalScooters)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Truck className="w-3.5 h-3.5" /> DL + Other
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs font-medium text-slate-400">Batteries</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{formatIndianNumber(stats.totalBatteries)}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <BatteryFull className="w-3.5 h-3.5" /> independent line items
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs font-medium text-slate-400">Transport on record</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{formatINR(stats.transportTotal, { decimals: true })}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Truck className="w-3.5 h-3.5" /> final transport charged
          </div>
        </GlassCard>
      </div>

      {/* Recent orders */}
      <GlassCard>
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-1">
          <h2 className="text-[15px] font-bold text-slate-800">Recent Orders</h2>
          <button onClick={() => navigate('orders')} className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700 hover:text-teal-800">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="w-7 h-7" />}
            title="No orders yet"
            description="Orders you create and save will appear here — available on every device after you sign in."
            action={
              <Button onClick={() => navigate('neworder')}>
                <PlusCircle className="w-4 h-4" /> Create your first order
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((o) => (
              <button
                key={o.id}
                onClick={() => openEditOrder(o.id)}
                className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-white/70 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 grid place-items-center font-extrabold text-sm shrink-0">
                  {o.customerName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{o.customerName}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {o.orderRef} · {o.totalScooters} scooters · {new Date(o.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[13px] font-bold text-slate-700 tabular-nums">{formatINR(o.finalTransportPaise)}</span>
                  <Badge tone={o.profitVerified ? 'success' : 'neutral'}>{o.profitVerified ? 'Profit verified' : 'Unverified'}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
