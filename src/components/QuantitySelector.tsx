import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { clampInt } from '../utils/currency';

interface QuantitySelectorProps {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  label?: string;
}

const PRESETS = Array.from({ length: 32 }, (_, i) => i + 1);

export function QuantitySelector({ value, onChange, max = 100000, label = 'Quantity' }: QuantitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const set = (v: number) => onChange(clampInt(v, 1, max));

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= 1}
        className="h-11 w-11 rounded-xl bg-slate-100 hover:bg-slate-200 grid place-items-center text-slate-600 transition-colors disabled:opacity-35 active:scale-95"
        aria-label="Decrease"
      >
        <Minus className="w-4.5 h-4.5" />
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 min-w-16 px-3 rounded-xl bg-white border border-slate-200 text-[15px] font-bold text-slate-800 tabular-nums hover:border-teal-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors flex flex-col items-center justify-center leading-none"
        aria-label={label}
      >
        <span>{value}</span>
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{label}</span>
      </button>

      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        className="h-11 w-11 rounded-xl bg-teal-500 hover:bg-teal-600 text-white grid place-items-center shadow-sm shadow-teal-500/30 transition-colors disabled:opacity-35 active:scale-95"
        aria-label="Increase"
      >
        <Plus className="w-4.5 h-4.5" />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-2 left-0 w-44 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 max-h-72 overflow-y-auto">
          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  set(n);
                  setOpen(false);
                  setCustomOpen(false);
                }}
                className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                  value === n ? 'bg-teal-500 text-white' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className="mt-1.5 w-full h-9 rounded-lg text-sm font-semibold text-teal-700 hover:bg-teal-50 border border-teal-200 transition-colors"
          >
            Custom (above 32)…
          </button>
          {customOpen && (
            <div className="mt-1.5 flex gap-1.5">
              <input
                type="number"
                min={33}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 outline-none focus:border-teal-500"
                placeholder="Qty"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const n = parseInt(customValue, 10);
                  if (Number.isFinite(n) && n > 32) {
                    set(n);
                    setOpen(false);
                    setCustomOpen(false);
                    setCustomValue('');
                  }
                }}
                className="h-9 px-3 rounded-lg bg-teal-600 text-white text-xs font-bold"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
