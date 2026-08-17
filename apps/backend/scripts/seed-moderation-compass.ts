#!/usr/bin/env tsx
/**
 * Befüllt eine bestehende Session mit allen Host-Signalen des Moderationskompasses (Story 8.9a).
 *
 * Ergänzt Freitext- und Q&A-Wortwolken-Seeds um: offene Moderationsfragen, Pin/Archiv,
 * Kontroverse, Quiz-Ergebnisse nach Freigabe (Verteilung, Schätzung/Histogramm,
 * Zuordnung/Reihenfolge/Kategorisierung, Rating) und Tempo-Blitzlicht.
 *
 * Beispiele:
 *   npm run seed:moderation-compass -w @arsnova/backend -- --code ABC123
 *   macOS: npm run spacy:macos-dev -- --code ABC123 --yes --skip-clean --skip-build
 */
import { randomUUID } from 'node:crypto';
import { format } from 'node:util';
import { prisma } from '../src/db';
import { getRedis } from '../src/redis';
import { resolveSessionCode } from './lib/prompt-session-code';

const COMPASS_MARK = '8.9a';
const QUIZ_VOTE_COUNT = 24;
const TEMPO_PARTICIPANTS = 80;
const TEMPO_TTL_SECONDS = 30 * 60;
const KNOWN_FEEDBACK_TTL_SECONDS = TEMPO_TTL_SECONDS + 60;
const PRESENCE_KEY_TTL_SECONDS = 210;

type CliOptions = {
  code: string;
  dryRun: boolean;
  help: boolean;
};

type MatchingPair = {
  leftId: string;
  left: string;
  rightId: string;
  right: string;
};

type MatchingSelection = { leftId: string; rightId: string };
type OrderingItem = { id: string; text: string };
type Category = { id: string; name: string };
type CategorizationItem = { id: string; text: string; correctCategoryId: string };

type CompassQuestion = {
  id: string;
  type: string;
  order: number;
  numericReferenceValue: number | null;
  numericIntervalLeft: number | null;
  numericIntervalRight: number | null;
  numericTwoRounds: boolean;
  numericMin: number | null;
  numericMax: number | null;
  matchingPairs: unknown;
  orderingItems: unknown;
  categories: unknown;
  categorizationItems: unknown;
  ratingMin: number | null;
  ratingMax: number | null;
  answers: Array<{ id: string; text: string; isCorrect: boolean }>;
};

type VoteInsert = {
  id: string;
  sessionId: string;
  participantId: string;
  questionId: string;
  round: number;
  score: number;
  votedAt: Date;
  isCorrect?: boolean;
  freeText?: string;
  numericValue?: number;
  ratingValue?: number;
  matchingSelections?: MatchingSelection[];
  orderingSequence?: string[];
  categorizationSelections?: Array<{ itemId: string; categoryId: string }>;
  answerIds?: string[];
};

function log(...values: unknown[]): void {
  process.stdout.write(`${format(...values)}\n`);
}

