export interface FormatLocaleNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

function normalizeLocale(locale: string): string {
  return (locale ?? 'de').trim() || 'de';
}

function safeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function formatLocaleCount(value: number, locale = 'de'): string {
  return new Intl.NumberFormat(normalizeLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeFiniteNumber(value));
}

export function formatLocaleNumber(
  value: number,
  locale = 'de',
  options: FormatLocaleNumberOptions = {},
): string {
  const { minimumFractionDigits = 0, maximumFractionDigits = 0 } = options;
  return new Intl.NumberFormat(normalizeLocale(locale), {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeFiniteNumber(value));
}
