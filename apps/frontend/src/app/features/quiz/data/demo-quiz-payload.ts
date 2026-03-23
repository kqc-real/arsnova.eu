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
