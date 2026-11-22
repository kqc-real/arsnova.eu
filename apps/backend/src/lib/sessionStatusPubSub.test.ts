import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../redis', () => ({ getRedis: vi.fn() }));

import { getRedis } from '../redis';
import {
  publishQaQuestionsInvalidation,
  publishSessionParticipantsInvalidation,
  publishSessionStatusInvalidation,
  scheduleClusterVoteProgressInvalidation,
  startSessionPubSub,
  stopSessionPubSub,
} from './sessionStatusPubSub';

const publisher = Object.assign(new EventEmitter(), {
  status: 'ready',
  publish: vi.fn().mockResolvedValue(2),
  set: vi.fn(),
  eval: vi.fn(),
  disconnect: vi.fn(),
});
const subscriber = Object.assign(new EventEmitter(), {
  status: 'ready',
  subscribe: vi.fn().mockResolvedValue(1),
  disconnect: vi.fn(),
});
const duplicate = vi.fn();
const channel = 'arsnova:session:status:v1';
const voteProgressChannel = 'arsnova:session:vote-progress:v1';
const participantsChannel = 'arsnova:session:participants:v1';
const qaQuestionsChannel = 'arsnova:session:qa-questions:v1';
const remoteInstanceId = 'a'.repeat(24);
const qaSessionId = 'a2c8995c-b57c-41af-b23b-bf074ec76460';

function createHandlers() {
  return {
    status: vi.fn(),
    voteProgress: vi.fn(),
    participants: vi.fn(),
    qaQuestions: vi.fn(),
  };
}

