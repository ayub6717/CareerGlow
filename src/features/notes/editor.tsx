import { useEffect, useRef, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Safe HTML. Page bodies live in a Google Sheet anyone with edit access could change, and pasted content can carry
// scripts, so everything is passed through this allow-list before it is shown or saved.
// ---------------------------------------------------------------------------
const TAGS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'MARK', 'SPAN', 'CODE', 'PRE', 'HR', 'SUB', 'SUP', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'NOSCRIPT', 'TITLE', 'META', 'LINK', 'HEAD']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;

function clean(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  if (DROP.has(el.tagName)) return null;
  const kids = () => { const f = doc.createDocumentFragment(); el.childNodes.forEach((c) => { const x = clean(c, doc); if (x) f.appendChild(x); }); return f; };
  if (!TAGS.has(el.tagName)) return kids(); // unknown tag (font, o:p…) → keep its text only
  const out = doc.createElement(el.tagName === 'STRIKE' ? 'S' : el.tagName);
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') ?? '';
    if (/^(https?:|mailto:|tel:)/i.test(href.trim())) { out.setAttribute('href', href.trim()); out.setAttribute('target', '_blank'); out.setAttribute('rel', 'noopener noreferrer'); }
  }
  if (el.tagName === 'UL' && el.getAttribute('data-type') === 'check') out.setAttribute('data-type', 'check');
  if (el.tagName === 'LI' && el.hasAttribute('data-checked')) out.setAttribute('data-checked', el.getAttribute('data-checked') === 'true' ? 'true' : 'false');
  const bg = el.style?.backgroundColor, fg = el.style?.color;
  const style = [bg && COLOR.test(bg.replace(/\s/g, '')) ? `background-color:${bg}` : '', fg && COLOR.test(fg.replace(/\s/g, '')) ? `color:${fg}` : ''].filter(Boolean).join(';');
  if (style && (el.tagName === 'SPAN' || el.tagName === 'MARK')) out.setAttribute('style', style);
  // "click anywhere to type" places a paragraph at an indent — keep that (px only, sensible range)
  const ml = el.style?.marginLeft;
  if (ml && /^(P|DIV|H1|H2|H3)$/.test(el.tagName) && /^\d{1,4}px$/.test(ml) && parseInt(ml, 10) <= 1600) out.setAttribute('style', `margin-left:${ml}`);
  out.appendChild(kids());
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
  const doc = new DOMParser().parseFromString(`<body>${html.replace(/<\/?(br|p|div|li|h\d|ul|ol|blockquote)\b[^>]*>/gi, ' $&')}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Google Sheets allows 50,000 characters in a cell. */
export const PAGE_LIMIT = 49000;

// ---------------------------------------------------------------------------
// Editor: contentEditable + a small toolbar. Uncontrolled — the DOM is the source of truth while typing.
// ---------------------------------------------------------------------------
const HIGHLIGHTS = ['#fff3a3', '#c8f2d5', '#cfe3ff', '#ffd6e0', 'transparent'];

const B = ({ label, onClick: on, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) => (
  <button type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={on}
    className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-2 text-[15px] text-ink hover:bg-line-soft ${active ? 'bg-pri-soft text-pri-ink' : ''}`}>{children}</button>
);
const Sep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />;

