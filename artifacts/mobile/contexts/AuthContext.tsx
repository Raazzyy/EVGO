import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setAuthTokenGetter, setAuthRefreshHandler } from '@workspace/api-client-react';
import { clearTokens, loadTokens, saveTokens } from '@/lib/tokenStorage';
import { registerForPush } from '@/lib/push';

/**
 * Состояние входа пользователя.
 *
 * Токены живут и в состоянии React, и в защищённом хранилище: состояние нужно
 * для перерисовки экранов, хранилище — чтобы сессия пережила перезапуск.
 * Источником правды для сетевого слоя служит ref, а не состояние: `customFetch`
 * читает токен синхронно, и на замыкании со старым значением он бы отправлял
 * протухший токен ещё какое-то время после обновления.
 */

export interface AuthUser {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  language: string;
  membership_tier: string;
  [key: string]: unknown;
}

interface AuthContextValue {
  /** null — не вошёл; undefined во время первичной загрузки не используется */
  user: AuthUser | null;
  /** true, пока читаем токены из хранилища при старте приложения */
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (tokens: { accessToken: string; refreshToken: string }, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  /** Удаляет аккаунт на сервере и выходит. Возвращает false, если сервер не ответил. */
  deleteAccount: () => Promise<boolean>;
  /** Сохраняет профиль на сервере и обновляет локальное состояние. */
  updateProfile: (patch: { name?: string; email?: string; language?: string }) => Promise<void>;
  /** Меняет только локальное состояние, без запроса. */
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Запросы к /auth/* идут мимо сгенерированного клиента, поэтому база нужна здесь. */
function apiUrl(path: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);

  const applyTokens = useCallback(
    async (tokens: { accessToken: string; refreshToken: string } | null) => {
      accessRef.current = tokens?.accessToken ?? null;
      refreshRef.current = tokens?.refreshToken ?? null;
      if (tokens) await saveTokens(tokens);
      else await clearTokens();
    },
    [],
  );

  const signOut = useCallback(async () => {
    const refreshToken = refreshRef.current;

    // Гасим сессию на сервере, но локальный выход не должен зависеть от сети:
    // при обрыве связи человек всё равно обязан выйти из аккаунта.
    if (refreshToken) {
      try {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        // игнорируем — см. выше
      }
    }

    await applyTokens(null);
    setUser(null);
  }, [applyTokens]);

  const signIn = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }, nextUser: AuthUser) => {
      await applyTokens(tokens);
      setUser(nextUser);

      // Разрешение на уведомления спрашиваем здесь, а не при первом запуске:
      // человек только что вошёл, и понятно, зачем оно нужно. Не ждём ответа —
      // вход не должен зависеть от диалога с разрешением.
      void registerForPush(tokens.accessToken);
    },
    [applyTokens],
  );

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    let ok = false;
    try {
      const res = await fetch(apiUrl('/api/auth/me'), {
        method: 'DELETE',
        // Токен обязателен: эндпоинт определяет владельца только по нему.
        headers: { Authorization: `Bearer ${accessRef.current ?? ''}` },
      });
      ok = res.ok;
    } catch {
      // Сеть отвалилась — ниже всё равно выходим локально.
    }

    // Выходим в любом случае: человек попросил удалить аккаунт, оставлять его
    // внутри было бы хуже, чем разойтись с сервером на одну попытку.
    await signOut();
    return ok;
  }, [signOut]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const updateProfile = useCallback(
    async (patch: { name?: string; email?: string; language?: string }) => {
      const res = await fetch(apiUrl('/api/auth/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // Без токена сервер не знает, чей профиль правим, и вернёт 401.
          Authorization: `Bearer ${accessRef.current ?? ''}`,
        },
        body: JSON.stringify(patch),
      });

      if (!res.ok) throw new Error(`Профиль не сохранён: ${res.status}`);

      // Берём ответ сервера, а не то, что отправили: он мог нормализовать поля.
      setUser((await res.json()) as AuthUser);
    },
    [],
  );

  // Обновление пары токенов. Ходит обычным fetch, а не через customFetch:
  // иначе 401 от самого refresh снова позвал бы этот обработчик.
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const refreshToken = refreshRef.current;
    if (!refreshToken) return false;

    try {
      const res = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        // Refresh отозван или истёк — сессия закончилась по-настоящему.
        await applyTokens(null);
        setUser(null);
        return false;
      }

      const data = (await res.json()) as { access_token: string; refresh_token: string };
      await applyTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      return true;
    } catch {
      // Сеть отвалилась — сессию не трогаем, попробуем в следующий раз.
      return false;
    }
  }, [applyTokens]);

  // Регистрируем интеграцию с сетевым слоем один раз.
  useEffect(() => {
    setAuthTokenGetter(() => accessRef.current);
    setAuthRefreshHandler(refreshTokens);
    return () => {
      setAuthTokenGetter(null);
      setAuthRefreshHandler(null);
    };
  }, [refreshTokens]);

  // Восстановление сессии при запуске.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await loadTokens();
        if (!stored) return;

        accessRef.current = stored.accessToken;
        refreshRef.current = stored.refreshToken;

        // Проверяем токен и заодно получаем свежий профиль.
        const res = await fetch(apiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${stored.accessToken}` },
        });

        if (res.ok) {
          const me = (await res.json()) as AuthUser;
          if (!cancelled) setUser(me);
          // Токен устройства меняется при переустановке приложения —
          // обновляем его при каждом восстановлении сессии.
          void registerForPush(stored.accessToken);
          return;
        }

        if (res.status === 401) {
          // Access протух за время простоя — это норма, обновляемся.
          const ok = await refreshTokens();
          if (!ok || cancelled) return;

          const retry = await fetch(apiUrl('/api/auth/me'), {
            headers: { Authorization: `Bearer ${accessRef.current}` },
          });
          if (retry.ok && !cancelled) setUser((await retry.json()) as AuthUser);
        }
      } catch {
        // Нет сети при запуске — остаёмся не вошедшими, войдёт позже.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTokens]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        signIn,
        signOut,
        deleteAccount,
        updateProfile,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
