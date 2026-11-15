import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  experimentConfig,
  faultCommands,
  parseRss,
  evaluateLiveComparison,
} from './experiment.mjs';

test('ungültige Kombinationen werden vor allen Nebenwirkungen abgewiesen', () => {
  for (const input of [
    { variant: 'l1' },
    { consumer: 'label' },
    { variant: 'x' },
    { consumer: 'x' },
    { variant: 'l3', runtimeOff: true },
    { n: 11 },
    { timeoutMs: 1 },
    { live: true, tag: '' },
  ])
    assert.throws(() => experimentConfig(input));
  assert.equal(experimentConfig({ runtimeOff: true }).variant, 'f1');
  assert.equal(
    experimentConfig({ variant: 'l3', tag: 'dev-l3', timeoutMs: 300000 }).fakeDelayMs,
    310000,
  );
  assert.equal(
    experimentConfig({ variant: 'l3', tag: 'dev-l3', timeoutMs: 90000 }).fakeDelayMs,
    130000,
  );
});

test('tc betrifft nur Antworten von Runtime-Port 8080 zum App-Host', () => {
  const p = faultCommands('l1', 'eth0');
  assert.deepEqual(p.apply[0], [
    'sudo',
    'tc',
    'qdisc',
    'add',
    'dev',
    'eth0',
    'root',
    'handle',
    '1b00:',
    'prio',
    'priomap',
    ...Array(16).fill('0'),
  ]);
  assert.ok(p.apply[1].includes('50ms'));
  assert.deepEqual(p.apply[2].slice(-11), [
    'match',
    'ip',
    'dst',
    '192.168.150.10/32',
    'match',
    'ip',
    'sport',
    '8080',
    '0xffff',
    'flowid',
    '1b00:3',
  ]);
  assert.deepEqual(p.undo, [
    ['sudo', 'tc', 'qdisc', 'del', 'dev', 'eth0', 'root', 'handle', '1b00:'],
  ]);
  assert.throws(() => faultCommands('l2', 'eth0; reboot'));
});

test('DROP und seine Rücknahme verwenden dieselbe private Quelle und Ziel-IP', () => {
  const p = faultCommands('f2', 'eth0');
  assert.deepEqual(p.apply, [
    [
      'sudo',
      'ufw',
      'insert',
      '1',
      'deny',
      'proto',
      'tcp',
      'from',
      '192.168.150.10',
      'to',
      '192.168.150.20',
      'port',
      '8080',
      'comment',
      'arsnova-1b-experiment',
    ],
  ]);
  assert.deepEqual(p.undo[0].slice(0, 5), ['sudo', 'ufw', '--force', 'delete', 'deny']);
  assert.deepEqual(p.undo[0].slice(4), p.apply[0].slice(4));
});

test('RSS liest Docker-Prozesslisten mit der erforderlichen PID-Spalte', () => {
  assert.equal(parseRss('PID                 RSS\n6805                251040\n'), 251040 * 1024);
  assert.equal(parseRss(' PID RSS\r\n1 100\r\n2 200\r\n'), 307200);
  assert.equal(parseRss('PID RSS\n1 0\n'), 0);
});

test('fehlende oder beschädigte RSS-Prozessdaten bleiben fehlend', () => {
  for (const text of [
    'PID RSS\n',
    'PID RSS\n1 -1\n',
    'PID RSS\n1 unknown\n',
    'RSS\n100\n',
    'PID RSS\n1 100 extra\n',
    'PID RSS\n0 100\n',
    'PID RSS\n1 9007199254740992\n',
  ])
    assert.equal(parseRss(text), null);
});

function window(p95, failed = 0) {
  return {
    complete: true,
    actions: Object.fromEntries(
      ['join', 'vote', 'qaSubmit', 'blitzlicht'].map((k) => [
        k,
        {
          accountingValid: true,
          planned: 10,
          attempted: 10,
          succeeded: 10 - failed,
          failed,
          pending: 0,
          skipped: 0,
          notAttempted: 0,
          errorRate: failed / 10,
          latency: { available: true, p95Ms: p95, durationSamplesMs: Array(10 - failed).fill(p95) },
        },
      ]),
    ),
  };
}
test('Isolation wird nur bei vergleichbaren vollständigen Live-Fenstern beurteilt', () => {
  const base = { profile: { participants: 500 }, windows: [window(100)] };
  const good = { profile: { participants: 500 }, windows: [window(110)] };
  assert.equal(evaluateLiveComparison(base, good).passed, true);
  assert.equal(evaluateLiveComparison(base, { ...good, windows: [window(111)] }).passed, false);
  assert.equal(evaluateLiveComparison(base, { ...good, windows: [window(100, 1)] }).passed, false);
  assert.equal(evaluateLiveComparison(base, { ...good, windows: [] }).passed, null);
  assert.equal(
    evaluateLiveComparison(base, { ...good, profile: { participants: 30 } }).passed,
    null,
  );
  assert.equal(
    evaluateLiveComparison(base, { ...good, windows: [{ ...window(100), complete: false }] })
      .passed,
    null,
  );
  assert.equal(evaluateLiveComparison({ ...base, windows: [window(100, 1)] }, good).passed, null);
});

test('Vergleichsparameter enthalten nur erlaubte numerische oder boolesche Werte, keine Secrets', async () => {
  const { effectiveSettings } = await import('./experiment.mjs');
  const result = effectiveSettings(
    'OPEN_WEIGHT_LLM_TOKEN=secret\nOPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS=30000\nWORD_CLOUD_SEMANTIC_ENABLED=true\n',
  );
  assert.equal(result.OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS, '30000');
  assert.equal(result.WORD_CLOUD_SEMANTIC_ENABLED, 'true');
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.throws(
    () => effectiveSettings('OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS=secret'),
    /konfiguration/,
  );
});
