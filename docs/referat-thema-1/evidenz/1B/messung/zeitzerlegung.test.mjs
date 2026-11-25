import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTsharkFields,
  exchanges,
  parseCompletedLog,
  zerlegeAuftraege,
  kennzahlen,
} from './zeitzerlegung.mjs';

const fr = (t, stream, fromClient, payloadBytes, method = null, uri = null, status = null) => ({
  t,
  stream,
  fromClient,
  payloadBytes,
  method,
  uri,
  status,
});

test('parseTsharkFields liest tab-getrennte Zeilen', () => {
  const text = [
    '1700000000.100\t0\t10.0.0.1\t120\tGET\t/slots?fail_on_no_slot=1\t',
    '1700000000.102\t0\t10.0.0.2\t300\t\t\t200',
    '1700000000.103\t0\t10.0.0.1\t0\t\t\t',
    '',
  ].join('\n');
  const f = parseTsharkFields(text, '10.0.0.1');
  assert.equal(f.length, 3);
  assert.deepEqual(f[0], fr(1700000000.1, 0, true, 120, 'GET', '/slots?fail_on_no_slot=1', null));
  assert.equal(f[1].fromClient, false);
  assert.equal(f[1].status, 200);
  assert.equal(f[1].method, null);
});

test('exchanges trennt zwei Anfragen in einem Keep-Alive-Stream', () => {
  const frames = [
    fr(10.0, 0, true, 100, 'GET', '/slots?fail_on_no_slot=1'),
    fr(10.002, 0, false, 50, null, null, 200),
    fr(10.01, 0, true, 0), // ACK ohne Nutzdaten
    fr(11.0, 0, true, 1400), // erstes POST-Segment
    fr(11.001, 0, true, 1400),
    fr(11.002, 0, true, 500, 'POST', '/v1/chat/completions'),
    fr(21.0, 0, false, 900, null, null, 200),
  ];
  const ex = exchanges(frames);
  assert.equal(ex.length, 2);
  assert.equal(ex[0].method, 'GET');
  assert.ok(Math.abs(ex[0].wireMs - 2) < 1e-6);
  assert.equal(ex[1].method, 'POST');
  assert.equal(ex[1].tStart, 11.0);
  assert.ok(Math.abs(ex[1].wireMs - 10_000) < 1e-6);
});

const ex = (method, uri, wireMs, status = 200) => ({
  stream: 0,
  method,
  uri,
  status,
  tStart: 0,
  tEnd: wireMs / 1000,
  wireMs,
});
const GET = '/slots?fail_on_no_slot=1';
const POST = '/v1/chat/completions';
const done = (latencyMs) => ({
  latencyMs,
  status: 'ready',
  effectiveMode: 'open_weight',
  fallbackReason: null,
});

test('zerlegeAuftraege rechnet Netz, Adapter und Inferenz', () => {
  const [a] = zerlegeAuftraege({
    appExchanges: [ex('GET', GET, 2.0), ex('POST', POST, 200_010)],
    srvExchanges: [ex('GET', GET, 1.5), ex('POST', POST, 200_000)],
    completed: [done(200_600)],
    timings: [{ prompt_ms: 150_000, predicted_ms: 49_000, cache_n: 0 }],
  });
  assert.ok(Math.abs(a.netzMs - 10.5) < 1e-6);
  assert.ok(Math.abs(a.adapterMs - 588) < 1e-6);
  assert.equal(a.inferMs, 199_000);
  assert.ok(Math.abs(a.serverOhneInferenzMs - 1000) < 1e-6);
  assert.equal(a.jobMs, 200_600);
  assert.equal(a.cacheN, 0);
  assert.equal(a.status, 'ready');
});

test('Auftrag ohne Modellantwort hat inferMs null', () => {
  const [a] = zerlegeAuftraege({
    appExchanges: [ex('GET', GET, 2), ex('POST', POST, 100, 503)],
    srvExchanges: [ex('GET', GET, 1.5), ex('POST', POST, 90, 503)],
    completed: [done(500)],
    timings: [null],
  });
  assert.equal(a.inferMs, null);
  assert.equal(a.serverOhneInferenzMs, null);
  assert.equal(a.cacheN, null);
  const k = kennzahlen([a, { netzMs: 1, adapterMs: 1, inferMs: 95, jobMs: 100 }]);
  assert.equal(k.n, 2);
  assert.equal(k.inferAnteilMedian, 0.95);
  // Ruling 2026-11-13: ohne Inferenz bei einem Auftrag ist H_B3 nicht bewertbar (null).
  assert.equal(k.hB3, null);
});

