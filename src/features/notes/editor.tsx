import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Safe HTML. Page bodies live in a Google Sheet anyone with edit access could change, and pasted content can carry
// scripts, so everything is passed through this allow-list before it is shown or saved.
// ---------------------------------------------------------------------------
const TAGS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'MARK', 'SPAN', 'CODE', 'PRE', 'HR', 'SUB', 'SUP', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'NOSCRIPT', 'TITLE', 'META', 'LINK', 'HEAD', 'COLGROUP', 'COL', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
const BLOCK_ALIGN = /^(P|DIV|H1|H2|H3|LI|TD|TH|BLOCKQUOTE)$/;
/** <font size="1..7"> → px */
const FONT_PX = [0, 11, 13, 16, 18, 24, 32, 40];
export const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96];

function styleOf(el: HTMLElement, tag: string): string {
  const st = el.style;
  const out: string[] = [];
  const ok = (v: string) => COLOR.test(v.replace(/\s/g, '')) && v !== 'transparent' && v !== 'initial' && v !== 'inherit';
  if (tag === 'SPAN' || tag === 'MARK') {
    if (st?.backgroundColor && ok(st.backgroundColor)) out.push(`background-color:${st.backgroundColor}`);
    if (st?.color && ok(st.color)) out.push(`color:${st.color}`);
    // any size you like (px or pt, e.g. from Word/Excel); only absurd values are dropped
    const fs = st?.fontSize?.match(/^(\d{1,3}(?:\.\d+)?)(px|pt)$/);
    if (fs) { const px = Math.round(+fs[1] * (fs[2] === 'pt' ? 4 / 3 : 1)); if (px >= 1 && px <= 400) out.push(`font-size:${px}px`); }
    if (st?.fontWeight && /^(bold|[6-9]00)$/.test(st.fontWeight)) out.push('font-weight:700');
    if (st?.fontStyle === 'italic') out.push('font-style:italic');
  }
  if (BLOCK_ALIGN.test(tag) && st?.textAlign && /^(left|center|right|justify)$/.test(st.textAlign)) out.push(`text-align:${st.textAlign}`);
  if (/^(TD|TH)$/.test(tag) && st?.backgroundColor && ok(st.backgroundColor) && !/^(rgb\(255, 255, 255\)|#fff(fff)?|white)$/i.test(st.backgroundColor)) out.push(`background-color:${st.backgroundColor}`);
  // "click anywhere to type" places a paragraph at an indent — keep that (px only, sensible range)
  const ml = st?.marginLeft;
  if (ml && /^(P|DIV|H1|H2|H3)$/.test(tag) && /^\d{1,4}px$/.test(ml) && parseInt(ml, 10) <= 1600) out.push(`margin-left:${ml}`);
  return out.join(';');
}

function clean(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  if (DROP.has(el.tagName)) return null;
  const kids = (into: Node) => { el.childNodes.forEach((c) => { const x = clean(c, doc); if (x) into.appendChild(x); }); return into; };
  // <font color size> (from execCommand or pasted Word/Excel) → <span style>
  if (el.tagName === 'FONT') {
    const span = doc.createElement('span');
    const parts: string[] = [];
    const c = el.getAttribute('color'); if (c && COLOR.test(c)) parts.push(`color:${c}`);
    const sz = Number(el.getAttribute('size')); if (sz >= 1 && sz <= 7) parts.push(`font-size:${FONT_PX[sz]}px`);
    const own = styleOf(el, 'SPAN'); if (own) parts.push(own);
    if (parts.length) span.setAttribute('style', parts.join(';'));
    return kids(span);
  }
  if (!TAGS.has(el.tagName)) return kids(doc.createDocumentFragment()); // unknown tag (o:p, google-sheets-html-origin…) → keep its content
  const tag = el.tagName === 'STRIKE' ? 'S' : el.tagName;
  const out = doc.createElement(tag);
  if (tag === 'A') {
    const href = el.getAttribute('href') ?? '';
    if (/^(https?:|mailto:|tel:)/i.test(href.trim())) { out.setAttribute('href', href.trim()); out.setAttribute('target', '_blank'); out.setAttribute('rel', 'noopener noreferrer'); }
  }
  if (tag === 'UL' && el.getAttribute('data-type') === 'check') out.setAttribute('data-type', 'check');
  if (tag === 'SPAN' && el.hasAttribute('data-tick')) { // round tick (task done / not done); not typed into
    out.setAttribute('data-tick', el.getAttribute('data-tick') === 'true' ? 'true' : 'false');
    out.setAttribute('contenteditable', 'false');
    return out;
  }
  if (tag === 'LI' && el.hasAttribute('data-checked')) out.setAttribute('data-checked', el.getAttribute('data-checked') === 'true' ? 'true' : 'false');
  if (tag === 'TABLE' && el.getAttribute('data-wrap') === 'true') out.setAttribute('data-wrap', 'true');
  if (tag === 'TD' || tag === 'TH') {
    for (const a of ['colspan', 'rowspan']) { const v = Number(el.getAttribute(a)); if (v > 1 && v <= 50) out.setAttribute(a, String(v)); }
  }
  const style = styleOf(el, tag);
  if (style) out.setAttribute('style', style);
  kids(out);
  if ((tag === 'TD' || tag === 'TH') && !out.childNodes.length) out.appendChild(doc.createElement('br')); // keep empty cells clickable
  return out;
}

export function sanitize(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = document.implementation.createHTMLDocument('');
  const box = out.createElement('div');
  doc.body.childNodes.forEach((c) => { const x = clean(c, out); if (x) box.appendChild(x); });
  return box.innerHTML;
}
export function plainText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html.replace(/<\/?(br|p|div|li|h\d|ul|ol|blockquote|td|th|tr)\b[^>]*>/gi, ' $&')}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Tab-separated text (what Excel, Sheets and many tables put on the clipboard) → rows of cells. */
function tsv(text: string): string[][] | null {
  const t = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!t.includes('\t')) return null;
  const rows = t.split('\n').map((r) => r.split('\t'));
  return rows.length && rows.some((r) => r.length > 1) ? rows : null;
}

/** Google Sheets allows 50,000 characters in a cell. */
export const PAGE_LIMIT = 49000;

// ---------------------------------------------------------------------------
// Editor: contentEditable + toolbar. Uncontrolled — the DOM is the source of truth while typing.
// ---------------------------------------------------------------------------
const HIGHLIGHTS = ['#fff3a3', '#c8f2d5', '#cfe3ff', '#ffd6e0', '#ffe2c4', '#e8defa'];
/** Cell / row fill colours (soft, like Excel's light fills) */
const FILLS = ['#fff2a8', '#ffe1c2', '#ffd6d6', '#f9d3ea', '#e6dcfa', '#d6e4ff', '#cdeefa', '#d3f2dc', '#e9f5c9', '#eceff3'];
const TICK = '<span data-tick="false" contenteditable="false"></span>&nbsp;';
const TEXT_COLORS = ['#26303d', '#8a94a3', '#d64545', '#e07b24', '#c79a00', '#2e9b62', '#1f8fa8', '#3f63c8', '#7a4fd0', '#c94c8a'];

