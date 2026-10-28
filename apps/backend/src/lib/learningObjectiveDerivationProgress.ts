import {
  GetLearningObjectiveDerivationProgressInputSchema,
  LearningObjectiveDerivationProgressSchema,
  type GetLearningObjectiveDerivationProgressInput,
  type LearningObjectiveDerivationProgress,
} from '@arsnova/shared-types';
import { getRedis } from '../redis';
import { LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS } from './learningObjectiveDerivation';

const PROGRESS_PREFIX = 'learning-objective-derivation:progress:v1:';
const PROGRESS_TTL_SECONDS =
  Math.ceil(LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS / 1000) + 60;

const StoredProgressSchema = GetLearningObjectiveDerivationProgressInputSchema.extend({
  progress: LearningObjectiveDerivationProgressSchema,
}).strict();

function progressKey(operationId: string): string {
  return `${PROGRESS_PREFIX}${operationId}`;
}

export async function writeLearningObjectiveDerivationProgress(input: {
  readonly operationId: string;
  readonly quizId: string;
  readonly expectedBundleRevision: number;
  readonly schemaVersion: 1;
  readonly progress: LearningObjectiveDerivationProgress;
}): Promise<void> {
  const stored = StoredProgressSchema.parse(input);
  await getRedis().set(
    progressKey(stored.operationId),
    JSON.stringify(stored),
    'EX',
    PROGRESS_TTL_SECONDS,
  );
}

export async function readLearningObjectiveDerivationProgress(
  input: GetLearningObjectiveDerivationProgressInput,
): Promise<LearningObjectiveDerivationProgress | null> {
  const expected = GetLearningObjectiveDerivationProgressInputSchema.parse(input);
  const raw = await getRedis().get(progressKey(expected.operationId));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const stored = StoredProgressSchema.safeParse(parsed);
  if (!stored.success) return null;
  if (
    stored.data.quizId !== expected.quizId ||
    stored.data.expectedBundleRevision !== expected.expectedBundleRevision ||
    stored.data.schemaVersion !== expected.schemaVersion
  ) {
    return null;
  }
  return stored.data.progress;
}
