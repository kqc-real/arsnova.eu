/**
 * Turns protocol-style Q&A summary sentences into scan bullets: "Topic: short clause."
 * Gemini flash-lite often ignores prompt style; this keeps the host UI readable
 * without cutting clauses at conjunctions or leaving hanging prepositions.
 */

const MAX_CLAUSE_WORDS = 14;
const MAX_LEAD_WORDS = 5;

const PROTOCOL_PREFIXES: readonly RegExp[] = [
  /^zudem\s+wird\s+(?:diskutiert|gefragt),?\s*(?:wie\s+)?/i,
  /^(?:ferner|außerdem|darüber hinaus)\s+wird\s+(?:diskutiert|gefragt),?\s*(?:wie\s+)?/i,
  /^es\s+gibt\s+(?:(?:mehrere|viele|konkrete)\s+)?(?:bitten|nachfragen|fragen)\s+(?:um|zur|zum|zu den|zu der|zu)\s+/i,
  /^(?:(?:mehrere|viele)\s+)?teilnehmende\s+(?:bitten|erbitten)\s+um\s+/i,
  /^ein(?:e)?\s+(?:studierende[rs]?|teilnehmer(?:in)?|person)\s+(?:fragt nach|bittet um)\s+/i,
  /^es\s+wird\s+nach\s+/i,
  /^participants\s+(?:ask|request|are asking)(?:\s+for)?\s+/i,
  /^furthermore it is (?:asked|discussed),?\s*(?:how\s+)?/i,
  /^there are (?:concrete )?(?:questions|inquiries) (?:about|on|regarding)\s+/i,
  /^(?:plusieurs )?(?:participant(?:e)?s?|étudiant(?:e)?s?) (?:demandent|souhaitent)\s+/i,
  /^on (?:demande|discute)(?: aussi)?,?\s*(?:comment\s+|de\s+)?/i,
  /^(?:varios |varias )?participantes (?:piden|solicitan)\s+/i,
  /^(?:più )?(?:partecipanti|studenti) (?:chiedono|richiedono)\s+/i,
];

const TOPIC_RULES: readonly { re: RegExp; topic: (match: RegExpMatchArray) => string }[] = [
  { re: /kapitel\s+(\d+)/i, topic: (match) => `Kapitel ${match[1]}` },
  { re: /chapter\s+(\d+)/i, topic: (match) => `Chapter ${match[1]}` },
  { re: /chapitre\s+(\d+)/i, topic: (match) => `Chapitre ${match[1]}` },
  { re: /cap[ií]tulo\s+(\d+)/iu, topic: (match) => `Capítulo ${match[1]}` },
  { re: /capitolo\s+(\d+)/i, topic: (match) => `Capitolo ${match[1]}` },
  { re: /(?<!\p{L})medians?(?!\p{L})/iu, topic: () => 'Median' },
  { re: /(?<!\p{L})médiane(?!\p{L})/iu, topic: () => 'Médiane' },
  { re: /(?<!\p{L})mediana(?!\p{L})/iu, topic: () => 'Mediana' },
  { re: /(?<!\p{L})übungen?(?!\p{L})/iu, topic: () => 'Übungen' },
  { re: /(?<!\p{L})exercices?(?!\p{L})/iu, topic: () => 'Exercices' },
  { re: /(?<!\p{L})ejercicios?(?!\p{L})/iu, topic: () => 'Ejercicios' },
  { re: /(?<!\p{L})esercizi(?!\p{L})/iu, topic: () => 'Esercizi' },
  { re: /(?<!\p{L})exercises?(?!\p{L})/iu, topic: () => 'Exercises' },
  { re: /(?<!\p{L})klausur(?:relevanz)?(?!\p{L})/iu, topic: () => 'Klausur' },
  { re: /(?<!\p{L})beispiele?(?!\p{L})/iu, topic: () => 'Beispiele' },
  { re: /(?<!\p{L})examples?(?!\p{L})/iu, topic: () => 'Examples' },
  { re: /(?<!\p{L})formel(?:sammlung)?(?!\p{L})/iu, topic: () => 'Formel' },
  { re: /(?<!\p{L})visualisierung(?:en)?(?!\p{L})/iu, topic: () => 'Visualisierung' },
];

const EXISTING_LEAD_RE = /^(.{2,36}?)[:：]\s+(.+)$/u;

