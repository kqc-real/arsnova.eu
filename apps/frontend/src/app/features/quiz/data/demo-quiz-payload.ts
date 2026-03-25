import type { SupportedLocale } from '../../../core/locale-from-path';
import { SUPPORTED_LOCALES } from '../../../core/locale-from-path';

import demoDe from '../../../../assets/demo/quiz-demo-showcase.de.json';
import demoEn from '../../../../assets/demo/quiz-demo-showcase.en.json';
import demoEs from '../../../../assets/demo/quiz-demo-showcase.es.json';
import demoFr from '../../../../assets/demo/quiz-demo-showcase.fr.json';
import demoIt from '../../../../assets/demo/quiz-demo-showcase.it.json';

const PAYLOADS: Record<SupportedLocale, unknown> = {
  de: demoDe,
  en: demoEn,
  fr: demoFr,
  es: demoEs,
  it: demoIt,
};

/** Normalisiert Angular-`LOCALE_ID` (z. B. `en-US`) auf unsere URL-Sprachen. */
export function normalizeDemoQuizLocale(locale: string): SupportedLocale {
  const base = (locale ?? 'de').split('-')[0]!.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as SupportedLocale) : 'de';
}

export function getDemoQuizPayload(locale: SupportedLocale): unknown {
  return PAYLOADS[locale] ?? PAYLOADS.de;
}

type DemoExportShape = {
  exportVersion?: number;
  quiz?: { name?: string };
};

/**
 * Stabiler Vergleichswert für localStorage: wechselt mit Locale und Inhalt der Showcase-JSON.
 * Wenn er nicht zum erwarteten Wert passt, wird das Demo-Quiz neu importiert (ohne komplettes Storage leeren).
 */
export function getDemoQuizSeedFingerprint(locale: SupportedLocale): string {
  const payload = PAYLOADS[locale] ?? PAYLOADS.de;
  const p = payload as DemoExportShape;
  const v = typeof p.exportVersion === 'number' ? p.exportVersion : 0;
  const n = typeof p.quiz?.name === 'string' ? p.quiz.name : '';
  return `${locale}|${v}|${n}`;
}

export function getDemoQuizExpectedTitle(locale: SupportedLocale): string {
  const payload = PAYLOADS[locale] ?? PAYLOADS.de;
  const p = payload as DemoExportShape;
  return typeof p.quiz?.name === 'string' ? p.quiz.name.trim() : '';
}

/** Wenn der gespeicherte Titel exakt der kanonische Showcase-Titel einer Sprache ist → welche. */
export function detectCanonicalDemoLocaleForTitle(title: string): SupportedLocale | null {
  const t = title.trim();
  if (!t) return null;
  for (const loc of SUPPORTED_LOCALES) {
    const n = getDemoQuizExpectedTitle(loc);
    if (n && n === t) return loc;
  }
  return null;
}
