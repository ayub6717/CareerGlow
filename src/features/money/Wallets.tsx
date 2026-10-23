import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import type { TxnKind, WalletKind } from '../../types';
import { balances, finance, monthTotals, settingNum } from '../../lib/calc';
import { dur, idx, monthLabel, niceDate, nowIdx, nowIso, tk, tkS, today, uid, ymOf } from '../../lib/format';
import { parseAmount } from '../../lib/parse';
import { WALLET_COLORS } from '../../lib/ui-maps';
import { Bar, Card, Chips, ConfirmButton, Dot, Empty, Field, Icon, IconButton, PageHeader, Stat, Stats } from '../../components/ui';

export const EXPENSE_CATS = ['Food', 'Groceries', 'Transport', 'Bills & utilities', 'Rent', 'Shopping', 'Gadgets', 'Health', 'Education', 'Family', 'Gifts', 'Entertainment', 'Travel', 'Tax', 'Savings', 'Other'];
const INCOME_CATS = ['Salary', 'Freelance', 'Gift received', 'Refund', 'Other income'];
const KINDS: WalletKind[] = ['Bank', 'Mobile wallet', 'Cash', 'Card', 'Savings'];
const num = (v: string) => Math.max(0, Number(v) || 0);

export default function Wallets() {
  const { db, create, update, remove, setSetting } = useData();
  const [ym, setYm] = useState(ymOf(nowIdx()));
  const [planOpen, setPlanOpen] = useState(false);
  const [d, setD] = useState({ kind: 'out' as TxnKind, amount: '', desc: '', category: 'Food', date: today(), walletId: '', toWalletId: '' });
  const [err, setErr] = useState('');
  const wallets = db.wallets.slice().sort((a, b) => a.order - b.order);
  const color = (id: string) => WALLET_COLORS[Math.max(0, wallets.findIndex((w) => w.id === id)) % WALLET_COLORS.length];
  const name = (id: string) => wallets.find((w) => w.id === id)?.name ?? '—';
  const bal = balances(db);
  const total = wallets.reduce((a, w) => a + (bal.get(w.id) ?? 0), 0);
  const { mt, inn, out } = monthTotals(db.txns, ym);
  const F = finance(db);
  const mI = idx(ym);
  const fromId = wallets.some((w) => w.id === d.walletId) ? d.walletId : wallets[0]?.id ?? '';
  const amt = parseAmount(d.amount);

  const cats = new Map<string, number>(), byWallet = new Map<string, number>();
  mt.filter((t) => t.kind === 'out').forEach((t) => { cats.set(t.category || 'Other', (cats.get(t.category || 'Other') ?? 0) + t.amount); byWallet.set(t.walletId, (byWallet.get(t.walletId) ?? 0) + t.amount); });
  const catList = [...cats].sort((a, b) => b[1] - a[1]);

  const save = () => {
    if (!wallets.length) return setErr('Add a wallet first (bottom of this page).');
    if (!Number.isFinite(amt) || amt <= 0) return setErr('Enter an amount, e.g. 1500 or 2.5k.');
    if (!d.date) return setErr('Pick a date.');
    if (d.kind === 'move' && (!d.toWalletId || d.toWalletId === fromId)) return setErr('Pick the wallet the money goes to.');
    setErr('');
    create('txns', { id: uid(), date: d.date, desc: d.desc.trim(), amount: Math.round(amt), kind: d.kind, category: d.kind === 'move' ? '' : d.category, walletId: fromId, toWalletId: d.kind === 'move' ? d.toWalletId : '', createdAt: nowIso() }, 'Transaction saved');
    setD({ ...d, amount: '', desc: '' });
    setYm(d.date.slice(0, 7));
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Money" title="Wallets & Spending" actions={
        <div className="flex items-center gap-1.5 max-md:w-full max-md:justify-between">
          <button className="icon-btn border border-line bg-white" aria-label="Previous month" onClick={() => setYm(ymOf(mI - 1))}><Icon name="left" size={18} /></button>
          <span className="min-w-[110px] text-center font-semibold">{monthLabel(mI)}</span>
          <button className="icon-btn border border-line bg-white" aria-label="Next month" onClick={() => setYm(ymOf(mI + 1))}><Icon name="right" size={18} /></button>
        </div>} />

      <Stats>
        <Stat label="All wallets" value={<span className="num">{tkS(total)}</span>} sub="balance now" className="!border-[#dce5f8] !bg-[#f1f5fd]" />
        {wallets.map((w) => {
          const i = mt.filter((t) => (t.kind === 'in' && t.walletId === w.id) || (t.kind === 'move' && t.toWalletId === w.id)).reduce((a, t) => a + t.amount, 0);
          const o = mt.filter((t) => (t.kind === 'out' || t.kind === 'move') && t.walletId === w.id).reduce((a, t) => a + t.amount, 0);
          const b = bal.get(w.id) ?? 0;
          return <Stat key={w.id} label={<span className="flex items-center gap-1.5"><Dot color={color(w.id)} />{w.name}</span>} value={<span className={`num ${b < 0 ? 'text-rose-ink' : ''}`}>{tkS(b)}</span>} sub={<span className="num">+{tkS(i)} · −{tkS(o)}</span>} />;
        })}
      </Stats>

      <Card className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Add transaction</h2>
          <Chips label="Type" value={d.kind} onChange={(k) => setD({ ...d, kind: k, category: k === 'in' ? 'Salary' : 'Food' })} options={[{ value: 'out', label: 'Expense' }, { value: 'in', label: 'Income' }, { value: 'move', label: 'Transfer' }]} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Amount" hint={d.amount.trim() && <span className={`num text-[13px] ${Number.isFinite(amt) ? 'text-mute' : 'text-rose-ink'}`}>{Number.isFinite(amt) ? (/^\d+$/.test(d.amount.trim()) ? '' : `= ${tk(amt)}`) : 'can’t read this amount'}</span>}>
            <input className="input num" inputMode="decimal" value={d.amount} aria-invalid={!!d.amount.trim() && !Number.isFinite(amt)} onChange={(e) => setD({ ...d, amount: e.target.value })} placeholder="e.g. 1500 or 2.5k" />
          </Field>
          <Field label="What for"><input className="input" value={d.desc} onChange={(e) => setD({ ...d, desc: e.target.value })} placeholder="e.g. Groceries" /></Field>
          {d.kind !== 'move' && <Field label={d.kind === 'in' ? 'Source' : 'Category'}><select className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>{(d.kind === 'in' ? INCOME_CATS : EXPENSE_CATS).map((c) => <option key={c}>{c}</option>)}</select></Field>}
          <Field label="Date"><input className="input" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
        </div>
        {wallets.length > 0 && (
          <div className="flex flex-col gap-1.5"><span className="lbl">{d.kind === 'in' ? 'Into wallet' : d.kind === 'move' ? 'From wallet' : 'Paid from'}</span>
            <Chips label="Wallet" value={fromId} onChange={(v) => setD({ ...d, walletId: v })} options={wallets.map((w) => ({ value: w.id, label: w.name }))} />
          </div>
        )}
        {d.kind === 'move' && (
          <div className="flex flex-col gap-1.5"><span className="lbl">To wallet</span>
            <Chips label="To wallet" value={d.toWalletId} onChange={(v) => setD({ ...d, toWalletId: v })} options={wallets.filter((w) => w.id !== fromId).map((w) => ({ value: w.id, label: w.name }))} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary" onClick={save}>Save</button>{err && <span className="text-[14px] text-rose-ink" role="alert">{err}</span>}</div>
      </Card>

      <Stats>
        <Stat label="Came in" value={<span className="num text-mint-ink">{tkS(inn)}</span>} />
        <Stat label="Spent" value={<span className="num">{tkS(out)}</span>} sub={F.expense ? (out > F.expense ? `${tkS(out - F.expense)} over plan` : `${tkS(F.expense - out)} left of plan`) : 'no monthly plan set'} />
        <Stat label="Net" value={<span className={`num ${inn - out < 0 ? 'text-rose-ink' : 'text-mint-ink'}`}>{tkS(inn - out)}</span>} />
        <Stat label="Top category" value={<span className="text-base font-semibold">{catList[0]?.[0] ?? '—'}</span>} />
      </Stats>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[999_1_420px] flex-col gap-3.5">
          <h2 className="h2">Where it went</h2>
          {catList.length ? catList.map(([c, v]) => (
            <div key={c} className="flex flex-col gap-1.5"><div className="flex justify-between gap-2 text-[14px]"><span className="wrap-any">{c}</span><span className="num text-mute">{tk(v)} · {Math.round((v / out) * 100)}%</span></div><Bar thin pct={(v / out) * 100} /></div>
          )) : <Empty>No spending in {monthLabel(mI)}.</Empty>}
        </Card>
        <Card className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5">
          <h2 className="h2">Paid from</h2>
          {[...byWallet].sort((a, b) => b[1] - a[1]).map(([w, v]) => (
            <div key={w} className="flex flex-col gap-1.5"><div className="flex justify-between gap-2 text-[14px]"><span className="flex items-center gap-2"><Dot color={color(w)} />{name(w)}</span><span className="num text-mute">{Math.round((v / out) * 100)}%</span></div><Bar thin pct={(v / out) * 100} color={color(w)} /></div>
          ))}
          {!byWallet.size && <Empty>—</Empty>}
        </Card>
      </div>

      <Card className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between"><h2 className="h2">Transactions</h2><span className="text-[13px] text-mute">{mt.length} in {monthLabel(mI)}</span></div>
        {mt.length ? <ul>{mt.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).map((t) => (
          <li key={t.id} className="row-item">
            <Dot color={t.kind === 'in' ? 'var(--color-mint)' : t.kind === 'out' ? '#E9B48A' : '#B7C0CD'} />
            <div className="min-w-0 flex-1"><div className="wrap-any font-medium">{t.desc || (t.kind === 'move' ? 'Transfer' : t.category)}</div><div className="text-[13px] text-mute">{niceDate(t.date)} · {t.kind === 'move' ? `${name(t.walletId)} → ${name(t.toWalletId)}` : `${t.category} · ${name(t.walletId)}`}</div></div>
            <span className={`num whitespace-nowrap ${t.kind === 'in' ? 'text-mint-ink' : t.kind === 'move' ? 'text-mute' : ''}`}>{t.kind === 'in' ? '+' : t.kind === 'out' ? '−' : ''}{tk(t.amount)}</span>
            <IconButton icon="x" label="Delete transaction" onClick={() => remove('txns', t.id, 'Transaction deleted')} />
          </li>
        ))}</ul> : <Empty>No transactions in {monthLabel(mI)}.</Empty>}
      </Card>

      <Card className="flex flex-col gap-3.5">
        <button className="flex min-h-11 w-full items-center justify-between gap-3 text-left" onClick={() => setPlanOpen((o) => !o)} aria-expanded={planOpen}>
          <span className="min-w-0"><span className="h2 block">Monthly plan</span><span className="block text-[13px] text-mute">Income <span className="num">{tkS(F.income)}</span> · planned spending <span className="num">{tkS(F.expense)}</span> · emergency fund {F.emPct}%</span></span>
          <Icon name="down" size={18} className={`transition-transform ${planOpen ? 'rotate-180' : ''}`} />
        </button>
        {planOpen && (
          <div className="flex flex-col gap-3.5">
            <p className="text-[14px] text-mute">Goals, smart split and “Can I afford it?” use these numbers.</p>
            <Field label="Monthly income (৳)"><input className="input num" inputMode="numeric" type="number" min={0} value={settingNum(db, 'income')} onChange={(e) => setSetting('income', num(e.target.value))} /></Field>
            <div className="lbl">Planned monthly spending</div>
            <ul>{db.plannedExpenses.slice().sort((a, b) => a.order - b.order).map((x) => (
              <li key={x.id} className="row-item !gap-2 !py-1.5">
                <input className="input flex-[1.6_1_0]" aria-label="Expense" value={x.label} onChange={(e) => update('plannedExpenses', x.id, { label: e.target.value }, { debounce: true })} />
                <input className="input num flex-[1_1_0] text-right" aria-label="Amount" inputMode="numeric" type="number" min={0} value={x.amount} onChange={(e) => update('plannedExpenses', x.id, { amount: num(e.target.value) }, { debounce: true })} />
                <IconButton icon="x" label="Remove" onClick={() => remove('plannedExpenses', x.id)} />
              </li>
            ))}</ul>
            <div className="flex flex-wrap items-center justify-between gap-2"><button className="btn btn-sm btn-ghost" onClick={() => create('plannedExpenses', { id: uid(), label: 'New line', amount: 0, order: db.plannedExpenses.length })}>+ Add line</button><span className="text-[14px]">Left each month: <strong className="num font-medium">{tk(F.saving)}</strong></span></div>
            <div className="h-px bg-line-soft" />
            <div className="flex items-center justify-between"><span className="font-semibold">Emergency fund</span><span className="num text-[14px]">{F.emPct}%</span></div>
            <Bar pct={F.emPct} color="var(--color-mint)" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              <Field label="Months of spending"><input className="input num" inputMode="numeric" type="number" min={1} max={24} value={settingNum(db, 'emMonths')} onChange={(e) => setSetting('emMonths', num(e.target.value))} /></Field>
              <Field label="Saved (৳)"><input className="input num" inputMode="numeric" type="number" min={0} value={settingNum(db, 'emSaved')} onChange={(e) => setSetting('emSaved', num(e.target.value))} /></Field>
              <Field label="Top-up / month"><input className="input num" inputMode="numeric" type="number" min={0} value={settingNum(db, 'emMonthly')} onChange={(e) => setSetting('emMonthly', num(e.target.value))} /></Field>
            </div>
            <p className="text-[13px] text-mute">Target {tk(F.emTarget)} · full in {F.emLeft <= 0 ? 'already full' : settingNum(db, 'emMonthly') > 0 ? dur(Math.ceil(F.emLeft / settingNum(db, 'emMonthly'))) : 'never at ৳0 top-up'}</p>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between"><h2 className="h2">Wallets</h2><button className="btn btn-sm btn-ghost" onClick={() => create('wallets', { id: uid(), name: 'New wallet', kind: 'Cash', opening: 0, order: (wallets.at(-1)?.order ?? -1) + 1 }, 'Wallet added')}>+ Add wallet</button></div>
        {!wallets.length && <Empty>Add your bank account, bKash/Nagad and cash to start tracking.</Empty>}
        {wallets.map((w) => (
          <div key={w.id} className="flex flex-col gap-2.5 border-b border-line-soft pb-3 last:border-b-0">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><input className="input" value={w.name} onChange={(e) => update('wallets', w.id, { name: e.target.value }, { debounce: true })} /></Field>
              <Field label="Type"><select className="input" value={w.kind} onChange={(e) => update('wallets', w.id, { kind: e.target.value as WalletKind })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></Field>
              <Field label="Starting balance (৳)"><input className="input num" inputMode="numeric" type="number" value={w.opening} onChange={(e) => update('wallets', w.id, { opening: Number(e.target.value) || 0 }, { debounce: true })} /></Field>
              <div className="flex flex-col gap-1.5"><span className="lbl">Balance now</span><span className="num flex min-h-11 items-center">{tk(bal.get(w.id) ?? 0)}</span></div>
            </div>
            <ConfirmButton className="self-end" confirmText="Tap again — removes its transactions too" onConfirm={() => {
              db.txns.filter((t) => t.walletId === w.id || t.toWalletId === w.id).forEach((t) => remove('txns', t.id));
              remove('wallets', w.id, 'Wallet removed');
            }}>Remove wallet</ConfirmButton>
          </div>
        ))}
      </Card>
    </div>
  );
}
