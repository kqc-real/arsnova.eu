import type { QaNlpResult } from '@arsnova/shared-types';
import type { QaNlpAnalysisSnapshot } from './qaNlpSnapshot';
import { classifyQaNlpSnapshot } from './qaNlpGatekeeper';
import { createStubUnclassifiedQaNlpResult } from './qaNlpResult';

/** Stub ohne Klassifikation; bleibt fuer Tests und bewusste Degradation. */
export async function runStubQaNlpClassifier(
  _snapshot: QaNlpAnalysisSnapshot,
): Promise<QaNlpResult> {
  return createStubUnclassifiedQaNlpResult();
}

/** Gatekeeper auf dem kuratierten Seed-Set (ADR-0032 Level 1). */
export async function runQaNlpClassifier(snapshot: QaNlpAnalysisSnapshot): Promise<QaNlpResult> {
  return classifyQaNlpSnapshot(snapshot);
}
