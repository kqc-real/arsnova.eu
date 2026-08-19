import type { QaNlpResult } from '@arsnova/shared-types';
import type { QaNlpAnalysisSnapshot } from './qaNlpSnapshot';
import { createStubUnclassifiedQaNlpResult } from './qaNlpResult';

/** Stub-Klassifikator ohne Modellartefakt; schreibt unclassified/disabled. */
export async function runStubQaNlpClassifier(
  _snapshot: QaNlpAnalysisSnapshot,
): Promise<QaNlpResult> {
  return createStubUnclassifiedQaNlpResult();
}
