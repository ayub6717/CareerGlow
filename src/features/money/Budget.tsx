import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import { tk, tkS, uid } from '../../lib/format';
import { parseAmount, parseBudgetLines } from '../../lib/parse';
import { newGoal } from '../goals/Goals';
import { Bar, Card, ConfirmButton, Empty, IconButton, PageHeader } from '../../components/ui';

export default function Budget() {
  const { db, create, update, remove } = useData();
  const budgets = db.budgets.slice().sort((a, b) => a.order - b.order);
  const [selId, setSelId] = useState('');
  const [paste, setPaste] = useState('');
  const sel = budgets.find((b) => b.id === selId) ?? budgets[0];
  const linesOf = (id: string) => db.budgetLines.filter((l) => l.budgetId === id).sort((a, b) => a.order - b.order);
  const totalOf = (id: string) => linesOf(id).reduce((a, l) => { const v = parseAmount(l.amount); return a + (Number.isFinite(v) ? v : 0); }, 0);

  const newBudget = () => { const id = uid(); create('budgets', { id, name: 'New budget', order: (budgets.at(-1)?.order ?? -1) + 1 }); create('budgetLines', { id: uid(), budgetId: id, label: '', amount: '', order: 0 }); setSelId(id); };

  if (!sel) {
    return (
      <div className="flex flex-col gap-[18px]">
        <PageHeader eyebrow="Money" title="Budget Calculator" />
        <Card><div className="empty flex flex-col items-center gap-3">Write items on the left, amounts on the right — the total adds itself up.<button className="btn btn-primary" onClick={newBudget}>Start a budget</button></div></Card>
      </div>
    );
  }

  const lines = linesOf(sel.id), total = totalOf(sel.id);
  const bad = lines.filter((l) => l.amount.trim() && !Number.isFinite(parseAmount(l.amount))).length;
  const counted = lines.filter((l) => { const v = parseAmount(l.amount); return Number.isFinite(v) && v > 0; });
  const nextOrder = (lines.at(-1)?.order ?? -1) + 1;

  const addPaste = () => {
    const rows = parseBudgetLines(paste);
    if (!rows.length) return;
    lines.filter((l) => !l.label.trim() && !l.amount.trim()).forEach((l) => remove('budgetLines', l.id));
    create('budgetLines', rows.map((r, i) => ({ id: uid(), budgetId: sel.id, label: r.label, amount: r.amount, order: nextOrder + i })), `Added ${rows.length} line${rows.length === 1 ? '' : 's'}`);
    setPaste('');
  };
  const toGoal = () => {
    const g = newGoal({ name: sel.name || 'New goal' });
    create('goals', g);
    create('goalItems', counted.map((l, order) => ({ id: uid(), goalId: g.id, label: l.label || 'Item', amount: Math.round(parseAmount(l.amount)), order })), 'Savings goal created');
    go('goal', g.id);
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Money" title="Budget Calculator" actions={<button className="btn btn-ghost" onClick={newBudget}>+ New budget</button>} />
      <div className="seg" role="group" aria-label="Budgets">
        {budgets.map((b) => <button key={b.id} className="chip" aria-pressed={b.id === sel.id} onClick={() => setSelId(b.id)}>{b.name || 'Untitled'} · <span className="num">{tkS(totalOf(b.id))}</span></button>)}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
          <input aria-label="Budget name" className="input input-ghost !pl-0 font-display !text-[22px] font-semibold" value={sel.name} placeholder="Budget name" onChange={(e) => update('budgets', sel.id, { name: e.target.value }, { debounce: true })} />
          <div className="flex gap-2 text-[13px] text-mute"><span className="flex-[1.4_1_0]">Item</span><span className="flex-[1_1_0] pr-11 text-right">Amount (৳)</span></div>
          <ul>{lines.map((l) => {
            const v = parseAmount(l.amount), raw = l.amount.trim(), ok = Number.isFinite(v);
            return (
              <li key={l.id} className="row-item !items-start !gap-2 !py-1.5">
                <input className="input flex-[1.4_1_0]" aria-label="Item" value={l.label} placeholder="e.g. Laptop" onChange={(e) => update('budgetLines', l.id, { label: e.target.value }, { debounce: true })} />
                <div className="flex min-w-0 flex-[1_1_0] flex-col gap-0.5">
                  <input className="input num text-right" aria-label="Amount" inputMode="decimal" value={l.amount} placeholder="120k" aria-invalid={!!raw && !ok} onChange={(e) => update('budgetLines', l.id, { amount: e.target.value }, { debounce: true })} />
                  {raw && <span className={`num text-right text-[12px] ${ok ? 'text-mute' : 'text-rose-ink'}`}>{!ok ? 'can’t read this' : /^[\d,]+$/.test(raw) ? '' : `= ${tk(v)}`}</span>}
                </div>
                <IconButton icon="x" label="Remove line" className="mt-1" onClick={() => remove('budgetLines', l.id)} />
              </li>
            );
          })}</ul>
          <div><button className="btn btn-sm btn-ghost" onClick={() => create('budgetLines', { id: uid(), budgetId: sel.id, label: '', amount: '', order: nextOrder })}>+ Add line</button></div>
          <div className="flex items-end justify-between border-t border-line pt-3.5">
            <div><div className="lbl">Total</div><div className="text-[13px] text-mute">{counted.length} items{bad ? ` · ${bad} not understood` : ''}</div></div>
            <div className="text-right"><div className="num text-[30px] text-pri-ink">{tk(total)}</div>{total >= 1e5 && <div className="text-[13px] text-mute">≈ {tkS(total)}</div>}</div>
          </div>
        </Card>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px]">
          <Card className="flex flex-col gap-3">
            <h2 className="h2">Paste a list</h2>
            <textarea className="input" aria-label="Paste lines" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'laptop: 120k\nmobile: 110k'} />
            <button className="btn btn-soft" onClick={addPaste}>Add these lines</button>
            <p className="text-[13px] text-mute">One item per line. Understands 120k, 1.5L, 2cr, 1,20,000, 50k+5k and বাংলা digits.</p>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="h2">Split</h2>
            {counted.length ? counted.map((l) => ({ l, v: parseAmount(l.amount) })).sort((a, b) => b.v - a.v).map(({ l, v }) => (
              <div key={l.id} className="flex flex-col gap-1.5"><div className="flex justify-between gap-2 text-[14px]"><span className="wrap-any">{l.label || 'Unnamed'}</span><span className="num text-mute">{Math.round((v / total) * 100)}%</span></div><Bar thin pct={(v / total) * 100} /></div>
            )) : <Empty>Add amounts to see the split.</Empty>}
            <div className="h-px bg-line-soft" />
            <button className="btn btn-soft" onClick={toGoal} disabled={!counted.length}>Turn into a savings goal</button>
            <ConfirmButton onConfirm={() => { remove('budgets', sel.id, 'Budget deleted'); setSelId(''); }}>Delete this budget</ConfirmButton>
          </Card>
        </aside>
      </div>
    </div>
  );
}