function printUsage(): void {
  log(`
Moderationskompass-Signale einer bestehenden Session befüllen (Story 8.9a)

Usage:
  npm run seed:moderation-compass -w @arsnova/backend -- --code ABC123
  SESSION_CODE=ABC123 npm run seed:moderation-compass -w @arsnova/backend

Optionen:
  --code <CODE>   Session-Code; ohne Angabe und im TTY wird er abgefragt
  --dry-run       Nur prüfen und geplante Mengen ausgeben
  --help          Hilfe anzeigen

Hinweise:
  - Freitext- und Q&A-Wortwolke vorher mit seed:session-votes / seed:qa-forum füllen.
  - Das Skript setzt RESULTS auf der aktuellen bzw. der Freitextfrage, aktiviert Q&A
    und Blitzlicht und schreibt ein Tempo-Signal (LOST) nach Redis.
  - Danach dieselbe Host-URL hart neu laden (/session/CODE/host). Den Code nicht
    auf der Startseite eingeben — das ist der Voter-Join.
  - Quiz-Fakten anderer Fragetypen erscheinen im Kompass, sobald die jeweilige
    Frage im Quizkanal als Ergebnis angezeigt wird.
`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const args = [...argv];
  const hasFlag = (name: string): boolean => {
    const index = args.indexOf(`--${name}`);
    if (index < 0) {
      return false;
    }
    args.splice(index, 1);
    return true;
  };
  const readValue = (name: string): string | undefined => {
    const equalsPrefix = `--${name}=`;
    const equalsIndex = args.findIndex((arg) => arg.startsWith(equalsPrefix));
    if (equalsIndex >= 0) {
      return args.splice(equalsIndex, 1)[0]!.slice(equalsPrefix.length);
    }
    const flagIndex = args.indexOf(`--${name}`);
    if (flagIndex >= 0) {
      const value = args[flagIndex + 1];
      args.splice(flagIndex, value && !value.startsWith('--') ? 2 : 1);
      return value;
    }
    return undefined;
  };

  return {
    help: hasFlag('help') || hasFlag('h'),
    dryRun: hasFlag('dry-run'),
    code: (readValue('code') ?? process.env['SESSION_CODE'] ?? '').trim().toUpperCase(),
  };
}

const OVERLAY_QUESTIONS: readonly {
  text: string;
  status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
  profile: 'pending' | 'pinned' | 'controversial' | 'archived' | 'deleted' | 'topic';
}[] = [
  {
    text: 'Kommt Kapitel 4 in der Klausur vor?',
    status: 'PENDING',
    profile: 'pending',
  },
  {
    text: 'Wie berechnet man den Median genau?',
    status: 'PENDING',
    profile: 'pending',
  },
  {
    text: 'Bitte Kapitel 4 noch einmal erklären.',
    status: 'PENDING',
    profile: 'pending',
  },
  {
    text: 'Welche Formel gilt für den Median?',
    status: 'PINNED',
    profile: 'pinned',
  },
  {
    text: 'Ist die Klausur open book?',
    status: 'ACTIVE',
    profile: 'controversial',
  },
  {
    text: 'Sollten wir Kapitel 4 vor der Übung abschließen?',
    status: 'ACTIVE',
    profile: 'topic',
  },
  {
    text: 'Alte Debatte zur Anwesenheitspflicht',
    status: 'ARCHIVED',
    profile: 'archived',
  },
  {
    text: 'Gelöschte Streitfrage zur Bonusregel',
    status: 'DELETED',
    profile: 'deleted',
  },
];

function asPairs(value: unknown): MatchingPair[] {
  return Array.isArray(value) ? (value as MatchingPair[]) : [];
}

function asOrdering(value: unknown): OrderingItem[] {
  return Array.isArray(value) ? (value as OrderingItem[]) : [];
}

function asCategories(value: unknown): Category[] {
  return Array.isArray(value) ? (value as Category[]) : [];
}

function asCatItems(value: unknown): CategorizationItem[] {
  return Array.isArray(value) ? (value as CategorizationItem[]) : [];
}

function omitUndefined<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as T;
}

function controversySideCount(participantCount: number, voterCount: number): number {
  const needed = Math.ceil(participantCount * 0.08) + 1;
  return Math.min(Math.floor(voterCount / 2), Math.max(needed, 24));
}

function clusteredOutsideValue(question: CompassQuestion): number {
  const min = question.numericMin;
  const max = question.numericMax;
  const left = question.numericIntervalLeft;
  const right = question.numericIntervalRight;
  const reference = question.numericReferenceValue ?? 0;
  let value: number;
  if (typeof left === 'number' && typeof min === 'number' && min < left) {
    value = min + (left - min) * 0.2;
  } else if (typeof right === 'number' && typeof max === 'number' && max > right) {
    value = right + (max - right) * 0.2;
  } else if (typeof left === 'number') {
    value = left - Math.max(0.05, Math.abs(left) * 0.03);
  } else {
    value = reference * 0.7;
  }
  if (typeof min === 'number') {
    value = Math.max(min, value);
  }
  if (typeof max === 'number') {
    value = Math.min(max, value);
  }
  return value;
}

