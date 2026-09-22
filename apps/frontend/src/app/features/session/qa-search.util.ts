/** Mindestlänge für serverseitige Q&A-Volltextsuche (NN/typeahead-Praxis). */
export const QA_SEARCH_MIN_LENGTH = 2;

/** Liefert den wirksamen Suchbegriff oder '' unter der Mindestlänge. */
export function normalizeQaSearchQuery(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length >= QA_SEARCH_MIN_LENGTH ? trimmed : '';
}
