/**
 * Deterministische Auswertungshelfer für Session-Export und Ergebnisbericht.
 * Keine KI, keine externen Dienste — nur vorhandene Aggregatdaten.
 */

import {
  CONFIDENCE_DEBRIEF_MIN_RESPONSES,
  CONFIDENCE_DEBRIEF_MIN_SHARE,
  CONFIDENCE_SUMMARY_MIN_RESPONSES,
  type ConfidenceCrossTab,
} from './confidence';
import type {
  Difficulty,
  OpinionShift,
  QuestionExportEntry,
  QuestionType,
  RoundComparisonDTO,
  RoundDistributionEntry,
  TeamLearningProfileEntry,
  VoterMigrationEntry,
} from './schemas';

export type DebriefActionKind = 'debrief' | 'reinforce' | 'reteach' | 'observe' | 'done';

export interface DebriefActionPlan {
  debrief: number[];
  reinforce: number[];
  reteach: number[];
  observe: number[];
  done: number[];
}

export interface HardestQuestionEntry {
  questionOrder: number;
  correctPercentage: number;
  correctCount: number;
  totalGraded: number;
  difficulty?: Difficulty;
  difficultyMismatch: boolean;
}

export interface ResponseTimeAggregate {
  medianResponseTimeMs: number;
  q1ResponseTimeMs: number;
  q3ResponseTimeMs: number;
  effectiveTimerSeconds: number | null;
  nearDeadlineCount: number;
}

type VoteLike = {
  participantId: string;
  selectedAnswers: Array<{ answerOptionId: string }>;
};

type AnswerLike = { id: string; text: string; isCorrect: boolean };

function percentileNearestRank(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))]!;
}

/** Anonyme Antwortzeit-Aggregate; nur sinnvoll bei aktivem Timer. */
export function buildResponseTimeAggregate(
  responseTimesMs: ReadonlyArray<number | null | undefined>,
  effectiveTimerSeconds: number | null,
): ResponseTimeAggregate | undefined {
  const times = responseTimesMs
    .filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0,
    )
    .sort((a, b) => a - b);
  if (times.length === 0 || effectiveTimerSeconds === null || effectiveTimerSeconds <= 0) {
    return undefined;
  }
  const deadlineMs = effectiveTimerSeconds * 1000 * 0.8;
  const nearDeadlineCount = times.filter((ms) => ms >= deadlineMs).length;
  return {
    medianResponseTimeMs: percentileNearestRank(times, 50),
    q1ResponseTimeMs: percentileNearestRank(times, 25),
    q3ResponseTimeMs: percentileNearestRank(times, 75),
    effectiveTimerSeconds,
    nearDeadlineCount,
  };
}

function isFullyCorrectVote(vote: VoteLike, correctIds: ReadonlySet<string>): boolean {
  if (correctIds.size === 0) return false;
  const selected = new Set(vote.selectedAnswers.map((entry) => entry.answerOptionId));
  if (selected.size !== correctIds.size) return false;
  for (const id of correctIds) {
    if (!selected.has(id)) return false;
  }
  return true;
}

function buildRoundDistribution(
  votes: ReadonlyArray<VoteLike>,
  answers: ReadonlyArray<AnswerLike>,
  correctIds: ReadonlySet<string>,
): { total: number; dist: RoundDistributionEntry[]; correctCount: number } {
  const total = votes.length;
  const counts = new Map<string, number>();
  for (const vote of votes) {
    for (const selected of vote.selectedAnswers) {
      counts.set(selected.answerOptionId, (counts.get(selected.answerOptionId) ?? 0) + 1);
    }
  }
  const dist: RoundDistributionEntry[] = answers.map((answer) => ({
    id: answer.id,
    text: answer.text,
    isCorrect: answer.isCorrect,
    voteCount: counts.get(answer.id) ?? 0,
    votePercentage: total > 0 ? Math.round(((counts.get(answer.id) ?? 0) / total) * 100) : 0,
  }));
  const correctCount =
    correctIds.size > 0 ? votes.filter((vote) => isFullyCorrectVote(vote, correctIds)).length : 0;
  return { total, dist, correctCount };
}

