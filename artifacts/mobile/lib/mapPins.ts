/**
 * Единая логика цвета/прозрачности пинов станций для карты (натив и веб).
 *
 * Цвет кодирует СКОРОСТЬ зарядки (как у лидеров рынка): так водитель сразу
 * видит, где можно зарядиться быстро. Доступность не теряется: занятые пины
 * приглушены, офлайн — серые.
 */
export type PinTier = 'slow' | 'fast' | 'ultra';

/** Порог мощности → уровень скорости. */
export function pinTier(powerKw: number): PinTier {
  if (powerKw >= 150) return 'ultra'; // ультрабыстрая
  if (powerKw >= 43) return 'fast';   // быстрая DC
  return 'slow';                       // медленная AC
}

/** Цвет пина: офлайн — серый, иначе по скорости. */
export function pinColor(powerKw: number, status?: string): string {
  if (status === 'offline') return '#64748B';
  switch (pinTier(powerKw)) {
    case 'ultra': return '#4F46E5'; // ультрабыстрая — насыщенный индиго
    case 'fast':  return '#2563EB'; // быстрая DC — фирменный яркий синий Яндекс
    default:      return '#0284C7'; // AC — небесно-голубой
  }
}

/** Занятые станции приглушаем, чтобы свободные выделялись. */
export function pinOpacity(status?: string): number {
  return status === 'occupied' ? 0.5 : 1;
}

/** Подпись уровня — для легенды/подсказок. */
export const PIN_LEGEND: Array<{ tier: PinTier; color: string; label: string }> = [
  { tier: 'slow',  color: '#0284C7', label: 'AC · до 43 кВт' },
  { tier: 'fast',  color: '#2563EB', label: 'Быстрая · 43–150 кВт' },
  { tier: 'ultra', color: '#4F46E5', label: 'Ультра · 150+ кВт' },
];