function fartherOutsideValue(question: CompassQuestion, firstOutside: number): number {
  const reference = question.numericReferenceValue ?? firstOutside;
  const min = question.numericMin;
  const max = question.numericMax;
  const direction = firstOutside <= reference ? -1 : 1;
  const span = Math.max(Math.abs(reference) * 0.04, 8);
  let value = firstOutside + direction * span;
  if (typeof min === 'number') {
    value = Math.max(min, value);
  }
  if (typeof max === 'number') {
    value = Math.min(max, value);
  }
  if (value === firstOutside && typeof min === 'number' && firstOutside > min) {
    value = min;
  }
  if (value === firstOutside && typeof max === 'number' && firstOutside < max) {
    value = max;
  }
  return value;
}

async function ensureParticipants(
  sessionId: string,
  needed: number,
): Promise<Array<{ id: string; nickname: string }>> {
  const existing = await prisma.participant.findMany({
    where: { sessionId },
    select: { id: true, nickname: true },
    orderBy: { joinedAt: 'asc' },
  });
  if (existing.length >= needed) {
    return existing;
  }
  const created = Array.from({ length: needed - existing.length }, (_, index) => ({
    id: randomUUID(),
    sessionId,
    nickname: `Kompass Seed ${String(existing.length + index + 1).padStart(3, '0')}`,
  }));
  await prisma.participant.createMany({ data: created });
  return prisma.participant.findMany({
    where: { sessionId },
    select: { id: true, nickname: true },
    orderBy: { joinedAt: 'asc' },
  });
}

async function seedOverlayQuestions(
  sessionId: string,
  participantIds: readonly string[],
): Promise<{ created: number; votes: number; controversySide: number }> {
  await prisma.qaQuestion.deleteMany({
    where: {
      sessionId,
      text: { in: OVERLAY_QUESTIONS.map((question) => question.text) },
    },
  });

  const authorId = participantIds[0];
  if (!authorId) {
    throw new Error('Keine Teilnehmenden für Q&A-Overlay.');
  }
  const voters = participantIds.filter((id) => id !== authorId);
  const controversySide = controversySideCount(participantIds.length, voters.length);
  let votes = 0;

  for (const [index, overlay] of OVERLAY_QUESTIONS.entries()) {
    const questionId = randomUUID();
    const controversial =
      overlay.profile === 'controversial' ||
      overlay.profile === 'archived' ||
      overlay.profile === 'deleted';
    const upvoteCount = overlay.profile === 'pending' ? 3 + index : 12;

    await prisma.qaQuestion.create({
      data: {
        id: questionId,
        sessionId,
        participantId: authorId,
        text: overlay.text,
        status: overlay.status,
        upvoteCount: controversial ? 0 : upvoteCount,
        createdAt: new Date(Date.now() - (OVERLAY_QUESTIONS.length - index) * 60_000),
      },
    });

    if (controversial && controversySide > 0) {
      const rows = [
        ...voters.slice(0, controversySide).map((participantId) => ({
          id: randomUUID(),
          qaQuestionId: questionId,
          participantId,
          direction: 'UP' as const,
        })),
        ...voters.slice(controversySide, controversySide * 2).map((participantId) => ({
          id: randomUUID(),
          qaQuestionId: questionId,
          participantId,
          direction: 'DOWN' as const,
        })),
      ];
      await prisma.qaUpvote.createMany({ data: rows });
      votes += rows.length;
    } else if (
      overlay.profile === 'pending' ||
      overlay.profile === 'pinned' ||
      overlay.profile === 'topic'
    ) {
      const count = Math.min(upvoteCount, voters.length);
      await prisma.qaUpvote.createMany({
        data: voters.slice(0, count).map((participantId) => ({
          id: randomUUID(),
          qaQuestionId: questionId,
          participantId,
          direction: 'UP' as const,
        })),
      });
      votes += count;
    }
  }

  return { created: OVERLAY_QUESTIONS.length, votes, controversySide };
}

