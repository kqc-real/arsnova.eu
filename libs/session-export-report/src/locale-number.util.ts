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

const APPROX_PREFIX: Record<string, { lower: string; sentence: string }> = {
  de: { lower: 'ca. ', sentence: 'Ca. ' },
  en: { lower: 'about ', sentence: 'About ' },
  fr: { lower: 'environ ', sentence: 'Environ ' },
  es: { lower: 'aprox. ', sentence: 'Aprox. ' },
  it: { lower: 'circa ', sentence: 'Circa ' },
};

/** Anteil ist nicht ganzzahlig in Prozent → Anzeige wurde/wird gerundet. */
export function percentShareNeedsApproximation(count: number, total: number): boolean {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return false;
  if (count <= 0 || count >= total) return false;
  const exact = (count / total) * 100;
  return Math.abs(exact - Math.round(exact)) > 1e-9;
}

/** Prozentwert (0–100) weicht von der gerundeten Ganzzahl ab; 0 % und 100 % nie mit „ca.“. */
export function percentValueNeedsApproximation(value: number): boolean {
  const v = safeFiniteNumber(value);
  const rounded = Math.round(v);
  if (rounded === 0 || rounded === 100) return false;
  return Math.abs(v - rounded) > 1e-9;
}

export interface FormatLocalePercentShareOptions {
  /** Wenn true: „ca. 27 %“ / „about 27%“. */
  approximate?: boolean;
  /** Satzanfang: „Ca. …“ statt „ca. …“. */
  sentenceCase?: boolean;
}

/** Prozentzeichen inkl. localeüblicher Typografie (`40%` vs. `40 %`). */
export function formatLocalePercentUnit(locale = 'de'): string {
  const lang = normalizeLocale(locale).slice(0, 2).toLowerCase();
  return lang === 'en' ? '%' : ' %';
}

/** Doppelpunkt inkl. localeüblicher Typografie (`Label:` vs. FR `Label\u00A0:`). */
export function formatLocaleColon(locale = 'de'): string {
  const lang = normalizeLocale(locale).slice(0, 2).toLowerCase();
  // Französisch: geschütztes Leerzeichen vor dem Doppelpunkt (NBSP, PDF-stabil).
  return lang === 'fr' ? '\u00A0:' : ':';
}

/** Formatiert einen Prozentwert (0–100) inkl. localeüblichem `%`-Abstand. */
export function formatLocalePercentValue(
  value: number,
  locale = 'de',
  options: FormatLocaleNumberOptions = {},
): string {
  return `${formatLocaleNumber(value, locale, options)}${formatLocalePercentUnit(locale)}`;
}

type LocaleListType = 'conjunction' | 'disjunction';

/** Formatiert eine Liste mit localeüblicher Konjunktion/Disjunktion. */
export function formatLocaleList(
  items: readonly string[],
  locale = 'de',
  type: LocaleListType = 'conjunction',
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  try {
    return new Intl.ListFormat(normalizeLocale(locale), {
      style: 'long',
      type,
    }).format([...items]);
  } catch {
    return items.join(', ');
  }
}

/** Formatiert eine Liste mit localeüblicher Konjunktion („7, 3, and 6“ / „7, 3 und 6“). */
export function formatLocaleConjunctionList(items: readonly string[], locale = 'de'): string {
  return formatLocaleList(items, locale, 'conjunction');
}

/** Formatiert eine Liste mit localeüblicher Disjunktion („A or B“ / „A oder B“). */
export function formatLocaleDisjunctionList(items: readonly string[], locale = 'de'): string {
  return formatLocaleList(items, locale, 'disjunction');
}

/** Formatiert einen Prozentanteil inkl. optionalem Rundungs-Hinweis („ca.“). */
export function formatLocalePercentShare(
  value: number,
  locale = 'de',
  options: FormatLocalePercentShareOptions = {},
): string {
  const lang = normalizeLocale(locale).slice(0, 2).toLowerCase();
  const rounded = Math.round(safeFiniteNumber(value));
  const num = formatLocaleNumber(rounded, locale, { maximumFractionDigits: 0 });
  const unit = formatLocalePercentUnit(locale);
  // 0 % und 100 % wirken mit „ca.“ falsch, auch wenn der Aufrufer approximate setzt.
  const useApprox = Boolean(options.approximate) && rounded !== 0 && rounded !== 100;
  if (!useApprox) return `${num}${unit}`;
  const prefix = APPROX_PREFIX[lang] ?? APPROX_PREFIX.de!;
  return `${options.sentenceCase ? prefix.sentence : prefix.lower}${num}${unit}`;
}

/** Prozentanteil aus Zähler/Nenner; „ca.“ nur bei nicht ganzzahliger Quote (nie bei 0 % / 100 %). */
export function formatLocalePercentShareFromCounts(
  count: number,
  total: number,
  locale = 'de',
  options: Omit<FormatLocalePercentShareOptions, 'approximate'> = {},
): string {
  const safeTotal = safeFiniteNumber(total);
  const safeCount = safeFiniteNumber(count);
  const value = safeTotal > 0 ? (safeCount / safeTotal) * 100 : 0;
  return formatLocalePercentShare(value, locale, {
    ...options,
    approximate: percentShareNeedsApproximation(safeCount, safeTotal),
  });
}
