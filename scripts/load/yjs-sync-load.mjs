#!/usr/bin/env node
/**
 * Mehrclient-Lasttest fuer den Quiz-Bibliotheks-Sync via Yjs/y-websocket.
 *
 * Der produktive Client verwendet die Basis-URL plus den Raum
 * `quiz-library-room-<UUID>`. Der Raumname ist zugleich das Bearer-Secret; der
 * bestehende Relay erwartet keine zusaetzlichen Auth-Header oder Query-Parameter.
 *
 * Beispiele:
 *   node scripts/load/yjs-sync-load.mjs
 *   CLIENTS=100 UPDATE_CONCURRENCY=25 node scripts/load/yjs-sync-load.mjs
 *   YJS_WS_URL=wss://example.org/yjs-ws REPORT_FILE=reports/yjs.json node scripts/load/yjs-sync-load.mjs
 */
import { randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import process from 'node:process';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { writeScenarioReport } from './lib/reporting.mjs';

const EXIT_OK = 0;
const EXIT_TEST_FAILED = 1;
const EXIT_CONFIGURATION = 2;
const DEFAULT_YJS_WS_URL = 'ws://127.0.0.1:3002';
const ROOM_PREFIX = 'quiz-library-room-';
const ROOT_KEY = 'quiz-library';
const QUIZZES_KEY = 'quizzes';

const HELP = `Yjs/y-websocket Mehrclient-Lasttest

Aufruf:
  node scripts/load/yjs-sync-load.mjs

Konfiguration:
  YJS_WS_URL             Relay-Basis-URL (Default: ${DEFAULT_YJS_WS_URL})
  CLIENTS                Anzahl paralleler Clients (Default: 30; z. B. 100)
  UPDATE_CONCURRENCY     Gleichzeitige Update-Worker (Default: 15)
  CONNECT_P95_LIMIT_MS   Obergrenze fuer Connect-p95 (Default: 3000)
  SYNC_P95_LIMIT_MS      Obergrenze fuer Sync-p95 (Default: 5000)
  REPORT_FILE            Optionaler Pfad fuer einen atomar geschriebenen JSON-Report

Optionale Teststeuerung:
  ROOM_ID                UUID fuer einen expliziten, neuen Testraum
  RECONNECT_PERCENT      Anteil reconnectender Clients (Default: 20)
  PHASE_TIMEOUT_MS       Timeout je Konvergenzphase (Default: 15000)

Exitcodes:
  0  Test bestanden / Hilfe
  1  Lasttest oder Schwellwert fehlgeschlagen
  2  Konfiguration oder Ausfuehrung ungueltig
`;

function hasHelpFlag() {
  return process.argv.slice(2).some((argument) => argument === '--help' || argument === '-h');
}

function readPositiveInteger(name, fallback) {
  const raw = String(process.env[name] ?? fallback).trim();
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) {
    throw new ConfigurationError(`${name} muss eine positive ganze Zahl sein (erhalten: ${raw}).`);
  }
  return Number(raw);
}

function readPercent(name, fallback) {
  const raw = String(process.env[name] ?? fallback).trim();
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new ConfigurationError(`${name} muss groesser 0 und hoechstens 100 sein.`);
  }
  return value;
}

function readConfig() {
  const yjsWsUrl = String(process.env.YJS_WS_URL || DEFAULT_YJS_WS_URL)
    .trim()
    .replace(/\/+$/, '');
  let parsedUrl;
  try {
    parsedUrl = new URL(yjsWsUrl);
  } catch {
    throw new ConfigurationError(`YJS_WS_URL ist keine gueltige URL: ${yjsWsUrl}`);
  }
  if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
    throw new ConfigurationError('YJS_WS_URL muss das Protokoll ws: oder wss: verwenden.');
  }

  const roomId = String(process.env.ROOM_ID || randomUUID()).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) {
    throw new ConfigurationError('ROOM_ID muss eine UUID sein.');
  }

  const clients = readPositiveInteger('CLIENTS', 30);
  return {
    yjsWsUrl,
    clients,
    updateConcurrency: Math.min(clients, readPositiveInteger('UPDATE_CONCURRENCY', 15)),
    connectP95LimitMs: readPositiveInteger('CONNECT_P95_LIMIT_MS', 3_000),
    syncP95LimitMs: readPositiveInteger('SYNC_P95_LIMIT_MS', 5_000),
    phaseTimeoutMs: readPositiveInteger('PHASE_TIMEOUT_MS', 15_000),
    reconnectPercent: readPercent('RECONNECT_PERCENT', 20),
    reportFile: String(process.env.REPORT_FILE || '').trim() || null,
    roomId,
    room: `${ROOM_PREFIX}${roomId}`,
  };
}