test('timings müssen zum POST-Status passen und Zahlen enthalten', () => {
  const base = {
    appExchanges: [ex('GET', GET, 2), ex('POST', POST, 100, 503)],
    srvExchanges: [ex('GET', GET, 1.5), ex('POST', POST, 90, 503)],
    completed: [done(500)],
  };
  assert.throws(
    () => zerlegeAuftraege({ ...base, timings: [{ prompt_ms: 1, predicted_ms: 1 }] }),
    /Auftrag 1.*503.*timings/,
  );
  const ok = {
    appExchanges: [ex('GET', GET, 2), ex('POST', POST, 100)],
    srvExchanges: [ex('GET', GET, 1.5), ex('POST', POST, 90)],
    completed: [done(500)],
  };
  assert.throws(() => zerlegeAuftraege({ ...ok, timings: [null] }), /Auftrag 1.*200.*timings/);
  assert.throws(
    () => zerlegeAuftraege({ ...ok, timings: [{ prompt_ms: 1 }] }),
    /Auftrag 1.*predicted_ms/,
  );
});

test('keine Aufträge sind ein Fehler, keine widerlegte Hypothese', () => {
  assert.throws(
    () => zerlegeAuftraege({ appExchanges: [], srvExchanges: [], completed: [], timings: [] }),
    /Keine Aufträge/,
  );
});

test('Anzahl Log-Zeilen und POSTs muss übereinstimmen', () => {
  assert.throws(
    () =>
      zerlegeAuftraege({
        appExchanges: [ex('GET', GET, 2), ex('POST', POST, 100)],
        srvExchanges: [ex('GET', GET, 1), ex('POST', POST, 90)],
        completed: [done(500), done(600)],
        timings: [null],
      }),
    (e) => e instanceof Error && /2/.test(e.message) && /1/.test(e.message),
  );
});

test('kennzahlen wendet die Schwellen an', () => {
  const mk = (netzMs, adapterMs, inferMs, jobMs) => ({ netzMs, adapterMs, inferMs, jobMs });
  let k = kennzahlen([mk(50, 2000, 95, 100), mk(50, 2000, 95, 100)]);
  assert.equal(k.netz.medianMs, 50);
  assert.equal(k.hB1, true);
  assert.equal(k.hB2, true);
  assert.equal(k.hB3, true);
  k = kennzahlen([mk(50, 100, 95, 100), mk(201, 100, 95, 100), mk(50, 100, 95, 100)]);
  assert.equal(k.netz.maxMs, 201);
  assert.equal(k.hB1, false);
  k = kennzahlen([mk(1, 2001, 90, 100)]);
  assert.equal(k.hB2, false);
  assert.equal(k.hB3, false);
});

test('parseCompletedLog liest nur qa_summary:completed', () => {
  const text = [
    "qa_summary:failed { reason: 'timeout' }",
    "qa_summary:completed { status: 'ready', effectiveMode: 'open_weight', fallbackReason: null, latencyMs: 200600 }",
  ].join('\n');
  const r = parseCompletedLog(text);
  assert.equal(r.length, 1);
  assert.equal(r[0].latencyMs, 200600);
  assert.equal(r[0].status, 'ready');
});

test('parseCompletedLog liest das mehrzeilige util.inspect-Format von docker logs', () => {
  // console.info(message, obj) in Node: Objekt über 72 Zeichen wird mehrzeilig ausgegeben.
  const text = [
    '2026-11-12T10:00:00.000Z irgendeine andere Zeile',
    'qa_summary:completed {',
    "  status: 'extractive',",
    "  effectiveMode: 'extractive',",
    "  fallbackReason: 'timeout',",
    '  latencyMs: 90012',
    '}',
    "qa_summary:completed { status: 'ready', effectiveMode: 'open_weight', fallbackReason: null, latencyMs: 12.5 }",
    '{"msg":"qa_summary:completed","status":"invalid_response","effectiveMode":"open_weight","fallbackReason":null,"latencyMs":7}',
  ].join('\n');
  const r = parseCompletedLog(text);
  assert.deepEqual(r, [
    {
      latencyMs: 90012,
      status: 'extractive',
      effectiveMode: 'extractive',
      fallbackReason: 'timeout',
    },
    { latencyMs: 12.5, status: 'ready', effectiveMode: 'open_weight', fallbackReason: null },
    {
      latencyMs: 7,
      status: 'invalid_response',
      effectiveMode: 'open_weight',
      fallbackReason: null,
    },
  ]);
});