/** Peer-Instruction-Vergleich aus bereits geladenen Votes (ohne zusätzliche DB-Abfrage). */
export function buildRoundComparisonFromVotes(
  answers: ReadonlyArray<AnswerLike>,
  round1Votes: ReadonlyArray<VoteLike>,
  round2Votes: ReadonlyArray<VoteLike>,
): RoundComparisonDTO {
  const correctIds = new Set(
    answers.filter((answer) => answer.isCorrect).map((answer) => answer.id),
  );
  const r1 = buildRoundDistribution(round1Votes, answers, correctIds);
  const r2 = buildRoundDistribution(round2Votes, answers, correctIds);

  const answerKey = (vote: VoteLike): string =>
    vote.selectedAnswers
      .map((selected) => selected.answerOptionId)
      .sort()
      .join(',');
  const primaryAnswer = (vote: VoteLike): string =>
    vote.selectedAnswers.length > 0 ? vote.selectedAnswers[0]!.answerOptionId : '';

  const r1ByParticipant = new Map(round1Votes.map((vote) => [vote.participantId, vote]));
  const r2ByParticipant = new Map(round2Votes.map((vote) => [vote.participantId, vote]));
  const answerTextById = new Map(answers.map((answer) => [answer.id, answer.text]));

  let bothRoundsCount = 0;
  let changedCount = 0;
  let wrongToCorrectCount = 0;
  let correctToWrongCount = 0;
  const migrationCounts = new Map<string, number>();

  for (const [participantId, vote1] of r1ByParticipant) {
    const vote2 = r2ByParticipant.get(participantId);
    if (!vote2) continue;
    bothRoundsCount += 1;
    if (answerKey(vote1) !== answerKey(vote2)) {
      changedCount += 1;
      const wasCorrect = isFullyCorrectVote(vote1, correctIds);
      const nowCorrect = isFullyCorrectVote(vote2, correctIds);
      if (!wasCorrect && nowCorrect) wrongToCorrectCount += 1;
      if (wasCorrect && !nowCorrect) correctToWrongCount += 1;
      const fromId = primaryAnswer(vote1);
      const toId = primaryAnswer(vote2);
      if (fromId && toId) {
        const key = `${fromId}|${toId}`;
        migrationCounts.set(key, (migrationCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const migrations: VoterMigrationEntry[] = [];
  for (const [key, count] of migrationCounts) {
    const [fromId, toId] = key.split('|');
    migrations.push({
      from: answerTextById.get(fromId!) ?? fromId!,
      to: answerTextById.get(toId!) ?? toId!,
      count,
    });
  }
  migrations.sort((a, b) => b.count - a.count);

  const opinionShift: OpinionShift | undefined =
    bothRoundsCount > 0
      ? {
          bothRoundsCount,
          changedCount,
          changedPercentage: Math.round((changedCount / bothRoundsCount) * 100),
          wrongToCorrectCount: correctIds.size > 0 ? wrongToCorrectCount : undefined,
          correctToWrongCount: correctIds.size > 0 ? correctToWrongCount : undefined,
          migrations: migrations.length > 0 ? migrations : undefined,
        }
      : undefined;

  return {
    round1Total: r1.total,
    round2Total: r2.total,
    round1Distribution: r1.dist,
    round2Distribution: r2.dist,
    round1CorrectCount: r1.correctCount,
    round2CorrectCount: r2.correctCount,
    opinionShift,
  };
}

export function computeCorrectPercentage(
  correctCount: number | undefined,
  incorrectCount: number | undefined,
): number | null {
  if (correctCount === undefined || incorrectCount === undefined) return null;
  const total = correctCount + incorrectCount;
  if (total <= 0) return null;
  return Math.round((correctCount / total) * 1000) / 10;
}

const GRADED_TYPES: ReadonlySet<QuestionType> = new Set([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'SHORT_TEXT',
  'NUMERIC_ESTIMATE',
]);

export function selectHardestQuestions(
  questions: ReadonlyArray<
    Pick<
      QuestionExportEntry,
      | 'questionOrder'
      | 'type'
      | 'correctCount'
      | 'incorrectCount'
      | 'correctPercentage'
      | 'difficulty'
    >
  >,
  limit = 3,
): HardestQuestionEntry[] {
  const ranked: HardestQuestionEntry[] = [];
  for (const question of questions) {
    if (!GRADED_TYPES.has(question.type)) continue;
    const correctCount = question.correctCount ?? 0;
    const incorrectCount = question.incorrectCount ?? 0;
    const totalGraded = correctCount + incorrectCount;
    const correctPercentage =
      question.correctPercentage ?? computeCorrectPercentage(correctCount, incorrectCount);
    if (totalGraded <= 0 || correctPercentage === null) continue;
    const difficultyMismatch =
      question.difficulty === 'EASY' && correctPercentage < 40
        ? true
        : question.difficulty === 'HARD' && correctPercentage >= 85;
    ranked.push({
      questionOrder: question.questionOrder,
      correctPercentage,
      correctCount,
      totalGraded,
      difficulty: question.difficulty,
      difficultyMismatch: Boolean(difficultyMismatch),
    });
  }
  ranked.sort(
    (a, b) => a.correctPercentage - b.correctPercentage || a.questionOrder - b.questionOrder,
  );
  return ranked.slice(0, Math.max(0, limit));
}

function dominantShare(count: number, total: number, minCount = 2, minShare = 0.1): boolean {
  return total > 0 && count >= minCount && count / total >= minShare;
}

/** Unter dieser Lösungsquote: Grundlage erneut erklären (wenn kein Fehlkonzept-Signal). */
export const DEBRIEF_RETEACH_MAX_CORRECT_RATE = 0.6;
/** Ab dieser Lösungsquote: absichern oder als überwiegend gefestigt einstufen. */
export const DEBRIEF_REINFORCE_MIN_CORRECT_RATE = 0.8;
/**
 * Anteil aller Antworten mit richtig + hoher Sicherheit für „überwiegend gefestigt“.
 * Bezogen auf responseCount (nicht nur auf die richtigen Antworten).
 */
export const DEBRIEF_DONE_MIN_CORRECT_HIGH_RATE = 0.5;
/** @deprecated Alias — gleicher Schwellenwert wie DEBRIEF_DONE_MIN_CORRECT_HIGH_RATE. */
export const DEBRIEF_DONE_MIN_HIGH_SHARE_OF_CORRECT = DEBRIEF_DONE_MIN_CORRECT_HIGH_RATE;

export function correctRateFromCrossTab(
  crossTab: ConfidenceCrossTab,
  responseCount: number,
): number {
  if (responseCount <= 0) return 0;
  const correct = crossTab.correctHigh + crossTab.correctMid + crossTab.correctLow;
  return correct / responseCount;
}

/**
 * Didaktische Maßnahmenklassifikation.
 * 1) falsch + hohe Sicherheit über Schwelle → Fehlkonzept klären
 * 2) sonst Lösungsquote < 60 % → Grundlage erneut erklären
 * 3) Lösungsquote ≥ 80 % und ≥ 50 % richtig+hoch → überwiegend gefestigt
 * 4) Lösungsquote ≥ 80 %, aber wenig hohe Sicherheit → kurz absichern
 * 5) sonst → kurz überprüfen (observe)
 */
export function classifyQuestionDebriefAction(
  crossTab: ConfidenceCrossTab,
  responseCount: number,
  options?: { debriefRecommended?: boolean },
): DebriefActionKind {
  const incorrectHigh = crossTab.incorrectHigh;
  const debriefRecommended =
    options?.debriefRecommended ??
    (incorrectHigh >= CONFIDENCE_DEBRIEF_MIN_RESPONSES &&
      responseCount > 0 &&
      incorrectHigh / responseCount >= CONFIDENCE_DEBRIEF_MIN_SHARE);
  if (debriefRecommended) {
    return 'debrief';
  }

  const correctRate = correctRateFromCrossTab(crossTab, responseCount);
  if (correctRate < DEBRIEF_RETEACH_MAX_CORRECT_RATE) {
    return 'reteach';
  }

  if (correctRate >= DEBRIEF_REINFORCE_MIN_CORRECT_RATE) {
    const correctHighRate = responseCount > 0 ? crossTab.correctHigh / responseCount : 0;
    if (correctHighRate >= DEBRIEF_DONE_MIN_CORRECT_HIGH_RATE) {
      return 'done';
    }
    return 'reinforce';
  }

  if (dominantShare(crossTab.incorrectLow, responseCount)) return 'reteach';
  const mid = crossTab.correctMid + crossTab.incorrectMid;
  if (dominantShare(mid, responseCount, 2, 0.2)) return 'observe';
  return 'observe';
}

export function buildDebriefActionPlan(
  questions: ReadonlyArray<{
    questionOrder: number;
    responseCount: number;
    result: { crossTab: ConfidenceCrossTab };
  }>,
  gradedHints?: ReadonlyArray<{
    questionOrder: number;
    correctPercentage?: number | null;
  }>,
): DebriefActionPlan {
  const plan: DebriefActionPlan = {
    debrief: [],
    reinforce: [],
    reteach: [],
    observe: [],
    done: [],
  };
  for (const question of questions) {
    if (question.responseCount < 1) continue;
    const kind = classifyQuestionDebriefAction(question.result.crossTab, question.responseCount);
    plan[kind].push(question.questionOrder);
  }

  // Fragen ohne Selbsteinschätzung: niedrige empirische Lösungsquote → erneut erklären
  if (gradedHints?.length) {
    const covered = new Set([
      ...plan.debrief,
      ...plan.reinforce,
      ...plan.reteach,
      ...plan.observe,
      ...plan.done,
    ]);
    const extraReteach: Array<{ questionOrder: number; correctPercentage: number }> = [];
    for (const hint of gradedHints) {
      if (covered.has(hint.questionOrder)) continue;
      if (typeof hint.correctPercentage !== 'number' || !Number.isFinite(hint.correctPercentage)) {
        continue;
      }
      if (hint.correctPercentage / 100 < DEBRIEF_RETEACH_MAX_CORRECT_RATE) {
        extraReteach.push({
          questionOrder: hint.questionOrder,
          correctPercentage: hint.correctPercentage,
        });
      }
    }
    extraReteach
      .sort(
        (a, b) => a.correctPercentage - b.correctPercentage || a.questionOrder - b.questionOrder,
      )
      .forEach((entry) => plan.reteach.push(entry.questionOrder));
  }

  return plan;
}

const TEAM_PROFILE_MIN_MEMBERS = CONFIDENCE_SUMMARY_MIN_RESPONSES;
/** Stärke im Team-Lernprofil: mindestens 80 % richtig. */
export const TEAM_STRENGTH_MIN_RATE = 0.8;
/** Klärungsbedarf im Team-Lernprofil: höchstens 40 % richtig. */
export const TEAM_FOCUS_MAX_RATE = 0.4;

export function buildTeamLearningProfiles(input: {
  teams: ReadonlyArray<{ teamName: string; memberCount: number; memberIds: ReadonlySet<string> }>;
  questions: ReadonlyArray<{
    questionOrder: number;
    type: QuestionType;
    votes: ReadonlyArray<{ participantId: string; isCorrect?: boolean | null }>;
  }>;
  strengthLimit?: number;
  focusLimit?: number;
}): TeamLearningProfileEntry[] {
  const strengthLimit = input.strengthLimit ?? 2;
  const focusLimit = input.focusLimit ?? 2;
  const profiles: TeamLearningProfileEntry[] = [];

  for (const team of input.teams) {
    if (team.memberCount < TEAM_PROFILE_MIN_MEMBERS) continue;
    const scored: Array<{ questionOrder: number; rate: number; correctPercentage: number }> = [];
    for (const question of input.questions) {
      if (!GRADED_TYPES.has(question.type)) continue;
      const teamVotes = question.votes.filter((vote) => team.memberIds.has(vote.participantId));
      const graded = teamVotes.filter(
        (vote) => vote.isCorrect === true || vote.isCorrect === false,
      );
      if (graded.length < TEAM_PROFILE_MIN_MEMBERS) continue;
      const correct = graded.filter((vote) => vote.isCorrect === true).length;
      const rate = correct / graded.length;
      scored.push({
        questionOrder: question.questionOrder,
        rate,
        correctPercentage: Math.round(rate * 1000) / 10,
      });
    }
    if (!scored.length) continue;
    const byStrength = [...scored].sort(
      (a, b) => b.rate - a.rate || a.questionOrder - b.questionOrder,
    );
    const byFocus = [...scored].sort(
      (a, b) => a.rate - b.rate || a.questionOrder - b.questionOrder,
    );
    profiles.push({
      teamName: team.teamName,
      memberCount: team.memberCount,
      strengthQuestions: byStrength
        .filter((entry) => entry.rate >= TEAM_STRENGTH_MIN_RATE)
        .slice(0, strengthLimit)
        .map((entry) => ({
          questionOrder: entry.questionOrder,
          correctPercentage: entry.correctPercentage,
        })),
      focusQuestions: byFocus
        .filter((entry) => entry.rate <= TEAM_FOCUS_MAX_RATE)
        .slice(0, focusLimit)
        .map((entry) => ({
          questionOrder: entry.questionOrder,
          correctPercentage: entry.correctPercentage,
        })),
    });
  }

  return profiles.filter(
    (profile) => profile.strengthQuestions.length > 0 || profile.focusQuestions.length > 0,
  );
}
