import { createElement, useEffect, useState, type ReactNode } from 'react';
import { ICON_GROUPS, ICON_SET } from '../../lib/icon-set';
import { Icon } from '../../components/ui';
import { MONEY_COLORS, evalAmount } from './money';
import { tk } from '../../lib/format';

/** One icon from the category/account icon set. */
export function SetIcon({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) {
  const node = ICON_SET[name] ?? ICON_SET['tag'];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {node.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

/** White icon on a coloured circle — used for categories and accounts. */
export function Bubble({ icon, color, size = 44, className = '' }: { icon: string; color: string; size?: number; className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full text-white ${className}`} style={{ width: size, height: size, background: color }}>
      <SetIcon name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** Bottom sheet on phones, centred dialog on desktop. */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 md:items-center md:p-6" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90dvh] w-full flex-col rounded-t-[20px] bg-white md:rounded-[18px] ${wide ? 'md:max-w-[640px]' : 'md:max-w-[460px]'}`}>
        <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
          <h2 className="h2">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pt-3.5 pb-[calc(16px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/** Back arrow + title, like the phone app's screen header. */
export function ScreenHead({ title, onBack, right, sub }: { title: ReactNode; onBack: () => void; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="icon-btn -ml-2.5" aria-label="Back" onClick={onBack}><Icon name="left" size={22} /></button>
      <div className="min-w-0 flex-1"><h1 className="h1 !text-[26px] max-md:!text-[22px] wrap-any">{title}</h1>{sub && <div className="text-[14px] text-mute">{sub}</div>}</div>
      {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
    </div>
  );
}

/** Two-option underline tabs: Expenses / Income. */
export function KindTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-line-soft p-1" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-[9px] text-[15px] font-semibold uppercase tracking-[0.04em] transition-colors ${o.value === value ? 'bg-white text-pri-ink shadow-[var(--shadow-card)]' : 'text-mute hover:text-ink'}`}>{o.label}</button>
      ))}
    </div>
  );
}

/** Big amount field with "BDT" and a calculator keypad. Accepts 1500, 2.5k, 120+45*2. */
export function AmountInput({ value, onChange, autoFocus, label = 'Amount' }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; label?: string }) {
  const [calc, setCalc] = useState(false);
  const v = evalAmount(value);
  const isExpr = !/^\d+(\.\d+)?$/.test(value.trim()) && Number.isFinite(v);
  const press = (k: string) => {
    if (k === 'C') return onChange('');
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (k === '=') return onChange(Number.isFinite(v) && value.trim() ? String(v) : value);
    onChange(value + k);
  };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex w-full max-w-[380px] items-end gap-3">
        <input aria-label={label} className="num min-w-0 flex-1 border-0 border-b-2 border-line bg-transparent pb-1 text-center text-[40px] leading-tight outline-none focus:border-pri max-md:text-[34px]"
          inputMode="decimal" autoFocus={autoFocus} placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!value.trim() && !Number.isFinite(v)} />
        <span className="pb-2 text-[26px] font-medium text-mint-ink">BDT</span>
        <button type="button" className={`icon-btn mb-1 ${calc ? 'bg-pri-soft text-pri-ink' : ''}`} aria-label="Calculator" aria-pressed={calc} onClick={() => setCalc((c) => !c)}><Icon name="calc" size={22} /></button>
      </div>
      <div className="num min-h-5 text-[13px] text-mute">{value.trim() && (Number.isFinite(v) ? (isExpr ? `= ${tk(v)}` : '') : <span className="text-rose-ink">can’t read this amount</span>)}</div>
      {calc && (
        <div className="grid w-full max-w-[380px] grid-cols-4 gap-2">
          {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '⌫', '+', 'C', '='].map((k) => (
            <button key={k} type="button" onClick={() => press(k)}
              className={`min-h-12 rounded-xl text-[20px] font-medium ${k === '=' ? 'col-span-3 bg-pri text-white' : /[÷×−+]/.test(k) ? 'bg-pri-soft text-pri-ink' : k === 'C' ? 'bg-rose-soft text-rose-ink' : 'bg-line-soft text-ink hover:bg-line'}`}>{k}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Icon grid + colour palette, used for categories and accounts. */
export function IconColorPicker({ icon, color, onIcon, onColor, groups }: { icon: string; color: string; onIcon: (i: string) => void; onColor: (c: string) => void; groups?: string[] }) {
  const list = groups ? ICON_GROUPS.filter((g) => groups.includes(g.name)) : ICON_GROUPS;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="lbl">Color</span>
        <div className="flex flex-wrap items-center gap-2.5">
          {MONEY_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={c.toLowerCase() === color.toLowerCase()} onClick={() => onColor(c)}
              className={`size-9 rounded-full transition-transform ${c.toLowerCase() === color.toLowerCase() ? 'scale-110 ring-[3px] ring-offset-2 ring-[#b9c9f1]' : ''}`} style={{ background: c }} />
          ))}
          <label className="relative grid size-9 cursor-pointer place-items-center rounded-full border border-dashed border-faint text-mute" title="Custom colour">
            <Icon name="plus" size={18} />
            <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={color} onChange={(e) => onColor(e.target.value)} aria-label="Custom colour" />
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <span className="lbl">Icon</span>
        {list.map((g) => (
          <div key={g.name} className="flex flex-col gap-2">
            <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-faint">{g.name}</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2">
              {g.icons.map((n) => (
                <button key={n} type="button" aria-label={n} aria-pressed={n === icon} onClick={() => onIcon(n)}
                  className="grid aspect-square place-items-center rounded-full transition-colors"
                  style={n === icon ? { background: color, color: 'white' } : { background: 'var(--color-line-soft)', color: 'var(--color-mute)' }}>
                  <SetIcon name={n} size={22} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Round floating "+" button (phones), sits above the bottom tab bar. */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-pri text-white shadow-[0_8px_24px_rgba(77,111,204,.35)] hover:bg-pri-hover md:hidden">
      <Icon name="plus" size={26} />
    </button>
  );
}
