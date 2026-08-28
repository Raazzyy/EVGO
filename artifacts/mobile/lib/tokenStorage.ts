import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Хранилище токенов авторизации.
 *
 * На устройстве — expo-secure-store: Keychain на iOS, EncryptedSharedPreferences
 * на Android. На вебе SecureStore не работает вообще, поэтому там localStorage —
 * защиты он не даёт, но веб-версия и так живёт в песочнице браузера.
 *
 * Ключи вынесены в константы: опечатка в строке привела бы к тихому разлогину
 * без единой ошибки в логе.
 */

const ACCESS_KEY = 'ion.auth.access';
const REFRESH_KEY = 'ion.auth.refresh';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Приватный режим и заблокированные куки — не повод падать,
      // сессия просто не переживёт перезагрузку страницы.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // см. выше
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, tokens.accessToken),
    setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);

  // Половина пары бесполезна: без refresh нечем продлить сессию,
  // без access всё равно придётся его получать.
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
}
