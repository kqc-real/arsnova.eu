import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const RUN_PG = process.env['RUN_PG_QA_MIGRATION_TESTS'] === '1';
const FINAL_MIGRATION = '20260915120000_qa_scale_counters';
const DEFAULT_DATABASE_URL =
  'postgresql://arsnova_user:secretpassword@localhost:5432/postgres?schema=public';

function withoutSchemaQuery(url: URL): string {
  url.searchParams.delete('schema');
  return url.toString();
}

describe.skipIf(!RUN_PG)('Q&A scale migration backfill', () => {
  it('backfillt Legacy-Bestände atomar und wahrheitsgemäß', async () => {
    const configured = new URL(process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL);
    const adminUrl = new URL(configured);
    adminUrl.pathname = '/postgres';
    const databaseName = `arsnova_qa_migration_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const admin = new Client({ connectionString: withoutSchemaQuery(adminUrl) });
    let target: Client | null = null;

    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      const targetUrl = new URL(configured);
      targetUrl.pathname = `/${databaseName}`;
      target = new Client({ connectionString: withoutSchemaQuery(targetUrl) });
      await target.connect();

      const migrationRoot = resolve(process.cwd(), '../../prisma/migrations');
      const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migration of migrations) {
        if (migration === FINAL_MIGRATION) break;
        const sql = await readFile(resolve(migrationRoot, migration, 'migration.sql'), 'utf8');
        await target.query(sql);
      }

      const emptySessionId = randomUUID();
      const filledSessionId = randomUUID();
      const authorId = randomUUID();
      const voterId = randomUUID();
      const questionIds = [randomUUID(), randomUUID()];
      await target.query(
        `INSERT INTO "Session" (
           "id", "code", "type", "status", "qaEnabled", "qaOpen", "qaClosesAt", "expiresAt"
         ) VALUES
           ($1, 'MG0001', 'Q_AND_A', 'ACTIVE', TRUE, TRUE, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hours'),
           ($2, 'MG0002', 'Q_AND_A', 'ACTIVE', TRUE, TRUE, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hours')`,
        [emptySessionId, filledSessionId],
      );
      await target.query(
        `INSERT INTO "Participant" ("id", "nickname", "sessionId")
         VALUES ($1, 'Autor', $3), ($2, 'Voter', $3)`,
        [authorId, voterId, filledSessionId],
      );
      await target.query(
        `INSERT INTO "QaQuestion" (
           "id", "text", "status", "sessionId", "participantId", "createdAt", "updatedAt"
         ) VALUES
           ($1, 'Erste Legacy-Frage', 'ACTIVE', $3, $4, NOW(), NOW()),
           ($2, 'Zweite Legacy-Frage', 'ARCHIVED', $3, $4, NOW(), NOW())`,
        [questionIds[0], questionIds[1], filledSessionId, authorId],
      );
      await target.query(
        `INSERT INTO "QaUpvote" ("id", "qaQuestionId", "participantId", "direction")
         VALUES ($1, $2, $3, 'DOWN')`,
        [randomUUID(), questionIds[0], voterId],
      );

      const finalSql = await readFile(
        resolve(migrationRoot, FINAL_MIGRATION, 'migration.sql'),
        'utf8',
      );
      await target.query(finalSql);

      const tracking = await target.query<{
        qaStatisticsTrackingStartedAt: Date;
        qaStatisticsProjectedAt: Date;
        maxQaQuestionsStatisticUpdatedAt: Date;
        qaQuestionsTotal: string;
        maxQaQuestionsSingleSession: number;
      }>(
        `SELECT
           "qaStatisticsTrackingStartedAt",
           "qaStatisticsProjectedAt",
           "maxQaQuestionsStatisticUpdatedAt",
           "qaQuestionsTotal",
           "maxQaQuestionsSingleSession"
         FROM "PlatformStatistic"
         WHERE "id" = 'default'`,
      );
      const sessions = await target.query<{
        id: string;
        qaQuestionCount: number;
        qaQuestionPeakCount: number;
        qaQuestionsAcceptedTotal: string;
        qaQuestionPeakReachedAt: Date;
      }>(
        `SELECT
           "id",
           "qaQuestionCount",
           "qaQuestionPeakCount",
           "qaQuestionsAcceptedTotal",
           "qaQuestionPeakReachedAt"
         FROM "Session"
         WHERE "id" = ANY($1::TEXT[])
         ORDER BY "id"`,
        [[emptySessionId, filledSessionId]],
      );
      const byId = new Map(sessions.rows.map((row) => [row.id, row]));
      expect(byId.get(emptySessionId)).toMatchObject({
        qaQuestionCount: 0,
        qaQuestionPeakCount: 0,
        qaQuestionsAcceptedTotal: '0',
      });
      expect(byId.get(filledSessionId)).toMatchObject({
        qaQuestionCount: 2,
        qaQuestionPeakCount: 2,
        qaQuestionsAcceptedTotal: '2',
      });
      expect(tracking.rows[0]).toMatchObject({
        qaQuestionsTotal: '2',
        maxQaQuestionsSingleSession: 2,
      });
      for (const row of sessions.rows) {
        expect(row.qaQuestionPeakReachedAt.getTime()).toBe(
          tracking.rows[0]!.qaStatisticsTrackingStartedAt.getTime(),
        );
      }
      expect(tracking.rows[0]!.qaStatisticsProjectedAt.getTime()).toBe(
        tracking.rows[0]!.qaStatisticsTrackingStartedAt.getTime(),
      );
      expect(tracking.rows[0]!.maxQaQuestionsStatisticUpdatedAt.getTime()).toBe(
        tracking.rows[0]!.qaStatisticsTrackingStartedAt.getTime(),
      );

      const vote = await target.query<{
        positiveVoteCount: number;
        negativeVoteCount: number;
        upvoteCount: number;
      }>(
        `SELECT "positiveVoteCount", "negativeVoteCount", "upvoteCount"
         FROM "QaQuestion"
         WHERE "id" = $1`,
        [questionIds[0]],
      );
      expect(vote.rows[0]).toEqual({
        positiveVoteCount: 0,
        negativeVoteCount: 1,
        upvoteCount: -1,
      });
    } finally {
      await target?.end().catch(() => undefined);
      await admin.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.end();
    }
  }, 60_000);
});