class ConfigurationError extends Error {}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function percentile(values, percentage) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentage / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function metrics(values) {
  const rounded = values.map((value) => Math.round(value));
  return {
    samples: rounded.length,
    p50Ms: percentile(rounded, 50),
    p95Ms: percentile(rounded, 95),
    maxMs: rounded.length > 0 ? Math.max(...rounded) : null,
  };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
      await sleep(0);
    }
  });
  await Promise.all(workers);
  return results;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalStateVector(doc) {
  const entries = [...Y.decodeStateVector(Y.encodeStateVector(doc)).entries()].sort(
    ([leftClientId], [rightClientId]) => leftClientId - rightClientId,
  );
  return sha256(JSON.stringify(entries));
}

function docFingerprint(doc) {
  return {
    stateVectorSha256: canonicalStateVector(doc),
    snapshot: doc.getMap(ROOT_KEY).toJSON(),
  };
}

function createClient(index, config) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(config.yjsWsUrl, config.room, doc, {
    WebSocketPolyfill: WebSocket,
    connect: false,
  });
  const client = {
    index,
    doc,
    provider,
    intentionalDisconnect: false,
    errors: [],
  };
  provider.on('connection-error', (error) => {
    client.errors.push(error instanceof Error ? error.message : String(error));
  });
  provider.on('connection-close', (event) => {
    if (!client.intentionalDisconnect && event?.code !== 1000) {
      client.errors.push(
        `Unerwarteter Verbindungsabbruch (Code ${String(event?.code ?? 'unbekannt')})`,
      );
    }
  });
  return client;
}

