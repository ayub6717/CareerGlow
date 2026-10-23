import { useEffect, useState, type ReactNode } from 'react';
import { useData } from '../../storage/DataContext';
import { go, useRoute } from '../../router';
import type { View } from '../../types';
import { Icon } from '../ui';
import { finance, reminderInfo } from '../../lib/calc';
import Overview from '../../features/overview/Overview';
import Goals from '../../features/goals/Goals';
import GoalDetail from '../../features/goals/GoalDetail';
import Tasks from '../../features/tasks/Tasks';
import Wallets from '../../features/money/Wallets';
import Budget from '../../features/money/Budget';
import Reminders from '../../features/reminders/Reminders';
import Jobs from '../../features/career/Jobs';
import Skills from '../../features/career/Skills';
import Content from '../../features/content/Content';
import Review from '../../features/review/Review';

const TITLES: Record<View, string> = {
  overview: 'Overview', goals: 'Goals & Plans', goal: 'Goal', tasks: 'Tasks', wallets: 'Wallets & Spending', budget: 'Budget Calculator',
  reminders: 'Reminders', jobs: 'Job Applications', skills: 'Skills & Learning', content: 'Content', review: 'Review',
};
type Group = 'money' | 'career';
const GROUP_OF: Partial<Record<View, Group>> = { wallets: 'money', budget: 'money', jobs: 'career', skills: 'career' };

