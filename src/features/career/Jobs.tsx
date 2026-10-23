import { useMemo, useState } from 'react';
import { useData } from '../../storage/DataContext';
import type { Job, JobStatus } from '../../types';
import type { Tone } from '../../lib/calc';
import { daysSince, niceDate, nowIso, today, uid } from '../../lib/format';
import { Card, ConfirmButton, Empty, Field, Icon, PageHeader, Pill, Stat, Stats } from '../../components/ui';

export const JOB_STATUSES: { value: JobStatus; label: string; tone: Tone }[] = [
  { value: 'toapply', label: 'To Apply', tone: 'gray' },
  { value: 'applied', label: 'Applied', tone: 'blue' },
  { value: 'interviewing', label: 'Interviewing', tone: 'lav' },
  { value: 'assessment', label: 'Assessment', tone: 'teal' },
  { value: 'offer', label: 'Offer Received', tone: 'mint' },
  { value: 'rejected', label: 'Rejected', tone: 'rose' },
  { value: 'noresponse', label: 'No Response', tone: 'amber' },
  { value: 'withdrawn', label: 'Withdrawn', tone: 'gray' },
];
const META = Object.fromEntries(JOB_STATUSES.map((s) => [s.value, s])) as Record<JobStatus, (typeof JOB_STATUSES)[number]>;
const FOLLOW_UP_DAYS = 14;

type Draft = Pick<Job, 'company' | 'title' | 'url' | 'appliedDate' | 'status' | 'notes'>;
const blank = (): Draft => ({ company: '', title: '', url: '', appliedDate: today(), status: 'applied', notes: '' });