describe('Live-Session Pub/Sub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publisher.status = 'ready';
    subscriber.status = 'ready';
    publisher.set.mockReset().mockResolvedValue('OK');
    publisher.eval.mockReset().mockResolvedValue(1);
    duplicate.mockReset().mockReturnValueOnce(publisher).mockReturnValueOnce(subscriber);
    vi.mocked(getRedis).mockReturnValue({ duplicate } as unknown as ReturnType<typeof getRedis>);
  });

  afterEach(() => {
    stopSessionPubSub();
    publisher.removeAllListeners();
    subscriber.removeAllListeners();
    vi.useRealTimers();
  });

  it('bleibt bis zum expliziten Start deaktiviert und abonniert genau einmal', () => {
    publishSessionStatusInvalidation('ABC123');
    expect(getRedis).not.toHaveBeenCalled();

    const handlers = createHandlers();
    startSessionPubSub(handlers);
    startSessionPubSub(handlers);

    expect(duplicate).toHaveBeenCalledTimes(2);
    expect(subscriber.subscribe).toHaveBeenCalledExactlyOnceWith(
      channel,
      voteProgressChannel,
      participantsChannel,
      qaQuestionsChannel,
    );
  });

  it('weckt nur für valide Fremdsignale und publiziert das empfangene Signal nicht erneut', () => {
    const handlers = createHandlers();
    const { status: receive } = handlers;
    startSessionPubSub(handlers);
    publishSessionStatusInvalidation('ABC123');
    const [publishedChannel, payload] = publisher.publish.mock.calls[0]!;
    expect(publishedChannel).toBe(channel);
    expect(payload).toMatch(/^[a-f0-9]{24}:ABC123$/);

    subscriber.emit('message', channel, payload);
    subscriber.emit('message', 'other-channel', `${remoteInstanceId}:ABC123`);
    subscriber.emit('message', channel, `${remoteInstanceId}:abc123`);
    subscriber.emit('message', channel, `${remoteInstanceId}:ABC123:unexpected`);
    expect(receive).not.toHaveBeenCalled();

    subscriber.emit('message', channel, `${remoteInstanceId}:ABC123`);
    expect(receive).toHaveBeenCalledExactlyOnceWith('ABC123');
    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('beansprucht ein gemeinsames Vote-Fenster und weckt auch den eigenen Listener', async () => {
    vi.useFakeTimers();
    const handlers = createHandlers();
    const { status, voteProgress } = handlers;
    startSessionPubSub(handlers);
    expect(scheduleClusterVoteProgressInvalidation('ABC123')).toBe(true);
    expect(scheduleClusterVoteProgressInvalidation('ABC123')).toBe(true);
    expect(scheduleClusterVoteProgressInvalidation('abc123')).toBe(false);

    await vi.advanceTimersByTimeAsync(75);
    const [key, owner] = publisher.set.mock.calls[0]!;
    expect(publisher.set).toHaveBeenCalledExactlyOnceWith(
      'arsnova:session:vote-progress-window:v1:ABC123',
      expect.stringMatching(/^[a-f0-9]{24}$/),
      'PX',
      1_000,
      'NX',
    );
    expect(scheduleClusterVoteProgressInvalidation('ABC123')).toBe(true);
    await vi.advanceTimersByTimeAsync(74);
    expect(publisher.eval).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const [, count, claimedKey, claimedOwner, publishedChannel, payload] =
      publisher.eval.mock.calls[0]!;
    expect([count, claimedKey, claimedOwner]).toEqual([1, key, owner]);
    expect(publishedChannel).toBe(voteProgressChannel);
    expect(payload).toMatch(/^[a-f0-9]{24}:ABC123$/);

    subscriber.emit('message', voteProgressChannel, `${remoteInstanceId}:abc123`);
    expect(voteProgress).not.toHaveBeenCalled();
    subscriber.emit('message', voteProgressChannel, payload);
    expect(voteProgress).toHaveBeenCalledExactlyOnceWith('ABC123');
    expect(status).not.toHaveBeenCalled();
    expect(publisher.set).toHaveBeenCalledTimes(1);
    expect(publisher.eval).toHaveBeenCalledTimes(1);
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('überlässt das aktuelle Fenster der anderen App und kann danach ein neues öffnen', async () => {
    vi.useFakeTimers();
    const handlers = createHandlers();
    startSessionPubSub(handlers);
    publisher.set.mockResolvedValueOnce(null);

    scheduleClusterVoteProgressInvalidation('ABC123');
    await vi.advanceTimersByTimeAsync(150);
    expect(publisher.eval).not.toHaveBeenCalled();
    subscriber.emit('message', voteProgressChannel, `${remoteInstanceId}:ABC123`);
    expect(handlers.voteProgress).toHaveBeenCalledExactlyOnceWith('ABC123');

    scheduleClusterVoteProgressInvalidation('ABC123');
    await vi.advanceTimersByTimeAsync(150);
    expect(publisher.set).toHaveBeenCalledTimes(2);
    expect(publisher.eval).toHaveBeenCalledTimes(1);
  });

  it('bündelt laufende Commits auch nach einer verlorenen Redis-Reservierung', async () => {
    vi.useFakeTimers();
    const handlers = createHandlers();
    startSessionPubSub(handlers);
    publisher.set.mockResolvedValueOnce(null);

    for (let elapsed = 0; elapsed < 145; elapsed += 5) {
      scheduleClusterVoteProgressInvalidation('ABC123');
      await vi.advanceTimersByTimeAsync(5);
    }
    expect(publisher.set).toHaveBeenCalledTimes(1);
    expect(publisher.eval).not.toHaveBeenCalled();

    subscriber.emit('message', voteProgressChannel, `${remoteInstanceId}:ABC123`);
    await vi.advanceTimersByTimeAsync(80);
    expect(handlers.voteProgress).toHaveBeenCalledExactlyOnceWith('ABC123');
    expect(publisher.set).toHaveBeenCalledTimes(2);
    expect(publisher.eval).toHaveBeenCalledTimes(1);
  });

  it('erhält den lokalen Vote-Fallback bei Fehlern und unterbrochenem Subscriber', async () => {
    vi.useFakeTimers();
    const handlers = createHandlers();
    startSessionPubSub(handlers);
    publisher.set.mockRejectedValueOnce(new Error('offline'));

    scheduleClusterVoteProgressInvalidation('ABC123');
    await vi.advanceTimersByTimeAsync(150);
    expect(handlers.voteProgress).toHaveBeenCalledExactlyOnceWith('ABC123');

    subscriber.status = 'reconnecting';
    scheduleClusterVoteProgressInvalidation('ABC123');
    await vi.advanceTimersByTimeAsync(150);
    expect(publisher.eval).toHaveBeenCalledTimes(1);
    expect(handlers.voteProgress).toHaveBeenCalledTimes(2);

    publisher.status = 'reconnecting';
    expect(scheduleClusterVoteProgressInvalidation('ABC123')).toBe(false);
  });

  it('weckt lokal, wenn Redis den Besitz des Fensters nicht mehr bestätigt', async () => {
    vi.useFakeTimers();
    const handlers = createHandlers();
    startSessionPubSub(handlers);
    publisher.eval.mockResolvedValueOnce(0);

    scheduleClusterVoteProgressInvalidation('ABC123');
    await vi.advanceTimersByTimeAsync(150);
    expect(handlers.voteProgress).toHaveBeenCalledExactlyOnceWith('ABC123');
    expect(publisher.eval).toHaveBeenCalledTimes(1);
  });

  it('bündelt Joins und neue Q&A-Fragen pro Session und weckt die passenden lokalen Listener', async () => {
    vi.useFakeTimers();
    const handlers = createHandlers();
    startSessionPubSub(handlers);

    for (let index = 0; index < 10; index++) {
      publishSessionParticipantsInvalidation('ABC123');
      publishQaQuestionsInvalidation(qaSessionId);
    }
    publishSessionParticipantsInvalidation(qaSessionId);
    publishQaQuestionsInvalidation('ABC123');
    await vi.advanceTimersByTimeAsync(50);
    expect(publisher.publish).toHaveBeenCalledExactlyOnceWith(
      participantsChannel,
      expect.stringMatching(/^[a-f0-9]{24}:ABC123$/),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(publisher.publish).toHaveBeenLastCalledWith(
      qaQuestionsChannel,
      expect.stringMatching(new RegExp(`^[a-f0-9]{24}:${qaSessionId}$`)),
    );

    for (const [name, payload] of publisher.publish.mock.calls) {
      subscriber.emit('message', name, payload);
    }
    subscriber.emit('message', participantsChannel, `${remoteInstanceId}:${qaSessionId}`);
    subscriber.emit('message', qaQuestionsChannel, `${remoteInstanceId}:ABC123`);
    expect(handlers.participants).not.toHaveBeenCalled();
    expect(handlers.qaQuestions).not.toHaveBeenCalled();

    subscriber.emit('message', participantsChannel, `${remoteInstanceId}:ABC123`);
    subscriber.emit('message', qaQuestionsChannel, `${remoteInstanceId}:${qaSessionId}`);
    expect(handlers.participants).toHaveBeenCalledExactlyOnceWith('ABC123');
    expect(handlers.qaQuestions).toHaveBeenCalledExactlyOnceWith(qaSessionId);
    expect(handlers.status).not.toHaveBeenCalled();
    expect(handlers.voteProgress).not.toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalledTimes(2);
  });

  it('überspringt Offline-Publish, akzeptiert spätere Signale und trennt beim Shutdown', () => {
    const handlers = createHandlers();
    const { status: receive } = handlers;
    startSessionPubSub(handlers);
    publisher.status = 'reconnecting';
    publishSessionStatusInvalidation('ABC123');
    expect(publisher.publish).not.toHaveBeenCalled();

    publisher.status = 'ready';
    subscriber.emit('message', channel, `${remoteInstanceId}:ABC123`);
    publishSessionStatusInvalidation('ABC123');
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledTimes(1);

    stopSessionPubSub();
    subscriber.emit('message', channel, `${remoteInstanceId}:DEF456`);
    publishSessionStatusInvalidation('DEF456');
    expect(subscriber.disconnect).toHaveBeenCalledTimes(1);
    expect(publisher.disconnect).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('verwirft ausstehende Signale beim Shutdown', async () => {
    vi.useFakeTimers();
    startSessionPubSub(createHandlers());
    publishSessionParticipantsInvalidation('ABC123');
    publishQaQuestionsInvalidation(qaSessionId);
    scheduleClusterVoteProgressInvalidation('ABC123');
    await vi.advanceTimersByTimeAsync(10);
    stopSessionPubSub();
    await vi.advanceTimersByTimeAsync(150);
    expect(vi.getTimerCount()).toBe(0);
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(publisher.eval).not.toHaveBeenCalled();
  });

  it('publiziert moderative Q&A-Invalidierungen sofort und bricht laufendes Debouncing ab', async () => {
    vi.useFakeTimers();
    startSessionPubSub(createHandlers());

    publishQaQuestionsInvalidation(qaSessionId);
    expect(publisher.publish).not.toHaveBeenCalled();

    publishQaQuestionsInvalidation(qaSessionId, { immediate: true });
    expect(publisher.publish).toHaveBeenCalledExactlyOnceWith(
      qaQuestionsChannel,
      expect.stringMatching(new RegExp(`^[a-f0-9]{24}:${qaSessionId}$`)),
    );

    await vi.advanceTimersByTimeAsync(200);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('behandelt abgelehnte Publish-Befehle als flüchtiges Signal', async () => {
    startSessionPubSub(createHandlers());
    publisher.publish.mockRejectedValueOnce(new Error('offline'));
    expect(() => publishSessionStatusInvalidation('ABC123')).not.toThrow();
    await Promise.resolve();
    publishSessionStatusInvalidation('ABC123');
    expect(publisher.publish).toHaveBeenCalledTimes(2);
  });
});