/** onDisconnect is omitted in service-account mode, where there is no sign-in to leave. */
export default function AppShell({ onDisconnect }: { onDisconnect?: (forget: boolean) => void }) {
  const { loadState, loadError, reload, storage, db, warnings } = useData();
  const { view, param } = useRoute();
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<Record<Group, boolean>>({ money: true, career: true });
  const active: View = view === 'goal' ? 'goals' : view;
  const group = GROUP_OF[active];

  useEffect(() => { setMenu(false); }, [view]);
  useEffect(() => { if (group) setOpen((o) => ({ ...o, [group]: true })); }, [group]);

  const badge = db.reminders.filter((r) => { const g = reminderInfo(r).group; return g === 'overdue' || g === 'soon'; }).length;

  if (loadState === 'loading') {
    return <div className="grid min-h-dvh place-items-center" role="status"><div className="flex items-center gap-3 text-mute"><span className="size-5 animate-spin rounded-full border-2 border-pri-soft border-t-pri" />Loading your data from {storage.kind === 'google' ? 'Google Sheets' : 'demo'}…</div></div>;
  }
  if (loadState === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="card flex w-full max-w-[440px] flex-col gap-3">
          <h1 className="h2">Couldn’t load your data</h1>
          <p className="soft bg-rose-soft text-[15px] text-rose-ink" role="alert">{loadError}</p>
          <div className="flex flex-wrap gap-2"><button className="btn btn-primary" onClick={() => void reload()}>Try again</button>{onDisconnect && <><button className="btn btn-ghost" onClick={() => onDisconnect(false)}>Sign in again</button><button className="btn btn-quiet" onClick={() => onDisconnect(true)}>Choose another spreadsheet</button></>}</div>
        </div>
      </div>
    );
  }

  const NavItem = ({ v, icon, children, sub }: { v: View; icon?: string; children: ReactNode; sub?: boolean }) => (
    <button type="button" onClick={() => go(v)} aria-current={active === v ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-[10px] px-3 text-left font-medium transition-colors ${sub ? 'min-h-10 text-[15px]' : 'min-h-11'} ${active === v ? 'bg-pri-soft font-semibold text-pri-ink' : 'text-mute hover:bg-line-soft hover:text-ink'}`}>
      {icon && <Icon name={icon} />}{children}
      {v === 'reminders' && badge > 0 && <span className="ml-auto rounded-full bg-amber-soft px-2 text-[13px] text-amber-ink">{badge}</span>}
    </button>
  );
  const GroupHead = ({ g, icon, label }: { g: Group; icon: string; label: string }) => (
    <button type="button" aria-expanded={open[g]} onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
      className={`flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left font-medium hover:bg-line-soft ${group === g ? 'text-ink' : 'text-mute'}`}>
      <Icon name={icon} />{label}<Icon name="down" size={16} className={`ml-auto transition-transform ${open[g] ? 'rotate-180' : ''}`} />
    </button>
  );
  const Sub = ({ children }: { children: ReactNode }) => <div className="mb-1 ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l-[1.5px] border-line pl-3">{children}</div>;

  const navList = (
    <nav className="flex flex-col gap-0.5" aria-label="Sections">
      <NavItem v="overview" icon="home">Overview</NavItem>
      <NavItem v="goals" icon="target">Goals &amp; Plans</NavItem>
      <NavItem v="tasks" icon="check">Tasks</NavItem>
      <GroupHead g="money" icon="wallet" label="Money" />
      {open.money && <Sub><NavItem v="wallets" sub>Wallets &amp; Spending</NavItem><NavItem v="budget" sub>Budget Calculator</NavItem></Sub>}
      <NavItem v="reminders" icon="bell">Reminders</NavItem>
      <GroupHead g="career" icon="briefcase" label="Career" />
      {open.career && <Sub><NavItem v="jobs" sub>Job Applications</NavItem><NavItem v="skills" sub>Skills &amp; Learning</NavItem></Sub>}
      <NavItem v="content" icon="play">Content</NavItem>
      <NavItem v="review" icon="chart">Review</NavItem>
    </nav>
  );

  const page = (() => {
    switch (view) {
      case 'goals': return <Goals />;
      case 'goal': return <GoalDetail id={param} />;
      case 'tasks': return <Tasks />;
      case 'wallets': return <Wallets />;
      case 'budget': return <Budget />;
      case 'reminders': return <Reminders />;
      case 'jobs': return <Jobs />;
      case 'skills': return <Skills />;
      case 'content': return <Content />;
      case 'review': return <Review />;
      default: return <Overview />;
    }
  })();

  const fin = finance(db);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-white px-3.5 py-5 md:flex" aria-label="Main navigation">
        <Brand />
        {navList}
        <div className="mt-auto flex flex-col gap-2">
          <StorageBox onDisconnect={onDisconnect} />
          {fin.income === 0 && db.plannedExpenses.length === 0 && <button className="text-left text-[13px] text-pri-ink underline-offset-2 hover:underline" onClick={() => go('wallets')}>Set your monthly plan →</button>}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2.5 border-b border-line bg-white/95 py-2 pl-4 pr-2 pt-[calc(8px+env(safe-area-inset-top))] backdrop-blur-md md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/icon.svg" alt="" className="size-7" />
            <div className="min-w-0"><div className="text-[12px] leading-none text-mute">Blueprint</div><div className="truncate text-[17px] font-semibold leading-tight">{TITLES[view]}</div></div>
          </div>
          <div className="flex items-center"><SaveDot />{badge > 0 && <button className="icon-btn relative" aria-label={`${badge} reminders due`} onClick={() => go('reminders')}><Icon name="bell" size={22} /><span className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-white bg-amber" /></button>}</div>
        </header>

        <main className="mx-auto flex max-w-[1080px] flex-col gap-5 px-8 pb-16 pt-7 max-md:gap-4 max-md:px-4 max-md:pb-[calc(96px+env(safe-area-inset-bottom))] max-md:pt-3.5">
          {storage.kind === 'demo' && (
            <div className="soft flex flex-wrap items-center justify-between gap-2.5 bg-amber-soft/70 text-[15px]" role="note">
              <span><strong className="font-semibold">Demo mode.</strong> Sample data, nothing is saved.</span>
              {onDisconnect && <button className="btn btn-sm btn-ghost" onClick={() => onDisconnect(false)}>Connect Google Sheets</button>}
            </div>
          )}
          {warnings.map((w) => <div key={w} className="soft bg-amber-soft/70 text-[14px]">{w}</div>)}
          <div className="hidden justify-end md:flex"><SaveStatus /></div>
          {page}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden" aria-label="Quick navigation">
        <Tab on={active === 'overview'} icon="home" label="Home" onClick={() => go('overview')} />
        <Tab on={active === 'goals'} icon="target" label="Goals" onClick={() => go('goals')} />
        <Tab on={group === 'money'} icon="wallet" label="Money" onClick={() => go('wallets')} />
        <Tab on={group === 'career'} icon="briefcase" label="Career" onClick={() => go('jobs')} />
        <Tab on={menu || ['tasks', 'reminders', 'content', 'review'].includes(active)} icon="menu" label="More" onClick={() => setMenu(true)} />
      </nav>

      {menu && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/25 md:hidden" onClick={() => setMenu(false)}>
          <div role="dialog" aria-label="All sections" className="max-h-[86dvh] w-full overflow-y-auto rounded-t-[20px] bg-white px-3.5 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 mt-1 h-[5px] w-10 rounded-full bg-line" />
            {navList}
            <div className="mt-3 border-t border-line-soft pt-3"><StorageBox onDisconnect={onDisconnect} /></div>
          </div>
        </div>
      )}
      <Toasts />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <img src="/icon.svg" alt="" className="size-8" />
      <div><div className="font-display text-[21px] font-bold leading-none tracking-tight">Blueprint</div><div className="mt-1 text-[12px] text-mute">Plan it. Fund it. Finish it.</div></div>
    </div>
  );
}

function Tab({ on, icon, label, onClick }: { on: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} className={`flex min-h-[54px] flex-col items-center justify-center gap-[3px] rounded-xl text-[11.5px] font-medium ${on ? 'text-pri-ink' : 'text-mute'}`}>
      <span className={`grid h-7 w-12 place-items-center rounded-[10px] ${on ? 'bg-pri-soft' : ''}`}><Icon name={icon} size={22} /></span>{label}
    </button>
  );
}

function SaveStatus() {
  const { save, retrySave, storage } = useData();
  if (storage.kind === 'demo') return null;
  if (save.state === 'error') return <button className="btn btn-sm bg-rose-soft text-rose-ink" onClick={retrySave} title={save.error}>Not saved — Retry</button>;
  if (save.state === 'saving') return <span className="flex items-center gap-2 text-[13px] text-mute" role="status"><span className="size-3 animate-spin rounded-full border-2 border-pri-soft border-t-pri" />Saving…</span>;
  if (save.state === 'saved') return <span className="flex items-center gap-1.5 text-[13px] text-mint-ink" role="status"><span className="size-2 rounded-full bg-mint" />Saved to Google Sheets</span>;
  return null;
}
function SaveDot() {
  const { save, retrySave, storage } = useData();
  if (storage.kind === 'demo' || save.state === 'idle') return null;
  if (save.state === 'error') return <button className="btn btn-sm mr-1 bg-rose-soft text-rose-ink" onClick={retrySave}>Retry</button>;
  return <span className="mr-2 flex items-center gap-1.5 text-[12px] text-mute" role="status">{save.state === 'saving' ? <><span className="size-3 animate-spin rounded-full border-2 border-pri-soft border-t-pri" />Saving</> : <><span className="size-2 rounded-full bg-mint" />Saved</>}</span>;
}

function StorageBox({ onDisconnect }: { onDisconnect?: (forget: boolean) => void }) {
  const { storage, reload } = useData();
  return (
    <div className="rounded-xl bg-bg p-3 text-[13px] text-mute">
      <div className="mb-1.5 flex items-center gap-2 font-semibold text-ink"><Icon name="sheet" size={16} />{storage.kind === 'google' ? storage.label : 'Demo mode'}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {storage.openUrl && <a href={storage.openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center text-pri-ink hover:underline">Open sheet</a>}
        {storage.kind === 'google' && <button className="min-h-8 hover:text-ink" onClick={() => void reload()}>Refresh</button>}
        {onDisconnect && <button className="min-h-8 hover:text-ink" onClick={() => onDisconnect(false)}>{storage.kind === 'google' ? 'Sign out' : 'Exit demo'}</button>}
        {onDisconnect && storage.kind === 'google' && <button className="min-h-8 hover:text-ink" onClick={() => onDisconnect(true)}>Switch sheet</button>}
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts } = useData();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto max-w-[420px] rounded-xl px-4 py-2.5 text-[14px] shadow-[0_6px_24px_rgba(31,45,61,.12)] ${t.tone === 'error' ? 'bg-rose-soft text-rose-ink' : 'bg-white text-ink border border-line'}`}>{t.text}</div>
      ))}
    </div>
  );
}
