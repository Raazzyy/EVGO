import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Выбор темы приложения.
 *
 * Три режима: 'system' — как в телефоне (по умолчанию), 'light', 'dark'.
 * Выбор хранится на устройстве и переживает перезапуск. `scheme` — итоговая
 * тема с учётом выбора; её читает useColors, поэтому смена применяется сразу
 * ко всему приложению.
 */

export type ThemePref = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

const STORAGE_KEY = '@evgo_theme';

interface ThemeContextValue {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  scheme: Scheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); })
      .catch(() => {});
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  return (
    <ThemeContext.Provider value={{ pref, setPref, scheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Итоговая тема. Работает и без провайдера (падает на системную) — чтобы
 * useColors никогда не ломался, даже если вызван вне дерева провайдера.
 */
export function useThemeScheme(): Scheme {
  const ctx = useContext(ThemeContext);
  const system = useColorScheme();
  if (ctx) return ctx.scheme;
  return system === 'dark' ? 'dark' : 'light';
}

/** Выбор темы и сеттер — для экрана настроек. */
export function useThemePref(): { pref: ThemePref; setPref: (p: ThemePref) => void } {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { pref: 'system', setPref: () => {} };
  return { pref: ctx.pref, setPref: ctx.setPref };
}
