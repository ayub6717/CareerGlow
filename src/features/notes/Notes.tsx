import { useEffect, useRef, useState } from 'react';
import { useData } from '../../storage/DataContext';
import { go } from '../../router';
import type { Notebook, NotePage, NoteSection } from '../../types';
import { nowIso, plural, uid } from '../../lib/format';
import { Card, ConfirmButton, Empty, Field, Icon } from '../../components/ui';
import { Sheet } from '../money/parts';
import { NoteEditor, PAGE_LIMIT, plainText } from './editor';

export const NOTE_COLORS = ['#7C97DD', '#6DBE9A', '#E3A867', '#D98BB5', '#64B5C4', '#A08ADB', '#E58E9E', '#E5676B', '#E8B14A', '#9AA5B4'];
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
const open = (...ids: (string | undefined)[]) => go('notes', ids.filter(Boolean).join('~'));
const pageDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};
const shortDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

function useIsDesktop() {
  const q = '(min-width: 768px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);
  return m;
}

/** Clear collapse («) / expand (») button for a side panel. */
function FoldBtn({ open: isOpen, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-card text-mute shadow-[var(--shadow-card)] hover:border-pri-line hover:bg-pri-soft hover:text-pri-ink">
      <Icon name={isOpen ? 'chevronsLeft' : 'chevronsRight'} size={18} />
    </button>
  );
}

