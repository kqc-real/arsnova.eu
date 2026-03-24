/**
 * Wählt die passende unterstützte Locale aus dem Accept-Language-Header (RFC 7231).
 */

type LangPref = { base: string; q: number; order: number };

function parseAcceptLanguage(header: string): LangPref[] {
  const items: LangPref[] = [];
  let order = 0;
  for (const part of header.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [tagPart, ...rest] = trimmed.split(';');
    const tag = tagPart.trim().toLowerCase().replace(/_/g, '-');
    let q = 1;
    for (const param of rest) {
      const [k, v] = param.split('=').map((s) => s.trim());
      if (k === 'q') {
        const n = Number.parseFloat(v ?? '');
        if (!Number.isNaN(n)) q = n;
      }
    }
    const base = tag.split('-')[0] ?? '';
    if (base) items.push({ base, q, order: order++ });
  }
  return items.sort((a, b) => (b.q !== a.q ? b.q - a.q : a.order - b.order));
}

/** Erste Locale aus dem Header, die in `available` vorkommt; sonst `fallback`. */
export function pickLocaleFromAcceptLanguage(
  header: string | undefined,
  available: readonly string[],
  fallback: string,
): string {
  if (!header?.trim()) return fallback;
  const availableSet = new Set(available.map((l) => l.toLowerCase()));
  for (const { base } of parseAcceptLanguage(header)) {
    if (availableSet.has(base)) return base;
  }
  return fallback;
}
