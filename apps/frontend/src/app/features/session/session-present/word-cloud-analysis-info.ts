import type {
  AnalyzeWordCloudOutput,
  WordCloudAnalysisEntryDTO,
  WordCloudAnalysisVariant,
} from '@arsnova/shared-types';
import { textAnalysisCopy as copy } from '../../../shared/text-analysis/text-analysis-copy';
import { wordCloudTopicProgressLabel } from './word-cloud.util';

export type WordCloudTopicFreshness = 'changed' | 'new';

type WordCloudTopicAnalysisState = {
  readonly progress: 'searching' | 'refreshing' | null;
  readonly freshness: WordCloudTopicFreshness | null;
  readonly failed: boolean;
  readonly outcome: 'uncertain' | 'no_shared_topics' | 'fallback' | 'disabled' | null;
  readonly channel: 'qa' | 'freetext';
};

export type WordCloudAnalysisInfo = {
  readonly mode: WordCloudAnalysisVariant;
  readonly result: AnalyzeWordCloudOutput | null;
  readonly namingPending?: boolean;
  readonly topicState?: WordCloudTopicAnalysisState | null;
  readonly phraseFallbackHint?: string | null;
};

export function displayedWordCloudResult(
  entries: readonly WordCloudAnalysisEntryDTO[] | null,
  ...candidates: readonly (AnalyzeWordCloudOutput | null)[]
): AnalyzeWordCloudOutput | null {
  if (!entries?.length) return null;
  return (
    candidates.find((result) => result?.entries.some((entry) => entries.includes(entry))) ?? null
  );
}

export function wordCloudTopicAnalysisState(input: {
  channel: 'qa' | 'freetext';
  result: AnalyzeWordCloudOutput | null;
  hasSources: boolean;
  pending: boolean;
  previousTopics: boolean;
  failed: boolean;
  freshness: WordCloudTopicFreshness | null;
  unsupportedLocale?: boolean;
}): WordCloudTopicAnalysisState | null {
  if (!input.hasSources) return null;
  const { channel, result, freshness } = input;
  const progress = input.pending ? (input.previousTopics ? 'refreshing' : 'searching') : null;
  const failed = !progress && (input.failed || result?.status === 'failed');
  let outcome: WordCloudTopicAnalysisState['outcome'] = null;
  if (!progress && !failed) {
    if (result?.status === 'fallback') {
      outcome =
        result.semanticFallbackReason === 'no_shared_topics' || result.modelVersion
          ? 'no_shared_topics'
          : 'fallback';
    } else if (result?.status === 'uncertain') {
      outcome = 'uncertain';
    } else if (result?.status === 'disabled') {
      outcome = 'disabled';
    } else if (!result && input.unsupportedLocale) {
      outcome = 'fallback';
    }
  }
  return { channel, progress, freshness, failed, outcome };
}

function topicOutcomeHint(state: WordCloudTopicAnalysisState): string | null {
  switch (state.outcome) {
    case 'uncertain':
      return state.channel === 'qa'
        ? $localize`:@@sessionQa.wordCloudSemanticUncertainHint:Einige Themen sind unsicher. Prüfe die Mitgliedsfragen.`
        : $localize`:@@sessionWordCloud.freetextSemanticUncertainHint:Einige Themen sind unsicher. Prüfe die zugehörigen Antworten.`;
    case 'no_shared_topics':
      return copy.noSharedTopics;
    case 'fallback':
      return $localize`:@@sessionQa.wordCloudSemanticFallbackHint:Ähnliche Beiträge lassen sich gerade nicht zuverlässig zusammenfassen. Stattdessen werden Wörter oder Wortgruppen gezeigt.`;
    case 'disabled':
      return $localize`:@@sessionQa.wordCloudSemanticDisabledHint:Themen sind hier nicht verfügbar. Nutze Wörter oder Wortgruppen.`;
    default:
      return null;
  }
}

