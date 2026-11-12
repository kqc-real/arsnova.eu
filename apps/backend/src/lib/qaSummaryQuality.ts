import {
  QA_SUMMARY_MAX_TOPIC_LENGTH,
  type AppLocale,
  type QaSummaryModelOutputV2,
} from '@arsnova/shared-types';

const GENERIC_LEADS: Readonly<Record<AppLocale, ReadonlySet<string>>> = {
  de: new Set(['beispiel', 'beispiele', 'frage', 'fragen']),
  en: new Set(['example', 'examples', 'question', 'questions']),
  fr: new Set(['exemple', 'exemples', 'question', 'questions']),
  es: new Set(['ejemplo', 'ejemplos', 'pregunta', 'preguntas']),
  it: new Set(['esempio', 'esempi', 'domanda', 'domande']),
};

function statementParts(text: string): { lead: string; body: string } | null {
  const colonIndex = text.indexOf(':');
  const spacedDash = text.match(/\s[–—-]\s/u);
  const separator =
    colonIndex > 0
      ? { index: colonIndex, length: 1 }
      : spacedDash?.index !== undefined
        ? { index: spacedDash.index, length: spacedDash[0].length }
        : null;
  if (!separator || separator.index <= 0 || separator.index > QA_SUMMARY_MAX_TOPIC_LENGTH)
    return null;
  const lead = text
    .slice(0, separator.index)
    .normalize('NFKC')
    .replace(/^[\s*_`~#]+|[\s*_`~#]+$/gu, '')
    .trim()
    .toLocaleLowerCase('de');
  const body = text
    .slice(separator.index + separator.length)
    .replace(/[*_`~#]+/gu, '')
    .trim();
  return lead && body ? { lead, body } : null;
}

const TECHNICAL_META_PATTERNS = [
  /\b(?:source|quellen)[- ]?ids?\b/iu,
  /\b(?:token|kontext)[- ]?budget\b/iu,
  /\b(?:aufgrund|wegen)\s+(?:des|eines|dem)?\s*(?:token[- ]?|kontext[- ]?)?budgets?\b/iu,
  /\b(?:einige|mehrere|\d+)\s+(?:fragen|themen|einträge|inhalte)\s+(?:wurden\s+)?nicht berücksichtigt\b/iu,
  /\b(?:some|several|\d+)\s+(?:questions|topics|items|sources)\s+(?:were\s+)?(?:not included|omitted)\b/iu,
  /\b(?:als\s+)?(?:pending|pinned|active)(?:-status)?\s+(?:markiert|gekennzeichnet)\b/iu,
  /\bstatus\s*[:=]\s*(?:pending|pinned|active)\b/iu,
] as const;
const DANGLING_ENDING =
  /\b(?:eine|einen|einem|einer|hohe|niedrige|mehrere|wenige|positive[nmrs]?|negative[nmrs]?|starke[nmrs]?|geringe[nmrs]?)\s*[.!?…»”’)]*$/iu;

function isCompletePlainStatement(text: string, body: string): boolean {
  if (text.includes('**') || text.includes('__') || text.includes('`')) return false;
  if (TECHNICAL_META_PATTERNS.some((pattern) => pattern.test(text)) || DANGLING_ENDING.test(body)) {
    return false;
  }
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
  if (output.status === 'failed') return true;
  if (output.status === 'uncertain' && output.statements.length === 0) return true;
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
