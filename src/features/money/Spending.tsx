import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import { tk, today } from '../../lib/format';
import { Card, Empty, Icon } from '../../components/ui';
import { accountTotals, catResolver, inRange, inScope, periodRange, PERIODS, setMoneyView, shiftAnchor, useMoneyView, walletColor, walletIcon, type CatView } from './money';
import { Bubble, Fab, KindTabs, Sheet } from './parts';
import { useEnsureCategories } from './useMoney';

/** Home of the money section: balance, Expenses/Income, period, donut and categories — same flow as the phone app. */
export default function Spending() {
  useEnsureCategories();
  const { db } = useData();
  const v = useMoneyView();
  const [pickScope, setPickScope] = useState(false);
  const r = periodRange(v.period, v.anchor, v.from, v.to);
  const { bal, total } = accountTotals(db);
  const wallets = db.wallets.slice().sort((a, b) => a.order - b.order);
  const scopeW = wallets.find((w) => w.id === v.scope);
  const resolve = catResolver(db);

  const list = db.txns.filter((t) => t.kind === v.kind && inRange(t, r) && inScope(t, v.scope));
  const sum = list.reduce((a, t) => a + t.amount, 0);
  const groups = new Map<string, { c: CatView; amount: number; n: number }>();
  list.forEach((t) => { const c = resolve(t); const g = groups.get(c.id) ?? { c, amount: 0, n: 0 }; g.amount += t.amount; g.n++; groups.set(c.id, g); });
  const rows = [...groups.values()].sort((a, b) => b.amount - a.amount);
  const word = v.kind === 'out' ? 'expenses' : 'income';
  const periodWord = { day: 'this day', week: 'this week', month: 'this month', year: 'this year', range: 'this period' }[v.period];
  const add = () => go('money-add', v.kind);

  return (
    <div className="flex flex-col gap-4">
      {/* Balance + account filter */}
      <Card className="flex flex-col items-center gap-1 !py-4 text-center">
        <button type="button" onClick={() => setPickScope(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[17px] font-semibold hover:bg-line-soft" aria-haspopup="dialog">
          {scopeW ? <Bubble icon={walletIcon(scopeW)} color={walletColor(scopeW)} size={26} /> : <Icon name="wallet" size={20} className="text-mute" />}
          {scopeW ? scopeW.name : 'Total'}<Icon name="down" size={16} className="text-mute" />
        </button>
        <div className="num text-[34px] leading-tight max-md:text-[30px]">{tk(scopeW ? bal.get(scopeW.id) ?? 0 : total)}</div>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <button className="btn btn-sm btn-quiet" onClick={() => go('accounts')}><Icon name="wallet" size={16} />Accounts</button>
          <button className="btn btn-sm btn-quiet" onClick={() => go('transfer', 'new')}><Icon name="swap" size={16} />New transfer</button>
        </div>
      </Card>

      <KindTabs value={v.kind} onChange={(k) => setMoneyView({ kind: k })} options={[{ value: 'out', label: 'Expenses' }, { value: 'in', label: 'Income' }]} />

      <div className="flex flex-wrap items-start gap-4">
        {/* Period + donut */}
        <Card className="relative flex min-w-0 flex-[1_1_340px] flex-col gap-3">
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Period">
            {PERIODS.map((p) => <button key={p.value} type="button" className="chip justify-center !px-1" aria-pressed={v.period === p.value} onClick={() => setMoneyView({ period: p.value, from: v.from || today().slice(0, 8) + '01', to: v.to || today() })}>{p.label}</button>)}
          </div>
          {v.period === 'range' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1"><span className="lbl">From</span><input type="date" className="input" value={v.from} onChange={(e) => setMoneyView({ from: e.target.value })} /></label>
              <label className="flex flex-col gap-1"><span className="lbl">To</span><input type="date" className="input" value={v.to} onChange={(e) => setMoneyView({ to: e.target.value })} /></label>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button className="icon-btn" aria-label="Previous" onClick={() => setMoneyView({ anchor: shiftAnchor(v.period, v.anchor, -1) })}><Icon name="left" size={20} /></button>
              <label className="relative min-w-0 flex-1 cursor-pointer text-center font-medium underline decoration-line underline-offset-4">
                {r.label}
                <input type="date" aria-label="Pick a date" className="absolute inset-0 cursor-pointer opacity-0" value={v.anchor} onChange={(e) => e.target.value && setMoneyView({ anchor: e.target.value })} />
              </label>
              {!r.isNow && <button className="btn btn-sm btn-quiet" onClick={() => setMoneyView({ anchor: today() })}>Today</button>}
              <button className="icon-btn" aria-label="Next" onClick={() => setMoneyView({ anchor: shiftAnchor(v.period, v.anchor, 1) })}><Icon name="right" size={20} /></button>
            </div>
          )}
          <Donut parts={rows.map((g) => ({ value: g.amount, color: g.c.color }))} center={sum > 0 ? <span className={`num text-[26px] ${v.kind === 'in' ? 'text-mint-ink' : ''}`}>{tk(sum)}</span> : <span className="px-6 text-[15px] text-mute">There were no {word} in {periodWord}</span>} />
          <button type="button" onClick={add} className="btn btn-primary absolute right-4 bottom-4 hidden !size-14 !rounded-full !p-0 shadow-[0_8px_24px_rgba(77,111,204,.3)] md:inline-flex" aria-label={v.kind === 'out' ? 'Add expense' : 'Add income'} title={v.kind === 'out' ? 'Add expense' : 'Add income'}><Icon name="plus" size={26} /></button>
        </Card>

        {/* Categories with share */}
        <Card className="flex min-w-0 flex-[1_1_340px] flex-col gap-1">
          <div className="mb-1 flex items-center justify-between"><h2 className="h2">{v.kind === 'out' ? 'Expenses' : 'Income'} by category</h2>{list.length > 0 && <button className="btn btn-sm btn-quiet" onClick={() => go('money-cat', 'all')}>All {list.length}</button>}</div>
          {rows.length ? rows.map((g) => (
            <button key={g.c.id} type="button" onClick={() => go('money-cat', g.c.id)} className="flex min-h-14 items-center gap-3 rounded-xl px-1.5 text-left hover:bg-line-soft">
              <Bubble icon={g.c.icon} color={g.c.color} size={40} />
              <span className="min-w-0 flex-1"><span className="block wrap-any font-medium">{g.c.name}</span><span className="block text-[13px] text-mute">{g.n} {g.n === 1 ? 'entry' : 'entries'}</span></span>
              <span className="num w-12 text-right text-[14px] text-mute">{Math.max(1, Math.round((g.amount / sum) * 100))}%</span>
              <span className="num min-w-[84px] text-right">{tk(g.amount)}</span>
            </button>
          )) : <Empty>Nothing added yet. Tap + to add {v.kind === 'out' ? 'an expense' : 'income'}.</Empty>}
        </Card>
      </div>

      <Fab onClick={add} label={v.kind === 'out' ? 'Add expense' : 'Add income'} />

      {pickScope && (
        <Sheet title="Show" onClose={() => setPickScope(false)}>
          <div className="flex flex-col gap-1">
            {[{ id: '', name: 'Total', icon: '', color: '', amount: total, hidden: false }, ...wallets.map((w) => ({ id: w.id, name: w.name, icon: walletIcon(w), color: walletColor(w), amount: bal.get(w.id) ?? 0, hidden: w.hidden }))].map((o) => (
              <button key={o.id || 'all'} type="button" onClick={() => { setMoneyView({ scope: o.id }); setPickScope(false); }}
                className={`flex min-h-14 items-center gap-3 rounded-xl px-2 text-left ${v.scope === o.id ? 'bg-pri-soft' : 'hover:bg-line-soft'}`}>
                {o.icon ? <Bubble icon={o.icon} color={o.color} size={36} /> : <span className="grid size-9 place-items-center rounded-full bg-line-soft text-mute"><Icon name="wallet" size={18} /></span>}
                <span className="flex-1 font-medium">{o.name}{o.hidden && <span className="ml-2 text-[12px] font-normal text-faint">not in total</span>}</span>
                <span className="num">{tk(o.amount)}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Ring chart. Each part keeps a small gap so neighbouring colours stay distinct. */
function Donut({ parts, center }: { parts: { value: number; color: string }[]; center: React.ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const R = 80, W = 26, C = 2 * Math.PI * R;
  const gap = parts.length > 1 ? 2.5 : 0;
  let acc = 0;
  return (
    <div className="relative mx-auto my-1 aspect-square w-full max-w-[260px]">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90" role="img" aria-label="Share by category">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-line-soft)" strokeWidth={W} />
        {total > 0 && parts.map((p, i) => {
          const len = (p.value / total) * C;
          const el = <circle key={i} cx="100" cy="100" r={R} fill="none" stroke={p.color} strokeWidth={W} strokeDasharray={`${Math.max(0.6, len - gap)} ${C}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
        <circle cx="100" cy="100" r={R - W / 2 - 9} fill="none" stroke="var(--color-line)" strokeWidth="1.5" strokeDasharray="5 5" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}
