import type { QaNlpResult } from '@arsnova/shared-types';
import { classifyQaNlpCascade } from './qaNlpCascade';
import type { QaNlpAnalysisSnapshot } from './qaNlpSnapshot';
import { createStubUnclassifiedQaNlpResult } from './qaNlpResult';

/** Stub ohne Klassifikation; bleibt fuer Tests und bewusste Degradation. */
export async function runStubQaNlpClassifier(
  _snapshot: QaNlpAnalysisSnapshot,
): Promise<QaNlpResult> {
  return createStubUnclassifiedQaNlpResult();
}

/** Gatekeeper plus k-NN-Fallback (ADR-0032 Level 1+2). */
export async function runQaNlpClassifier(snapshot: QaNlpAnalysisSnapshot): Promise<QaNlpResult> {
  return classifyQaNlpCascade(snapshot);
}