function normalizeUrl(u: string): string {
  const s = u.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
function validUrl(u: string): boolean {
  if (!u.trim()) return true;
  try { const x = new URL(normalizeUrl(u)); return !!x.hostname.includes('.'); } catch { return false; }
}

export default function Jobs() {
  const { db, create, update, remove } = useData();
  const [filter, setFilter] = useState<'all' | JobStatus>('all');
  const [asc, setAsc] = useState(false);
  const [form, setForm] = useState<{ id: string | null; d: Draft } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  const jobs = db.jobs;
  const count = (s: JobStatus) => jobs.filter((j) => j.status === s).length;
  const submitted = jobs.filter((j) => j.status !== 'toapply').length;
  const heard = jobs.filter((j) => ['interviewing', 'assessment', 'offer', 'rejected'].includes(j.status)).length;

  const list = useMemo(() => jobs
    .filter((j) => filter === 'all' || j.status === filter)
    .slice()
    .sort((a, b) => {
      if (!a.appliedDate && !b.appliedDate) return b.createdAt.localeCompare(a.createdAt);
      if (!a.appliedDate) return 1;
      if (!b.appliedDate) return -1;
      return asc ? a.appliedDate.localeCompare(b.appliedDate) : b.appliedDate.localeCompare(a.appliedDate);
    }), [jobs, filter, asc]);

  const openNew = () => { setErrors({}); setForm({ id: null, d: blank() }); };
  const openEdit = (j: Job) => { setErrors({}); setForm({ id: j.id, d: { company: j.company, title: j.title, url: j.url, appliedDate: j.appliedDate, status: j.status, notes: j.notes } }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const set = (p: Partial<Draft>) => setForm((f) => (f ? { ...f, d: { ...f.d, ...p } } : f));

  const submit = () => {
    if (!form) return;
    const d = form.d, e: typeof errors = {};
    if (!d.company.trim()) e.company = 'Company name is required.';
    if (!d.title.trim()) e.title = 'Job title is required.';
    if (!validUrl(d.url)) e.url = 'Enter a valid link, e.g. https://company.com/jobs/123';
    if (d.status !== 'toapply' && !d.appliedDate) e.appliedDate = 'Add the date you applied.';
    const dupe = jobs.find((j) => j.id !== form.id && j.company.trim().toLowerCase() === d.company.trim().toLowerCase() && j.title.trim().toLowerCase() === d.title.trim().toLowerCase());
    if (dupe) e.title = 'You already track this role at this company.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const clean = { company: d.company.trim(), title: d.title.trim(), url: normalizeUrl(d.url), appliedDate: d.appliedDate, status: d.status, notes: d.notes.trim() };
    if (form.id) update('jobs', form.id, { ...clean, updatedAt: nowIso() }, { toast: 'Application updated' });
    else create('jobs', { id: uid(), ...clean, createdAt: nowIso(), updatedAt: nowIso() }, 'Application added');
    setForm(null);
  };

  const setStatus = (j: Job, status: JobStatus) => update('jobs', j.id, { status, updatedAt: nowIso(), appliedDate: status !== 'toapply' && !j.appliedDate ? today() : j.appliedDate });

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="Career" title="Job Applications" actions={<button className="btn btn-primary" onClick={form ? () => setForm(null) : openNew}>{form ? 'Close' : '+ Add application'}</button>} />

      <Stats>
        <Stat label="Applied" value={<span className="num">{submitted}</span>} sub={`${count('toapply')} saved to apply`} />
        <Stat label="In process" value={<span className="num">{count('interviewing') + count('assessment')}</span>} sub="interviews & tests" />
        <Stat label="Offers" value={<span className="num text-mint-ink">{count('offer')}</span>} />
        <Stat label="Response rate" value={<span className="num">{submitted ? `${Math.round((heard / submitted) * 100)}%` : '—'}</span>} sub="heard back" />
      </Stats>

      {form && (
        <Card className="flex flex-col gap-3.5">
          <h2 className="h2">{form.id ? 'Edit application' : 'New application'}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Company" hint={errors.company && <span className="text-[13px] text-rose-ink">{errors.company}</span>}>
              <input className="input" value={form.d.company} aria-invalid={!!errors.company} onChange={(e) => set({ company: e.target.value })} placeholder="Company name" autoFocus />
            </Field>
            <Field label="Job title" hint={errors.title && <span className="text-[13px] text-rose-ink">{errors.title}</span>}>
              <input className="input" value={form.d.title} aria-invalid={!!errors.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Senior Frontend Engineer" />
            </Field>
            <Field label="Job posting URL" className="md:col-span-2" hint={errors.url && <span className="text-[13px] text-rose-ink">{errors.url}</span>}>
              <input className="input" type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" value={form.d.url} aria-invalid={!!errors.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
            </Field>
            <Field label="Application date" hint={errors.appliedDate && <span className="text-[13px] text-rose-ink">{errors.appliedDate}</span>}>
              <input className="input" type="date" value={form.d.appliedDate} aria-invalid={!!errors.appliedDate} onChange={(e) => set({ appliedDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className="input" value={form.d.status} onChange={(e) => set({ status: e.target.value as JobStatus })}>
                {JOB_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Notes (optional)" className="md:col-span-2">
              <textarea className="input !min-h-[72px]" value={form.d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Salary range, contact person, interview notes…" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button className="btn btn-primary" onClick={submit}>{form.id ? 'Save changes' : 'Add application'}</button>
            <button className="btn btn-quiet" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </Card>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="seg min-w-0 flex-1" role="group" aria-label="Filter by status">
          <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span className="num opacity-75">{jobs.length}</span></button>
          {JOB_STATUSES.filter((s) => count(s.value) > 0 || filter === s.value).map((s) => (
            <button key={s.value} className="chip" aria-pressed={filter === s.value} onClick={() => setFilter(s.value)}>{s.label} <span className="num opacity-75">{count(s.value)}</span></button>
          ))}
        </div>
        <button className="btn btn-sm btn-quiet shrink-0" onClick={() => setAsc((a) => !a)} aria-label={`Sort by date, currently ${asc ? 'oldest' : 'newest'} first`}><Icon name="sort" size={16} />{asc ? 'Oldest' : 'Newest'}</button>
      </div>

      <Card className="!py-1">
        {list.length === 0 ? <Empty>{jobs.length ? 'No applications with this status.' : 'No applications yet. Add the first one.'}</Empty> : (
          <ul className="flex flex-col">
            {list.map((j) => {
              const ds = daysSince(j.appliedDate);
              const stale = j.status === 'applied' && ds != null && ds >= FOLLOW_UP_DAYS;
              const m = META[j.status] ?? META.applied;
              return (
                <li key={j.id} className="flex flex-col gap-2 border-b border-line-soft py-3.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="wrap-any font-semibold">{j.company}</div><div className="wrap-any text-[15px]">{j.title}</div></div>
                    <Pill tone={m.tone}>{m.label}</Pill>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
                    <span>{j.appliedDate ? `${j.status === 'toapply' ? 'Saved' : 'Applied'} ${niceDate(j.appliedDate, true)}${ds != null && ds >= 0 ? ` · ${ds === 0 ? 'today' : `${ds} day${ds === 1 ? '' : 's'} ago`}` : ''}` : 'No date'}</span>
                    {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-7 items-center gap-1 text-pri-ink hover:underline">Job posting<Icon name="link" size={13} /></a>}
                  </div>
                  {j.notes && <p className="wrap-any whitespace-pre-line text-[14px] text-mute">{j.notes}</p>}
                  {stale && (
                    <div className="soft flex flex-wrap items-center gap-2 bg-amber-soft/70 !py-2 text-[14px]">
                      <span className="min-w-[180px] flex-1">No reply for {ds} days — follow up, or mark it.</span>
                      <button className="btn btn-sm btn-ghost" onClick={() => setStatus(j, 'noresponse')}>Mark No Response</button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <select aria-label={`Status for ${j.company}`} className="input !min-h-10 min-w-0 flex-1 md:max-w-[210px]" value={j.status} onChange={(e) => setStatus(j, e.target.value as JobStatus)}>
                      {JOB_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <span className="hidden flex-1 md:block" />
                    <button className="btn btn-sm btn-ghost shrink-0" onClick={() => openEdit(j)}>Edit</button>
                    <ConfirmButton confirmText="Tap again" onConfirm={() => remove('jobs', j.id, 'Application deleted')}>Delete</ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
