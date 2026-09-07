import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  createPairedHostInvalidationHub,
  PAIRED_HOST_INVALIDATION_CHANNEL,
  parsePairedHostInvalidationMessage,
} from './hostPairingInvalidation';

describe('hostPairingInvalidation', () => {
  it('verteilt einen Widerruf über Pub/Sub an eine zweite Replica', async () => {
    const bus = new EventEmitter();
    const replicaA = createPairedHostInvalidationHub({
      publish(channel, message) {
        bus.emit(channel, message);
      },
    });
    const replicaB = createPairedHostInvalidationHub({
      publish() {
        throw new Error('Replica B darf nicht selbst publishen');
      },
      ensureSubscribe(onMessage) {
        bus.on(PAIRED_HOST_INVALIDATION_CHANNEL, onMessage);
      },
    });

    let replicaBNotified = false;
    replicaB.subscribe('abc123', 'hash-1', () => {
      replicaBNotified = true;
    });

    replicaA.notify('ABC123', 'hash-1');
    await Promise.resolve();

    expect(replicaBNotified).toBe(true);
  });

  it('weckt Waiter derselben Replica sofort und veröffentlicht die Nachricht', () => {
    const published: string[] = [];
    const hub = createPairedHostInvalidationHub({
      publish(_channel, message) {
        published.push(message);
      },
    });
    let local = false;
    hub.subscribe('ABC123', 'hash-2', () => {
      local = true;
    });
    hub.notify('ABC123', 'hash-2');
    expect(local).toBe(true);
    expect(parsePairedHostInvalidationMessage(published[0]!)).toEqual({
      sessionCode: 'ABC123',
      tokenHash: 'hash-2',
    });
  });
});
