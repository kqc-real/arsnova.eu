import {
  QUIZ_UPLOAD_MAX_OPTIONS_PER_QUESTION,
  QUIZ_UPLOAD_MAX_PAYLOAD_BYTES,
  QUIZ_UPLOAD_MAX_QUESTIONS,
  type QuizUploadInput,
} from '@arsnova/shared-types';

export const PUBLIC_CREATE_WINDOW_SECONDS = 60 * 60;
export const QUIZ_UPLOAD_MAX_COMPLEXITY =
  1 + QUIZ_UPLOAD_MAX_QUESTIONS * (1 + QUIZ_UPLOAD_MAX_OPTIONS_PER_QUESTION);

/**
 * Gemeinsames W1.3-Speicherbudget:
 * - höchstens 600 persistierte Quiz-Uploads je festem Stundenfenster,
 * - zusätzlich 64 MiB serialisierte Nutzlast und 100.000 Frage-/Optionsknoten,
 * - Cleanup-Kapazität 1.300 Uploads je Stundenlauf.
 *
 * 1.300 liegt über dem maximalen Zwei-Fenster-Burst von 1.200 Uploads, der
 * innerhalb eines beliebigen 60-Minuten-Intervalls bei festen Redis-Fenstern
 * möglich ist. Die Byte-/Komplexitätsbudgets begrenzen große Uploads deutlich
 * früher. Alle Werte sind absichtlich statisch bounded.
 */
export const QUIZ_UPLOAD_ACCEPTED_GLOBAL_PER_WINDOW_DEFAULT = 600;
export const QUIZ_UPLOAD_ACCEPTED_PER_IP_PER_WINDOW_DEFAULT = 300;
export const QUIZ_UPLOAD_ATTEMPT_GLOBAL_PER_WINDOW_DEFAULT = 1_200;
export const QUIZ_UPLOAD_ATTEMPT_PER_IP_PER_WINDOW_DEFAULT = 600;
export const QUIZ_UPLOAD_GLOBAL_BYTES_PER_WINDOW_DEFAULT = 64 * 1024 * 1024;
export const QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_WINDOW_DEFAULT = 100_000;

if (
  QUIZ_UPLOAD_GLOBAL_BYTES_PER_WINDOW_DEFAULT < QUIZ_UPLOAD_MAX_PAYLOAD_BYTES ||
  QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_WINDOW_DEFAULT < QUIZ_UPLOAD_MAX_COMPLEXITY
) {
  throw new Error('Public-Create-Budget muss mindestens einen maximalen Quiz-Upload erlauben.');
}

export const ORPHAN_QUIZ_UPLOAD_GRACE_HOURS = 24;
export const ORPHAN_QUIZ_CLEANUP_BATCH_SIZE = 100;
export const ORPHAN_QUIZ_CLEANUP_MAX_BATCHES = 13;
export const ORPHAN_QUIZ_CLEANUP_CAPACITY_PER_RUN =
  ORPHAN_QUIZ_CLEANUP_BATCH_SIZE * ORPHAN_QUIZ_CLEANUP_MAX_BATCHES;
/**
 * Pro History-Scope bleiben nach der Grace Period höchstens so viele
 * sessionlose Uploadkopien erhalten, solange irgendeine Kopie des Scopes
 * noch eine Session besitzt. Direkt sessiongebundene Quizzes sind davon
 * unberührt. Ohne Session-Anker im Scope werden alle sessionlosen Kopien
 * nach der Grace Period gelöscht — der Scope-Anker allein schützt also
 * keine unbegrenzte Geschwistermenge.
 */
export const ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE = 5;

export function calculateQuizUploadComplexity(input: Pick<QuizUploadInput, 'questions'>): number {
  return (
    1 +
    input.questions.length +
    input.questions.reduce((sum, question) => sum + question.answers.length, 0)
  );
}