export function NoteEditor({ initial, onChange, placeholder = 'Start typing…' }: { initial: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [len, setLen] = useState(initial.length);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [hl, setHl] = useState(false);
  const saved = useRef<Range | null>(null);

  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitize(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- set once per page (component is keyed by page id)

  const emit = () => { const h = sanitize(ref.current?.innerHTML ?? ''); setLen(h.length); onChange(h); };
  const keepSel = () => { const s = window.getSelection(); if (s && s.rangeCount && ref.current?.contains(s.anchorNode)) saved.current = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { const s = window.getSelection(); if (saved.current && s) { s.removeAllRanges(); s.addRange(saved.current); } };
  /** Toolbar buttons don't take focus, so the caret is usually still in place; only restore it after e.g. the link box. */
  const refocus = () => { if (document.activeElement !== ref.current) { ref.current?.focus(); restoreSel(); } };
  const cmd = (name: string, value?: string) => { refocus(); document.execCommand(name, false, value); emit(); keepSel(); };

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
  const [tablePick, setTablePick] = useState(false);
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const [cell, setCell] = useState<HTMLTableCellElement | null>(null);
  useEffect(() => {
    const h = () => {
      const n = window.getSelection()?.anchorNode;
      const el = (n instanceof Element ? n : n?.parentElement)?.closest('td,th') as HTMLTableCellElement | null;
      setCell(el && ref.current?.contains(el) ? el : null);
    };
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, []);
  useEffect(() => { if (!cell) return; cell.setAttribute('data-cur', ''); return () => cell.removeAttribute('data-cur'); }, [cell]); // highlight the cell you're in (not saved)
  const caretIn = (el: Element | null | undefined) => {
    if (!el) return;
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
    (el as HTMLElement).scrollIntoView?.({ block: 'nearest' });
  };
  const insertTable = (rows: number, cols: number) => {
    setTablePick(false);
    refocus();
    const tr = (tag: string) => `<tr>${Array.from({ length: cols }, () => `<${tag}><br></${tag}>`).join('')}</tr>`;
    document.execCommand('insertHTML', false, `<table><tbody>${tr('th')}${Array.from({ length: rows - 1 }, () => tr('td')).join('')}</tbody></table><p><br></p>`);
    // the caret lands after the table — move it into the first cell so you can start typing
    const n = window.getSelection()?.anchorNode;
    let blk = (n instanceof Element ? n : n?.parentElement) ?? null;
    while (blk && blk.parentElement !== ref.current) blk = blk.parentElement;
    const t = blk?.tagName === 'TABLE' ? blk : blk?.previousElementSibling?.tagName === 'TABLE' ? blk.previousElementSibling : ref.current?.querySelector('table:last-of-type');
    caretIn(t?.querySelector('th,td'));
    emit();
  };
  const newCell = (tag: 'td' | 'th') => { const c = document.createElement(tag); c.innerHTML = '<br>'; return c; };
  const tableOp = (op: 'rowAbove' | 'rowBelow' | 'colLeft' | 'colRight' | 'delRow' | 'delCol' | 'header' | 'delTable') => {
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement, table = cell.closest('table')!;
    const ci = cell.cellIndex, rows = [...table.rows];
    let focusEl: Element | null = cell;
    if (op === 'rowAbove' || op === 'rowBelow') {
      const tr = document.createElement('tr');
      for (let i = 0; i < row.cells.length; i++) tr.appendChild(newCell('td'));
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
    } else {
      focusEl = table.nextElementSibling; table.remove();
    }
    emit();
    ref.current?.focus();
    caretIn(focusEl);
  };
  /** Tab / Shift+Tab move between cells; Tab in the last cell adds a row. */
  const tabInTable = (back: boolean) => {
    if (!cell) return false;
    const table = cell.closest('table')!;
    const all = [...table.querySelectorAll('td,th')];
    const i = all.indexOf(cell);
    if (!back && i === all.length - 1) { tableOp('rowBelow'); return true; }
    caretIn(all[back ? Math.max(0, i - 1) : i + 1]);
    return true;
  };

  // ---------- Click anywhere to type (like OneNote) ----------
  /** A click in the empty space below the text puts the caret right there: blank lines are added down to that
   *  spot and the new line starts at the horizontal position you clicked. */
  const onMouseDown = (e: React.MouseEvent) => {
    const box = ref.current;
    if (!box || e.target !== box || e.button !== 0) return;
    const last = box.lastElementChild as HTMLElement | null;
    const r = box.getBoundingClientRect();
    const bottom = last ? last.getBoundingClientRect().bottom : r.top;
    const LINE = 26;
    if (e.clientY < bottom + 4) return; // beside existing text — the browser handles it
    e.preventDefault();
    const lines = Math.floor((e.clientY - bottom) / LINE);
    const indent = Math.min(Math.max(0, Math.round((e.clientX - r.left) / 24) * 24), Math.max(0, r.width - 160));
    for (let i = 0; i < lines; i++) { const p = document.createElement('p'); p.innerHTML = '<br>'; box.appendChild(p); }
    const p = document.createElement('p'); p.innerHTML = '<br>';
    if (indent >= 24) p.style.marginLeft = `${indent}px`;
    box.appendChild(p);
    box.focus();
    caretIn(p);
    keepSel();
  };
  /** When you leave the page, drop empty lines left at the very end. */
  const onBlur = () => {
    keepSel();
    const box = ref.current;
    if (!box) return;
    let changed = false;
    while (box.lastElementChild && box.lastElementChild.tagName === 'P' && !box.lastElementChild.textContent?.trim() && !box.lastElementChild.querySelector('img,table') && box.lastElementChild.previousElementSibling?.tagName !== 'TABLE' && box.childElementCount > 1) { box.lastElementChild.remove(); changed = true; }
    if (changed) emit();
  };

  /** Tapping the box at the start of a checklist item ticks it. */
  const onClick = (e: React.MouseEvent) => {
    const li = (e.target as HTMLElement).closest('li');
    if (!li || !li.parentElement?.matches('ul[data-type="check"]')) return;
    const r = li.getBoundingClientRect();
    if (e.clientX - r.left < 30) { li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true'); e.preventDefault(); emit(); }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(k)) { e.preventDefault(); cmd(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline'); }
    if (e.key === 'Tab') { e.preventDefault(); if (!tabInTable(e.shiftKey)) cmd(e.shiftKey ? 'outdent' : 'indent'); }
    // new checklist items start unticked
    if (e.key === 'Enter') setTimeout(() => { ref.current?.querySelectorAll('ul[data-type="check"] > li:not([data-checked])').forEach((li) => li.setAttribute('data-checked', 'false')); }, 0);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) document.execCommand('insertHTML', false, sanitize(html));
    else document.execCommand('insertText', false, text);
    emit();
  };
  const addLink = () => {
    let url = linkUrl.trim();
    if (!url) return setLinkOpen(false);
    if (!/^(https?:|mailto:|tel:)/i.test(url)) url = `https://${url}`;
    cmd('createLink', url);
    setLinkOpen(false); setLinkUrl('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-1 bg-white/95 px-1 py-1.5 backdrop-blur-sm max-md:top-[calc(57px+env(safe-area-inset-top))]">
        <div className="seg !gap-0.5 items-center" role="toolbar" aria-label="Formatting">
          <B label="Bold (Ctrl+B)" onClick={() => cmd('bold')}><b>B</b></B>
          <B label="Italic (Ctrl+I)" onClick={() => cmd('italic')}><i className="font-serif">I</i></B>
          <B label="Underline (Ctrl+U)" onClick={() => cmd('underline')}><u>U</u></B>
          <B label="Strikethrough" onClick={() => cmd('strikeThrough')}><s>S</s></B>
          <B label="Highlight" active={hl} onClick={() => { keepSel(); setHl((h) => !h); }}><span className="rounded bg-[#fff3a3] px-1">A</span></B>
          <Sep />
          <B label="Heading 1" onClick={() => cmd('formatBlock', '<h1>')}><span className="text-[13px] font-bold">H1</span></B>
          <B label="Heading 2" onClick={() => cmd('formatBlock', '<h2>')}><span className="text-[13px] font-bold">H2</span></B>
          <B label="Normal text" onClick={() => cmd('formatBlock', '<p>')}><span className="text-[13px]">¶</span></B>
          <Sep />
          <B label="Bulleted list" onClick={() => cmd('insertUnorderedList')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg></B>
          <B label="Numbered list" onClick={() => cmd('insertOrderedList')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 1 1 2.5 1.2L3.5 18.5H6.5" /></svg></B>
          <B label="To-do checklist" onClick={checklist}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="6" height="6" rx="1.5" /><path d="M4.5 7l1 1 2-2M12 7h9M12 17h9" /><rect x="3" y="14" width="6" height="6" rx="1.5" /></svg></B>
          <B label="Quote" onClick={() => cmd('formatBlock', '<blockquote>')}><span className="font-serif text-[20px] leading-none">“</span></B>
          <B label="Insert table" active={tablePick} onClick={() => { keepSel(); setTablePick((t) => !t); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10M15 9.5v10" /></svg></B>
          <Sep />
          <B label="Link" active={linkOpen} onClick={() => { keepSel(); setLinkOpen((o) => !o); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg></B>
          <B label="Clear formatting" onClick={() => { cmd('removeFormat'); cmd('formatBlock', '<p>'); }}><span className="text-[13px] text-mute">Tx</span></B>
          <B label="Undo" onClick={() => cmd('undo')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 7L4.5 11.5 9 16M5 11.5h9a5 5 0 0 1 0 10h-2" /></svg></B>
          <B label="Redo" onClick={() => cmd('redo')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15 7l4.5 4.5L15 16M19 11.5h-9a5 5 0 0 0 0 10h2" /></svg></B>
        </div>
        {tablePick && (
          <div className="flex flex-wrap items-center gap-3 px-1">
            <div className="grid grid-cols-8 gap-[3px]" onMouseLeave={() => setHover([0, 0])} role="grid" aria-label="Choose table size">
              {Array.from({ length: 48 }, (_, k) => { const rr = Math.floor(k / 8) + 1, cc = (k % 8) + 1; const on = rr <= hover[0] && cc <= hover[1]; return (
                <button key={k} type="button" aria-label={`${rr} by ${cc} table`} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHover([rr, cc])} onFocus={() => setHover([rr, cc])} onClick={() => insertTable(rr, cc)}
                  className={`size-5 rounded-[4px] border ${on ? 'border-pri bg-pri-soft' : 'border-line bg-white'}`} />); })}
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] text-mute">
              <span>{hover[0] ? `${hover[0]} rows × ${hover[1]} columns` : 'Pick a size'}</span>
              <button type="button" className="btn btn-sm btn-soft" onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 3)}>Quick 3 × 3</button>
            </div>
          </div>
        )}
        {cell && (
          <div className="seg !gap-1 items-center px-1" role="toolbar" aria-label="Table">
            <span className="shrink-0 pr-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-faint">Table</span>
            {([['rowAbove', '+ Row above'], ['rowBelow', '+ Row below'], ['colLeft', '+ Col left'], ['colRight', '+ Col right'], ['header', 'Header row'], ['delRow', '− Row'], ['delCol', '− Column'], ['delTable', 'Delete table']] as const).map(([op, label]) => (
              <button key={op} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => tableOp(op)}
                className={`min-h-8 shrink-0 rounded-lg border px-2.5 text-[13px] ${op.startsWith('del') ? 'border-rose-soft text-rose-ink hover:bg-rose-soft' : 'border-line text-ink hover:bg-line-soft'}`}>{label}</button>
            ))}
          </div>
        )}
        {hl && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[13px] text-mute">Highlight</span>
            {HIGHLIGHTS.map((c) => (
              <button key={c} type="button" aria-label={c === 'transparent' ? 'No highlight' : `Highlight ${c}`} onMouseDown={(e) => e.preventDefault()}
                onClick={() => { cmd('hiliteColor', c); setHl(false); }}
                className="grid size-8 place-items-center rounded-full border border-line" style={{ background: c === 'transparent' ? 'white' : c }}>{c === 'transparent' && <span className="text-[13px] text-mute">✕</span>}</button>
            ))}
          </div>
        )}
        {linkOpen && (
          <div className="flex gap-2 px-1">
            <input className="input !min-h-9 py-1" autoFocus placeholder="Paste a link, e.g. example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } if (e.key === 'Escape') setLinkOpen(false); }} />
            <button type="button" className="btn btn-sm btn-soft" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>Add link</button>
          </div>
        )}
      </div>
      <div ref={ref} className="note-body min-h-[70dvh] flex-1 cursor-text py-2 pb-[30dvh] outline-none" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Page content"
        data-placeholder={placeholder} onInput={emit} onClick={onClick} onKeyDown={onKeyDown} onPaste={onPaste} onKeyUp={keepSel} onMouseUp={keepSel} onBlur={onBlur} onMouseDown={onMouseDown} />
      {len > PAGE_LIMIT * 0.8 && (
        <p className={`text-[13px] ${len > PAGE_LIMIT ? 'text-rose-ink' : 'text-amber-ink'}`} role="status">
          {len > PAGE_LIMIT ? 'This page is too long to save in one Google Sheets cell — move some of it to a new page.' : 'This page is getting long. Google Sheets holds about 50,000 characters per page.'}
        </p>
      )}
    </div>
  );
}
