import { useEffect, useState } from 'react';
import type { View } from './types';

const VIEWS: View[] = [
  'overview', 'goals', 'goal', 'tasks', 'wallets', 'budget', 'reminders', 'jobs', 'skills', 'content', 'review',
  'money', 'money-cat', 'money-add', 'money-edit', 'categories', 'accounts', 'account', 'transfers', 'transfer', 'plan', 'notes',
];

function read(): { view: View; param: string } {
  const [, v, p] = window.location.hash.split('/');
  const view = v === 'wallets' ? 'money' : (VIEWS as string[]).includes(v) ? (v as View) : 'overview'; // old link → new Spending page
  return { view, param: decodeURIComponent(p ?? '') };
}

export function useRoute() {
  const [r, setR] = useState(read);
  useEffect(() => {
    const h = () => { setR(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}
export const go = (view: View, param?: string): void => { window.location.hash = `/${view}${param ? `/${encodeURIComponent(param)}` : ''}`; };
