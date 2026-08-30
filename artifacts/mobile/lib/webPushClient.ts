import { Platform } from 'react-native';

/**
 * Клиент веб-push (задача 58) — только для веб-версии.
 *
 * На нативе и там, где браузер не умеет Service Worker / Push, — no-op.
 * Включение требует двух вещей на сервере: заданных VAPID-ключей (иначе
 * /config вернёт пустой ключ и подписка не создаётся) и файла sw.js в корне
 * веб-сборки (лежит в artifacts/mobile/public/sw.js).
 *
 * Вызывать после входа: registerWebPush(getAccessToken).
 */

function apiUrl(path: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

// base64url → Uint8Array (формат ключа applicationServerKey).
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerWebPush(getToken: () => string | null): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    // Публичный VAPID-ключ с сервера. Пусто — веб-push не настроен.
    const cfg = await fetch(apiUrl('/api/config')).then((r) => r.json()).catch(() => null);
    const vapid: string = cfg?.vapid_public_key ?? '';
    if (!vapid) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await navigator.serviceWorker.register('/sw.js');
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Приведение типа: разные версии lib.dom расходятся в типе BufferSource
      // (ArrayBuffer vs ArrayBufferLike). Значение корректно в рантайме.
      applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
    });

    const token = getToken();
    if (!token) return false;

    const res = await fetch(apiUrl('/api/web-push/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
