import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  localStorage.setItem('spa-theme', theme);
}

/** 应用初始主题（在应用渲染前调用，避免闪烁）。默认跟随系统。 */
export function initTheme() {
  const saved = localStorage.getItem('spa-theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') { apply(saved); return; }
  // 无保存偏好 → 跟随系统
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  apply(prefersDark ? 'dark' : 'light');
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: (() => {
    const saved = localStorage.getItem('spa-theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  })(),
  setTheme: (t) => { apply(t); set({ theme: t }); },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    apply(next);
    set({ theme: next });
  },
}));
