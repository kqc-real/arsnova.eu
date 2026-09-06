/**
 * ProductFeedback Story 12.3 — Markdown-Export mit Auswertungsprompt.
 * Kein Modellaufruf; Datei ist zum Einfügen in ein externes LLM gedacht.
 */
import {
  PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
  PRODUCT_FEEDBACK_LLM_EXPORT_MAX_CASES,
  PRODUCT_FEEDBACK_LLM_EXPORT_PROMPT_VERSION,
  type AdminProductFeedbackLlmExportInput,
  type AdminProductFeedbackLlmExportOutput,
  type AdminProductFeedbackStatsDTO,
  type AdminProductFeedbackTriageStatsDTO,
} from '@arsnova/shared-types';
import { productFeedbackLabel } from './productFeedbackLabels';

const SESSION_CODE_RE = /\b[A-Z0-9]{6}\b/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_RE = /https?:\/\/\S+/i;

export type ProductFeedbackLlmExportRow = {
  id: string;
  createdAt: Date;
  duplicateOfId: string | null;
  duplicateCount: number;
  source: string;
  role: string;
  kind: string | null;
  primaryAnswer: string | null;
  area: string;
  impact: string | null;
  locale: string;
  deviceClass: string | null;
  sessionPhase: string | null;
  activeChannel: string | null;
  appVersion: string | null;
  message: string | null;
  quarantineStatus: string;
  triageStatus: string;
};

export type ProductFeedbackLlmExportCase = {
  exportId: string;
  createdAt: Date;
  source: string;
  role: string;
  signal: string;
  area: string;
  impact: string;
  deviceClass: string;
  locale: string;
  sessionPhase: string;
  activeChannel: string;
  clusterSize: number;
  message: string | null;
  messageOmitted: 'quarantine' | 'sensitive' | null;
};

export function looksLikeSensitiveFreeText(message: string): boolean {
  if (EMAIL_RE.test(message) || URL_RE.test(message)) return true;
  const codeMatch = message.toUpperCase().match(SESSION_CODE_RE);
  if (!codeMatch) return false;
  const token = codeMatch[0] ?? '';
  return /\d/.test(token) && /[A-Z]/.test(token);
}

