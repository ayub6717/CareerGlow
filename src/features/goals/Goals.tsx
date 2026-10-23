import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import type { Goal } from '../../types';
import { allocate, finance, goalCalc, settingNum } from '../../lib/calc';
import { addDays, monthLabel, nowIdx, nowIso, tk, tkS, uid, ymOf } from '../../lib/format';
import { parsePlan, TEMPLATES, type PlanDraft } from '../../lib/parse';
import { AREA_COLOR, KIND_TONE } from '../../lib/ui-maps';
import { Bar, Card, Dot, Empty, Field, Icon, PageHeader, Pill, Stat, Stats } from '../../components/ui';

export function newGoal(p: Partial<Goal> = {}): Goal {
  const n = nowIdx();
  return {
    id: uid(), name: 'New goal', area: 'Other', state: 'active', start: ymOf(n), due: ymOf(n + 12), focus: false, useBudget: true, useTime: false,
    saved: 0, monthly: 0, running: 0, hoursEst: 0, weekly: 0, deps: [], why: '', risk: '', resources: '', createdAt: nowIso(), ...p,
  };
}

export default function Goals() {
  const { db, create, update, setSetting } = useData();
  const F = finance(db);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);

  const goals = db.goals.map((g) => ({ g, c: goalCalc(db, g) }));
  const money = goals.filter((x) => x.g.state === 'active' && x.g.useBudget);
  const need = money.reduce((a, x) => a + x.c.need, 0);
  const gap = need - F.cap;
  const rows = allocate(db, F.cap);
  const inflation = settingNum(db, 'inflation');

  const addBlank = () => { const g = newGoal(); create('goals', g, 'Goal created'); go('goal', g.id); };
  const applySplit = () => { rows.forEach((r) => update('goals', r.g.id, { monthly: r.alloc + r.extra })); };

  const saveDraft = () => {
    if (!draft) return;
    const n = nowIdx(), tp = TEMPLATES[draft.area];
    const g = newGoal({
      name: draft.name.trim() || 'New goal', area: draft.area, due: ymOf(n + (draft.months || 12)),
      useBudget: draft.area !== 'Career' || !!draft.amount, useTime: ['Career', 'Content', 'Business'].includes(draft.area),
      risk: draft.irregular ? 'Irregular income — some months I may save nothing.' : '',
    });
    create('goals', g);
    create('goalItems', tp.items.map((label, order) => ({ id: uid(), goalId: g.id, label, amount: order === 0 ? draft.amount : 0, order })));
    create('milestones', tp.ms.map((text, order) => ({ id: uid(), goalId: g.id, text, done: false, order })));
    const t1 = uid();
    create('tasks', tp.ms.slice(0, 2).map((title, i) => ({
      id: i === 0 ? t1 : uid(), title, goalId: g.id, status: 'todo' as const, priority: i === 0 ? 'High' as const : 'Med' as const,
      due: addDays(7 * (i + 1)), hours: 2, dependsOn: i === 1 ? t1 : '', blocked: false, doneAt: '', createdAt: nowIso(),
    })), 'Plan saved');
    setDraft(null); setText('');
    go('goal', g.id);
  };

  const dr = draft && (() => {
    const real = draft.amount * Math.pow(1 + inflation / 100, draft.months / 12);
    const per = real / Math.max(1, draft.months);
    const notes = [
      !draft.amount && 'No price found — enter the main cost.',
      !draft.monthsGiven && 'No timeframe given, so 12 months assumed.',
      per > F.cap && `Needs ${tk(per)}/mo, only ${tk(F.cap)} is free.`,
      draft.irregular && 'Irregular income: plan on your lowest month.',
      draft.loan && 'Loan mentioned — check the EMI before committing.',
    ].filter(Boolean) as string[];
    return { real, per, notes: notes.length ? notes : ['Looks fundable with your current plan.'] };
  })();

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Goal → Milestone → Task" title="Goals & Plans" actions={<button className="btn btn-ghost" onClick={addBlank}>+ Blank goal</button>} />

      <Card className="flex flex-col gap-3.5 !border-[#e4def6] !bg-[#f5f2fc]">
        <div><h2 className="h2">Plan assistant</h2><p className="mt-1 text-[14px] text-mute">Describe a plan in plain words — English or বাংলা. Every number is calculated, nothing is guessed.</p></div>
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Describe your plan" placeholder="e.g. Buy a car for 18 lakh in 18 months, income is irregular" />
        <div><button className="btn btn-primary" onClick={() => text.trim() && setDraft(parsePlan(text))}>Build the plan</button></div>
        {draft && dr && (
          <div className="card flex flex-col gap-3.5 !shadow-none">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Goal name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="Main cost today (৳)"><input className="input num" inputMode="numeric" type="number" min={0} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Math.max(0, Number(e.target.value) || 0) })} /></Field>
              <Field label="Months to deadline"><input className="input num" inputMode="numeric" type="number" min={1} value={draft.months} onChange={(e) => setDraft({ ...draft, months: Math.max(1, Number(e.target.value) || 1), monthsGiven: true })} /></Field>
            </div>
            <Stats>
              <Stat label="Area" value={<span className="text-base font-semibold">{draft.area}</span>} />
              <Stat label="Deadline" value={<span className="text-base font-semibold">{monthLabel(nowIdx() + draft.months)}</span>} />
              <Stat label="Cost then" value={<span className="num text-[17px]">{tkS(dr.real)}</span>} />
              <Stat label="Needed / month" value={<span className="num text-[17px]">{tk(dr.per)}</span>} />
            </Stats>
            <div className="grid grid-cols-1 gap-3 text-[14px] md:grid-cols-2">
              <div><div className="lbl mb-1">Milestones</div><ol className="list-decimal pl-5">{TEMPLATES[draft.area].ms.map((m) => <li key={m}>{m}</li>)}</ol></div>
              <div><div className="lbl mb-1">Watch out</div><ul>{dr.notes.map((n) => <li key={n}>· {n}</li>)}</ul></div>
            </div>
            <div className="flex flex-wrap gap-2.5"><button className="btn btn-primary" onClick={saveDraft}>Save as goal + tasks</button><button className="btn btn-quiet" onClick={() => setDraft(null)}>Discard</button></div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="h2">Money for goals</h2><div className="mt-0.5 text-[14px] text-mute">Goals need {tkS(need)}/mo · you have {tkS(F.cap)}/mo free</div></div>
          <Pill tone={gap > 1 ? 'amber' : 'mint'}>{gap > 1 ? `Short ${tkS(gap)}/mo` : 'Covered'}</Pill>
        </div>
        <div className="flex flex-wrap gap-2"><button className="btn btn-sm btn-soft" onClick={applySplit} disabled={!rows.length}>Apply smart split</button><button className="btn btn-sm btn-quiet" onClick={() => setSplitOpen((o) => !o)}>{splitOpen ? 'Hide details' : 'Show details'}</button></div>
        {splitOpen && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] text-mute">Nearest deadline is funded first. Uses the monthly plan in Wallets &amp; Spending.</p>
            <ul>{rows.map((r) => {
              const cov = r.c.need > 0 ? Math.min(100, Math.round((r.alloc / r.c.need) * 100)) : 100;
              return (
                <li key={r.g.id} className="row-item flex-wrap">
                  <Dot color={AREA_COLOR[r.g.area]} />
                  <div className="min-w-0 flex-[1_1_160px]"><div className="font-medium">{r.g.name}</div><div className="text-[13px] text-mute">due {monthLabel(r.c.dueI)} · needs <span className="num">{tk(r.c.need)}</span>/mo</div></div>
                  <div className="min-w-[120px] flex-[1_1_140px]"><div className="flex justify-between text-[13px]"><span className="num">{tk(r.alloc + r.extra)}</span><span className="text-mute">{cov}%</span></div><Bar thin pct={cov} color={cov >= 100 ? 'var(--color-mint)' : 'var(--color-amber)'} className="mt-1" /></div>
                </li>
              );
            })}</ul>
            {!rows.length && <Empty>No active money goals.</Empty>}
            <Field label="Inflation % / year" className="max-w-[200px]"><input className="input num" inputMode="decimal" type="number" min={0} max={30} step={0.5} value={inflation} onChange={(e) => setSetting('inflation', Math.max(0, Number(e.target.value) || 0))} /></Field>
          </div>
        )}
      </Card>

      {goals.length === 0 ? <Card><Empty>No goals yet. Describe one above, or add a blank goal.</Empty></Card> : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {goals.map(({ g, c }) => (
            <Card as="article" key={g.id} className="flex flex-col gap-3 !p-[18px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="flex items-center gap-1.5 text-[13px] text-mute"><Dot color={AREA_COLOR[g.area]} />{g.area} · due {monthLabel(c.dueI)}</div><h3 className="h2 wrap-any mt-1 !text-lg">{g.name}</h3></div>
                <button className={`icon-btn ${g.focus ? 'text-[#d9925a]' : ''}`} aria-label={g.focus ? 'Unpin from focus' : 'Pin to focus'} aria-pressed={g.focus} onClick={() => update('goals', g.id, { focus: !g.focus })}><Icon name="star" fill={g.focus ? '#F2C49B' : 'none'} /></button>
              </div>
              <div className="flex items-center justify-between"><Pill tone={KIND_TONE[c.kind]}>{c.status}</Pill><span className="num text-[14px]">{c.pct}%</span></div>
              <Bar pct={c.pct} color={AREA_COLOR[g.area]} />
              <div className="text-[14px] text-mute">{g.useBudget && c.target > 0 ? `${tkS(c.saved)} of ${tkS(c.real)} · ${tkS(c.need)}/mo needed` : `${g.useTime && c.hoursEst ? `${Math.round(c.logged)} of ${c.hoursEst} h · ` : ''}${c.msDone}/${c.msTotal} milestones`}</div>
              <div className="wrap-any text-[14px]">Next: <strong className="font-semibold">{c.next}</strong></div>
              {c.unmet.length > 0 && <div className="text-[13px] text-amber-ink">Waiting on {c.unmet.map((u) => u.name).join(', ')}</div>}
              <button className="btn btn-ghost mt-auto" onClick={() => go('goal', g.id)}>Open plan</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
