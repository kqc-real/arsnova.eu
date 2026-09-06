import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import {
  PRODUCT_FEEDBACK_IN_APP_CHALLENGE_TTL_SECONDS,
  type ProductFeedbackInAppChallengeOutput,
} from '@arsnova/shared-types';
import { getRedis } from '../redis';
import { hashToken } from './productFeedbackTokens';

const CHALLENGE_PREFIX = 'productFeedback:inAppChallenge:v1:';
const CHALLENGE_CONSUME_PREFIX = 'productFeedback:inAppChallengeConsume:v1:';

type ChallengePayload = {
  idempotencyKey: string;
};

function challengeKey(token: string): string {
  return `${CHALLENGE_PREFIX}${hashToken(token)}`;
}

function challengeConsumeKey(token: string): string {
  return `${CHALLENGE_CONSUME_PREFIX}${hashToken(token)}`;
}

export async function createInAppChallenge(
  idempotencyKey: string,
): Promise<ProductFeedbackInAppChallengeOutput> {
  const challengeToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    Date.now() + PRODUCT_FEEDBACK_IN_APP_CHALLENGE_TTL_SECONDS * 1_000,
  ).toISOString();
  const payload: ChallengePayload = { idempotencyKey };
  await getRedis().set(
    challengeKey(challengeToken),
    JSON.stringify(payload),
    'EX',
    PRODUCT_FEEDBACK_IN_APP_CHALLENGE_TTL_SECONDS,
    'NX',
  );
  return { challengeToken, expiresAt };
}

export async function reserveInAppChallenge(
  challengeToken: string,
  idempotencyKey: string,
): Promise<boolean> {
  const redis = getRedis();
  const raw = await redis.get(challengeKey(challengeToken));
  if (!raw) return false;

  let payload: ChallengePayload;
  try {
    payload = JSON.parse(raw) as ChallengePayload;
  } catch {
    return false;
  }
  if (payload.idempotencyKey !== idempotencyKey) return false;

  const reserved = await redis.set(
    challengeConsumeKey(challengeToken),
    '1',
    'EX',
    PRODUCT_FEEDBACK_IN_APP_CHALLENGE_TTL_SECONDS,
    'NX',
  );
  return reserved === 'OK';
}

export async function releaseInAppChallenge(challengeToken: string): Promise<void> {
  await getRedis().del(challengeConsumeKey(challengeToken));
}

export async function finalizeInAppChallenge(challengeToken: string): Promise<void> {
  const redis = getRedis();
  await redis.del(challengeKey(challengeToken), challengeConsumeKey(challengeToken));
}

const DEV_IN_APP_ORIGINS = new Set([
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://[::1]:4200',
]);

function canonicalOrigin(value: string): string | null {
  if (value === 'null' || value.length > 256) return null;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.origin !== value) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function originFromConfiguredUrl(value: string): string | null {
  if (!value || value.length > 256) return null;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Produktions-Origins kommen nur aus fester Konfiguration, nie aus Host-Headern. */
export function trustedProductFeedbackOrigins(
  nodeEnv = process.env['NODE_ENV'],
  publicFrontendUrl = process.env['PUBLIC_FRONTEND_URL'],
): Set<string> {
  if (nodeEnv !== 'production') return new Set(DEV_IN_APP_ORIGINS);
  const origins = new Set<string>();
  for (const part of (publicFrontendUrl ?? '').split(',')) {
    const origin = originFromConfiguredUrl(part.trim());
    if (origin) origins.add(origin);
  }
  return origins;
}

/** Die öffentliche IN_APP-Schreib-API akzeptiert ausschließlich Browser-Same-Origin. */
export function isProductFeedbackOriginAllowed(
  req: IncomingMessage | undefined,
  nodeEnv = process.env['NODE_ENV'],
): boolean {
  if (!req) return nodeEnv === 'test';
  const originHeader = req.headers.origin;
  if (typeof originHeader !== 'string') return false;
  const origin = canonicalOrigin(originHeader);
  if (!origin) return false;
  return trustedProductFeedbackOrigins(nodeEnv).has(origin);
}

/** Auffälliger Text bleibt Plaintext, wird aber bis zur Adminprüfung quarantänemarkiert. */
export function shouldQuarantineProductFeedbackMessage(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) return false;
  return (
    /https?:\/\/|www\./i.test(normalized) ||
    /\b[A-Z0-9]{6}\b/.test(normalized) ||
    /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(normalized) ||
    /(.)\1{11,}/u.test(normalized)
  );
}
