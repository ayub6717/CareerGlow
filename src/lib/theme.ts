import { useEffect, useState } from 'react';

/** 'system' follows the phone / computer setting. Remembered in this browser only. */
export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'lifenest.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readTheme(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' || v === 'system' ? v : 'light'; } catch { return 'light'; }
}
export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10151c' : '#F5F7FA');
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readTheme);
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const m = media(); const h = () => applyTheme('system');
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, [pref]);
  const set = (p: ThemePref) => { setPref(p); try { localStorage.setItem(KEY, p); } catch { /* private mode */ } };
  return [pref, set];
}
