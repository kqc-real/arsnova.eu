/**
 * Erstellt eine beendete Demo-Session mit Teilnehmern, Votes und Bonus-Tokens
 * zum Testen von Leaderboard, Bonus-Codes, Export und Session-Bewertung.
 *
 * Aufruf: npm run seed:finished-demo -w @arsnova/backend
 *         (oder: cd apps/backend && npx tsx scripts/seed-finished-demo.ts)
 *
 * Voraussetzung: DATABASE_URL gesetzt, Prisma-Migrationen/ensure-schema ausgeführt.
 * Session-Bewertungen (SessionFeedback) werden nur angelegt, wenn die Tabelle existiert.
 *
 * Ausgabe: Session-Code DEMO01 – Host: /session/DEMO01/host, Join: /join mit Code DEMO01.
 * Zum Neu-Anlegen zuerst die Session (oder in Prisma Studio) löschen.
 */
import { randomBytes } from 'crypto';
import { prisma } from '../src/db';
import { calculateVoteScore } from '../src/lib/quizScoring';
import type { Difficulty, QuestionType } from '@arsnova/shared-types';

const SESSION_CODE = 'DEMO01';
const PARTICIPANT_COUNT = 12;
const BONUS_TOKEN_TOP = 5;
const NICKNAMES = [
  'Marie Curie',
  'Albert Einstein',
  'Max Planck',
  'Niels Bohr',
  'Erwin Schrödinger',
  'Werner Heisenberg',
  'Richard Feynman',
  'Stephen Hawking',
  'Rosalind Franklin',
  'Lise Meitner',
  'Carl Sagan',
  'Ada Lovelace',
];

function generateBonusCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = 'BNS-';
  for (let i = 0; i < 4; i++) code += chars[bytes[i]! % chars.length];
  code += '-';
  for (let i = 4; i < 8; i++) code += chars[bytes[i]! % chars.length];
  return code;
}