function topicFailureHint(): string {
  return $localize`:@@sessionQa.wordCloudSemanticFailedHint:Themen konnten gerade nicht aktualisiert werden. Nutze die bisherige Ansicht oder versuche es erneut.`;
}

function topicFreshnessHint(freshness: WordCloudTopicFreshness | null): string | null {
  if (freshness === 'new') return copy.newResponses;
  return freshness === 'changed' ? copy.corpusStale : null;
}

export function wordCloudTopicAnalysisHint(
  state: WordCloudTopicAnalysisState | null,
): string | null {
  if (!state) return null;
  if (state.progress) return wordCloudTopicProgressLabel(state.progress === 'refreshing');
  if (state.failed) return topicFailureHint();
  return topicFreshnessHint(state.freshness) ?? topicOutcomeHint(state);
}

export function wordCloudAnalysisInfo(
  analysis: WordCloudAnalysisInfo,
  visible: readonly Pick<WordCloudAnalysisEntryDTO, 'key' | 'labelOrigin'>[],
): {
  status: string | null;
  description: string;
  process: string | null;
  details: readonly string[];
} {
  const { mode, result, namingPending, topicState, phraseFallbackHint } = analysis;
  const description =
    mode === 'SEMANTIC' ? copy.topicsInfo : mode === 'THEME' ? copy.phrasesInfo : copy.wordsInfo;
  const statusLines: { short: string; detail: string }[] = [];
  const semantic = result?.mode === 'SEMANTIC' && !result.fallbackUsed;
  const details = mode === 'SEMANTIC' ? [] : [copy.smoothInfo];

  if (topicState?.freshness) {
    statusLines.push(
      topicState.freshness === 'new'
        ? { short: copy.newResponsesShort, detail: copy.newResponses }
        : { short: copy.corpusStaleShort, detail: copy.corpusStale },
    );
  }
  const outcome = topicState ? topicOutcomeHint(topicState) : null;
  if (topicState?.failed) {
    statusLines.push({ short: copy.topicUpdateFailed, detail: topicFailureHint() });
  }
  if (outcome && topicState?.outcome !== 'uncertain') {
    statusLines.push({ short: outcome, detail: outcome });
  }
  if (namingPending) statusLines.push({ short: copy.topicPreviewShort, detail: copy.topicPreview });
  if (semantic && result.reuse?.snapshot) details.push(copy.snapshotReused);
  if (semantic && visible.length) {
    const count = visible.filter((entry) => entry.labelOrigin === 'model').length;
    if (count === visible.length)
      statusLines.push({ short: copy.allModelShort, detail: copy.allModel });
    else if (count) statusLines.push({ short: copy.someModel, detail: copy.someModel });
    else if (visible.every((entry) => entry.labelOrigin === 'extractive'))
      statusLines.push({ short: copy.allExtractiveShort, detail: copy.allExtractive });
    else statusLines.push({ short: copy.unknownOrigin, detail: copy.unknownOrigin });
  }
  if (
    result?.normalizationApplied === 'LEMMA' &&
    result.entries.some((entry) => visible.some(({ key }) => key === entry.key))
  )
    statusLines.push({ short: copy.normalizationShort, detail: copy.normalizationDone });
  if (result?.reuse?.preview) details.push(copy.groupingReused);
  if (phraseFallbackHint) details.push(phraseFallbackHint);
  if (topicState?.progress)
    details.push(wordCloudTopicProgressLabel(topicState.progress === 'refreshing'));
  if (topicState?.outcome === 'uncertain' && outcome) details.push(outcome);
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
    topicState?.outcome === 'uncertain' && visible.every((entry) => !entry.labelOrigin);
  const compactStatus =
    uncertainWithUnknownNames && !topicState?.freshness && !namingPending
      ? (outcome ?? statusLines[0]?.short)
      : (statusLines[0]?.short ?? outcome ?? phraseFallbackHint);
  return {
    status: topicState?.progress ? null : (compactStatus ?? null),
    description,
    process: mode === 'SEMANTIC' ? copy.topicProcess : null,
    details,
  };
}