/** Which side panels are folded away (desktop). Remembered in this browser. */
function useFold(): [{ secs: boolean; pages: boolean }, (v: { secs: boolean; pages: boolean }) => void] {
  const KEY = 'blueprint.notes.fold';
  const [v, setV] = useState(() => { try { return { secs: false, pages: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { secs: false, pages: false }; } });
  const set = (n: { secs: boolean; pages: boolean }) => { setV(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ } };
  return [v, set];
}

type Manage = { kind: 'notebook'; item: Notebook } | { kind: 'section'; item: NoteSection } | { kind: 'page'; item: NotePage };

/**
 * OneNote-style notes: Notebooks → Sections → Pages.
 * Desktop shows the three panes side by side; phones drill down one level at a time.
 * The route param is "notebookId~sectionId~pageId" (any leading part).
 */
export default function Notes({ param }: { param: string }) {
  const { db, create } = useData();
  const desktop = useIsDesktop();
  const [manage, setManage] = useState<Manage | null>(null);
  const [q, setQ] = useState('');
  const [pickNb, setPickNb] = useState(false);
  const [fold, setFold] = useFold();
  const [nbP, secP, pageP] = param.split('~');

  const notebooks = db.notebooks.slice().sort(byOrder);
  const sectionsOf = (nbId: string) => db.noteSections.filter((s) => s.notebookId === nbId).sort(byOrder);
  const pagesOf = (secId: string) => db.notePages.filter((p) => p.sectionId === secId).sort(byOrder);

  const nb = notebooks.find((n) => n.id === nbP) ?? (desktop ? notebooks[0] : undefined);
  const sections = nb ? sectionsOf(nb.id) : [];
  const sec = sections.find((s) => s.id === secP) ?? (desktop ? sections[0] : undefined);
  const pages = sec ? pagesOf(sec.id) : [];
  const page = pages.find((p) => p.id === pageP) ?? (desktop ? pages[0] : undefined);

  const newPage = (s: NoteSection, opts: { open?: boolean } = {}) => {
    const now = nowIso();
    const p: NotePage = { id: uid(), sectionId: s.id, notebookId: s.notebookId, title: '', body: '', level: 0, order: Math.max(-1, ...pagesOf(s.id).map((x) => x.order)) + 1, createdAt: now, updatedAt: now };
    create('notePages', p);
    if (opts.open !== false) open(s.notebookId, s.id, p.id);
    return p;
  };
  const newSection = (n: Notebook) => {
    const list = sectionsOf(n.id);
    const s: NoteSection = { id: uid(), notebookId: n.id, name: `New Section ${list.length + 1}`, color: NOTE_COLORS[(list.length + 1) % NOTE_COLORS.length], order: Math.max(-1, ...list.map((x) => x.order)) + 1 };
    create('noteSections', s, 'Section added');
    newPage(s);
    setManage({ kind: 'section', item: s }); // rename right away, like OneNote
  };
  const newNotebook = () => {
    const n: Notebook = { id: uid(), name: `My Notebook ${notebooks.length + 1}`, color: NOTE_COLORS[notebooks.length % NOTE_COLORS.length], order: Math.max(-1, ...notebooks.map((x) => x.order)) + 1, createdAt: nowIso() };
    create('notebooks', n, 'Notebook created');
    const s: NoteSection = { id: uid(), notebookId: n.id, name: 'Quick Notes', color: NOTE_COLORS[(notebooks.length + 3) % NOTE_COLORS.length], order: 0 };
    create('noteSections', s);
    newPage(s);
    setManage({ kind: 'notebook', item: n });
  };

  // ---------- Search across every page ----------
  const needle = q.trim().toLowerCase();
  const hits = needle ? db.notePages.map((p) => ({ p, text: plainText(p.body) })).filter(({ p, text }) => (p.title + ' ' + text).toLowerCase().includes(needle)).slice(0, 40) : [];
  const where = (p: NotePage) => `${db.notebooks.find((n) => n.id === p.notebookId)?.name ?? ''} › ${db.noteSections.find((s) => s.id === p.sectionId)?.name ?? ''}`;
  const snippet = (text: string) => { const i = text.toLowerCase().indexOf(needle); return i < 0 ? text.slice(0, 90) : (i > 30 ? '…' : '') + text.slice(Math.max(0, i - 30), i + 70); };
  const searchBox = (
    <label className="relative block">
      <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input className="input !min-h-10 !pl-10" placeholder="Search all notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search all notes" />
    </label>
  );
  const results = needle && (
    <div className="flex flex-col gap-0.5">
      <div className="px-1 text-[13px] text-mute">{hits.length ? `${hits.length} page${hits.length === 1 ? '' : 's'} found` : 'No pages match.'}</div>
      {hits.map(({ p, text }) => (
        <button key={p.id} type="button" onClick={() => { setQ(''); open(p.notebookId, p.sectionId, p.id); }} className="rounded-xl px-2.5 py-2 text-left hover:bg-line-soft">
          <div className="wrap-any font-medium">{p.title || 'Untitled page'}</div>
          <div className="text-[12px] text-faint">{where(p)}</div>
          {text && <div className="line-clamp-2 text-[13px] text-mute">{snippet(text)}</div>}
        </button>
      ))}
    </div>
  );

  // ---------- Panels ----------
  const NotebookRow = ({ n }: { n: Notebook }) => (
    <div className={`flex items-center gap-1 rounded-xl ${nb?.id === n.id && desktop ? 'bg-pri-soft' : 'hover:bg-line-soft'}`}>
      <button type="button" onClick={() => { setPickNb(false); open(n.id); }} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2.5 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: n.color }}><Icon name="book" size={20} /></span>
        <span className="min-w-0"><span className="block wrap-any font-medium">{n.name}</span><span className="block text-[13px] text-mute">{plural(sectionsOf(n.id).length, 'section')} · {plural(db.notePages.filter((p) => p.notebookId === n.id).length, 'page')}</span></span>
      </button>
      <button type="button" className="icon-btn icon-btn-sm mr-1" aria-label={`Manage ${n.name}`} onClick={() => setManage({ kind: 'notebook', item: n })}><Icon name="dots" size={18} /></button>
    </div>
  );

  const sectionsPanel = nb && (
    <div className="flex min-h-0 flex-col gap-2">
      {desktop ? (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPickNb(true)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-card px-2.5 text-left hover:border-pri-line" aria-haspopup="dialog">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: nb.color }}><Icon name="book" size={17} /></span>
            <span className="min-w-0 flex-1 truncate font-semibold">{nb.name}</span><Icon name="down" size={16} className="text-mute" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn -ml-2.5" aria-label="All notebooks" onClick={() => open()}><Icon name="left" size={22} /></button>
          <h1 className="h1 min-w-0 flex-1 !text-[24px] wrap-any">{nb.name}</h1>
          <button type="button" className="icon-btn" aria-label="Manage notebook" onClick={() => setManage({ kind: 'notebook', item: nb })}><Icon name="dots" size={20} /></button>
        </div>
      )}
      <div className="flex items-center justify-between px-1 pt-1"><span className="lbl">Sections</span><button type="button" className="btn btn-sm btn-quiet !px-2" onClick={() => newSection(nb)}><Icon name="plus" size={16} />Section</button></div>
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {sections.map((s) => (
          <div key={s.id} className={`group flex items-center rounded-xl ${sec?.id === s.id && desktop ? 'bg-pri-soft' : 'hover:bg-line-soft'}`}>
            <button type="button" onClick={() => open(nb.id, s.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-2.5 text-left">
              <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className={`min-w-0 flex-1 truncate ${sec?.id === s.id && desktop ? 'font-semibold text-pri-ink' : 'font-medium'}`}>{s.name}</span>
              <span className="text-[12px] text-faint">{pagesOf(s.id).length}</span>
            </button>
            <button type="button" className="icon-btn icon-btn-sm mr-1 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100" aria-label={`Manage ${s.name}`} onClick={() => setManage({ kind: 'section', item: s })}><Icon name="dots" size={18} /></button>
          </div>
        ))}
        {!sections.length && <Empty>No sections yet.</Empty>}
      </div>
    </div>
  );

  const pagesPanel = nb && sec && (
    <div className="flex min-h-0 flex-col gap-2">
      {!desktop && (
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn -ml-2.5" aria-label="Back to sections" onClick={() => open(nb.id)}><Icon name="left" size={22} /></button>
          <div className="min-w-0 flex-1"><div className="text-[13px] text-mute">{nb.name}</div><h1 className="h1 !text-[24px] wrap-any">{sec.name}</h1></div>
          <button type="button" className="icon-btn" aria-label="Manage section" onClick={() => setManage({ kind: 'section', item: sec })}><Icon name="dots" size={20} /></button>
        </div>
      )}
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-soft min-w-0 flex-1" onClick={() => newPage(sec)}><Icon name="plus" size={18} />Add page</button>
      </div>
      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {pages.map((p) => {
          const on = page?.id === p.id && desktop;
          const text = plainText(p.body);
          return (
            <div key={p.id} className={`group flex items-start rounded-xl ${p.level ? 'ml-5' : ''} ${on ? 'bg-pri-soft' : 'hover:bg-line-soft'}`}>
              <button type="button" onClick={() => open(nb.id, sec.id, p.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                <span className={`block truncate ${on ? 'font-semibold text-pri-ink' : 'font-medium'} ${p.title ? '' : 'text-faint'}`}>{p.title || 'Untitled page'}</span>
                <span className="block truncate text-[13px] text-mute">{shortDate(p.createdAt)}{text ? ` · ${text.slice(0, 60)}` : ''}</span>
              </button>
              <button type="button" className="icon-btn icon-btn-sm mr-1 mt-1 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100" aria-label="Manage page" onClick={() => setManage({ kind: 'page', item: p })}><Icon name="dots" size={18} /></button>
            </div>
          );
        })}
        {!pages.length && <Empty>No pages in this section.</Empty>}
      </div>
    </div>
  );

  const pagePanel = nb && sec && page ? (
    <PageView key={page.id} page={page} onBack={desktop ? undefined : () => open(nb.id, sec.id)} crumb={`${nb.name} › ${sec.name}`} onManage={() => setManage({ kind: 'page', item: page })}
      focus={desktop ? { on: fold.secs && fold.pages, toggle: () => setFold(fold.secs && fold.pages ? { secs: false, pages: false } : { secs: true, pages: true }) } : undefined} />
  ) : desktop && nb && sec ? <div className="grid h-full place-items-center"><Empty>Pick a page, or add one.</Empty></div> : null;

  const firstRun = !notebooks.length && (
    <Card className="flex flex-col items-center gap-3 !py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-pri-soft text-pri-ink"><Icon name="book" size={28} /></span>
      <h2 className="h2">Your digital notebook</h2>
      <p className="max-w-[420px] text-[15px] text-mute">Like OneNote: make <b>notebooks</b>, split them into colour-coded <b>sections</b>, and write anything on <b>pages</b> — headings, lists, to-do checklists, highlights and links.</p>
      <button type="button" className="btn btn-primary" onClick={newNotebook}>+ Create a notebook</button>
    </Card>
  );

  let body;
  if (firstRun) body = firstRun;
  else if (desktop) {
    body = (
      <div className="grid h-[calc(100dvh-150px)] min-h-[520px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)] transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: `${fold.secs ? '52px' : '240px'} ${fold.pages ? '52px' : '260px'} minmax(0,1fr)` }}>
        {fold.secs ? (
          <div className="flex min-h-0 flex-col items-center gap-2 overflow-y-auto border-r border-line-soft bg-bg/60 py-3">
            <FoldBtn open={false} label="Expand sections" onClick={() => setFold({ ...fold, secs: false })} />
            {nb && <button type="button" onClick={() => setPickNb(true)} title={nb.name} aria-label={`Notebook: ${nb.name}`} className="grid size-8 place-items-center rounded-lg text-white" style={{ background: nb.color }}><Icon name="book" size={16} /></button>}
            <span className="h-px w-6 bg-line" />
            {sections.map((s) => (
              <button key={s.id} type="button" title={s.name} aria-label={s.name} onClick={() => open(nb!.id, s.id)}
                className={`grid size-8 place-items-center rounded-lg text-[13px] font-semibold text-white ${sec?.id === s.id ? 'ring-[3px] ring-focus ring-offset-1 ring-offset-card' : 'opacity-80 hover:opacity-100'}`} style={{ background: s.color }}>{s.name.trim().charAt(0).toUpperCase() || '•'}</button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3 border-r border-line-soft bg-bg/60 p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">Notebook &amp; sections</span><FoldBtn open label="Collapse sections" onClick={() => setFold({ ...fold, secs: true })} /></div>
            {searchBox}
            {needle ? <div className="min-h-0 overflow-y-auto">{results}</div> : sectionsPanel}
          </div>
        )}
        {fold.pages ? (
          <div className="flex min-h-0 flex-col items-center gap-2 border-r border-line-soft py-3">
            <FoldBtn open={false} label="Expand pages" onClick={() => setFold({ ...fold, pages: false })} />
            {sec && <button type="button" className="icon-btn icon-btn-sm bg-pri-soft text-pri-ink" aria-label="Add page" title="Add page" onClick={() => newPage(sec)}><Icon name="plus" size={18} /></button>}
            {sec && <span className="mt-1 text-[12px] text-faint [writing-mode:vertical-rl]">{pages.length} {pages.length === 1 ? 'page' : 'pages'} · {sec.name}</span>}
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3 border-r border-line-soft p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">Pages</span><FoldBtn open label="Collapse pages" onClick={() => setFold({ ...fold, pages: true })} /></div>
            {sec ? pagesPanel : <Empty>Add a section to start.</Empty>}
          </div>
        )}
        <div className={`min-h-0 overflow-y-auto py-5 ${fold.secs && fold.pages ? 'px-12' : 'px-8'}`}>{pagePanel}</div>
      </div>
    );
  } else if (page) body = pagePanel;
  else if (sec) body = pagesPanel;
  else if (nb) body = sectionsPanel;
  else {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2"><div><div className="mb-1 text-[13px] font-medium text-mute">Notes</div><h1 className="h1">Notebooks</h1></div><button className="btn btn-primary" onClick={newNotebook}>+ Notebook</button></div>
        {searchBox}
        {needle ? <Card className="!p-2">{results}</Card> : <Card className="!p-2 flex flex-col gap-0.5">{notebooks.map((n) => <NotebookRow key={n.id} n={n} />)}</Card>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {desktop && notebooks.length > 0 && (
        <div className="flex items-end justify-between gap-3"><div><div className="mb-1 text-[13px] font-medium text-mute">Notes</div><h1 className="h1">Notebooks</h1></div><button className="btn btn-ghost" onClick={newNotebook}>+ New notebook</button></div>
      )}
      {body}
      {pickNb && (
        <Sheet title="Notebooks" onClose={() => setPickNb(false)}>
          <div className="flex flex-col gap-0.5">{notebooks.map((n) => <NotebookRow key={n.id} n={n} />)}</div>
          <button type="button" className="btn btn-soft" onClick={() => { setPickNb(false); newNotebook(); }}>+ New notebook</button>
        </Sheet>
      )}
      {manage && <ManageSheet m={manage} onClose={() => setManage(null)} current={{ nb: nb?.id, sec: sec?.id, page: page?.id }} />}
    </div>
  );
}

/** Title, date and the rich-text body of one page. Saves as you type. */
function PageView({ page, onBack, crumb, onManage, focus }: { page: NotePage; onBack?: () => void; crumb: string; onManage: () => void; focus?: { on: boolean; toggle: () => void } }) {
  const { update, notify } = useData();
  const [title, setTitle] = useState(page.title);
  const warned = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const saveBody = (html: string) => {
    if (html.length > PAGE_LIMIT) { if (!warned.current) { notify('Page too long to save — move some text to a new page.', 'error'); warned.current = true; } return; }
    warned.current = false;
    update('notePages', page.id, { body: html, updatedAt: nowIso() }, { debounce: true });
  };
  return (
    <div className="flex min-h-full flex-col gap-1">
      <div className="flex items-center gap-1">
        {onBack && <button type="button" className="icon-btn -ml-2.5" aria-label="Back to pages" onClick={onBack}><Icon name="left" size={22} /></button>}
        <span className="min-w-0 flex-1 truncate text-[13px] text-mute">{crumb}</span>
        {focus && <button type="button" className="btn btn-sm btn-quiet" onClick={focus.toggle} title={focus.on ? 'Show sections and pages' : 'Hide both side panels for more writing space'}><Icon name={focus.on ? 'collapse' : 'expand'} size={16} />{focus.on ? 'Show panels' : 'Focus'}</button>}
        <button type="button" className="icon-btn icon-btn-sm" aria-label="Manage page" onClick={onManage}><Icon name="dots" size={18} /></button>
      </div>
      <input className="w-full border-0 border-b border-line-soft bg-transparent pb-1.5 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] outline-none placeholder:text-faint focus:border-pri max-md:text-[24px]"
        aria-label="Page title" placeholder="Page title" value={title} autoFocus={!page.title && !page.body}
        onChange={(e) => { setTitle(e.target.value); update('notePages', page.id, { title: e.target.value, updatedAt: nowIso() }, { debounce: true }); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.querySelector<HTMLElement>('[contenteditable]')?.focus(); } }} />
      <div className="mb-1 text-[13px] text-faint">{pageDate(page.createdAt)}</div>
      <div ref={bodyRef} className="flex flex-1 flex-col"><NoteEditor initial={page.body} onChange={saveBody} /></div>
    </div>
  );
}

/** Rename, recolour, reorder, move or delete a notebook / section / page. */
function ManageSheet({ m, onClose, current }: { m: Manage; onClose: () => void; current: { nb?: string; sec?: string; page?: string } }) {
  const { db, update, remove } = useData();
  const item = m.kind === 'notebook' ? db.notebooks.find((x) => x.id === m.item.id) : m.kind === 'section' ? db.noteSections.find((x) => x.id === m.item.id) : db.notePages.find((x) => x.id === m.item.id);
  const [name, setName] = useState(m.kind === 'page' ? (m.item as NotePage).title : (m.item as Notebook).name);
  if (!item) return null;
  const table = m.kind === 'notebook' ? 'notebooks' : m.kind === 'section' ? 'noteSections' : 'notePages';
  const siblings: { id: string; order: number }[] = m.kind === 'notebook' ? db.notebooks.slice().sort(byOrder)
    : m.kind === 'section' ? db.noteSections.filter((s) => s.notebookId === (item as NoteSection).notebookId).sort(byOrder)
      : db.notePages.filter((p) => p.sectionId === (item as NotePage).sectionId).sort(byOrder);
  const i = siblings.findIndex((s) => s.id === item.id);
  const move = (dir: number) => {
    const other = siblings[i + dir];
    if (!other) return;
    update(table, item.id, { order: other.order });
    update(table, other.id, { order: item.order === other.order ? item.order + dir : item.order });
  };
  const rename = (v: string) => { setName(v); update(table, item.id, m.kind === 'page' ? { title: v } : { name: v }, { debounce: true }); };
  const color = 'color' in item ? item.color : '';
  const counts = m.kind === 'notebook' ? `${db.noteSections.filter((s) => s.notebookId === item.id).length} sections and ${db.notePages.filter((p) => p.notebookId === item.id).length} pages`
    : m.kind === 'section' ? `${db.notePages.filter((p) => p.sectionId === item.id).length} pages` : '';
  const del = () => {
    remove(table, item.id, `${m.kind[0].toUpperCase()}${m.kind.slice(1)} deleted`);
    onClose();
    if (m.kind === 'notebook' && current.nb === item.id) open();
    if (m.kind === 'section' && current.sec === item.id) open((item as NoteSection).notebookId);
    if (m.kind === 'page' && current.page === item.id) open((item as NotePage).notebookId, (item as NotePage).sectionId);
  };
  const p = m.kind === 'page' ? (item as NotePage) : null;

  return (
    <Sheet title={m.kind === 'notebook' ? 'Notebook' : m.kind === 'section' ? 'Section' : 'Page'} onClose={onClose}>
      <Field label={m.kind === 'page' ? 'Page title' : 'Name'}>
        <input className="input" autoFocus value={name} placeholder={m.kind === 'page' ? 'Untitled page' : 'Name'} onChange={(e) => rename(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && onClose()} />
      </Field>
      {m.kind !== 'page' && (
        <div className="flex flex-col gap-2"><span className="lbl">Colour</span>
          <div className="flex flex-wrap gap-2.5">{NOTE_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={c === color} onClick={() => update(table, item.id, { color: c })}
              className={`size-9 rounded-full ${c === color ? 'ring-[3px] ring-offset-2 ring-offset-card ring-focus' : ''}`} style={{ background: c }} />
          ))}</div>
        </div>
      )}
      {p && (
        <>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-bg px-3.5 py-2.5">
            <input type="checkbox" className="checkbox" checked={p.level > 0} onChange={(e) => update('notePages', p.id, { level: e.target.checked ? 1 : 0 })} />
            <span><span className="block font-medium">Subpage</span><span className="block text-[13px] text-mute">Indent it under the page above.</span></span>
          </label>
          <Field label="Move to section">
            <select className="input" value={p.sectionId} onChange={(e) => {
              const s = db.noteSections.find((x) => x.id === e.target.value);
              if (!s) return;
              const order = Math.max(-1, ...db.notePages.filter((x) => x.sectionId === s.id).map((x) => x.order)) + 1;
              update('notePages', p.id, { sectionId: s.id, notebookId: s.notebookId, order, level: 0 }, { toast: `Moved to ${s.name}` });
              onClose();
              open(s.notebookId, s.id, p.id);
            }}>
              {db.notebooks.slice().sort(byOrder).map((n) => (
                <optgroup key={n.id} label={n.name}>{db.noteSections.filter((s) => s.notebookId === n.id).sort(byOrder).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
              ))}
            </select>
          </Field>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm btn-ghost" disabled={i <= 0} onClick={() => move(-1)}><Icon name="up" size={16} />Move up</button>
        <button type="button" className="btn btn-sm btn-ghost" disabled={i >= siblings.length - 1} onClick={() => move(1)}><Icon name="down" size={16} />Move down</button>
        <ConfirmButton className="ml-auto" confirmText={counts ? `Delete with ${counts}?` : 'Tap again to delete'} onConfirm={del}>Delete {m.kind}</ConfirmButton>
      </div>
      <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
    </Sheet>
  );
}
