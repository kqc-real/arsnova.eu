#!/usr/bin/env tsx
/**
 * Befüllt eine bestehende Lobby-Session mit Teilnehmenden und Stimmen,
 * ohne Host-Token zu tauschen und ohne die Session zu starten oder zu beenden.
 *
 *   npx tsx scripts/seed-lobby-classroom-fill.ts --code K5GSB4 --count 50
 */
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db';
import { calculateVoteScore } from '../src/lib/quizScoring';
import type { Difficulty, QuestionType } from '@arsnova/shared-types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').replace(/\/+$/, '');
const FREETEXT = ['Praxis', 'Beispiele', 'Austausch', 'Visualisierung', 'Feedback'];

type Pair = { leftId: string; rightId: string };
type OrderItem = { id: string; text?: string };
type Category = { id: string; name?: string };
type CategoryItem = { id: string; correctCategoryId: string };

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const eq = process.argv.find((arg) => arg.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1]!.startsWith('--')) {
    return process.argv[idx + 1]!;
  }
  return fallback;
}

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(right);
  return left.every((id) => set.has(id));
}

async function loadNickname(index: number): Promise<string> {
  const mod = await import(
    pathToFileURL(join(__dirname, '../../../scripts/load/lib/kindergarten-nicknames.mjs')).href
  );
  return mod.kindergartenNickname(index, 'de');
}

