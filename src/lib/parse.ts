import type { Area } from '../types';

const BN = '০১২৩৪৫৬৭৮৯';
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

const MULT: Record<string, number> = {
  k: 1e3, hajar: 1e3, 'হাজার': 1e3, thousand: 1e3,
  l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, 'লাখ': 1e5, 'লক্ষ': 1e5,
  cr: 1e7, crore: 1e7, koti: 1e7, 'কোটি': 1e7, m: 1e6,
};

/** "120k" → 120000, "1.5 lakh" → 150000, "50k+5k" → 55000, Bangla digits ok. Empty → 0, unreadable → NaN. */
export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input;
  const t = toLatinDigits(String(input ?? '')).toLowerCase().replace(/৳|taka|tk|টাকা|,|\s/g, '');
  if (!t) return 0;
  let sum = 0;
  for (const part of t.split('+')) {
    const m = part.match(/^(\d*\.?\d+)([a-zঀ-৿]*)$/);
    if (!m) return NaN;
    const mult = m[2] ? MULT[m[2]] : 1;
    if (!mult) return NaN;
    sum += parseFloat(m[1]) * mult;
  }
  return sum;
}

/** "laptop: 120k" lines → [{label, amount}] */
export function parseBudgetLines(text: string): { label: string; amount: string }[] {
  return text.split(/\n+/).map((l) => l.trim().replace(/^[-*•\d.)\s]+(?=\D)/, '')).filter(Boolean).map((ln) => {
    const m = ln.match(/^(.*?)\s*[:=–—]\s*(.+)$/) || ln.match(/^(.*\S)\s+-\s+(.+)$/) || ln.match(/^(.*\S)\s+(\S+)$/);
    if (m && Number.isFinite(parseAmount(m[2]))) return { label: m[1].trim(), amount: m[2].trim() };
    return { label: ln, amount: '' };
  });
}

/** Outline → topics with subtopics. "- x" or indented lines are subtopics; "Topic: a, b" also works. */
export function parseOutline(text: string): { name: string; subs: string[] }[] {
  const out: { name: string; subs: string[] }[] = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    const isSub = /^(\s{2,}|\t|\s*[-*•–]\s)/.test(raw);
    const clean = raw.trim().replace(/^[-*•–]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!clean) continue;
    if (isSub && out.length) { out[out.length - 1].subs.push(clean); continue; }
    const m = clean.match(/^(.+?):\s*(.+)$/);
    if (m && m[2].includes(',')) out.push({ name: m[1].trim(), subs: m[2].split(',').map((x) => x.trim()).filter(Boolean) });
    else out.push({ name: clean, subs: [] });
  }
  return out;
}

export interface PlanDraft { area: Area; amount: number; months: number; monthsGiven: boolean; irregular: boolean; loan: boolean; name: string }

