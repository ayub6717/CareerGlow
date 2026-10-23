import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import type { Skill, Subtopic, Topic } from '../../types';
import { LEARN_LABEL, LEARN_TONE, skillProgress, topicProgress } from '../../lib/calc';
import { nowIso, uid } from '../../lib/format';
import { parseOutline } from '../../lib/parse';
import { DOTNET_OUTLINE, outlineRows } from '../../lib/seed';
import { Bar, Card, ConfirmButton, Empty, Field, Icon, IconButton, PageHeader, Pill } from '../../components/ui';

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export default function Skills() {
  const { db, create } = useData();
  const skills = db.skills.slice().sort(byOrder);
  const [selId, setSelId] = useState<string>('');
  const sel = skills.find((s) => s.id === selId) ?? skills[0];
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const addSkill = () => {
    const name = newName.trim();
    if (!name) return;
    if (skills.some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) { setNewName(''); setNewOpen(false); setSelId(skills.find((s) => s.name.trim().toLowerCase() === name.toLowerCase())!.id); return; }
    const id = uid();
    create('skills', { id, name, why: '', project: '', order: (skills.at(-1)?.order ?? -1) + 1, createdAt: nowIso() }, `Added ${name}`);
    setSelId(id); setNewName(''); setNewOpen(false);
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Career" title="Skills & Learning" />

      <div className="seg" role="group" aria-label="Skills">
        {skills.map((s) => (
          <button key={s.id} className="chip" aria-pressed={sel?.id === s.id} onClick={() => setSelId(s.id)}>{s.name || 'Untitled'} <span className="num opacity-75">{skillProgress(db, s).pct}%</span></button>
        ))}
        <button className="chip border-dashed" onClick={() => setNewOpen((o) => !o)}>+ New skill</button>
      </div>
      {(newOpen || skills.length === 0) && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addSkill(); }}>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. .NET, Docker, System design" aria-label="New skill name" autoFocus={newOpen} />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
      )}

      {sel ? <SkillView key={sel.id} skill={sel} onDeleted={() => setSelId('')} /> : <Card><Empty>Add the first skill you’re learning.</Empty></Card>}

      <Counters />
    </div>
  );
}

