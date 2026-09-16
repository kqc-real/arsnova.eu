import { Temporal } from '@js-temporal/polyfill';
import { TRPCError } from '@trpc/server';
import {
  SESSION_HARD_MAX_DURATION_DAYS,
  SESSION_OPERATOR_DEFAULT_MAX_DURATION_DAYS,
  SESSION_POST_PROCESSING_HOURS,
  type SessionExpirationExtensionSelection,
  type SessionInitialExpirationSelection,
  type SessionQaDeadlineSelection,
} from '@arsnova/shared-types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const SESSION_DEFAULT_DURATION_MS = DAY_MS;
export const SESSION_HARD_MAX_DURATION_MS = SESSION_HARD_MAX_DURATION_DAYS * DAY_MS;
export const SESSION_OPERATOR_DEFAULT_MAX_DURATION_MS =
  SESSION_OPERATOR_DEFAULT_MAX_DURATION_DAYS * DAY_MS;
export const SESSION_POST_PROCESSING_DURATION_MS = SESSION_POST_PROCESSING_HOURS * HOUR_MS;

export type SessionLifecycleClock = {
  now(): Date;
};

export const systemSessionLifecycleClock: SessionLifecycleClock = {
  now: () => new Date(),
};

function parseDurationMilliseconds(raw: string | undefined): number | null {
  if (!raw?.trim()) {
    return null;
  }
  const normalized = raw.trim().toUpperCase();
  const shorthand = normalized.match(/^(\d+)(H|D)$/);
  if (shorthand?.[1] && shorthand[2]) {
    const value = Number.parseInt(shorthand[1], 10);
    return value * (shorthand[2] === 'D' ? DAY_MS : HOUR_MS);
  }
  const iso = normalized.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/);
  if (iso && (iso[1] || iso[2])) {
    return (Number.parseInt(iso[1] ?? '0', 10) * 24 + Number.parseInt(iso[2] ?? '0', 10)) * HOUR_MS;
  }
  return null;
}

/**
 * Betreibergrenze: fehlende oder ungültige Konfiguration fällt sicher auf
 * 14 Tage zurück; 24 Stunden bis 30 Tage sind die einzigen gültigen Werte.
 */
export function getMaxSessionDurationMs(raw = process.env['MAX_SESSION_DURATION']): number {
  const parsed = parseDurationMilliseconds(raw);
  if (
    parsed === null ||
    parsed < SESSION_DEFAULT_DURATION_MS ||
    parsed > SESSION_HARD_MAX_DURATION_MS
  ) {
    return SESSION_OPERATOR_DEFAULT_MAX_DURATION_MS;
  }
  return parsed;
}

export function assertSupportedSessionTimeZone(timeZone: string): void {
  try {
    Temporal.Now.instant().toZonedDateTimeISO(timeZone);
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Die angegebene Zeitzone wird nicht unterstützt.',
    });
  }
}

function toInstant(date: Date): Temporal.Instant {
  return Temporal.Instant.from(date.toISOString());
}

function fromInstant(instant: Temporal.Instant): Date {
  return new Date(instant.epochMilliseconds);
}

function addCalendarDays(date: Date, days: number, timeZone: string): Date {
  return fromInstant(toInstant(date).toZonedDateTimeISO(timeZone).add({ days }).toInstant());
}

export function getSessionMaxExpiresAt(
  createdAt: Date,
  maxDurationMs = getMaxSessionDurationMs(),
): Date {
  return new Date(createdAt.getTime() + Math.min(maxDurationMs, SESSION_HARD_MAX_DURATION_MS));
}

function parseAbsoluteExpiration(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Der Ablaufzeitpunkt ist ungültig.',
    });
  }
  return parsed;
}

function assertExpirationAllowed(input: {
  createdAt: Date;
  expiresAt: Date;
  now: Date;
  maxDurationMs?: number;
}): void {
  if (input.expiresAt.getTime() <= input.now.getTime()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Der Ablaufzeitpunkt muss in der Zukunft liegen.',
    });
  }
  if (
    input.expiresAt.getTime() >
    getSessionMaxExpiresAt(input.createdAt, input.maxDurationMs).getTime()
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Der Ablaufzeitpunkt überschreitet die maximal erlaubte Sessiondauer.',
    });
  }
}

export function computeInitialSessionExpiration(input: {
  createdAt: Date;
  now: Date;
  timeZone: string;
  selection?: SessionInitialExpirationSelection;
  maxDurationMs?: number;
}): Date {
  assertSupportedSessionTimeZone(input.timeZone);
  const expiresAt = input.selection
    ? input.selection.kind === 'DURATION_DAYS'
      ? addCalendarDays(input.createdAt, input.selection.days, input.timeZone)
      : parseAbsoluteExpiration(input.selection.expiresAt)
    : new Date(input.createdAt.getTime() + SESSION_DEFAULT_DURATION_MS);
  assertExpirationAllowed({ ...input, expiresAt });
  return expiresAt;
}

export function computeExtendedSessionExpiration(input: {
  createdAt: Date;
  currentExpiresAt: Date;
  now: Date;
  timeZone: string;
  selection: SessionExpirationExtensionSelection;
  maxDurationMs?: number;
}): Date {
  assertSupportedSessionTimeZone(input.timeZone);
  let expiresAt: Date;
  if (input.selection.kind === 'ABSOLUTE') {
    expiresAt = parseAbsoluteExpiration(input.selection.expiresAt);
  } else if (input.selection.amount === 'ONE_HOUR') {
    expiresAt = new Date(input.currentExpiresAt.getTime() + HOUR_MS);
  } else {
    expiresAt = addCalendarDays(
      input.currentExpiresAt,
      input.selection.amount === 'ONE_DAY' ? 1 : 7,
      input.timeZone,
    );
  }
  if (expiresAt.getTime() <= input.currentExpiresAt.getTime()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Eine Verlängerung muss nach dem bisherigen Sessionende liegen.',
    });
  }
  assertExpirationAllowed({ ...input, expiresAt });
  return expiresAt;
}

