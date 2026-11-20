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
      INSERT INTO "PlatformStatistic" ("id", "maxParticipantsSingleSession", "updatedAt")
      VALUES (${PLATFORM_STATISTIC_ID}, ${participantCount}, NOW())
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

const pendingParticipantMaxima = new Map<number, number>();
let participantMaximaDrain: Promise<void> | null = null;

/** Bündelt Rekordupdates, damit Join-Wellen den Datenbankpool nicht damit füllen. */
export function scheduleParticipantMaximaUpdate(
  participantCount: number,
  now: Date = new Date(),
): void {
  if (!Number.isFinite(participantCount) || participantCount < 1) return;
  const utcDay = getUtcDayStart(now).getTime();
  pendingParticipantMaxima.set(
    utcDay,
    Math.max(pendingParticipantMaxima.get(utcDay) ?? 0, participantCount),
  );
  participantMaximaDrain ??= Promise.resolve().then(async () => {
    try {
      for (const [day, max] of pendingParticipantMaxima) {
        pendingParticipantMaxima.delete(day);
        await Promise.all([
          updateMaxParticipantsSingleSession(max),
          updateDailyMaxParticipants(max, new Date(day)),
        ]);
      }
    } finally {
      participantMaximaDrain = null;
    }
  });
}

/** Nach dem HTTP-Drain aufrufen, solange der Datenbankpool offen ist. */
export async function flushParticipantMaximaUpdates(): Promise<void> {
  await participantMaximaDrain;
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
      INSERT INTO "PlatformStatistic" ("id", "completedSessionsTotal", "updatedAt")
      VALUES (${PLATFORM_STATISTIC_ID}, ${completedSessions}, NOW())
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

/**
 * Erhöht die monotone Gesamtzahl beendeter Sessions atomar um `delta`.
 * Fehler werden geloggt und geschluckt – das Beenden einer Session darf daran nicht scheitern.
 */
export async function incrementCompletedSessionsTotal(delta: number = 1): Promise<void> {
  if (!Number.isFinite(delta) || delta < 1) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO "PlatformStatistic" ("id", "completedSessionsTotal", "updatedAt")
      VALUES (${PLATFORM_STATISTIC_ID}, ${delta}, NOW())
      ON CONFLICT ("id") DO UPDATE
      SET
        "completedSessionsTotal" = "PlatformStatistic"."completedSessionsTotal" + EXCLUDED."completedSessionsTotal",
        "updatedAt" = "PlatformStatistic"."updatedAt"
    `;
  } catch (e) {
    logger.warn('PlatformStatistic: completedSessionsTotal konnte nicht inkrementiert werden', e);
  }
}
