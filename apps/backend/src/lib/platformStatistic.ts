/**
 * Plattformweite Kennzahl: höchste Teilnehmerzahl in einer einzelnen Session.
 * Aktualisierung atomar per GREATEST (parallel Join-sicher).
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { logger } from './logger';

export const PLATFORM_STATISTIC_ID = 'default';

export function getUtcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatUtcDate(date: Date): string {
  return getUtcDayStart(date).toISOString().slice(0, 10);
}

/**
 * Erhöht den gespeicherten Rekord, falls `participantCount` höher ist.
 * Fehler werden geloggt und geschluckt – Aufrufer (z. B. Join) darf nicht fehlschlagen.
 */
export async function updateMaxParticipantsSingleSession(participantCount: number): Promise<void> {
  if (!Number.isFinite(participantCount) || participantCount < 1) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO "PlatformStatistic" ("id", "maxParticipantsSingleSession", "completedSessionsTotal", "updatedAt")
      VALUES (${PLATFORM_STATISTIC_ID}, ${participantCount}, 0, NOW())
      ON CONFLICT ("id") DO UPDATE
      SET
        "maxParticipantsSingleSession" = GREATEST(
          "PlatformStatistic"."maxParticipantsSingleSession",
          EXCLUDED."maxParticipantsSingleSession"
        ),
        "updatedAt" = CASE
          WHEN EXCLUDED."maxParticipantsSingleSession" > "PlatformStatistic"."maxParticipantsSingleSession"
            THEN NOW()
          ELSE "PlatformStatistic"."updatedAt"
        END
    `;
  } catch (e) {
    logger.warn(
      'PlatformStatistic: maxParticipantsSingleSession konnte nicht aktualisiert werden',
      e,
    );
  }
}

/**
 * Erhöht den gespeicherten UTC-Tagesrekord, falls `participantCount` höher ist.
 * Fehler werden geloggt und geschluckt – Aufrufer (z. B. Join) darf nicht fehlschlagen.
 */
export async function updateDailyMaxParticipants(
  participantCount: number,
  now: Date = new Date(),
): Promise<void> {
  if (!Number.isFinite(participantCount) || participantCount < 1) return;

  const utcDay = getUtcDayStart(now);

  try {
    await prisma.$executeRaw`
      INSERT INTO "DailyStatistic" ("id", "date", "maxParticipantsSingleSession", "updatedAt")
      VALUES (${randomUUID()}, ${utcDay}, ${participantCount}, NOW())
      ON CONFLICT ("date") DO UPDATE
      SET
        "maxParticipantsSingleSession" = GREATEST(
          "DailyStatistic"."maxParticipantsSingleSession",
          EXCLUDED."maxParticipantsSingleSession"
        ),
        "updatedAt" = CASE
          WHEN EXCLUDED."maxParticipantsSingleSession" > "DailyStatistic"."maxParticipantsSingleSession"
            THEN NOW()
          ELSE "DailyStatistic"."updatedAt"
        END
    `;
  } catch (e) {
    logger.warn('DailyStatistic: maxParticipantsSingleSession konnte nicht aktualisiert werden', e);
  }
}

/**
 * Persistiert eine monotone Gesamtzahl beendeter Sessions (FINISHED), damit die
 * Kennzahl in health.stats trotz Session-Purge nicht sinkt.
 *
 * Wichtig: `updatedAt` bleibt unverändert, da es für den Rekord-Zeitstempel
 * (`maxParticipantsStatisticUpdatedAt`) reserviert ist.
 */
export async function updateCompletedSessionsTotal(completedSessions: number): Promise<void> {
  if (!Number.isFinite(completedSessions) || completedSessions < 0) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO "PlatformStatistic" ("id", "maxParticipantsSingleSession", "completedSessionsTotal", "updatedAt")
      VALUES (${PLATFORM_STATISTIC_ID}, 0, ${completedSessions}, NOW())
      ON CONFLICT ("id") DO UPDATE
      SET
        "completedSessionsTotal" = GREATEST(
          "PlatformStatistic"."completedSessionsTotal",
          EXCLUDED."completedSessionsTotal"
        ),
        "updatedAt" = "PlatformStatistic"."updatedAt"
    `;
  } catch (e) {
    logger.warn('PlatformStatistic: completedSessionsTotal konnte nicht aktualisiert werden', e);
  }
}
