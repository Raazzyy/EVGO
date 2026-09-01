/**
 * Русская плюрализация числительных.
 * pluralRu(1, 'станция', 'станции', 'станций') → 'станция'
 * pluralRu(3, ...) → 'станции', pluralRu(5, ...) → 'станций'
 */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Число + правильно склонённое слово: "2 станции", "5 станций". */
export function pluralStations(n: number): string {
  return `${n} ${pluralRu(n, 'станция', 'станции', 'станций')}`;
}
