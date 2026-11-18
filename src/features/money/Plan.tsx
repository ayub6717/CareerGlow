import { useData } from '../../storage/DataContext';
import { finance, settingNum } from '../../lib/calc';
import { dur, tk, tkS, uid } from '../../lib/format';
import { Bar, Card, Field, IconButton, PageHeader, Stat, Stats } from '../../components/ui';

const num = (v: string) => Math.max(0, Number(v) || 0);

/** Monthly income, planned spending and the emergency fund — used by Goals, smart split and "Can I afford it?". */
export default function Plan() {
  const { db, create, update, remove, setSetting } = useData();
  const F = finance(db);
  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Money" title="Monthly plan" />
      <Stats>
        <Stat label="Income" value={<span className="num">{tkS(F.income)}</span>} />
        <Stat label="Planned spending" value={<span className="num">{tkS(F.expense)}</span>} />
        <Stat label="Left each month" value={<span className={`num ${F.saving < 0 ? 'text-rose-ink' : 'text-mint-ink'}`}>{tkS(F.saving)}</span>} />
        <Stat label="Emergency fund" value={<span className="num">{F.emPct}%</span>} />
      </Stats>
      <Card className="flex flex-col gap-3.5">
        <p className="text-[14px] text-mute">Goals, smart split and “Can I afford it?” use these numbers.</p>
        <Field label="Monthly income (৳)"><input className="input num" inputMode="numeric" type="number" min={0} value={settingNum(db, 'income')} onChange={(e) => setSetting('income', num(e.target.value))} /></Field>
        <div className="lbl">Planned monthly spending</div>
        <ul>{db.plannedExpenses.slice().sort((a, b) => a.order - b.order).map((x) => (
          <li key={x.id} className="row-item !gap-2 !py-1.5">
            <input className="input flex-[1.6_1_0]" aria-label="Expense" value={x.label} onChange={(e) => update('plannedExpenses', x.id, { label: e.target.value }, { debounce: true })} />
            <input className="input num flex-[1_1_0] text-right" aria-label="Amount" inputMode="numeric" type="number" min={0} value={x.amount} onChange={(e) => update('plannedExpenses', x.id, { amount: num(e.target.value) }, { debounce: true })} />
            <IconButton icon="x" label="Remove" onClick={() => remove('plannedExpenses', x.id)} />
          </li>
        ))}</ul>
        <div className="flex flex-wrap items-center justify-between gap-2"><button className="btn btn-sm btn-ghost" onClick={() => create('plannedExpenses', { id: uid(), label: 'New line', amount: 0, order: db.plannedExpenses.length })}>+ Add line</button><span className="text-[14px]">Left each month: <strong className="num font-medium">{tk(F.saving)}</strong></span></div>
      </Card>
      <Card className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between"><h2 className="h2">Emergency fund</h2><span className="num text-[14px]">{F.emPct}%</span></div>
        <Bar pct={F.emPct} color="var(--color-mint)" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <Field label="Months of spending"><input className="input num" inputMode="numeric" type="number" min={1} max={24} value={settingNum(db, 'emMonths')} onChange={(e) => setSetting('emMonths', num(e.target.value))} /></Field>
          <Field label="Saved (৳)"><input className="input num" inputMode="numeric" type="number" min={0} value={settingNum(db, 'emSaved')} onChange={(e) => setSetting('emSaved', num(e.target.value))} /></Field>
          <Field label="Top-up / month"><input className="input num" inputMode="numeric" type="number" min={0} value={settingNum(db, 'emMonthly')} onChange={(e) => setSetting('emMonthly', num(e.target.value))} /></Field>
        </div>
        <p className="text-[13px] text-mute">Target {tk(F.emTarget)} · full in {F.emLeft <= 0 ? 'already full' : settingNum(db, 'emMonthly') > 0 ? dur(Math.ceil(F.emLeft / settingNum(db, 'emMonthly'))) : 'never at ৳0 top-up'}</p>
      </Card>
    </div>
  );
}
