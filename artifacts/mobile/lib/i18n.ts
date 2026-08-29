import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';
import en from '@/locales/en.json';

/**
 * Локализация приложения.
 *
 * Языки: узбекский (латиница), русский, английский. Русский — запасной:
 * на нём написаны все исходные строки, и если перевод где-то не завезли,
 * пользователь увидит осмысленный текст, а не ключ.
 *
 * Порядок выбора языка при запуске:
 *   1. сохранённый выбор пользователя (он приоритетнее всего)
 *   2. язык системы, если мы его поддерживаем
 *   3. русский
 *
 * Выбор хранится и локально, и в профиле на сервере: локально — чтобы
 * применился мгновенно ещё до загрузки профиля, на сервере — чтобы
 * уведомления и SMS приходили на нужном языке.
 */

export const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

const STORAGE_KEY = '@ion_language';

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Язык устройства, если он среди поддерживаемых. */
function deviceLanguage(): Language | null {
  const tag = getLocales()[0]?.languageCode;
  return isSupportedLanguage(tag) ? tag : null;
}

void i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  // Синхронная инициализация нужна, чтобы первый кадр уже был переведён.
  // Сохранённый язык подхватывается сразу после — см. restoreLanguage().
  lng: deviceLanguage() ?? 'ru',
  fallbackLng: 'ru',
  interpolation: {
    // React сам экранирует значения — двойное экранирование ломает текст.
    escapeValue: false,
  },
  returnNull: false,
});

/** Читает сохранённый выбор языка и применяет его. Вызывается при старте. */
export async function restoreLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (isSupportedLanguage(saved) && saved !== i18n.language) {
      await i18n.changeLanguage(saved);
    }
  } catch {
    // Хранилище недоступно — остаёмся на языке системы.
  }
}

/** Меняет язык и запоминает выбор. */
export async function setLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Не сохранилось — язык всё равно сменится на текущую сессию.
  }
}

export function currentLanguage(): Language {
  return isSupportedLanguage(i18n.language) ? i18n.language : 'ru';
}

export default i18n;
