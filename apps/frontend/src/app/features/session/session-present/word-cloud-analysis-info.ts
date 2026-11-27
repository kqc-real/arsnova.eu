import type {
  AnalyzeWordCloudOutput,
  WordCloudAnalysisVariant,
  WordCloudLabelOrigin,
} from '@arsnova/shared-types';
import { textAnalysisCopy as copy } from '../../../shared/text-analysis/text-analysis-copy';

export type WordCloudAnalysisInfo = {
  readonly mode: WordCloudAnalysisVariant;
  readonly result: AnalyzeWordCloudOutput | null;
  readonly namingPending?: boolean;
  readonly stale?: boolean;
  readonly notice?: string | null;
  readonly busy?: boolean;
};

export function wordCloudAnalysisInfo(
  analysis: WordCloudAnalysisInfo,
  visible: readonly { readonly labelOrigin?: WordCloudLabelOrigin }[],
): { status: string | null; description: string; details: readonly string[] } {
  const { mode, result, namingPending, stale, notice, busy } = analysis;
  const description =
    mode === 'SEMANTIC' ? copy.topicsInfo : mode === 'THEME' ? copy.phrasesInfo : copy.wordsInfo;
  const statusLines: { short: string; detail: string }[] = [];
  const semantic = mode === 'SEMANTIC' && result?.mode === 'SEMANTIC' && !result.fallbackUsed;
  const details = mode === 'SEMANTIC' ? [copy.topicNamingInfo] : [copy.smoothInfo];

  if (stale) statusLines.push({ short: copy.corpusStaleShort, detail: copy.corpusStale });
  if (namingPending) statusLines.push({ short: copy.topicPreviewShort, detail: copy.topicPreview });
  if (semantic && result.reuse?.snapshot)
    statusLines.push({ short: copy.snapshotReusedShort, detail: copy.snapshotReused });
  if (semantic && visible.length) {
    const count = visible.filter((entry) => entry.labelOrigin === 'model').length;
    if (count === visible.length)
      statusLines.push({ short: copy.allModelShort, detail: copy.allModel });
    else if (count) statusLines.push({ short: copy.someModelShort, detail: copy.someModel });
    else if (visible.every((entry) => entry.labelOrigin === 'extractive'))
      statusLines.push({ short: copy.allExtractiveShort, detail: copy.allExtractive });
    else statusLines.push({ short: copy.unknownOrigin, detail: copy.unknownOrigin });
  }
  if (result?.normalizationApplied === 'LEMMA')
    statusLines.push({ short: copy.normalizationShort, detail: copy.normalizationDone });
  if (result?.reuse?.preview) details.push(copy.groupingReused);
  if (notice && !stale) details.push(notice);
  details.push(...statusLines.map(({ detail }) => detail));
  if (semantic && !namingPending) {
    if (result.labelSettlement === 'disabled') details.push(copy.labelsDisabled);
    else if (result.labelFallbackReason === 'busy') details.push(copy.slotMissed);
    else if (result.labelFallbackReason === 'timeout') details.push(copy.labelTimeout);
    else if (result.labelFallbackReason === 'invalid_response') details.push(copy.invalidLabel);
    else if (
      result.labelSettlement === 'transient' ||
      (result.topicLabelsPending === false && !result.labelSettlement)
    )
      details.push(copy.labelUnavailable);
  }
  const uncertainWithUnknownNames =
    result?.status === 'uncertain' && visible.every((entry) => !entry.labelOrigin);
  const compactStatus =
    uncertainWithUnknownNames && !stale && !namingPending
      ? (notice ?? statusLines[0]?.short)
      : (statusLines[0]?.short ?? notice);
  return {
    status: busy ? null : (compactStatus ?? null),
    description,
    details,
  };
}
