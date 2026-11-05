import type { AppLocale, QaSummaryModelOutputV2 } from '@arsnova/shared-types';

const GENERIC_LEADS: Readonly<Record<AppLocale, ReadonlySet<string>>> = {
  de: new Set(['beispiel', 'beispiele', 'frage', 'fragen']),
  en: new Set(['example', 'examples', 'question', 'questions']),
  fr: new Set(['exemple', 'exemples', 'question', 'questions']),
  es: new Set(['ejemplo', 'ejemplos', 'pregunta', 'preguntas']),
  it: new Set(['esempio', 'esempi', 'domanda', 'domande']),
};

function statementParts(text: string): { lead: string; body: string } | null {
  const separator = text.search(/[:–—-]/u);
  if (separator <= 0 || separator > 48) return null;
  const lead = text
    .slice(0, separator)
    .normalize('NFKC')
    .replace(/^[\s*_`~#]+|[\s*_`~#]+$/gu, '')
    .trim()
    .toLocaleLowerCase('de');
  const body = text
    .slice(separator + 1)
    .replace(/[*_`~#]+/gu, '')
    .trim();
  return lead && body ? { lead, body } : null;
}

const TECHNICAL_META =
  /\b(?:budget|tokens?|pending|pinned|active|source[- ]?ids?|quellen[- ]?ids?|votes?|votos?|voti|stimmen(?:verteilung)?|positiv(?:e|en|er|es)?|negativ(?:e|en|er|es)?|nicht berücksichtigt|not included|omitted)\b/iu;
const DANGLING_ENDING =
  /\b(?:eine|einen|einem|einer|hohe|niedrige|mehrere|wenige|positive[nmrs]?|negative[nmrs]?|starke[nmrs]?|geringe[nmrs]?)\s*[.!?…»”’)]*$/iu;

function isCompletePlainStatement(text: string, body: string): boolean {
  if (text.includes('**') || text.includes('__') || text.includes('`')) return false;
  if (TECHNICAL_META.test(text) || DANGLING_ENDING.test(body)) return false;
  return body.length >= 12 && /[.!?…»”’)]$/u.test(body);
}

/**
 * Narrow output gate for defects that are cheaper and safer to reject than to
 * present: one-item "summaries", repeated scan labels, and generic labels that
 * mirror answer-format requests embedded in untrusted questions.
 */
export function hasAcceptableQaSummaryQuality(
  output: QaSummaryModelOutputV2,
  locale: AppLocale,
): boolean {
  if (output.status !== 'ready') return true;
  if (output.statements.length < 2) return false;

  const parts = output.statements.map(({ text }) => statementParts(text));
  if (parts.some((part) => part === null)) return false;
  const completeParts = parts.filter(
    (part): part is { lead: string; body: string } => part !== null,
  );
  if (
    completeParts.some(
      (part, index) => !isCompletePlainStatement(output.statements[index]?.text ?? '', part.body),
    )
  ) {
    return false;
  }
  const leads = completeParts.map(({ lead }) => lead);
  if (new Set(leads).size !== leads.length) return false;
  const generic = GENERIC_LEADS[locale];
  return leads.every((lead) => !generic.has(lead));
}