/** Rule-based plan reader (no AI): finds area, amount and timeframe in English or Bangla. */
export function parsePlan(text: string): PlanDraft {
  const t = toLatinDigits(text).toLowerCase();
  const has = (re: RegExp) => re.test(t);
  let area: Area = 'Other';
  if (has(/\bcar\b|gari|gaari|গাড়ি|গাড়ী|bike|motorcycle/)) area = 'Car';
  else if (has(/house|home|flat|apartment|land|jomi|bari|baari|বাড়ি|বাড়ী|ফ্ল্যাট|জমি/)) area = 'House';
  else if (has(/youtube|content|channel|video|vlog|কনটেন্ট|ভিডিও/)) area = 'Content';
  else if (has(/business|startup|saas|shop|dokan|ব্যবসা/)) area = 'Business';
  else if (has(/skill|learn|course|job|career|freelanc|interview|শেখা|চাকরি/)) area = 'Career';
  let amount = 0, months = 0;
  const re = /(\d[\d,]*(?:\.\d+)?)\s*([a-zঀ-৿]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const val = parseFloat(m[1].replace(/,/g, '')), w = m[2] || '';
    if (!Number.isFinite(val)) continue;
    if (/^(month|months|mo|mas|maas|মাস)/.test(w)) months = Math.round(val);
    else if (/^(year|years|yr|yrs|bochor|bosor|bochhor|বছর)/.test(w)) months = Math.round(val * 12);
    else if (/^(crore|cr|koti|কোটি)/.test(w)) amount = Math.max(amount, val * 1e7);
    else if (/^(lakh|lac|lakhs|lacs|l$|লাখ|লক্ষ)/.test(w)) amount = Math.max(amount, val * 1e5);
    else if (/^(k$|hajar|hazar|thousand|হাজার)/.test(w)) amount = Math.max(amount, val * 1e3);
    else if (val >= 1000) amount = Math.max(amount, val);
  }
  const names: Record<Area, string> = {
    Car: 'Buy a car', House: 'Build / buy a house', Content: 'Launch a content channel', Business: 'Start a business',
    Career: 'Level up my career', Learning: 'Learn something new', Family: 'Family plan', Other: has(/laptop|ল্যাপটপ/) ? 'Buy a laptop' : 'New plan',
  };
  return {
    area, amount: Math.round(amount), months: months || 12, monthsGiven: !!months,
    irregular: has(/irregular|oniyomito|oniomito|অনিয়মিত|unstable|not fixed/), loan: has(/loan|emi|rin|ঋণ|কিস্তি/), name: names[area],
  };
}

export const TEMPLATES: Record<Area, { ms: string[]; items: string[] }> = {
  Car: { ms: ['Fix budget and shortlist 3 models', 'Build the full fund', 'Get driving license', 'Compare showrooms and test drive', 'Buy and register'], items: ['Car price', 'Registration & road tax', 'Insurance (first year)'] },
  House: { ms: ['Verify land / property documents', 'Engineer and design', 'Get 2–3 contractor estimates', 'Arrange the funding', 'Build or buy', 'Finishing and move-in'], items: ['Main cost', 'Land & document verification', 'Interior & furniture'] },
  Content: { ms: ['Pick a niche and list 10 ideas', 'Set up gear', 'Record 3 pilot pieces', 'Publish weekly for 8 weeks', 'Review what worked'], items: ['Camera & mic', 'Lighting', 'Editing software (1 year)'] },
  Business: { ms: ['Talk to 10 potential customers', 'Build the smallest version', 'Get the first paying customer', 'Launch publicly'], items: ['Setup & equipment', 'Trade license & registration', 'Working capital (3 months)'] },
  Career: { ms: ['Pick the skill and a real project', 'Learn the basics', 'Build the project', 'Publish it in the portfolio', 'Apply / pitch with it'], items: ['Course or book'] },
  Learning: { ms: ['Pick a course', 'Finish the basics', 'Build something with it'], items: ['Course or book'] },
  Family: { ms: ['Agree on the plan', 'Set the budget', 'Book and prepare'], items: ['Main cost'] },
  Other: { ms: ['Define what “done” looks like', 'Set the budget', 'Do the first concrete step', 'Review and finish'], items: ['Main cost'] },
};

export const FORGOTTEN_COSTS: Record<Area, string[]> = {
  Car: ['Registration & road tax', 'Insurance (first year)', 'Fuel & servicing (first year)', 'Parking / garage'],
  House: ['Land & document verification', 'Engineer / design fee', 'Interior & furniture', 'Utility connections', 'Boundary wall & gate'],
  Content: ['Camera & mic', 'Lighting', 'Editing software (1 year)', 'Promotion budget'],
  Business: ['Trade license & registration', 'Setup & equipment', 'Working capital (3 months)', 'Launch marketing'],
  Career: ['Course or book', 'Certification fee'],
  Learning: ['Course or book', 'Exam fee'],
  Family: ['Travel & logistics', 'Gifts & extras'],
  Other: [],
};
