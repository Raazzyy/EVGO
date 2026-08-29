import type { TFunction } from 'i18next';
import { AuthApiError } from '@/lib/authApi';

/**
 * Переводит ошибку авторизации в сообщение на языке интерфейса.
 *
 * Сервер отвечает кодом (`code_invalid`, `too_soon`, …) и текстом на русском.
 * Переводим по коду; серверный текст используется только для кодов, которых
 * мы не знаем — тогда лучше показать хоть что-то осмысленное, чем «Ошибка».
 */
export function authErrorMessage(err: unknown, t: TFunction): string {
  if (!(err instanceof AuthApiError)) return t('common.error');

  const KEYS: Record<string, string> = {
    network: 'errors.network',
    invalid_phone: 'errors.invalidPhone',
    code_expired: 'errors.codeExpired',
    code_invalid: 'errors.codeInvalid',
    too_many_attempts: 'errors.tooManyAttempts',
    too_soon: 'errors.tooSoon',
    hourly_limit: 'errors.hourlyLimit',
    sms_failed: 'errors.smsFailed',
    refresh_invalid: 'errors.sessionExpired',
  };

  const key = KEYS[err.code];
  return key ? t(key) : err.message;
}
