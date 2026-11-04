import { Injectable } from '@angular/core';
import type {
  GetLearningObjectiveDerivationProgressInput,
  GetLearningObjectiveDerivationProgressOutput,
  LearningObjectiveDerivationResult,
  PrepareLearningObjectiveDerivationInput,
  PrepareLearningObjectiveDerivationOutput,
  RunLearningObjectiveDerivationInput,
} from '@arsnova/shared-types';
import { trpc } from '../../../core/trpc.client';

/** Thin typed boundary so the component lifecycle remains independently testable. */
@Injectable({ providedIn: 'root' })
export class LearningObjectiveDerivationClient {
  prepare(
    input: PrepareLearningObjectiveDerivationInput,
  ): Promise<PrepareLearningObjectiveDerivationOutput> {
    return trpc.quiz.prepareLearningObjectiveDerivation.mutate(input);
  }

  derive(
    input: RunLearningObjectiveDerivationInput,
    signal: AbortSignal,
  ): Promise<LearningObjectiveDerivationResult> {
    return trpc.quiz.deriveLearningObjectives.mutate(input, { signal });
  }

  progress(
    input: GetLearningObjectiveDerivationProgressInput,
  ): Promise<GetLearningObjectiveDerivationProgressOutput> {
    return trpc.quiz.getLearningObjectiveDerivationProgress.query(input);
  }
}
