#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setMaxListeners } from 'node:events';
import { monotoneUhr } from './lib/host-analyze-loop.mjs';
import { istDirekterAufruf } from './lib/resource-isolation-experiment.mjs';

/** Ein Prozess je Phase erhält die globale Teilnehmernummerierung des vorhandenen Prozessors. */
export async function fuehreLivePhaseAus({
  participants,
  rampMs,
  durationMs,
  revealAtMs,
  startAtMs,
  aktionen,
  reveal,
  signal = new AbortController().signal,
  thinkMs = [1000, 500, 3000],
  onWindowEnd = () => {},
  uhr = monotoneUhr,
}) {
  if (
    !Number.isInteger(participants) ||
    participants < 1 ||
    participants > 500 ||
    !(rampMs > 0 && rampMs < revealAtMs && revealAtMs < durationMs)
  )
    throw new Error('Ungültiges Live-Lastprofil.');
  const ende = startAtMs + durationMs;
  const steuerung = new AbortController();
  const phasensignal = AbortSignal.any([signal, steuerung.signal]);
  setMaxListeners(participants + 10, phasensignal);
  const report = {
    startedScenarios: 0,
    completedScenarios: 0,
    failedScenarios: 0,
    interrupted: false,
    arrivals: [],
    maxActiveWebSocketConnections: 0,
    activeWebSocketConnectionsAtEnd: 0,
    webSocketTimeline: [],
    reveal: { scheduledAtMs: revealAtMs, startedAtMs: null, succeeded: false },
  };
  const freigabe = (async () => {
    try {
      await uhr.waitUntil(startAtMs + revealAtMs, phasensignal);
      report.reveal.startedAtMs = uhr.now() - startAtMs;
      await reveal();
      report.reveal.succeeded = true;
    } catch {
      /* Fehler bleibt im Bericht; keine vorgezogene Ersatzfreigabe. */
    }
  })();
  const aufgaben = Array.from({ length: participants }, (_, index) =>
    (async () => {
      let verbunden = false;
      const events = {
        emit(_type, name) {
          const vorher = verbunden;
          if (name === 'custom.ws_connected') verbunden = true;
          if (name === 'custom.ws_disconnected') verbunden = false;
          if (vorher === verbunden) return;
          report.activeWebSocketConnectionsAtEnd += verbunden ? 1 : -1;
          report.maxActiveWebSocketConnections = Math.max(
            report.maxActiveWebSocketConnections,
            report.activeWebSocketConnectionsAtEnd,
          );
          report.webSocketTimeline.push({
            atMs: uhr.now() - startAtMs,
            active: report.activeWebSocketConnectionsAtEnd,
          });
        },
      };
      const user = { vars: { index } };
      let gestartet = false;
      const aktion = async (name) => {
        phasensignal.throwIfAborted();
        if (uhr.now() >= ende) throw new Error('Messfenster beendet.');
        await aktionen[name](user, events);
      };
      const denken = async (ms) => uhr.waitUntil(uhr.now() + ms, phasensignal);
      try {
        const geplant = Math.floor((index * rampMs) / participants);
        await uhr.waitUntil(startAtMs + geplant, phasensignal);
        if (uhr.now() >= Math.min(ende, startAtMs + geplant + rampMs / participants)) return;
        gestartet = true;
        report.startedScenarios++;
        report.arrivals.push({ scheduledAtMs: geplant, startedAtMs: uhr.now() - startAtMs });
        await aktion('joinSession');
        await aktion('connectParticipantStatusWs');
        await denken(thinkMs[0]);
        await aktion('pollSessionInfo');
        await aktion('fetchCurrentQuestion');
        await denken(thinkMs[1]);
        await aktion('submitVote');
        await aktion('maybeSubmitQa');
        await aktion('submitBlitzlicht');
        await freigabe;
        if (!report.reveal.succeeded) throw new Error('Keine Ergebnisfreigabe.');
        await aktion('fetchResultsQuestion');
        await denken(thinkMs[2]);
        report.completedScenarios++;
      } catch {
        if (gestartet) report.failedScenarios++;
      } finally {
        if (gestartet) await aktionen.disconnectParticipantStatusWs(user, events);
      }
    })(),
  );
  try {
    await uhr.waitUntil(ende, signal);
  } catch {
    report.interrupted = true;
  }
  try {
    await onWindowEnd();
  } finally {
    steuerung.abort();
  }
  await Promise.allSettled([...aufgaben, freigabe]);
  return report;
}

if (await istDirekterAufruf(new URL(import.meta.url))) {
  const ordner = process.argv[2];
  if (!ordner || !process.send) process.exit(1);
  process.env.ARTILLERY_SESSION_FILE = join(ordner, 'session.json');
  process.env.ARTILLERY_STATE_FILE = join(ordner, 'runtime.json');
  process.env.ARTILLERY_RESULTS_READY_FILE = join(ordner, 'results-ready');
  process.env.ARTILLERY_REVEAL_TIMESTAMP_FILE = join(ordner, 'reveal-at');
  process.env.ARTILLERY_SKIP_VOTES = '0';
  const session = JSON.parse(await readFile(process.env.ARTILLERY_SESSION_FILE, 'utf8'));
  const aktionen = await import('./artillery/processor.mjs');
  const { startHostMonitor } = await import('./artillery/host-monitor.mjs');
  const { versuchsUhr } = await import('./lib/resource-isolation-experiment.mjs');
  const abbruch = new AbortController();
  process.on('SIGTERM', () => abbruch.abort());
  process.on('SIGINT', () => abbruch.abort());
  const monitor = startHostMonitor({
    ...session,
    onRevealStarted: (zeit) => {
      writeFileSync(process.env.ARTILLERY_REVEAL_TIMESTAMP_FILE, String(zeit));
    },
  });
  process.once('message', async (profil) => {
    try {
      const lifecycle = await fuehreLivePhaseAus({
        ...profil,
        aktionen,
        signal: abbruch.signal,
        uhr: versuchsUhr,
        onWindowEnd: () =>
          process.send({
            windowRuntime: aktionen.snapshotRuntimeState(),
            windowClosedAtMs: versuchsUhr.now() - profil.startAtMs,
          }),
        reveal: async () => {
          await monitor.revealResultsOnce();
          await writeFile(process.env.ARTILLERY_RESULTS_READY_FILE, '1');
        },
      });
      process.send({ lifecycle, host: monitor.state });
    } catch {
      process.send({ errorCode: 'LIVE_FAILED' });
    } finally {
      monitor.stop();
      process.disconnect();
    }
  });
  process.send({ ready: true });
}
