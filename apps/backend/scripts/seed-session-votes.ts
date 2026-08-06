#!/usr/bin/env tsx
/**
 * Befuellt eine bestehende Quiz-Session mit synthetischen Antworten fuer eine gezielte Frage.
 *
 * Beispiele:
 *   SESSION_CODE=4XW4HX npm run seed:session-votes -w @arsnova/backend
 *   npm run seed:session-votes -w @arsnova/backend -- --code 4XW4HX --question-number 2 --count 100
 *   npm run seed:session-votes -w @arsnova/backend -- --code 4XW4HX --question-id abc --count 40 --dry-run
 *   npm run seed:session-votes -w @arsnova/backend -- --code 4XW4HX --freetext-file ../../tmp/pi-responses.txt
 *
 * Das Skript arbeitet direkt gegen Prisma und eignet sich fuer lokale Review-, Demo- und Lasttest-Sessions.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { format } from 'node:util';
import { prisma } from '../src/db';
import { calculateVoteScore } from '../src/lib/quizScoring';
import {
  resolveEffectiveQuestionTimer,
  type Difficulty,
  type QuestionType,
} from '@arsnova/shared-types';

type CliOptions = {
  code: string;
  count: number;
  questionId: string | null;
  questionOrder: number | null;
  questionNumber: number | null;
  round: number | null;
  participantPrefix: string;
  freetextFile: string | null;
  correctRate: number;
  dryRun: boolean;
  help: boolean;
};

function log(...values: unknown[]): void {
  process.stdout.write(`${format(...values)}\n`);
}

type SessionQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  order: number;
  timer: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
  answers: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
};

type PlannedVote = {
  participantId: string;
  nickname: string;
  voteId: string;
  teamId: string | null;
  answerIds: string[];
  freeText: string | null;
  ratingValue: number | null;
  score: number;
  responseTimeMs: number | null;
};

const DEFAULT_VOTE_COUNT = 100;
const MAX_VOTE_COUNT = 2_000;
const DEFAULT_PARTICIPANT_PREFIX = 'Seed';
const DEFAULT_CORRECT_RATE = 0.72;

function printUsage(): void {
  log(`
Bestehende Quiz-Session fuer eine Frage befuellen

Usage:
  npm run seed:session-votes -w @arsnova/backend -- --code 4XW4HX [Optionen]
  SESSION_CODE=4XW4HX npm run seed:session-votes -w @arsnova/backend

Optionen:
  --code <CODE>              Session-Code, alternativ SESSION_CODE oder erstes Argument
  --count <N>                Anzahl neuer Teilnehmender/Votes, Default ${DEFAULT_VOTE_COUNT}, max ${MAX_VOTE_COUNT}
  --question-id <ID>         Ziel-Frage per ID waehlen
  --question-order <N>       Ziel-Frage per 0-basierter order waehlen
  --question-number <N>      Ziel-Frage per 1-basiger Nummer waehlen
  --round <N>                Runde, Default aktuelle Session-Runde
  --participant-prefix <T>   Prefix fuer erzeugte Nicknames, Default ${DEFAULT_PARTICIPANT_PREFIX}
  --correct-rate <0..1>      Anteil korrekter Antworten fuer Choice-Fragen, Default ${DEFAULT_CORRECT_RATE}
  --freetext-file <PATH>     Optional: Datei mit einer Antwort pro Zeile fuer FREETEXT-Fragen
  --dry-run                  Nur pruefen und geplante Mengen/Verteilungen ausgeben
  --help                     Hilfe anzeigen

Hinweise:
  - Ohne explizite Frage wird die aktuelle Session-Frage verwendet.
  - Das Skript fuegt Daten direkt in die DB ein und umgeht die Vote-API bewusst.
  - Bereits aufgewaermte In-Memory-Caches im laufenden Backend koennen oeffentliche Zaehler kurzzeitig nachziehen.
`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const args = [...argv];

  const readValue = (name: string): string | undefined => {
    const equalsPrefix = `--${name}=`;
    const equalsIndex = args.findIndex((arg) => arg.startsWith(equalsPrefix));
    if (equalsIndex >= 0) {
      const [value] = args.splice(equalsIndex, 1);
      return value?.slice(equalsPrefix.length);
    }

    const flagIndex = args.indexOf(`--${name}`);
    if (flagIndex >= 0) {
      const value = args[flagIndex + 1];
      args.splice(flagIndex, value && !value.startsWith('--') ? 2 : 1);
      return value;
    }

    return undefined;
  };

  const hasFlag = (name: string): boolean => {
    const index = args.indexOf(`--${name}`);
    if (index < 0) return false;
    args.splice(index, 1);
    return true;
  };

  const help = hasFlag('help') || hasFlag('h');
  const dryRun = hasFlag('dry-run');
  const code = (
    readValue('code') ??
    process.env['SESSION_CODE'] ??
    args.find((arg) => !arg.startsWith('--')) ??
    ''
  )
    .trim()
    .toUpperCase();

  return {
    code,
    count: readPositiveInteger(readValue('count') ?? process.env['VOTE_COUNT'], {
      fallback: DEFAULT_VOTE_COUNT,
      max: MAX_VOTE_COUNT,
      label: 'count',
    }),
    questionId: (readValue('question-id') ?? '').trim() || null,
    questionOrder: readOptionalInteger(readValue('question-order'), { label: 'question-order' }),
    questionNumber: readOptionalInteger(readValue('question-number'), {
      label: 'question-number',
      min: 1,
    }),
    round: readOptionalInteger(readValue('round'), { label: 'round', min: 1 }),
    participantPrefix:
      (
        readValue('participant-prefix') ??
        process.env['PARTICIPANT_PREFIX'] ??
        DEFAULT_PARTICIPANT_PREFIX
      ).trim() || DEFAULT_PARTICIPANT_PREFIX,
    freetextFile: (readValue('freetext-file') ?? process.env['FREETEXT_FILE'] ?? '').trim() || null,
    correctRate: readRate(readValue('correct-rate') ?? process.env['CORRECT_RATE']),
    dryRun,
    help,
  };
}

function readPositiveInteger(
  value: string | undefined,
  options: { fallback: number; max: number; label: string },
): number {
  if (!value) return options.fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > options.max) {
    throw new Error(`Ungueltiger Wert fuer --${options.label}: ${value}`);
  }
  return parsed;
}

function readOptionalInteger(
  value: string | undefined,
  options?: { label: string; min?: number },
): number | null {
  if (!value) return null;
  const resolvedOptions = options ?? { label: 'value' };
  const parsed = Number(value);
  const min = resolvedOptions.min ?? 0;
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`Ungueltiger Wert fuer --${resolvedOptions.label}: ${value}`);
  }
  return parsed;
}

function readRate(value: string | undefined): number {
  if (!value) return DEFAULT_CORRECT_RATE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Ungueltiger Wert fuer --correct-rate: ${value}`);
  }
  return parsed;
}

function assertOptions(options: CliOptions): void {
  if (options.help) return;
  if (!/^[A-Z0-9]{6}$/.test(options.code)) {
    throw new Error('Bitte einen gueltigen 6-stelligen Session-Code angeben.');
  }
  const selectors = [options.questionId, options.questionOrder, options.questionNumber].filter(
    (value) => value !== null,
  ).length;
  if (selectors > 1) {
    throw new Error(
      'Bitte hoechstens eine Frage per --question-id, --question-order oder --question-number auswaehlen.',
    );
  }
  if (options.freetextFile && !existsSync(options.freetextFile)) {
    throw new Error(`Datei fuer --freetext-file nicht gefunden: ${options.freetextFile}`);
  }
}

function stripMarkup(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_>#~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPromptFragment(questionText: string): string {
  const plain = stripMarkup(questionText);
  const firstSentence = plain.split(/[.!?]/)[0]?.trim() ?? plain;
  return (firstSentence || plain || 'der Frage').slice(0, 48).trim();
}

function loadFreetextPool(questionText: string, filePath: string | null): string[] {
  if (filePath) {
    const values = readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (values.length === 0) {
      throw new Error(`Datei fuer --freetext-file enthaelt keine nutzbaren Zeilen: ${filePath}`);
    }
    return values;
  }

  const prompt = buildPromptFragment(questionText);
  return [
    `${prompt} ist fuer mich zentral.`,
    `Zu ${prompt} hilft ein konkretes Beispiel.`,
    `Bei ${prompt} brauche ich noch mehr Uebung.`,
    `${prompt} ist inzwischen deutlich klarer.`,
    `Zu ${prompt} moechte ich mehr Praxisbezug sehen.`,
    `${prompt} nehme ich heute besonders mit.`,
    `Bei ${prompt} hilft mir die Visualisierung.`,
    `${prompt} war fuer mich der wichtigste Punkt.`,
    `Zu ${prompt} moechte ich weitere Aufgaben bearbeiten.`,
    `${prompt} wurde heute gut erklaert.`,
  ];
}

function buildParticipantNicknames(
  count: number,
  existingNicknames: Iterable<string>,
  prefix: string,
): string[] {
  const taken = new Set(existingNicknames);
  const names: string[] = [];
  const basePrefix = prefix.replace(/\s+/g, ' ').trim().slice(0, 18) || DEFAULT_PARTICIPANT_PREFIX;
  let cursor = 1;

  while (names.length < count) {
    const nickname = `${basePrefix} ${String(cursor).padStart(3, '0')}`.slice(0, 30);
    if (!taken.has(nickname)) {
      names.push(nickname);
      taken.add(nickname);
    }
    cursor += 1;
  }

  return names;
}

function resolveTargetQuestion(
  session: {
    currentQuestion: number | null;
    quiz: { questions: SessionQuestion[] } | null;
  },
  options: CliOptions,
): SessionQuestion {
  const questions = session.quiz?.questions ?? [];
  if (questions.length === 0) {
    throw new Error('Die Session enthaelt keine Quiz-Fragen.');
  }

  if (options.questionId) {
    const question = questions.find((entry) => entry.id === options.questionId);
    if (!question) {
      throw new Error(`Frage mit ID ${options.questionId} nicht gefunden.`);
    }
    return question;
  }

  if (options.questionOrder !== null) {
    const question = questions.find((entry) => entry.order === options.questionOrder);
    if (!question) {
      throw new Error(`Frage mit order ${options.questionOrder} nicht gefunden.`);
    }
    return question;
  }

  if (options.questionNumber !== null) {
    const targetOrder = options.questionNumber - 1;
    const question = questions.find((entry) => entry.order === targetOrder);
    if (!question) {
      throw new Error(`Frage Nummer ${options.questionNumber} nicht gefunden.`);
    }
    return question;
  }

  if (session.currentQuestion === null || session.currentQuestion === undefined) {
    throw new Error('Die Session hat keine aktuelle Frage.');
  }

  const currentQuestion =
    questions[session.currentQuestion] ??
    questions.find((entry) => entry.order === session.currentQuestion) ??
    null;
  if (!currentQuestion) {
    throw new Error(
      `Aktuelle Session-Frage fuer Index/order ${session.currentQuestion} nicht gefunden.`,
    );
  }
  return currentQuestion;
}

function chooseSingleChoiceAnswer(
  question: SessionQuestion,
  index: number,
  correctRate: number,
): string[] {
  const correctAnswers = question.answers.filter((answer) => answer.isCorrect);
  const wrongAnswers = question.answers.filter((answer) => !answer.isCorrect);
  if (question.answers.length === 0) {
    return [];
  }
  if (correctAnswers.length !== 1 || wrongAnswers.length === 0) {
    return [question.answers[index % question.answers.length].id];
  }
  const chooseCorrect = index % 100 < Math.round(correctRate * 100);
  return [chooseCorrect ? correctAnswers[0].id : wrongAnswers[index % wrongAnswers.length].id];
}

function sameAnswerSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function chooseMultipleChoiceAnswer(
  question: SessionQuestion,
  index: number,
  correctRate: number,
): string[] {
  const allIds = question.answers.map((answer) => answer.id);
  const correctIds = question.answers
    .filter((answer) => answer.isCorrect)
    .map((answer) => answer.id);
  const wrongIds = allIds.filter((id) => !correctIds.includes(id));

  if (allIds.length === 0) {
    return [];
  }
  if (correctIds.length > 0 && wrongIds.length > 0 && index % 100 < Math.round(correctRate * 100)) {
    return correctIds;
  }

  const variants: string[][] = [];
  for (let offset = 0; offset < correctIds.length; offset += 1) {
    variants.push(correctIds.filter((_, currentIndex) => currentIndex !== offset));
  }
  for (const wrongId of wrongIds) {
    variants.push([wrongId], [...correctIds, wrongId]);
  }
  for (const correctId of correctIds) {
    variants.push([correctId]);
  }

  const distinct = variants
    .map((ids) => [...new Set(ids)])
    .filter((ids) => ids.length > 0)
    .filter((ids, variantIndex, allVariants) => {
      if (sameAnswerSet(ids, correctIds)) return false;
      return allVariants.findIndex((candidate) => sameAnswerSet(candidate, ids)) === variantIndex;
    });

  if (distinct.length > 0) {
    return distinct[index % distinct.length];
  }
  return correctIds.length > 0 ? correctIds : [allIds[index % allIds.length]];
}

function chooseSurveyAnswer(question: SessionQuestion, index: number): string[] {
  if (question.answers.length === 0) {
    return [];
  }
  return [question.answers[index % question.answers.length].id];
}

function chooseRatingValue(question: SessionQuestion, index: number): number {
  const min = question.ratingMin ?? 1;
  const max = question.ratingMax ?? 5;
  const span = Math.max(1, max - min + 1);
  return min + (index % span);
}

function deriveResponseTimeMs(timerSeconds: number | null, index: number): number | null {
  if (!timerSeconds || timerSeconds <= 0) {
    return null;
  }
  const timerMs = timerSeconds * 1000;
  const ratio = 0.18 + ((index % 7) + 1) * 0.08;
  return Math.min(timerMs - 500, Math.max(800, Math.round(timerMs * ratio)));
}

function buildVotePayload(
  question: SessionQuestion,
  index: number,
  correctRate: number,
  freetextPool: string[],
  timerSeconds: number | null,
  defaultTimerSeconds: number | null,
  timerScaleByDifficulty: boolean,
): Pick<PlannedVote, 'answerIds' | 'freeText' | 'ratingValue' | 'score' | 'responseTimeMs'> {
  const responseTimeMs = deriveResponseTimeMs(timerSeconds, index);
  const effectiveTimerSeconds = resolveEffectiveQuestionTimer(
    question.timer,
    defaultTimerSeconds,
    question.difficulty,
    timerScaleByDifficulty,
  );
  const timerDurationMs = effectiveTimerSeconds ? effectiveTimerSeconds * 1000 : null;
  const correctAnswerIds = question.answers
    .filter((answer) => answer.isCorrect)
    .map((answer) => answer.id);

  switch (question.type) {
    case 'SINGLE_CHOICE': {
      const answerIds = chooseSingleChoiceAnswer(question, index, correctRate);
      return {
        answerIds,
        freeText: null,
        ratingValue: null,
        score: calculateVoteScore({
          type: question.type,
          difficulty: question.difficulty,
          selectedAnswerIds: answerIds,
          correctAnswerIds,
          responseTimeMs,
          timerDurationMs,
        }),
        responseTimeMs,
      };
    }
    case 'MULTIPLE_CHOICE': {
      const answerIds = chooseMultipleChoiceAnswer(question, index, correctRate);
      return {
        answerIds,
        freeText: null,
        ratingValue: null,
        score: calculateVoteScore({
          type: question.type,
          difficulty: question.difficulty,
          selectedAnswerIds: answerIds,
          correctAnswerIds,
          responseTimeMs,
          timerDurationMs,
        }),
        responseTimeMs,
      };
    }
    case 'SURVEY':
      return {
        answerIds: chooseSurveyAnswer(question, index),
        freeText: null,
        ratingValue: null,
        score: 0,
        responseTimeMs,
      };
    case 'RATING':
      return {
        answerIds: [],
        freeText: null,
        ratingValue: chooseRatingValue(question, index),
        score: 0,
        responseTimeMs,
      };
    case 'FREETEXT': {
      const freeText = freetextPool[index % freetextPool.length];
      return {
        answerIds: [],
        freeText,
        ratingValue: null,
        score: 0,
        responseTimeMs,
      };
    }
    default:
      throw new Error(`Nicht unterstuetzter Fragetyp: ${question.type}`);
  }
}

function buildSelectionSummary(
  question: SessionQuestion,
  votes: PlannedVote[],
): Record<string, number> {
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'SURVEY':
      return Object.fromEntries(
        question.answers.map((answer) => [
          answer.text,
          votes.filter((vote) => vote.answerIds[0] === answer.id).length,
        ]),
      );
    case 'MULTIPLE_CHOICE': {
      const patterns = new Map<string, number>();
      for (const vote of votes) {
        const label = question.answers
          .filter((answer) => vote.answerIds.includes(answer.id))
          .map((answer) => answer.text)
          .join(' + ');
        patterns.set(label || '(leer)', (patterns.get(label || '(leer)') ?? 0) + 1);
      }
      return Object.fromEntries([...patterns.entries()].sort((left, right) => right[1] - left[1]));
    }
    case 'RATING': {
      const counts = new Map<string, number>();
      for (const vote of votes) {
        const label = String(vote.ratingValue ?? 'null');
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      return Object.fromEntries(
        [...counts.entries()].sort((left, right) => Number(left[0]) - Number(right[0])),
      );
    }
    case 'FREETEXT': {
      const counts = new Map<string, number>();
      for (const vote of votes) {
        const label = vote.freeText ?? '(leer)';
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]));
    }
    default:
      return {};
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  assertOptions(options);

  if (options.help) {
    printUsage();
    return;
  }

  const session = await prisma.session.findUnique({
    where: { code: options.code },
    include: {
      teams: { orderBy: { name: 'asc' } },
      participants: { select: { nickname: true } },
      quiz: {
        select: {
          defaultTimer: true,
          timerScaleByDifficulty: true,
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              text: true,
              type: true,
              difficulty: true,
              order: true,
              timer: true,
              ratingMin: true,
              ratingMax: true,
              answers: {
                select: {
                  id: true,
                  text: true,
                  isCorrect: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session?.quiz) {
    throw new Error(`Quiz-Session ${options.code} nicht gefunden.`);
  }

  const question = resolveTargetQuestion(session, options);
  const round = options.round ?? session.currentRound;
  const existingVotesBefore = await prisma.vote.count({
    where: {
      sessionId: session.id,
      questionId: question.id,
      round,
    },
  });
  const existingParticipantsBefore = session.participants.length;

  const nicknames = buildParticipantNicknames(
    options.count,
    session.participants.map((participant) => participant.nickname),
    options.participantPrefix,
  );
  const freetextPool = loadFreetextPool(question.text, options.freetextFile);
  const timerSeconds = resolveEffectiveQuestionTimer(
    question.timer,
    session.quiz.defaultTimer,
    question.difficulty,
    session.quiz.timerScaleByDifficulty ?? true,
  );

  const startedAt = Date.now();
  const plannedVotes: PlannedVote[] = nicknames.map((nickname, index) => {
    const participantId = randomUUID();
    const voteId = randomUUID();
    const team = session.teams.length > 0 ? session.teams[index % session.teams.length] : null;
    const payload = buildVotePayload(
      question,
      index,
      options.correctRate,
      freetextPool,
      timerSeconds,
      session.quiz?.defaultTimer ?? null,
      session.quiz?.timerScaleByDifficulty ?? true,
    );
    return {
      participantId,
      nickname,
      voteId,
      teamId: team?.id ?? null,
      ...payload,
    };
  });

  const summary = {
    sessionCode: options.code,
    sessionStatus: session.status,
    questionId: question.id,
    questionOrder: question.order,
    questionType: question.type,
    round,
    existingParticipantsBefore,
    existingVotesBefore,
    plannedParticipants: plannedVotes.length,
    plannedVotes: plannedVotes.length,
    timerSeconds,
    distribution: buildSelectionSummary(question, plannedVotes),
    freetextPreview:
      question.type === 'FREETEXT' ? plannedVotes.slice(0, 5).map((vote) => vote.freeText) : [],
  };

  if (options.dryRun) {
    log(JSON.stringify(summary, null, 2));
    return;
  }

  const participantData = plannedVotes.map((vote, index) => ({
    id: vote.participantId,
    nickname: vote.nickname,
    sessionId: session.id,
    teamId: vote.teamId,
    joinedAt: new Date(startedAt + index * 25),
  }));
  const voteData = plannedVotes.map((vote, index) => ({
    id: vote.voteId,
    sessionId: session.id,
    participantId: vote.participantId,
    questionId: question.id,
    freeText: vote.freeText,
    ratingValue: vote.ratingValue,
    responseTimeMs: vote.responseTimeMs,
    score: vote.score,
    streakCount: 0,
    streakBonus: 1,
    round,
    votedAt: new Date(startedAt + index * 25 + 5),
  }));
  const voteAnswerData = plannedVotes.flatMap((vote) =>
    vote.answerIds.map((answerOptionId) => ({
      voteId: vote.voteId,
      answerOptionId,
    })),
  );

  await prisma.$transaction(async (tx) => {
    await tx.participant.createMany({ data: participantData });
    await tx.vote.createMany({ data: voteData });
    if (voteAnswerData.length > 0) {
      await tx.voteAnswer.createMany({ data: voteAnswerData });
    }
  });

  const finalParticipantCount = await prisma.participant.count({
    where: { sessionId: session.id },
  });
  const finalVoteCount = await prisma.vote.count({
    where: {
      sessionId: session.id,
      questionId: question.id,
      round,
    },
  });

  log(
    JSON.stringify(
      {
        ...summary,
        finalParticipantCount,
        finalVoteCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