async function insertVotes(voteRows: VoteInsert[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.vote.createMany({
      data: voteRows.map(({ answerIds: _answerIds, ...vote }) => omitUndefined(vote)),
    });
    const answerRows = voteRows.flatMap((vote) =>
      (vote.answerIds ?? []).map((answerOptionId) => ({
        voteId: vote.id,
        answerOptionId,
      })),
    );
    if (answerRows.length > 0) {
      await tx.voteAnswer.createMany({ data: answerRows });
    }
  });
}

async function seedQuestionVotes(
  sessionId: string,
  question: CompassQuestion,
  participantIds: readonly string[],
): Promise<string | null> {
  const existing = await prisma.vote.count({
    where: { sessionId, questionId: question.id },
  });
  if (existing > 0) {
    return `${question.type}#${question.order} bereits ${existing} Stimmen`;
  }

  const ids = participantIds.slice(0, QUIZ_VOTE_COUNT);
  if (ids.length === 0) {
    return `${question.type}#${question.order} übersprungen (keine Teilnehmenden)`;
  }

  const startedAt = Date.now();
  const voteRows: VoteInsert[] = [];
  const wrongShare = Math.ceil(ids.length * 0.72);

  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE': {
      const correct = question.answers
        .filter((answer) => answer.isCorrect)
        .map((answer) => answer.id);
      const wrong = question.answers
        .filter((answer) => !answer.isCorrect)
        .map((answer) => answer.id);
      const wrongId = wrong[0] ?? correct[0];
      if (!wrongId && correct.length === 0) {
        return `${question.type}#${question.order} ohne Optionen`;
      }
      ids.forEach((participantId, index) => {
        const useWrong = index < wrongShare;
        const answerIds =
          question.type === 'MULTIPLE_CHOICE' && useWrong && wrong.length > 0
            ? wrong.slice(0, Math.min(2, wrong.length))
            : useWrong
              ? [wrongId!]
              : correct.length > 0
                ? correct
                : [wrongId!];
        voteRows.push({
          id: randomUUID(),
          sessionId,
          participantId,
          questionId: question.id,
          round: 1,
          score: 0,
          votedAt: new Date(startedAt + index * 20),
          isCorrect: !useWrong && correct.length > 0,
          answerIds,
        });
      });
      break;
    }
    case 'SHORT_TEXT': {
      const correctText =
        question.answers.find((answer) => answer.isCorrect)?.text ?? 'Peer Instruction';
      ids.forEach((participantId, index) => {
        const useWrong = index < wrongShare;
        voteRows.push({
          id: randomUUID(),
          sessionId,
          participantId,
          questionId: question.id,
          round: 1,
          score: 0,
          votedAt: new Date(startedAt + index * 20),
          isCorrect: !useWrong,
          freeText: useWrong ? 'Gruppenpuzzle' : correctText,
        });
      });
      break;
    }
    case 'NUMERIC_ESTIMATE': {
      const reference = question.numericReferenceValue ?? 0;
      const outside = clusteredOutsideValue(question);
      const farther = fartherOutsideValue(question, outside);
      ids.forEach((participantId, index) => {
        const inBand = index >= wrongShare;
        const round1 = inBand ? reference : outside;
        voteRows.push({
          id: randomUUID(),
          sessionId,
          participantId,
          questionId: question.id,
          round: 1,
          score: 0,
          votedAt: new Date(startedAt + index * 20),
          numericValue: round1,
        });
        if (question.numericTwoRounds) {
          const leaveBand = inBand && index % 3 !== 0;
          voteRows.push({
            id: randomUUID(),
            sessionId,
            participantId,
            questionId: question.id,
            round: 2,
            score: 0,
            votedAt: new Date(startedAt + index * 20 + 5),
            numericValue: inBand && !leaveBand ? reference : farther,
          });
        }
      });
      break;
    }
    case 'MATCHING': {
      const pairs = asPairs(question.matchingPairs);
      if (pairs.length < 2) {
        return `MATCHING#${question.order} ohne Paare`;
      }
      const confused: MatchingSelection = {
        leftId: pairs[0]!.leftId,
        rightId: pairs[1]!.rightId,
      };
      ids.forEach((participantId, index) => {
        const matchingSelections = pairs.map((pair, pairIndex) =>
          index < wrongShare && pairIndex === 0
            ? confused
            : { leftId: pair.leftId, rightId: pair.rightId },
        );
        voteRows.push({
          id: randomUUID(),
          sessionId,
          participantId,
          questionId: question.id,
          round: 1,
          score: 0,
          votedAt: new Date(startedAt + index * 20),
          isCorrect: index >= wrongShare,
          matchingSelections,
        });
      });
      break;
    }
    case 'ORDERING': {
      const items = asOrdering(question.orderingItems);
      if (items.length < 2) {
        return `ORDERING#${question.order} ohne Elemente`;
      }
      const correct = items.map((item) => item.id);
      const swapped = [correct[1]!, correct[0]!, ...correct.slice(2)];
      ids.forEach((participantId, index) => {
        const useWrong = index < wrongShare;
        voteRows.push({
          id: randomUUID(),
          sessionId,
          participantId,
          questionId: question.id,
          round: 1,
          score: 0,
          votedAt: new Date(startedAt + index * 20),
          isCorrect: !useWrong,
          orderingSequence: useWrong ? swapped : correct,
        });
      });
      break;
    }
    case 'CATEGORIZATION': {
      const items = asCatItems(question.categorizationItems);
      const categories = asCategories(question.categories);
      if (items.length === 0 || categories.length < 2) {
        return `CATEGORIZATION#${question.order} ohne Kategorien`;
      }
      const wrongCategory =
        categories.find((category) => category.id !== items[0]!.correctCategoryId) ??
        categories[0]!;
      ids.forEach((participantId, index) => {
        const miss = index < wrongShare;
        voteRows.push({
          id: randomUUID(),
          sessionId,
          participantId,
          questionId: question.id,
          round: 1,
          score: 0,
          votedAt: new Date(startedAt + index * 20),
          isCorrect: !miss,
          categorizationSelections: items.map((item, itemIndex) => ({
            itemId: item.id,
            categoryId: miss && itemIndex === 0 ? wrongCategory.id : item.correctCategoryId,
          })),
        });
      });
      break;
    }
    case 'RATING': {
      const min = question.ratingMin ?? 1;
      ids.forEach((participantId, index) => {
        voteRows.push({
          id: randomUUID(),
          sessionId,
          participantId,
          questionId: question.id,
          round: 1,
          score: 0,
          votedAt: new Date(startedAt + index * 20),
          ratingValue: index % 5 === 0 ? min + 1 : min,
        });
      });
      break;
    }
    default:
      return null;
  }

  await insertVotes(voteRows);
  return `${question.type}#${question.order}: ${voteRows.length} Stimmen`;
}

