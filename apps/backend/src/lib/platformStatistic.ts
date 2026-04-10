/**
 * Plattformweite Kennzahl: höchste Teilnehmerzahl in einer einzelnen Session.
 * Aktualisierung atomar per GREATEST (parallel Join-sicher).
 */
import { prisma } from '../db';
import { logger } from './logger';

export const PLATFORM_STATISTIC_ID = 'default';

/**
 * Erhöht den gespeicherten Rekord, falls `participantCount` höher ist.
 * Fehler werden geloggt und geschluckt – Aufrufer (z. B. Join) darf nicht fehlschlagen.
 */
export async function updateMaxParticipantsSingleSession(participantCount: number): Promise<void> {
  if (!Number.isFinite(participantCount) || participantCount < 1) return;
  try {
    // updatedAt nur bei echter Rekorderhöhung (sonst würde jedes Join den Zeitstempel setzen).
    await prisma.$executeRaw`
      UPDATE "PlatformStatistic"
      SET
        "maxParticipantsSingleSession" = GREATEST("maxParticipantsSingleSession", ${participantCount}),
        "updatedAt" = CASE
          WHEN ${participantCount} > "maxParticipantsSingleSession" THEN NOW()
          ELSE "updatedAt"
        END
      WHERE "id" = ${PLATFORM_STATISTIC_ID}
    `;
  } catch (e) {
    logger.warn(
      'PlatformStatistic: maxParticipantsSingleSession konnte nicht aktualisiert werden',
      e,
    );
  }
}
