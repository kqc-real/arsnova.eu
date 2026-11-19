/** Eigenständiger Relay für das Zwei-App-Staging. */
import './load-env';
import { beginRedisShutdown, closeRedis, getRedis } from './redis';
import { logger } from './lib/logger';
import { resolveYjsRelayConfig, YjsRelayServer } from './lib/yjsRelay';
import {
  acknowledgeYjsRelayRotation,
  assertYjsShareTokenSecretConfigured,
  getYjsShareLegacyUuidCutoffAt,
  parseYjsShareRotationEvent,
  YJS_SHARE_ROTATION_CHANNEL,
} from './lib/yjsShareToken';

assertYjsShareTokenSecretConfigured();
getYjsShareLegacyUuidCutoffAt();

const redis = getRedis();
const subscriber = redis.duplicate({
  autoResubscribe: false,
  enableOfflineQueue: false,
  commandTimeout: 2_000,
});
let subscribed = false;
let subscriptionEpoch = 0;
let shuttingDown = false;

const config = resolveYjsRelayConfig();
const relay = new YjsRelayServer(
  config,
  () => !shuttingDown && subscribed && redis.status === 'ready',
);

subscriber.on('ready', () => {
  const epoch = ++subscriptionEpoch;
  void subscriber.subscribe(YJS_SHARE_ROTATION_CHANNEL).then(
    () => {
      if (epoch === subscriptionEpoch && subscriber.status === 'ready') subscribed = true;
    },
    () => {
      if (!shuttingDown && epoch === subscriptionEpoch) subscriber.disconnect(true);
    },
  );
});
subscriber.on('error', () => {
  // Die Readiness und geschlossene Sockets signalisieren den Ausfall.
});
subscriber.on('close', () => {
  subscribed = false;
  subscriptionEpoch += 1;
  relay.invalidateConnections();
});
subscriber.on('message', (channel, message) => {
  if (channel !== YJS_SHARE_ROTATION_CHANNEL || shuttingDown) return;
  const event = parseYjsShareRotationEvent(message);
  if (!event) return;
  void relay
    .applyShareRotation(event)
    .then(() => acknowledgeYjsRelayRotation(event))
    .catch(() => {
      logger.warn('Yjs-Relay konnte eine Rotation vorübergehend nicht bestätigen.');
    });
});

relay.listen(() => logger.info('Dedizierter Yjs-Relay gestartet.'));

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  subscriber.disconnect();
  await relay.close();
  beginRedisShutdown();
  await closeRedis();
}

function stop(): void {
  void shutdown().catch(() => {
    logger.error('Shutdown des Yjs-Relays fehlgeschlagen.');
    process.exitCode = 1;
  });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
