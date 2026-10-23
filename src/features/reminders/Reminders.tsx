import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import type { Reminder, ReminderKind, Repeat } from '../../types';
import { reminderInfo, type RemGroup } from '../../lib/calc';
import { dateStr, nowIso, tk, tkS, today, uid } from '../../lib/format';
import { parseAmount } from '../../lib/parse';
import { REMINDER_COLOR } from '../../lib/ui-maps';
import { Card, Chips, ConfirmButton, Dot, Empty, Field, IconButton, PageHeader, Pill, Stat, Stats } from '../../components/ui';

const KINDS: { value: ReminderKind; label: string }[] = [
  { value: 'Bill', label: 'Bill / payment' }, { value: 'Tax', label: 'Tax' }, { value: 'Birthday', label: 'Birthday' },
  { value: 'Anniversary', label: 'Anniversary' }, { value: 'Renewal', label: 'Renewal' }, { value: 'Event', label: 'Event' }, { value: 'Other', label: 'Other' },
];
const GROUPS: { g: RemGroup; label: string }[] = [{ g: 'overdue', label: 'Overdue' }, { g: 'soon', label: 'Due soon' }, { g: 'later', label: 'Later' }, { g: 'done', label: 'Done' }];
const blank = { title: '', date: '', kind: 'Bill' as ReminderKind, repeat: 'none' as Repeat, amount: '', leadDays: '7', walletId: '' };

