import {
  QaSummaryModelOutputV2Schema,
  type AppLocale,
  type ModerationPromptContextV1,
  type ModerationPromptSource,
  type QaSummaryModelOutputV2,
} from '@arsnova/shared-types';

type LocaleCopy = Readonly<{
  statement: (label: string, kind: ModerationPromptSource['kind']) => string;
  empty: string;
  limitation: string;
}>;

const COPY: Readonly<Record<AppLocale, LocaleCopy>> = {
  de: {
    statement: (label, kind) =>
      kind === 'semantic-topic'
        ? `Häufig genannt: ${label}.`
        : kind === 'qa-question'
          ? label
          : `Wichtiger Punkt: ${label}.`,
    empty: 'Es wurden noch keine offenen Fragen für die Kurzfassung ausgewählt.',
    limitation:
      'Eine ausführliche Zusammenfassung war diesmal nicht möglich. Deshalb werden die wichtigsten Fragen im Wortlaut angezeigt.',
  },
  en: {
    statement: (label, kind) =>
      kind === 'semantic-topic'
        ? `Frequently mentioned: ${label}.`
        : kind === 'qa-question'
          ? label
          : `Important point: ${label}.`,
    empty: 'No unanswered questions have been selected for the summary yet.',
    limitation:
      'A detailed summary was not possible this time, so the most important questions are shown in their original wording.',
  },
  fr: {
    statement: (label, kind) =>
      kind === 'semantic-topic'
        ? `Souvent mentionné : ${label}.`
        : kind === 'qa-question'
          ? label
          : `Point important : ${label}.`,
    empty: 'Aucune question en attente de réponse n’a encore été sélectionnée pour le résumé.',
    limitation:
      'Un résumé détaillé n’a pas été possible cette fois-ci. Les questions les plus importantes sont donc affichées telles qu’elles ont été formulées.',
  },
  es: {
    statement: (label, kind) =>
      kind === 'semantic-topic'
        ? `Mencionado con frecuencia: ${label}.`
        : kind === 'qa-question'
          ? label
          : `Punto importante: ${label}.`,
    empty: 'Aún no se han seleccionado preguntas abiertas para el resumen.',
    limitation:
      'Esta vez no ha sido posible crear un resumen detallado. Por eso se muestran las preguntas más importantes con su redacción original.',
  },
  it: {
    statement: (label, kind) =>
      kind === 'semantic-topic'
        ? `Citato spesso: ${label}.`
        : kind === 'qa-question'
          ? label
          : `Punto importante: ${label}.`,
    empty: 'Non sono ancora state selezionate domande aperte per il riepilogo.',
    limitation:
      'Questa volta non è stato possibile creare un riepilogo dettagliato. Vengono quindi mostrate le domande più importanti nella loro formulazione originale.',
  },
};

function truncateCodePoints(text: string, maxLength: number, collapseWhitespace = true): string {
  const normalized = collapseWhitespace ? text.trim().replace(/\s+/g, ' ') : text.trim();
  const points = [...normalized];
  if (points.length <= maxLength) return points.join('');
  return `${points
    .slice(0, Math.max(0, maxLength - 1))
    .join('')
    .trimEnd()}…`;
}

function extractiveLabel(source: ModerationPromptSource): string | null {
  switch (source.kind) {
    case 'qa-question':
      return source.content.state === 'included' ? source.content.text : null;
    case 'quiz-question':
    case 'learning-objective':
      return source.text;
    case 'semantic-topic':
    case 'quiz-result-aggregate':
    case 'feedback-aggregate':
    case 'compass-signal':
      return source.label;
  }
}

function sourcePriority(source: ModerationPromptSource): number {
  switch (source.kind) {
    case 'semantic-topic':
      return 0;
    case 'qa-question':
      return 1;
    case 'compass-signal':
      return 2;
    case 'learning-objective':
      return 3;
    case 'quiz-result-aggregate':
    case 'feedback-aggregate':
      return 4;
    case 'quiz-question':
      return 5;
  }
}

/**
 * Production fallback: deterministic evidence excerpts only. It deliberately
 * does not invent topic membership, causes, learning states or recommendations.
 */
export function createExtractiveQaSummaryOutput(
  promptContext: ModerationPromptContextV1,
): QaSummaryModelOutputV2 {
  const locale = promptContext.context.locale;
  const copy = COPY[locale];
  const availableCandidates = promptContext.context.sources
    .map((source) => ({ source, label: extractiveLabel(source) }))
    .filter(
      (candidate): candidate is { source: ModerationPromptSource; label: string } =>
        candidate.label !== null && candidate.label.trim().length > 0,
    )
    .sort(
      (left, right) =>
        sourcePriority(left.source) - sourcePriority(right.source) ||
        left.source.id.localeCompare(right.source.id),
    );
  const questionCandidates = availableCandidates.filter(
    ({ source }) => source.kind === 'qa-question',
  );
  const candidates = (
    questionCandidates.length >= 2 ? questionCandidates : availableCandidates
  ).slice(0, 4);

  if (candidates.length === 0) {
    return QaSummaryModelOutputV2Schema.parse({
      status: 'uncertain',
      statements: [],
      suggestedNextSteps: [],
      limitations: [copy.empty, copy.limitation],
      modelVersion: 'extractive-v2',
    });
  }

  return QaSummaryModelOutputV2Schema.parse({
    status: 'ready',
    statements: candidates.map(({ source, label }) => ({
      text: truncateCodePoints(
        copy.statement(truncateCodePoints(label, 320), source.kind),
        400,
        false,
      ),
      sourceIds: [source.id],
    })),
    suggestedNextSteps: [],
    limitations: [copy.limitation],
    modelVersion: 'extractive-v2',
  });
}