function connectAndSync(client, waveStartedAt, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    let connectMs = null;
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Client ${client.index + 1} erreichte Connect und Sync nicht innerhalb von ${timeoutMs} ms.`,
        ),
      );
    }, timeoutMs);

    const onStatus = ({ status }) => {
      if (status === 'connected' && connectMs === null) {
        connectMs = performance.now() - waveStartedAt;
      }
    };
    const onSync = (isSynced) => {
      if (!isSynced) return;
      const syncMs = performance.now() - waveStartedAt;
      cleanup();
      resolvePromise({ connectMs: connectMs ?? syncMs, syncMs });
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.provider.off('status', onStatus);
      client.provider.off('sync', onSync);
    };

    client.intentionalDisconnect = false;
    client.provider.on('status', onStatus);
    client.provider.on('sync', onSync);
    client.provider.connect();
  });
}

async function settleConnectionWave(clients, waveStartedAt, timeoutMs) {
  const settled = await Promise.allSettled(
    clients.map((client) => connectAndSync(client, waveStartedAt, timeoutMs)),
  );
  return {
    results: settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value),
    failures: settled
      .filter((result) => result.status === 'rejected')
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      ),
  };
}

async function waitForConvergence(clients, timeoutMs, label) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const fingerprints = clients.map(({ doc }) => docFingerprint(doc));
    const vectors = new Set(fingerprints.map(({ stateVectorSha256 }) => stateVectorSha256));
    const snapshots = new Set(fingerprints.map(({ snapshot }) => canonicalJson(snapshot)));
    if (vectors.size === 1 && snapshots.size === 1) {
      return {
        latencyMs: Math.round(performance.now() - startedAt),
        stateVectorSha256: fingerprints[0].stateVectorSha256,
        snapshot: fingerprints[0].snapshot,
      };
    }
    await sleep(25);
  }
  throw new Error(`${label}: Docs konvergierten nicht innerhalb von ${timeoutMs} ms.`);
}

function applyConflictFreeUpdate(client, phase, runId) {
  const root = client.doc.getMap(ROOT_KEY);
  root.set(`load-${phase}-client-${client.index}`, {
    client: client.index,
    phase,
    runId,
    payload: `quiz-snapshot-${client.index}-${'x'.repeat(128)}`,
  });
}

function applyConflictingUpdate(client, phase, runId) {
  const root = client.doc.getMap(ROOT_KEY);
  root.set(
    QUIZZES_KEY,
    JSON.stringify([
      {
        id: `load-${runId}`,
        name: `${phase} writer ${client.index}`,
        description: 'Yjs sync load conflict',
        updatedAt: new Date().toISOString(),
        updatedByDeviceId: `load-client-${client.index}`,
        questions: [],
      },
    ]),
  );
}

async function runUpdateWave(clients, concurrency, phase, runId) {
  await mapLimit(clients, concurrency, async (client) => {
    client.doc.transact(() => applyConflictFreeUpdate(client, phase, runId), `${phase}-unique`);
  });
  await mapLimit(clients, concurrency, async (client) => {
    client.doc.transact(() => applyConflictingUpdate(client, phase, runId), `${phase}-conflict`);
  });
}

function validateSnapshot(snapshot, clients, reconnectingClients) {
  const failures = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return ['Konvergierter Snapshot fehlt.'];
  }
  for (const client of clients) {
    if (!snapshot[`load-initial-client-${client.index}`]) {
      failures.push(`Konfliktfreies Initial-Update von Client ${client.index + 1} fehlt.`);
    }
  }
  for (const client of reconnectingClients) {
    if (!snapshot[`load-offline-client-${client.index}`]) {
      failures.push(`Offline-Update von Client ${client.index + 1} fehlt.`);
    }
  }
  try {
    const quizzes = JSON.parse(snapshot[QUIZZES_KEY]);
    if (!Array.isArray(quizzes) || quizzes.length !== 1) {
      failures.push('Konfliktbehafteter Quiz-Snapshot ist ungueltig.');
    }
  } catch {
    failures.push('Konfliktbehafteter Quiz-Snapshot fehlt oder ist kein JSON.');
  }
  return failures;
}

function printSummary(report) {
  const format = (entry) =>
    `p50=${entry.p50Ms ?? '-'} ms, p95=${entry.p95Ms ?? '-'} ms, max=${entry.maxMs ?? '-'} ms`;
  console.log(`\nYjs Sync Load — ${report.status.toUpperCase()}`);
  console.log(`Relay: ${report.config.yjsWsUrl}`);
  console.log(`Raum: ${report.config.room}`);
  console.log(`Clients: ${report.config.clients} (${report.reconnect.clients} reconnectet)`);
  console.log(`Initial Connect: ${format(report.initial.connect)}`);
  console.log(`Initial Sync:    ${format(report.initial.sync)}`);
  console.log(`Reconnect:       ${format(report.reconnect.connect)}`);
  console.log(`Resync:          ${format(report.reconnect.sync)}`);
  console.log(
    `Konvergenz: initial ${report.initial.convergenceMs} ms, reconnect ${report.reconnect.convergenceMs} ms`,
  );
  console.log(`Fehler: ${report.errorCount}`);
  for (const failure of report.failures) console.error(`- ${failure}`);
}

async function execute(config) {
  const startedAt = new Date();
  const runId = randomUUID();
  process.setMaxListeners(Math.max(process.getMaxListeners(), config.clients + 10));
  const clients = Array.from({ length: config.clients }, (_, index) => createClient(index, config));
  const failures = [];
  let initialResults = [];
  let reconnectResults = [];
  let initialConvergence = null;
  let reconnectConvergence = null;
  const reconnectCount = Math.max(1, Math.ceil((config.clients * config.reconnectPercent) / 100));
  const reconnectingClients = clients
    .filter((_, index) => index % Math.ceil(config.clients / reconnectCount) === 0)
    .slice(0, reconnectCount);

  try {
    console.log(
      `Verbinde ${config.clients} Clients parallel mit ${config.yjsWsUrl}/${config.room} …`,
    );
    const initialStartedAt = performance.now();
    const initialWave = await settleConnectionWave(
      clients,
      initialStartedAt,
      Math.max(config.phaseTimeoutMs, config.syncP95LimitMs * 2),
    );
    initialResults = initialWave.results;
    failures.push(...initialWave.failures);

    if (initialWave.failures.length === 0) {
      console.log('Fuehre konfliktfreie und konfliktbehaftete Updates aus …');
      await runUpdateWave(clients, config.updateConcurrency, 'initial', runId);
      initialConvergence = await waitForConvergence(
        clients,
        config.phaseTimeoutMs,
        'Initiale Update-Welle',
      );

      console.log(`Trenne und reconnecte ${reconnectingClients.length} Clients …`);
      for (const client of reconnectingClients) {
        client.intentionalDisconnect = true;
        client.provider.disconnect();
      }
      await sleep(250);
      await runUpdateWave(reconnectingClients, config.updateConcurrency, 'offline', runId);
      const onlineClients = clients.filter((client) => !reconnectingClients.includes(client));
      if (onlineClients.length > 0) {
        await runUpdateWave(onlineClients, config.updateConcurrency, 'online', runId);
      }

      const reconnectStartedAt = performance.now();
      const reconnectWave = await settleConnectionWave(
        reconnectingClients,
        reconnectStartedAt,
        Math.max(config.phaseTimeoutMs, config.syncP95LimitMs * 2),
      );
      reconnectResults = reconnectWave.results;
      failures.push(...reconnectWave.failures);
      if (reconnectWave.failures.length === 0) {
        reconnectConvergence = await waitForConvergence(
          clients,
          config.phaseTimeoutMs,
          'Reconnect-Update-Welle',
        );
        failures.push(
          ...validateSnapshot(reconnectConvergence.snapshot, clients, reconnectingClients),
        );
      }
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    for (const client of clients) {
      client.intentionalDisconnect = true;
      client.provider.destroy();
      client.doc.destroy();
    }
  }

  const initialConnect = metrics(initialResults.map(({ connectMs }) => connectMs));
  const initialSync = metrics(initialResults.map(({ syncMs }) => syncMs));
  const reconnectConnect = metrics(reconnectResults.map(({ connectMs }) => connectMs));
  const reconnectSync = metrics(reconnectResults.map(({ syncMs }) => syncMs));
  const providerErrors = clients.flatMap((client) =>
    client.errors.map((message) => `Client ${client.index + 1}: ${message}`),
  );
  failures.push(...providerErrors);
  if (initialConnect.samples !== config.clients) {
    failures.push(`Nur ${initialConnect.samples}/${config.clients} Clients initial verbunden.`);
  }
  if (initialConnect.p95Ms === null || initialConnect.p95Ms > config.connectP95LimitMs) {
    failures.push(
      `Initial Connect-p95 ${initialConnect.p95Ms ?? 'fehlt'} ms ueberschreitet ${config.connectP95LimitMs} ms.`,
    );
  }
  if (initialSync.p95Ms === null || initialSync.p95Ms > config.syncP95LimitMs) {
    failures.push(
      `Initial Sync-p95 ${initialSync.p95Ms ?? 'fehlt'} ms ueberschreitet ${config.syncP95LimitMs} ms.`,
    );
  }
  if (reconnectConnect.samples !== reconnectingClients.length) {
    failures.push(
      `Nur ${reconnectConnect.samples}/${reconnectingClients.length} Clients reconnectet.`,
    );
  }
  if (reconnectConnect.p95Ms === null || reconnectConnect.p95Ms > config.connectP95LimitMs) {
    failures.push(
      `Reconnect-p95 ${reconnectConnect.p95Ms ?? 'fehlt'} ms ueberschreitet ${config.connectP95LimitMs} ms.`,
    );
  }
  if (reconnectSync.p95Ms === null || reconnectSync.p95Ms > config.syncP95LimitMs) {
    failures.push(
      `Resync-p95 ${reconnectSync.p95Ms ?? 'fehlt'} ms ueberschreitet ${config.syncP95LimitMs} ms.`,
    );
  }

  return {
    schemaVersion: 1,
    scenario: 'yjs-sync-load',
    status: failures.length === 0 ? 'passed' : 'failed',
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    config: {
      yjsWsUrl: config.yjsWsUrl,
      room: config.room,
      clients: config.clients,
      updateConcurrency: config.updateConcurrency,
      connectP95LimitMs: config.connectP95LimitMs,
      syncP95LimitMs: config.syncP95LimitMs,
    },
    initial: {
      connect: initialConnect,
      sync: initialSync,
      convergenceMs: initialConvergence?.latencyMs ?? null,
      stateVectorSha256: initialConvergence?.stateVectorSha256 ?? null,
    },
    reconnect: {
      clients: reconnectingClients.length,
      connect: reconnectConnect,
      sync: reconnectSync,
      convergenceMs: reconnectConvergence?.latencyMs ?? null,
      stateVectorSha256: reconnectConvergence?.stateVectorSha256 ?? null,
    },
    errorCount: failures.length,
    failures,
  };
}

async function main() {
  if (hasHelpFlag()) {
    console.log(HELP);
    return EXIT_OK;
  }
  if (process.argv.length > 2) {
    throw new ConfigurationError(`Unbekannte Argumente: ${process.argv.slice(2).join(' ')}`);
  }

  const config = readConfig();
  const report = await execute(config);
  printSummary(report);
  if (config.reportFile) {
    await writeScenarioReport({
      filePath: config.reportFile,
      scenario: report.scenario,
      environment: report.config,
      metrics: {
        durationMs: report.durationMs,
        initial: report.initial,
        reconnect: report.reconnect,
        errorCount: report.errorCount,
      },
      failures: report.failures,
    });
    console.log(`JSON-Report atomar geschrieben: ${resolve(config.reportFile)}`);
  }
  return report.status === 'passed' ? EXIT_OK : EXIT_TEST_FAILED;
}

try {
  process.exitCode = await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FEHLER: ${message}`);
  process.exitCode = EXIT_CONFIGURATION;
}
