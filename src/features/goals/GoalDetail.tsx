import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import type { Area, Goal, GoalState } from '../../types';
import { finance, goalCalc, settingNum, taskState } from '../../lib/calc';
import { dur, monthLabel, niceDate, nowIdx, nowIso, tk, tkS, today, uid } from '../../lib/format';
import { FORGOTTEN_COSTS } from '../../lib/parse';
import { AREAS, AREA_COLOR, KIND_TONE } from '../../lib/ui-maps';
import { Bar, Card, ConfirmButton, Empty, Field, IconButton, Pill, Stat, Stats } from '../../components/ui';

const num = (v: string) => Math.max(0, Number(v) || 0);

export default function GoalDetail({ id }: { id: string }) {
  const { db, create, update, remove } = useData();
  const g = db.goals.find((x) => x.id === id);
  const [ms, setMs] = useState('');
  const [task, setTask] = useState('');
  const [dep, setDep] = useState('');
  const [hrs, setHrs] = useState('');
  if (!g) return <Card><Empty>This goal doesn’t exist any more. <button className="text-pri-ink underline" onClick={() => go('goals')}>Back to goals</button></Empty></Card>;

  const c = goalCalc(db, g);
  const F = finance(db);
  const set = (p: Partial<Goal>, debounce = false) => update('goals', g.id, p, { debounce });
  const items = db.goalItems.filter((i) => i.goalId === g.id).sort((a, b) => a.order - b.order);
  const milestones = db.milestones.filter((m) => m.goalId === g.id).sort((a, b) => a.order - b.order);
  const tasks = db.tasks.filter((t) => t.goalId === g.id);
  const deposits = db.deposits.filter((d) => d.goalId === g.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const have = items.map((i) => i.label.toLowerCase());
  const tips = FORGOTTEN_COSTS[g.area].filter((l) => !have.includes(l.toLowerCase()));
  const inflation = settingNum(db, 'inflation');
  const dependents = db.goals.filter((x) => x.deps.includes(g.id));

  const scen = ([['Best case', 'save 25% more, price 5% lower', { monthly: c.monthly * 1.25, costX: 0.95 }, 'bg-[#eef8f3]'], ['Realistic', 'your current plan', {}, 'bg-[#f1f5fd]'], ['Worst case', 'save 25% less, price +10%', { monthly: c.monthly * 0.75, costX: 1.1, infAdd: 0.02 }, 'bg-[#fdf6ea]']] as const)
    .map(([name, how, o, bg]) => { const x = goalCalc(db, g, o); return { name, how, bg, finish: Number.isFinite(x.pace) ? monthLabel(x.finishI) : 'Never', line: `${tkS(x.monthly)}/mo · ${tkS(x.real)}` }; });
  const surplusAfter = F.saving - (g.running || 0);
  const aff = surplusAfter > 0 && F.emPct >= 100 ? (['Affordable', 'mint'] as const) : surplusAfter > 0 ? (['Tight', 'amber'] as const) : (['Not yet', 'rose'] as const);
  const timeOk = c.hoursLeft <= 0 || (Number.isFinite(c.timeFinishI) && c.timeFinishI <= c.dueI);

  const addMs = () => { if (!ms.trim()) return; create('milestones', { id: uid(), goalId: g.id, text: ms.trim(), done: false, order: (milestones.at(-1)?.order ?? -1) + 1 }); setMs(''); };
  const addTask = () => { if (!task.trim()) return; create('tasks', { id: uid(), title: task.trim(), goalId: g.id, status: 'todo', priority: 'Med', due: '', hours: 1, dependsOn: '', blocked: false, doneAt: '', createdAt: nowIso() }); setTask(''); };
  const addItem = (label = 'New line', amount = 0) => create('goalItems', { id: uid(), goalId: g.id, label, amount, order: (items.at(-1)?.order ?? -1) + 1 });
  const deposit = () => { const a = num(dep); if (!a) return; create('deposits', { id: uid(), goalId: g.id, date: today(), amount: a }); set({ saved: (g.saved || 0) + a }); setDep(''); };
  const logHours = () => { const h = num(hrs); if (!h) return; create('timeLog', { id: uid(), goalId: g.id, date: today(), hours: h }, `${h} h logged`); setHrs(''); };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center justify-between"><button className="btn btn-quiet !pl-1" onClick={() => go('goals')}>← All goals</button><ConfirmButton onConfirm={() => { remove('goals', g.id, 'Goal deleted'); go('goals'); }}>Delete goal</ConfirmButton></div>

      <Card className="flex flex-col gap-3.5" >
        <div className="-mx-5 -mt-5 mb-1 h-1 rounded-t-[16px] max-md:-mx-4 max-md:-mt-4" style={{ background: AREA_COLOR[g.area] }} />
        <input aria-label="Goal name" className="input input-ghost !pl-0 font-display !text-2xl font-semibold" value={g.name} onChange={(e) => set({ name: e.target.value }, true)} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Area"><select className="input" value={g.area} onChange={(e) => set({ area: e.target.value as Area })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={g.state} onChange={(e) => set({ state: e.target.value as GoalState })}><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select></Field>
          <Field label="Starts"><input className="input" type="month" value={g.start} onChange={(e) => set({ start: e.target.value })} /></Field>
          <Field label="Deadline"><input className="input" type="month" value={g.due} onChange={(e) => set({ due: e.target.value })} /></Field>
        </div>
        <div className="flex flex-col gap-1.5"><span className="lbl">This plan tracks</span>
          <div className="flex flex-wrap gap-2">
            <button className="chip" aria-pressed={g.useBudget} onClick={() => set({ useBudget: !g.useBudget })}>Money</button>
            <button className="chip" aria-pressed={g.useTime} onClick={() => set({ useTime: !g.useTime })}>Hours</button>
            <button className="chip" aria-pressed={g.focus} onClick={() => set({ focus: !g.focus })}>Focus this month</button>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[18px]">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><h2 className="h2">Milestones</h2><span className="num text-[14px] text-mute">{c.msDone} / {c.msTotal}</span></div>
            <Bar thin pct={c.msPct} />
            <ul>{milestones.map((m) => (
              <li key={m.id} className="row-item !py-1.5">
                <input type="checkbox" className="checkbox" aria-label="Milestone done" checked={m.done} onChange={() => update('milestones', m.id, { done: !m.done })} />
                <input className={`input input-ghost ${m.done ? 'text-mute line-through' : ''}`} aria-label="Milestone" value={m.text} onChange={(e) => update('milestones', m.id, { text: e.target.value }, { debounce: true })} />
                <IconButton icon="x" label="Remove milestone" onClick={() => remove('milestones', m.id)} />
              </li>
            ))}</ul>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addMs(); }}><input className="input" value={ms} onChange={(e) => setMs(e.target.value)} placeholder="Add a milestone" aria-label="New milestone" /><button className="btn btn-soft" type="submit">Add</button></form>
            <div className="soft bg-[#f1f5fd] text-[14px]">When it’s done → {dependents.length ? `unlocks ${dependents.map((x) => x.name).join(', ')}` : 'review what worked and pick the next goal'}</div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><h2 className="h2">Tasks</h2><span className="num text-[14px] text-mute">{tasks.filter((t) => t.status === 'done').length} / {tasks.length}</span></div>
            <ul>{tasks.map((t) => (
              <li key={t.id} className="row-item !py-2">
                <input type="checkbox" className="checkbox" aria-label="Done" checked={t.status === 'done'} onChange={() => update('tasks', t.id, t.status === 'done' ? { status: 'todo', doneAt: '' } : { status: 'done', doneAt: today() })} />
                <span className={`wrap-any flex-1 ${t.status === 'done' ? 'text-mute line-through' : ''}`}>{t.title}</span>
                {taskState(db, t).waiting && <Pill tone="amber">Waiting</Pill>}
                {t.due && <span className="text-[13px] text-mute">{niceDate(t.due)}</span>}
              </li>
            ))}</ul>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addTask(); }}><input className="input" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Add a task for this goal" aria-label="New task" /><button className="btn btn-soft" type="submit">Add</button></form>
          </Card>

          {g.useBudget && (
            <>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="h2">Budget</h2><span className="text-[13px] text-mute">Totals update as you type</span></div>
                <ul>{items.map((it) => (
                  <li key={it.id} className="row-item !gap-2 !py-1.5">
                    <input className="input flex-[1.6_1_0]" aria-label="Item" value={it.label} onChange={(e) => update('goalItems', it.id, { label: e.target.value }, { debounce: true })} />
                    <input className="input num flex-[1_1_0] text-right" aria-label="Amount" inputMode="numeric" type="number" min={0} value={it.amount} onChange={(e) => update('goalItems', it.id, { amount: num(e.target.value) }, { debounce: true })} />
                    <IconButton icon="x" label="Remove line" onClick={() => remove('goalItems', it.id)} />
                  </li>
                ))}</ul>
                <div className="flex items-end justify-between border-t border-line pt-3"><button className="btn btn-sm btn-ghost" onClick={() => addItem()}>+ Add line</button><div className="text-right"><div className="lbl">Total today</div><div className="num text-[22px]">{tk(c.target)}</div></div></div>
                {(tips.length > 0 || (c.target > 0 && !have.includes('contingency (10%)'))) && (
                  <div className="soft flex flex-col gap-2 bg-[#fdf6ea]"><span className="text-[14px] font-semibold">Often forgotten</span>
                    <div className="flex flex-wrap gap-2">
                      {tips.map((t) => <button key={t} className="chip border-dashed" onClick={() => addItem(t)}>+ {t}</button>)}
                      {c.target > 0 && !have.includes('contingency (10%)') && <button className="chip border-dashed" onClick={() => addItem('Contingency (10%)', Math.round(c.target * 0.1))}>+ Contingency (10%)</button>}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Already saved (৳)"><input className="input num" inputMode="numeric" type="number" min={0} value={g.saved} onChange={(e) => set({ saved: num(e.target.value) }, true)} /></Field>
                  <Field label="Running cost after (৳/mo)"><input className="input num" inputMode="numeric" type="number" min={0} value={g.running} onChange={(e) => set({ running: num(e.target.value) }, true)} /></Field>
                </div>
              </Card>

              <Card className="flex flex-col gap-3">
                <h2 className="h2">Best, realistic, worst</h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
                  {scen.map((s) => <div key={s.name} className={`soft flex flex-col gap-1 ${s.bg}`}><span className="text-[14px] font-semibold">{s.name}</span><span className="text-[13px] text-mute">{s.how}</span><span className="mt-1 font-semibold">{s.finish}</span><span className="num text-[13px] text-mute">{s.line}</span></div>)}
                </div>
              </Card>

              <Card className="flex flex-col gap-3">
                <div className="flex items-center justify-between"><h2 className="h2">Can I afford it?</h2><Pill tone={aff[1]}>{aff[0]}</Pill></div>
                <Stats>
                  <Stat label="Monthly surplus" value={<span className="num">{tkS(F.saving)}</span>} />
                  <Stat label="After running cost" value={<span className="num">{tkS(surplusAfter)}</span>} />
                  <Stat label="Share of income" value={<span className="num">{F.income ? Math.round(((g.running || 0) / F.income) * 100) : 0}%</span>} />
                  <Stat label="Emergency fund" value={<span className="num">{F.emCoverM.toFixed(1)} mo</span>} />
                </Stats>
                <p className="text-[13px] text-mute">Uses your monthly plan. Running cost = what it costs every month once you own it.{F.emPct < 100 ? ' Fill the emergency fund before a big purchase.' : ''}</p>
              </Card>
            </>
          )}

          {g.useTime && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between"><h2 className="h2">Hours</h2><Pill tone={timeOk ? 'mint' : 'amber'}>{c.hoursLeft <= 0 ? 'Hours done' : !Number.isFinite(c.timeFinishI) ? 'No hours set' : timeOk ? 'Fits' : 'Too slow'}</Pill></div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hours needed"><input className="input num" inputMode="numeric" type="number" min={0} value={g.hoursEst} onChange={(e) => set({ hoursEst: num(e.target.value) }, true)} /></Field>
                <Field label="Hours / week"><input className="input num" inputMode="decimal" type="number" min={0} step={0.5} value={g.weekly} onChange={(e) => set({ weekly: num(e.target.value) }, true)} /></Field>
              </div>
              <Bar pct={c.timePct} color="var(--color-mint)" />
              <div className="flex justify-between text-[14px]"><span><span className="num">{Math.round(c.logged * 10) / 10}</span> h logged</span><span className="text-mute">Done by {c.hoursLeft <= 0 ? 'now' : Number.isFinite(c.timeFinishI) ? monthLabel(c.timeFinishI) : '—'}</span></div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); logHours(); }}><input className="input num" inputMode="decimal" type="number" min={0} step={0.5} placeholder="Hours worked today" aria-label="Hours worked" value={hrs} onChange={(e) => setHrs(e.target.value)} /><button className="btn btn-soft" type="submit">Log</button></form>
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <h2 className="h2">Depends on</h2>
            {db.goals.length < 2 ? <p className="text-[14px] text-mute">No other goals yet.</p> : (
              <div className="flex flex-wrap gap-2">{db.goals.filter((x) => x.id !== g.id).map((x) => {
                const on = g.deps.includes(x.id);
                return <button key={x.id} className="chip" aria-pressed={on} onClick={() => set({ deps: on ? g.deps.filter((d) => d !== x.id) : [...g.deps, x.id] })}>{x.name}</button>;
              })}</div>
            )}
            <p className={`text-[14px] ${c.unmet.length ? 'text-amber-ink' : 'text-mute'}`}>{c.unmet.length ? `Waiting on ${c.unmet.map((u) => u.name).join(', ')}.` : g.deps.length ? 'All prerequisites done.' : 'Nothing has to come first.'}</p>
          </Card>

          <Card className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Why this matters"><textarea className="input" value={g.why} onChange={(e) => set({ why: e.target.value }, true)} placeholder="Because…" /></Field>
            <Field label="What could push it back?"><textarea className="input" value={g.risk} onChange={(e) => set({ risk: e.target.value }, true)} placeholder="Risks…" /></Field>
            <Field label="Resources needed"><textarea className="input" value={g.resources} onChange={(e) => set({ resources: e.target.value }, true)} placeholder="People, tools, documents…" /></Field>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px]">
          <Card className="flex flex-col gap-3 !border-[#dce5f8] !bg-[#f1f5fd]">
            <div className="flex items-center justify-between"><span className="lbl">Progress</span><Pill tone={KIND_TONE[c.kind]}>{c.status}</Pill></div>
            <div className="num text-[38px] leading-none text-pri-ink">{c.pct}%</div>
            <Bar pct={c.pct} track="bg-[#dde6f8]" />
            {g.useBudget && (
              <>
                <div><div className="lbl">Real cost on {monthLabel(c.dueI)}</div><div className="num text-[22px]">{tk(c.real)}</div><div className="text-[13px] text-mute">{tkS(c.target)} today + {inflation}%/yr × {Math.max(0, (c.dueI - nowIdx()) / 12).toFixed(1)} yrs</div></div>
                <div className="grid grid-cols-2 gap-2.5 text-[15px]">
                  <div><div className="lbl">Saved</div><div className="num">{tkS(c.saved)}</div></div>
                  <div><div className="lbl">Still to go</div><div className="num">{tkS(c.remaining)}</div></div>
                  <div><div className="lbl">Months left</div><div className="num">{c.monthsLeft}</div></div>
                  <div><div className="lbl">Need / month</div><div className="num">{tk(c.need)}</div></div>
                </div>
              </>
            )}
          </Card>
          {g.useBudget && (
            <>
              <Card className="flex flex-col gap-3">
                <h2 className="h2">What if I save…</h2>
                <div className="flex items-baseline justify-between"><span className="num text-[22px]">{tk(g.monthly)}</span><span className="text-[14px] text-mute">a month</span></div>
                <input type="range" aria-label="Monthly saving for this goal" className="w-full accent-pri" min={0} step={500} max={Math.max(10000, Math.ceil((c.need * 2) / 1000) * 1000, Math.ceil((g.monthly * 1.5) / 1000) * 1000)} value={g.monthly} onChange={(e) => set({ monthly: num(e.target.value) }, true)} />
                <div className="soft bg-[#f1f5fd] text-[14px]">Done by <strong className="font-semibold">{Number.isFinite(c.pace) ? monthLabel(c.finishI) : 'never at ৳0/mo'}</strong>. {Number.isFinite(c.late) && <span className={c.late > 0 ? 'text-amber-ink' : 'text-mint-ink'}>{c.late > 0 ? `${dur(c.late)} late.` : c.late < 0 ? `${dur(-c.late)} early.` : 'Right on time.'}</span>}</div>
              </Card>
              <Card className="flex flex-col gap-3">
                <h2 className="h2">Add savings</h2>
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); deposit(); }}><input className="input num" inputMode="numeric" type="number" min={0} placeholder="৳ amount" aria-label="Deposit amount" value={dep} onChange={(e) => setDep(e.target.value)} /><button className="btn btn-primary" type="submit">Add</button></form>
                <ul>{deposits.map((d) => <li key={d.id} className="row-item !py-1.5 text-[14px]"><span className="flex-1 text-mute">{niceDate(d.date)}</span><span className="num">+ {tk(d.amount)}</span></li>)}</ul>
              </Card>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
