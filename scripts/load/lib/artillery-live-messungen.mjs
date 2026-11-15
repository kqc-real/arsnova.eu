import { percentile } from './percentiles.mjs';

// Bestehende Reportnamen bleiben für bisherige Auswertungen erhalten.
export const LIVE_AKTIONSFELDER = {
  join: {
    label: 'Beitritt',
    attempts: 'joinAttempts',
    success: 'joins',
    errors: 'joinErrors',
    skipped: 'joinSkipped',
    durations: 'joinDurationMs',
    errorDurations: 'joinErrorDurationMs',
    codes: 'joinErrorCodes',
    event: 'joins',
    histogram: 'join_duration_ms',
  },
  vote: {
    label: 'Quizstimme',
    attempts: 'voteAttempts',
    success: 'votes',
    errors: 'voteErrors',
    skipped: 'voteSkippedInactive',
    durations: 'voteDurationMs',
    errorDurations: 'voteErrorDurationMs',
    codes: 'voteErrorCodes',
    event: 'votes',
    histogram: 'vote_duration_ms',
  },
  qaSubmit: {
    label: 'Q&A-Einreichung',
    attempts: 'qaSubmitAttempts',
    success: 'qaSubmits',
    errors: 'qaSubmitErrors',
    skipped: 'qaSubmitSkipped',
    durations: 'qaSubmitDurationMs',
    errorDurations: 'qaSubmitErrorDurationMs',
    codes: 'qaSubmitErrorCodes',
    event: 'qa_submits',
    histogram: 'qa_submit_duration_ms',
  },
  blitzlicht: {
    label: 'Blitzlicht',
    attempts: 'blitzVoteAttempts',
    success: 'blitzVotes',
    errors: 'blitzVoteErrors',
    skipped: 'blitzVoteSkipped',
    durations: 'blitzVoteDurationMs',
    errorDurations: 'blitzVoteErrorDurationMs',
    codes: 'blitzVoteErrorCodes',
    event: 'blitz_votes',
    histogram: 'blitz_vote_duration_ms',
  },
};

export function initialisiereLiveMessungen(gespeichert = {}) {
  const zustand = { ...gespeichert };
  for (const felder of Object.values(LIVE_AKTIONSFELDER)) {
    for (const feld of [felder.attempts, felder.success, felder.errors, felder.skipped]) {
      zustand[feld] = gespeichert[feld] ?? 0;
    }
    for (const feld of [felder.durations, felder.errorDurations]) {
      zustand[feld] = Array.isArray(gespeichert[feld]) ? [...gespeichert[feld]] : [];
    }
    zustand[felder.codes] = { ...gespeichert[felder.codes] };
  }
  return zustand;
}

export function fasseLaufzeitenZusammen(stichproben = []) {
  const gueltig =
    Array.isArray(stichproben) && stichproben.every((wert) => Number.isFinite(wert) && wert >= 0);
  const vorhanden = gueltig && stichproben.length > 0;
  return {
    available: vorhanden,
    samples: Array.isArray(stichproben) ? stichproben.length : 0,
    durationSamplesMs: Array.isArray(stichproben) ? [...stichproben] : [],
    p50Ms: vorhanden ? percentile(stichproben, 50) : null,
    p95Ms: vorhanden ? percentile(stichproben, 95) : null,
    p99Ms: vorhanden ? percentile(stichproben, 99) : null,
    maxMs: vorhanden ? stichproben.reduce((maximum, wert) => Math.max(maximum, wert), 0) : null,
  };
}

export function fasseLiveMessungenZusammen(zustand, { participants, votesEnabled = true }) {
  if (!Number.isInteger(participants) || participants < 1) {
    throw new Error('Die geplante Teilnehmerzahl muss eine positive Ganzzahl sein.');
  }
  return Object.fromEntries(
    Object.entries(LIVE_AKTIONSFELDER).map(([aktion, felder]) => {
      const geplant = aktion === 'qaSubmit' ? Math.floor(participants / 5) : participants;
      const versuche = zustand[felder.attempts] ?? 0;
      const erfolgreich = zustand[felder.success] ?? 0;
      const fehler = zustand[felder.errors] ?? 0;
      const uebersprungen = zustand[felder.skipped] ?? 0;
      const laufend = Math.max(0, versuche - erfolgreich - fehler);
      const nichtGestartet = Math.max(0, geplant - versuche - uebersprungen);
      const latenz = fasseLaufzeitenZusammen(zustand[felder.durations]);
      const fehlerlatenz = fasseLaufzeitenZusammen(zustand[felder.errorDurations]);
      const konsistent =
        [versuche, erfolgreich, fehler, uebersprungen].every(
          (wert) => Number.isInteger(wert) && wert >= 0,
        ) &&
        versuche >= erfolgreich + fehler &&
        versuche + uebersprungen <= geplant &&
        latenz.samples === erfolgreich &&
        fehlerlatenz.samples === fehler &&
        (erfolgreich === 0 || latenz.available) &&
        (fehler === 0 || fehlerlatenz.available);
      return [
        aktion,
        {
          label: felder.label,
          applicable: geplant > 0 && (aktion !== 'vote' || votesEnabled),
          planned: geplant,
          attempted: versuche,
          succeeded: erfolgreich,
          failed: fehler,
          skipped: uebersprungen,
          pending: laufend,
          notAttempted: nichtGestartet,
          accountingValid: konsistent,
          errorRate: versuche > 0 && konsistent ? fehler / versuche : null,
          scheduledFailureRate:
            geplant > 0 && konsistent
              ? (fehler + uebersprungen + laufend + nichtGestartet) / geplant
              : null,
          latency: latenz,
          failureLatency: fehlerlatenz,
          errorCodes: { ...zustand[felder.codes] },
        },
      ];
    }),
  );
}

/** Smoke-Grenzen; die strengere A1-Abdeckung wird später je Versuch ausgewertet. */
export function pruefeLiveMessungen(
  aktionen,
  { errorRateLimit = 0.005, minSuccessRatio = 1 } = {},
) {
  if (!Number.isFinite(errorRateLimit) || errorRateLimit < 0 || errorRateLimit > 1) {
    throw new Error('Die Fehlergrenze muss zwischen 0 und 1 liegen.');
  }
  const fehler = [];
  for (const [name, messung] of Object.entries(aktionen)) {
    if (!messung.applicable) {
      if (!messung.accountingValid || messung.attempted > 0) {
        fehler.push(`${messung.label}: nicht vorgesehene Aufrufe oder widersprüchliche Zählung.`);
      }
      continue;
    }
    const mindestanteil =
      typeof minSuccessRatio === 'number' ? minSuccessRatio : minSuccessRatio[name];
    if (!Number.isFinite(mindestanteil) || mindestanteil < 0 || mindestanteil > 1) {
      throw new Error(`Der Mindestanteil für ${messung.label} muss zwischen 0 und 1 liegen.`);
    }
    if (!messung.accountingValid || messung.pending > 0) {
      fehler.push(`${messung.label}: Zählung oder Stichproben unvollständig bzw. widersprüchlich.`);
    }
    if (!messung.latency.available || messung.succeeded < messung.planned * mindestanteil) {
      fehler.push(
        `${messung.label}: erfolgreiche Laufzeitstichproben ${messung.succeeded}/${messung.planned} unzureichend.`,
      );
    }
    if (messung.errorRate === null || messung.errorRate > errorRateLimit) {
      fehler.push(
        `${messung.label}: Fehlerquote ${messung.failed}/${messung.attempted} überschreitet das Limit <= ${errorRateLimit} oder ist nicht verfügbar.`,
      );
    }
  }
  return fehler;
}
