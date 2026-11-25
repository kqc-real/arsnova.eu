import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWindow, resourceSummary, sampleRss } from './messfenster.mjs';

test('Auftrag startet erst im bereiten Live-Fenster; frühes Fensterende ist ungültig', async () => {
  const events = [];
  const r = await runWindow({
    startLive: async () => {
      events.push('ready');
      return {
        startAtMs: 0,
        finish: async () => ({ complete: true, closedAtMs: 20 }),
        stop: async () => events.push('stop'),
      };
    },
    collect: async () => ({ complete: true }),
    task: async () => {
      events.push('task');
      return { status: 'ready' };
    },
    waitUntil: async () => {},
    now: (() => {
      let t = 0;
      return () => (t += 15);
    })(),
  });
  assert.deepEqual(events, ['ready', 'task', 'stop']);
  assert.equal(r.complete, false);
});
test('Auftragsfehler räumt Live-Prozess auf und bleibt als Fehler erhalten', async () => {
  let stopped = false;
  await assert.rejects(
    runWindow({
      startLive: async () => ({
        startAtMs: 0,
        finish: async () => ({ complete: true, closedAtMs: 999 }),
        stop: async () => {
          stopped = true;
        },
      }),
      collect: async () => ({ complete: true }),
      task: async () => {
        throw new Error('task failed');
      },
      waitUntil: async () => {},
      now: () => 0,
    }),
    /task failed/,
  );
  assert.equal(stopped, true);
});
test('Ressourcenlücken und wechselnde Generation verhindern Vollständigkeit', () => {
  const row = (generation, rss = 1024) => ({
    rssBytes: rss,
    snapshot: {
      containers: [
        {
          available: true,
          generation,
          cgroup: { available: true },
          delta: { cpuPercent: { available: true, value: 50 } },
        },
      ],
    },
  });
  const good = resourceSummary([row(1), row(1)]);
  assert.equal(good.complete, true);
  assert.equal(good.maxRssBytes, 1024);
  assert.equal(resourceSummary([row(1), row(1, null)]).complete, false);
  assert.equal(resourceSummary([row(1), row(2)]).complete, false);
  assert.equal(resourceSummary([]).complete, false);
});

test('RSS-Sampler übergibt PID/RSS an Docker und übernimmt gültige Werte', async () => {
  const signal = new AbortController().signal;
  const result = await sampleRss({
    signal,
    run: async (command, args, options) => {
      assert.equal(command, 'docker');
      assert.deepEqual(args, ['top', 'arsnova-v3-app', '-eo', 'pid,rss']);
      assert.equal(options.signal, signal);
      assert.equal(options.timeout, 2000);
      return { stdout: 'PID RSS\n42 100\n43 200\n' };
    },
  });
  assert.deepEqual(result, { rssBytes: 307200, rssError: null });
});

test('RSS-Sampler macht Befehlsfehler und ungültige Ausgabe im Ergebnis sichtbar', async () => {
  assert.deepEqual(
    await sampleRss({
      run: async () => {
        throw new Error('synthetic failure');
      },
    }),
    { rssBytes: null, rssError: 'COMMAND_FAILED' },
  );
  assert.deepEqual(await sampleRss({ run: async () => ({ stdout: 'invalid' }) }), {
    rssBytes: null,
    rssError: 'INVALID_OUTPUT',
  });
  assert.deepEqual(
    await sampleRss({
      run: async () => {
        throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
      },
    }),
    { rssBytes: null, rssError: 'ABORTED' },
  );
});
