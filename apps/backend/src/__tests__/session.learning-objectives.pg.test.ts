/**
 * PostgreSQL contract tests for learning-objective source deletion and parent
 * cascade order. Opt-in because they require a fully migrated isolated DB.
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_PG = process.env['RUN_PG_SESSION_LIFECYCLE_TESTS'] === '1';
const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

function code(): string {
  return `O${randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase()}`;
}

describe.skipIf(!RUN_PG)('session learning-objective deletion invariants (PostgreSQL)', () => {
  const client = new Client({ connectionString: DATABASE_URL });
  const sessionIds: string[] = [];
  const quizIds: string[] = [];

  beforeAll(async () => {
    await client.connect();
    await client.query(`SET TIME ZONE 'UTC'`);
  });

  afterAll(async () => {
    if (sessionIds.length > 0) {
      await client.query(`DELETE FROM "Session" WHERE id = ANY($1::text[])`, [sessionIds]);
    }
    if (quizIds.length > 0) {
      await client.query(`DELETE FROM "Quiz" WHERE id = ANY($1::text[])`, [quizIds]);
    }
    await client.end();
  });

  async function createActiveSession(quizId: string | null = null): Promise<string> {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    await client.query(
      `
        INSERT INTO "Session" (
          id, code, type, status, "quizId", "qaEnabled", "qaOpen", "qaClosesAt", "expiresAt"
        )
        VALUES (
          $1, $2, $3, 'ACTIVE', $4, TRUE, TRUE,
          timezone('UTC', statement_timestamp()) + INTERVAL '1 hour',
          timezone('UTC', statement_timestamp()) + INTERVAL '2 hours'
        )
      `,
      [sessionId, code(), quizId ? 'QUIZ' : 'Q_AND_A', quizId],
    );
    return sessionId;
  }

  async function createQuizQuestion(): Promise<{ quizId: string; questionId: string }> {
    const quizId = randomUUID();
    const questionId = randomUUID();
    quizIds.push(quizId);
    await client.query(
      `INSERT INTO "Quiz" (id, name, "updatedAt") VALUES ($1, 'PG Lernziel', CURRENT_TIMESTAMP)`,
      [quizId],
    );
    await client.query(
      `
        INSERT INTO "Question" (id, text, type, "quizId", "order")
        VALUES ($1, 'Welche Aussage stimmt?', 'SINGLE_CHOICE', $2, 0)
      `,
      [questionId, quizId],
    );
    return { quizId, questionId };
  }

  async function createQaQuestion(sessionId: string): Promise<string> {
    const participantId = randomUUID();
    const questionId = randomUUID();
    await client.query(
      `INSERT INTO "Participant" (id, nickname, "sessionId") VALUES ($1, 'Ada', $2)`,
      [participantId, sessionId],
    );
    await client.query(
      `
        INSERT INTO "QaQuestion" (id, text, "sessionId", "participantId")
        VALUES ($1, 'Warum gilt das?', $2, $3)
      `,
      [questionId, sessionId, participantId],
    );
    return questionId;
  }

  async function createObjective(input: {
    sessionId: string;
    sourceId: string;
    source: 'quiz' | 'qa';
    derived?: boolean;
  }): Promise<{ objectiveRowId: string; referenceIds: string[] }> {
    const objectiveRowId = randomUUID();
    const objectiveId = randomUUID();
    await client.query(
      `
        INSERT INTO "SessionLearningObjective" (
          id, "sessionId", "objectiveId", revision, text, scope, origin,
          "modelId", "modelVersion", "derivationVersion",
          "confirmationState", "confirmationRevision", "confirmationAt",
          projection
        )
        VALUES (
          $1, $2, $3, 0, 'Quellen einordnen', 'TASKS', $4,
          $5, $6, $7,
          $8, $9, $10, $11
        )
      `,
      input.derived
        ? [
            objectiveRowId,
            input.sessionId,
            objectiveId,
            'MODEL_DERIVED',
            'model-a',
            '1',
            '1',
            'CONFIRMED',
            0,
            new Date().toISOString(),
            'SESSION_OVERRIDE',
          ]
        : [
            objectiveRowId,
            input.sessionId,
            objectiveId,
            'MANUAL',
            null,
            null,
            null,
            'DRAFT',
            null,
            null,
            'SESSION_MANUAL',
          ],
    );
    const kinds = input.derived ? ['TASK', 'DERIVATION'] : ['TASK'];
    const referenceIds: string[] = [];
    for (const kind of kinds) {
      const referenceId = randomUUID();
      referenceIds.push(referenceId);
      await client.query(
        `
          INSERT INTO "SessionLearningObjectiveReference" (
            id, "sourceReferenceId", "objectiveRowId", kind, "sourceKind",
            "quizQuestionId", "qaQuestionId"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          referenceId,
          input.sourceId,
          objectiveRowId,
          kind,
          input.source === 'quiz' ? 'QUIZ_QUESTION' : 'QA_QUESTION',
          input.source === 'quiz' ? input.sourceId : null,
          input.source === 'qa' ? input.sourceId : null,
        ],
      );
    }
    return { objectiveRowId, referenceIds };
  }

  it('marks a direct Q&A source deletion unresolved and advances row/global revisions', async () => {
    const sessionId = await createActiveSession();
    const questionId = await createQaQuestion(sessionId);
    const { objectiveRowId } = await createObjective({
      sessionId,
      sourceId: questionId,
      source: 'qa',
    });

    await client.query(`DELETE FROM "QaQuestion" WHERE id = $1`, [questionId]);

    const reference = await client.query<{
      qaQuestionId: string | null;
      unresolvedReason: string | null;
      sourceReferenceId: string;
    }>(
      `
        SELECT "qaQuestionId", "unresolvedReason", "sourceReferenceId"
        FROM "SessionLearningObjectiveReference"
        WHERE "objectiveRowId" = $1
      `,
      [objectiveRowId],
    );
    expect(reference.rows[0]).toEqual({
      qaQuestionId: null,
      unresolvedReason: 'SOURCE_REMOVED',
      sourceReferenceId: questionId,
    });
    const state = await client.query<{
      rowRevision: number;
      confirmationState: string;
      previousConfirmationState: string | null;
      contextRevision: number;
      configured: boolean;
    }>(
      `
        SELECT
          objective.revision AS "rowRevision",
          objective."confirmationState",
          objective."previousConfirmationState",
          session."learningContextRevision" AS "contextRevision",
          session."learningContextConfigured" AS configured
        FROM "SessionLearningObjective" AS objective
        INNER JOIN "Session" AS session ON session.id = objective."sessionId"
        WHERE objective.id = $1
      `,
      [objectiveRowId],
    );
    expect(state.rows[0]).toEqual({
      rowRevision: 1,
      confirmationState: 'NEEDS_REVIEW',
      previousConfirmationState: 'DRAFT',
      contextRevision: 1,
      configured: true,
    });
  });

  it('preserves one stable identity for unresolved quiz TASK and DERIVATION rows', async () => {
    const { quizId, questionId } = await createQuizQuestion();
    const sessionId = await createActiveSession(quizId);
    const { objectiveRowId } = await createObjective({
      sessionId,
      sourceId: questionId,
      source: 'quiz',
      derived: true,
    });

    await client.query(`DELETE FROM "Question" WHERE id = $1`, [questionId]);

    const references = await client.query<{
      kind: string;
      quizQuestionId: string | null;
      unresolvedReason: string | null;
      sourceReferenceId: string;
    }>(
      `
        SELECT kind, "quizQuestionId", "unresolvedReason", "sourceReferenceId"
        FROM "SessionLearningObjectiveReference"
        WHERE "objectiveRowId" = $1
        ORDER BY kind
      `,
      [objectiveRowId],
    );
    expect(references.rows).toHaveLength(2);
    expect(new Set(references.rows.map((row) => row.sourceReferenceId))).toEqual(
      new Set([questionId]),
    );
    expect(references.rows.every((row) => row.quizQuestionId === null)).toBe(true);
    expect(references.rows.every((row) => row.unresolvedReason === 'SOURCE_REMOVED')).toBe(true);
  });

  it('advances row and global revisions for direct source deletion during post-processing', async () => {
    const sessionId = await createActiveSession();
    const questionId = await createQaQuestion(sessionId);
    const { objectiveRowId } = await createObjective({
      sessionId,
      sourceId: questionId,
      source: 'qa',
    });
    await client.query(`UPDATE "Session" SET status = 'FINISHED' WHERE id = $1`, [sessionId]);
    await client.query(`UPDATE "Session" SET "qaOpen" = FALSE WHERE id = $1`, [sessionId]);

    await client.query(`DELETE FROM "QaQuestion" WHERE id = $1`, [questionId]);

    const state = await client.query<{
      rowRevision: number;
      contextRevision: number;
      endedAt: Date | null;
    }>(
      `
        SELECT
          objective.revision AS "rowRevision",
          session."learningContextRevision" AS "contextRevision",
          session."endedAt"
        FROM "SessionLearningObjective" AS objective
        INNER JOIN "Session" AS session ON session.id = objective."sessionId"
        WHERE objective.id = $1
      `,
      [objectiveRowId],
    );
    expect(state.rows[0]?.endedAt).toBeInstanceOf(Date);
    expect(state.rows[0]).toMatchObject({ rowRevision: 1, contextRevision: 1 });
  });

  it('aborts a direct live-source deletion when its CAS revisions are exhausted', async () => {
    const sessionId = await createActiveSession();
    const questionId = await createQaQuestion(sessionId);
    const { objectiveRowId } = await createObjective({
      sessionId,
      sourceId: questionId,
      source: 'qa',
    });
    await client.query(
      `UPDATE "SessionLearningObjective" SET revision = 2147483647 WHERE id = $1`,
      [objectiveRowId],
    );

    const deletionClient = new Client({ connectionString: DATABASE_URL });
    await deletionClient.connect();
    try {
      await expect(
        deletionClient.query(`DELETE FROM "QaQuestion" WHERE id = $1`, [questionId]),
      ).rejects.toThrow(/ARSNOVA_LEARNING_CONTEXT_REVISION_EXHAUSTED/);
    } finally {
      await deletionClient.end();
    }
    const retained = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "QaQuestion" WHERE id = $1`,
      [questionId],
    );
    expect(retained.rows[0]?.count).toBe('1');
  });

  it('deletes whole Session and Quiz aggregates without cascade-order violations', async () => {
    const qaSessionId = await createActiveSession();
    const qaQuestionId = await createQaQuestion(qaSessionId);
    await createObjective({ sessionId: qaSessionId, sourceId: qaQuestionId, source: 'qa' });
    await expect(
      client.query(`DELETE FROM "Session" WHERE id = $1`, [qaSessionId]),
    ).resolves.toBeDefined();

    const { quizId, questionId } = await createQuizQuestion();
    const quizSessionId = await createActiveSession(quizId);
    await createObjective({
      sessionId: quizSessionId,
      sourceId: questionId,
      source: 'quiz',
      derived: true,
    });
    await expect(client.query(`DELETE FROM "Quiz" WHERE id = $1`, [quizId])).resolves.toBeDefined();

    const counts = await client.query<{ sessions: string; objectives: string }>(
      `
        SELECT
          (SELECT COUNT(*) FROM "Session" WHERE id = ANY($1::text[]))::text AS sessions,
          (
            SELECT COUNT(*)
            FROM "SessionLearningObjective"
            WHERE "sessionId" = ANY($1::text[])
          )::text AS objectives
      `,
      [[qaSessionId, quizSessionId]],
    );
    expect(counts.rows[0]).toEqual({ sessions: '0', objectives: '0' });
  });
});
