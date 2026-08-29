import i18n from '@/lib/i18n';

/**
 * Форматирование чисел, денег и дат под текущий язык интерфейса.
 *
 * Раньше по всему приложению стояло `toLocaleString('ru-RU')` и слово «сум»
 * прямо в разметке — при переключении на узбекский суммы оставались с русской
 * подписью. Локаль и подпись берутся из i18n.
 */

/** Локаль для Intl. Узбекская латиница — `uz-Latn-UZ`, иначе Intl берёт кириллицу. */
function locale(): string {
  switch (i18n.language) {
    case 'uz':
      return 'uz-Latn-UZ';
    case 'en':
      return 'en-US';
    default:
      return 'ru-RU';
  }
}

/** Разделитель разрядов — неразрывный пробел, чтобы число не переносилось. */
function groupNumber(value: number, maxFractionDigits = 0): string {
  return value.toLocaleString(locale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

/** Сумма с подписью валюты: «1 250 000 сум» / «1 250 000 so'm». */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return `— ${i18n.t('common.sum')}`;
  return `${groupNumber(Math.round(value))} ${i18n.t('common.sum')}`;
}

/** Сумма без подписи — когда валюта уже указана рядом. */
export function formatAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return groupNumber(Math.round(value));
}

/** Цена за киловатт-час: «2 100 сум/кВт·ч». */
export function formatPricePerKwh(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${groupNumber(Math.round(value))} ${i18n.t('common.sum')}/${i18n.t('common.kwh')}`;
}

/** Энергия: «12,4 кВт·ч». */
export function formatEnergy(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${groupNumber(value, 1)} ${i18n.t('common.kwh')}`;
}

/** Мощность: «120 кВт». */
export function formatPower(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${groupNumber(value)} ${i18n.t('common.kw')}`;
}

/** Расстояние: «850 м» до километра, дальше «12,4 км». */
export function formatDistance(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} м`;
  return `${groupNumber(km, 1)} ${i18n.t('common.km')}`;
}

/** Дата без времени, по правилам текущего языка. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale());
}

/** Дата со временем. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
