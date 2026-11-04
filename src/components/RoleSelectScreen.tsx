import { ShieldCheck, UserRound } from 'lucide-react';
import { useRole } from '../context/RoleContext';
import { isDemoMode } from '../storage';

export function RoleSelectScreen() {
  const { setRole } = useRole();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-teal-100 via-white to-green-100 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-teal-200/70 bg-white/85 backdrop-blur-2xl shadow-2xl shadow-teal-500/10 p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <img src="/assets/xidaa-logo-dark.png" alt="Xidaa Moto Private Limited" className="h-14 w-auto object-contain drop-shadow-lg" />
            <h1 className="mt-4 text-xl font-extrabold text-slate-900 tracking-tight">Xidaa Discount Calculator</h1>
            <p className="text-[13px] text-slate-500 mt-1">Ride The Electric Thunder · B2B Order Management</p>
          </div>

          <p className="text-sm text-slate-500 text-center mb-5">Continue as…</p>

          <div className="space-y-3">
            <button
              onClick={() => setRole('admin')}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 text-left hover:border-teal-400 hover:bg-teal-50/60 transition-all active:scale-[0.99] shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-teal-100 text-teal-800 grid place-items-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-slate-800">Administrator</p>
                <p className="text-[13px] text-slate-400 mt-0.5">Full access — orders, financial rules, users, audit</p>
              </div>
            </button>

            <button
              onClick={() => setRole('sales')}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4 text-left hover:border-green-400 hover:bg-green-50/60 transition-all active:scale-[0.99] shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-green-100 text-green-800 grid place-items-center shrink-0">
                <UserRound className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-slate-800">Sales Executive</p>
                <p className="text-[13px] text-slate-400 mt-0.5">Create & calculate orders — no financial rules</p>
              </div>
            </button>
          </div>
        </div>

        {isDemoMode() && (
          <div className="mt-4 rounded-xl bg-teal-100 border border-teal-300 px-4 py-3 text-[13px] text-teal-900 text-center">
            Development demo mode — data stays on this device. Configure Supabase for production.
          </div>
        )}
      </div>
    </div>
  );
}
