import { fork, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { erstelleContainerMetriken } from '../../../../scripts/load/lib/container-metrics.mjs';
import { createArtillery500Session } from '../../../../scripts/load/artillery/setup-session.mjs';
import { fasseLiveMessungenZusammen } from '../../../../scripts/load/lib/artillery-live-messungen.mjs';
import { versuchsUhr } from '../../../../scripts/load/lib/resource-isolation-experiment.mjs';
import { parseRss } from './experiment.mjs';

// Identische Ankunftswelle wie 1A, mit 30 s Reserve für den 300-s-Timeout.
// Dies ist keine durchgehend konstante Konkurrenz von 500 Personen.
export const LIVE_PROFILE = Object.freeze({
  participants: 500,
  durationMs: 330000,
  rampMs: 90000,
  revealAtMs: 270000,
});

export async function runWindow({
  startLive,
  collect,
  task,
  now = () => versuchsUhr.now(),
  waitUntil = (...a) => versuchsUhr.waitUntil(...a),
}) {
  const controller = new AbortController();
  let live, collection, finish, work;
  try {
    live = await startLive();
    collection = collect(live.startAtMs, controller.signal);
    finish = live.finish();
    work = (async () => {
      await waitUntil(live.startAtMs, controller.signal);
      const startedAtMs = now();
      const result = await task(controller.signal);
      return { result, startedAtMs, finishedAtMs: now() };
    })();
    const [resources, window, operation] = await Promise.all([collection, finish, work]);
    return {
      complete: Boolean(
        resources.complete &&
        window.complete &&
        operation.startedAtMs >= live.startAtMs &&
        operation.finishedAtMs <= window.closedAtMs,
      ),
      ...operation,
      resources,
      window,
    };
  } finally {
    controller.abort();
    await live?.stop();
    await Promise.allSettled([collection, finish, work]);
  }
}

export function resourceSummary(rows) {
  const entries = rows.map((row) => row.snapshot?.containers?.[0]);
  const cpu = entries.slice(1).map((e) => e?.delta?.cpuPercent);
  const complete =
    rows.length >= 2 &&
    rows.every(
      (row, i) =>
        Number.isSafeInteger(row.rssBytes) &&
        row.rssBytes >= 0 &&
        entries[i]?.available &&
        entries[i]?.cgroup?.available,
    ) &&
    new Set(entries.map((e) => e?.generation)).size === 1 &&
    cpu.every((c) => c?.available && Number.isFinite(c.value));
  return {
    complete,
    samples: rows.length,
    maxRssBytes:
      rows.length && rows.every((r) => r.rssBytes !== null)
        ? Math.max(...rows.map((r) => r.rssBytes))
        : null,
    maxCpuPercent:
      cpu.length && cpu.every((c) => c?.available) ? Math.max(...cpu.map((c) => c.value)) : null,
    rssSource: 'sum-of-process-rss-kib-docker-top; shared pages may be counted more than once',
    cpuUnit: 'percent-of-one-cpu',
    rows,
  };
}

export async function sampleRss({ signal, run = promisify(execFile) } = {}) {
  try {
    // Docker benötigt PID zur Zuordnung der Hostprozesse zum Container.
    const { stdout } = await run('docker', ['top', 'arsnova-v3-app', '-eo', 'pid,rss'], {
      timeout: 2000,
      signal,
    });
    const rssBytes = parseRss(stdout);
    return { rssBytes, rssError: rssBytes === null ? 'INVALID_OUTPUT' : null };
  } catch (error) {
    return { rssBytes: null, rssError: error.name === 'AbortError' ? 'ABORTED' : 'COMMAND_FAILED' };
  }
}

async function collectResources(startAtMs, signal) {
  const collector = erstelleContainerMetriken({
    containers: [{ alias: 'app', container: 'arsnova-v3-app' }],
    uhr: versuchsUhr,
    startAtMs,
  });
  const rows = [];
  let skipped = 0;
  for (let offset = 0; offset <= LIVE_PROFILE.durationMs; offset += 2000) {
    await versuchsUhr.waitUntil(startAtMs + offset, signal);
    if (versuchsUhr.now() > startAtMs + offset + 2000) {
      skipped++;
      continue;
    }
    const [snapshot, rss] = await Promise.all([
      collector.sample(
        offset === 0 ? 'BEFORE' : offset === LIVE_PROFILE.durationMs ? 'AFTER' : 'DURING',
        signal,
      ),
      sampleRss({ signal }),
    ]);
    rows.push({ snapshot, ...rss });
  }
  const result = resourceSummary(rows);
  return {
    ...result,
    complete:
      result.complete && skipped === 0 && rows.length === LIVE_PROFILE.durationMs / 2000 + 1,
    skipped,
  };
}

async function startLiveWindow(outDir) {
  const dir = await mkdtemp(join(outDir, 'live-private-'));
  let child;
  try {
    const trpcUrl = 'http://127.0.0.1:3000/trpc',
      wsUrl = 'ws://127.0.0.1:3001';
    const session = await createArtillery500Session(trpcUrl);
    await writeFile(join(dir, 'session.json'), JSON.stringify({ ...session, trpcUrl, wsUrl }), {
      mode: 0o600,
    });
    child = fork(
      fileURLToPath(
        new URL('../../../../scripts/load/resource-isolation-live.mjs', import.meta.url),
      ),
      [dir],
      {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { ...process.env, ARTILLERY_SESSION_FILE: join(dir, 'session.json') },
      },
    );
    let lifecycle, windowRuntime, windowClosedAtMs;
    const ended = new Promise((resolve, reject) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
      child.once('error', reject);
    });
    const ready = new Promise((resolve) => child.once('message', resolve));
    child.on('message', (message) => {
      if (message.windowRuntime) {
        windowRuntime = message.windowRuntime;
        windowClosedAtMs = message.windowClosedAtMs;
      }
      if (message.lifecycle) lifecycle = message.lifecycle;
    });
    const timer = new AbortController();
    try {
      await Promise.race([
        ready,
        ended.then(() => {
          throw new Error('Live-Prozess vorzeitig beendet.');
        }),
        wait(15000, undefined, { signal: timer.signal }).then(() => {
          throw new Error('Live-Prozess nicht bereit.');
        }),
      ]);
    } finally {
      timer.abort();
    }
    const startAtMs = versuchsUhr.now() + 1000;
    child.send({ ...LIVE_PROFILE, startAtMs });
    return {
      startAtMs,
      async finish() {
        const timer = new AbortController();
        let exit;
        try {
          exit = await Promise.race([
            ended,
            wait(LIVE_PROFILE.durationMs + 20000, undefined, { signal: timer.signal }).then(() => {
              throw new Error('Live-Auslauf überschritten.');
            }),
          ]);
        } finally {
          timer.abort();
        }
        const actions = fasseLiveMessungenZusammen(windowRuntime ?? {}, LIVE_PROFILE);
        return {
          complete:
            exit.code === 0 &&
            Boolean(windowRuntime) &&
            lifecycle?.reveal?.succeeded === true &&
            !lifecycle?.interrupted &&
            Object.values(actions).every(
              (a) =>
                a.accountingValid &&
                a.pending === 0 &&
                a.notAttempted === 0 &&
                a.skipped === 0 &&
                a.attempted === a.planned,
            ),
          closedAtMs: startAtMs + (windowClosedAtMs ?? 0),
          actions,
          lifecycle,
        };
      },
      async stop() {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM');
          await Promise.race([ended, wait(2000)]);
          if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
            await ended;
          }
        }
        await rm(dir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    child?.kill('SIGKILL');
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

export async function measureOperation(task, outDir) {
  return runWindow({ startLive: () => startLiveWindow(outDir), collect: collectResources, task });
}
