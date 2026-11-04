import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';
import { formatINR } from '../utils/currency';

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-teal-500 text-white hover:bg-teal-600 active:bg-teal-700 shadow-md shadow-teal-500/20 border border-teal-400/40',
    secondary:
      'bg-white/70 text-slate-800 hover:bg-white border border-slate-200 shadow-sm backdrop-blur',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20 border border-red-400/40',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20 border border-amber-400/40',
  };
  const sizes = {
    sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-lg',
    md: 'h-11 px-4 text-sm gap-2 rounded-xl',
    lg: 'h-13 px-6 text-[15px] gap-2 rounded-xl',
  };
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function GlassCard({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(17,24,39,0.06)] ${onClick ? 'cursor-pointer transition-transform duration-150 hover:-translate-y-0.5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-[15px] font-bold text-slate-800 tracking-tight ${className}`}>{children}</h3>;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-green-100 text-green-800 border-green-300',
    warning: 'bg-teal-100 text-teal-800 border-teal-300',
    danger: 'bg-red-50 text-red-600 border-red-200',
    info: 'bg-green-50 text-green-700 border-green-200',
    brand: 'bg-teal-50 text-teal-800 border-teal-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-slate-500 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`h-11 w-full rounded-xl border bg-white/80 px-3.5 text-[15px] text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${invalid ? 'border-red-300' : 'border-slate-200'} ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-[15px] text-slate-800 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Money display
// ---------------------------------------------------------------------------

export function Money({ paise, className = '', compact }: { paise: number; className?: string; compact?: boolean }) {
  return <span className={`tabular-nums font-semibold text-slate-800 ${className}`}>{compact ? formatINR(paise).replace('₹', '₹') : formatINR(paise)}</span>;
}

export function MoneyLarge({ paise, className = '' }: { paise: number; className?: string }) {
  return (
    <span className={`tabular-nums font-extrabold tracking-tight text-slate-900 ${className}`}>
      {formatINR(paise)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-[16px] font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-400 grid place-items-center mb-4">{icon}</div>
      <p className="text-[15px] font-semibold text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-slate-200/70 ${className}`} />;
}

export function ExpandableSection({ title, children, defaultOpen = false, accent }: { title: string; children: ReactNode; defaultOpen?: boolean; accent?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/70 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100 pt-3">{children}</div>}
    </div>
  );
}
