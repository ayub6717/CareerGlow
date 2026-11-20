import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import type { Wallet, WalletKind } from '../../types';
import { niceDate, tk, uid } from '../../lib/format';
import { Card, ConfirmButton, Empty, Field, Icon, PageHeader } from '../../components/ui';
import { accountTotals, catResolver, evalAmount, MONEY_COLORS, setMoneyView, WALLET_ICON, walletColor, walletIcon } from './money';
import { AmountInput, Bubble, Fab, IconColorPicker, ScreenHead } from './parts';
import { back } from './TxnForm';

const KINDS: WalletKind[] = ['Bank', 'Mobile wallet', 'Cash', 'Card', 'Savings'];

/** All accounts with their balances, the total, and transfer shortcuts. */
export default function Accounts() {
  const { db } = useData();
  const { bal, total } = accountTotals(db);
  const wallets = db.wallets.slice().sort((a, b) => a.order - b.order);
  const hiddenN = wallets.filter((w) => w.hidden).length;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Money" title="Accounts" actions={<button className="btn btn-primary max-md:hidden" onClick={() => go('account', 'new')}>+ Add account</button>} />
      <Card className="flex flex-col items-center gap-4 !py-5 text-center">
        <div><div className="lbl">Total</div><div className="num text-[36px] leading-tight max-md:text-[32px]">{tk(total)}</div>{hiddenN > 0 && <div className="text-[13px] text-mute">{hiddenN} hidden {hiddenN === 1 ? 'account is' : 'accounts are'} not counted</div>}</div>
        <div className="grid w-full max-w-[420px] grid-cols-2 gap-3">
          <button className="flex flex-col items-center gap-2 rounded-2xl p-2 hover:bg-line-soft" onClick={() => go('transfers')}>
            <span className="grid size-14 place-items-center rounded-2xl bg-mint-soft text-mint-ink"><Icon name="history" size={26} /></span><span className="text-[15px] font-medium">Transfer history</span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-2xl p-2 hover:bg-line-soft" onClick={() => go('transfer', 'new')}>
            <span className="grid size-14 place-items-center rounded-2xl bg-mint-soft text-mint-ink"><Icon name="swap" size={26} /></span><span className="text-[15px] font-medium">New transfer</span>
          </button>
        </div>
      </Card>
      <Card className="!p-2">
        {wallets.length ? wallets.map((w, i) => {
          const b = bal.get(w.id) ?? 0;
          return (
            <button key={w.id} type="button" onClick={() => go('account', w.id)} className="flex min-h-16 w-full items-center gap-3 rounded-xl px-2.5 text-left hover:bg-line-soft">
              <Bubble icon={walletIcon(w)} color={walletColor(w, i)} size={44} />
              <span className="min-w-0 flex-1"><span className="block wrap-any text-[17px] font-medium">{w.name}</span><span className="block text-[13px] text-mute">{w.kind}</span></span>
              {w.hidden && <Icon name="eyeoff" size={18} className="text-faint" />}
              <span className={`num text-[17px] ${b < 0 ? 'text-rose-ink' : ''}`}>{tk(b)}</span>
            </button>
          );
        }) : <Empty>Add your bank accounts, bKash, Rocket and cash to start tracking.</Empty>}
      </Card>
      <Fab onClick={() => go('account', 'new')} label="Add account" />
    </div>
  );
}

