/**
 * PostgreSQL-Vertragsnachweis für Epic #405 / #407.
 *
 * Der Test läuft opt-in auf einer vollständig migrierten Datenbank. Er prüft
 * insbesondere die DB-Linearisierung über mehrere Verbindungen; ein vor
 * Fristablauf gestartetes, aber erst danach entsperrtes Statement darf die
 * Session nicht wieder verlängern.
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_PG = process.env['RUN_PG_SESSION_LIFECYCLE_TESTS'] === '1';
const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

function uniqueSessionCode(): string {
  return `L${randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase()}`;
}

function epochMs(value: string | number): number {
  return Number(value);
}

async function waitForBlockedUpdate(monitor: Client, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await monitor.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%UPDATE "Session"%'
    `);
    if (Number(result.rows[0]?.count ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Das konkurrierende Session-UPDATE wartete nicht am Row-Lock.');
}

async function waitUntilAfter(epoch: number): Promise<void> {
  const delay = Math.max(0, epoch - Date.now() + 75);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

describe.skipIf(!RUN_PG)('absolute session lifecycle (PostgreSQL)', () => {
  const primary = new Client({ connectionString: DATABASE_URL });
  const blocker = new Client({ connectionString: DATABASE_URL });
  const racer = new Client({ connectionString: DATABASE_URL });
  const monitor = new Client({ connectionString: DATABASE_URL });
  const sessionIds: string[] = [];

  beforeAll(async () => {
    await Promise.all([primary.connect(), blocker.connect(), racer.connect(), monitor.connect()]);
    await Promise.all(
      [primary, blocker, racer, monitor].map((client) => client.query(`SET TIME ZONE 'UTC'`)),
    );
  });

  afterAll(async () => {
    if (sessionIds.length > 0) {
      await primary.query(`DELETE FROM "Session" WHERE id = ANY($1::text[])`, [sessionIds]);
    }
    await Promise.all([primary.end(), blocker.end(), racer.end(), monitor.end()]);
  });

  it('setzt 24h-Defaults und bewahrt createdAt sowie den ersten Beitritt unveränderlich', async () => {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    const inserted = await primary.query<{
      created_ms: string;
      expires_ms: string;
      revision: number;
      time_zone: string;
    }>(
      `
        INSERT INTO "Session" (id, code)
        VALUES ($1, $2)
        RETURNING
          EXTRACT(EPOCH FROM "createdAt") * 1000 AS created_ms,
          EXTRACT(EPOCH FROM "expiresAt") * 1000 AS expires_ms,
          "sessionLifecycleRevision" AS revision,
          "timeZone" AS time_zone
      `,
      [sessionId, uniqueSessionCode()],
    );
    const row = inserted.rows[0]!;
    expect(epochMs(row.expires_ms) - epochMs(row.created_ms)).toBe(24 * 60 * 60 * 1000);
    expect(row).toMatchObject({ revision: 0, time_zone: 'UTC' });

    const extended = await primary.query<{
      started_ms: string;
      expires_ms: string;
      revision: number;
    }>(
      `
        UPDATE "Session"
        SET "expiresAt" = "createdAt" + INTERVAL '7 days'
        WHERE id = $1
        RETURNING
          EXTRACT(EPOCH FROM "startedAt") * 1000 AS started_ms,
          EXTRACT(EPOCH FROM "expiresAt") * 1000 AS expires_ms,
          "sessionLifecycleRevision" AS revision
      `,
      [sessionId],
    );
    expect(epochMs(extended.rows[0]!.expires_ms) - epochMs(extended.rows[0]!.started_ms)).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(extended.rows[0]!.revision).toBe(1);

    await expect(
      primary.query(
        `UPDATE "Session" SET "createdAt" = "createdAt" + INTERVAL '1 second' WHERE id = $1`,
        [sessionId],
      ),
    ).rejects.toThrow(/ARSNOVA_SESSION_CREATED_AT_IMMUTABLE/);

    const firstParticipantId = randomUUID();
    const first = await primary.query<{ joined_ms: string }>(
      `
        INSERT INTO "Participant" (id, nickname, "sessionId", "joinedAt")
        VALUES ($1, 'Ada', $2, clock_timestamp())
        RETURNING EXTRACT(EPOCH FROM "joinedAt") * 1000 AS joined_ms
      `,
      [firstParticipantId, sessionId],
    );
    const secondParticipantId = randomUUID();
    await primary.query(
      `
        INSERT INTO "Participant" (id, nickname, "sessionId", "joinedAt")
        VALUES ($1, 'Grace', $2, clock_timestamp() - INTERVAL '1 hour')
      `,
      [secondParticipantId, sessionId],
    );
    await primary.query(`DELETE FROM "Participant" WHERE id = ANY($1::text[])`, [
      [firstParticipantId, secondParticipantId],
    ]);

    const marker = await primary.query<{ joined_ms: string }>(
      `
        SELECT EXTRACT(EPOCH FROM "firstParticipantJoinedAt") * 1000 AS joined_ms
        FROM "Session"
        WHERE id = $1
      `,
      [sessionId],
    );
    expect(epochMs(marker.rows[0]!.joined_ms)).toBe(epochMs(first.rows[0]!.joined_ms));
    await expect(
      primary.query(`UPDATE "Session" SET "firstParticipantJoinedAt" = NULL WHERE id = $1`, [
        sessionId,
      ]),
    ).rejects.toThrow(/ARSNOVA_FIRST_PARTICIPANT_JOIN_IMMUTABLE/);
  });

  it('weist fachliche Child-Writes nach Ablauf ab und materialisiert exakt eine Endrevision', async () => {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    const inserted = await primary.query<{ expires_ms: string }>(
      `
        INSERT INTO "Session" (
          id, code, type, status, "createdAt", "expiresAt", "startedAt",
          "qaEnabled", "qaOpen"
        )
        VALUES (
          $1, $2, 'Q_AND_A', 'ACTIVE',
          clock_timestamp() - INTERVAL '1 hour',
          clock_timestamp() + INTERVAL '250 milliseconds',
          clock_timestamp() - INTERVAL '1 hour',
          TRUE, TRUE
        )
        RETURNING EXTRACT(EPOCH FROM "expiresAt") * 1000 AS expires_ms
      `,
      [sessionId, uniqueSessionCode()],
    );
    const participantId = randomUUID();
    await primary.query(
      `INSERT INTO "Participant" (id, nickname, "sessionId") VALUES ($1, 'Lin', $2)`,
      [participantId, sessionId],
    );
    await waitUntilAfter(epochMs(inserted.rows[0]!.expires_ms));

    await expect(
      primary.query(
        `
          INSERT INTO "QaQuestion" (id, text, "sessionId", "participantId")
          VALUES ($1, 'Zu spät', $2, $3)
        `,
        [randomUUID(), sessionId, participantId],
      ),
    ).rejects.toThrow(/ARSNOVA_SESSION_ENDED/);

    const finalized = await primary.query<{
      expires_ms: string;
      ended_ms: string;
      revision: number;
      status: string;
    }>(
      `
        UPDATE "Session"
        SET status = 'FINISHED', "endedAt" = clock_timestamp()
        WHERE id = $1
        RETURNING
          EXTRACT(EPOCH FROM "expiresAt") * 1000 AS expires_ms,
          EXTRACT(EPOCH FROM "endedAt") * 1000 AS ended_ms,
          "sessionLifecycleRevision" AS revision,
          status::text
      `,
      [sessionId],
    );
    expect(finalized.rows[0]).toMatchObject({ revision: 1, status: 'FINISHED' });
    expect(epochMs(finalized.rows[0]!.ended_ms)).toBe(epochMs(finalized.rows[0]!.expires_ms));
    await expect(
      primary.query(`UPDATE "Session" SET title = 'Wieder offen' WHERE id = $1`, [sessionId]),
    ).rejects.toThrow(/ARSNOVA_SESSION_ENDED/);
  });

  it('verhindert über zwei Verbindungen eine nach Ablauf linearisierte Verlängerung', async () => {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    const inserted = await primary.query<{ expires_ms: string }>(
      `
        INSERT INTO "Session" (
          id, code, status, "createdAt", "expiresAt", "startedAt"
        )
        VALUES (
          $1, $2, 'ACTIVE',
          clock_timestamp() - INTERVAL '1 hour',
          clock_timestamp() + INTERVAL '300 milliseconds',
          clock_timestamp() - INTERVAL '1 hour'
        )
        RETURNING EXTRACT(EPOCH FROM "expiresAt") * 1000 AS expires_ms
      `,
      [sessionId, uniqueSessionCode()],
    );
    let blockerOpen = false;
    try {
      await blocker.query('BEGIN');
      blockerOpen = true;
      await blocker.query(`SELECT 1 FROM "Session" WHERE id = $1 FOR UPDATE`, [sessionId]);

      const extension = racer.query(
        `UPDATE "Session" SET "expiresAt" = "expiresAt" + INTERVAL '1 hour' WHERE id = $1`,
        [sessionId],
      );
      await waitForBlockedUpdate(monitor);
      await waitUntilAfter(epochMs(inserted.rows[0]!.expires_ms));
      await blocker.query('COMMIT');
      blockerOpen = false;

      await expect(extension).rejects.toThrow(/ARSNOVA_SESSION_EXPIRED/);
    } finally {
      if (blockerOpen) {
        await blocker.query('ROLLBACK').catch(() => undefined);
      }
    }

    const unchanged = await primary.query<{ expires_ms: string; revision: number }>(
      `
        SELECT
          EXTRACT(EPOCH FROM "expiresAt") * 1000 AS expires_ms,
          "sessionLifecycleRevision" AS revision
        FROM "Session"
        WHERE id = $1
      `,
      [sessionId],
    );
    expect(epochMs(unchanged.rows[0]!.expires_ms)).toBe(epochMs(inserted.rows[0]!.expires_ms));
    expect(unchanged.rows[0]!.revision).toBe(0);
  });

  it('kanonisiert einen vor Fristbeginn gestarteten manuellen Endrequest nach dem Lock-Wait', async () => {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    const inserted = await primary.query<{ expires_ms: string }>(
      `
        INSERT INTO "Session" (
          id, code, status, "createdAt", "expiresAt", "startedAt"
        )
        VALUES (
          $1, $2, 'ACTIVE',
          clock_timestamp() - INTERVAL '1 hour',
          clock_timestamp() + INTERVAL '300 milliseconds',
          clock_timestamp() - INTERVAL '1 hour'
        )
        RETURNING EXTRACT(EPOCH FROM "expiresAt") * 1000 AS expires_ms
      `,
      [sessionId, uniqueSessionCode()],
    );
    let blockerOpen = false;
    try {
      await blocker.query('BEGIN');
      blockerOpen = true;
      await blocker.query(`SELECT 1 FROM "Session" WHERE id = $1 FOR UPDATE`, [sessionId]);

      const ending = racer.query<{
        ended_ms: string;
        revision: number;
      }>(
        `
          UPDATE "Session"
          SET status = 'FINISHED', "endedAt" = clock_timestamp()
          WHERE id = $1
          RETURNING
            EXTRACT(EPOCH FROM "endedAt") * 1000 AS ended_ms,
            "sessionLifecycleRevision" AS revision
        `,
        [sessionId],
      );
      await waitForBlockedUpdate(monitor);
      await waitUntilAfter(epochMs(inserted.rows[0]!.expires_ms));
      await blocker.query('COMMIT');
      blockerOpen = false;

      const ended = await ending;
      expect(epochMs(ended.rows[0]!.ended_ms)).toBe(epochMs(inserted.rows[0]!.expires_ms));
      expect(ended.rows[0]!.revision).toBe(1);
    } finally {
      if (blockerOpen) {
        await blocker.query('ROLLBACK').catch(() => undefined);
      }
    }
  });

  it('lässt ein manuelles Ende gegen eine wartende Verlängerung gewinnen', async () => {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    await primary.query(
      `
        INSERT INTO "Session" (
          id, code, status, "createdAt", "expiresAt", "startedAt"
        )
        VALUES (
          $1, $2, 'ACTIVE',
          clock_timestamp() - INTERVAL '1 hour',
          clock_timestamp() + INTERVAL '1 hour',
          clock_timestamp() - INTERVAL '1 hour'
        )
      `,
      [sessionId, uniqueSessionCode()],
    );
    let blockerOpen = false;
    let extension: Promise<unknown> | null = null;
    try {
      await blocker.query('BEGIN');
      blockerOpen = true;
      await blocker.query(`SELECT 1 FROM "Session" WHERE id = $1 FOR UPDATE`, [sessionId]);
      await blocker.query(
        `UPDATE "Session" SET status = 'FINISHED', "endedAt" = clock_timestamp() WHERE id = $1`,
        [sessionId],
      );

      extension = racer.query(
        `UPDATE "Session" SET "expiresAt" = "expiresAt" + INTERVAL '1 hour' WHERE id = $1`,
        [sessionId],
      );
      await waitForBlockedUpdate(monitor);
      await blocker.query('COMMIT');
      blockerOpen = false;

      await expect(extension).rejects.toThrow(/ARSNOVA_SESSION_ENDED/);
    } finally {
      if (blockerOpen) {
        await blocker.query('ROLLBACK').catch(() => undefined);
      }
      if (extension) {
        await extension.catch(() => undefined);
      }
    }

    const ended = await primary.query<{ ended_ms: string; revision: number }>(
      `
        SELECT
          EXTRACT(EPOCH FROM "endedAt") * 1000 AS ended_ms,
          "sessionLifecycleRevision" AS revision
        FROM "Session"
        WHERE id = $1
      `,
      [sessionId],
    );
    expect(epochMs(ended.rows[0]!.ended_ms)).toBeGreaterThan(0);
    expect(ended.rows[0]!.revision).toBe(1);
  });

  it('erhöht die Revision bei Q&A-Titeländerung und lehnt veraltete Revisionswechsel ab', async () => {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    const inserted = await primary.query<{ revision: number }>(
      `
        INSERT INTO "Session" (
          id, code, status, "createdAt", "expiresAt", "startedAt",
          "qaEnabled", "qaOpen", "qaClosesAt", "qaTitle", "qaModerationMode",
          "preferredChannel"
        )
        VALUES (
          $1, $2, 'ACTIVE',
          clock_timestamp() - INTERVAL '2 hours',
          clock_timestamp() + INTERVAL '12 hours',
          clock_timestamp() - INTERVAL '2 hours',
          TRUE, FALSE, clock_timestamp() - INTERVAL '30 minutes',
          'Alte Fragenwand', FALSE, 'qa'
        )
        RETURNING "sessionLifecycleRevision" AS revision
      `,
      [sessionId, uniqueSessionCode()],
    );
    expect(inserted.rows[0]!.revision).toBe(0);

    const titled = await primary.query<{ title: string; revision: number }>(
      `
        UPDATE "Session"
        SET "qaTitle" = 'Nur Titel', "sessionLifecycleRevision" = "sessionLifecycleRevision" + 1
        WHERE id = $1
        RETURNING "qaTitle" AS title, "sessionLifecycleRevision" AS revision
      `,
      [sessionId],
    );
    expect(titled.rows[0]).toMatchObject({ title: 'Nur Titel', revision: 1 });

    const moderated = await primary.query<{ revision: number; moderation: boolean }>(
      `
        UPDATE "Session"
        SET "qaModerationMode" = TRUE, "sessionLifecycleRevision" = "sessionLifecycleRevision" + 1
        WHERE id = $1
        RETURNING "sessionLifecycleRevision" AS revision, "qaModerationMode" AS moderation
      `,
      [sessionId],
    );
    expect(moderated.rows[0]).toMatchObject({ revision: 2, moderation: true });

    await expect(
      primary.query(
        `
          UPDATE "Session"
          SET "qaTitle" = 'Zu spät', "sessionLifecycleRevision" = 4
          WHERE id = $1
        `,
        [sessionId],
      ),
    ).rejects.toThrow(/ARSNOVA_SESSION_CHANNEL_REVISION_REQUIRED/);

    await expect(
      primary.query(
        `
          UPDATE "Session"
          SET "sessionLifecycleRevision" = "sessionLifecycleRevision" + 1
          WHERE id = $1
        `,
        [sessionId],
      ),
    ).rejects.toThrow(/ARSNOVA_SESSION_LIFECYCLE_IMMUTABLE/);

    const persisted = await primary.query<{ title: string; revision: number }>(
      `SELECT "qaTitle" AS title, "sessionLifecycleRevision" AS revision FROM "Session" WHERE id = $1`,
      [sessionId],
    );
    expect(persisted.rows[0]).toMatchObject({ title: 'Nur Titel', revision: 2 });
  });
});
