// Shared helpers for the 2A experiments. Everything that decides an outcome is
// imported from the arsnova.eu repository itself; this file only wires inputs.
import { execSync } from 'node:child_process';
import os from 'node:os';
import {
  MODERATION_COMPASS_RULES_VERSION,
  MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1,
  MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1,
  calculateModerationQaBestScoreV1,
  calculateModerationQaControversyScoreV1,
} from '@arsnova/shared-types';
import {
  isQaControversialLabel,
  resolveQaControversyThreshold,
} from '../../../../../apps/backend/src/lib/qaControversy.ts';
import {
  buildModerationCompassCards,
  type ModerationCompassCard,
  type ModerationCompassQaQuestion,
  type ModerationCompassSnapshot,
  type ModerationCompassTerm,
} from '../../../../../apps/frontend/src/app/features/session/session-host/moderation-compass.ts';
import { WordCloudTermExtractorService } from '../../../../../apps/frontend/src/app/features/session/session-present/word-cloud-term.service.ts';
import { getQaWordCloudQuestionWeight } from '../../../../../apps/frontend/src/app/features/session/session-present/word-cloud-weight.util.ts';

export const REPO = new URL('../../../../../', import.meta.url).pathname;
export const EVIDENCE = new URL('../evidence/', import.meta.url).pathname;

export type SortMode = 'TOP' | 'BEST' | 'CONTROVERSIAL' | 'TIME';
export type Status = ModerationCompassQaQuestion['status'];

export type ScenarioQuestion = {
  key: string;
  id: string;
  text: string;
  status: Status;
  positive?: number;
  negative?: number;
};

export function environment() {
  const commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
  const dirty = execSync('git status --porcelain', { cwd: REPO }).toString().trim().length > 0;
  return {
    commit,
    commitShort: commit.slice(0, 8),
    workingTreeClean: !dirty,
    rulesVersion: MODERATION_COMPASS_RULES_VERSION,
    node: process.version,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    platform: `${os.platform()} ${os.release()}`,
    timestamp: new Date().toISOString(),
  };
}

/** The six reference questions from Issue #456 §12, as fixed in the repo fixture. */
export function referenceQuestions(): ScenarioQuestion[] {
  return MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1.map((row, index) => ({
    key: row.key,
    id: row.sourceId.replace('qa-question:', ''),
    text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[index]!.text,
    status: row.status as Status,
    positive: row.positive,
    negative: row.negative,
  }));
}

/**
 * Derives the per-question signals exactly as the backend list endpoint does
 * (qa.ts: bestScore/controversyScore from qa-ranking-v1, label via isQaControversialLabel).
 * Missing votes stay undefined so the "missing vs. zero" counter-case is observable.
 */
export function toCompassQuestion(
  question: ScenarioQuestion,
  participantBasis: number,
): ModerationCompassQaQuestion {
  if (question.positive === undefined || question.negative === undefined) {
    return { id: question.id, text: question.text, status: question.status };
  }
  const positive = question.positive;
  const negative = question.negative;
  const controversyScore = calculateModerationQaControversyScoreV1({
    positive,
    negative,
    participantBasis,
  });
  return {
    id: question.id,
    text: question.text,
    status: question.status,
    positiveVoteCount: positive,
    negativeVoteCount: negative,
    score: positive - negative,
    bestScore: calculateModerationQaBestScoreV1({ positive, negative }),
    controversyScore,
    isControversial: isQaControversialLabel({
      controversyScore,
      voteCount: positive + negative,
      controversyThreshold: resolveQaControversyThreshold(participantBasis),
    }),
  };
}

const extractor = new WordCloudTermExtractorService();

/**
 * Mirrors session-host.component.ts: the Q&A word cloud only uses ACTIVE/PINNED
 * questions (liveQaWordCloudQuestions), weights them by the active sort mode and
 * maps WordCloudTerm -> ModerationCompassTerm (toModerationCompassTerms).
 */
