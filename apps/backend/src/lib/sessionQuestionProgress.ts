import { Prisma } from '@prisma/client';
import {
  SessionQuestionProgressMapSchema,
  type SessionQuestionProgressMap,
} from '@arsnova/shared-types';

export type SessionQuestionRef = { id: string; order: number };

/**
 * Persistierte JSON-Werte werden defensiv gelesen. Ungültige oder fehlende Legacy-Daten
 * ergeben eine leere Map; `questionProgressComplete` entscheidet separat über den Fallback.
 */
export function parseSessionQuestionProgress(
  value: Prisma.JsonValue | null | undefined,
): SessionQuestionProgressMap {
  const parsed = SessionQuestionProgressMapSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function serializeSessionQuestionProgress(
  progress: SessionQuestionProgressMap,
): Prisma.InputJsonValue {
  return progress as Prisma.InputJsonValue;
}

export function markSessionQuestionOpened(
  progress: SessionQuestionProgressMap,
  questionId: string,
  at: Date,
): SessionQuestionProgressMap {
  if (progress[questionId]) return progress;
  return {
    ...progress,
    [questionId]: { state: 'OPENED', openedAt: at.toISOString() },
  };
}

export function markSessionQuestionCompleted(
  progress: SessionQuestionProgressMap,
  questionId: string,
  at: Date,
): SessionQuestionProgressMap {
  const existing = progress[questionId];
  if (existing?.state === 'SKIPPED' || existing?.state === 'COMPLETED') return progress;
  const completedAt = at.toISOString();
  return {
    ...progress,
    [questionId]: {
      state: 'COMPLETED',
      openedAt: existing?.openedAt ?? completedAt,
      completedAt,
    },
  };
}

export function markSessionQuestionSkipped(
  progress: SessionQuestionProgressMap,
  questionId: string,
  at: Date,
): SessionQuestionProgressMap {
  const existing = progress[questionId];
  if (existing?.state === 'SKIPPED') return progress;
  const skippedAt = at.toISOString();
  return {
    ...progress,
    [questionId]: {
      state: 'SKIPPED',
      openedAt: existing?.openedAt ?? skippedAt,
      skippedAt,
    },
  };
}

export function getSkippedSessionQuestionIds(progress: SessionQuestionProgressMap): Set<string> {
  return new Set(
    Object.entries(progress)
      .filter(([, entry]) => entry.state === 'SKIPPED')
      .map(([questionId]) => questionId),
  );
}

/**
 * Neue Sessions (`complete=true`) enthalten nur tatsächlich geöffnete Fragen.
 * Für Legacy-Sessions bleibt das frühere Vollvorlagen-Verhalten erhalten, ausdrücklich
 * ausgelassene Fragen werden aber auch dort zuverlässig entfernt.
 */
export function getIncludedSessionQuestionIds(
  questions: readonly SessionQuestionRef[],
  progress: SessionQuestionProgressMap,
  complete: boolean,
): Set<string> {
  if (!complete) {
    const skipped = getSkippedSessionQuestionIds(progress);
    return new Set(questions.filter((question) => !skipped.has(question.id)).map(({ id }) => id));
  }
  return new Set(
    questions
      .filter((question) => {
        const state = progress[question.id]?.state;
        return state === 'OPENED' || state === 'COMPLETED';
      })
      .map(({ id }) => id),
  );
}

export function getSessionQuestionProgressSummary(
  questions: readonly SessionQuestionRef[],
  progress: SessionQuestionProgressMap,
  complete: boolean,
) {
  const includedQuestionIds = getIncludedSessionQuestionIds(questions, progress, complete);
  const skippedQuestionIds = getSkippedSessionQuestionIds(progress);
  const firstIncludedQuestion = questions.find((question) => includedQuestionIds.has(question.id));
  return {
    includedQuestionIds,
    skippedQuestionIds,
    totalQuestionCount: questions.length,
    conductedQuestionCount: includedQuestionIds.size,
    skippedQuestionCount: questions.filter((question) => skippedQuestionIds.has(question.id))
      .length,
    startQuestionOrder: firstIncludedQuestion ? firstIncludedQuestion.order + 1 : undefined,
  };
}

export function findNextUnskippedQuestionIndex(
  questions: readonly SessionQuestionRef[],
  progress: SessionQuestionProgressMap,
  currentIndex: number,
  skipAlreadyOpenedCount = 0,
): number | null {
  let remainingOpenedToSkip = skipAlreadyOpenedCount;
  for (let index = currentIndex + 1; index < questions.length; index += 1) {
    const state = progress[questions[index].id]?.state;
    if (state === 'SKIPPED') continue;
    if (remainingOpenedToSkip > 0 && (state === 'OPENED' || state === 'COMPLETED')) {
      remainingOpenedToSkip -= 1;
      continue;
    }
    return index;
  }
  return null;
}

/**
 * Nächste fachlich folgende Frage. `skipAlreadyOpened` entspricht
 * `skipCurrentResultQuestion` in `session.nextQuestion` (Rückblick → weiter).
 */
export function findFollowingQuestionIndex(
  questions: readonly SessionQuestionRef[],
  progress: SessionQuestionProgressMap,
  complete: boolean,
  currentIndex: number,
  skipAlreadyOpened = false,
): number | null {
  const startIndex = skipAlreadyOpened && !complete ? currentIndex + 1 : currentIndex;
  const skipOpenedCount = skipAlreadyOpened && complete ? 1 : 0;
  return findNextUnskippedQuestionIndex(questions, progress, startIndex, skipOpenedCount);
}

export function findPreviousIncludedQuestionIndex(
  questions: readonly SessionQuestionRef[],
  progress: SessionQuestionProgressMap,
  complete: boolean,
  currentIndex: number,
): number | null {
  const included = getIncludedSessionQuestionIds(questions, progress, complete);
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (included.has(questions[index].id)) return index;
  }
  return null;
}
