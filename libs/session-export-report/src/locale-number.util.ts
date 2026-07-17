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
  en: { lower: 'approx. ', sentence: 'Approx. ' },
  fr: { lower: 'env. ', sentence: 'Env. ' },
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
  /** Wenn true: „ca. 27 %“ / „approx. 27%“. */
  approximate?: boolean;
  /** Satzanfang: „Ca. …“ statt „ca. …“. */
  sentenceCase?: boolean;
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
  const unit = lang === 'en' ? '%' : ' %';
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
