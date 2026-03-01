/**
 * Redis-Client-Singleton (Story 0.1, 0.5).
 * Eine Instanz pro Prozess für Pub/Sub, Rate-Limiting und spätere Session-Daten.
 */
import Redis from 'ioredis';
import { logger } from './lib/logger';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

let redis: Redis | null = null;
let redisErrorLogged = false;

/**
 * Liefert die Redis-Client-Instanz (lazy init).
 * Wirft nicht – Verbindungsfehler treten beim ersten Befehl auf.
 */
export function getRedis(): Redis {
  if (!redis) {
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
        logger.warn('Redis nicht erreichbar:', msg, '– Redis z. B. mit npm run docker:up starten (Docker Desktop muss laufen).');
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
    await redis.quit();
    redis = null;
  }
}