/** Q&A-Frist ab dem tatsächlich serverbestätigten Öffnungs-/Neuplanungszeitpunkt. */
export function computeSessionQaClosesAt(input: {
  createdAt: Date;
  currentExpiresAt: Date;
  openedAt: Date;
  timeZone: string;
  selection: SessionQaDeadlineSelection;
  maxDurationMs?: number;
  /** Unveränderte gespeicherte Q&A-Frist darf bei REPLAN ohne Wiederöffnen in der Vergangenheit liegen. */
  allowUnchangedPastClosesAt?: Date | null;
}): Date {
  assertSupportedSessionTimeZone(input.timeZone);
  const closesAt =
    input.selection.kind === 'UNTIL_SESSION_END'
      ? input.currentExpiresAt
      : input.selection.kind === 'DURATION_DAYS'
        ? addCalendarDays(input.openedAt, input.selection.days, input.timeZone)
        : parseAbsoluteExpiration(input.selection.closesAt);
  const unchangedPastDeadline =
    input.allowUnchangedPastClosesAt instanceof Date &&
    closesAt.getTime() === input.allowUnchangedPastClosesAt.getTime();
  if (!unchangedPastDeadline) {
    assertExpirationAllowed({
      createdAt: input.createdAt,
      expiresAt: closesAt,
      now: input.openedAt,
      maxDurationMs: input.maxDurationMs,
    });
  }
  return closesAt;
}

export function isSessionEffectivelyFinished(
  session: { status: string; endedAt?: Date | null; expiresAt?: Date | null },
  now: Date,
): boolean {
  return (
    session.status === 'FINISHED' ||
    session.endedAt instanceof Date ||
    (session.expiresAt instanceof Date && now.getTime() >= session.expiresAt.getTime())
  );
}

/** Kanonisches Ende, auch bevor ein verspäteter Cleanup `endedAt` materialisiert. */
export function getEffectiveSessionEndedAt(
  session: { endedAt?: Date | null; expiresAt?: Date | null },
  now: Date,
): Date | null {
  if (session.endedAt instanceof Date) {
    return session.endedAt;
  }
  if (session.expiresAt instanceof Date && now.getTime() >= session.expiresAt.getTime()) {
    return session.expiresAt;
  }
  return null;
}

export function getPostProcessingEndsAt(endedAt: Date): Date {
  return new Date(endedAt.getTime() + SESSION_POST_PROCESSING_DURATION_MS);
}

/** Berechnete Fristen; nur `endedAt` und ein optionaler Legal Hold werden gespeichert. */
export function buildSessionRetentionTimeline(
  session: {
    endedAt?: Date | null;
    expiresAt?: Date | null;
    legalHoldUntil?: Date | null;
  },
  now: Date,
): {
  endedAt: Date | null;
  postProcessingEndsAt: Date | null;
  purgeEligibleAt: Date | null;
  expectedDeletionAt: Date | null;
  deletionDelayedByLegalHold: boolean;
  hostPostProcessingAccessAllowed: boolean;
} {
  const endedAt = getEffectiveSessionEndedAt(session, now);
  if (!endedAt) {
    const projectedPostProcessingEndsAt =
      session.expiresAt instanceof Date ? getPostProcessingEndsAt(session.expiresAt) : null;
    const projectedLegalHoldUntil =
      projectedPostProcessingEndsAt &&
      session.legalHoldUntil instanceof Date &&
      session.legalHoldUntil.getTime() > projectedPostProcessingEndsAt.getTime()
        ? session.legalHoldUntil
        : null;
    return {
      endedAt: null,
      postProcessingEndsAt: projectedPostProcessingEndsAt,
      purgeEligibleAt: projectedPostProcessingEndsAt,
      expectedDeletionAt: projectedLegalHoldUntil ?? projectedPostProcessingEndsAt,
      deletionDelayedByLegalHold: projectedLegalHoldUntil !== null,
      hostPostProcessingAccessAllowed: true,
    };
  }
  const postProcessingEndsAt = getPostProcessingEndsAt(endedAt);
  const legalHoldUntil =
    session.legalHoldUntil instanceof Date &&
    session.legalHoldUntil.getTime() > postProcessingEndsAt.getTime()
      ? session.legalHoldUntil
      : null;
  return {
    endedAt,
    postProcessingEndsAt,
    purgeEligibleAt: postProcessingEndsAt,
    expectedDeletionAt: legalHoldUntil ?? postProcessingEndsAt,
    deletionDelayedByLegalHold: legalHoldUntil !== null,
    hostPostProcessingAccessAllowed: now.getTime() < postProcessingEndsAt.getTime(),
  };
}

export function assertSessionEffectivelyActive(
  session: { status: string; endedAt?: Date | null; expiresAt?: Date | null },
  now: Date,
): void {
  if (isSessionEffectivelyFinished(session, now)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Die Session ist bereits beendet.',
    });
  }
}

export function isSessionLifecycleDatabaseError(error: unknown): boolean {
  const visited = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && current !== undefined; depth += 1) {
    if (visited.has(current)) break;
    visited.add(current);
    const message = current instanceof Error ? current.message : String(current);
    let meta: string;
    try {
      meta = JSON.stringify((current as { meta?: unknown }).meta ?? '');
    } catch {
      meta = '';
    }
    if (`${message} ${meta}`.includes('ARSNOVA_SESSION_')) {
      return true;
    }
    current =
      typeof current === 'object' && current !== null
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}
