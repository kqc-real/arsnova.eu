import {
  QA_SUMMARY_MAX_SOURCES_PER_TOPIC,
  QA_SUMMARY_MAX_TOPICS,
  type AppLocale,
  type ModerationAnalysisContextV1,
} from '@arsnova/shared-types';
import {
  compareModerationPromptCodeUnits,
  normalizeQuestionForDedupe,
} from './moderationPromptContextPacking';
import { isStopwordToken, tokenizeWordCloudText } from './wordCloudAnalysis';

const QA_SUMMARY_QUESTION_LIMIT = QA_SUMMARY_MAX_TOPICS * QA_SUMMARY_MAX_SOURCES_PER_TOPIC;

function nearDuplicate(left: string, right: string): boolean {
  const a = new Set(left.split(' '));
  const b = new Set(right.split(' '));
  const common = [...a].filter((word) => b.has(word)).length;
  return common >= 5 && common / (a.size + b.size - common) >= 0.8;
}

function topicWords(text: string, locale: AppLocale): Set<string> {
  return new Set(
    tokenizeWordCloudText(text)
      .map(({ lookup }) => lookup)
      .filter((word) => /^\p{L}[\p{L}'’\p{M}-]{2,}$/u.test(word) && !isStopwordToken(word, locale)),
  );
}

function sharesTopicWords(first: Set<string>, other: Set<string>): boolean {
  const common = [...other].filter((word) => first.has(word));
  return (
    common.length >= 3 ||
    (common.length * 2 >= Math.min(first.size, other.size) &&
      (common.length >= 2 || common.some((word) => word.length >= 7)))
  );
}

function sharesTechnicalTerm(first: Set<string>, other: Set<string>): boolean {
  // Recognize compounds and inflections without an encoder request. The minimum
  // length keeps shared fragments of short function words out of the match.
  const terms = [...first];
  return [...other].some((word) =>
    terms.some(
      (term) =>
        (word.length >= 7 && term.startsWith(word.slice(0, 7))) ||
        (word.length >= 6 && term.endsWith(word)) ||
        (term.length >= 6 && word.endsWith(term)),
    ),
  );
}

export function selectQaSummaryEvidence(context: ModerationAnalysisContextV1['context']) {
  const sources = new Map(
    context.sources.flatMap((source) =>
      source.kind === 'qa-question' && source.content.state === 'included'
        ? [[source.id, source.content.text] as const]
        : [],
    ),
  );
  const candidates =
    context.questions.state === 'available'
      ? context.questions.items.flatMap((question) => {
          const text = sources.get(question.sourceId);
          if (!text) return [];
          const { votes } = question;
          return [
            {
              id: question.sourceId,
              text: normalizeQuestionForDedupe(text).toLowerCase() || text,
              addressed: question.answerState.state === 'addressed',
              topicSourceIds: question.topicSourceIds,
              positive: votes.state === 'available' ? votes.positive : 0,
              support: votes.state === 'available' ? (votes.bestScore.value ?? -1) : -1,
              total: votes.state === 'available' ? votes.total : 0,
            },
          ];
        })
      : [];
  candidates.sort(
    (left, right) =>
      Number(left.addressed) - Number(right.addressed) ||
      right.positive - left.positive ||
      right.support - left.support ||
      right.total - left.total ||
      compareModerationPromptCodeUnits(left.text, right.text) ||
      compareModerationPromptCodeUnits(left.id, right.id),
  );
  const distinctTexts = new Set<string>();
  const ranked = candidates.flatMap((candidate) => {
    if (distinctTexts.has(candidate.text)) return [];
    distinctTexts.add(candidate.text);
    return [{ ...candidate, words: topicWords(candidate.text, context.locale) }];
  });
  const limit = Math.min(context.scope.selectionLimits.questions, QA_SUMMARY_QUESTION_LIMIT);
  const first = ranked[0];
  if (!first || limit === 0) return [];

  const hasCurrentTopics =
    context.topics.state === 'available' && context.topics.freshness.state === 'current';
  const sameTopic = (left: typeof first, right: typeof first) => {
    if (hasCurrentTopics && left.topicSourceIds.length > 0 && right.topicSourceIds.length > 0) {
      return right.topicSourceIds.some((id) => left.topicSourceIds.includes(id));
    }
    return (
      sharesTopicWords(left.words, right.words) || sharesTechnicalTerm(left.words, right.words)
    );
  };
  const second = ranked.find(
    (candidate) =>
      candidate.addressed === first.addressed &&
      candidate.id !== first.id &&
      !nearDuplicate(first.text, candidate.text) &&
      !sameTopic(first, candidate),
  );
  const leads = second && limit >= 2 ? [first, second] : [first];
  const usedIds = new Set(leads.map(({ id }) => id));
  return leads.map((lead, index) => {
    const group = [lead];
    const groupLimit = Math.min(
      QA_SUMMARY_MAX_SOURCES_PER_TOPIC,
      Math.ceil((limit - index) / leads.length),
    );
    for (const candidate of ranked) {
      if (group.length >= groupLimit) break;
      if (
        usedIds.has(candidate.id) ||
        candidate.addressed !== lead.addressed ||
        !sameTopic(lead, candidate) ||
        group.some((member) => nearDuplicate(member.text, candidate.text))
      )
        continue;
      group.push(candidate);
      usedIds.add(candidate.id);
    }
    return group.map(({ id }) => id);
  });
}
