/**
 * Redis-Client-Singleton (Story 0.1, 0.5).
 * Eine Instanz pro Prozess für Pub/Sub, Rate-Limiting und spätere Session-Daten.
 */
import Redis from 'ioredis';
import { logger } from './lib/logger';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

let redis: Redis | null = null;
let redisErrorLogged = false;
let redisShutdownStarted = false;

/** Verhindert, dass späte Shutdown-Arbeit eine neue Redis-Verbindung öffnet. */
export function beginRedisShutdown(): void {
  redisShutdownStarted = true;
}

/**
 * Liefert die Redis-Client-Instanz (lazy init).
 * Verbindungsfehler treten beim ersten Befehl auf; nach Beginn des geordneten
 * Shutdowns wird eine neue Verbindung dagegen synchron abgelehnt.
 */
export function getRedis(): Redis {
  if (!redis) {
    if (redisShutdownStarted) {
      throw new Error('REDIS_SHUTTING_DOWN');
    }
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('error', (err: unknown) => {
      if (!redisErrorLogged) {
        redisErrorLogged = true;
        const e = err as Error & { errors?: Error[] };
        const msg = e?.errors?.[0]?.message ?? e?.message ?? 'ECONNREFUSED';
        logger.warn(
          'Redis nicht erreichbar:',
          msg,
          '– Redis z. B. mit npm run docker:up starten (Docker Desktop muss laufen).',
        );
      }
    });
  }
  return redis;
}

/**
 * Prüft, ob Redis erreichbar ist (Story 0.1 – Health-Check).
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Schließt die Verbindung (z. B. bei SIGTERM).
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    const client = redis;
    redis = null;
    await client.quit();
  }
}
