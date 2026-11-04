import { Files, FolderOpen, Home, PlusCircle, RefreshCw, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useApp, type View } from '../context/AppContext';
import { roleLabel, useRole } from '../context/RoleContext';

const NAV_ITEMS: { key: View; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'neworder', label: 'New Order', icon: PlusCircle },
  { key: 'orders', label: 'Saved Orders', icon: FolderOpen },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function LogoMark({ size = 'h-9' }: { size?: string }) {
  return (
    <div className="rounded-xl bg-white p-1.5 border border-slate-200/80">
      <img src="/assets/xidaa-logo-dark.png" alt="Xidaa" className={`${size} w-auto object-contain`} />
    </div>
  );
}

export function Header() {
  const { role, clearRole } = useRole();
  const { view, navigate, draft, editingOrderId } = useApp();
  const currentRef = editingOrderId ? 'Editing saved order' : draft.scooterRows.length || draft.batteryRows.length ? 'New order in progress' : null;

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_16px_rgba(0,0,0,0.04)]">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center gap-3">
        <button onClick={() => navigate('home')} className="flex items-center gap-3 group">
          <LogoMark />
          <div className="text-left hidden xs:block">
            <p className="text-[15px] font-extrabold text-slate-900 leading-tight tracking-tight">Xidaa Discount Calculator</p>
            <p className="text-[11px] text-slate-500 leading-tight">Ride The Electric Thunder</p>
          </div>
        </button>

        {currentRef && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs text-teal-800">
            <Files className="w-3.5 h-3.5" />
            {currentRef}
          </span>
        )}

        <nav className="ml-auto hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`h-10 px-3.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                view === item.key ? 'bg-teal-100 text-teal-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-2 md:ml-4">
          {role === 'admin' && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-300 text-green-800 px-2.5 py-1 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </span>
          )}
          <div className="hidden sm:block text-right">
            <p className="text-[13px] font-semibold text-slate-900 leading-tight">{roleLabel(role)}</p>
            <p className="text-[11px] text-slate-500 leading-tight">Internal access</p>
          </div>
          <button
            onClick={() => clearRole()}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors text-[13px] font-semibold"
            title="Switch role"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden lg:inline">Switch role</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const { view, navigate } = useApp();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(0,0,0,0.05)]">
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                active ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              <span className={`text-[10.5px] font-semibold ${active ? '' : 'font-medium'}`}>{item.label}</span>
              {active && <span className="h-0.5 w-6 rounded-full bg-teal-500 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
