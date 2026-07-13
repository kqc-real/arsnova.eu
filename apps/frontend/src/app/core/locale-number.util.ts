/**
 * Locale-aware number formatting for user-visible counts and metrics.
 */

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

/** Ganzzahlige Zähler (Sessions, Stimmen, Teilnehmende) mit Tausendertrennzeichen. */
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

/** Prozentwerte (0–100) mit optionalen Nachkommastellen. */
export function formatLocalePercent(
  value: number,
  locale = 'de',
  maximumFractionDigits = 0,
): string {
  const minimumFractionDigits = maximumFractionDigits > 0 ? 0 : 0;
  return formatLocaleNumber(value, locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

const BADGE_COUNT_CAP = 99;

/** Badge-Zähler mit Obergrenze (z. B. „99+“ / „99+“). */
export function formatLocaleBadgeCount(
  value: number,
  locale = 'de',
  cap = BADGE_COUNT_CAP,
): string {
  if (!Number.isFinite(value) || value <= 0) {
    return formatLocaleCount(0, locale);
  }
  if (value > cap) {
    return `${formatLocaleCount(cap, locale)}+`;
  }
  return formatLocaleCount(value, locale);
}
