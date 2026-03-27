import type { AppLocale } from '@arsnova/shared-types';
import { MOTD_LOCALE_FALLBACK_ORDER } from '@arsnova/shared-types';

/** Map locale code → markdown (trimmed); leere Strings gelten als fehlend */
export function resolveMotdMarkdown(byLocale: Map<string, string>, requested: AppLocale): string {
  const order: AppLocale[] = [
    requested,
    ...MOTD_LOCALE_FALLBACK_ORDER.filter((l) => l !== requested),
  ];
  for (const loc of order) {
    const raw = byLocale.get(loc);
    if (raw !== undefined && raw.trim().length > 0) {
      return raw;
    }
  }
  return '';
}

export function localesToMap(
  rows: Array<{ locale: string; markdown: string }>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    m.set(r.locale, r.markdown);
  }
  return m;
}
