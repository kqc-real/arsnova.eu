/**
 * Prozesslokale Bereinigung, persistierte Cache-Eviction und Redis-Fan-out
 * für Session-Purges.
 *
 * Der Purge-Worker sendet vor und nach dem DB-Delete. Der erste Pass setzt die
 * persistente sessionId-Fence, sodass kein In-Flight-Write das Delete-Race
 * überleben kann; der zweite Pass bleibt eine idempotente Fan-out-Absicherung.
 */
import type Redis from 'ioredis';
import { getRedis } from '../redis';
import { logger } from './logger';
import {
  evictLegacyWordCloudAnalysisSnapshots,
  evictWordCloudAnalysisSnapshotsForSessions,
} from './wordCloudAnalysisCache';
import { purgeHostPairingForSessions } from './hostPairingSessionPurge';
import { purgeProductFeedbackInvitesForSessions } from './productFeedbackTokens';
import { purgeSessionBoundQuickFeedbackForSessions } from './quickFeedbackSessionPurge';
import { purgeSessionRuntimeDataForSessions } from './sessionRuntimeDataPurge';

export const SESSION_PURGE_INVALIDATION_CHANNEL = 'session:purge:v1:invalidate';

export type SessionPurgeInvalidation = {
  sessionId: string;
  sessionCode: string;
};

type SessionPurgeInvalidator = (event: SessionPurgeInvalidation) => Promise<void> | void;

const localInvalidators = new Set<SessionPurgeInvalidator>();
const SESSION_PURGE_FAN_OUT_BATCH_SIZE = 25;
let subscriber: Redis | null = null;
let subscriberStarting: Promise<void> | null = null;

function normalizeEvent(event: SessionPurgeInvalidation): SessionPurgeInvalidation {
  return {
    sessionId: event.sessionId.trim(),
    sessionCode: event.sessionCode.trim().toUpperCase(),
  };
}

export function parseSessionPurgeInvalidation(message: string): SessionPurgeInvalidation | null {
  try {
    const parsed = JSON.parse(message) as Partial<SessionPurgeInvalidation>;
    if (
      typeof parsed.sessionId !== 'string' ||
      parsed.sessionId.trim().length === 0 ||
      typeof parsed.sessionCode !== 'string' ||
      parsed.sessionCode.trim().length === 0
    ) {
      return null;
    }
    return normalizeEvent({
      sessionId: parsed.sessionId,
      sessionCode: parsed.sessionCode,
    });
  } catch {
    return null;
  }
}

export function registerSessionPurgeInvalidator(invalidator: SessionPurgeInvalidator): () => void {
  localInvalidators.add(invalidator);
  return () => localInvalidators.delete(invalidator);
}

async function invalidateLocally(event: SessionPurgeInvalidation): Promise<void> {
  const results = await Promise.allSettled(
    [...localInvalidators].map((invalidator) => Promise.resolve().then(() => invalidator(event))),
  );
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failed) throw failed.reason;
}

async function runInBoundedBatches<T>(
  values: readonly T[],
  operation: (value: T) => Promise<void>,
): Promise<void> {
  for (let offset = 0; offset < values.length; offset += SESSION_PURGE_FAN_OUT_BATCH_SIZE) {
    const results = await Promise.allSettled(
      values
        .slice(offset, offset + SESSION_PURGE_FAN_OUT_BATCH_SIZE)
        .map((value) => Promise.resolve().then(() => operation(value))),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
  }
}

export async function publishSessionPurgeInvalidations(
  events: readonly SessionPurgeInvalidation[],
): Promise<void> {
  const normalized = events.map(normalizeEvent);
  if (normalized.length === 0) return;
  await purgeSessionRuntimeDataForSessions(normalized.map(({ sessionId }) => sessionId));
  await purgeProductFeedbackInvitesForSessions(normalized.map(({ sessionId }) => sessionId));
  await purgeHostPairingForSessions(normalized);
  await runInBoundedBatches(normalized, invalidateLocally);
  await purgeSessionBoundQuickFeedbackForSessions(normalized);
  // Der globale Sweep migriert ausschließlich vor v2 unindizierte Altlasten
  // und wird auch bei parallelen Bulk-Purges pro Prozess nur einmal ausgeführt.
  await evictLegacyWordCloudAnalysisSnapshots();
  // Cache-Mutationen und AOF-Bestätigung werden in begrenzten Chunks gebündelt:
  // ein Marker/WAITAOF bestätigt bis zu 25 atomare Session-Purges.
  await evictWordCloudAnalysisSnapshotsForSessions(normalized.map(({ sessionId }) => sessionId));
  const redis = getRedis();
  await runInBoundedBatches(normalized, async (event) => {
    await redis.publish(SESSION_PURGE_INVALIDATION_CHANNEL, JSON.stringify(event));
  });
}

export async function publishSessionPurgeInvalidation(
  event: SessionPurgeInvalidation,
): Promise<void> {
  await publishSessionPurgeInvalidations([event]);
}

export async function startSessionPurgeInvalidationSubscriber(): Promise<void> {
  if (subscriber || subscriberStarting) {
    return subscriberStarting ?? Promise.resolve();
  }
  subscriberStarting = (async () => {
    const nextSubscriber = getRedis().duplicate();
    nextSubscriber.on('message', (channel, message) => {
      if (channel !== SESSION_PURGE_INVALIDATION_CHANNEL) return;
      const event = parseSessionPurgeInvalidation(message);
      if (!event) return;
      void invalidateLocally(event).catch((error: unknown) => {
        logger.warn('Lokale Session-Purge-Invalidierung fehlgeschlagen:', (error as Error).message);
      });
    });
    await nextSubscriber.subscribe(SESSION_PURGE_INVALIDATION_CHANNEL);
    subscriber = nextSubscriber;
  })();
  try {
    await subscriberStarting;
  } finally {
    subscriberStarting = null;
  }
}

export async function stopSessionPurgeInvalidationSubscriber(): Promise<void> {
  const active = subscriber;
  subscriber = null;
  if (active) {
    await active.quit();
  }
}

export function resetSessionPurgeInvalidationForTests(): void {
  localInvalidators.clear();
  subscriber = null;
  subscriberStarting = null;
}