/** Add or edit an account. For an existing account the amount is the balance *now* (the starting balance is adjusted). */
export function AccountForm({ id }: { id: string }) {
  const { db, create, update, remove } = useData();
  const existing = db.wallets.find((w) => w.id === id);
  const { bal } = accountTotals(db);
  const [d, setD] = useState(() => ({
    amount: existing ? String(Math.round((bal.get(existing.id) ?? 0) * 100) / 100) : '',
    name: existing?.name ?? '', kind: existing?.kind ?? ('Bank' as WalletKind),
    icon: existing ? walletIcon(existing) : 'landmark', color: existing ? walletColor(existing) : MONEY_COLORS[(db.wallets.length * 3) % MONEY_COLORS.length],
    hidden: existing?.hidden ?? false,
  }));
  const [err, setErr] = useState('');
  if (id !== 'new' && !existing) return <Card><Empty>This account doesn’t exist any more. <button className="text-pri-ink underline" onClick={() => go('accounts')}>Back</button></Empty></Card>;
  const done = () => back(() => go('accounts'));
  const resolve = catResolver(db);
  const recent = existing ? db.txns.filter((t) => t.walletId === existing.id || t.toWalletId === existing.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8) : [];
  const wname = (wid: string) => db.wallets.find((w) => w.id === wid)?.name ?? '—';

  const save = () => {
    const amt = d.amount.trim() ? evalAmount(d.amount) : 0;
    if (!d.name.trim()) return setErr('Enter account name.');
    if (!Number.isFinite(amt)) return setErr('Can’t read the amount.');
    setErr('');
    const base = { name: d.name.trim(), kind: d.kind, icon: d.icon, color: d.color, hidden: d.hidden };
    if (existing) {
      const now = bal.get(existing.id) ?? 0;
      update('wallets', existing.id, { ...base, opening: Math.round(((existing.opening || 0) + (amt - now)) * 100) / 100 }, { toast: 'Account saved' });
    } else {
      create('wallets', { id: uid(), ...base, opening: amt, order: Math.max(-1, ...db.wallets.map((w) => w.order)) + 1 } as Wallet, 'Account added');
    }
    done();
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <ScreenHead title={existing ? 'Edit account' : 'Add account'} onBack={done} />
      <Card className="flex flex-col gap-5">
        <AmountInput value={d.amount} onChange={(v) => setD({ ...d, amount: v })} label={existing ? 'Balance now' : 'Starting balance'} />
        <p className="-mt-3 text-center text-[13px] text-mute">{existing ? 'Balance now — change it to correct the account' : 'Money in this account today'}</p>
        <div className="flex items-end gap-3">
          <Bubble icon={d.icon} color={d.color} size={48} />
          <Field label="Account name" className="flex-1"><input className="input" autoFocus={!existing} placeholder="Enter account name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select className="input" value={d.kind} onChange={(e) => { const k = e.target.value as WalletKind; setD({ ...d, kind: k, icon: d.icon === WALLET_ICON[d.kind] ? WALLET_ICON[k] : d.icon }); }}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></Field>
          <Field label="Currency"><input className="input" value="BDT (৳)" disabled /></Field>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-bg px-3.5 py-2.5">
          <input type="checkbox" className="checkbox" checked={!d.hidden} onChange={(e) => setD({ ...d, hidden: !e.target.checked })} />
          <span className="flex-1"><span className="block font-medium">Count in total balance</span><span className="block text-[13px] text-mute">Turn off for money that isn’t yours to spend, e.g. “To lend”.</span></span>
        </label>
        <IconColorPicker icon={d.icon} color={d.color} onIcon={(i) => setD({ ...d, icon: i })} onColor={(c) => setD({ ...d, color: c })} groups={['Money', 'Home', 'Transport', 'Family', 'Fun']} />
        {err && <p className="text-[14px] text-rose-ink" role="alert">{err}</p>}
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 -mx-1 flex items-center gap-2 bg-card/90 px-1 py-1 backdrop-blur-sm md:bottom-2">
          <button type="button" className="btn btn-primary min-h-12 flex-1 text-[17px]" onClick={save}>{existing ? 'Save' : 'Add account'}</button>
          {existing && <ConfirmButton confirmText="Tap again — removes its transactions too" onConfirm={() => {
            db.txns.filter((t) => t.walletId === existing.id || t.toWalletId === existing.id).forEach((t) => remove('txns', t.id));
            remove('wallets', existing.id, 'Account removed');
            go('accounts');
          }}>Delete</ConfirmButton>}
        </div>
      </Card>

      {existing && (
        <Card className="flex flex-col gap-1">
          <div className="mb-1 flex items-center justify-between"><h2 className="h2">Recent activity</h2>
            <button className="btn btn-sm btn-quiet" onClick={() => { setMoneyView({ scope: existing.id }); go('money'); }}>Open in Spending</button></div>
          {recent.length ? recent.map((t) => {
            const c = t.kind === 'move' ? null : resolve(t);
            const into = t.kind === 'in' || (t.kind === 'move' && t.toWalletId === existing.id);
            return (
              <button key={t.id} type="button" onClick={() => go(t.kind === 'move' ? 'transfer' : 'money-edit', t.id)} className="flex min-h-14 items-center gap-3 rounded-xl px-1.5 text-left hover:bg-line-soft">
                {c ? <Bubble icon={c.icon} color={c.color} size={36} /> : <span className="grid size-9 place-items-center rounded-full bg-mint-soft text-mint-ink"><Icon name="swap" size={18} /></span>}
                <span className="min-w-0 flex-1"><span className="block wrap-any font-medium">{c ? c.name : t.toWalletId === existing.id ? `From ${wname(t.walletId)}` : `To ${wname(t.toWalletId)}`}</span><span className="block text-[13px] text-mute">{niceDate(t.date)}{t.desc ? ` · ${t.desc}` : ''}</span></span>
                <span className={`num ${into ? 'text-mint-ink' : ''}`}>{into ? '+' : '−'}{tk(t.amount)}</span>
              </button>
            );
          }) : <Empty>No transactions yet.</Empty>}
        </Card>
      )}
    </div>
  );
}
