import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { fasseLaufzeitenZusammen } from '../../../../scripts/load/lib/artillery-live-messungen.mjs';

export function effectiveSettings(text) {
  const keys = [
    'QA_SUMMARY_ENABLED',
    'QA_SUMMARY_TIMEOUT_MS',
    'OPEN_WEIGHT_LLM_ENABLED',
    'OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS',
    'OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS',
    'WORD_CLOUD_SEMANTIC_ENABLED',
    'WORD_CLOUD_ENCODER_TIMEOUT_MS',
    'NLP_ENABLED',
    'QA_NLP_ENABLED',
  ];
  return Object.fromEntries(
    keys.map((key) => {
      const value = text.match(new RegExp('^' + key + '=([^\\r\\n]*)$', 'm'))?.[1]?.trim() ?? null;
      if (value !== null && !/^(true|false|[0-9]+)$/.test(value))
        throw new Error('Ungültige Vergleichskonfiguration.');
      return [key, value];
    }),
  );
}

export function experimentConfig({
  variant = 'normal',
  consumer = 'summary',
  n = 10,
  timeoutMs = 300000,
  runtimeOff = false,
  live = false,
  tag = '',
} = {}) {
  if (
    !['normal', 'l1', 'l2', 'l3', 'f1', 'f2', 'busy', 'race'].includes(variant) ||
    !['summary', 'label', 'breaker-summary'].includes(consumer) ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > 10 ||
    ![90000, 300000].includes(timeoutMs) ||
    typeof live !== 'boolean' ||
    typeof runtimeOff !== 'boolean' ||
    !/^[a-z0-9-]*$/.test(tag) ||
    ((live || variant !== 'normal' || consumer !== 'summary') && !tag) ||
    (live && consumer === 'breaker-summary') ||
    (runtimeOff && !['normal', 'f1'].includes(variant))
  )
    throw new Error('Ungültige Experimentkonfiguration.');
  return {
    variant: runtimeOff ? 'f1' : variant,
    consumer,
    n,
    timeoutMs,
    live,
    tag,
    fakeDelayMs: Math.max(timeoutMs, 120000) + 10000,
  };
}

export function faultCommands(variant, iface, { f2InterfaceScoped = true } = {}) {
  if (!/^[a-zA-Z0-9_.-]{1,15}$/.test(iface)) throw new Error('Ungültige Schnittstelle.');
  if (['l1', 'l2'].includes(variant))
    return {
      apply: [
        [
          'sudo',
          'tc',
          'qdisc',
          'add',
          'dev',
          iface,
          'root',
          'handle',
          '1b00:',
          'prio',
          'priomap',
          ...Array(16).fill('0'),
        ],
        [
          'sudo',
          'tc',
          'qdisc',
          'add',
          'dev',
          iface,
          'parent',
          '1b00:3',
          'handle',
          '1b30:',
          'netem',
          'delay',
          variant === 'l1' ? '50ms' : '500ms',
        ],
        [
          'sudo',
          'tc',
          'filter',
          'add',
          'dev',
          iface,
          'parent',
          '1b00:',
          'protocol',
          'ip',
          'prio',
          '1',
          'u32',
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
        ],
      ],
      undo: [['sudo', 'tc', 'qdisc', 'del', 'dev', iface, 'root', 'handle', '1b00:']],
    };
  if (variant === 'f2') {
    const rule = [
      'deny',
      ...(f2InterfaceScoped ? ['in', 'on', iface] : []),
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
    ];
    return {
      apply: [['sudo', 'ufw', 'insert', '1', ...rule]],
      undo: [['sudo', 'ufw', '--force', 'delete', ...rule]],
    };
  }
  return { apply: [], undo: [] };
}

export function parseRss(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim().split(/\s+/));
  const header = lines.shift();
  if (
    header.length !== 2 ||
    header[0] !== 'PID' ||
    header[1] !== 'RSS' ||
    !lines.length ||
    lines.some((row) => row.length !== 2 || !/^[1-9]\d*$/.test(row[0]) || !/^\d+$/.test(row[1]))
  )
    return null;
  const rss = lines.reduce((sum, row) => sum + Number(row[1]) * 1024, 0);
  return Number.isSafeInteger(rss) ? rss : null;
}

export function evaluateLiveComparison(baseline, candidate) {
  const unknown = (reason) => ({ passed: null, reason });
  if (!isDeepStrictEqual(baseline?.profile, candidate?.profile) || !baseline?.profile)
    return unknown('PROFILE_MISMATCH');
  const valid = (run) =>
    Array.isArray(run?.windows) &&
    run.windows.length > 0 &&
    run.windows.every(
      (w) =>
        w.complete &&
        ['join', 'vote', 'qaSubmit', 'blitzlicht'].every((k) => {
          const a = w.actions?.[k];
          return (
            a?.accountingValid &&
            a.attempted > 0 &&
            a.pending === 0 &&
            a.notAttempted === 0 &&
            a.skipped === 0 &&
            a.attempted === a.planned &&
            Array.isArray(a.latency?.durationSamplesMs) &&
            a.latency.durationSamplesMs.length === a.succeeded &&
            a.succeeded + a.failed === a.attempted
          );
        }),
    );
  if (!valid(baseline) || !valid(candidate)) return unknown('INCOMPLETE');
  const actions = {};
  for (const key of ['join', 'vote', 'qaSubmit', 'blitzlicht']) {
    const aggregate = (run) => {
      const rows = run.windows.map((w) => w.actions[key]);
      return {
        failed: rows.reduce((n, a) => n + a.failed, 0),
        attempted: rows.reduce((n, a) => n + a.attempted, 0),
        latency: fasseLaufzeitenZusammen(rows.flatMap((a) => a.latency.durationSamplesMs)),
      };
    };
    const b = aggregate(baseline),
      c = aggregate(candidate);
    if (b.failed !== 0 || !b.latency.available || b.latency.p95Ms <= 0)
      return unknown('BASELINE_INVALID');
    actions[key] = {
      baseline: b,
      candidate: c,
      noAdditionalErrors: c.failed === 0,
      latencyPassed: c.latency.available ? c.latency.p95Ms <= b.latency.p95Ms * 1.1 : null,
    };
  }
  return {
    passed: Object.values(actions).every((a) => a.noAdditionalErrors && a.latencyPassed === true),
    actions,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'settings') {
    process.stdout.write(
      JSON.stringify(effectiveSettings(readFileSync('.env.production', 'utf8'))),
    );
  } else {
    const e = process.env;
    const config = experimentConfig({
      variant: e.LAB_STOERUNG || 'normal',
      consumer: e.LAB_AUFTRAG || 'summary',
      n: Number(e.LAB_N || 10),
      timeoutMs: Number(e.LAB_TIMEOUT_MS),
      runtimeOff: e.LAB_RUNTIME_AUS === '1',
      live: e.LAB_LIVE === '1',
      tag: e.LAB_TAG || '',
    });
    process.stdout.write(JSON.stringify(config));
  }
}
