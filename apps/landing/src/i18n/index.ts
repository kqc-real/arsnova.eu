import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import it from './it';
import type { Locale, Messages } from './types';

export type { Locale, Messages } from './types';
export {
  CANONICAL_ANCHORS,
  LEGACY_ALIAS_IDS,
  LEGACY_ANCHOR_ALIASES,
  canonicalizeHash,
  localePath,
} from './anchors';

export const LOCALES = ['de', 'en', 'fr', 'it', 'es'] as const satisfies readonly Locale[];

export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
};

const dictionaries: Record<Locale, Messages> = { de, en, fr, it, es };

function collectPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [prefix];
    return value.flatMap((item, index) => collectPaths(item, `${prefix}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      collectPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

/** Throws at import time when any locale dictionary is missing keys or arrays diverge. */
export function assertCompleteDictionaries(): void {
  const reference = collectPaths(de).sort();
  const errors: string[] = [];

  for (const locale of LOCALES) {
    if (locale === 'de') continue;
    const paths = collectPaths(dictionaries[locale]).sort();
    const missing = reference.filter((path) => !paths.includes(path));
    const extra = paths.filter((path) => !reference.includes(path));
    if (missing.length) {
      errors.push(`[${locale}] missing: ${missing.slice(0, 20).join(', ')}`);
    }
    if (extra.length) {
      errors.push(`[${locale}] extra: ${extra.slice(0, 20).join(', ')}`);
    }
  }

  if (errors.length) {
    throw new Error(`Landing i18n dictionaries incomplete:\n${errors.join('\n')}`);
  }
}

assertCompleteDictionaries();

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: string): Messages {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported landing locale: ${locale}`);
  }
  return dictionaries[locale];
}

export function getOgAlternateLocales(current: Locale): string[] {
  return LOCALES.filter((locale) => locale !== current).map(
    (locale) => dictionaries[locale].meta.ogLocale,
  );
}
