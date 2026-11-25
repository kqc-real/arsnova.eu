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

function statementParts(
  text: string,
  maximumTopicLength = QA_SUMMARY_MAX_TOPIC_LENGTH,
): { lead: string; body: string } | null {
  const colonIndex = text.indexOf(':');
  const spacedDash = text.match(/\s[–—-]\s/u);
  const separator =
    colonIndex > 0
      ? { index: colonIndex, length: 1 }
      : spacedDash?.index !== undefined
        ? { index: spacedDash.index, length: spacedDash[0].length }
        : null;
  if (!separator || separator.index <= 0 || separator.index > maximumTopicLength) return null;
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

const SIGNED_NUMERIC_CORE = '(?<![\\p{L}\\p{N}\\]\\)])[+\\-\\u2212\\u2013]?\\d+(?:[.,]\\d+)*';
const PERCENTAGE_VALUE_PATTERN = new RegExp(
  `(${SIGNED_NUMERIC_CORE})(?:[\\s\\u00a0\\u202f]*(?:%|prozent\\b|percento\\b|percent\\b|pour[\\s\\u00a0\\u202f]*cent\\b|por[\\s\\u00a0\\u202f]*ciento\\b|per[\\s\\u00a0\\u202f]*cento\\b))`,
  'giu',
);
const NUMERIC_TOKEN_PATTERN = new RegExp(SIGNED_NUMERIC_CORE, 'gu');
const MIXED_DOT_THOUSANDS_DECIMAL_PATTERN = /^\d{1,3}(?:\.\d{3})+,\d+$/u;
const MIXED_COMMA_THOUSANDS_DECIMAL_PATTERN = /^\d{1,3}(?:,\d{3})+\.\d+$/u;
const MULTI_GROUPED_THOUSANDS_PATTERN = /^\d{1,3}(?:(?:\.\d{3}){2,}|(?:,\d{3}){2,})$/u;
const SINGLE_GROUPED_THOUSANDS_PATTERN = /^\d{1,3}[.,]\d{3}$/u;
const PLAIN_DECIMAL_PATTERN = /^\d+[.,]\d+$/u;
const CONTENT_WORD_PATTERN = /\p{L}[\p{L}\p{N}]{3,}/gu;

const MULTILINGUAL_STOPWORDS = new Set([
  // de
  'aber',
  'alle',
  'allem',
  'allen',
  'aller',
  'alles',
  'also',
  'auch',
  'beim',
  'dabei',
  'dann',
  'dass',
  'dein',
  'deine',
  'denn',
  'diese',
  'diesem',
  'diesen',
  'dieser',
  'dieses',
  'doch',
  'dort',
  'durch',
  'eben',
  'eine',
  'einem',
  'einen',
  'einer',
  'eines',
  'etwa',
  'etwas',
  'euch',
  'euer',
  'eure',
  'ganz',
  'gibt',
  'haben',
  'hatte',
  'hier',
  'ihre',
  'ihrem',
  'ihren',
  'ihrer',
  'immer',
  'jede',
  'jedem',
  'jeden',
  'jeder',
  'jedes',
  'jetzt',
  'kann',
  'kein',
  'keine',
  'keinem',
  'keinen',
  'keiner',
  'können',
  'könnte',
  'könnten',
  'mehr',
  'mein',
  'meine',
  'mich',
  'muss',
  'müssen',
  'müsste',
  'nach',
  'nicht',
  'noch',
  'oder',
  'ohne',
  'sehr',
  'sein',
  'seine',
  'seinem',
  'seinen',
  'seiner',
  'sich',
  'sind',
  'soll',
  'sollen',
  'sollte',
  'sollten',
  'über',
  'unser',
  'unsere',
  'unter',
  'viel',
  'viele',
  'vom',
  'wann',
  'warum',
  'was',
  'weil',
  'welche',
  'welchem',
  'welchen',
  'welcher',
  'welches',
  'wenn',
  'werden',
  'wieso',
  'wird',
  'wurde',
  'wurden',
  // en
  'about',
  'after',
  'again',
  'also',
  'been',
  'before',
  'being',
  'between',
  'both',
  'could',
  'does',
  'doing',
  'done',
  'each',
  'even',
  'from',
  'have',
  'having',
  'here',
  'into',
  'just',
  'many',
  'more',
  'most',
  'much',
  'must',
  'need',
  'only',
  'other',
  'over',
  'same',
  'should',
  'some',
  'such',
  'than',
  'that',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'under',
  'very',
  'want',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'your',
  // fr
  'alors',
  'après',
  'aussi',
  'autre',
  'autres',
  'avec',
  'avoir',
  'bien',
  'cela',
  'celle',
  'celles',
  'celui',
  'cette',
  'comme',
  'comment',
  'dans',
  'dois',
  'doit',
  'doivent',
  'donc',
  'encore',
  'entre',
  'être',
  'faire',
  'faut',
  'leur',
  'leurs',
  'mais',
  'même',
  'moins',
  'nous',
  'peut',
  'peuvent',
  'plus',
  'pour',
  'pourquoi',
  'quand',
  'quel',
  'quelle',
  'quelles',
  'quels',
  'sans',
  'sont',
  'sous',
  'tout',
  'toute',
  'toutes',
  'tous',
  'très',
  'votre',
  'vous',
  // es
  'algo',
  'alguno',
  'algunos',
  'ante',
  'como',
  'cómo',
  'contra',
  'cual',
  'cuál',
  'cuales',
  'cuáles',
  'cuando',
  'cuándo',
  'debe',
  'deben',
  'debería',
  'desde',
  'donde',
  'dónde',
  'entre',
  'esta',
  'está',
  'están',
  'estas',
  'este',
  'esto',
  'estos',
  'hacer',
  'hasta',
  'mucho',
  'muchos',
  'nosotros',
  'otra',
  'otras',
  'otro',
  'otros',
  'para',
  'pero',
  'poco',
  'porque',
  'puede',
  'pueden',
  'quién',
  'sobre',
  'solo',
  'también',
  'tiene',
  'tienen',
  'todo',
  'todos',
  // it
  'allora',
  'altri',
  'altro',
  'anche',
  'ancora',
  'avere',
  'come',
  'cosa',
  'così',
  'deve',
  'devono',
  'dobbiamo',
  'dopo',
  'dove',
  'dovrebbe',
  'essere',
  'fare',
  'fatto',
  'hanno',
  'loro',
  'molti',
  'molto',
  'nostra',
  'nostro',
  'ogni',
  'perché',
  'però',
  'più',
  'poco',
  'può',
  'possono',
  'quale',
  'quali',
  'quando',
  'quella',
  'quelle',
  'quelli',
  'quello',
  'questa',
  'queste',
  'questi',
  'questo',
  'senza',
  'sono',
  'sopra',
  'sotto',
  'tutta',
  'tutte',
  'tutti',
  'tutto',
]);

export function extractSignificantContentTokens(text: string): string[] {
  const normalized = text.normalize('NFKC').toLocaleLowerCase('de');
  const unique = new Set<string>();
  for (const match of normalized.matchAll(CONTENT_WORD_PATTERN)) {
    const token = match[0];
    if (!MULTILINGUAL_STOPWORDS.has(token)) {
      unique.add(token);
    }
  }
  return [...unique];
}

function tokensShareContentStem(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length >= 6 && right.length >= 6) {
    return left.startsWith(right.slice(0, 6)) || right.startsWith(left.slice(0, 6));
  }
  return false;
}