function createClient() {
  return createTRPCProxyClient({
    links: [httpLink({ url: TRPC_URL })],
  });
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

function pickChoice(
  answers: Array<{ id: string; isCorrect: boolean }>,
  index: number,
  type: QuestionType,
  order: number,
): string[] {
  const ids = answers.map((answer) => answer.id);
  const correct = answers.filter((answer) => answer.isCorrect).map((answer) => answer.id);
  const wrong = ids.filter((id) => !correct.includes(id));
  if (type === 'SURVEY') {
    return [
      ids[
        index % 10 < 4 ? 0 : index % 10 < 7 ? 1 : index % 10 < 9 ? 2 : Math.min(3, ids.length - 1)
      ]!,
    ];
  }
  if (type === 'MULTIPLE_CHOICE') {
    if (order === 4) {
      const bucket = index % 10;
      if (bucket < 6) return correct.slice(1);
      if (bucket < 8) return wrong.slice(0, 1);
      if (bucket === 8) return correct.slice(0, 1);
      return correct;
    }
    return correct.length > 0 ? correct : ids.slice(0, 1);
  }
  const correctId = correct[0] ?? ids[0]!;
  const wrongId = wrong[0] ?? ids[ids.length - 1]!;
  const otherWrong = wrong[1] ?? wrongId;
  if (order === 5) {
    const twentyTwo =
      answers.find((answer) => /\b22\b/.test(answer.text))?.id ??
      wrong[wrong.length - 1] ??
      wrongId;
    const bucket = index % 10;
    if (bucket < 8) return [twentyTwo];
    if (bucket === 8) return [otherWrong];
    return [correctId];
  }
  if (order === 3) return [index % 5 < 2 ? wrongId : correctId];
  if (order === 6) return [index % 4 === 0 ? correctId : otherWrong];
  return [index % 3 === 0 ? wrongId : correctId];
}

async function main(): Promise<void> {
  const code = argValue('code', process.env.SESSION_CODE ?? '')
    .trim()
    .toUpperCase();
  const count = Math.max(1, Number(argValue('count', process.env.PARTICIPANTS ?? '50')));
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('Bitte --code K5GSB4 angeben.');
  }

  const session = await prisma.session.findUnique({
    where: { code },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: { answers: true },
          },
        },
      },
      participants: { select: { id: true, nickname: true } },
    },
  });
  if (!session?.quiz) {
    throw new Error(`Session ${code} nicht gefunden oder ohne Quiz.`);
  }
  if (session.status !== 'LOBBY') {
    throw new Error(`Session ${code} ist ${session.status}, erwartet LOBBY.`);
  }

  const publicTrpc = createClient() as {
    session: {
      getInfo: {
        query: (input: { code: string }) => Promise<{ status?: string; quizName?: string | null }>;
      };
      join: {
        mutate: (input: {
          code: string;
          nickname: string;
          anonymousClientId: string;
        }) => Promise<{ id: string; participantId: string }>;
      };
    };
  };
  const info = await publicTrpc.session.getInfo.query({ code });
  process.stdout.write(
    `Session ${code} (${info.quizName ?? session.quiz.name}) Status ${info.status}\n`,
  );

  const taken = new Set(session.participants.map((participant) => participant.nickname));
  const nicknames: string[] = [];
  let cursor = 0;
  const needed = Math.max(0, count - session.participants.length);
  while (nicknames.length < needed) {
    const nickname = await loadNickname(cursor);
    cursor += 1;
    if (!taken.has(nickname)) {
      nicknames.push(nickname);
      taken.add(nickname);
    }
  }

  const joined = await mapLimit(nicknames, 10, async (nickname) =>
    publicTrpc.session.join.mutate({
      code,
      nickname,
      anonymousClientId: randomUUID(),
    }),
  );
  const participantIds = [
    ...session.participants.map((participant) => participant.id),
    ...joined.map((row) => row.participantId),
  ];
  process.stdout.write(`Teilnehmende gesamt: ${participantIds.length} (neu ${joined.length})\n`);

  const n = participantIds.length;
  let votes = 0;
  for (const question of session.quiz.questions) {
    const type = question.type as QuestionType;
    const difficulty = question.difficulty as Difficulty;
    const answers = question.answers.map((answer) => ({
      id: answer.id,
      isCorrect: answer.isCorrect,
      text: answer.text,
    }));
    const correctIds = answers.filter((answer) => answer.isCorrect).map((answer) => answer.id);
    const pairs = (question.matchingPairs as Pair[] | null) ?? [];
    const orderItems = (question.orderingItems as OrderItem[] | null) ?? [];
    const categories = (question.categories as Category[] | null) ?? [];
    const categoryItems = (question.categorizationItems as CategoryItem[] | null) ?? [];
    const rounds = question.numericTwoRounds ? [1, 2] : [1];

    for (const round of rounds) {
      for (let index = 0; index < participantIds.length; index += 1) {
        const participantId = participantIds[index]!;
        let answerIds: string[] = [];
        let freeText: string | null = null;
        let ratingValue: number | null = null;
        let numericValue: number | null = null;
        let matchingSelections: Pair[] | null = null;
        let orderingSequence: string[] = [];
        let categorizationSelections: Array<{ itemId: string; categoryId: string }> | null = null;
        let isCorrect: boolean | null = null;

        switch (type) {
          case 'SURVEY':
          case 'SINGLE_CHOICE':
          case 'MULTIPLE_CHOICE':
            answerIds = pickChoice(answers, index, type, question.order);
            isCorrect = type === 'SURVEY' ? null : sameIds(answerIds, correctIds);
            break;
          case 'FREETEXT':
            freeText = FREETEXT[index % FREETEXT.length]!;
            isCorrect = null;
            break;
          case 'SHORT_TEXT':
            freeText = index % 3 === 0 ? 'Peer Instruction' : 'Think Pair Share';
            break;
          case 'RATING':
            ratingValue = index % 10 < 5 ? 5 : index % 10 < 8 ? 4 : 3;
            isCorrect = null;
            break;
          case 'NUMERIC_ESTIMATE': {
            if (question.numericTwoRounds) {
              const outside = [1500, 1600, 1648, 1655, 1918, 1950, 1999, 2000];
              const inBand = index < Math.round(n * (round === 1 ? 0.3 : 0.82));
              numericValue = inBand ? 1789 : outside[index % outside.length]!;
            } else {
              numericValue = index % 10 === 0 ? 3.5 : 3.14;
            }
            break;
          }
          case 'ORDERING': {
            const correct = orderItems.map((item) => item.id);
            const band = index / n;
            if (band < 0.35) orderingSequence = correct;
            else if (band < 0.7) {
              orderingSequence = [...correct];
              const swapAt = Math.min(correct.length - 2, 1 + (index % 3));
              [orderingSequence[swapAt], orderingSequence[swapAt + 1]] = [
                orderingSequence[swapAt + 1]!,
                orderingSequence[swapAt]!,
              ];
            } else {
              orderingSequence = [...correct.slice(1), correct[0]!];
            }
            isCorrect = orderingSequence.join() === correct.join();
            break;
          }
          case 'MATCHING': {
            const band = index / n;
            if (band < 0.35)
              matchingSelections = pairs.map((pair) => ({
                leftId: pair.leftId,
                rightId: pair.rightId,
              }));
            else if (band < 0.7) {
              const a = index % pairs.length;
              const b = (a + 1) % pairs.length;
              matchingSelections = pairs.map((pair, pairIndex) => {
                if (pairIndex === a) return { leftId: pair.leftId, rightId: pairs[b]!.rightId };
                if (pairIndex === b) return { leftId: pair.leftId, rightId: pairs[a]!.rightId };
                return { leftId: pair.leftId, rightId: pair.rightId };
              });
            } else {
              matchingSelections = pairs.map((pair, pairIndex) => ({
                leftId: pair.leftId,
                rightId: pairs[(pairIndex + 1) % pairs.length]!.rightId,
              }));
            }
            isCorrect = matchingSelections.every(
              (sel, pairIndex) => sel.rightId === pairs[pairIndex]?.rightId,
            );
            break;
          }
          case 'CATEGORIZATION': {
            const band = index / n;
            if (band < 0.35) {
              categorizationSelections = categoryItems.map((item) => ({
                itemId: item.id,
                categoryId: item.correctCategoryId,
              }));
            } else {
              categorizationSelections = categoryItems.map((item, itemIndex) => {
                const wrong =
                  categories.find((category) => category.id !== item.correctCategoryId) ??
                  categories[(index + itemIndex) % categories.length]!;
                return { itemId: item.id, categoryId: wrong.id };
              });
            }
            isCorrect = categorizationSelections.every(
              (sel, itemIndex) => sel.categoryId === categoryItems[itemIndex]?.correctCategoryId,
            );
            break;
          }
          default:
            throw new Error(`Unbekannter Typ ${type}`);
        }

        const responseTimeMs = 1200 + index * 37 + round * 180;
        const score = calculateVoteScore({
          type,
          difficulty,
          selectedAnswerIds: answerIds,
          correctAnswerIds: correctIds,
          freeText,
          isCorrectOverride: isCorrect ?? undefined,
          numericEstimateValue: numericValue,
          numericEstimateReferenceValue: question.numericReferenceValue,
          responseTimeMs,
          timerDurationMs: (question.timer ?? session.quiz.defaultTimer ?? 30) * 1000,
        });
        const confidenceValue = question.confidenceEnabled ? 1 + (index % 5) : null;

        await prisma.vote.create({
          data: {
            sessionId: session.id,
            participantId,
            questionId: question.id,
            freeText,
            ratingValue,
            numericValue,
            confidenceValue,
            matchingSelections:
              type === 'MATCHING' ? (matchingSelections ?? Prisma.DbNull) : Prisma.DbNull,
            orderingSequence: type === 'ORDERING' ? orderingSequence : [],
            categorizationSelections:
              type === 'CATEGORIZATION'
                ? (categorizationSelections ?? Prisma.DbNull)
                : Prisma.DbNull,
            responseTimeMs,
            score,
            isCorrect,
            streakCount: 0,
            streakBonus: 1,
            round,
            selectedAnswers: answerIds.length
              ? { create: answerIds.map((answerOptionId) => ({ answerOptionId })) }
              : undefined,
          },
        });
        votes += 1;
      }
    }
    process.stdout.write(`  Frage ${question.order + 1} ${type}: Stimmen geschrieben\n`);
  }

  const after = await prisma.session.findUnique({
    where: { id: session.id },
    select: {
      status: true,
      currentQuestion: true,
      _count: { select: { participants: true, votes: true } },
    },
  });
  process.stdout.write(
    JSON.stringify(
      {
        code,
        status: after?.status,
        currentQuestion: after?.currentQuestion,
        participants: after?._count.participants,
        votesWritten: votes,
        votesTotal: after?._count.votes,
      },
      null,
      2,
    ) + '\n',
  );
}

main()
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
