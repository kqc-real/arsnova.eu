/**
 * Dictionary parity probe for `npm run test:i18n`.
 * Uses explicit `.ts` extensions for Node `--experimental-strip-types`.
 */
import de from '../src/i18n/de.ts';
import en from '../src/i18n/en.ts';
import es from '../src/i18n/es.ts';
import fr from '../src/i18n/fr.ts';
import it from '../src/i18n/it.ts';
import type { Messages } from '../src/i18n/types.ts';

const dictionaries: Record<string, Messages> = { de, en, fr, it, es };

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

const reference = collectPaths(de).sort();
const errors: string[] = [];

for (const [locale, messages] of Object.entries(dictionaries)) {
  if (locale === 'de') continue;
  const paths = collectPaths(messages).sort();
  const missing = reference.filter((path) => !paths.includes(path));
  const extra = paths.filter((path) => !reference.includes(path));
  if (missing.length) errors.push(`[${locale}] missing: ${missing.slice(0, 20).join(', ')}`);
  if (extra.length) errors.push(`[${locale}] extra: ${extra.slice(0, 20).join(', ')}`);
  if (!messages.meta?.homeTitle || !messages.nav?.ariaLabel || !messages.faq?.items?.length) {
    errors.push(`[${locale}] incomplete core sections`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

process.stdout.write('dictionaries-ok\n');