const B = ({ label, onClick: on, children, active, wide }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; wide?: boolean }) => (
  <button type="button" title={label} aria-label={label} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={on}
    className={`grid h-9 shrink-0 place-items-center rounded-lg px-2 text-[15px] text-ink hover:bg-line-soft ${wide ? '' : 'min-w-9'} ${active ? 'bg-pri-soft text-pri-ink' : ''}`}>{children}</button>
);
const Sep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />;
const Svg = ({ d, children }: { d?: string; children?: ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d && <path d={d} />}{children}</svg>
);

type Pop = null | 'size' | 'color' | 'hl' | 'table' | 'link' | 'fill';
type CellRange = { table: HTMLTableElement; r0: number; c0: number; r1: number; c1: number };
type Box = { top: number; left: number; width: number; height: number };

export function NoteEditor({ initial, onChange, placeholder = 'Start typing…' }: { initial: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [len, setLen] = useState(initial.length);
  const [pop, setPop] = useState<Pop>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [curSize, setCurSize] = useState(16);
  const [customSize, setCustomSize] = useState('');
  const saved = useRef<Range | null>(null);

  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitize(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- set once per page (component is keyed by page id)

  const emit = () => { const h = sanitize(ref.current?.innerHTML ?? ''); setLen(h.length); onChange(h); };
  const keepSel = () => { const s = window.getSelection(); if (s && s.rangeCount && ref.current?.contains(s.anchorNode)) saved.current = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { const s = window.getSelection(); if (saved.current && s) { s.removeAllRanges(); s.addRange(saved.current); } };
  /** Toolbar buttons don't take focus, so the caret is usually still in place; only restore it after e.g. the link box. */
  const refocus = () => { if (document.activeElement !== ref.current) { ref.current?.focus(); restoreSel(); } };
  const cmd = (name: string, value?: string) => { refocus(); document.execCommand(name, false, value); emit(); keepSel(); };
  const toggle = (p: Pop) => { keepSel(); setPop((x) => (x === p ? null : p)); };

  // ---------- Text size & colour ----------
  const sizeAtCaret = () => {
    const n = window.getSelection()?.anchorNode;
    const el = n instanceof Element ? n : n?.parentElement;
    return el && ref.current?.contains(el) ? Math.round(parseFloat(getComputedStyle(el).fontSize)) || 16 : 16;
  };
  const setSize = (px: number) => {
    refocus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7'); // marks the selection with <font size="7">…
    const made: HTMLSpanElement[] = [];
    ref.current?.querySelectorAll('font[size="7"]').forEach((f) => { // …which becomes an exact px size
      const span = document.createElement('span');
      made.push(span);
      span.style.fontSize = `${px}px`;
      const c = f.getAttribute('color'); if (c) span.style.color = c;
      while (f.firstChild) span.appendChild(f.firstChild);
      span.querySelectorAll('span').forEach((inner) => { inner.style.fontSize = ''; }); // inner sizes would win otherwise
      f.replaceWith(span);
    });
    if (made.length) { // keep the same text selected so you can change colour etc. right after
      const r = document.createRange(); r.setStartBefore(made[0].firstChild ?? made[0]); r.setEndAfter(made.at(-1)!.lastChild ?? made.at(-1)!);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
    }
    setCurSize(px); emit(); keepSel();
  };
  const stepSize = (dir: number) => {
    const cur = sizeAtCaret();
    const next = dir > 0 ? SIZES.find((s) => s > cur) ?? cur + 8 : [...SIZES].reverse().find((s) => s < cur) ?? Math.max(1, cur - 1);
    setSize(next);
  };
  const color = (c: string, kind: 'foreColor' | 'hiliteColor') => {
    refocus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(kind, false, c);
    document.execCommand('styleWithCSS', false, 'false');
    emit(); keepSel(); setPop(null);
  };

  const checklist = () => {
    refocus();
    const s = window.getSelection();
    const inCheck = (s?.anchorNode instanceof Node) && (s.anchorNode.parentElement?.closest('ul[data-type="check"]') || (s.anchorNode as Element).closest?.('ul[data-type="check"]'));
    if (inCheck) { document.execCommand('insertUnorderedList'); emit(); return; } // toggle off
    document.execCommand('insertUnorderedList');
    const node = window.getSelection()?.anchorNode;
    const ul = (node instanceof Element ? node : node?.parentElement)?.closest('ul');
    if (ul && ref.current?.contains(ul)) { ul.setAttribute('data-type', 'check'); ul.querySelectorAll(':scope > li').forEach((li) => li.hasAttribute('data-checked') || li.setAttribute('data-checked', 'false')); }
    emit();
  };

  // ---------- Tables ----------
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const [cell, setCell] = useState<HTMLTableCellElement | null>(null);
  const cellState = cell;
  const [tbl, setTbl] = useState<HTMLTableElement | null>(null); // table the + handles belong to
  const [box, setBox] = useState<Box | null>(null);
  const [cellBox, setCellBox] = useState<Box | null>(null); // outline of the cell you're in (drawn on top, the page itself isn't touched)
  const hoverTbl = useRef<HTMLTableElement | null>(null);
  // Excel-style block of cells (drag across cells, or Shift+click)
  const [range, setRange] = useState<CellRange | null>(null);
  const [rangeBox, setRangeBox] = useState<Box | null>(null);
  /** Row and column positions of the active table, for the row/column selector bars (like a spreadsheet's 1-2-3 / A-B-C). */
  type Lines = { table: HTMLTableElement; box: Box; rows: { top: number; height: number }[]; cols: { left: number; width: number }[] };
  const [allLines, setAllLines] = useState<Lines[]>([]); // every table on the page always shows its selector bars
  const lineAnchor = useRef<{ kind: 'row' | 'col'; i: number } | null>(null);
  const dragFrom = useRef<HTMLTableCellElement | null>(null);
  const [fillTarget, setFillTarget] = useState<'cells' | 'row' | 'col'>('cells');

  const place = useCallback(() => {
    const t = (cell?.closest('table') as HTMLTableElement | null) ?? range?.table ?? hoverTbl.current;
    const w0 = wrap.current?.getBoundingClientRect();
    if (cell && w0 && ref.current?.contains(cell)) { const c = cell.getBoundingClientRect(); setCellBox({ top: c.top - w0.top, left: c.left - w0.left, width: c.width, height: c.height }); } else setCellBox(null);
    if (range && w0 && ref.current?.contains(range.table)) {
      const a = range.table.rows[range.r0]?.cells[range.c0]?.getBoundingClientRect(), z = range.table.rows[range.r1]?.cells[range.c1]?.getBoundingClientRect();
      if (a && z) setRangeBox({ top: a.top - w0.top, left: a.left - w0.left, width: z.right - a.left, height: z.bottom - a.top }); else setRangeBox(null);
    } else setRangeBox(null);
    if (wrap.current && ref.current) {
      const w = wrap.current.getBoundingClientRect();
      setAllLines([...ref.current.querySelectorAll('table')].map((tb) => {
        const a = tb.getBoundingClientRect();
        const widest = [...tb.rows].reduce<HTMLTableRowElement | null>((m, r) => (!m || r.cells.length > m.cells.length ? r : m), null);
        return {
          table: tb, box: { top: a.top - w.top, left: a.left - w.left, width: a.width, height: a.height },
          rows: [...tb.rows].map((r) => { const b = r.getBoundingClientRect(); return { top: b.top - w.top, height: b.height }; }),
          // only columns you can see (the table may be scrolled sideways)
          cols: widest ? [...widest.cells].map((c) => { const b = c.getBoundingClientRect(); const vis = b.right > a.left + 4 && b.left < a.right - 4; return vis ? { left: b.left - w.left, width: b.width } : { left: NaN, width: 0 }; }) : [],
        };
      }));
    }
    if (!t || !wrap.current || !ref.current?.contains(t)) { setTbl(null); setBox(null); return; }
    const a = t.getBoundingClientRect(), w = wrap.current.getBoundingClientRect();
    setTbl(t);
    setBox({ top: a.top - w.top, left: a.left - w.left, width: a.width, height: a.height });
  }, [cell, range]);

  useEffect(() => {
    const h = () => {
      const n = window.getSelection()?.anchorNode;
      const el = (n instanceof Element ? n : n?.parentElement)?.closest('td,th') as HTMLTableCellElement | null;
      setCell(el && ref.current?.contains(el) ? el : null);
      if (n && ref.current?.contains(n)) setCurSize(sizeAtCaret());
    };
    document.addEventListener('selectionchange', h);
    window.addEventListener('resize', place);
    return () => { document.removeEventListener('selectionchange', h); window.removeEventListener('resize', place); };
  }, [place]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { place(); }, [place, len]);
  useEffect(() => { // keep the bars lined up when the page reflows (fonts, panels opening/closing…)
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => place());
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [place]);

  /** The cell the caret is in right now (read from the live selection, not from state). */
  const liveCell = (): HTMLTableCellElement | null => {
    const n = window.getSelection()?.anchorNode;
    const el = (n instanceof Element ? n : n?.parentElement)?.closest('td,th') as HTMLTableCellElement | null;
    return el && ref.current?.contains(el) ? el : null;
  };
  const caretIn = (el: Element | null | undefined) => {
    if (!el) return;
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
    (el as HTMLElement).scrollIntoView?.({ block: 'nearest' });
  };
  const blankRow = (cols: number) => `<tr>${Array.from({ length: cols }, () => '<td><br></td>').join('')}</tr>`;
  const insertTable = (rows: number, cols: number) => {
    setPop(null);
    refocus();
    const head = `<tr>${Array.from({ length: cols }, () => '<th><br></th>').join('')}</tr>`;
    document.execCommand('insertHTML', false, `<table><tbody>${head}${Array.from({ length: rows - 1 }, () => blankRow(cols)).join('')}</tbody></table><p><br></p>`);
    // the caret lands after the table — move it into the first cell so you can start typing
    const n = window.getSelection()?.anchorNode;
    let blk = (n instanceof Element ? n : n?.parentElement) ?? null;
    while (blk && blk.parentElement !== ref.current) blk = blk.parentElement;
    const t = blk?.tagName === 'TABLE' ? blk : blk?.previousElementSibling?.tagName === 'TABLE' ? blk.previousElementSibling : ref.current?.querySelector('table:last-of-type');
    caretIn(t?.querySelector('th,td'));
    emit();
  };
  const newCell = (tag: 'td' | 'th') => { const c = document.createElement(tag); c.innerHTML = '<br>'; return c; };
  const colsOf = (t: HTMLTableElement) => Math.max(1, ...[...t.rows].map((r) => [...r.cells].reduce((a, c) => a + (c.colSpan || 1), 0)));
  /** The big + handles: add a row at the bottom / a column at the right of a table. */
  const appendRow = (t: HTMLTableElement) => {
    const body = t.tBodies[0] ?? t;
    const tr = document.createElement('tr');
    for (let i = 0; i < colsOf(t); i++) tr.appendChild(newCell('td'));
    body.appendChild(tr);
    emit(); ref.current?.focus(); caretIn(tr.cells[0]); place();
  };
  const appendCol = (t: HTMLTableElement) => {
    [...t.rows].forEach((r) => r.appendChild(newCell(r.cells[0]?.tagName === 'TH' ? 'th' : 'td')));
    emit(); ref.current?.focus(); caretIn(t.rows[0]?.cells[t.rows[0].cells.length - 1]); place();
  };
  const tableOp = (op: 'rowAbove' | 'rowBelow' | 'colLeft' | 'colRight' | 'delRow' | 'delCol' | 'header' | 'wrap' | 'delTable') => {
    const cell = liveCell() ?? cellState;
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement, table = cell.closest('table')!;
    const ci = cell.cellIndex, rows = [...table.rows];
    let focusEl: Element | null = cell;
    if (op === 'rowAbove' || op === 'rowBelow') {
      const tr = document.createElement('tr');
      for (let i = 0; i < colsOf(table); i++) tr.appendChild(newCell('td'));
      row.parentElement!.insertBefore(tr, op === 'rowAbove' ? row : row.nextSibling);
      focusEl = tr.cells[Math.min(ci, tr.cells.length - 1)];
    } else if (op === 'colLeft' || op === 'colRight') {
      rows.forEach((r) => { const ref0 = r.cells[ci]; const c = newCell(r.cells[0]?.tagName === 'TH' ? 'th' : 'td'); r.insertBefore(c, op === 'colLeft' ? ref0 ?? null : ref0?.nextSibling ?? null); });
      focusEl = row.cells[op === 'colLeft' ? ci : ci + 1];
    } else if (op === 'delRow') {
      if (rows.length <= 1) { focusEl = table.nextElementSibling; table.remove(); }
      else { const i = rows.indexOf(row); row.remove(); const nr = table.rows[Math.min(i, table.rows.length - 1)]; focusEl = nr?.cells[Math.min(ci, nr.cells.length - 1)] ?? null; }
    } else if (op === 'delCol') {
      if (row.cells.length <= 1) { focusEl = table.nextElementSibling; table.remove(); }
      else { rows.forEach((r) => r.cells[ci]?.remove()); focusEl = row.cells[Math.min(ci, row.cells.length - 1)]; }
    } else if (op === 'header') {
      const first = table.rows[0];
      const toTh = first.cells[0]?.tagName !== 'TH';
      [...first.cells].forEach((c) => { const n = document.createElement(toTh ? 'th' : 'td'); n.innerHTML = c.innerHTML; c.replaceWith(n); });
      focusEl = first === row ? first.cells[ci] : cell;
    } else if (op === 'wrap') {
      if (table.getAttribute('data-wrap') === 'true') table.removeAttribute('data-wrap'); else table.setAttribute('data-wrap', 'true');
    } else {
      focusEl = table.nextElementSibling; table.remove();
    }
    emit();
    ref.current?.focus();
    if (op !== 'wrap') caretIn(focusEl);
    place();
  };
  const pos = (c: HTMLTableCellElement) => ({ r: [...c.closest('table')!.rows].indexOf(c.parentElement as HTMLTableRowElement), c: c.cellIndex });
  const makeRange = (a: HTMLTableCellElement, b: HTMLTableCellElement): CellRange | null => {
    const t = a.closest('table');
    if (!t || t !== b.closest('table')) return null;
    const p = pos(a), q = pos(b);
    return { table: t as HTMLTableElement, r0: Math.min(p.r, q.r), c0: Math.min(p.c, q.c), r1: Math.max(p.r, q.r), c1: Math.max(p.c, q.c) };
  };
  const cellsIn = (g: CellRange) => {
    const out: HTMLTableCellElement[] = [];
    for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const x = g.table.rows[r]?.cells[c]; if (x) out.push(x); }
    return out;
  };
  /** Click the bar left of a row / above a column to select it (Shift+click to select several). */
  const selectLine = (t: HTMLTableElement, kind: 'row' | 'col', i: number, shift: boolean) => {
    const prev = lineAnchor.current;
    const from = shift && prev && prev.kind === kind ? prev.i : i;
    if (!shift || !prev || prev.kind !== kind) lineAnchor.current = { kind, i };
    const maxCol = Math.max(0, ...[...t.rows].map((r) => r.cells.length)) - 1;
    const lo = Math.min(from, i), hi = Math.max(from, i);
    setRange(kind === 'row' ? { table: t, r0: lo, r1: hi, c0: 0, c1: maxCol } : { table: t, r0: 0, r1: t.rows.length - 1, c0: lo, c1: hi });
    setFillTarget('cells');
    if (document.activeElement !== ref.current) { ref.current?.focus(); }
    const first = kind === 'row' ? t.rows[lo]?.cells[0] : t.rows[0]?.cells[lo];
    caretIn(first);
  };
  const selectTable = (t: HTMLTableElement) => {
    lineAnchor.current = null;
    setRange({ table: t, r0: 0, r1: t.rows.length - 1, c0: 0, c1: Math.max(0, ...[...t.rows].map((r) => r.cells.length)) - 1 });
    if (document.activeElement !== ref.current) ref.current?.focus();
    caretIn(t.rows[0]?.cells[0]);
  };
  const fullRows = (g: CellRange) => g.c0 === 0 && g.c1 >= Math.max(...[...g.table.rows].map((r) => r.cells.length)) - 1;
  const fullCols = (g: CellRange) => g.r0 === 0 && g.r1 >= g.table.rows.length - 1;
  /** Delete the selected whole rows / columns. */
  const deleteLines = (kind: 'row' | 'col') => {
    if (!range) return;
    const t = range.table;
    if (kind === 'row') { for (let r = range.r1; r >= range.r0; r--) t.rows[r]?.remove(); }
    else [...t.rows].forEach((row) => { for (let c = range.c1; c >= range.c0; c--) row.cells[c]?.remove(); });
    if (!t.rows.length || !t.rows[0].cells.length) t.remove();
    setRange(null); emit(); place();
  };
  /** Colour cells: the selected block, the whole row(s) or the whole column(s). '' removes the fill. */
  const fill = (color: string) => {
    const c0 = liveCell() ?? cellState;
    const g = range ?? (c0 ? makeRange(c0, c0) : null);
    if (!g) return;
    let targets = cellsIn(g);
    if (fillTarget === 'row') targets = [...g.table.rows].slice(g.r0, g.r1 + 1).flatMap((r) => [...r.cells]);
    if (fillTarget === 'col') targets = [...g.table.rows].flatMap((r) => [...r.cells].filter((x) => x.cellIndex >= g.c0 && x.cellIndex <= g.c1));
    targets.forEach((x) => { x.style.backgroundColor = color; });
    emit(); setPop(null); place();
  };
  /** Round tick you can click to mark something done (like a task). */
  const insertTick = () => {
    refocus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ref.current?.contains(sel.anchorNode)) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const tick = document.createElement('span'); tick.setAttribute('data-tick', 'false'); tick.setAttribute('contenteditable', 'false');
    const gap = document.createTextNode('\u00a0');
    // never at the top level of the page — put it inside the line (paragraph) the caret is on
    if (r.startContainer === ref.current) { const p0 = document.createElement('p'); r.insertNode(p0); p0.append(tick, gap); }
    else { r.insertNode(gap); r.insertNode(tick); }
    const after = document.createRange(); after.setStartAfter(gap); after.collapse(true);
    sel.removeAllRanges(); sel.addRange(after);
    emit(); keepSel();
  };
  /** Put a tick at the start of every selected cell (or the current cell) that doesn't have one yet. */
  const tickCells = () => {
    const c0 = liveCell() ?? cellState;
    const list = range ? cellsIn(range) : c0 ? [c0] : [];
    if (!list.length) return insertTick();
    list.forEach((x) => { if (!x.querySelector('[data-tick]')) { if (x.innerHTML === '<br>') x.innerHTML = ''; x.insertAdjacentHTML('afterbegin', TICK); } });
    emit(); place();
  };
  /** Tab / Shift+Tab move between cells; Tab in the last cell adds a row. */
  const tabInTable = (back: boolean) => {
    const cell = liveCell();
    if (!cell) return false;
    const table = cell.closest('table')!;
    const all = [...table.querySelectorAll('td,th')];
    const i = all.indexOf(cell);
    if (!back && i === all.length - 1) { tableOp('rowBelow'); return true; }
    caretIn(all[back ? Math.max(0, i - 1) : i + 1]);
    return true;
  };
  /** Pasting rows/columns while the caret is in a cell fills the cells from there (like a spreadsheet), adding rows/columns as needed. */
  const pasteIntoCells = (grid: string[][]) => {
    const cell = liveCell();
    if (!cell) return false;
    const table = cell.closest('table')!;
    const r0 = [...table.rows].indexOf(cell.parentElement as HTMLTableRowElement), c0 = cell.cellIndex;
    const need = c0 + Math.max(...grid.map((r) => r.length));
    [...table.rows].forEach((r) => { while (r.cells.length < need) r.appendChild(newCell(r.cells[0]?.tagName === 'TH' ? 'th' : 'td')); });
    const body = table.tBodies[0] ?? table;
    while (table.rows.length < r0 + grid.length) { const tr = document.createElement('tr'); for (let i = 0; i < need; i++) tr.appendChild(newCell('td')); body.appendChild(tr); }
    grid.forEach((cells, i) => cells.forEach((html, j) => { const c = table.rows[r0 + i].cells[c0 + j]; c.innerHTML = html || '<br>'; }));
    emit(); place();
    return true;
  };

  // ---------- Click anywhere to type (like OneNote) ----------
  /** A click in the empty space below the text puts the caret right there: blank lines are added down to that
   *  spot and the new line starts at the horizontal position you clicked. */
  const onMouseDown = (e: React.MouseEvent) => {
    const b = ref.current;
    const td = (e.target as HTMLElement).closest?.('td,th') as HTMLTableCellElement | null;
    if (td && b?.contains(td) && e.button === 0 && !(e.target as HTMLElement).closest('[data-tick]')) {
      const from = liveCell();
      if (e.shiftKey && from && from !== td) { e.preventDefault(); setRange(makeRange(from, td)); dragFrom.current = null; return; }
      dragFrom.current = td; setRange(null);
      return;
    }
    if (range) setRange(null);
    if (!b || e.target !== b || e.button !== 0) return;
    const last = b.lastElementChild as HTMLElement | null;
    const r = b.getBoundingClientRect();
    const bottom = last ? last.getBoundingClientRect().bottom : r.top;
    const LINE = 26;
    if (e.clientY < bottom + 4) return; // beside existing text — the browser handles it
    e.preventDefault();
    const lines = Math.floor((e.clientY - bottom) / LINE);
    const indent = Math.min(Math.max(0, Math.round((e.clientX - r.left) / 24) * 24), Math.max(0, r.width - 160));
    for (let i = 0; i < lines; i++) { const p = document.createElement('p'); p.innerHTML = '<br>'; b.appendChild(p); }
    const p = document.createElement('p'); p.innerHTML = '<br>';
    if (indent >= 24) p.style.marginLeft = `${indent}px`;
    b.appendChild(p);
    b.focus();
    caretIn(p);
    keepSel();
  };
  /** When you leave the page, drop empty lines left at the very end. */
  const onBlur = () => {
    keepSel();
    const b = ref.current;
    if (!b) return;
    let changed = false;
    while (b.lastElementChild && b.lastElementChild.tagName === 'P' && !b.lastElementChild.textContent?.trim() && !b.lastElementChild.querySelector('img,table') && b.lastElementChild.previousElementSibling?.tagName !== 'TABLE' && b.childElementCount > 1) { b.lastElementChild.remove(); changed = true; }
    if (changed) emit();
  };
  const onMove = (e: React.MouseEvent) => {
    if (dragFrom.current && e.buttons === 1) { // dragging across cells selects a block, like Excel
      const td = (e.target as HTMLElement).closest?.('td,th') as HTMLTableCellElement | null;
      if (td && td !== dragFrom.current && td.closest('table') === dragFrom.current.closest('table')) {
        const g = makeRange(dragFrom.current, td);
        if (g && (!range || g.r0 !== range.r0 || g.c0 !== range.c0 || g.r1 !== range.r1 || g.c1 !== range.c1)) setRange(g);
        const s0 = window.getSelection(); if (s0 && dragFrom.current) { s0.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(dragFrom.current); r.collapse(true); s0.addRange(r); }
      }
    } else if (dragFrom.current && !e.buttons) dragFrom.current = null;
    const t = (e.target as HTMLElement).closest?.('table') as HTMLTableElement | null;
    if (t && ref.current?.contains(t)) { if (hoverTbl.current !== t) { hoverTbl.current = t; place(); } }
    else if (hoverTbl.current && !(e.target as HTMLElement).closest?.('[data-table-handle]')) {
      // keep the handles while the pointer is near the table (so you can reach them)
      const a = hoverTbl.current.getBoundingClientRect();
      if (e.clientX < a.left - 30 || e.clientX > a.right + 44 || e.clientY < a.top - 30 || e.clientY > a.bottom + 44) { hoverTbl.current = null; place(); }
    }
  };

  /** Tapping the box at the start of a checklist item ticks it. */
  const onClick = (e: React.MouseEvent) => {
    const tick = (e.target as HTMLElement).closest('[data-tick]');
    if (tick && ref.current?.contains(tick)) { tick.setAttribute('data-tick', tick.getAttribute('data-tick') === 'true' ? 'false' : 'true'); e.preventDefault(); emit(); return; }
    const li = (e.target as HTMLElement).closest('li');
    if (!li || !li.parentElement?.matches('ul[data-type="check"]')) return;
    const r = li.getBoundingClientRect();
    if (e.clientX - r.left < 30) { li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true'); e.preventDefault(); emit(); }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (range && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      // whole rows / whole columns selected (from the side or top bars) → remove them; a block of cells → empty them
      if (fullRows(range)) deleteLines('row');
      else if (fullCols(range)) deleteLines('col');
      else { cellsIn(range).forEach((x) => { x.innerHTML = '<br>'; }); emit(); }
      return;
    }
    if (range && e.key === 'Escape') { setRange(null); return; }
    if (range && !e.shiftKey && !e.metaKey && !e.ctrlKey && e.key.length === 1) setRange(null);
    if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(k)) { e.preventDefault(); cmd(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline'); }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '>' || e.key === '.')) { e.preventDefault(); stepSize(1); }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '<' || e.key === ',')) { e.preventDefault(); stepSize(-1); }
    if (e.key === 'Tab') { e.preventDefault(); if (!tabInTable(e.shiftKey)) cmd(e.shiftKey ? 'outdent' : 'indent'); }
    // new checklist items start unticked
    if (e.key === 'Enter') setTimeout(() => { ref.current?.querySelectorAll('ul[data-type="check"] > li:not([data-checked])').forEach((li) => li.setAttribute('data-checked', 'false')); }, 0);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const clean0 = html ? sanitize(html) : '';
    // A table (from Excel, Google Sheets or a web page) keeps its rows and columns.
    let grid: string[][] | null = null;
    if (clean0.includes('<table')) {
      const d = new DOMParser().parseFromString(`<body>${clean0}</body>`, 'text/html');
      const t = d.querySelector('table');
      if (t && !d.body.textContent?.replace(t.textContent ?? '', '').trim()) grid = [...t.rows].map((r) => [...r.cells].map((c) => c.innerHTML));
    } else if (!clean0 || !/<(p|div|h\d|ul|ol|li|b|i|u|span)\b/i.test(clean0)) {
      const rows = tsv(text);
      if (rows) grid = rows.map((r) => r.map((c) => esc(c.trim())));
    }
    if (grid && pasteIntoCells(grid)) return;
    if (grid && !clean0.includes('<table')) {
      const [head, ...rest] = grid;
      const cols = Math.max(...grid.map((r) => r.length));
      const tr = (cells: string[], tag: string) => `<tr>${Array.from({ length: cols }, (_, j) => `<${tag}>${cells[j] || '<br>'}</${tag}>`).join('')}</tr>`;
      document.execCommand('insertHTML', false, `<table><tbody>${tr(head, 'th')}${rest.map((r) => tr(r, 'td')).join('')}</tbody></table><p><br></p>`);
    } else if (clean0) document.execCommand('insertHTML', false, clean0);
    else document.execCommand('insertText', false, text);
    emit();
  };
  const addLink = () => {
    let url = linkUrl.trim();
    if (!url) return setPop(null);
    if (!/^(https?:|mailto:|tel:)/i.test(url)) url = `https://${url}`;
    cmd('createLink', url);
    setPop(null); setLinkUrl('');
  };

  const Swatch = ({ c, onPick, label }: { c: string; onPick: () => void; label: string }) => (
    <button type="button" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onPick}
      className="size-8 shrink-0 rounded-full border border-line hover:scale-110" style={{ background: c }} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-1 bg-white/95 px-1 py-1.5 backdrop-blur-sm max-md:top-[calc(57px+env(safe-area-inset-top))]">
        <div className="seg !gap-0.5 items-center md:flex-wrap md:!overflow-visible" role="toolbar" aria-label="Formatting">
          {/* text size */}
          <B label="Smaller text (Ctrl+Shift+<)" onClick={() => stepSize(-1)}><span className="text-[12px] font-semibold">A−</span></B>
          <B label="Text size" active={pop === 'size'} wide onClick={() => toggle('size')}><span className="num flex items-center gap-0.5 text-[13px]">{curSize}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg></span></B>
          <B label="Bigger text (Ctrl+Shift+>)" onClick={() => stepSize(1)}><span className="text-[15px] font-semibold">A+</span></B>
          <Sep />
          <B label="Bold (Ctrl+B)" onClick={() => cmd('bold')}><b>B</b></B>
          <B label="Italic (Ctrl+I)" onClick={() => cmd('italic')}><i className="font-serif">I</i></B>
          <B label="Underline (Ctrl+U)" onClick={() => cmd('underline')}><u>U</u></B>
          <B label="Strikethrough" onClick={() => cmd('strikeThrough')}><s>S</s></B>
          <B label="Text colour" active={pop === 'color'} onClick={() => toggle('color')}><span className="flex flex-col items-center leading-none"><span className="text-[15px] font-semibold">A</span><span className="mt-0.5 h-[3px] w-4 rounded bg-gradient-to-r from-[#d64545] via-[#3f63c8] to-[#2e9b62]" /></span></B>
          <B label="Highlight" active={pop === 'hl'} onClick={() => toggle('hl')}><span className="rounded bg-[#fff3a3] px-1">ab</span></B>
          <B label="Superscript" onClick={() => cmd('superscript')}><span className="text-[13px]">x<sup>2</sup></span></B>
          <B label="Subscript" onClick={() => cmd('subscript')}><span className="text-[13px]">x<sub>2</sub></span></B>
          <Sep />
          <B label="Heading 1" onClick={() => cmd('formatBlock', '<h1>')}><span className="text-[13px] font-bold">H1</span></B>
          <B label="Heading 2" onClick={() => cmd('formatBlock', '<h2>')}><span className="text-[13px] font-bold">H2</span></B>
          <B label="Heading 3" onClick={() => cmd('formatBlock', '<h3>')}><span className="text-[13px] font-bold">H3</span></B>
          <B label="Normal text" onClick={() => cmd('formatBlock', '<p>')}><span className="text-[13px]">¶</span></B>
          <Sep />
          <B label="Align left" onClick={() => cmd('justifyLeft')}><Svg d="M4 6h16M4 10h10M4 14h16M4 18h10" /></B>
          <B label="Align centre" onClick={() => cmd('justifyCenter')}><Svg d="M4 6h16M7 10h10M4 14h16M7 18h10" /></B>
          <B label="Align right" onClick={() => cmd('justifyRight')}><Svg d="M4 6h16M10 10h10M4 14h16M10 18h10" /></B>
          <B label="Decrease indent (Shift+Tab)" onClick={() => cmd('outdent')}><Svg d="M10 6h10M10 12h10M10 18h10M7 9l-3 3 3 3" /></B>
          <B label="Increase indent (Tab)" onClick={() => cmd('indent')}><Svg d="M10 6h10M10 12h10M10 18h10M4 9l3 3-3 3" /></B>
          <Sep />
          <B label="Bulleted list" onClick={() => cmd('insertUnorderedList')}><Svg d="M9 6h11M9 12h11M9 18h11"><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></Svg></B>
          <B label="Numbered list" onClick={() => cmd('insertOrderedList')}><Svg d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 1 1 2.5 1.2L3.5 18.5H6.5" /></B>
          <B label="To-do checklist" onClick={checklist}><Svg d="M4.5 7l1 1 2-2M12 7h9M12 17h9"><rect x="3" y="4" width="6" height="6" rx="1.5" /><rect x="3" y="14" width="6" height="6" rx="1.5" /></Svg></B>
          <B label="Tick circle — click it to mark done" onClick={() => (liveCell() ? tickCells() : insertTick())}><Svg d="M8.5 12.3l2.4 2.4 4.6-4.9"><circle cx="12" cy="12" r="8.5" /></Svg></B>
          <B label="Quote" onClick={() => cmd('formatBlock', '<blockquote>')}><span className="font-serif text-[20px] leading-none">“</span></B>
          <B label="Divider line" onClick={() => cmd('insertHorizontalRule')}><Svg d="M4 12h16" /></B>
          <B label="Insert table" active={pop === 'table'} onClick={() => toggle('table')}><Svg d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10M15 9.5v10"><rect x="3.5" y="4.5" width="17" height="15" rx="2" /></Svg></B>
          <B label="Link" active={pop === 'link'} onClick={() => toggle('link')}><Svg d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></B>
          <Sep />
          <B label="Clear formatting" onClick={() => { cmd('removeFormat'); cmd('formatBlock', '<p>'); }}><span className="text-[13px] text-mute">T<sub>x</sub></span></B>
          <B label="Undo" onClick={() => cmd('undo')}><Svg d="M9 7L4.5 11.5 9 16M5 11.5h9a5 5 0 0 1 0 10h-2" /></B>
          <B label="Redo" onClick={() => cmd('redo')}><Svg d="M15 7l4.5 4.5L15 16M19 11.5h-9a5 5 0 0 0 0 10h2" /></B>
        </div>

        {pop === 'size' && (
          <div className="seg !gap-1 items-center px-1 md:flex-wrap md:!overflow-visible">
            <span className="shrink-0 pr-1 text-[13px] text-mute">Size</span>
            <form className="flex shrink-0 items-center gap-1" onSubmit={(e) => { e.preventDefault(); const v = Math.round(Number(customSize)); if (v >= 1 && v <= 400) { setSize(v); setPop(null); } }}>
              <input className="input num !min-h-8 !w-[72px] py-0.5 text-center" type="number" min={1} max={400} placeholder={String(curSize)} value={customSize} onChange={(e) => setCustomSize(e.target.value)} aria-label="Any text size in px" />
              <button type="submit" className="btn btn-sm btn-soft !min-h-8">Set</button>
            </form>
            {SIZES.map((s) => (
              <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSize(s); setPop(null); }}
                className={`min-h-8 shrink-0 rounded-lg border px-2.5 ${s === curSize ? 'border-[#c9d6f4] bg-pri-soft text-pri-ink' : 'border-line hover:bg-line-soft'}`} style={{ fontSize: Math.min(s, 20) }}>{s}</button>
            ))}
          </div>
        )}
        {pop === 'color' && (
          <div className="seg !gap-2 items-center px-1">
            <span className="shrink-0 text-[13px] text-mute">Text colour</span>
            {TEXT_COLORS.map((c, i) => <Swatch key={c} c={c} label={i === 0 ? 'Default colour' : `Colour ${c}`} onPick={() => color(c, 'foreColor')} />)}
            <label className="relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-dashed border-faint text-[16px] text-mute" title="Any colour" onMouseDown={keepSel}>+
              <input type="color" className="absolute inset-0 cursor-pointer opacity-0" aria-label="Any colour" onChange={(e) => color(e.target.value, 'foreColor')} />
            </label>
          </div>
        )}
        {pop === 'hl' && (
          <div className="seg !gap-2 items-center px-1">
            <span className="shrink-0 text-[13px] text-mute">Highlight</span>
            {HIGHLIGHTS.map((c) => <Swatch key={c} c={c} label={`Highlight ${c}`} onPick={() => color(c, 'hiliteColor')} />)}
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => color('transparent', 'hiliteColor')} className="min-h-8 shrink-0 rounded-lg border border-line px-2.5 text-[13px] text-mute hover:bg-line-soft">No highlight</button>
          </div>
        )}
        {pop === 'table' && (
          <div className="flex flex-wrap items-center gap-3 px-1">
            <div className="grid grid-cols-8 gap-[3px]" onMouseLeave={() => setHover([0, 0])} role="grid" aria-label="Choose table size">
              {Array.from({ length: 48 }, (_, k) => { const rr = Math.floor(k / 8) + 1, cc = (k % 8) + 1; const on = rr <= hover[0] && cc <= hover[1]; return (
                <button key={k} type="button" aria-label={`${rr} by ${cc} table`} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHover([rr, cc])} onFocus={() => setHover([rr, cc])} onClick={() => insertTable(rr, cc)}
                  className={`size-5 rounded-[4px] border ${on ? 'border-pri bg-pri-soft' : 'border-line bg-white'}`} />); })}
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] text-mute">
              <span>{hover[0] ? `${hover[0]} rows × ${hover[1]} columns` : 'Pick a size'}</span>
              <button type="button" className="btn btn-sm btn-soft" onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 3)}>Quick 3 × 3</button>
              <span className="max-w-[220px] text-[12px]">Tip: copy rows from Excel or Google Sheets and paste — they come in as a table.</span>
            </div>
          </div>
        )}
        {(cell || range) && (
          <div className="seg !gap-1 items-center px-1" role="toolbar" aria-label="Table">{/* one line, so the page never jumps while you drag across cells */}
            <span className="shrink-0 pr-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-faint">{range ? `${(range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1)} cells` : 'Table'}</span>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggle('fill')} aria-pressed={pop === 'fill'}
              className={`flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] ${pop === 'fill' ? 'border-[#c9d6f4] bg-pri-soft text-pri-ink' : 'border-line text-ink hover:bg-line-soft'}`}>
              <span className="size-3.5 rounded-[3px] border border-line bg-gradient-to-br from-[#fff2a8] via-[#d3f2dc] to-[#d6e4ff]" />Fill colour</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={tickCells} className="flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 text-[13px] text-ink hover:bg-line-soft">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4 4.6-4.9" /></svg>Tick</button>
            {cell && ([['rowAbove', '+ Row above'], ['rowBelow', '+ Row below'], ['colLeft', '+ Column left'], ['colRight', '+ Column right'], ['header', 'Header row'], ['wrap', cell.closest('table')?.getAttribute('data-wrap') === 'true' ? 'One line per cell' : 'Wrap text'], ['delRow', '− Row'], ['delCol', '− Column'], ['delTable', 'Delete table']] as const).map(([op, label]) => (
              <button key={op} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => tableOp(op)}
                className={`min-h-8 shrink-0 rounded-lg border px-2.5 text-[13px] ${op.startsWith('del') ? 'border-rose-soft text-rose-ink hover:bg-rose-soft' : 'border-line text-ink hover:bg-line-soft'}`}>{label}</button>
            ))}
            {range && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { cellsIn(range).forEach((x) => { x.innerHTML = '<br>'; }); emit(); }} className="min-h-8 shrink-0 rounded-lg border border-rose-soft px-2.5 text-[13px] text-rose-ink hover:bg-rose-soft">Clear cells</button>}
            {range && fullRows(range) && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => deleteLines('row')} className="min-h-8 shrink-0 rounded-lg border border-rose-soft px-2.5 text-[13px] text-rose-ink hover:bg-rose-soft">Delete {range.r1 > range.r0 ? 'rows' : 'row'}</button>}
            {range && fullCols(range) && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => deleteLines('col')} className="min-h-8 shrink-0 rounded-lg border border-rose-soft px-2.5 text-[13px] text-rose-ink hover:bg-rose-soft">Delete {range.c1 > range.c0 ? 'columns' : 'column'}</button>}
          </div>
        )}
        {pop === 'fill' && (cell || range) && (
          <div className="flex flex-col gap-2 px-1">
            <div className="seg !gap-1 items-center">
              <span className="shrink-0 pr-1 text-[13px] text-mute">Colour</span>
              {([['cells', range ? 'Selected cells' : 'This cell'], ['row', range && range.r1 > range.r0 ? 'Whole rows' : 'Whole row'], ['col', range && range.c1 > range.c0 ? 'Whole columns' : 'Whole column']] as const).map(([v, l]) => (
                <button key={v} type="button" className="chip !min-h-8" aria-pressed={fillTarget === v} onMouseDown={(e) => e.preventDefault()} onClick={() => setFillTarget(v)}>{l}</button>
              ))}
            </div>
            <div className="seg !gap-2 items-center">
              {FILLS.map((c) => <Swatch key={c} c={c} label={`Fill ${c}`} onPick={() => fill(c)} />)}
              <label className="relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-dashed border-faint text-[16px] text-mute" title="Any colour">+
                <input type="color" className="absolute inset-0 cursor-pointer opacity-0" aria-label="Any fill colour" onChange={(e) => fill(e.target.value)} />
              </label>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fill('')} className="min-h-8 shrink-0 rounded-lg border border-line px-2.5 text-[13px] text-mute hover:bg-line-soft">No fill</button>
            </div>
            <span className="text-[12px] text-faint">Tip: drag across cells (or Shift+click) to pick a block of cells.</span>
          </div>
        )}
        {pop === 'link' && (
          <div className="flex gap-2 px-1">
            <input className="input !min-h-9 py-1" autoFocus placeholder="Paste a link, e.g. example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } if (e.key === 'Escape') setPop(null); }} />
            <button type="button" className="btn btn-sm btn-soft" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>Add link</button>
          </div>
        )}
      </div>

      <div ref={wrap} className="relative flex flex-1 flex-col" onScrollCapture={() => place()} onMouseMove={onMove} onMouseLeave={() => { if (hoverTbl.current) { hoverTbl.current = null; place(); } }}>
        <div ref={ref} className="note-body min-h-[70dvh] flex-1 cursor-text py-2 pb-[30dvh] outline-none" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Page content"
          data-placeholder={placeholder} onInput={emit} onClick={onClick} onKeyDown={onKeyDown} onPaste={onPaste} onKeyUp={keepSel} onMouseUp={keepSel} onBlur={onBlur} onMouseDown={onMouseDown} />
        {cellBox && !rangeBox && <div aria-hidden="true" className="pointer-events-none absolute z-[5] rounded-[2px] ring-2 ring-[#9db2e8]" style={cellBox} />}
        {rangeBox && <div aria-hidden="true" className="pointer-events-none absolute z-[5] rounded-[2px] bg-[#4d6fcc]/10 ring-2 ring-pri" style={rangeBox} />}
        {allLines.map(({ table: tb, box: bx, rows, cols }, ti) => {
          const active = tb === tbl;
          const base = `absolute z-10 rounded-[4px] border transition-colors`;
          const idle = active ? 'border-[#b9c3d1] bg-[#e4e9f0] hover:border-[#9db2e8] hover:bg-pri-soft' : 'border-[#cfd6e0] bg-line-soft hover:border-[#9db2e8] hover:bg-pri-soft';
          const whole = !!range && range.table === tb && fullRows(range) && fullCols(range);
          return (
            <div key={`t${ti}`} className="contents">
              <button type="button" data-table-handle aria-label="Select the whole table" title="Select the whole table" onMouseDown={(e) => e.preventDefault()} onClick={() => selectTable(tb)}
                className={`${base} ${whole ? 'border-pri bg-pri' : idle}`} style={{ top: bx.top - 15, left: bx.left - 16, width: 11, height: 10 }} />
              {rows.map((r, i) => {
                const on = !!range && range.table === tb && fullRows(range) && i >= range.r0 && i <= range.r1;
                return <button key={`r${i}`} type="button" data-table-handle aria-label={`Select row ${i + 1}`} title={`Select row ${i + 1} (Shift+click for more)`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => selectLine(tb, 'row', i, e.shiftKey)}
                  className={`${base} ${on ? 'border-pri bg-pri' : idle}`} style={{ top: r.top + 2, height: Math.max(8, r.height - 4), left: bx.left - 16, width: 11 }} />;
              })}
              {cols.map((c, i) => {
                if (Number.isNaN(c.left)) return null;
                const on = !!range && range.table === tb && fullCols(range) && i >= range.c0 && i <= range.c1;
                return <button key={`c${i}`} type="button" data-table-handle aria-label={`Select column ${i + 1}`} title={`Select column ${i + 1} (Shift+click for more)`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => selectLine(tb, 'col', i, e.shiftKey)}
                  className={`${base} ${on ? 'border-pri bg-pri' : idle}`} style={{ left: c.left + 2, width: Math.max(8, c.width - 4), top: bx.top - 15, height: 10 }} />;
              })}
            </div>
          );
        })}
        {tbl && box && (
          <>
            {/* round + buttons sitting on the table's bottom and right edges */}
            <button type="button" data-table-handle aria-label="Add a row at the bottom" title="Add row" onMouseDown={(e) => e.preventDefault()} onClick={() => appendRow(tbl)}
              className="absolute z-10 flex h-6 items-center gap-1 rounded-full border border-[#b9c7ec] bg-white px-2.5 text-[12px] font-semibold text-pri-ink shadow-[0_2px_8px_rgba(31,45,61,.12)] hover:bg-pri-soft"
              style={{ top: box.top + box.height - 12, left: box.left + box.width / 2 - 34 }}><span className="text-[15px] leading-none">+</span>Row</button>
            <button type="button" data-table-handle aria-label="Add a column on the right" title="Add column" onMouseDown={(e) => e.preventDefault()} onClick={() => appendCol(tbl)}
              className="absolute z-10 flex w-6 flex-col items-center justify-center gap-0.5 rounded-full border border-[#b9c7ec] bg-white py-2 text-[12px] font-semibold text-pri-ink shadow-[0_2px_8px_rgba(31,45,61,.12)] hover:bg-pri-soft"
              style={{ top: box.top + box.height / 2 - 26, left: box.left + box.width - 12 }}><span className="text-[15px] leading-none">+</span><span className="[writing-mode:vertical-rl]">Col</span></button>
          </>
        )}
      </div>
      {len > PAGE_LIMIT * 0.8 && (
        <p className={`text-[13px] ${len > PAGE_LIMIT ? 'text-rose-ink' : 'text-amber-ink'}`} role="status">
          {len > PAGE_LIMIT ? 'This page is too long to save in one Google Sheets cell — move some of it to a new page.' : 'This page is getting long. Google Sheets holds about 50,000 characters per page.'}
        </p>
      )}
    </div>
  );
}
