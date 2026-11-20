import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import type { Txn } from '../../types';
import { addDays, nowIso, today, tk, uid } from '../../lib/format';
import { Card, ConfirmButton, Empty, Icon, PageHeader } from '../../components/ui';
import { byDate, evalAmount, longDate, walletColor, walletIcon } from './money';
import { AmountInput, Bubble, Fab, ScreenHead } from './parts';
import { back } from './TxnForm';

/** Every transfer between accounts, newest first. */
export default function Transfers() {
  const { db } = useData();
  const [filter, setFilter] = useState('');
  const w = (id: string) => db.wallets.find((x) => x.id === id);
  const list = db.txns.filter((t) => t.kind === 'move' && (!filter || t.walletId === filter || t.toWalletId === filter));
  const wallets = db.wallets.slice().sort((a, b) => a.order - b.order);
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <PageHeader eyebrow="Money" title="Transfer history" actions={<button className="btn btn-primary max-md:hidden" onClick={() => go('transfer', 'new')}>+ New transfer</button>} />
      {wallets.length > 1 && (
        <div className="seg">
          <button className="chip" aria-pressed={!filter} onClick={() => setFilter('')}>All accounts</button>
          {wallets.map((x) => <button key={x.id} className="chip" aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>{x.name}</button>)}
        </div>
      )}
      {list.length ? byDate(list).map(([date, items]) => (
        <section key={date} className="flex flex-col gap-1.5">
          <h2 className="px-1 text-[14px] font-semibold text-mute">{longDate(date)}</h2>
          <Card className="!p-0"><ul>{items.map((t) => {
            const a = w(t.walletId), b = w(t.toWalletId);
            return (
              <li key={t.id} className="border-b border-line-soft last:border-b-0">
                <button type="button" onClick={() => go('transfer', t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-line-soft/60 max-md:px-3.5">
                  <span className="flex shrink-0 items-center">
                    {a ? <Bubble icon={walletIcon(a)} color={walletColor(a)} size={36} /> : <span className="size-9 rounded-full bg-line" />}
                    <Icon name="arrow" size={16} className="mx-1 text-faint" />
                    {b ? <Bubble icon={walletIcon(b)} color={walletColor(b)} size={36} /> : <span className="size-9 rounded-full bg-line" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block wrap-any font-medium">{a?.name ?? '—'} → {b?.name ?? '—'}</span>{t.desc && <span className="block wrap-any text-[14px] text-mute">{t.desc}</span>}</span>
                  <span className="num whitespace-nowrap">{tk(t.amount)}</span>
                </button>
              </li>
            );
          })}</ul></Card>
        </section>
      )) : <Card><Empty>No transfers yet. Move money between accounts with “New transfer”.</Empty></Card>}
      <Fab onClick={() => go('transfer', 'new')} label="New transfer" />
    </div>
  );
}

/** Create or edit a transfer: from account → to account. */
export function TransferForm({ id }: { id: string }) {
  const { db, create, update, remove } = useData();
  const existing = id !== 'new' ? db.txns.find((t) => t.id === id && t.kind === 'move') : undefined;
  const wallets = db.wallets.slice().sort((a, b) => a.order - b.order);
  const [d, setD] = useState(() => ({
    from: existing?.walletId ?? '', to: existing?.toWalletId ?? '', amount: existing ? String(existing.amount) : '', date: existing?.date ?? today(), desc: existing?.desc ?? '',
  }));
  const [err, setErr] = useState('');
  if (id !== 'new' && !existing) return <Card><Empty>This transfer doesn’t exist any more. <button className="text-pri-ink underline" onClick={() => go('transfers')}>Back</button></Empty></Card>;
  const done = () => back(() => go('transfers'));
  const amt = evalAmount(d.amount);
  const y = addDays(-1);

  const save = () => {
    if (!d.from) return setErr('Pick the account the money leaves.');
    if (!d.to || d.to === d.from) return setErr('Pick a different account the money goes to.');
    if (!Number.isFinite(amt) || amt <= 0) return setErr('Enter the transfer amount.');
    if (!d.date) return setErr('Pick a date.');
    setErr('');
    const rec: Partial<Txn> = { date: d.date, desc: d.desc.trim(), amount: Math.round(amt * 100) / 100, kind: 'move', category: '', categoryId: '', walletId: d.from, toWalletId: d.to, tags: [] };
    if (existing) update('txns', existing.id, rec, { toast: 'Transfer saved' });
    else create('txns', { id: uid(), createdAt: nowIso(), ...rec } as Txn, 'Transfer added');
    done();
  };

  const Picker = ({ label, value, onPick, exclude }: { label: string; value: string; onPick: (v: string) => void; exclude?: string }) => (
    <div className="flex flex-col gap-2">
      <span className="lbl">{label}</span>
      {wallets.length ? <div className="seg">{wallets.filter((w) => w.id !== exclude).map((w) => (
        <button key={w.id} type="button" className="chip !min-h-11 !pl-1.5" aria-pressed={value === w.id} onClick={() => onPick(w.id)}><Bubble icon={walletIcon(w)} color={walletColor(w)} size={30} />{w.name}</button>
      ))}</div> : <span className="text-[15px] text-mint-ink">Not selected — add an account first</span>}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <ScreenHead title={existing ? 'Edit transfer' : 'Create transfer'} onBack={done} />
      <Card className="flex flex-col gap-5">
        <Picker label="Transfer from account" value={d.from} onPick={(v) => setD({ ...d, from: v, to: d.to === v ? '' : d.to })} />
        <Picker label="Transfer to account" value={d.to} onPick={(v) => setD({ ...d, to: v })} exclude={d.from} />
        <div className="flex flex-col gap-1"><span className="lbl">Transfer amount</span><AmountInput value={d.amount} onChange={(v) => setD({ ...d, amount: v })} label="Transfer amount" /></div>
        <div className="flex flex-col gap-2">
          <span className="lbl">Date</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="chip" aria-pressed={d.date === today()} onClick={() => setD({ ...d, date: today() })}>Today</button>
            <button type="button" className="chip" aria-pressed={d.date === y} onClick={() => setD({ ...d, date: y })}>Yesterday</button>
            <input type="date" className="input !w-auto" aria-label="Date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </div>
          <span className="text-[14px] text-mint-ink">{d.date === today() ? 'Today, ' : ''}{longDate(d.date)}</span>
        </div>
        <label className="flex flex-col gap-1.5"><span className="lbl">Comment</span><input className="input" placeholder="Comment" value={d.desc} onChange={(e) => setD({ ...d, desc: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
        {err && <p className="text-[14px] text-rose-ink" role="alert">{err}</p>}
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 -mx-1 flex items-center gap-2 bg-card/90 px-1 py-1 backdrop-blur-sm md:bottom-2">
          <button type="button" className="btn btn-primary min-h-12 flex-1 text-[17px]" onClick={save}>{existing ? 'Save' : 'Add'}</button>
          {existing && <ConfirmButton onConfirm={() => { remove('txns', existing.id, 'Transfer deleted'); done(); }}>Delete</ConfirmButton>}
        </div>
      </Card>
    </div>
  );
}
