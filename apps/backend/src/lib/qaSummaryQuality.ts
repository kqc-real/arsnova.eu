import {
  QA_SUMMARY_MAX_TOPIC_LENGTH,
  type AppLocale,
  type QaSummaryModelOutputV2,
  type QaSummaryStatementV2,
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

const PERCENTAGE_VALUE_PATTERN =
  /(\d+(?:[.,]\d+)*)(?:[\s\u00a0\u202f]*(?:%|prozent\b|percento\b|percent\b|pour[\s\u00a0\u202f]*cent\b|por[\s\u00a0\u202f]*ciento\b|per[\s\u00a0\u202f]*cento\b))/giu;
const NUMERIC_TOKEN_PATTERN = /\d+(?:[.,]\d+)*/gu;
const GROUPED_THOUSANDS_PATTERN = /^\d{1,3}(?:[.,]\d{3})+$/u;

function canonicalNumericForms(raw: string): string[] {
  const normalizedDecimal = raw.replace(/,/g, '.');
  if (GROUPED_THOUSANDS_PATTERN.test(raw)) {
    return [normalizedDecimal, raw.replace(/[.,]/g, '')];
  }
  return [normalizedDecimal];
}

function extractCanonicalNumberSet(text: string): Set<string> {
  const normalizedText = text.normalize('NFKC');
  const values = new Set<string>();
  for (const match of normalizedText.matchAll(NUMERIC_TOKEN_PATTERN)) {
    for (const form of canonicalNumericForms(match[0])) {
      values.add(form);
    }
  }
  return values;
}

function extractCanonicalPercentageSet(text: string): Set<string> {
  const normalizedText = text.normalize('NFKC');
  const values = new Set<string>();
  for (const match of normalizedText.matchAll(PERCENTAGE_VALUE_PATTERN)) {
    const numberPart = match[1];
    if (!numberPart) continue;
    for (const form of canonicalNumericForms(numberPart)) {
      values.add(form);
    }
  }
  return values;
}

function hasSourceGroundedNumbersAndPercentages(
  statement: QaSummaryStatementV2,
  sourceTextsById: ReadonlyMap<string, string>,
): boolean {
  const normalizedStatement = statement.text.normalize('NFKC');
  const statementMatches = [...normalizedStatement.matchAll(NUMERIC_TOKEN_PATTERN)];
  if (statementMatches.length === 0) return true;

  const citedText = statement.sourceIds
    .map((sourceId) => sourceTextsById.get(sourceId) ?? '')
    .filter(Boolean)
    .join('\n');
  if (!citedText) return false;

  const allowedPercentages = extractCanonicalPercentageSet(citedText);
  for (const match of normalizedStatement.matchAll(PERCENTAGE_VALUE_PATTERN)) {
    const numberPart = match[1];
    if (!numberPart) continue;
    const forms = canonicalNumericForms(numberPart);
    if (!forms.some((form) => allowedPercentages.has(form))) {
      return false;
    }
  }

  const allowedNumbers = extractCanonicalNumberSet(citedText);
  for (const match of statementMatches) {
    const forms = canonicalNumericForms(match[0]);
    if (!forms.some((form) => allowedNumbers.has(form))) {
      return false;
    }
  }
  return true;
}

function isCompletePlainStatement(text: string, body: string): boolean {
  if (text.includes('**') || text.includes('__') || text.includes('`')) return false;
  if (TECHNICAL_META_PATTERNS.some((pattern) => pattern.test(text)) || DANGLING_ENDING.test(body)) {
    return false;
  }
  return body.length >= 12 && /[.!?…»”’)]$/u.test(body);
}

export type QaSummaryQualityOptions = Readonly<{
  minimumStatements?: number;
  sourceTextsById?: ReadonlyMap<string, string>;
}>;

/**
 * Narrow output gate for defects that are cheaper and safer to reject than to
 * present: incomplete statements, repeated scan labels, generic labels that
 * mirror answer-format requests embedded in untrusted questions, and invented
 * numeric or percentage claims absent from the cited source texts.
 */
export function hasAcceptableQaSummaryQuality(
  output: QaSummaryModelOutputV2,
  locale: AppLocale,
  minimumStatementsOrOptions: number | QaSummaryQualityOptions = 2,
): boolean {
  const options: QaSummaryQualityOptions =
    typeof minimumStatementsOrOptions === 'number'
      ? { minimumStatements: minimumStatementsOrOptions }
      : minimumStatementsOrOptions;
  const minimumStatements = options.minimumStatements ?? 2;

  if (output.status === 'failed') return true;
  if (output.status === 'uncertain' && output.statements.length === 0) return true;
  if (output.statements.length < minimumStatements) return false;

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
  if (
    output.suggestedNextSteps.some(({ text }) =>
      TECHNICAL_META_PATTERNS.some((pattern) => pattern.test(text)),
    )
  ) {
    return false;
  }
  if (options.sourceTextsById) {
    const sourceTextsById = options.sourceTextsById;
    if (
      output.statements.some(
        (statement) => !hasSourceGroundedNumbersAndPercentages(statement, sourceTextsById),
      ) ||
      output.suggestedNextSteps.some(
        (step) => !hasSourceGroundedNumbersAndPercentages(step, sourceTextsById),
      )
    ) {
      return false;
    }
  }
  const leads = completeParts.map(({ lead }) => lead);
  if (new Set(leads).size !== leads.length) return false;
  const generic = GENERIC_LEADS[locale];
  return leads.every((lead) => !generic.has(lead));
}
