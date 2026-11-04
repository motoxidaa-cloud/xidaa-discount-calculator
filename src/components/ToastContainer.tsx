import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-20 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto flex items-center gap-2.5 max-w-md w-full rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-xl animate-[slideDown_0.2s_ease-out] ${
            t.kind === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
              : t.kind === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-600'
                : 'bg-white/95 border-slate-200 text-slate-700'
          }`}
        >
          {t.kind === 'success' ? <CheckCircle2 className="w-4.5 h-4.5 shrink-0" /> : t.kind === 'error' ? <XCircle className="w-4.5 h-4.5 shrink-0" /> : <Info className="w-4.5 h-4.5 shrink-0" />}
          <span className="text-left">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