function SkillView({ skill, onDeleted }: { skill: Skill; onDeleted: () => void }) {
  const { db, create, update, remove } = useData();
  const p = skillProgress(db, skill);
  const topics = db.topics.filter((t) => t.skillId === skill.id).sort(byOrder);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [topicDraft, setTopicDraft] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');

  const addTopic = () => {
    const name = topicDraft.trim();
    if (!name) return;
    const id = uid();
    create('topics', { id, skillId: skill.id, name, done: false, order: (topics.at(-1)?.order ?? -1) + 1 });
    setOpenMap((m) => ({ ...m, [id]: true }));
    setTopicDraft('');
  };
  const addOutline = (outline: { name: string; subs: string[] }[]) => {
    if (!outline.length) return;
    const { topics: t, subtopics: s } = outlineRows(skill.id, outline, (topics.at(-1)?.order ?? -1) + 1);
    create('topics', t);
    create('subtopics', s, `Added ${t.length} topic${t.length === 1 ? '' : 's'}`);
    setPaste(''); setPasteOpen(false);
  };
  const swap = <T extends Topic | Subtopic>(table: 'topics' | 'subtopics', list: T[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    const ao = a.order === b.order ? i : a.order, bo = a.order === b.order ? j : b.order;
    update(table, a.id, { order: bo } as never);
    update(table, b.id, { order: ao } as never);
  };

  return (
    <>
      <Card className="flex flex-col gap-3.5">
        <input aria-label="Skill name" className="input input-ghost !pl-0 font-display !text-2xl font-semibold" value={skill.name} onChange={(e) => update('skills', skill.id, { name: e.target.value }, { debounce: true })} />
        <div className="flex items-center justify-between"><Pill tone={LEARN_TONE[p.state]}>{LEARN_LABEL[p.state]}</Pill><span className="num text-[22px] text-pri-ink">{p.pct}%</span></div>
        <Bar pct={p.pct} className="!h-2.5" color={p.state === 'done' ? 'var(--color-mint)' : undefined} />
        <div className="text-[14px] text-mute">{p.done} of {p.total} items done · {p.topicsDone} of {p.topicsTotal} topics completed</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Why I’m learning it"><input className="input" value={skill.why} onChange={(e) => update('skills', skill.id, { why: e.target.value }, { debounce: true })} placeholder="e.g. Move into full-stack roles" /></Field>
          <Field label="Practice project"><input className="input" value={skill.project} onChange={(e) => update('skills', skill.id, { project: e.target.value }, { debounce: true })} placeholder="Build something real with it" /></Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="h2">Topics</h2>
          <div className="flex items-center gap-0.5">
            <button className="btn btn-sm btn-quiet" onClick={() => setOpenMap(Object.fromEntries(topics.map((t) => [t.id, true])))}>Expand</button>
            <button className="btn btn-sm btn-quiet" onClick={() => setOpenMap({})}>Collapse</button>
            <button className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-soft'}`} onClick={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit'}</button>
          </div>
        </div>

        {topics.length === 0 && (
          <div className="empty flex flex-col items-center gap-3">
            No topics yet. Add one below, paste an outline, or start from an example.
            <button className="btn btn-sm btn-soft" onClick={() => addOutline(DOTNET_OUTLINE)}>Add the .NET example outline</button>
          </div>
        )}

        <ul className="flex flex-col">
          {topics.map((t, ti) => (
            <TopicRow key={t.id} topic={t} index={ti} open={!!openMap[t.id]} editing={editing}
              onToggle={() => setOpenMap((m) => ({ ...m, [t.id]: !m[t.id] }))}
              onMove={(d) => swap('topics', topics, ti, d)} swap={swap} />
          ))}
        </ul>

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addTopic(); }}>
          <input className="input" value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)} placeholder="Add a topic, e.g. Entity Framework Core" aria-label="New topic" />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
        <button className="btn btn-sm btn-quiet self-start !pl-1" onClick={() => setPasteOpen((o) => !o)}>{pasteOpen ? 'Hide outline paste' : 'Paste a whole outline'}</button>
        {pasteOpen && (
          <div className="flex flex-col gap-2">
            <textarea className="input !min-h-[140px] !text-[15px]" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Outline"
              placeholder={'C# Fundamentals\n- Variables and Data Types\n- Methods\nASP.NET Core\n- Routing'} />
            <div className="flex flex-wrap items-center gap-2.5"><button className="btn btn-soft" onClick={() => addOutline(parseOutline(paste))}>Add outline</button><span className="text-[13px] text-mute">Lines starting with “-” become subtopics of the line above.</span></div>
          </div>
        )}
      </Card>

      <div className="flex justify-end"><ConfirmButton confirmText="Tap again — deletes all its topics" onConfirm={() => { remove('skills', skill.id, `Deleted ${skill.name}`); onDeleted(); }}>Delete skill</ConfirmButton></div>
    </>
  );
}

