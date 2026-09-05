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
  quiz?: {
    name?: string;
    description?: string | null;
    motifImageUrl?: string | null;
    motifImageCredit?: string | null;
  };
};

/** FNV-1a 32-bit (sync) — für Demo-Seed-Fingerprint ohne async crypto. */
function fnv1a32Hex(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * Stabiler Vergleichswert für localStorage: wechselt mit Locale und Inhalt der Showcase-JSON.
 * Der volle Payload-Hash stellt sicher, dass auch reine Fragen-/Antwort-Updates ein Reseed auslösen.
 */
export function getDemoQuizSeedFingerprint(locale: SupportedLocale): string {
  const payload = PAYLOADS[locale] ?? PAYLOADS.de;
  const p = payload as DemoExportShape;
  const v = typeof p.exportVersion === 'number' ? p.exportVersion : 0;
  const n = typeof p.quiz?.name === 'string' ? p.quiz.name : '';
  const motif = typeof p.quiz?.motifImageUrl === 'string' ? p.quiz.motifImageUrl : '';
  return `${locale}|${v}|${n}|${motif}|${fnv1a32Hex(JSON.stringify(payload))}`;
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