const FUNCTION_WORDS = new Set([
  'und',
  'oder',
  'sowie',
  'von',
  'zu',
  'zum',
  'zur',
  'bei',
  'mit',
  'für',
  'um',
  'nach',
  'als',
  'wie',
  'inklusive',
  'mitsamt',
  'der',
  'die',
  'das',
  'dem',
  'den',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'eines',
  'and',
  'or',
  'of',
  'to',
  'the',
  'a',
  'an',
  'for',
  'with',
  'about',
  'et',
  'ou',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'un',
  'une',
  'y',
  'o',
  'del',
  'el',
  'los',
  'las',
  'e',
  'di',
  'della',
  'il',
  'lo',
  'i',
  'gli',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectTopic(text: string): string | null {
  for (const rule of TOPIC_RULES) {
    const match = text.match(rule.re);
    if (match) {
      return rule.topic(match);
    }
  }
  return null;
}

function matchesProtocolPrefix(text: string): boolean {
  return PROTOCOL_PREFIXES.some((prefix) => prefix.test(text));
}

function stripProtocolPrefix(text: string): string {
  let rest = text;
  for (const prefix of PROTOCOL_PREFIXES) {
    rest = rest.replace(prefix, '');
  }
  return rest
    .replace(/\s+gefragt[.!?]?$/i, '')
    .replace(/^[.;,:\s]+/, '')
    .trim();
}

function normalizePhrases(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\bund der dazu passenden\b/gi, ' und')
    .replace(/\beine (?:erneute |detailliertere )?Erklärung von\b/gi, 'Wiederholung')
    .replace(/\berneute Erklärung\b/gi, 'Wiederholung')
    .replace(/\bzusätzliche(?:s|n)?\b/gi, '')
    .replace(/\bkonkrete[ns]?\b/gi, '')
    .replace(/\bgenaue[ns]?\b/gi, '')
    .replace(/\bmitsamt\b/gi, 'und')
    .replace(/\binklusive\b/gi, 'und')
    .replace(/\s+die Planbarkeit\b[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTrailingFunctionWords(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  while (
    words.length > 0 &&
    FUNCTION_WORDS.has(words[words.length - 1]?.toLocaleLowerCase() ?? '')
  ) {
    words.pop();
  }
  return words.join(' ');
}

const DANGLING_ADJECTIVES = new Set([
  'kommenden',
  'nächsten',
  'weiteren',
  'zusätzlichen',
  'jeweiligen',
]);

function stripIncompleteTail(text: string): string {
  let clause = stripTrailingFunctionWords(text.replace(/[.;!?]+$/g, '').trim());
  const words = clause.split(/\s+/).filter(Boolean);
  const last = words[words.length - 1]?.toLocaleLowerCase() ?? '';
  if (DANGLING_ADJECTIVES.has(last)) {
    words.pop();
    clause = stripTrailingFunctionWords(words.join(' '));
  }
  return clause;
}

function tidyClause(text: string): string {
  let clause = text.replace(/\s+/g, ' ').trim();
  clause = clause.replace(
    /\b(?:von|zu|zum|zur|mit|über|nach|bei|für|um)\s+(?:und|oder|sowie|,)\b/gi,
    ',',
  );
  clause = clause.replace(/\s+und\s+(?=von|zu|zur|zum)\b/gi, ' ');
  clause = clause.replace(/\b(?:des|der|die|das|dem|den)\s+(,|und)\b/gi, '$1');
  clause = clause.replace(/,(?!\s*\p{Lu})/gu, ' und');
  clause = clause.replace(/,\s+([^,]{1,60})$/u, ' und $1');
  clause = clause.replace(/\s*,\s*,+/g, ',');
  clause = clause.replace(/\s+,/g, ',');
  clause = clause.replace(/,(?!\s)/g, ', ');
  clause = clause.replace(/\s+und\s+und\b/gi, ' und');
  clause = clause.replace(/\bund\s+rechtzeitigem\s+Feedback\b/gi, 'und rechtzeitiges Feedback');
  clause = clause.replace(/\s+/g, ' ').trim();
  clause = clause.replace(/^[,.:;]+|[,.:;]+$/g, '').trim();
  clause = stripIncompleteTail(clause);
  clause = clause.replace(/^(?:der|die|das|dem|den|des|ein|eine)\s+/i, '').trim();
  clause = clause.replace(/^(.+?) und (.+?) und (.+)$/u, '$1, $2 und $3');

  const words = clause.split(/\s+/).filter(Boolean);
  if (words.length > MAX_CLAUSE_WORDS) {
    let cut = words.slice(0, MAX_CLAUSE_WORDS);
    while (cut.length > 3 && FUNCTION_WORDS.has(cut[cut.length - 1]?.toLocaleLowerCase() ?? '')) {
      cut = cut.slice(0, -1);
    }
    clause = stripTrailingFunctionWords(cut.join(' '));
  }

  if (clause) {
    clause = clause.replace(/^\p{Ll}/u, (letter) => letter.toLocaleUpperCase('de-DE'));
    if (!/[.!?]$/.test(clause)) {
      clause = `${clause}.`;
    }
  }
  return clause;
}

function dropTopicFromClause(clause: string, topic: string): string {
  const topicPattern = escapeRegExp(topic);
  const withoutTopic = clause
    .replace(
      new RegExp(
        `\\b(?:des|der|die|das|dem|den|von|zu|zur|zum)?\\s*${topicPattern}s?(?!\\p{L})`,
        'giu',
      ),
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  return tidyClause(withoutTopic);
}

function formatLeadClause(lead: string, body: string): string {
  const stripped = stripProtocolPrefix(normalizePhrases(body));
  const clause = dropTopicFromClause(stripped, lead) || tidyClause(stripped);
  return clause ? `${lead}: ${clause}` : lead;
}

/** Converts a model sentence into a host-scan bullet without changing source binding. */
export function toQaSummaryScanBullet(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return normalized;
  }

  const existing = normalized.match(EXISTING_LEAD_RE);
  if (existing) {
    const lead = existing[1]?.trim() ?? '';
    const body = existing[2]?.trim() ?? '';
    if (
      lead &&
      body &&
      !lead.includes('.') &&
      lead.split(/\s+/).length <= MAX_LEAD_WORDS &&
      !/\d{1,2}:\d{2}$/.test(lead)
    ) {
      return formatLeadClause(lead, body);
    }
  }

  if (/^[„«"«]/.test(normalized) && normalized.length <= 140) {
    return normalized;
  }

  const protocol = matchesProtocolPrefix(normalized);
  if (!protocol && normalized.length < 80) {
    return normalized;
  }

  const topic = detectTopic(normalized);
  const rest = stripProtocolPrefix(normalizePhrases(normalized));
  if (!topic) {
    return tidyClause(rest) || normalized;
  }

  const clause = dropTopicFromClause(rest, topic) || tidyClause(rest);
  return clause ? `${topic}: ${clause}` : normalized;
}

export { sortQaSummaryStatementsByImportance } from './qa-summary-rank';
