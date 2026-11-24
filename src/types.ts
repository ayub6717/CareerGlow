// ---------- Entity types (one per worksheet) ----------

export type Area = 'Car' | 'House' | 'Career' | 'Content' | 'Business' | 'Learning' | 'Family' | 'Other';
export type GoalState = 'active' | 'paused' | 'done';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'High' | 'Med' | 'Low';
export type TxnKind = 'out' | 'in' | 'move';
export type WalletKind = 'Bank' | 'Mobile wallet' | 'Cash' | 'Card' | 'Savings';
export type ReminderKind = 'Bill' | 'Tax' | 'Birthday' | 'Anniversary' | 'Renewal' | 'Event' | 'Other';
export type Repeat = 'none' | 'monthly' | 'yearly';
export type JobStatus =
  | 'toapply'
  | 'applied'
  | 'interviewing'
  | 'assessment'
  | 'offer'
  | 'rejected'
  | 'noresponse'
  | 'withdrawn';
export type ContentStage = 'Idea' | 'Research' | 'Script' | 'Production' | 'Published';

export interface Setting { id: string; value: string }
export interface PlannedExpense { id: string; label: string; amount: number; order: number }
export interface Goal {
  id: string; name: string; area: Area; state: GoalState; start: string; due: string;
  focus: boolean; useBudget: boolean; useTime: boolean; saved: number; monthly: number; running: number;
  hoursEst: number; weekly: number; deps: string[]; why: string; risk: string; resources: string; createdAt: string;
}
export interface GoalItem { id: string; goalId: string; label: string; amount: number; order: number }
export interface Milestone { id: string; goalId: string; text: string; done: boolean; order: number }
export interface Deposit { id: string; goalId: string; date: string; amount: number }
export interface TimeLog { id: string; goalId: string; date: string; hours: number }
export interface Task {
  id: string; title: string; goalId: string; status: TaskStatus; priority: Priority; due: string;
  hours: number; dependsOn: string; blocked: boolean; doneAt: string; createdAt: string;
}
/** An account (bank, bKash, cash…). `hidden` = not counted in the total balance. */
export interface Wallet { id: string; name: string; kind: WalletKind; opening: number; order: number; icon: string; color: string; hidden: boolean }
export type CatKind = 'out' | 'in';
export interface Category { id: string; name: string; kind: CatKind; icon: string; color: string; order: number }
export interface Txn {
  id: string; date: string; desc: string; amount: number; kind: TxnKind; category: string;
  walletId: string; toWalletId: string; createdAt: string;
  /** Categories.id — `category` keeps the name too so the sheet stays readable */
  categoryId: string; tags: string[];
}
export interface Budget { id: string; name: string; order: number }
/** `done` = already spent / closed: still shown (struck through) but not counted in the total. */
export interface BudgetLine { id: string; budgetId: string; label: string; amount: string; order: number; done: boolean }
export interface Reminder {
  id: string; title: string; date: string; kind: ReminderKind; repeat: Repeat; amount: number;
  walletId: string; leadDays: number; lastDone: string; done: boolean;
}
export interface Job {
  id: string; company: string; title: string; url: string; appliedDate: string; status: JobStatus;
  notes: string; createdAt: string; updatedAt: string;
}
export interface Skill { id: string; name: string; why: string; project: string; order: number; createdAt: string }
export interface Topic { id: string; skillId: string; name: string; done: boolean; order: number }
export interface Subtopic { id: string; topicId: string; skillId: string; name: string; done: boolean; order: number }
export interface ContentItem { id: string; title: string; platform: string; stage: ContentStage; date: string; views: number }
export interface Decision { id: string; date: string; title: string; why: string; expect: string; reviewDate: string; outcome: string }
export interface Counter { id: string; label: string; value: number; target: number }

// ---------- Notes (OneNote style: notebook → section → page) ----------
export interface Notebook { id: string; name: string; color: string; order: number; createdAt: string }
export interface NoteSection { id: string; notebookId: string; name: string; color: string; order: number }
/** `body` is sanitised HTML. `level` 1 = subpage (indented under the page above it). */
export interface NotePage { id: string; sectionId: string; notebookId: string; title: string; body: string; level: number; order: number; createdAt: string; updatedAt: string }

export interface Tables {
  settings: Setting;
  plannedExpenses: PlannedExpense;
  goals: Goal;
  goalItems: GoalItem;
  milestones: Milestone;
  deposits: Deposit;
  timeLog: TimeLog;
  tasks: Task;
  wallets: Wallet;
  txns: Txn;
  categories: Category;
  budgets: Budget;
  budgetLines: BudgetLine;
  reminders: Reminder;
  jobs: Job;
  skills: Skill;
  topics: Topic;
  subtopics: Subtopic;
  content: ContentItem;
  decisions: Decision;
  counters: Counter;
  notebooks: Notebook;
  noteSections: NoteSection;
  notePages: NotePage;
}
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];
export type DB = { [K in TableName]: Tables[K][] };

export type View =
  | 'overview' | 'goals' | 'goal' | 'tasks' | 'wallets' | 'budget' | 'reminders'
  | 'money' | 'money-cat' | 'money-add' | 'money-edit' | 'categories' | 'accounts' | 'account' | 'transfers' | 'transfer' | 'plan' | 'notes'
  | 'jobs' | 'skills' | 'content' | 'review';
