/**
 * Prozesslokale Bereinigung plus Redis-Fan-out für Session-Purges.
 *
 * Der Purge-Worker sendet vor und nach dem DB-Delete. So verwerfen alle
 * Instanzen sowohl vorhandene als auch während des Delete-Races fertig
 * gewordene In-Flight-Caches und Analyseartefakte.
 */
import type Redis from 'ioredis';
import { getRedis } from '../redis';
import { logger } from './logger';

export const SESSION_PURGE_INVALIDATION_CHANNEL = 'session:purge:v1:invalidate';

export type SessionPurgeInvalidation = {
  sessionId: string;
  sessionCode: string;
};

type SessionPurgeInvalidator = (event: SessionPurgeInvalidation) => Promise<void> | void;

const localInvalidators = new Set<SessionPurgeInvalidator>();
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
  await Promise.all([...localInvalidators].map((invalidator) => invalidator(event)));
}

export async function publishSessionPurgeInvalidation(
  event: SessionPurgeInvalidation,
): Promise<void> {
  const normalized = normalizeEvent(event);
  await invalidateLocally(normalized);
  await getRedis().publish(SESSION_PURGE_INVALIDATION_CHANNEL, JSON.stringify(normalized));
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
