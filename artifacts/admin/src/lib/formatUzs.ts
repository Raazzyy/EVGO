/**
 * Format a number as UZS currency.
 * Example: 1234567 → "1 234 567 сум"  (non-breaking space as thousand separator)
 */
export function formatUzs(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "— сум";
  return (
    value.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) + "\u00a0сум"
  );
}

/** Compact form: "1 234 567" without the currency label */
export function formatUzsRaw(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
