import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db';
import { projectQaPlatformStatistics } from '../lib/qaPlatformProjection';

const RUN_PG = process.env['RUN_PG_QA_SCALE_TESTS'] === '1';

type CreatedQuestionRow = {
  id: string;
  replayed: boolean;
  participantQuestionCount: number;
  sessionQuestionCount: number;
};
type VoteRow = {
  questionId: string;
  myVote: 'UP' | 'DOWN' | null;
  upvoteCount: number;
  changed: boolean;
};

function keyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function code(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll('-', '').slice(0, 5)}`.toUpperCase();
}

async function createQuestion(input: {
  sessionId: string;
  participantId: string;
  key: string;
  text?: string;
}): Promise<CreatedQuestionRow> {
  const rows = await prisma.$queryRaw<CreatedQuestionRow[]>`
    SELECT *
    FROM arsnova_create_qa_question(
      ${input.sessionId},
      ${input.participantId},
      ${input.text ?? 'Skalierungsfrage'},
      ${keyHash(input.key)}::CHAR(64),
      'DISABLED'::"QaNlpStatus"
    )
  `;
  return rows[0]!;
}

async function changeVote(
  questionId: string,
  participantId: string,
  direction: 'UP' | 'DOWN',
): Promise<VoteRow> {
  const rows = await prisma.$queryRaw<VoteRow[]>`
    SELECT *
    FROM arsnova_change_qa_vote(
      ${questionId},
      ${participantId},
      ${direction}::"QaVoteDirection"
    )
  `;
  return rows[0]!;
}

describe.skipIf(!RUN_PG)('Q&A scale invariants (PostgreSQL)', () => {
  const sessionIds: string[] = [];
  let platformBefore: {
    qaQuestionsTotal: bigint;
    maxQaQuestionsSingleSession: number;
    maxQaQuestionsStatisticUpdatedAt: Date | null;
    qaStatisticsTrackingStartedAt: Date | null;
    qaStatisticsProjectedAt: Date | null;
    updatedAt: Date;
  } | null = null;

  beforeAll(async () => {
    platformBefore = await prisma.platformStatistic.findUnique({
      where: { id: 'default' },
      select: {
        qaQuestionsTotal: true,
        maxQaQuestionsSingleSession: true,
        maxQaQuestionsStatisticUpdatedAt: true,
        qaStatisticsTrackingStartedAt: true,
        qaStatisticsProjectedAt: true,
        updatedAt: true,
      },
    });
  });

  afterAll(async () => {
    if (sessionIds.length > 0) {
      await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
      await prisma.qaSessionStatisticProjection.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
    }
    if (platformBefore) {
      await prisma.$executeRaw`
        UPDATE "PlatformStatistic"
        SET
          "qaQuestionsTotal" = ${platformBefore.qaQuestionsTotal},
          "maxQaQuestionsSingleSession" = ${platformBefore.maxQaQuestionsSingleSession},
          "maxQaQuestionsStatisticUpdatedAt" =
            ${platformBefore.maxQaQuestionsStatisticUpdatedAt},
          "qaStatisticsTrackingStartedAt" = ${platformBefore.qaStatisticsTrackingStartedAt},
          "qaStatisticsProjectedAt" = ${platformBefore.qaStatisticsProjectedAt},
          "updatedAt" = ${platformBefore.updatedAt}
        WHERE "id" = 'default'
      `;
    } else {
      await prisma.platformStatistic.deleteMany({ where: { id: 'default' } });
    }
  });

  it('linearisiert zehnte/elfte Frage und replayt einen Commit ohne zweiten Platz', async () => {
    const now = new Date();
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: code('L'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
        qaClosesAt: new Date(now.getTime() + 3_600_000),
        expiresAt: new Date(now.getTime() + 7_200_000),
      },
    });
    sessionIds.push(session.id);
    const participant = await prisma.participant.create({
      data: { id: randomUUID(), sessionId: session.id, nickname: 'Limit' },
    });

    for (let index = 0; index < 9; index += 1) {
      await createQuestion({
        sessionId: session.id,
        participantId: participant.id,
        key: `initial-${index}`,
      });
    }
    const parallelKeys = ['parallel-a', 'parallel-b'] as const;
    const concurrent = await Promise.allSettled(
      parallelKeys.map((key) =>
        createQuestion({
          sessionId: session.id,
          participantId: participant.id,
          key,
        }),
      ),
    );
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const accepted = concurrent.find(
      (result): result is PromiseFulfilledResult<CreatedQuestionRow> =>
        result.status === 'fulfilled',
    )!.value;
    const replay = await createQuestion({
      sessionId: session.id,
      participantId: participant.id,
      key: concurrent[0]?.status === 'fulfilled' ? parallelKeys[0] : parallelKeys[1],
    });
    expect(replay.id).toBe(accepted.id);
    expect(replay.replayed).toBe(true);
    expect(await prisma.qaQuestion.count({ where: { sessionId: session.id } })).toBe(10);
    await expect(
      prisma.qaQuestion.create({
        data: {
          id: randomUUID(),
          sessionId: session.id,
          participantId: participant.id,
          text: 'Legacy-Image darf das Teilnahmelimit nicht umgehen',
        },
      }),
    ).rejects.toThrow(/ARSNOVA_QA_PARTICIPANT_LIMIT/u);

    await prisma.session.update({
      where: { id: session.id },
      data: { qaOpen: false },
    });
    const replayAfterClose = await createQuestion({
      sessionId: session.id,
      participantId: participant.id,
      key: concurrent[0]?.status === 'fulfilled' ? parallelKeys[0] : parallelKeys[1],
    });
    expect(replayAfterClose).toMatchObject({ id: accepted.id, replayed: true });
    await expect(
      createQuestion({
        sessionId: session.id,
        participantId: participant.id,
        key: 'after-close',
      }),
    ).rejects.toThrow(/ARSNOVA_QA_CLOSED/u);
    const counters = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
      select: {
        qaQuestionCount: true,
        qaQuestionPeakCount: true,
        qaQuestionsAcceptedTotal: true,
      },
    });
    expect(counters).toMatchObject({ qaQuestionCount: 10, qaQuestionPeakCount: 10 });
    expect(counters.qaQuestionsAcceptedTotal).toBe(10n);
  });

  it('lehnt 25.001 atomar ab und gibt nur durch physisches Delete einen Platz frei', async () => {
    const now = new Date();
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: code('Q'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
        qaClosesAt: new Date(now.getTime() + 3_600_000),
        expiresAt: new Date(now.getTime() + 7_200_000),
        qaQuestionCount: 24_999,
        qaQuestionPeakCount: 24_999,
        qaQuestionsAcceptedTotal: 24_999n,
      },
    });
    sessionIds.push(session.id);
    const participant = await prisma.participant.create({
      data: { id: randomUUID(), sessionId: session.id, nickname: 'Gesamtlimit' },
    });
    const finalQuestion = await createQuestion({
      sessionId: session.id,
      participantId: participant.id,
      key: 'question-25000',
    });
    await expect(
      createQuestion({
        sessionId: session.id,
        participantId: participant.id,
        key: 'question-25001',
      }),
    ).rejects.toThrow(/ARSNOVA_QA_SESSION_LIMIT/u);
    const rollbackParticipant = await prisma.participant.create({
      data: { id: randomUUID(), sessionId: session.id, nickname: 'Rollback' },
    });
    await expect(
      prisma.qaQuestion.create({
        data: {
          id: randomUUID(),
          sessionId: session.id,
          participantId: rollbackParticipant.id,
          text: 'Legacy-Image darf das Sessionlimit nicht umgehen',
        },
      }),
    ).rejects.toThrow(/ARSNOVA_QA_SESSION_LIMIT/u);

    await prisma.qaQuestion.update({
      where: { id: finalQuestion.id },
      data: { status: 'DELETED' },
    });
    await expect(
      createQuestion({
        sessionId: session.id,
        participantId: participant.id,
        key: 'still-full',
      }),
    ).rejects.toThrow(/ARSNOVA_QA_SESSION_LIMIT/u);

    await prisma.qaQuestion.delete({ where: { id: finalQuestion.id } });
    const replacement = await createQuestion({
      sessionId: session.id,
      participantId: participant.id,
      key: 'replacement',
    });
    expect(replacement.sessionQuestionCount).toBe(25_000);
    const counters = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
      select: { qaQuestionCount: true, qaQuestionPeakCount: true, qaQuestionsAcceptedTotal: true },
    });
    expect(counters.qaQuestionCount).toBe(25_000);
    expect(counters.qaQuestionPeakCount).toBe(25_000);
    expect(counters.qaQuestionsAcceptedTotal).toBe(25_001n);
  });

  it('projiziert Gesamtwert und Peak purge-sicher und idempotent', async () => {
    const now = new Date();
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: code('P'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
        qaClosesAt: new Date(now.getTime() + 3_600_000),
        expiresAt: new Date(now.getTime() + 7_200_000),
      },
    });
    sessionIds.push(session.id);
    const participant = await prisma.participant.create({
      data: { id: randomUUID(), sessionId: session.id, nickname: 'Projektion' },
    });
    await createQuestion({ sessionId: session.id, participantId: participant.id, key: 'one' });

    await projectQaPlatformStatistics();
    await projectQaPlatformStatistics();
    const beforePurge = await prisma.qaSessionStatisticProjection.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(beforePurge.questionsAcceptedTotal).toBe(1n);
    expect(beforePurge.questionPeakCount).toBe(1);

    await prisma.session.delete({ where: { id: session.id } });
    await projectQaPlatformStatistics();
    const afterPurge = await prisma.qaSessionStatisticProjection.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(afterPurge.questionsAcceptedTotal).toBe(1n);
    expect(afterPurge.questionPeakCount).toBe(1);
  });

  it('serialisiert parallele Richtungsstimmen und hält getrennte Zähler konsistent', async () => {
    const now = new Date();
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        code: code('V'),
        type: 'Q_AND_A',
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
        qaClosesAt: new Date(now.getTime() + 3_600_000),
        expiresAt: new Date(now.getTime() + 7_200_000),
      },
    });
    sessionIds.push(session.id);
    const [author, voterUp, voterDown] = await Promise.all(
      ['Autor', 'Dafür', 'Dagegen'].map((nickname) =>
        prisma.participant.create({
          data: { id: randomUUID(), sessionId: session.id, nickname },
        }),
      ),
    );
    const question = await createQuestion({
      sessionId: session.id,
      participantId: author!.id,
      key: 'vote-question',
    });

    await Promise.all([
      changeVote(question.id, voterUp!.id, 'UP'),
      changeVote(question.id, voterDown!.id, 'DOWN'),
    ]);
    let persisted = await prisma.qaQuestion.findUniqueOrThrow({
      where: { id: question.id },
      select: { positiveVoteCount: true, negativeVoteCount: true, upvoteCount: true },
    });
    expect(persisted).toEqual({
      positiveVoteCount: 1,
      negativeVoteCount: 1,
      upvoteCount: 0,
    });

    await changeVote(question.id, voterDown!.id, 'UP');
    persisted = await prisma.qaQuestion.findUniqueOrThrow({
      where: { id: question.id },
      select: { positiveVoteCount: true, negativeVoteCount: true, upvoteCount: true },
    });
    expect(persisted).toEqual({
      positiveVoteCount: 2,
      negativeVoteCount: 0,
      upvoteCount: 2,
    });
  });
});