export default function Reminders() {
  const { db, create, update, remove } = useData();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(blank);
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState('');
  const wName = (id: string) => db.wallets.find((w) => w.id === id)?.name;
  const rows = db.reminders.map((r) => ({ r, i: reminderInfo(r) }));
  const in30 = rows.filter((x) => x.i.days != null && x.i.days <= 30 && !x.r.done);

  const save = () => {
    const amt = parseAmount(d.amount);
    if (!d.title.trim()) return setErr('Give it a name.');
    if (!d.date) return setErr('Pick a date.');
    if (!Number.isFinite(amt)) return setErr('The amount isn’t readable.');
    setErr('');
    create('reminders', { id: uid(), title: d.title.trim(), date: d.date, kind: d.kind, repeat: d.repeat, amount: Math.round(amt), walletId: d.walletId, leadDays: Math.max(0, Number(d.leadDays) || 0), lastDone: '', done: false }, 'Reminder saved');
    setD(blank); setOpen(false);
  };

  const markDone = (r: Reminder, nx: Date | null) => {
    if (r.repeat !== 'none' && nx) update('reminders', r.id, { lastDone: dateStr(nx) }, { toast: 'Done — moved to the next date' });
    else update('reminders', r.id, { done: true }, { toast: 'Marked done' });
  };
  const pay = (r: Reminder, nx: Date | null) => {
    create('txns', { id: uid(), date: today(), desc: r.title, amount: r.amount, kind: 'out', category: r.kind === 'Tax' ? 'Tax' : r.kind === 'Birthday' || r.kind === 'Anniversary' ? 'Gifts' : 'Bills & utilities', walletId: r.walletId, toWalletId: '', createdAt: nowIso() });
    markDone(r, nx);
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Bills, taxes, birthdays" title="Reminders" actions={<button className="btn btn-primary" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : '+ New reminder'}</button>} />
      <Stats>
        <Stat label="Overdue" value={<span className={`num ${rows.some((x) => x.i.group === 'overdue') ? 'text-rose-ink' : ''}`}>{rows.filter((x) => x.i.group === 'overdue').length}</span>} />
        <Stat label="Next 7 days" value={<span className="num">{rows.filter((x) => x.i.days != null && x.i.days >= 0 && x.i.days <= 7).length}</span>} />
        <Stat label="Next 30 days" value={<span className="num">{rows.filter((x) => x.i.days != null && x.i.days >= 0 && x.i.days <= 30).length}</span>} />
        <Stat label="To pay (30 days)" value={<span className="num">{tkS(in30.reduce((a, x) => a + (x.r.amount || 0), 0))}</span>} />
      </Stats>

      {open && (
        <Card className="flex flex-col gap-3.5">
          <h2 className="h2">New reminder</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="What" className="md:col-span-2"><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Income tax return" autoFocus /></Field>
            <Field label="Date"><input className="input" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
            <Field label="Type"><select className="input" value={d.kind} onChange={(e) => { const k = e.target.value as ReminderKind; setD({ ...d, kind: k, repeat: ['Birthday', 'Anniversary', 'Tax'].includes(k) ? 'yearly' : d.repeat }); }}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></Field>
            <Field label="Repeats"><select className="input" value={d.repeat} onChange={(e) => setD({ ...d, repeat: e.target.value as Repeat })}><option value="none">Once</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select></Field>
            <Field label="Amount (optional)"><input className="input num" inputMode="decimal" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} placeholder="e.g. 1500" /></Field>
            <Field label="Warn me (days before)"><input className="input num" inputMode="numeric" type="number" min={0} max={90} value={d.leadDays} onChange={(e) => setD({ ...d, leadDays: e.target.value })} /></Field>
          </div>
          {db.wallets.length > 0 && <div className="flex flex-col gap-1.5"><span className="lbl">Pay from</span><Chips label="Pay from" value={d.walletId} onChange={(v) => setD({ ...d, walletId: v })} options={[{ value: '', label: 'Not set' }, ...db.wallets.map((w) => ({ value: w.id, label: w.name }))]} /></div>}
          <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary" onClick={save}>Save reminder</button>{err && <span className="text-[14px] text-rose-ink" role="alert">{err}</span>}</div>
        </Card>
      )}

      {rows.length === 0 && <Card><Empty>No reminders yet — add taxes, bills, birthdays and renewals.</Empty></Card>}
      {GROUPS.map(({ g, label }) => {
        const list = rows.filter((x) => x.i.group === g).sort((a, b) => (a.i.days ?? 1e9) - (b.i.days ?? 1e9));
        if (!list.length) return null;
        return (
          <Card key={g} className="flex flex-col gap-1">
            <div className="flex items-center justify-between"><h2 className="h2">{label}</h2><span className="num text-[13px] text-mute">{list.length}</span></div>
            <ul>{list.map(({ r, i }) => {
              const years = i.nx && r.repeat === 'yearly' && (r.kind === 'Birthday' || r.kind === 'Anniversary') ? i.nx.k : 0;
              const wallet = wName(r.walletId);
              return (
                <li key={r.id} className="row-item flex-wrap !gap-2.5">
                  <div className="flex min-w-0 flex-[999_1_220px] items-start gap-3"><Dot color={REMINDER_COLOR[r.kind]} className="mt-[7px]" />
                    <div className="min-w-0"><div className="wrap-any font-medium">{r.title}</div>
                      <div className="text-[13px] text-mute">{i.nx ? i.nx.d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'} · {r.repeat === 'none' ? 'once' : r.repeat}{r.amount ? ` · ${tk(r.amount)}` : ''}{wallet ? ` · ${wallet}` : ''}{years > 0 ? (r.kind === 'Birthday' ? ` · turns ${years}` : ` · year ${years}`) : ''}</div>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Pill tone={i.tone}>{i.when}</Pill>
                    {!r.done && r.amount > 0 && wallet && <button className="btn btn-sm btn-primary" onClick={() => pay(r, i.nx?.d ?? null)}>Pay {tkS(r.amount)}</button>}
                    {!r.done && <button className="btn btn-sm btn-ghost" onClick={() => markDone(r, i.nx?.d ?? null)}>{r.amount > 0 && !wallet ? 'Paid' : 'Done'}</button>}
                    <IconButton icon="pencil" label="Edit" onClick={() => setEditId(editId === r.id ? '' : r.id)} />
                  </div>
                  {editId === r.id && (
                    <div className="flex w-full flex-wrap items-end gap-2">
                      <Field label="Name" className="min-w-40 flex-[2_1_200px]"><input className="input" value={r.title} onChange={(e) => update('reminders', r.id, { title: e.target.value }, { debounce: true })} /></Field>
                      <Field label="Date" className="flex-[1_1_150px]"><input className="input" type="date" value={r.date} onChange={(e) => update('reminders', r.id, { date: e.target.value, lastDone: '', done: false })} /></Field>
                      <ConfirmButton onConfirm={() => remove('reminders', r.id, 'Reminder deleted')}>Delete</ConfirmButton>
                    </div>
                  )}
                </li>
              );
            })}</ul>
          </Card>
        );
      })}
    </div>
  );
}
