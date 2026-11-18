import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import { tk, today } from '../../lib/format';
import { Card, Empty, Icon } from '../../components/ui';
import { byDate, catResolver, downloadCsv, inRange, inScope, longDate, periodRange, setMoneyView, shiftAnchor, useMoneyView, walletColor, walletIcon } from './money';
import { Bubble, Fab, ScreenHead } from './parts';
import { back } from './TxnForm';

/** Transactions of one category (or "all") in the chosen period and account — tap one to edit it. */
export default function CategoryTxns({ id }: { id: string }) {
  const { db } = useData();
  const v = useMoneyView();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const r = periodRange(v.period, v.anchor, v.from, v.to);
  const resolve = catResolver(db);
  const wallet = (wid: string) => db.wallets.find((w) => w.id === wid);
  const all = id === 'all';
  const sample = db.txns.find((t) => t.kind === v.kind && resolve(t).id === id);
  const cat = all ? null : db.categories.find((c) => c.id === id) ?? (sample ? resolve(sample) : null);
  const scopeW = wallet(v.scope);
  const addParam = cat && db.categories.some((c) => c.id === cat.id) ? `${v.kind}~${cat.id}` : v.kind;

  const needle = q.trim().toLowerCase();
  const list = db.txns.filter((t) => t.kind === v.kind && inRange(t, r) && inScope(t, v.scope) && (all || resolve(t).id === id))
    .filter((t) => !needle || [t.desc, t.category, (t.tags ?? []).join(' '), String(t.amount), wallet(t.walletId)?.name ?? ''].join(' ').toLowerCase().includes(needle));
  const sum = list.reduce((a, t) => a + t.amount, 0);
  const title = all ? (v.kind === 'out' ? 'All expenses' : 'All income') : cat?.name ?? 'Category';

  const exportCsv = () => downloadCsv(`${title} ${r.from} to ${r.to}`.replace(/[^\w\- ]+/g, ''), [
    ['Date', 'Type', 'Category', 'Account', 'Amount (BDT)', 'Tags', 'Comment'],
    ...list.slice().sort((a, b) => a.date.localeCompare(b.date)).map((t) => [t.date, t.kind === 'in' ? 'Income' : 'Expense', resolve(t).name, wallet(t.walletId)?.name ?? '', t.amount, (t.tags ?? []).join(' '), t.desc]),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <ScreenHead title={<span className="uppercase tracking-[0.02em]">{title}</span>} sub={<span className="num text-[18px] font-medium text-ink">{tk(sum)}</span>} onBack={() => back(() => go('money'))}
        right={<>
          <button className={`icon-btn ${searching ? 'bg-pri-soft text-pri-ink' : ''}`} aria-label="Search" aria-pressed={searching} onClick={() => { setSearching((s) => !s); setQ(''); }}><Icon name="search" size={22} /></button>
          <button className="icon-btn" aria-label="Download CSV" title="Download as CSV (opens in Excel / Sheets)" onClick={exportCsv} disabled={!list.length}><Icon name="download" size={22} /></button>
        </>} />

      {searching && <input className="input" autoFocus placeholder="Search comment, tag, amount, account" value={q} onChange={(e) => setQ(e.target.value)} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[15px] font-medium">{scopeW ? <><Bubble icon={walletIcon(scopeW)} color={walletColor(scopeW)} size={24} />{scopeW.name}</> : <><Icon name="wallet" size={18} className="text-mute" />Total</>}</span>
        {v.period === 'range' ? <span className="text-[14px] text-mute">{r.label}</span> : (
          <div className="flex items-center">
            <button className="icon-btn icon-btn-sm" aria-label="Previous" onClick={() => setMoneyView({ anchor: shiftAnchor(v.period, v.anchor, -1) })}><Icon name="left" size={18} /></button>
            <span className="min-w-[120px] text-center text-[14px] font-medium">{r.label}</span>
            <button className="icon-btn icon-btn-sm" aria-label="Next" onClick={() => setMoneyView({ anchor: shiftAnchor(v.period, v.anchor, 1) })}><Icon name="right" size={18} /></button>
            {!r.isNow && <button className="btn btn-sm btn-quiet" onClick={() => setMoneyView({ anchor: today() })}>Today</button>}
          </div>
        )}
      </div>

      {list.length ? byDate(list).map(([date, items]) => (
        <section key={date} className="flex flex-col gap-1.5">
          <h2 className="px-1 text-[14px] font-semibold text-mute">{longDate(date)}</h2>
          <Card className="!p-0">
            <ul>{items.map((t) => {
              const c = resolve(t), w = wallet(t.walletId);
              return (
                <li key={t.id} className="border-b border-line-soft last:border-b-0">
                  <button type="button" onClick={() => go('money-edit', t.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-line-soft/60 max-md:px-3.5">
                    <Bubble icon={c.icon} color={c.color} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block text-[14px] text-mute">{w?.name ?? '—'}</span>
                      {t.desc && <span className="block wrap-any text-[14px] text-faint">{t.desc}</span>}
                      {(t.tags ?? []).length > 0 && <span className="mt-1 flex flex-wrap gap-1">{t.tags.map((g) => <span key={g} className="rounded-full bg-mint-soft px-2 text-[12px] text-mint-ink">#{g}</span>)}</span>}
                    </span>
                    <span className={`num whitespace-nowrap text-[17px] ${t.kind === 'in' ? 'text-mint-ink' : ''}`}>{tk(t.amount)}</span>
                  </button>
                </li>
              );
            })}</ul>
          </Card>
        </section>
      )) : <Card><Empty>{needle ? 'Nothing matches your search.' : `Nothing in ${r.label}.`}</Empty></Card>}

      <div className="hidden justify-center md:flex"><button className="btn btn-primary" onClick={() => go('money-add', addParam)}>+ Add {title.toLowerCase().startsWith('all') ? (v.kind === 'out' ? 'expense' : 'income') : `to ${title}`}</button></div>
      <Fab onClick={() => go('money-add', addParam)} label="Add" />
    </div>
  );
}
