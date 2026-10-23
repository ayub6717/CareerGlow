import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import type { ContentStage } from '../../types';
import { niceDate, uid } from '../../lib/format';
import { Card, Chips, Empty, IconButton, PageHeader, Pill, Stat, Stats } from '../../components/ui';

const STAGES: ContentStage[] = ['Idea', 'Research', 'Script', 'Production', 'Published'];
const PLATFORMS = ['YouTube', 'LinkedIn', 'Facebook', 'Blog', 'X', 'Other'];

export default function Content() {
  const { db, create, update, remove } = useData();
  const [tab, setTab] = useState<ContentStage>('Idea');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('YouTube');
  const items = db.content;
  const pub = items.filter((c) => c.stage === 'Published');
  const best = pub.slice().sort((a, b) => b.views - a.views)[0];

  const add = () => {
    if (!title.trim()) return;
    create('content', { id: uid(), title: title.trim(), platform, stage: 'Idea', date: '', views: 0 }, 'Added to ideas');
    setTitle(''); setTab('Idea');
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Personal brand" title="Content" />
      <Stats>
        <Stat label="Published" value={<span className="num">{pub.length}</span>} />
        <Stat label="In progress" value={<span className="num">{items.filter((c) => c.stage !== 'Published' && c.stage !== 'Idea').length}</span>} />
        <Stat label="Total reach" value={<span className="num">{pub.reduce((a, c) => a + (c.views || 0), 0).toLocaleString('en-IN')}</span>} />
        <Stat label="Best piece" value={<span className="text-[15px] font-semibold">{best && best.views > 0 ? best.title : '—'}</span>} />
      </Stats>

      <Card className="flex flex-col gap-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post, video or article title" aria-label="New content" /><button className="btn btn-primary" type="submit">Add</button></form>
        <Chips label="Platform" value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ value: p, label: p }))} />
      </Card>

      <Chips label="Stage" value={tab} onChange={setTab} options={STAGES.map((s) => ({ value: s, label: <>{s} · {items.filter((c) => c.stage === s).length}</> }))} />
      <Card className="!py-1">
        {items.filter((c) => c.stage === tab).length === 0 ? <Empty>Nothing in this stage.</Empty> : (
          <ul>{items.filter((c) => c.stage === tab).map((c) => {
            const k = STAGES.indexOf(c.stage);
            return (
              <li key={c.id} className="flex flex-col gap-2 border-b border-line-soft py-3.5 last:border-b-0">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="wrap-any font-medium">{c.title}</div><div className="text-[13px] text-mute">{c.platform}</div></div><Pill tone="lav">{c.stage}</Pill></div>
                <div className="flex items-center gap-2">
                  <input className="input !min-h-10 max-w-[170px]" type="date" aria-label="Publish date" value={c.date} onChange={(e) => update('content', c.id, { date: e.target.value })} />
                  {c.stage === 'Published' && <input className="input num !min-h-10 max-w-[120px]" inputMode="numeric" type="number" min={0} aria-label="Views" placeholder="Views" value={c.views} onChange={(e) => update('content', c.id, { views: Math.max(0, Number(e.target.value) || 0) }, { debounce: true })} />}
                  <span className="flex-1" />
                  {k > 0 && <IconButton icon="left" label="Previous stage" onClick={() => update('content', c.id, { stage: STAGES[k - 1] })} />}
                  {k < 4 && <button className="btn btn-sm btn-soft" onClick={() => update('content', c.id, { stage: STAGES[k + 1] })}>→ {STAGES[k + 1]}</button>}
                  <IconButton icon="x" label="Delete" onClick={() => remove('content', c.id, 'Deleted')} />
                </div>
              </li>
            );
          })}</ul>
        )}
      </Card>

      <Card className="flex flex-col gap-1.5">
        <h2 className="h2">Calendar</h2>
        {items.some((c) => c.date) ? <ul>{items.filter((c) => c.date).sort((a, b) => a.date.localeCompare(b.date)).map((c) => (
          <li key={c.id} className="row-item"><span className="num w-16 shrink-0 text-[14px]">{niceDate(c.date)}</span><span className="wrap-any flex-1">{c.title}</span><Pill>{c.stage}</Pill></li>
        ))}</ul> : <Empty>Give a piece a publish date to see it here.</Empty>}
      </Card>
    </div>
  );
}