export function buildProductFeedbackLlmExportPrompt(): string {
  return [
    'Du bist Produktanalyst:in für arsnova.eu, ein account-armes Audience-Response-System für Vorlesungssäle (Quiz, Q&A, Blitzlicht, Host- und Teilnehmenden-UI). Es gibt keine Nutzerkonten im Lehrbetrieb.',
    '',
    'Die folgenden Daten sind anonyme Produktsignale. Sie sind NICHT die Session-Bewertung („Wie hat dir das Quiz gefallen?“) und NICHT Blitzlicht-Stimmungsabgaben.',
    '',
    'Quellen:',
    '- POST_SESSION: Zwei-Klick nach Sessionende (Leichtigkeit oder Nutzen, plus Bereich).',
    '- IN_APP: „arsnova.eu verbessern“ (Art plus Bereich, optional Auswirkung und ein Satz Text).',
    '',
    'Regeln:',
    '1. Erfinde keine Zitate, keine Fälle und keine Kennzahlen.',
    '2. Interpretiere Schlüssel nur über das Lexikon in dieser Datei.',
    `3. Nenne ein Thema erst als Trend, wenn mindestens ${PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT} Fälle im Segment liegen. Kleinere Zellen sind Hinweise, keine Trends.`,
    '4. Trenne Host, Teilnehmende und Allgemein. Mische die Perspektiven nicht zu einem gemeinsamen Score.',
    '5. BLOCKED, HARD und NO haben Vorrang in der Darstellung, rechtfertigen aber allein keine Roadmap.',
    '6. Re-identifiziere niemanden. Sessioncodes, Namen, Quizinhalte und IPs kommen in den strukturierten Daten nicht vor. Falls ein Freitext trotzdem so etwas enthält oder als ausgelassen markiert ist, zitiere ihn nicht.',
    '7. Schlage konkrete Produktschnitte vor (betroffene Fläche, Rolle, vermutete Ursache, Unsicherheit), keine allgemeinen UX-Floskeln.',
    '8. Antworte auf Deutsch. Gib ausschließlich die folgenden Abschnitte aus:',
    '',
    '## Kurzlage',
    'Höchstens acht Sätze zur Lage.',
    '',
    '## Themen',
    'Höchstens acht Themen. Je Thema: Name · n · Rollen · Quellen · Schwere (blockierend / Reibung / Lob) · Beleg-IDs (PF-…) · eine satzweise Begründung.',
    '',
    '## Versionssignale',
    'Nur wenn eine App-Version klar vom Rest abweicht; sonst „keine belastbare Abweichung“.',
    '',
    '## Widersprüche und Datenlücken',
    '',
    '## Vorschläge fürs Backlog',
    'Je Vorschlag: Problem, betroffene Fläche, warum jetzt, Unsicherheit.',
    '',
    '## Was das Modell nicht beurteilen kann',
  ].join('\n');
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function cell(value: string | null | undefined): string {
  const raw = productFeedbackLabel(value) ?? '—';
  return raw.replaceAll('|', '/').replaceAll('\n', ' ').trim() || '—';
}

function formatBuckets(buckets: ReadonlyArray<{ key: string; count: number }>): string {
  if (buckets.length === 0) return 'keine Daten';
  return buckets.map((bucket) => `${cell(bucket.key)} ${bucket.count}`).join(' · ');
}

export function resolveExportableMessage(
  row: Pick<ProductFeedbackLlmExportRow, 'message' | 'quarantineStatus'>,
  includeMessages: boolean,
): { text: string | null; omitted: ProductFeedbackLlmExportCase['messageOmitted'] } {
  if (!includeMessages || !row.message) return { text: null, omitted: null };
  if (row.quarantineStatus === 'FLAGGED') return { text: null, omitted: 'quarantine' };
  if (looksLikeSensitiveFreeText(row.message)) return { text: null, omitted: 'sensitive' };
  return { text: row.message, omitted: null };
}

function priority(row: ProductFeedbackLlmExportRow, includeMessages: boolean): number {
  let score = 0;
  if (row.impact === 'BLOCKED') score += 4;
  if (row.primaryAnswer === 'HARD' || row.primaryAnswer === 'NO') score += 2;
  const message = resolveExportableMessage(row, includeMessages);
  if (message.text || message.omitted) score += 1;
  return score;
}

export function selectProductFeedbackLlmExportCases(
  rows: readonly ProductFeedbackLlmExportRow[],
  options: { maxCases?: number; includeMessages: boolean },
): { selected: ProductFeedbackLlmExportCase[]; truncated: boolean; clusterCount: number } {
  const maxCases = options.maxCases ?? PRODUCT_FEEDBACK_LLM_EXPORT_MAX_CASES;
  const canonical = rows.filter((row) => row.duplicateOfId === null);
  const ranked = [...canonical].sort((left, right) => {
    const byPriority =
      priority(right, options.includeMessages) - priority(left, options.includeMessages);
    if (byPriority !== 0) return byPriority;
    const byTime = right.createdAt.getTime() - left.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return right.id.localeCompare(left.id);
  });
  const truncated = ranked.length > maxCases;
  const kept = ranked.slice(0, maxCases).sort((left, right) => {
    const byTime = right.createdAt.getTime() - left.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return right.id.localeCompare(left.id);
  });
  const selected = kept.map((row, index) => {
    const message = resolveExportableMessage(row, options.includeMessages);
    return {
      exportId: `PF-${String(index + 1).padStart(3, '0')}`,
      createdAt: row.createdAt,
      source: row.source,
      role: row.role,
      signal: row.kind ?? row.primaryAnswer ?? 'ALLGEMEIN',
      area: row.area,
      impact: row.impact ?? '—',
      deviceClass: row.deviceClass ?? '—',
      locale: row.locale,
      sessionPhase: row.sessionPhase ?? '—',
      activeChannel: row.activeChannel ?? '—',
      clusterSize: 1 + row.duplicateCount,
      message: message.text,
      messageOmitted: message.omitted,
    };
  });
  return { selected, truncated, clusterCount: canonical.length };
}

export function buildProductFeedbackLlmExportFileName(
  exportedAt: Date,
  from?: string,
  to?: string,
): string {
  const fromDate = from ? isoDate(new Date(from)) : null;
  const toDate = to ? isoDate(new Date(to)) : isoDate(exportedAt);
  if (fromDate && toDate) return `arsnova-product-feedback_${fromDate}_${toDate}.md`;
  return `arsnova-product-feedback_${toDate}.md`;
}

function formatFilterLine(input: AdminProductFeedbackLlmExportInput): string {
  const parts = [
    input.from ? `von ${isoDate(new Date(input.from))}` : null,
    input.to ? `bis ${isoDate(new Date(input.to))}` : null,
    input.source ? `Quelle ${cell(input.source)}` : null,
    input.role ? `Rolle ${cell(input.role)}` : null,
    input.kind ? `Art ${cell(input.kind)}` : null,
    input.area ? `Bereich ${cell(input.area)}` : null,
    input.impact ? `Auswirkung ${cell(input.impact)}` : null,
    input.appVersion ? `Version ${input.appVersion}` : null,
    input.locale ? `Locale ${cell(input.locale)}` : null,
    input.status ? `Status ${cell(input.status)}` : null,
    input.excludeDiscarded ? 'verworfene ausgelassen' : null,
    input.includeMessages ? 'Freitext beigelegt' : 'ohne Freitext',
  ].filter((part): part is string => part !== null);
  return parts.join(' · ') || 'keine Filter';
}

const LEXICON_LINES = [
  'kind: NOT_WORKING=Funktioniert nicht · UNCLEAR=Unklar · MISSING_FEATURE=Fehlende Funktion · PRAISE=Stärke',
  'impact: CONTINUED=Weiterarbeit möglich · RETRIED=erneuter Versuch · BLOCKED=Aufgabe nicht abgeschlossen',
  'primaryAnswer: EASY=Leicht · MINOR_FRICTION=Mit kleinen Hürden · HARD=Schwierig · YES=Ja · PARTIAL=Teilweise · NO=Nein',
  'role: HOST=Host · PARTICIPANT=Teilnehmende · GENERAL=Allgemein',
  'source: POST_SESSION=Nach der Session · IN_APP=In der App',
];

export function buildProductFeedbackLlmExport(args: {
  rows: readonly ProductFeedbackLlmExportRow[];
  stats: AdminProductFeedbackStatsDTO;
  triage: AdminProductFeedbackTriageStatsDTO;
  input: AdminProductFeedbackLlmExportInput;
  canonicalTotal: number;
  exportedAt?: Date;
}): AdminProductFeedbackLlmExportOutput {
  const exportedAt = args.exportedAt ?? new Date();
  const prompt = buildProductFeedbackLlmExportPrompt();
  const selection = selectProductFeedbackLlmExportCases(args.rows, {
    includeMessages: args.input.includeMessages,
  });
  const truncated = selection.truncated || args.canonicalTotal > selection.selected.length;
  const messageCount = selection.selected.filter((item) => item.message !== null).length;
  const tableRows = selection.selected
    .map(
      (item) =>
        `| ${item.exportId} | ${isoDate(item.createdAt)} | ${cell(item.source)} | ${cell(item.role)} | ${cell(item.signal)} | ${cell(item.area)} | ${cell(item.impact)} | ${cell(item.deviceClass)} | ${cell(item.locale)} | ${cell(item.sessionPhase)} | ${cell(item.activeChannel)} | ${item.clusterSize} |`,
    )
    .join('\n');
  const freeTextLines = args.input.includeMessages
    ? selection.selected.flatMap((item) => {
        if (item.message) return [`${item.exportId}: ${item.message.replaceAll('\n', ' ')}`];
        if (item.messageOmitted === 'quarantine') {
          return [`${item.exportId}: [ausgelassen: Quarantäne]`];
        }
        if (item.messageOmitted === 'sensitive') {
          return [`${item.exportId}: [ausgelassen: möglicher Personenbezug]`];
        }
        return [];
      })
    : [];

  const markdown = [
    '# arsnova.eu · ProductFeedback-Export für externe Auswertung',
    '',
    `- Exportiert: ${exportedAt.toISOString()}`,
    `- Promptversion: ${PRODUCT_FEEDBACK_LLM_EXPORT_PROMPT_VERSION}`,
    `- Filter: ${formatFilterLine(args.input)}`,
    `- Fälle in dieser Datei: ${selection.selected.length}`,
    `- Kanonische Treffer im Filter: ${args.canonicalTotal}`,
    `- Cluster in der Datei: ${selection.selected.reduce((sum, item) => sum + item.clusterSize, 0)}`,
    `- Freitexte in dieser Datei: ${messageCount}`,
    `- Gekürzt: ${truncated ? 'ja' : 'nein'}`,
    '',
    '---',
    '',
    '## Anweisung an das Modell',
    '',
    'Kopiere von der nächsten Zeile bis „Ende der Anweisung“, wenn du nur den Prompt brauchst.',
    '',
    prompt,
    '',
    'Ende der Anweisung.',
    '',
    '---',
    '',
    '## Lexikon',
    '',
    ...LEXICON_LINES,
    '',
    '---',
    '',
    '## Aggregate',
    '',
    '### Post-Session',
    '',
    `- Antworten: ${args.stats.totals}`,
    `- Einladungen: ${args.stats.invitationsIssued ?? '—'}`,
    `- Rücklauf: ${
      args.stats.invitationCompletionRate === null
        ? '—'
        : `${Math.round(args.stats.invitationCompletionRate * 1000) / 10} %`
    }`,
    `- Kurzbewertung: ${formatBuckets(args.stats.byPrimaryAnswer)}`,
    `- Bereiche: ${formatBuckets(args.stats.byArea)}`,
    `- Perspektive: ${formatBuckets(args.stats.byRole)}`,
    `- App-Version: ${formatBuckets(args.stats.byAppVersion)}`,
    '',
    '### In-App-Triage',
    '',
    `- Rückmeldungen: ${args.triage.totals}`,
    `- davon blockierend: ${args.triage.blocking}`,
    `- nach Art: ${formatBuckets(args.triage.byKind)}`,
    `- nach Bereich: ${formatBuckets(args.triage.byArea)}`,
    `- nach Status: ${formatBuckets(args.triage.byStatus)}`,
    `- nach App-Version: ${formatBuckets(args.triage.byAppVersion)}`,
    '',
    '---',
    '',
    '## Fälle',
    '',
    '| ID | Datum | Quelle | Rolle | Signal | Bereich | Auswirkung | Gerät | Locale | Phase | Kanal | Cluster |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    tableRows || '| — | — | — | — | — | — | — | — | — | — | — | — |',
    '',
    ...(args.input.includeMessages
      ? [
          '### Freitexte',
          '',
          ...(freeTextLines.length > 0
            ? freeTextLines
            : ['Keine beilegbaren Freitexte in dieser Auswahl.']),
          '',
        ]
      : [
          '### Freitexte',
          '',
          'Nicht beigelegt. Strukturierte Fälle reichen für eine erste Lage; Texte nur mit bewusstem Opt-in exportieren.',
          '',
        ]),
  ].join('\n');

  return {
    fileName: buildProductFeedbackLlmExportFileName(exportedAt, args.input.from, args.input.to),
    markdown,
    prompt,
    promptVersion: PRODUCT_FEEDBACK_LLM_EXPORT_PROMPT_VERSION,
    caseCount: selection.selected.length,
    clusterCount: selection.clusterCount,
    messageCount,
    truncated,
    includeMessages: args.input.includeMessages,
  };
}
