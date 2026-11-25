/**
 * PostgreSQL-Nachweis, dass echte Datenbankänderungen den Snapshot-Hash der
 * Q&A-Zusammenfassung ändern (Stimme, neue Frage, Beitritt, Löschung durch Host
 * und durch Teilnehmende) und eine Quizstimme ihn nicht ändert.
 *
 * Opt-in über `RUN_PG_QA_SUMMARY_HASH_TESTS=1`; braucht `DATABASE_URL` und
 * `REDIS_URL`. Gemockt ist nur die Host-Tokenprüfung; Fragen, Stimmen,
 * Teilnehmer-Capabilities, Trigger und Kontextaufbau laufen echt.
 * Semantische Themen sind per Env abgeschaltet, damit der Hash nicht von
 * Redis-Themensnapshots abhängt.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { hostAuthMocks } = vi.hoisted(() => ({
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import { prisma } from '../db';
import { buildModerationPromptContext } from '../lib/moderationPromptContext';
import {
  packSummaryModerationPromptContext,
  prepareFreshModerationSummaryContext,
} from '../lib/moderationSummaryContext';
import { qaRouter } from '../routers/qa';
import {
  addParticipant,
  capturePlatformStatistic,
  changeVote,
  cleanupFixtures,
  createFixtureRegistry,
  createQuestion,
  createReleasedQuiz,
  createSession,
  deleteFixtureRedisKeys,
  quizVote,
  restorePlatformStatistic,
  type PlatformStatisticSnapshot,
} from './lib/qa-summary-pg-fixture';

const RUN_PG = process.env['RUN_PG_QA_SUMMARY_HASH_TESTS'] === '1';
const ACCESS = { hostToken: 'host-token' } as const;
const PACKED_AT = new Date('2026-01-15T10:06:00.000Z');
const hostCaller = qaRouter.createCaller({ req: {} as never });

type Corpus = {
  readonly sessionId: string;
  readonly code: string;
  readonly participants: readonly { readonly id: string; readonly capability: string }[];
  readonly questionIds: readonly string[];
};

async function prepared(sessionId: string) {
  const result = await prepareFreshModerationSummaryContext({
    sessionId,
    locale: 'de',
    access: ACCESS,
    packedAt: PACKED_AT,
  });
  return result.request.promptContext;
}

async function snapshotHash(sessionId: string): Promise<string> {
  return (await prepared(sessionId)).snapshotHash;
}

async function questionVotesRevision(sessionId: string): Promise<string> {
  const revision = (await prepared(sessionId)).context.meta.revisions.questionVotes;
  if (revision.state !== 'available') throw new Error(`questionVotes revision ${revision.state}`);
  return revision.value;
}

async function sourceIds(sessionId: string): Promise<string[]> {
  return (await prepared(sessionId)).context.sources.map((source) => source.id);
}

async function revisions(
  sessionId: string,
): Promise<{ qaRankingRevision: number; participantRevision: number }> {
  return prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { qaRankingRevision: true, participantRevision: true },
  });
}

describe.skipIf(!RUN_PG)('Q&A summary snapshot hash (PostgreSQL + Redis)', () => {
  const registry = createFixtureRegistry();
  let platformBefore: PlatformStatisticSnapshot | null = null;

  async function participantCount(sessionId: string): Promise<number> {
    return prisma.participant.count({ where: { sessionId } });
  }

  async function createCorpus(
    options: {
      readonly type?: 'Q_AND_A' | 'QUIZ';
      readonly status?: 'ACTIVE' | 'QUESTION_OPEN';
      readonly quizId?: string;
      readonly currentQuestion?: number;
      readonly questionProgress?: Record<string, unknown>;
    } = {},
  ): Promise<Corpus> {
    if (!platformBefore) platformBefore = await capturePlatformStatistic();
    const session = await createSession({ ...options, registry, codePrefix: 'H' });
    const participants = [
      await addParticipant(session.id, 'Ada'),
      await addParticipant(session.id, 'Grace'),
      await addParticipant(session.id, 'Linus'),
    ];
    const texts = [
      'Wie wird der Kontext für die Zusammenfassung begrenzt?',
      'Warum wartet der Host nicht auf das Modell?',
      'Was passiert, wenn sich die Quellen während der Inferenz ändern?',
    ];
    const questionIds: string[] = [];
    for (const [index, text] of texts.entries()) {
      questionIds.push(
        await createQuestion({
          sessionId: session.id,
          participantId: participants[index]!.id,
          text,
        }),
      );
    }
    return { sessionId: session.id, code: session.code, participants, questionIds };
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    await deleteFixtureRedisKeys(registry);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    if (!platformBefore) return;
    await cleanupFixtures(registry);
    await restorePlatformStatistic(platformBefore);
  });

  it('liefert ohne Änderung denselben Hash, auch beim direkten Packen am Cache vorbei', async () => {
    const corpus = await createCorpus();

    const first = await prepared(corpus.sessionId);
    const second = await prepared(corpus.sessionId);
    expect(second.snapshotHash).toBe(first.snapshotHash);
    // Themen und Blitzlicht sind in dieser Umgebung serverseitig bzw. je Session
    // deaktiviert; der Hash hängt damit nicht von Redis-Zustand ab.
    expect(first.context.topics).toMatchObject({ state: 'disabled' });
    expect(first.context.feedback).toMatchObject({ state: 'disabled' });

    const analysis = await buildModerationPromptContext({
      sessionId: corpus.sessionId,
      locale: 'de',
      access: ACCESS,
    });
    const directA = packSummaryModerationPromptContext({ analysis, packedAt: PACKED_AT });
    const directB = packSummaryModerationPromptContext({
      analysis: structuredClone(analysis),
      packedAt: new Date(PACKED_AT.getTime() + 60_000),
    });
    expect(directB.snapshotHash).toBe(directA.snapshotHash);
    expect(directA.snapshotHash).toBe(first.snapshotHash);
  });

  it('ändert den Hash nach einer Q&A-Stimme und führt die neue Ranking-Revision', async () => {
    const corpus = await createCorpus();
    const before = await snapshotHash(corpus.sessionId);
    const revisionBefore = await revisions(corpus.sessionId);

    await changeVote(corpus.questionIds[0]!, corpus.participants[1]!.id, 'UP');

    const session = await revisions(corpus.sessionId);
    expect(session.qaRankingRevision).toBeGreaterThan(revisionBefore.qaRankingRevision);
    expect(await snapshotHash(corpus.sessionId)).not.toBe(before);
    expect(await questionVotesRevision(corpus.sessionId)).toContain(
      `qa-ranking-v1:${session.qaRankingRevision}:`,
    );
  });

  it('ändert den Hash nach einer neuen Frage und führt sie als Quelle', async () => {
    const corpus = await createCorpus();
    const before = await snapshotHash(corpus.sessionId);
    const revisionBefore = await revisions(corpus.sessionId);

    const newQuestionId = await createQuestion({
      sessionId: corpus.sessionId,
      participantId: corpus.participants[0]!.id,
      text: 'Welche Rolle spielt die Snapshot-Revision?',
    });

    const revisionAfter = await revisions(corpus.sessionId);
    expect(revisionAfter.qaRankingRevision).toBeGreaterThan(revisionBefore.qaRankingRevision);
    expect(await snapshotHash(corpus.sessionId)).not.toBe(before);
    expect(await questionVotesRevision(corpus.sessionId)).toContain(
      `qa-ranking-v1:${revisionAfter.qaRankingRevision}:`,
    );
    // Seit upstream `96b2e46e` behält das Packen bei kleinem Korpus nur drei Fragen und
    // entscheidet bei gleichem Score nach `sourceId` (zufällige UUID). Ob die neue Frage
    // gesendet wird, ist hier also Zufall; geprüft wird der ungepackte Analysekontext,
    // aus dem der Hash gebildet wird.
    const analysis = await buildModerationPromptContext({
      sessionId: corpus.sessionId,
      locale: 'de',
      access: ACCESS,
    });
    expect(analysis.context.sources.map((source) => source.id)).toContain(
      `qa-question:${newQuestionId}`,
    );
  });

  it('ändert den Hash nach einem Beitritt und führt Teilnehmer-Revision und -Anzahl', async () => {
    const corpus = await createCorpus();
    const before = await snapshotHash(corpus.sessionId);
    const revisionBefore = await revisions(corpus.sessionId);

    await addParticipant(corpus.sessionId, 'Margaret');

    const session = await revisions(corpus.sessionId);
    expect(session.participantRevision).toBeGreaterThan(revisionBefore.participantRevision);
    const count = await participantCount(corpus.sessionId);
    expect(count).toBe(4);
    expect(await snapshotHash(corpus.sessionId)).not.toBe(before);
    expect(await questionVotesRevision(corpus.sessionId)).toMatch(
      new RegExp(`:participants:${session.participantRevision}:${count}$`),
    );
  });

  it('ändert den Hash, wenn der Host eine Frage über qa.moderate löscht', async () => {
    const corpus = await createCorpus();
    const target = corpus.questionIds[0]!;
    const before = await prepared(corpus.sessionId);
    expect(before.context.sources.map((source) => source.id)).toContain(`qa-question:${target}`);

    await hostCaller.moderate({ sessionCode: corpus.code, questionId: target, action: 'DELETE' });

    expect(await snapshotHash(corpus.sessionId)).not.toBe(before.snapshotHash);
    expect(await sourceIds(corpus.sessionId)).not.toContain(`qa-question:${target}`);
  });

  it('ändert den Hash, wenn Teilnehmende ihre eigene Frage über qa.deleteOwn löschen', async () => {
    const corpus = await createCorpus();
    const target = corpus.questionIds[1]!;
    const author = corpus.participants[1]!;
    const before = await prepared(corpus.sessionId);
    expect(before.context.sources.map((source) => source.id)).toContain(`qa-question:${target}`);

    const participantCaller = qaRouter.createCaller({
      req: { headers: { 'x-participant-capability': author.capability } } as never,
    });
    await expect(
      participantCaller.deleteOwn({ questionId: target, participantId: author.id }),
    ).resolves.toEqual({ deleted: true });

    expect(await snapshotHash(corpus.sessionId)).not.toBe(before.snapshotHash);
    expect(await sourceIds(corpus.sessionId)).not.toContain(`qa-question:${target}`);
  });

  async function releasedQuizCorpus() {
    if (!platformBefore) platformBefore = await capturePlatformStatistic();
    const { completed, running, sessionOptions } = await createReleasedQuiz(registry);
    const corpus = await createCorpus(sessionOptions);
    return { corpus, completed, running };
  }

  it('Gegenprobe: lässt den Hash bei einer Quizstimme auf eine laufende Frage unverändert', async () => {
    const { corpus, completed, running } = await releasedQuizCorpus();
    const before = await prepared(corpus.sessionId);
    expect(before.context.releasedResults).toMatchObject({ state: 'available' });
    expect(before.context.sources.map((source) => source.id)).toContain(
      `quiz-question:${completed.id}`,
    );
    const revisionBefore = await revisions(corpus.sessionId);

    await quizVote({
      sessionId: corpus.sessionId,
      participantId: corpus.participants[0]!.id,
      question: running,
    });

    const revisionAfter = await revisions(corpus.sessionId);
    expect(revisionAfter.qaRankingRevision).toBe(revisionBefore.qaRankingRevision);
    expect(await snapshotHash(corpus.sessionId)).toBe(before.snapshotHash);
  });

  it('Kontrolle: ändert den Hash bei einer Quizstimme auf eine freigegebene Frage', async () => {
    const { corpus, completed } = await releasedQuizCorpus();
    const before = await snapshotHash(corpus.sessionId);

    await quizVote({
      sessionId: corpus.sessionId,
      participantId: corpus.participants[0]!.id,
      question: completed,
    });

    expect(await snapshotHash(corpus.sessionId)).not.toBe(before);
  });
});
