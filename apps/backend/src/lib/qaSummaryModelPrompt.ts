import {
  createGroupedQaSummaryModelWireSchema,
  QA_SUMMARY_REPORTING_OPENING,
  type QaSummaryInferenceRequestV2,
} from '@arsnova/shared-types';

type SummaryPromptDomain = QaSummaryInferenceRequestV2['promptContext']['context'];

export function summarySourceRefs(context: SummaryPromptDomain): Map<string, string> {
  return new Map(context.sources.map(({ id }, index) => [id, String(index + 1)]));
}

export function groupedSummaryWireSchema(context: SummaryPromptDomain) {
  if (!context.qaSummaryTopicSourceIds?.length) return null;
  const refs = summarySourceRefs(context);
  const groups = context.qaSummaryTopicSourceIds?.map((group) => group.map((id) => refs.get(id)!));
  const [first, second] = groups ?? [];
  return first ? createGroupedQaSummaryModelWireSchema(context.locale, first, second) : null;
}

export function compactGroupedSummaryContext(context: SummaryPromptDomain): string {
  const refs = summarySourceRefs(context);
  const groups = context.qaSummaryTopicSourceIds;
  if (groups === undefined) throw new Error('Grouped summary requires topic sources.');
  const texts = new Map(
    context.sources.flatMap((source) =>
      source.kind === 'qa-question' && source.content.state === 'included'
        ? [[source.id, source.content.text] as const]
        : [],
    ),
  );
  return JSON.stringify({
    locale: context.locale,
    opening: QA_SUMMARY_REPORTING_OPENING[context.locale],
    groups: groups.map((group) => group.map((id) => ({ id: refs.get(id)!, text: texts.get(id)! }))),
  }).replace(/</g, '\\u003c');
}

export function groupedSummaryChatMessages(
  context: SummaryPromptDomain,
  instructionText: string,
  definitionText: string,
) {
  return [
    { role: 'system', content: instructionText },
    { role: 'system', content: definitionText },
    { role: 'user', content: compactGroupedSummaryContext(context) },
  ] as const;
}
