/**
 * ProductFeedback Survey-Helfer (Story 12.1).
 * Definitionen und Validierung liegen in @arsnova/shared-types.
 */
import { createHash } from 'node:crypto';
import {
  getProductFeedbackSurveyDefinition,
  isAreaAllowedForSurvey,
  isPrimaryAnswerAllowedForSurvey,
  resolveProductFeedbackAreaPromptKind,
  type ProductFeedbackPrimaryAnswer,
  type ProductFeedbackRole,
  type ProductFeedbackSurveyDTO,
  type ProductFeedbackSurveyKey,
} from '@arsnova/shared-types';

export function resolveAreaPromptKind(primaryAnswer: ProductFeedbackPrimaryAnswer) {
  return resolveProductFeedbackAreaPromptKind(primaryAnswer);
}

export function getSurveyDefinition(
  surveyKey: ProductFeedbackSurveyKey,
  primaryAnswer?: ProductFeedbackPrimaryAnswer,
): ProductFeedbackSurveyDTO {
  return getProductFeedbackSurveyDefinition(surveyKey, primaryAnswer);
}

/** Deterministische Alternation Ease/Value anhand Rolle + Salt. */
export function assignSurveyKey(role: ProductFeedbackRole, salt: string): ProductFeedbackSurveyKey {
  const digest = createHash('sha256').update(`${role}:${salt}`, 'utf8').digest();
  const pickEase = digest[0]! % 2 === 0;
  if (role === 'HOST') {
    return pickEase ? 'POST_SESSION_EASE_HOST_V1' : 'POST_SESSION_VALUE_HOST_V1';
  }
  return pickEase ? 'POST_SESSION_EASE_PARTICIPANT_V1' : 'POST_SESSION_VALUE_PARTICIPANT_V1';
}

export function isValidPrimaryAnswerForSurvey(
  surveyKey: ProductFeedbackSurveyKey,
  primaryAnswer: ProductFeedbackPrimaryAnswer,
): boolean {
  return isPrimaryAnswerAllowedForSurvey(surveyKey, primaryAnswer);
}

export function isValidAreaForSurvey(surveyKey: ProductFeedbackSurveyKey, area: string): boolean {
  return isAreaAllowedForSurvey(surveyKey, area);
}
