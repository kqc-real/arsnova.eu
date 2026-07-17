export interface FormatLocaleNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Standard: true. */
  useGrouping?: boolean;
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
  const { minimumFractionDigits = 0, maximumFractionDigits = 0, useGrouping = true } = options;
  return new Intl.NumberFormat(normalizeLocale(locale), {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  }).format(safeFiniteNumber(value));
}

/** Quiz-Punkte gemäß Locale, einschließlich Tausendertrennung. */
export function formatLocaleScore(
  value: number,
  locale = 'de',
  options: Omit<FormatLocaleNumberOptions, 'useGrouping'> = {},
): string {
  return formatLocaleNumber(value, locale, { ...options, useGrouping: true });
}