export function countSignificantContentTokenMatches(
  statementTokens: readonly string[],
  candidateTokens: readonly string[],
): number {
  if (statementTokens.length === 0 || candidateTokens.length === 0) return 0;
  let matches = 0;
  for (const token of statementTokens) {
    if (candidateTokens.some((candidate) => tokensShareContentStem(token, candidate))) {
      matches += 1;
    }
  }
  return matches;
}

function hasGroupedQaSourceCoverage(
  statement: QaSummaryStatementV2,
  includedQaTextsById: ReadonlyMap<string, string>,
  body: string,
): boolean {
  if (statement.sourceIds.length < 2) return true;
  const summaryTokens = extractSignificantContentTokens(body);
  const sourceTokens = statement.sourceIds.map((id) =>
    extractSignificantContentTokens(includedQaTextsById.get(id) ?? ''),
  );
  const distinctTokens = sourceTokens.map((tokens, index) => {
    const otherTokens = sourceTokens.filter((_, other) => other !== index).flat();
    return tokens.filter(
      (token) => !otherTokens.some((other) => tokensShareContentStem(token, other)),
    );
  });
  const coversDistinctTokens = distinctTokens.map(
    (tokens) => countSignificantContentTokenMatches(summaryTokens, tokens) > 0,
  );

  // A shared concern can be stated once. If the summary uses source-specific
  // words, it needs an anchor for each source with distinct content. This
  // checks observable omissions without requiring the original wording.
  if (!coversDistinctTokens.some(Boolean)) {
    return sourceTokens.every(
      (tokens) => countSignificantContentTokenMatches(summaryTokens, tokens) > 0,
    );
  }
  return distinctTokens.every(
    (tokens, index) => tokens.length === 0 || coversDistinctTokens[index],
  );
}