function TopicRow({ topic, index, open, editing, onToggle, onMove, swap }: {
  topic: Topic; index: number; open: boolean; editing: boolean; onToggle: () => void; onMove: (d: -1 | 1) => void;
  swap: (table: 'subtopics', list: Subtopic[], i: number, d: -1 | 1) => void;
}) {
  const { db, create, update, remove } = useData();
  const subs = db.subtopics.filter((s) => s.topicId === topic.id).sort(byOrder);
  const p = topicProgress(topic, db.subtopics);
  const [draft, setDraft] = useState('');
  const addSub = () => {
    const name = draft.trim();
    if (!name) return;
    create('subtopics', { id: uid(), topicId: topic.id, skillId: topic.skillId, name, done: false, order: (subs.at(-1)?.order ?? -1) + 1 });
    setDraft('');
  };
  void index;
  return (
    <li className="border-b border-line-soft py-1 last:border-b-0">
      <div className="flex min-h-[52px] items-center gap-1.5">
        {subs.length === 0 && <input type="checkbox" className="checkbox mx-1.5" aria-label={`${topic.name} completed`} checked={topic.done} onChange={() => update('topics', topic.id, { done: !topic.done })} />}
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-1 text-left">
          <Icon name="right" size={18} className={`text-mute transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="wrap-any font-semibold">{topic.name}</span>
            <span className="flex items-center gap-2"><Bar thin pct={p.pct} className="max-w-40 flex-1" color={p.state === 'done' ? 'var(--color-mint)' : undefined} /><span className="num text-[13px] text-mute">{p.count ? `${p.done}/${p.total}` : topic.done ? 'done' : 'no subtopics'}</span></span>
          </span>
        </button>
        <Pill tone={LEARN_TONE[p.state]}>{LEARN_LABEL[p.state]}</Pill>
      </div>
      {open && (
        <div className="flex flex-col gap-0.5 pb-3 pl-[30px]">
          {subs.map((s, si) => editing ? (
            <div key={s.id} className="flex min-h-[46px] items-center gap-1">
              <input className="input !min-h-10" aria-label="Subtopic name" value={s.name} onChange={(e) => update('subtopics', s.id, { name: e.target.value }, { debounce: true })} />
              <IconButton icon="up" label="Move up" onClick={() => swap('subtopics', subs, si, -1)} />
              <IconButton icon="down" label="Move down" onClick={() => swap('subtopics', subs, si, 1)} />
              <IconButton icon="x" label="Remove subtopic" onClick={() => remove('subtopics', s.id)} />
            </div>
          ) : (
            <label key={s.id} className="flex min-h-[46px] cursor-pointer items-center gap-3 py-1">
              <input type="checkbox" className="checkbox" checked={s.done} onChange={() => update('subtopics', s.id, { done: !s.done })} />
              <span className={`wrap-any ${s.done ? 'text-mute line-through' : ''}`}>{s.name}</span>
            </label>
          ))}
          <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); addSub(); }}>
            <input className="input !min-h-10" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a subtopic" aria-label={`New subtopic for ${topic.name}`} />
            <button className="btn btn-sm btn-soft !min-h-10" type="submit">Add</button>
          </form>
          {editing && (
            <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-dashed border-line pt-2">
              <input className="input !min-h-10 min-w-40 flex-1" aria-label="Topic name" value={topic.name} onChange={(e) => update('topics', topic.id, { name: e.target.value }, { debounce: true })} />
              <div className="flex items-center">
                <IconButton icon="up" label="Move topic up" onClick={() => onMove(-1)} />
                <IconButton icon="down" label="Move topic down" onClick={() => onMove(1)} />
                <ConfirmButton confirmText="Tap again" onConfirm={() => remove('topics', topic.id, 'Topic deleted')}>Delete topic</ConfirmButton>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Counters() {
  const { db, create, update } = useData();
  const counters = db.counters;
  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="h2">Practice</h2>
      {counters.length === 0 ? (
        <div className="empty flex flex-col items-center gap-3">Track problem solving, GitHub activity and portfolio projects.
          <button className="btn btn-sm btn-soft" onClick={() => create('counters', [['Problems solved', 150], ['GitHub contributions', 300], ['Portfolio projects', 5]].map(([label, target]) => ({ id: uid(), label: String(label), value: 0, target: Number(target) })))}>Add practice counters</button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          {counters.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              <div className="lbl">{c.label}</div>
              <div className="flex items-center gap-2">
                <input className="input num" inputMode="numeric" type="number" min={0} aria-label={`${c.label} done`} value={c.value} onChange={(e) => update('counters', c.id, { value: Math.max(0, Number(e.target.value) || 0) }, { debounce: true })} />
                <span className="text-[14px] text-mute">of</span>
                <input className="input num" inputMode="numeric" type="number" min={1} aria-label={`${c.label} target`} value={c.target} onChange={(e) => update('counters', c.id, { target: Math.max(1, Number(e.target.value) || 1) }, { debounce: true })} />
              </div>
              <Bar thin pct={(c.value / Math.max(1, c.target)) * 100} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

