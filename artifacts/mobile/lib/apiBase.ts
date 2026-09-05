/**
 * Базовый URL API, собранный из EXPO_PUBLIC_DOMAIN с правильной схемой.
 *
 * Локальная разработка (localhost или адрес в приватной подсети — телефон
 * ходит на ПК по LAN) работает по http. Боевой домен — по https. Раньше схема
 * была жёстко https, и на устройстве в dev запросы к http-серверу на ПК не
 * проходили.
 */

import Constants from 'expo-constants';

function isLocalHost(domain: string): boolean {
  const host = domain.split(':')[0];
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local')
  );
}

/** Схема + домен, без завершающего слеша. */
export function apiOrigin(): string {
  let domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain && Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(':')[0];
    if (host) domain = `${host}:3000`;
  }
  if (!domain) return '';
  const scheme = isLocalHost(domain) ? 'http' : 'https';
  return `${scheme}://${domain}`;
}

/** origin + path. Если домен не задан — возвращает относительный path. */
export function apiUrl(path: string): string {
  const origin = apiOrigin();
  return origin ? `${origin}${path}` : path;
}
