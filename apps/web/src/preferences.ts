import { useEffect, useState } from 'react';
import { browserLocale, type Locale } from './i18n.ts';

export interface Preferences { locale: Locale; theme: 'system' | 'paper' | 'ink'; reduceMotion: boolean }
const storageKey = 'playlist-avatar.preferences.v1';
function read(): Preferences {
  const defaults: Preferences = { locale: browserLocale(), theme: 'system', reduceMotion: false };
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { locale: ['en', 'zh-CN'].includes(value.locale) ? value.locale : defaults.locale,
      theme: ['system', 'paper', 'ink'].includes(value.theme) ? value.theme : defaults.theme,
      reduceMotion: value.reduceMotion === true };
  } catch { return defaults; }
}
export function usePreferences() {
  const [preferences, setPreferences] = useState(read);
  const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      document.documentElement.dataset.theme = preferences.theme === 'system' ? (query.matches ? 'ink' : 'paper') : preferences.theme;
      document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion||motion.matches);
      document.documentElement.lang = preferences.locale;
    };
    const motionChanged=()=>{setSystemReduced(motion.matches);apply();};apply(); query.addEventListener('change', apply);motion.addEventListener('change',motionChanged);
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {}
    return () => {query.removeEventListener('change', apply);motion.removeEventListener('change',motionChanged);};
  }, [preferences]);
  return [preferences, setPreferences,preferences.reduceMotion||systemReduced] as const;
}
