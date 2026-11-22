import { randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { getRedis } from '../redis';
import { logger } from './logger';
import { QA_QUESTIONS_SIGNAL_DEBOUNCE_MS } from './qaQuestionsSignal';

const STATUS_CHANNEL = 'arsnova:session:status:v1';
const VOTE_PROGRESS_CHANNEL = 'arsnova:session:vote-progress:v1';
const PARTICIPANTS_CHANNEL = 'arsnova:session:participants:v1';
const QA_QUESTIONS_CHANNEL = 'arsnova:session:qa-questions:v1';
const INSTANCE_ID = randomBytes(12).toString('hex');
const SESSION_CODE = /^[A-Z0-9]{6}$/;
const SESSION_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const MESSAGE = /^([a-f0-9]{24}):([^:]+)$/;
const JOIN_INVALIDATION_DEBOUNCE_MS = 50;
export const VOTE_PROGRESS_SIGNAL_DEBOUNCE_MS = 150;
// Mehrere Commits eines Prozesses sammeln, bevor er das gemeinsame Fenster
// beansprucht. Auch ein verlorener Versuch kann so erst nach 75 ms wiederkehren.
const VOTE_PROGRESS_CLAIM_DELAY_MS = 75;
const VOTE_PROGRESS_CLAIM_TTL_MS = 1_000;
const VOTE_PROGRESS_PUBLISH_LUA = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('PUBLISH', ARGV[2], ARGV[3])
redis.call('DEL', KEYS[1])
return 1
`;

type PubSubConnections = {
  publisher: Redis;
  subscriber: Redis;
  receiveVoteProgress: (code: string) => void;
};

let connections: PubSubConnections | undefined;
let lastWarningAt = -Infinity;
const publishTimers = new Map<string, ReturnType<typeof setTimeout>>();

function warnOnUnavailableTransport(): void {
  if (Date.now() - lastWarningAt < 60_000) return;
  lastWarningAt = Date.now();
  logger.warn('Live-Session-Pub/Sub vorübergehend nicht verfügbar. Polling bleibt aktiv.');
}

export function isSessionPubSubEnabled(): boolean {
  return process.env['SESSION_STATUS_PUBSUB_ENABLED'] === 'true';
}

export function startSessionPubSub(handlers: {
  status: (code: string) => void;
  voteProgress: (code: string) => void;
  participants: (code: string) => void;
  qaQuestions: (sessionId: string) => void;
}): void {
  if (connections) return;
  const redis = getRedis();
  const retryStrategy = () => 1_000;
  const publisher = redis.duplicate({
    retryStrategy,
    enableOfflineQueue: false,
    autoResendUnfulfilledCommands: false,
    commandTimeout: 1_000,
  });
  const subscriber = redis.duplicate({
    retryStrategy,
    // Die erste SUBSCRIBE-Anfrage darf auch einen längeren Redis-Ausfall überstehen.
    maxRetriesPerRequest: null,
  });
  connections = { publisher, subscriber, receiveVoteProgress: handlers.voteProgress };
  const channels = new Map([
    [STATUS_CHANNEL, { keyPattern: SESSION_CODE, receive: handlers.status }],
    [VOTE_PROGRESS_CHANNEL, { keyPattern: SESSION_CODE, receive: handlers.voteProgress }],
    [PARTICIPANTS_CHANNEL, { keyPattern: SESSION_CODE, receive: handlers.participants }],
    [QA_QUESTIONS_CHANNEL, { keyPattern: SESSION_ID, receive: handlers.qaQuestions }],
  ]);

  publisher.on('error', warnOnUnavailableTransport);
  subscriber.on('error', warnOnUnavailableTransport);
  subscriber.on('message', (channel, message) => {
    if (connections?.subscriber !== subscriber) return;
    const match = MESSAGE.exec(message);
    const receiver = channels.get(channel);
    if (!receiver || !match?.[2]) return;
    if (match[1] === INSTANCE_ID && channel !== VOTE_PROGRESS_CHANNEL) return;
    if (receiver.keyPattern.test(match[2])) receiver.receive(match[2]);
  });
  void subscriber.subscribe(...channels.keys()).catch(() => {
    if (connections?.subscriber === subscriber) warnOnUnavailableTransport();
  });
}

function publishSessionInvalidation(channel: string, key: string): void {
  const publisher = connections?.publisher;
  if (!publisher || publisher.status !== 'ready') return;
  // Nur aufwecken: Die fachlichen Daten und ihre Freigabe kommen aus dem normalen Lesepfad.
  void publisher.publish(channel, `${INSTANCE_ID}:${key}`).catch(() => {
    if (connections?.publisher === publisher) warnOnUnavailableTransport();
  });
}

function scheduleOnce(timerKey: string, waitMs: number, fire: () => void): void {
  if (publishTimers.has(timerKey)) return;
  const timer = setTimeout(() => {
    publishTimers.delete(timerKey);
    fire();
  }, waitMs);
  timer.unref?.();
  publishTimers.set(timerKey, timer);
}

function scheduleSessionInvalidation(channel: string, key: string, waitMs: number): void {
  if (!connections || connections.publisher.status !== 'ready') return;
  scheduleOnce(`${channel}:${key}`, waitMs, () => publishSessionInvalidation(channel, key));
}

export function publishSessionStatusInvalidation(code: string): void {
  if (SESSION_CODE.test(code)) publishSessionInvalidation(STATUS_CHANNEL, code);
}

async function publishClaimedVoteProgress(
  active: PubSubConnections,
  code: string,
  key: string,
  owner: string,
): Promise<void> {
  try {
    const published = await active.publisher.eval(
      VOTE_PROGRESS_PUBLISH_LUA,
      1,
      key,
      owner,
      VOTE_PROGRESS_CHANNEL,
      `${INSTANCE_ID}:${code}`,
    );
    if (connections === active && (published !== 1 || active.subscriber.status !== 'ready')) {
      active.receiveVoteProgress(code);
    }
  } catch {
    if (connections !== active) return;
    warnOnUnavailableTransport();
    active.receiveVoteProgress(code);
  }
}

async function claimVoteProgress(
  active: PubSubConnections,
  code: string,
  key: string,
): Promise<void> {
  const owner = randomBytes(12).toString('hex');
  try {
    const claimed = await active.publisher.set(key, owner, 'PX', VOTE_PROGRESS_CLAIM_TTL_MS, 'NX');
    if (connections !== active) return;
    if (claimed !== 'OK') {
      if (active.subscriber.status !== 'ready') active.receiveVoteProgress(code);
      return;
    }
    scheduleOnce(
      `${key}:publish`,
      VOTE_PROGRESS_SIGNAL_DEBOUNCE_MS - VOTE_PROGRESS_CLAIM_DELAY_MS,
      () => void publishClaimedVoteProgress(active, code, key, owner),
    );
  } catch {
    if (connections !== active) return;
    warnOnUnavailableTransport();
    active.receiveVoteProgress(code);
  }
}

/** Ein Redis-Fenster pro Session. Die Freigabe und das Signal erfolgen atomar. */
export function scheduleClusterVoteProgressInvalidation(code: string): boolean {
  const active = connections;
  if (!active || active.publisher.status !== 'ready' || !SESSION_CODE.test(code)) return false;

  const key = `arsnova:session:vote-progress-window:v1:${code}`;
  // Solange unser Sendetimer läuft, liegen neue Commits noch vor dem Publish.
  // Sobald der Timer auslöst, kann ein weiterer Commit ein neues Fenster öffnen.
  if (!publishTimers.has(`${key}:publish`)) {
    scheduleOnce(`${key}:claim`, VOTE_PROGRESS_CLAIM_DELAY_MS, () => {
      void claimVoteProgress(active, code, key);
    });
  }
  return true;
}

export function publishSessionParticipantsInvalidation(code: string): void {
  if (SESSION_CODE.test(code)) {
    scheduleSessionInvalidation(PARTICIPANTS_CHANNEL, code, JOIN_INVALIDATION_DEBOUNCE_MS);
  }
}

export function publishQaQuestionsInvalidation(
  sessionId: string,
  options?: { immediate?: boolean },
): void {
  if (!SESSION_ID.test(sessionId)) return;
  if (options?.immediate) {
    const timerKey = `${QA_QUESTIONS_CHANNEL}:${sessionId}`;
    const pending = publishTimers.get(timerKey);
    if (pending) {
      clearTimeout(pending);
      publishTimers.delete(timerKey);
    }
    publishSessionInvalidation(QA_QUESTIONS_CHANNEL, sessionId);
    return;
  }
  scheduleSessionInvalidation(QA_QUESTIONS_CHANNEL, sessionId, QA_QUESTIONS_SIGNAL_DEBOUNCE_MS);
}

export function stopSessionPubSub(): void {
  const active = connections;
  connections = undefined;
  for (const timer of publishTimers.values()) clearTimeout(timer);
  publishTimers.clear();
  active?.subscriber.disconnect();
  active?.publisher.disconnect();
}