test('exchanges führt eine am Ende offene Anfrage ohne Antwort mit status null', () => {
  const frames = [
    fr(10.0, 0, true, 100, 'GET', GET),
    fr(10.002, 0, false, 50, null, null, 200),
    fr(11.0, 0, true, 1400, 'POST', POST),
    fr(12.0, 1, true, 100, 'GET', GET),
    fr(12.002, 1, false, 50, null, null, 200),
  ];
  const e = exchanges(frames);
  assert.deepEqual(
    e.map((x) => [x.method, x.status, x.wireMs === null]),
    [
      ['GET', 200, false],
      ['POST', null, true],
      ['GET', 200, false],
    ],
  );
});

test('Auftrag mit unbeantwortetem POST bleibt im Ergebnis, Netz und Adapter null', () => {
  const offen = { ...ex('POST', POST, 0, null), wireMs: null, tEnd: null };
  const r = zerlegeAuftraege({
    appExchanges: [ex('GET', GET, 2), ex('POST', POST, 100_010), ex('GET', GET, 2), offen],
    srvExchanges: [ex('GET', GET, 1.5), ex('POST', POST, 100_000), ex('GET', GET, 1.5), offen],
    completed: [done(100_500), { ...done(300_000), status: 'ready', fallbackReason: 'timeout' }],
    timings: [{ prompt_ms: 50_000, predicted_ms: 49_000, cache_n: 0 }, null],
  });
  assert.equal(r.length, 2);
  assert.equal(r[1].netzMs, null);
  assert.equal(r[1].adapterMs, null);
  assert.equal(r[1].inferMs, null);
  assert.equal(r[1].fallbackReason, 'timeout');
  const k = kennzahlen(r);
  assert.equal(k.n, 2);
  assert.equal(k.unvollstaendig, 1);
  assert.ok(Math.abs(k.netz.medianMs - 10.5) < 1e-6);
});

test('kennzahlen trennt kalte und warme Aufträge nach cacheN', () => {
  const mk = (inferMs, jobMs, cacheN) => ({ netzMs: 1, adapterMs: 100, inferMs, jobMs, cacheN });
  const k = kennzahlen([mk(200, 201, 0), mk(110, 111, 2346), mk(120, 121, 2346)]);
  assert.equal(k.kalt.n, 1);
  assert.equal(k.kalt.inferMsMedian, 200);
  assert.equal(k.warm.n, 2);
  assert.equal(k.warm.inferMsMedian, 115);
  assert.equal(k.warm.jobMsMedian, 116);
});

test('kennzahlen bewertet keine Hypothese, wenn ein Auftrag unvollständig ist', () => {
  const mk = (netzMs, adapterMs, inferMs, jobMs) => ({ netzMs, adapterMs, inferMs, jobMs });
  const k = kennzahlen([mk(1, 100, 99, 100), mk(1, 100, 99, 100), mk(null, null, null, 300_000)]);
  assert.equal(k.unvollstaendig, 1);
  assert.equal(k.nGewertet, 2);
  assert.equal(k.hB1, null);
  assert.equal(k.hB2, null);
  assert.equal(k.hB3, null);
});

test('Auftrag mit App-Timeout bleibt unvollständig, auch wenn der Server später 200 sendet', () => {
  // Labor 2026-11-13: App bricht nach 300 s ab, llama-server antwortet danach (200, Antwort abgeschnitten).
  const r = zerlegeAuftraege({
    appExchanges: [ex('GET', GET, 2), ex('POST', POST, 400_000)],
    srvExchanges: [ex('GET', GET, 1.5), ex('POST', POST, 399_000)],
    completed: [{ ...done(300_777), fallbackReason: 'timeout', effectiveMode: 'extractive' }],
    timings: [null],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].netzMs, null);
  assert.equal(r[0].adapterMs, null);
  assert.equal(r[0].inferMs, null);
  assert.equal(r[0].fallbackReason, 'timeout');
  assert.equal(kennzahlen(r).unvollstaendig, 1);
});
