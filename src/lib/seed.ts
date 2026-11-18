import { catId, defaultCategories } from '../features/money/money';
import type { DB, Subtopic, Topic } from '../types';
import { emptyDB } from '../storage/schema';
import { addDays, nowIdx, nowIso, uid, ymOf } from './format';

/** Example .NET outline — used for demo mode and the “add example outline” button. */
export const DOTNET_OUTLINE: { name: string; subs: string[] }[] = [
  { name: 'C# Fundamentals', subs: ['Variables and Data Types', 'Conditions and Loops', 'Methods', 'Object-Oriented Programming'] },
  { name: 'ASP.NET Core', subs: ['Routing', 'Controllers', 'Dependency Injection', 'Middleware'] },
  { name: 'Entity Framework Core', subs: ['Database Context', 'Migrations', 'CRUD Operations'] },
  { name: 'Web API Development', subs: ['REST APIs', 'Authentication', 'Validation', 'Error Handling'] },
];

export function outlineRows(skillId: string, outline: { name: string; subs: string[] }[], startOrder = 0, doneMap: number[] = []) {
  const topics: Topic[] = [], subtopics: Subtopic[] = [];
  outline.forEach((t, i) => {
    const topicId = uid();
    topics.push({ id: topicId, skillId, name: t.name, done: false, order: startOrder + i });
    t.subs.forEach((s, j) => subtopics.push({ id: uid(), topicId, skillId, name: s, done: j < (doneMap[i] ?? 0), order: j }));
  });
  return { topics, subtopics };
}

