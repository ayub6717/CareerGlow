import { useState } from 'react';
import { useData } from '../../storage/DataContext';
import type { CatKind, Category } from '../../types';
import { uid } from '../../lib/format';
import { Card, ConfirmButton, Empty, Field, Icon, PageHeader } from '../../components/ui';
import { catResolver, MONEY_COLORS } from './money';
import { Bubble, IconColorPicker, KindTabs, Sheet } from './parts';
import { useEnsureCategories } from './useMoney';

/** Grid of every category of one kind, with search and "new category" — opened from "More" when adding a transaction. */
export function CategoryPicker({ kind, selected, onPick, onClose }: { kind: CatKind; selected: string; onPick: (id: string) => void; onClose: () => void }) {
  const { db } = useData();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const list = db.categories.filter((c) => c.kind === kind && c.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.order - b.order);
  return (
    <Sheet title={kind === 'out' ? 'Expense category' : 'Income category'} onClose={onClose} wide>
      <label className="relative block">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input !pl-10" placeholder="Search categories" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <CatGrid list={list} selected={selected} onPick={onPick} onNew={() => setEditing('new')} />
      {editing && <CategoryEditor kind={kind} cat={editing === 'new' ? undefined : editing} initialName={editing === 'new' ? q.trim() : undefined} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); onPick(id); }} />}
    </Sheet>
  );
}

function CatGrid({ list, selected, onPick, onNew }: { list: Category[]; selected?: string; onPick: (id: string) => void; onNew?: () => void }) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
      {list.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c.id)} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1.5 hover:bg-line-soft">
          <Bubble icon={c.icon} color={c.color} size={52} className={selected === c.id ? 'ring-[3px] ring-offset-2 ring-offset-card ring-focus' : ''} />
          <span className="w-full truncate px-0.5 text-center text-[13px] text-mute">{c.name}</span>
        </button>
      ))}
      {onNew && (
        <button type="button" onClick={onNew} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1.5 hover:bg-line-soft">
          <span className="grid size-[52px] place-items-center rounded-full border-2 border-dashed border-line text-mute"><Icon name="plus" size={24} /></span>
          <span className="text-[13px] text-mute">New</span>
        </button>
      )}
    </div>
  );
}

/** Create or edit one category: name, icon and colour. */
export function CategoryEditor({ kind, cat, initialName, onClose, onSaved }: { kind: CatKind; cat?: Category; initialName?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const { db, create, update, remove } = useData();
  const [name, setName] = useState(cat?.name ?? initialName ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? 'tag');
  const [color, setColor] = useState(cat?.color ?? MONEY_COLORS[db.categories.length % MONEY_COLORS.length]);
  const [err, setErr] = useState('');
  const k = cat?.kind ?? kind;
  const resolve = catResolver(db);
  const used = cat ? db.txns.filter((t) => t.kind === k && resolve(t).id === cat.id).length : 0;

  const save = () => {
    const n = name.trim();
    if (!n) return setErr('Give the category a name.');
    if (db.categories.some((c) => c.kind === k && c.id !== cat?.id && c.name.trim().toLowerCase() === n.toLowerCase())) return setErr('A category with this name already exists.');
    if (cat) {
      update('categories', cat.id, { name: n, icon, color }, { toast: 'Category saved' });
      if (n !== cat.name) db.txns.filter((t) => t.categoryId === cat.id).forEach((t) => update('txns', t.id, { category: n })); // keep the readable name in the sheet in step
      onSaved?.(cat.id);
    } else {
      const id = uid();
      create('categories', { id, name: n, kind: k, icon, color, order: Math.max(-1, ...db.categories.filter((c) => c.kind === k).map((c) => c.order)) + 1 }, 'Category added');
      onSaved?.(id);
    }
    onClose();
  };

  return (
    <Sheet title={cat ? 'Edit category' : k === 'out' ? 'New expense category' : 'New income category'} onClose={onClose} wide>
      <div className="flex items-center gap-3">
        <Bubble icon={icon} color={color} size={56} />
        <Field label="Category name" className="flex-1"><input className="input" autoFocus={!cat} value={name} placeholder="e.g. Bike, Bazaar, Pizza" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
      </div>
      <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
      {err && <p className="text-[14px] text-rose-ink" role="alert">{err}</p>}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-line-soft bg-card px-4 pt-3">
        <button type="button" className="btn btn-primary flex-1" onClick={save}>{cat ? 'Save' : 'Add category'}</button>
        {cat && <ConfirmButton confirmText={used ? `Delete? ${used} entries keep the name` : 'Tap again to delete'} onConfirm={() => { remove('categories', cat.id, 'Category deleted'); onClose(); }}>Delete</ConfirmButton>}
      </div>
    </Sheet>
  );
}

/** Manage categories: see all, search, add, edit icon/colour/name. */
export default function Categories() {
  useEnsureCategories();
  const { db } = useData();
  const [kind, setKind] = useState<CatKind>('out');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const list = db.categories.filter((c) => c.kind === kind && c.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.order - b.order);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Money" title="Categories" actions={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ New category</button>} />
      <KindTabs value={kind} onChange={setKind} options={[{ value: 'out', label: 'Expenses' }, { value: 'in', label: 'Income' }]} />
      <Card className="flex flex-col gap-4">
        <label className="relative block">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input !pl-10" placeholder="Search categories" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {list.length || !q ? <CatGrid list={list} onPick={(id) => setEditing(db.categories.find((c) => c.id === id) ?? null)} onNew={() => setEditing('new')} /> : <Empty>No category called “{q}”.</Empty>}
        <p className="text-[13px] text-mute">Tap a category to change its name, icon or colour.</p>
      </Card>
      {editing && <CategoryEditor kind={kind} cat={editing === 'new' ? undefined : editing} initialName={editing === 'new' ? q.trim() : undefined} onClose={() => setEditing(null)} />}
    </div>
  );
}