export function qaTermsFor(
  questions: readonly ModerationCompassQaQuestion[],
  sortMode: SortMode,
  variant: 'LEXICAL' | 'THEME',
): ModerationCompassTerm[] {
  const visible = questions.filter((q) => q.status === 'ACTIVE' || q.status === 'PINNED');
  const documents = visible.map((q) => ({
    id: q.id,
    title: q.text,
    weight: getQaWordCloudQuestionWeight(
      {
        upvoteCount: q.score ?? 0,
        score: q.score,
        bestScore: q.bestScore,
        controversyScore: q.controversyScore,
      },
      sortMode,
    ),
  }));
  const terms = extractor.extractTerms(documents, {
    locale: 'de',
    maxEntries: 80,
    maxNgramLength: variant === 'THEME' ? 3 : 1,
  } as never);
  return terms.map((term) => {
    const memberSourceIds = term.members
      .map((m) => m.sourceId.trim())
      .filter((id) => id.length > 0);
    return {
      label: term.label,
      documentFrequency: term.documentFrequency,
      sourceCount: term.sourceCount,
      memberTexts: term.members.map((m) => m.text),
      ...(memberSourceIds.length > 0 ? { memberSourceIds } : {}),
      sortMode,
      analysisVariant: variant,
    };
  });
}

export type RunInput = {
  questions: ScenarioQuestion[];
  participantBasis: number;
  sortMode: SortMode;
  variant?: 'LEXICAL' | 'THEME';
};

export type RunResult = {
  cards: Array<{
    kind: string;
    tone?: string;
    nextStepReason?: string;
    sources: string[];
  }>;
  nextStepVisible: boolean;
  termsSupportingTopics: string[];
  compassQuestions: ModerationCompassQaQuestion[];
};

/** Full rule-core run: signals -> snapshot -> buildModerationCompassCards (app code). */
export function runCompass(input: RunInput): RunResult {
  const compassQuestions = input.questions.map((q) => toCompassQuestion(q, input.participantBasis));
  const qaTerms = qaTermsFor(compassQuestions, input.sortMode, input.variant ?? 'LEXICAL');
  const snapshot: ModerationCompassSnapshot = {
    qaQuestions: compassQuestions,
    qaSortMode: input.sortMode,
    qaTerms,
    freetextTerms: [],
    extraTopicSources: [],
    topicWeightLabel: qaTerms.length > 0 ? 'Gewichtung' : null,
    tempo: null,
    quizSources: [],
    quizInsightKind: null,
  };
  const cards = buildModerationCompassCards(snapshot);
  const keyById = new Map(input.questions.map((q) => [q.id, q.key]));
  return {
    cards: cards.map((card: ModerationCompassCard) => ({
      kind: card.kind,
      tone: card.tone,
      nextStepReason: card.nextStepReason,
      sources: card.sources.map((s) => {
        if (s.kind === 'qa-term' || s.kind === 'freetext-term') return `»${s.label}«`;
        const qid =
          s.target && 'questionId' in s.target
            ? (s.target as { questionId?: string }).questionId
            : undefined;
        const key = qid ? keyById.get(qid) : undefined;
        return key ? key : `${s.kind}:${s.label}`;
      }),
    })),
    nextStepVisible: cards.some((c) => Boolean(c.nextStepReason)),
    termsSupportingTopics: qaTerms
      .filter((t) => t.documentFrequency >= 2 || t.sourceCount >= 2)
      .map((t) => `${t.label} (df=${t.documentFrequency})`),
    compassQuestions,
  };
}

export function describeCards(result: RunResult): string {
  if (result.cards.length === 0) return '(keine Karte)';
  return result.cards
    .map(
      (c) => `${c.kind}[${c.sources.join(',')}]${c.nextStepReason ? `→${c.nextStepReason}` : ''}`,
    )
    .join(' | ');
}
