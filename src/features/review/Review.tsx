import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { finance, goalCalc, monthTotals, realityCheck, reminderInfo, skillProgress } from '../../lib/calc';
import { daysSince, monthLabel, monthShort, niceDate, nowIdx, plural, tk, tkS, today, uid, ymOf } from '../../lib/format';
import { Card, ConfirmButton, Empty, Field, PageHeader, Pill, Stat, Stats } from '../../components/ui';

export default function Review() {
  const { db, create, update } = useData();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ title: '', why: '', expect: '', reviewDate: '' });
  const now = nowIdx(), thisYM = ymOf(now), lastYM = ymOf(now - 1);
  const F = finance(db), RC = realityCheck(db);
  const doneIn = (ym: string) => db.tasks.filter((t) => t.status === 'done' && t.doneAt.slice(0, 7) === ym).length;
  const tThis = doneIn(thisYM), tLast = doneIn(lastYM);
  const mThis = monthTotals(db.txns, thisYM), mLast = monthTotals(db.txns, lastYM);
  const goals = db.goals.map((g) => ({ g, c: goalCalc(db, g) }));
  const behind = goals.filter((x) => x.c.behind);
  const hours = Math.round(db.timeLog.filter((l) => l.date.slice(0, 7) === thisYM).reduce((a, l) => a + l.hours, 0) * 10) / 10;
  const months = Array.from({ length: 6 }, (_, k) => { const i = now - 5 + k; const t = monthTotals(db.txns, ymOf(i)); return { i, inn: t.inn, out: t.out }; });
  const max = Math.max(1, ...months.map((m) => Math.max(m.inn, m.out)));
  const overdueRem = db.reminders.filter((r) => reminderInfo(r).group === 'overdue').length;
  const moving = db.jobs.filter((j) => ['interviewing', 'assessment', 'offer'].includes(j.status)).length;

  const wins: string[] = [];
  if (tThis) wins.push(`${plural(tThis, 'task')} finished`);
  const dep = db.deposits.filter((x) => x.date.slice(0, 7) === thisYM).reduce((a, x) => a + x.amount, 0);
  if (dep) wins.push(`${tk(dep)} added to goals`);
  db.skills.forEach((s) => { const p = skillProgress(db, s); if (p.done) wins.push(`${s.name}: ${p.pct}% learned`); });
  if (moving) wins.push(`${plural(moving, 'job application')} moving forward`);
  const leaks: string[] = [];
  if (RC.overdue) leaks.push(plural(RC.overdue, 'overdue task'));
  if (overdueRem) leaks.push(plural(overdueRem, 'overdue reminder'));
  if (F.expense && mThis.out > F.expense) leaks.push(`Spending ${tkS(mThis.out - F.expense)} over plan`);
  const cat = new Map<string, number>(); mThis.mt.filter((t) => t.kind === 'out').forEach((t) => cat.set(t.category, (cat.get(t.category) ?? 0) + t.amount));
  const top = [...cat].sort((a, b) => b[1] - a[1])[0];
  if (top) leaks.push(`Biggest spend: ${top[0]} (${tkS(top[1])})`);
  const next: string[] = behind.slice(0, 2).map((x) => `${x.g.name}: ${x.g.useBudget ? `save ${tkS(x.c.need)}/mo or move the deadline` : 'give it more hours'}`);
  if (db.jobs.some((j) => j.status === 'applied' && (daysSince(j.appliedDate) ?? 0) >= 14)) next.push('Follow up on applications older than 2 weeks');
  if (F.emPct < 100 && F.emTarget > 0) next.push(`Keep topping up the emergency fund (${F.emPct}%)`);

  const add = () => {
    if (!d.title.trim()) return;
    create('decisions', { id: uid(), date: today(), title: d.title.trim(), why: d.why.trim(), expect: d.expect.trim(), reviewDate: d.reviewDate, outcome: '' }, 'Decision saved');
    setD({ title: '', why: '', expect: '', reviewDate: '' }); setOpen(false);
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow={monthLabel(now)} title="Review" />
      <Stats>
        <Stat label="Tasks done" value={<span className="num">{tThis}</span>} sub={`${tThis - tLast >= 0 ? '+' : ''}${tThis - tLast} vs last month`} />
        <Stat label="Spent" value={<span className="num">{tkS(mThis.out)}</span>} sub={mLast.out ? (mThis.out <= mLast.out ? `${tkS(mLast.out - mThis.out)} less than last month` : `${tkS(mThis.out - mLast.out)} more than last month`) : 'no data for last month'} />
        <Stat label="Goals behind" value={<span className={`num ${behind.length ? 'text-amber-ink' : ''}`}>{behind.length}</span>} sub={`${db.goals.filter((g) => g.state === 'done').length} of ${db.goals.length} done`} />
        <Stat label="Hours logged" value={<span className="num">{hours}</span>} sub="on goals this month" />
      </Stats>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="h2">In vs out · 6 months</h2>
          <div className="flex gap-3 text-[13px] text-mute"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#8FB3E8]" />In</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#E9B48A]" />Out</span></div></div>
        <div className="grid h-[170px] grid-cols-6 items-end gap-2 border-b border-line">
          {months.map((m) => (
            <div key={m.i} className="flex h-full items-end justify-center gap-[3px]">
              <div title={`In ${tk(m.inn)}`} className="w-2/5 max-w-[18px] rounded-t bg-[#8FB3E8]" style={{ height: `${Math.max(1, (m.inn / max) * 100)}%` }} />
              <div title={`Out ${tk(m.out)}`} className="w-2/5 max-w-[18px] rounded-t bg-[#E9B48A]" style={{ height: `${Math.max(1, (m.out / max) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-2 text-center text-[13px] text-mute">{months.map((m) => <span key={m.i}>{monthShort(m.i)}</span>)}</div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="h2">This month’s report</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 text-[14px]">
          <div className="soft bg-[#eef8f3]"><div className="lbl mb-1 !text-mint-ink">Achieved</div>{(wins.length ? wins : ['Nothing recorded yet.']).map((x) => <div key={x} className="py-0.5">{x}</div>)}</div>
          <div className="soft bg-[#fdf6ea]"><div className="lbl mb-1 !text-amber-ink">Needs attention</div>{(leaks.length ? leaks : ['Nothing worrying.']).map((x) => <div key={x} className="py-0.5">{x}</div>)}</div>
          <div className="soft bg-[#f1f5fd]"><div className="lbl mb-1 !text-pri-ink">Next month</div>{(next.length ? next : ['Keep the pace.']).map((x) => <div key={x} className="py-0.5">{x}</div>)}</div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between"><h2 className="h2">Decision journal</h2><button className="btn btn-sm btn-ghost" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : '+ New'}</button></div>
        {open && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Decision"><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} autoFocus /></Field>
              <Field label="Why"><input className="input" value={d.why} onChange={(e) => setD({ ...d, why: e.target.value })} /></Field>
              <Field label="What I expect"><input className="input" value={d.expect} onChange={(e) => setD({ ...d, expect: e.target.value })} /></Field>
              <Field label="Review on"><input className="input" type="date" value={d.reviewDate} onChange={(e) => setD({ ...d, reviewDate: e.target.value })} /></Field>
            </div>
            <div><button className="btn btn-primary" onClick={add}>Save decision</button></div>
          </div>
        )}
        {db.decisions.length === 0 ? <Empty>Write down big decisions before you make them, then compare later.</Empty> : (
          <ul>{db.decisions.slice().sort((a, b) => b.date.localeCompare(a.date)).map((x) => {
            const due = x.reviewDate && x.reviewDate <= today() && !x.outcome;
            return (
              <li key={x.id} className="flex flex-col gap-2 border-b border-line-soft py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-2"><strong className="wrap-any font-semibold">{x.title}</strong><Pill tone={x.outcome ? 'mint' : due ? 'amber' : 'gray'}>{x.outcome ? 'Reviewed' : due ? 'Review now' : x.reviewDate ? `Review ${niceDate(x.reviewDate)}` : niceDate(x.date)}</Pill></div>
                <p className="wrap-any text-[14px] text-mute">Why: {x.why || '—'} · Expected: {x.expect || '—'}</p>
                <textarea className="input !min-h-14" aria-label="What actually happened" placeholder="What actually happened?" value={x.outcome} onChange={(e) => update('decisions', x.id, { outcome: e.target.value }, { debounce: true })} />
                <DecisionDelete id={x.id} />
              </li>
            );
          })}</ul>
        )}
      </Card>
    </div>
  );
}

function DecisionDelete({ id }: { id: string }) {
  const { remove } = useData();
  return <ConfirmButton className="self-end" onConfirm={() => remove('decisions', id, 'Deleted')}>Delete</ConfirmButton>;
}
