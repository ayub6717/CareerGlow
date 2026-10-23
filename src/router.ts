import { useEffect, useState } from 'react';
import type { View } from './types';

const VIEWS: View[] = ['overview', 'goals', 'goal', 'tasks', 'wallets', 'budget', 'reminders', 'jobs', 'skills', 'content', 'review'];

function read(): { view: View; param: string } {
  const [, v, p] = window.location.hash.split('/');
  const view = (VIEWS as string[]).includes(v) ? (v as View) : 'overview';
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