/** Sample data for demo mode only. Never written to Google Sheets. */
export function demoDB(): DB {
  const db = emptyDB();
  const n = nowIdx(), ym = (k: number) => ymOf(n + k), at = nowIso();
  const g1 = uid(), g2 = uid(), g3 = uid(), t1 = uid(), t2 = uid();
  db.settings = [
    { id: 'income', value: '150000' }, { id: 'inflation', value: '6' }, { id: 'weeklyHours', value: '20' },
    { id: 'emMonths', value: '6' }, { id: 'emSaved', value: '200000' }, { id: 'emMonthly', value: '10000' },
  ];
  db.plannedExpenses = [['Rent', 25000], ['Food & groceries', 20000], ['Utilities & internet', 6000], ['Transport', 6000], ['Family support', 10000], ['Child care & school', 8000], ['Other', 10000]]
    .map(([label, amount], order) => ({ id: uid(), label: String(label), amount: Number(amount), order }));
  db.goals = [
    { id: g1, name: 'Grow freelance income', area: 'Career', state: 'active', start: ym(0), due: ym(8), focus: true, useBudget: false, useTime: true, saved: 0, monthly: 0, running: 0, hoursEst: 120, weekly: 6, deps: [], why: '', risk: '', resources: '', createdAt: at },
    { id: g2, name: 'Family car', area: 'Car', state: 'active', start: ym(0), due: ym(20), focus: true, useBudget: true, useTime: false, saved: 350000, monthly: 35000, running: 18000, hoursEst: 0, weekly: 0, deps: [g1], why: '', risk: '', resources: '', createdAt: at },
    { id: g3, name: 'Village house', area: 'House', state: 'active', start: ym(0), due: ym(50), focus: false, useBudget: true, useTime: false, saved: 600000, monthly: 15000, running: 3000, hoursEst: 0, weekly: 0, deps: [], why: '', risk: '', resources: '', createdAt: at },
  ];
  db.goalItems = [
    { id: uid(), goalId: g2, label: 'Car price', amount: 1800000, order: 0 }, { id: uid(), goalId: g2, label: 'Registration & road tax', amount: 120000, order: 1 },
    { id: uid(), goalId: g3, label: 'Construction', amount: 4000000, order: 0 }, { id: uid(), goalId: g3, label: 'Interior & furniture', amount: 500000, order: 1 },
  ];
  db.milestones = [
    ...['Refresh portfolio site', 'Define one clear offer', 'Send 20 proposals', 'Land 2 repeat clients'].map((text, order) => ({ id: uid(), goalId: g1, text, done: false, order })),
    ...['Fix budget and shortlist 3 models', 'Build the full fund', 'Get driving license', 'Test drive and buy'].map((text, order) => ({ id: uid(), goalId: g2, text, done: order === 0, order })),
    ...['Verify land documents', 'Engineer and design', 'Contractor estimates', 'Build'].map((text, order) => ({ id: uid(), goalId: g3, text, done: false, order })),
  ];
  db.timeLog = [{ id: uid(), goalId: g1, date: addDays(-2), hours: 3 }];
  db.tasks = [
    { id: t1, title: 'Refresh portfolio with 2 case studies', goalId: g1, status: 'doing', priority: 'High', due: addDays(0), hours: 8, dependsOn: '', blocked: false, doneAt: '', createdAt: at },
    { id: t2, title: 'Write a one-page freelance offer', goalId: g1, status: 'todo', priority: 'High', due: addDays(4), hours: 3, dependsOn: t1, blocked: false, doneAt: '', createdAt: at },
    { id: uid(), title: 'Compare 3 car models', goalId: g2, status: 'todo', priority: 'Low', due: addDays(20), hours: 2, dependsOn: '', blocked: false, doneAt: '', createdAt: at },
    { id: uid(), title: 'Ask about land papers', goalId: g3, status: 'done', priority: 'Med', due: addDays(-3), hours: 1, dependsOn: '', blocked: false, doneAt: addDays(-2), createdAt: at },
  ];
  db.wallets = [
    { id: 'w1', name: 'Bank account', kind: 'Bank', opening: 250000, order: 0, icon: 'landmark', color: '#7C97DD', hidden: false },
    { id: 'w2', name: 'bKash', kind: 'Mobile wallet', opening: 8000, order: 1, icon: 'smartphone', color: '#E58E9E', hidden: false },
    { id: 'w3', name: 'Cash', kind: 'Cash', opening: 5000, order: 2, icon: 'banknote', color: '#6DBE9A', hidden: false },
    { id: 'w4', name: 'To lend', kind: 'Cash', opening: 5000, order: 3, icon: 'hand-coins', color: '#E3A867', hidden: true },
  ];
  const T = (days: number, kind: 'out' | 'in', cat: string, amount: number, walletId: string, desc = '', tags: string[] = []) =>
    ({ id: uid(), date: addDays(days), desc, amount, kind, category: cat, walletId, toWalletId: '', createdAt: at, categoryId: catId(kind, cat), tags });
  db.txns = [
    T(0, 'out', 'Bike', 1150, 'w2', 'Grip', ['bike']), T(0, 'out', 'Bike', 50, 'w3', 'Grip setup', ['bike']), T(0, 'out', 'Bazaar', 940, 'w3', 'Weekly vegetables'), T(0, 'out', 'Cafe', 20, 'w3', 'Tea'),
    T(-1, 'out', 'Office meal', 180, 'w3'), T(-1, 'out', 'Recharge', 299, 'w2', 'Internet pack'), T(-2, 'out', 'Fruits', 360, 'w3'), T(-3, 'out', 'Transport', 900, 'w3', 'Rickshaw & CNG'),
    T(-4, 'out', 'Internet', 1500, 'w2', 'Home WiFi'), T(-6, 'out', 'Bazaar', 6500, 'w1', 'Monthly groceries'), T(-8, 'out', 'Medicine', 640, 'w3'), T(-10, 'out', 'Electricity', 1850, 'w2'),
    T(-12, 'out', 'Baby', 2200, 'w1', 'Clothes'), T(-15, 'out', 'Rent', 18000, 'w1'), T(-15, 'in', 'Salary', 120000, 'w1', 'Monthly salary'), T(-5, 'in', 'Outsourcing', 15000, 'w2', 'Landing page'),
    { id: uid(), date: addDays(-2), desc: 'Top up bKash', amount: 5000, kind: 'move', category: '', walletId: 'w1', toWalletId: 'w2', createdAt: at, categoryId: '', tags: [] },
  ];
  db.categories = defaultCategories(db.txns);
  db.notebooks = [{ id: 'nb1', name: 'Personal', color: '#7C97DD', order: 0, createdAt: at }, { id: 'nb2', name: 'Work', color: '#6DBE9A', order: 1, createdAt: at }];
  db.noteSections = [
    { id: 'ns1', notebookId: 'nb1', name: 'Quick Notes', color: '#E3A867', order: 0 },
    { id: 'ns2', notebookId: 'nb1', name: 'Germany plan', color: '#A08ADB', order: 1 },
    { id: 'ns3', notebookId: 'nb2', name: 'Meetings', color: '#64B5C4', order: 0 },
  ];
  db.notePages = [
    { id: 'np1', sectionId: 'ns1', notebookId: 'nb1', title: 'Weekend to-do', body: '<p>Things to finish before Sunday:</p><ul data-type="check"><li data-checked="true">Pay internet bill</li><li data-checked="false">Bike servicing</li><li data-checked="false">Buy diapers</li></ul>', level: 0, order: 0, createdAt: at, updatedAt: at },
    { id: 'np2', sectionId: 'ns1', notebookId: 'nb1', title: 'Book ideas', body: '<h2>To read</h2><ul><li><b>Atomic Habits</b></li><li>Deep Work</li></ul><p>Note: <span style="background-color: rgb(255, 243, 163)">ask Rahim for his copy</span>.</p>', level: 0, order: 1, createdAt: at, updatedAt: at },
    { id: 'np3', sectionId: 'ns2', notebookId: 'nb1', title: 'Documents needed', body: '<ol><li>Transcript</li><li>IELTS</li><li>APS / VPD</li></ol>', level: 0, order: 0, createdAt: at, updatedAt: at },
    { id: 'np4', sectionId: 'ns3', notebookId: 'nb2', title: 'Sprint planning', body: '<p>Action items go here.</p>', level: 0, order: 0, createdAt: at, updatedAt: at },
  ];
  const b1 = uid();
  db.budgets = [{ id: b1, name: 'Gadgets', order: 0 }];
  db.budgetLines = [{ id: uid(), budgetId: b1, label: 'Laptop', amount: '120k', order: 0 }, { id: uid(), budgetId: b1, label: 'Mobile', amount: '110k', order: 1 }];
  db.reminders = [
    { id: uid(), title: 'Internet bill', date: addDays(3), kind: 'Bill', repeat: 'monthly', amount: 1500, walletId: 'w2', leadDays: 3, lastDone: '', done: false },
    { id: uid(), title: 'Income tax return (check the deadline)', date: '2026-11-30', kind: 'Tax', repeat: 'yearly', amount: 0, walletId: 'w1', leadDays: 30, lastDone: '', done: false },
  ];
  db.jobs = [
    { id: uid(), company: 'Sample: Remote SaaS startup', title: 'Senior Frontend Engineer', url: '', appliedDate: addDays(-19), status: 'applied', notes: '', createdAt: at, updatedAt: at },
    { id: uid(), company: 'Sample: Local fintech', title: 'Frontend Lead', url: '', appliedDate: addDays(-9), status: 'interviewing', notes: 'Second round next week', createdAt: at, updatedAt: at },
    { id: uid(), company: 'Sample: Product agency', title: 'React Developer', url: '', appliedDate: addDays(-4), status: 'assessment', notes: 'Take-home task due Friday', createdAt: at, updatedAt: at },
    { id: uid(), company: 'Sample: E-commerce company', title: 'Full-stack Engineer (.NET + React)', url: '', appliedDate: '', status: 'toapply', notes: '', createdAt: at, updatedAt: at },
  ];
  const sk = uid();
  db.skills = [{ id: sk, name: '.NET', why: 'Move into full-stack roles', project: 'Booking API with ASP.NET Core + EF Core', order: 0, createdAt: at }];
  const o = outlineRows(sk, DOTNET_OUTLINE, 0, [3, 1, 0, 0]);
  db.topics = o.topics;
  db.subtopics = o.subtopics;
  db.content = [
    { id: uid(), title: 'Why I plan my life like a project', platform: 'LinkedIn', stage: 'Script', date: addDays(5), views: 0 },
    { id: uid(), title: 'React performance in 10 minutes', platform: 'YouTube', stage: 'Idea', date: '', views: 0 },
  ];
  db.counters = [
    { id: uid(), label: 'Problems solved', value: 40, target: 150 },
    { id: uid(), label: 'GitHub contributions', value: 120, target: 300 },
    { id: uid(), label: 'Portfolio projects', value: 2, target: 5 },
  ];
  return db;
}
