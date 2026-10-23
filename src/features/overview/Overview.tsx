import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import { AREA_COLOR, KIND_TONE, PRIO_TONE, REMINDER_COLOR } from '../../lib/ui-maps';
import { balances, finance, goalCalc, monthTotals, realityCheck, reminderInfo } from '../../lib/calc';
import { monthLabel, niceDate, nowIdx, plural, tkS, today, ymOf } from '../../lib/format';
import { Bar, Card, Dot, Empty, PageHeader, Pill, Stat, Stats } from '../../components/ui';
import type { Tone } from '../../lib/calc';

export default function Overview() {
  const { db, update } = useData();
  const F = finance(db);
  const td = today();
  const goals = db.goals.map((g) => ({ g, c: goalCalc(db, g) }));
  const active = goals.filter((x) => x.g.state === 'active');
  const money = active.filter((x) => x.g.useBudget);
  const need = money.reduce((a, x) => a + x.c.need, 0);
  const over = need - F.cap > 1;
  const RC = realityCheck(db);
  const rems = db.reminders.map((r) => ({ r, i: reminderInfo(r) }));
  const overdueRem = rems.filter((x) => x.i.group === 'overdue').length;

  const checks = [
    { ok: money.every((x) => !x.c.behind), text: money.length ? `${money.filter((x) => !x.c.behind).length} of ${money.length} money goals finish on time` : 'No money goals yet' },
    { ok: !over, text: over ? `Goals need ${tkS(need)}/mo, you have ${tkS(F.cap)} free` : 'Your savings cover your goals' },
    { ok: RC.overdue + overdueRem === 0, text: RC.overdue + overdueRem ? [RC.overdue && plural(RC.overdue, 'overdue task'), overdueRem && plural(overdueRem, 'overdue reminder')].filter(Boolean).join(' · ') : 'Nothing overdue' },
    { ok: !RC.over, text: RC.over ? `Next 30 days need ${RC.need} h, you have ${RC.have} h` : 'Workload fits your free hours' },
    { ok: F.emPct >= 50, text: `Emergency fund at ${F.emPct}%` },
  ];
  const score = checks.filter((c) => c.ok).length;
  const verdict: [string, Tone] = score >= 4 ? ['Yes, on track', 'mint'] : score >= 2 ? ['Partly on track', 'amber'] : ['Off track', 'rose'];

  const bal = balances(db);
  const walletTotal = db.wallets.reduce((a, w) => a + (bal.get(w.id) ?? 0), 0);
  const spent = monthTotals(db.txns, ymOf(nowIdx())).out;
  const progress = active.length ? Math.round(active.reduce((a, x) => a + x.c.pct, 0) / active.length) : 0;

  const deadlines = [
    ...active.map((x) => ({ name: x.g.name, key: `${ymOf(x.c.dueI)}-99`, when: `${monthLabel(x.c.dueI)} · goal` })),
    ...db.tasks.filter((t) => t.status !== 'done' && t.due && t.due >= td).map((t) => ({ name: t.title, key: t.due, when: `${niceDate(t.due)} · task` })),
  ].sort((a, b) => a.key.localeCompare(b.key));

  const prio = (p: string) => (p === 'High' ? 0 : p === 'Med' ? 1 : 2);
  const todayTasks = db.tasks.filter((t) => t.status !== 'done' && ((t.due && t.due <= td) || t.status === 'doing')).sort((a, b) => prio(a.priority) - prio(b.priority)).slice(0, 5);
  const soon = rems.filter((x) => x.i.days != null && x.i.days <= 30 && !x.r.done).sort((a, b) => (a.i.days ?? 0) - (b.i.days ?? 0)).slice(0, 5);
  let focus = active.filter((x) => x.g.focus);
  if (!focus.length) focus = active.slice().sort((a, b) => a.c.dueI - b.c.dueI);

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} title="Overview"
        actions={<button className="btn btn-primary" onClick={() => go('goals')}>+ Plan something</button>} />

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="lbl">Am I on track?</div><div className="h2 mt-0.5 !text-2xl">{verdict[0]}</div></div>
          <Pill tone={verdict[1]}>{score} of 5 checks</Pill>
        </div>
        <ul>{checks.map((c) => <li key={c.text} className="row-item !py-2 text-[14px]"><Dot color={c.ok ? 'var(--color-mint)' : 'var(--color-amber)'} />{c.text}</li>)}</ul>
      </Card>

      <Stats>
        <Stat label="In wallets" value={<span className="num">{tkS(walletTotal)}</span>} sub={`across ${plural(db.wallets.length, 'wallet')}`} />
        <Stat label="Spent this month" value={<span className="num">{tkS(spent)}</span>} sub={F.expense ? (spent > F.expense ? `${tkS(spent - F.expense)} over plan` : `${tkS(F.expense - spent)} left of plan`) : 'no monthly plan set'} />
        <Stat label="Goals progress" value={<span className="num">{progress}%</span>} sub={<Bar thin pct={progress} className="mt-1.5" />} />
        <Stat label="Next deadline" value={<span className="text-base font-semibold leading-snug">{deadlines[0]?.name ?? 'Nothing scheduled'}</span>} sub={deadlines[0]?.when} />
      </Stats>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[999_1_480px] flex-col gap-2">
          <div className="flex items-center justify-between"><h2 className="h2">Today</h2><button className="btn btn-sm btn-quiet" onClick={() => go('tasks')}>All tasks</button></div>
          {todayTasks.length ? <ul>{todayTasks.map((t) => {
            const g = db.goals.find((x) => x.id === t.goalId);
            return (
              <li key={t.id} className="row-item">
                <input type="checkbox" className="checkbox" aria-label={`Mark ${t.title} done`} checked={false} onChange={() => update('tasks', t.id, { status: 'done', doneAt: td }, { toast: 'Task done' })} />
                <div className="min-w-0 flex-1"><div className="wrap-any font-medium">{t.title}</div><div className="text-[13px] text-mute">{[g?.name, t.due && `due ${niceDate(t.due)}`].filter(Boolean).join(' · ')}</div></div>
                <Pill tone={PRIO_TONE[t.priority]}>{t.priority === 'Med' ? 'Medium' : t.priority}</Pill>
              </li>
            );
          })}</ul> : <Empty>Nothing due today.</Empty>}
        </Card>
        <Card className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
          <div className="flex items-center justify-between"><h2 className="h2">Coming up</h2><button className="btn btn-sm btn-quiet" onClick={() => go('reminders')}>Reminders</button></div>
          {soon.length ? <ul>{soon.map(({ r, i }) => (
            <li key={r.id} className="row-item"><Dot color={REMINDER_COLOR[r.kind]} /><div className="min-w-0 flex-1"><div className="wrap-any font-medium">{r.title}</div><div className="text-[13px] text-mute">{i.nx?.d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{r.amount ? ` · ${tkS(r.amount)}` : ''}</div></div><Pill tone={i.tone}>{i.when}</Pill></li>
          ))}</ul> : <Empty>Nothing in the next 30 days.</Empty>}
        </Card>
      </div>

      <Card className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="h2">Focus this month</h2><span className="text-[13px] text-mute">Star a goal to pin it here</span></div>
        {focus.length ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {focus.slice(0, 3).map(({ g, c }) => (
              <button key={g.id} onClick={() => go('goal', g.id)} className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-white p-4 text-left hover:border-[#c3d0f0]">
                <span className="flex items-start justify-between gap-2"><span className="wrap-any font-semibold">{g.name}</span><Pill tone={KIND_TONE[c.kind]}>{c.status}</Pill></span>
                <Bar pct={c.pct} color={AREA_COLOR[g.area]} />
                <span className="wrap-any text-[13px] text-mute">Next: {c.next}</span>
              </button>
            ))}
          </div>
        ) : <Empty>No active goals yet.</Empty>}
      </Card>
    </div>
  );
}
