import { useEffect, useState, type ReactNode } from 'react';
import type { Tone } from '../../lib/calc';

// ---------- Icons (one consistent stroke style) ----------
const PATHS: Record<string, ReactNode> = {
  home: <path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><path d="M8.5 12.3l2.4 2.4 4.6-4.9" /></>,
  wallet: <><rect x="3.5" y="6.5" width="17" height="13" rx="3" /><path d="M16 13h2M6.5 6.5l8.5-3 1.2 3" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12.5" rx="3" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>,
  play: <><rect x="3.5" y="5" width="17" height="14" rx="3.5" /><path d="M10.5 9.5l4 2.5-4 2.5z" /></>,
  chart: <path d="M5.5 19v-7M12 19V5.5M18.5 19v-10" />,
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  x: <path d="M7 7l10 10M17 7L7 17" />,
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M6 15l6-6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  left: <path d="M15 6l-6 6 6 6" />,
  arrow: <path d="M5 12h13M13 6l6 6-6 6" />,
  ban: <><circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" /></>,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  link: <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />,
  sort: <path d="M7 5v14M4 16l3 3 3-3M14 7h6M14 12h4M14 17h2" />,
  pencil: <path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L9 18z" />,
  refresh: <path d="M19 12a7 7 0 1 1-2.05-4.95M19 5v4h-4" />,
  sheet: <><rect x="4.5" y="3.5" width="15" height="17" rx="2.5" /><path d="M4.5 9h15M4.5 14.5h15M10 9v11.5" /></>,
  calc: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
};
export function Icon({ name, size = 20, className = '', fill = 'none' }: { name: keyof typeof PATHS | string; size?: number; className?: string; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {PATHS[name]}
    </svg>
  );
}

// ---------- Badges & progress ----------
const TONES: Record<Tone, string> = {
  blue: 'bg-[#e8eefb] text-pri-ink', mint: 'bg-mint-soft text-mint-ink', amber: 'bg-amber-soft text-amber-ink',
  rose: 'bg-rose-soft text-rose-ink', lav: 'bg-lav-soft text-lav-ink', gray: 'bg-gray-soft text-gray-ink', teal: 'bg-teal-soft text-teal-ink',
};
export function Pill({ tone = 'gray', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[13px] font-medium leading-snug ${TONES[tone]} ${className}`}>{children}</span>;
}
export function Bar({ pct, color, thin, className = '', track }: { pct: number; color?: string; thin?: boolean; className?: string; track?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <div className={`${thin ? 'h-1.5' : 'h-2'} min-w-0 overflow-hidden rounded-full ${track ?? 'bg-line-soft'} ${className}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${p}%`, background: color ?? 'var(--color-bar)' }} />
    </div>
  );
}
export const Dot = ({ color, className = '' }: { color: string; className?: string }) => <span className={`inline-block size-[9px] shrink-0 rounded-full ${className}`} style={{ background: color }} />;

// ---------- Layout pieces ----------
export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3.5 max-md:items-start">
      <div>
        {eyebrow && <div className="mb-1 text-[13px] font-medium text-mute">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 max-md:w-full max-md:[&>button]:flex-1">{actions}</div>}
    </div>
  );
}
export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`card ${className}`}>{children}</As>;
}
export function Stat({ label, value, sub, valueClass = '', className = '' }: { label: ReactNode; value: ReactNode; sub?: ReactNode; valueClass?: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-[14px] border border-line bg-white px-4 py-3.5 shadow-[var(--shadow-card)] max-md:px-3.5 max-md:py-3 ${className}`}>
      <div className="lbl">{label}</div>
      <div className={`mt-1 text-[22px] font-medium wrap-any max-md:text-[19px] ${valueClass}`}>{value}</div>
      {sub != null && sub !== '' && <div className="mt-0.5 text-[13px] text-mute">{sub}</div>}
    </div>
  );
}
export const Stats = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 max-md:grid-cols-2 max-md:gap-2.5">{children}</div>
);
export function Field({ label, children, className = '', hint }: { label: string; children: ReactNode; className?: string; hint?: ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="lbl">{label}</span>
      {children}
      {hint}
    </label>
  );
}
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Two-tap delete: first tap arms, second confirms. Disarms after 4 s. */
export function ConfirmButton({ onConfirm, children, confirmText = 'Tap again to delete', className = '' }: { onConfirm: () => void; children: ReactNode; confirmText?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" className={`btn btn-sm btn-quiet btn-danger ${className}`} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  );
}

export function IconButton({ icon, label, onClick, small = true, className = '' }: { icon: string; label: string; onClick: () => void; small?: boolean; className?: string }) {
  return (
    <button type="button" className={`icon-btn ${small ? 'icon-btn-sm' : ''} ${className}`} aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} size={16} />
    </button>
  );
}

/** Text input that keeps local state while typing and commits on change (debounced by the data layer). */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { value: string | number; onValue: (v: string) => void }) {
  const { value, onValue, className = '', ...rest } = props;
  return <input {...rest} className={`input ${className}`} value={value} onChange={(e) => onValue(e.target.value)} />;
}