function hasConsistentQaCitationGrounding(
  statement: QaSummaryStatementV2,
  sourceTextsById: ReadonlyMap<string, string>,
  includedQaTextsById: ReadonlyMap<string, string>,
  maximumTopicLength: number,
): boolean {
  if (includedQaTextsById.size < 2) return true;
  const body = statementParts(statement.text, maximumTopicLength)?.body ?? statement.text;
  const statementTokens = extractSignificantContentTokens(body);
  if (statementTokens.length < 2) return true;

  const citedText = statement.sourceIds
    .map((sourceId) => sourceTextsById.get(sourceId) ?? '')
    .filter(Boolean)
    .join('\n');
  const citedTokens = extractSignificantContentTokens(citedText);
  if (countSignificantContentTokenMatches(statementTokens, citedTokens) > 0) {
    return true;
  }

  const statementNumberGroups = [...body.normalize('NFKC').matchAll(NUMERIC_TOKEN_PATTERN)].map(
    (match) => canonicalNumericForms(match[0]),
  );
  const citedSet = new Set(statement.sourceIds);
  for (const [qaSourceId, qaText] of includedQaTextsById) {
    if (citedSet.has(qaSourceId)) continue;
    const qaTokens = extractSignificantContentTokens(qaText);
    if (countSignificantContentTokenMatches(statementTokens, qaTokens) < 2) {
      continue;
    }
    if (statementNumberGroups.length > 0) {
      const qaNumbers = extractCanonicalNumberSet(qaText);
      if (!statementNumberGroups.every((forms) => forms.some((form) => qaNumbers.has(form)))) {
        continue;
      }
    }
    return false;
  }
  return true;
}

function normalizeDecimalValue(unsignedDotDecimal: string): string {
  const [rawInt = '0', rawFrac = ''] = unsignedDotDecimal.split('.');
  const cleanInt = rawInt.replace(/^0+(?=\d)/u, '');
  const cleanFrac = rawFrac.replace(/0+$/u, '');
  return cleanFrac.length > 0 ? `${cleanInt}.${cleanFrac}` : cleanInt;
}

function canonicalUnsignedNumericForms(raw: string): string[] {
  if (!raw.includes('.') && !raw.includes(',')) {
    return [normalizeDecimalValue(raw)];
  }
  if (MIXED_DOT_THOUSANDS_DECIMAL_PATTERN.test(raw)) {
    return [normalizeDecimalValue(raw.replace(/\./g, '').replace(',', '.'))];
  }
  if (MIXED_COMMA_THOUSANDS_DECIMAL_PATTERN.test(raw)) {
    return [normalizeDecimalValue(raw.replace(/,/g, ''))];
  }
  if (MULTI_GROUPED_THOUSANDS_PATTERN.test(raw)) {
    return [normalizeDecimalValue(raw.replace(/[.,]/g, ''))];
  }
  if (SINGLE_GROUPED_THOUSANDS_PATTERN.test(raw)) {
    if (/^0+[.,]\d{3}$/u.test(raw)) {
      return [normalizeDecimalValue(raw.replace(',', '.'))];
    }
    const groupedInteger = normalizeDecimalValue(raw.replace(/[.,]/g, ''));
    if (/^[1-9]\d{0,2}[.,]000$/u.test(raw)) {
      return [...new Set([groupedInteger, raw.replace(',', '.')])];
    }
    const decimalValue = normalizeDecimalValue(raw.replace(',', '.'));
    return [...new Set([decimalValue, groupedInteger])];
  }
  if (PLAIN_DECIMAL_PATTERN.test(raw)) {
    return [normalizeDecimalValue(raw.replace(',', '.'))];
  }
  return [raw.replace(/,/g, '.')];
}

function applyCanonicalSign(unsignedForm: string, isNegative: boolean): string {
  if (!isNegative || /^0(?:\.0+)?$/u.test(unsignedForm)) {
    return unsignedForm;
  }
  return `-${unsignedForm}`;
}

function canonicalNumericForms(raw: string): string[] {
  const firstChar = raw[0];
  const isNegative = firstChar === '-' || firstChar === '\u2212' || firstChar === '\u2013';
  const hasSign = isNegative || firstChar === '+';
  const unsignedRaw = hasSign ? raw.slice(1) : raw;
  return [
    ...new Set(
      canonicalUnsignedNumericForms(unsignedRaw).map((form) =>
        applyCanonicalSign(form, isNegative),
      ),
    ),
  ];
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
  maximumTopicLength?: number;
  checkGroupedQaCoverage?: boolean;
  sourceTextsById?: ReadonlyMap<string, string>;
  includedQaTextsById?: ReadonlyMap<string, string>;
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
  const maximumTopicLength = options.maximumTopicLength ?? QA_SUMMARY_MAX_TOPIC_LENGTH;

  if (output.status === 'failed') return true;
  if (output.status === 'uncertain' && output.statements.length === 0) return true;
  if (output.statements.length < minimumStatements) return false;

  const parts = output.statements.map(({ text }) => statementParts(text, maximumTopicLength));
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
    if (options.includedQaTextsById) {
      const includedQaTextsById = options.includedQaTextsById;
      if (
        output.statements.some(
          (statement, index) =>
            (options.checkGroupedQaCoverage &&
              !hasGroupedQaSourceCoverage(
                statement,
                includedQaTextsById,
                completeParts[index]!.body,
              )) ||
            !hasConsistentQaCitationGrounding(
              statement,
              sourceTextsById,
              includedQaTextsById,
              maximumTopicLength,
            ),
        )
      ) {
        return false;
      }
    }
  }
  const leads = completeParts.map(({ lead }) => lead);
  if (new Set(leads).size !== leads.length) return false;
  const generic = GENERIC_LEADS[locale];
  return leads.every((lead) => !generic.has(lead));
}
