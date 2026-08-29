import type { AuthUser } from '@/contexts/AuthContext';

/**
 * Клиент к /api/auth/*.
 *
 * Написан вручную, а не сгенерирован из OpenAPI: сгенерированный клиент
 * подставляет токен и обрабатывает 401 обновлением пары — здесь это лишнее
 * и приводило бы к рекурсии. Эндпоинты описаны в openapi.yaml для документации.
 */

function apiUrl(path: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

/**
 * Ошибка с кодом и подсказками от сервера.
 *
 * Текст с сервера приходит на русском — показывать его напрямую нельзя,
 * иначе узбекский интерфейс выдаёт русские сообщения. Экран переводит
 * ошибку по `code`, а серверный текст остаётся запасным вариантом для
 * незнакомых кодов.
 */
export class AuthApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly attemptsLeft?: number;

  constructor(
    status: number,
    body: {
      error?: string;
      code?: string;
      retry_after_seconds?: number;
      attempts_left?: number;
    },
  ) {
    super(body.error ?? 'Не удалось выполнить запрос');
    this.status = status;
    this.code = body.code ?? 'unknown';
    this.retryAfterSeconds = body.retry_after_seconds;
    this.attemptsLeft = body.attempts_left;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError(0, {
      error: 'Нет связи с сервером. Проверьте интернет',
      code: 'network',
    });
  }

  if (!res.ok) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (await res.json()) as Record<string, unknown>;
    } catch {
      // Сервер ответил не-JSON — оставляем сообщение по умолчанию.
    }
    throw new AuthApiError(res.status, parsed);
  }

  return (await res.json()) as T;
}

export interface RequestCodeResult {
  sent: boolean;
  expires_in_seconds: number;
  resend_after_seconds: number;
}

export function requestCode(phone: string): Promise<RequestCodeResult> {
  return post<RequestCodeResult>('/api/auth/request-code', { phone });
}

export interface VerifyCodeResult {
  access_token: string;
  refresh_token: string;
  expires_in_seconds: number;
  is_new_user: boolean;
  user: AuthUser;
}

export function verifyCode(
  phone: string,
  code: string,
  device?: string,
): Promise<VerifyCodeResult> {
  return post<VerifyCodeResult>('/api/auth/verify-code', { phone, code, device });
}