async function seedTempo(
  code: string,
  sessionId: string,
  participantIds: readonly string[],
): Promise<{ presence: number; lost: number }> {
  const redis = getRedis();
  const ids = participantIds.slice(0, Math.min(TEMPO_PARTICIPANTS, participantIds.length));
  const lostCount = Math.ceil(ids.length * 0.4);
  const slowCount = Math.ceil(ids.length * 0.25);
  const now = Date.now();
  const presenceKey = `presence:session:${sessionId}`;
  const feedbackKey = `qf:${code}`;
  const choicesKey = `qf:choices:${code}`;
  const knownKey = `qf:known:${code}`;
  const votersKey = `qf:voters:${code}`;

  const distribution = {
    SPEED_UP: 0,
    FOLLOWING: Math.max(0, ids.length - lostCount - slowCount),
    SLOW_DOWN: slowCount,
    LOST: lostCount,
  };
  const payload = {
    type: 'TEMPO',
    locked: false,
    totalVotes: ids.length,
    distribution,
    sessionBound: true,
  };

  const choices: Record<string, string> = {};
  for (const [index, participantId] of ids.entries()) {
    choices[participantId] =
      index < lostCount ? 'LOST' : index < lostCount + slowCount ? 'SLOW_DOWN' : 'FOLLOWING';
  }

  const multi = redis.multi();
  multi.set(feedbackKey, JSON.stringify(payload), 'EX', TEMPO_TTL_SECONDS);
  multi.set(knownKey, '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
  multi.del(choicesKey);
  multi.del(votersKey);
  multi.del(presenceKey);
  if (Object.keys(choices).length > 0) {
    multi.hset(choicesKey, choices);
  }
  for (const participantId of ids) {
    multi.sadd(votersKey, participantId);
    multi.zadd(presenceKey, now, participantId);
  }
  multi.expire(choicesKey, TEMPO_TTL_SECONDS);
  multi.expire(votersKey, TEMPO_TTL_SECONDS);
  multi.expire(presenceKey, PRESENCE_KEY_TTL_SECONDS);
  await multi.exec();

  return { presence: ids.length, lost: lostCount };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  options.code = await resolveSessionCode(options.code);
  const session = await prisma.session.findUnique({
    where: { code: options.code },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { answers: true },
          },
        },
      },
    },
  });
  if (!session) {
    throw new Error(`Session ${options.code} nicht gefunden.`);
  }
  if (session.status === 'FINISHED') {
    throw new Error(`Session ${options.code} ist beendet und wird nicht befüllt.`);
  }
  if (!session.quiz) {
    throw new Error(`Session ${options.code} hat kein Quiz.`);
  }

  const needed = Math.max(QUIZ_VOTE_COUNT, TEMPO_PARTICIPANTS, 80);
  const participants = options.dryRun
    ? await prisma.participant.findMany({
        where: { sessionId: session.id },
        select: { id: true, nickname: true },
      })
    : await ensureParticipants(session.id, needed);
  const participantIds = participants.map((participant) => participant.id);

  const freetext = session.quiz.questions.find((question) => question.type === 'FREETEXT');
  const currentOrder =
    freetext?.order ?? session.currentQuestion ?? session.quiz.questions[0]?.order ?? 0;

  const plan = {
    sessionCode: session.code,
    sessionStatus: session.status,
    currentQuestion: currentOrder,
    overlayQuestions: OVERLAY_QUESTIONS.length,
    quizTypes: session.quiz.questions.map((question) => `${question.type}#${question.order}`),
    participants: participantIds.length,
    mark: COMPASS_MARK,
  };

  if (options.dryRun) {
    log(JSON.stringify(plan, null, 2));
    return;
  }

  const overlay = await seedOverlayQuestions(session.id, participantIds);
  const quizReports: string[] = [];
  for (const question of session.quiz.questions) {
    if (question.type === 'FREETEXT' || question.type === 'SURVEY') {
      continue;
    }
    const report = await seedQuestionVotes(session.id, question, participantIds);
    if (report) {
      quizReports.push(report);
    }
  }

  const tempo = await seedTempo(options.code, session.id, participantIds);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: 'RESULTS',
      currentQuestion: currentOrder,
      currentRound: 1,
      statusChangedAt: new Date(),
    },
  });

  log('');
  log('Moderationskompass-Signale befüllt.');
  log({
    ...plan,
    overlay,
    quizReports,
    tempo,
    channels: 'quiz + Q&A + Blitzlicht',
    sessionStatus: 'RESULTS',
    hint: 'Dieselbe Host-URL hart neu laden (/session/CODE/host), nicht den Code auf der Startseite joinen. Tempo-Presence gilt ca. 3 Minuten. Quiz-Fakten: jeweilige Frage als Ergebnis anzeigen.',
  });
  log('');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    try {
      await getRedis().quit();
    } catch {
      /* ignore */
    }
  });
