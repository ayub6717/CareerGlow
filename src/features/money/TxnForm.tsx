import { useMemo, useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import type { CatKind, Txn } from '../../types';
import { addDays, nowIso, today, uid } from '../../lib/format';
import { Card, ConfirmButton, Empty, Icon } from '../../components/ui';
import { evalAmount, longDate, rankedCategories, setMoneyView, shortMD, useMoneyView, walletColor, walletIcon, catResolver } from './money';
import { AmountInput, Bubble, KindTabs, ScreenHead } from './parts';
import { CategoryPicker } from './Categories';
import { useEnsureCategories } from './useMoney';

export const back = (fallback: () => void) => { if (window.history.length > 1) window.history.back(); else fallback(); };

/** Add or edit an expense / income. `param` is "out", "in", "out~<categoryId>" (new) or a transaction id (edit). */
export default function TxnForm({ param, edit }: { param: string; edit?: boolean }) {
  useEnsureCategories();
  const { db, create, update, remove } = useData();
  const mv = useMoneyView();
  const existing = edit ? db.txns.find((t) => t.id === param) : undefined;
  const wallets = db.wallets.slice().sort((a, b) => a.order - b.order);
  const lastWallet = useMemo(() => db.txns.filter((t) => t.kind !== 'move').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.walletId, [db.txns]);

  const init = (): { kind: CatKind; amount: string; walletId: string; categoryId: string; date: string; tags: string[]; desc: string } => {
    if (existing) {
      const c = catResolver(db)(existing);
      return { kind: existing.kind === 'in' ? 'in' : 'out', amount: String(existing.amount), walletId: existing.walletId, categoryId: c.missing ? '' : c.id, date: existing.date, tags: existing.tags ?? [], desc: existing.desc };
    }
    const [k, cid] = param.split('~');
    const kind: CatKind = k === 'in' ? 'in' : 'out';
    const scopeOk = wallets.some((w) => w.id === mv.scope);
    return { kind, amount: '', walletId: scopeOk ? mv.scope : wallets.some((w) => w.id === lastWallet) ? lastWallet! : wallets[0]?.id ?? '', categoryId: cid ?? '', date: today(), tags: [], desc: '' };
  };
  const [d, setD] = useState(init);
  const [more, setMore] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagText, setTagText] = useState('');
  const [err, setErr] = useState('');

  if (edit && !existing) return <Card><Empty>This transaction doesn’t exist any more. <button className="text-pri-ink underline" onClick={() => go('money')}>Back</button></Empty></Card>;

  const ranked = rankedCategories(db, d.kind);
  let top = ranked.slice(0, 7);
  const sel = db.categories.find((c) => c.id === d.categoryId);
  if (sel && !top.some((c) => c.id === sel.id)) top = [...top.slice(0, 6), sel];
  const allTags = [...new Set(db.txns.flatMap((t) => t.tags ?? []))].filter((t) => !d.tags.includes(t));
  const tagHits = allTags.filter((t) => t.toLowerCase().includes(tagText.trim().toLowerCase())).slice(0, 8);
  const y = addDays(-1);
  const third = d.date !== today() && d.date !== y ? { date: d.date, label: 'selected' } : mv.lastDate && mv.lastDate !== today() && mv.lastDate !== y ? { date: mv.lastDate, label: 'last' } : null;
  const amt = evalAmount(d.amount);
  const done = () => back(() => go('money'));

  const addTag = (t: string) => { const v = t.trim().replace(/,/g, ' '); if (v && !d.tags.includes(v)) setD({ ...d, tags: [...d.tags, v] }); setTagText(''); setTagOpen(false); };

  const save = () => {
    if (!Number.isFinite(amt) || amt <= 0) return setErr('Enter an amount, e.g. 1500, 2.5k or 120+80.');
    if (!d.walletId) return setErr('Pick an account.');
    if (!sel) return setErr('Pick a category.');
    setErr('');
    const rec: Partial<Txn> = { date: d.date, desc: d.desc.trim(), amount: Math.round(amt * 100) / 100, kind: d.kind, category: sel.name, categoryId: sel.id, walletId: d.walletId, toWalletId: '', tags: d.tags };
    if (existing) update('txns', existing.id, rec, { toast: 'Saved' });
    else create('txns', { id: uid(), createdAt: nowIso(), ...rec } as Txn, d.kind === 'out' ? 'Expense added' : 'Income added');
    setMoneyView({ lastDate: d.date, kind: d.kind });
    done();
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <ScreenHead title={existing ? 'Edit transaction' : 'Add transaction'} onBack={done} />
      <KindTabs value={d.kind} onChange={(k) => setD({ ...d, kind: k, categoryId: k === d.kind ? d.categoryId : '' })} options={[{ value: 'out', label: 'Expenses' }, { value: 'in', label: 'Income' }]} />

      <Card className="flex flex-col gap-5">
        <AmountInput value={d.amount} onChange={(v) => setD({ ...d, amount: v })} autoFocus={!existing} />

        <div className="flex flex-col gap-2">
          <span className="lbl">Account</span>
          {wallets.length ? (
            <div className="seg">
              {wallets.map((w) => (
                <button key={w.id} type="button" className="chip !min-h-11 !pl-1.5" aria-pressed={d.walletId === w.id} onClick={() => setD({ ...d, walletId: w.id })}>
                  <Bubble icon={walletIcon(w)} color={walletColor(w)} size={30} />{w.name}
                </button>
              ))}
            </div>
          ) : <div className="soft flex flex-wrap items-center justify-between gap-2 bg-amber-soft/70 text-[15px]">Add an account first.<button className="btn btn-sm btn-ghost" onClick={() => go('account', 'new')}>Add account</button></div>}
        </div>

        <div className="flex flex-col gap-2">
          <span className="lbl">Categories</span>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-8">
            {top.map((c) => (
              <button key={c.id} type="button" onClick={() => setD({ ...d, categoryId: c.id })} aria-pressed={d.categoryId === c.id}
                className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1.5">
                <Bubble icon={c.icon} color={c.color} size={52} className={`transition-transform ${d.categoryId === c.id ? 'scale-105 ring-[3px] ring-offset-2 ring-offset-card ring-focus' : d.categoryId ? 'opacity-55 group-hover:opacity-100' : ''}`} />
                <span className={`w-full truncate text-center text-[13px] ${d.categoryId === c.id ? 'font-semibold text-ink' : 'text-mute'}`}>{c.name}</span>
              </button>
            ))}
            <button type="button" onClick={() => setMore(true)} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1.5">
              <span className="grid size-[52px] place-items-center rounded-full bg-line-soft text-mute"><Icon name="plus" size={24} /></span>
              <span className="text-[13px] text-mute">More</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="lbl">Date</span>
          <div className="seg items-center">
            <DateChip on={d.date === today()} top={shortMD(today())} sub="today" onClick={() => setD({ ...d, date: today() })} />
            <DateChip on={d.date === y} top={shortMD(y)} sub="yesterday" onClick={() => setD({ ...d, date: y })} />
            {third && <DateChip on={d.date === third.date} top={shortMD(third.date)} sub={third.label} onClick={() => setD({ ...d, date: third.date })} />}
            <label className="relative ml-auto grid size-12 shrink-0 cursor-pointer place-items-center rounded-xl text-mint-ink hover:bg-line-soft" title="Pick a date">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></svg>
              <input type="date" aria-label="Pick a date" className="absolute inset-0 cursor-pointer opacity-0" value={d.date} onChange={(e) => e.target.value && setD({ ...d, date: e.target.value })} />
            </label>
          </div>
          <span className="text-[13px] text-mute">{longDate(d.date)}</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="lbl">Tags</span>
          <div className="flex flex-wrap items-center gap-2">
            {d.tags.map((t) => (
              <span key={t} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-mint-soft pl-3 pr-1 text-[14px] text-mint-ink">#{t}
                <button type="button" className="grid size-7 place-items-center rounded-full hover:bg-card/60" aria-label={`Remove tag ${t}`} onClick={() => setD({ ...d, tags: d.tags.filter((x) => x !== t) })}><Icon name="x" size={14} /></button>
              </span>
            ))}
            {!tagOpen && <button type="button" className="chip !border-mint !text-mint-ink" onClick={() => setTagOpen(true)}><Icon name="plus" size={16} />Add tag</button>}
          </div>
          {tagOpen && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input className="input" autoFocus placeholder="e.g. bike, family, office" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagText); } if (e.key === 'Escape') setTagOpen(false); }} />
                <button type="button" className="btn btn-soft" onClick={() => addTag(tagText)}>Add</button>
              </div>
              {tagHits.length > 0 && <div className="flex flex-wrap gap-2">{tagHits.map((t) => <button key={t} type="button" className="chip" onClick={() => addTag(t)}>#{t}</button>)}</div>}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1.5"><span className="lbl">Comment</span>
          <input className="input" placeholder="Comment" value={d.desc} onChange={(e) => setD({ ...d, desc: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        </label>

        {err && <p className="text-[14px] text-rose-ink" role="alert">{err}</p>}
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 -mx-1 flex items-center gap-2 bg-card/90 px-1 py-1 backdrop-blur-sm md:bottom-2">
          <button type="button" className="btn btn-primary min-h-12 flex-1 text-[17px]" onClick={save}>{existing ? 'Save' : 'Add'}</button>
          {existing && <ConfirmButton onConfirm={() => { remove('txns', existing.id, 'Deleted'); done(); }}>Delete</ConfirmButton>}
        </div>
      </Card>

      {more && <CategoryPicker kind={d.kind} selected={d.categoryId} onPick={(id) => { setD({ ...d, categoryId: id }); setMore(false); }} onClose={() => setMore(false)} />}
    </div>
  );
}

function DateChip({ on, top, sub, onClick }: { on: boolean; top: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`flex min-h-14 min-w-[88px] shrink-0 flex-col items-center justify-center rounded-xl px-3 leading-tight ${on ? 'bg-mint text-white' : 'text-mute hover:bg-line-soft'}`}>
      <span className="num text-[16px]">{top}</span><span className="text-[13px]">{sub}</span>
    </button>
  );
}