async function main(): Promise<void> {
  const existing = await prisma.session.findUnique({ where: { code: SESSION_CODE } });
  if (existing) {
    console.log('');
    console.log(`Session ${SESSION_CODE} existiert bereits.`);
    console.log('  Host:  /session/' + SESSION_CODE + '/host');
    console.log('  Join:  /join → Code ' + SESSION_CODE);
    console.log('  Neu anlegen: Session in Prisma Studio löschen, dann Skript erneut ausführen.');
    console.log('');
    process.exit(0);
  }

  const quiz = await prisma.quiz.create({
    data: {
      name: 'Demo-Quiz (Leaderboard & Bonus-Test)',
      showLeaderboard: true,
      bonusTokenCount: BONUS_TOKEN_TOP,
      preset: 'PLAYFUL',
      questions: {
        create: [
          {
            text: 'Was ist 2 + 2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'EASY',
            order: 0,
            answers: {
              create: [
                { text: '3', isCorrect: false },
                { text: '4', isCorrect: true },
                { text: '5', isCorrect: false },
                { text: '22', isCorrect: false },
              ],
            },
          },
          {
            text: 'Welche Einheit misst die elektrische Spannung?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            order: 1,
            answers: {
              create: [
                { text: 'Ampere', isCorrect: false },
                { text: 'Volt', isCorrect: true },
                { text: 'Ohm', isCorrect: false },
                { text: 'Watt', isCorrect: false },
              ],
            },
          },
          {
            text: 'In welchem Jahr wurde die Allgemeine Relativitätstheorie veröffentlicht?',
            type: 'SINGLE_CHOICE',
            difficulty: 'HARD',
            order: 2,
            answers: {
              create: [
                { text: '1905', isCorrect: false },
                { text: '1915', isCorrect: true },
                { text: '1925', isCorrect: false },
                { text: '1935', isCorrect: false },
              ],
            },
          },
        ],
      },
    },
    include: {
      questions: { include: { answers: true }, orderBy: { order: 'asc' } },
    },
  });

  const session = await prisma.session.create({
    data: {
      code: SESSION_CODE,
      type: 'QUIZ',
      status: 'FINISHED',
      quizId: quiz.id,
      currentQuestion: null,
      currentRound: 1,
      endedAt: new Date(),
      statusChangedAt: new Date(),
    },
  });

  const participants = await Promise.all(
    NICKNAMES.slice(0, PARTICIPANT_COUNT).map((nickname, index) =>
      prisma.participant.create({
        data: { sessionId: session.id, nickname: `${nickname}${index < 3 ? ' (Top)' : ''}` },
      }),
    ),
  );

  const timerMs = 30_000;
  for (const question of quiz.questions) {
    const correctId = question.answers.find((a) => a.isCorrect)!.id;
    const wrongIds = question.answers.filter((a) => !a.isCorrect).map((a) => a.id);
    const type = question.type as QuestionType;
    const difficulty = question.difficulty as Difficulty;
    const correctIds = question.answers.filter((a) => a.isCorrect).map((a) => a.id);

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i]!;
      const isCorrect = i < participants.length - 2;
      const responseTimeMs = isCorrect ? 5_000 + i * 1500 : 25_000;
      const selectedId = isCorrect ? correctId : wrongIds[i % wrongIds.length]!;
      const score = calculateVoteScore({
        type,
        difficulty,
        selectedAnswerIds: [selectedId],
        correctAnswerIds: correctIds,
        responseTimeMs,
        timerDurationMs: timerMs,
      });

      await prisma.vote.create({
        data: {
          sessionId: session.id,
          participantId: participant.id,
          questionId: question.id,
          score,
          responseTimeMs,
          round: 1,
          selectedAnswers: { create: [{ answerOptionId: selectedId }] },
        },
      });
    }
  }

  const votes = await prisma.vote.findMany({
    where: { sessionId: session.id, round: 1 },
    select: { participantId: true, score: true },
  });
  const totalByParticipant = new Map<string, number>();
  for (const p of participants) {
    totalByParticipant.set(p.id, 0);
  }
  for (const v of votes) {
    const cur = totalByParticipant.get(v.participantId) ?? 0;
    totalByParticipant.set(v.participantId, cur + v.score);
  }
  const ranked = [...totalByParticipant.entries()]
    .map(([pid, totalScore]) => ({ pid, totalScore }))
    .sort((a, b) => b.totalScore - a.totalScore);
  // Teilnehmer mit 0 Punkten erhalten keinen Bonus
  const eligible = ranked.filter(([, totalScore]) => totalScore > 0);
  const topN = eligible.slice(0, BONUS_TOKEN_TOP);
  const nicknameById = new Map(participants.map((p) => [p.id, p.nickname]));

  for (let i = 0; i < topN.length; i++) {
    const { pid, totalScore } = topN[i]!;
    await prisma.bonusToken.create({
      data: {
        token: generateBonusCode(),
        sessionId: session.id,
        participantId: pid,
        nickname: nicknameById.get(pid) ?? `Teilnehmer #${i + 1}`,
        quizName: quiz.name,
        totalScore,
        rank: i + 1,
      },
    });
  }

  try {
    for (let i = 0; i < Math.min(8, participants.length); i++) {
      await prisma.sessionFeedback.create({
        data: {
          sessionId: session.id,
          participantId: participants[i]!.id,
          overallRating: 3 + (i % 3),
          questionQualityRating: 4,
          wouldRepeat: i % 3 !== 2,
        },
      });
    }
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code !== 'P2021') throw e;
  }

  console.log('');
  console.log('Demo-Session angelegt.');
  console.log('  Session-Code: ', SESSION_CODE);
  console.log('  Host-Ansicht:  /session/' + SESSION_CODE + '/host');
  console.log('  Join-URL:      /join (Code ' + SESSION_CODE + ' eingeben)');
  console.log(
    '  Teilnehmer:    ' + participants.length + ', Top ' + BONUS_TOKEN_TOP + ' mit Bonus-Code.',
  );
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
