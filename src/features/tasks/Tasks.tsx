import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import type { Priority, Task, TaskStatus } from '../../types';
import { realityCheck, settingNum, taskState } from '../../lib/calc';
import { niceDate, nowIso, today, uid } from '../../lib/format';
import { AREA_COLOR, PRIO_TONE } from '../../lib/ui-maps';
import { Card, Chips, Dot, Empty, Field, IconButton, PageHeader, Pill } from '../../components/ui';

const LANES: { value: TaskStatus; label: string }[] = [{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'In progress' }, { value: 'done', label: 'Done' }];
const NEXT: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' };
const prio = (p: Priority) => (p === 'High' ? 0 : p === 'Med' ? 1 : 2);

export default function Tasks() {
  const { db, create, update, remove, setSetting } = useData();
  const [lane, setLane] = useState<TaskStatus>('todo');
  const [more, setMore] = useState(false);
  const [d, setD] = useState({ title: '', priority: 'Med' as Priority, due: '', hours: '1', goalId: '', dependsOn: '' });
  const RC = realityCheck(db);
  const weekly = settingNum(db, 'weeklyHours');

  const add = () => {
    if (!d.title.trim()) return;
    create('tasks', { id: uid(), title: d.title.trim(), goalId: d.goalId, status: 'todo', priority: d.priority, due: d.due, hours: Math.max(0, Number(d.hours) || 0), dependsOn: d.dependsOn, blocked: false, doneAt: '', createdAt: nowIso() }, 'Task added');
    setD({ ...d, title: '', dependsOn: '' });
    setLane('todo');
  };
  const setStatus = (t: Task, s: TaskStatus) => update('tasks', t.id, { status: s, doneAt: s === 'done' ? today() : '' });

  const depCands = db.tasks.filter((t) => t.status !== 'done' && (!d.goalId || t.goalId === d.goalId));
  const items = db.tasks.filter((t) => t.status === lane).sort((a, b) => lane === 'done'
    ? b.doneAt.localeCompare(a.doneAt)
    : Number(taskState(db, a).waiting) - Number(taskState(db, b).waiting) || prio(a.priority) - prio(b.priority) || (a.due || '9').localeCompare(b.due || '9'));

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Execution" title="Tasks" />

      <Card className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="lbl">Next 30 days</div><div className="mt-0.5 font-semibold">{RC.over ? `Overloaded by ${RC.need - RC.have} hours` : 'Your workload fits'}</div></div>
          <Pill tone={RC.over ? 'amber' : 'mint'}>{RC.need} h / {RC.have} h free</Pill>
        </div>
        <p className="text-[14px] text-mute">{RC.over ? `At ${weekly} free hours a week this takes about ${RC.daysNeeded} days. Move low-priority deadlines out, or free up more hours.` : `Open tasks due in the next 30 days fit your free time${RC.need ? `, with ${RC.have - RC.need} h to spare` : ''}.`}</p>
        <label className="flex items-center gap-2.5 text-[14px]"><span className="text-mute">Free hours per week</span><input className="input num !w-24" inputMode="numeric" type="number" min={0} max={100} value={weekly} onChange={(e) => setSetting('weeklyHours', Math.max(0, Number(e.target.value) || 0))} /></label>
      </Card>

      <Card className="flex flex-col gap-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Add a task…" aria-label="New task" /><button className="btn btn-primary" type="submit">Add</button></form>
        <button className="btn btn-sm btn-quiet self-start !pl-1" onClick={() => setMore((m) => !m)} aria-expanded={more}>{more ? 'Fewer options' : 'More options (goal, deadline, priority)'}</button>
        {more && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              <Field label="Priority"><select className="input" value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value as Priority })}><option value="High">High</option><option value="Med">Medium</option><option value="Low">Low</option></select></Field>
              <Field label="Deadline"><input className="input" type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} /></Field>
              <Field label="Hours"><input className="input num" inputMode="decimal" type="number" min={0} step={0.5} value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} /></Field>
            </div>
            <div className="flex flex-col gap-1.5"><span className="lbl">Goal</span>
              <Chips label="Goal" value={d.goalId} onChange={(v) => setD({ ...d, goalId: v, dependsOn: '' })} options={[{ value: '', label: 'No goal' }, ...db.goals.filter((g) => g.state !== 'done').map((g) => ({ value: g.id, label: g.name }))]} />
            </div>
            {depCands.length > 0 && (
              <div className="flex flex-col gap-1.5"><span className="lbl">Starts after</span>
                <Chips label="Depends on" value={d.dependsOn} onChange={(v) => setD({ ...d, dependsOn: v })} options={[{ value: '', label: 'Nothing' }, ...depCands.map((t) => ({ value: t.id, label: t.title }))]} />
              </div>
            )}
          </div>
        )}
      </Card>

      <Chips label="Task status" value={lane} onChange={setLane} options={LANES.map((l) => ({ value: l.value, label: <>{l.label} · {db.tasks.filter((t) => t.status === l.value).length}</> }))} />

      <Card className="!py-1.5">
        {items.length === 0 ? <Empty>Nothing here.</Empty> : (
          <ul>{items.map((t) => {
            const s = taskState(db, t), g = db.goals.find((x) => x.id === t.goalId);
            const flag = t.blocked ? (['Blocked', 'rose'] as const) : s.waiting ? ([`Waiting on: ${s.dep?.title}`, 'amber'] as const) : s.ready ? (['Ready to start', 'mint'] as const) : s.overdue ? (['Overdue', 'rose'] as const) : null;
            return (
              <li key={t.id} className="row-item !items-start">
                <input type="checkbox" className="checkbox mt-0.5" aria-label={`Mark ${t.title} done`} checked={t.status === 'done'} onChange={() => setStatus(t, t.status === 'done' ? 'todo' : 'done')} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className={`wrap-any font-medium ${t.status === 'done' ? 'text-mute line-through' : ''}`}>{t.title}</div>
                  <div className="flex items-center gap-2 text-[13px] text-mute"><Dot color={g ? AREA_COLOR[g.area] : '#9AA5B4'} />{[g?.name ?? 'No goal', t.due && `due ${niceDate(t.due)}`, `${t.hours || 0} h`].filter(Boolean).join(' · ')}</div>
                  {flag && <Pill tone={flag[1]} className="self-start">{flag[0]}</Pill>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill tone={PRIO_TONE[t.priority]}>{t.priority === 'Med' ? 'Medium' : t.priority}</Pill>
                  <div className="flex">
                    <IconButton icon="arrow" label={t.status === 'todo' ? 'Move to In progress' : t.status === 'doing' ? 'Move to Done' : 'Move back to To do'} onClick={() => setStatus(t, NEXT[t.status])} />
                    <IconButton icon="ban" label={t.blocked ? 'Unblock' : 'Mark blocked'} onClick={() => update('tasks', t.id, { blocked: !t.blocked })} />
                    <IconButton icon="x" label="Delete task" onClick={() => remove('tasks', t.id, 'Task deleted')} />
                  </div>
                </div>
              </li>
            );
          })}</ul>
        )}
      </Card>
    </div>
  );
}
