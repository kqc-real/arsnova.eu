import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CSP_REPORT_MAX_BODY_BYTES,
  CspReportIngest,
  createCspReportRouter,
  minimizeCspUrl,
  parseCspReportPayload,
  type CspRedisClient,
} from './cspReportIngest';

const VALID_REPORT = {
  'csp-report': {
    'effective-directive': 'script-src-elem',
    'violated-directive': 'script-src-elem https:',
    'document-uri': 'https://arsnova.eu/de/quiz?token=secret#answer',
    'blocked-uri': 'https://cdn.example/app.js?user=alice',
    'source-file': 'https://arsnova.eu/main.js?build=private',
    'line-number': 12,
    'column-number': 7,
    disposition: 'report',
    'status-code': 200,
    referrer: 'https://identity.example/alice',
    'script-sample': 'password = "secret"',
    'original-policy': "default-src 'none'",
  },
};

const VALID_REPORTING_BODY = {
  effectiveDirective: 'script-src-elem',
  violatedDirective: 'script-src-elem https:',
  documentURL: 'https://arsnova.eu/de/quiz?token=secret#answer',
  blockedURL: 'https://cdn.example/app.js?user=alice',
  sourceFile: 'https://arsnova.eu/main.js?build=private',
  lineNumber: 12,
  columnNumber: 7,
  disposition: 'report',
  statusCode: 200,
  referrer: 'https://identity.example/alice',
  sample: 'password = "secret"',
  originalPolicy: "default-src 'none'",
};

class FakeRedis implements CspRedisClient {
  readonly calls: Array<{ script: string; keys: string[]; args: string[] }> = [];
  attempts = 0;
  result: unknown = [1, 0, 0];
  error: Error | null = null;

  async eval(script: string, keyCount: number, ...values: string[]): Promise<unknown> {
    this.attempts += 1;
    if (this.error) throw this.error;
    this.calls.push({
      script,
      keys: values.slice(0, keyCount),
      args: values.slice(keyCount),
    });
    return this.result;
  }
}

describe('CSP-Report-Parser und Minimierung', () => {
  it('verwirft zur Laufzeit String-/Array-Type-Confusion vor Buffer-Zugriffen', () => {
    expect(parseCspReportPayload('{"csp-report":{}}')).toBeNull();
    expect(parseCspReportPayload([1, 2, 3])).toBeNull();
  });

  it('akzeptiert Legacy- und Reporting-API-Formate mit höchstens zehn Reports', () => {
    expect(parseCspReportPayload(Buffer.from(JSON.stringify(VALID_REPORT)))).toHaveLength(1);
    const reports = Array.from({ length: 10 }, () => ({
      type: 'csp-violation',
      body: VALID_REPORTING_BODY,
    }));
    expect(parseCspReportPayload(Buffer.from(JSON.stringify(reports)))).toHaveLength(10);
    expect(
      parseCspReportPayload(
        Buffer.from(
          JSON.stringify([...reports, { type: 'csp-violation', body: VALID_REPORTING_BODY }]),
        ),
      ),
    ).toBeNull();
  });

  it('verwirft malformed, tiefe Objekte, unerlaubte Arrays und String-Bombs günstig', () => {
    expect(parseCspReportPayload(Buffer.from('{"csp-report":'))).toBeNull();
    expect(
      parseCspReportPayload(
        Buffer.from(`{"csp-report":{"x":${'{"x":'.repeat(20)}null${'}'.repeat(20)}}}`),
      ),
    ).toBeNull();
    expect(parseCspReportPayload(Buffer.from(JSON.stringify({ 'csp-report': [] })))).toBeNull();
    expect(
      parseCspReportPayload(
        Buffer.from(
          JSON.stringify({
            'csp-report': {
              'effective-directive': 'script-src',
              unknown: Array.from({ length: 11 }, (_, index) => index),
            },
          }),
        ),
      ),
    ).toBeNull();
    expect(
      parseCspReportPayload(
        Buffer.from(JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(513) } })),
      ),
    ).toBeNull();
    expect(
      parseCspReportPayload(Buffer.from(JSON.stringify({ 'csp-report': { 'line-number': '12' } }))),
    ).toBeNull();
  });

  it('behält nur die Allowlist und entfernt sensitive oder unbekannte Felder', () => {
    const [report] = parseCspReportPayload(Buffer.from(JSON.stringify(VALID_REPORT))) ?? [];
    expect(report).toEqual({
      effectiveDirective: 'script-src-elem',
      violatedDirective: 'script-src-elem https:',
      documentUri: 'https://arsnova.eu/de/quiz',
      blockedUri: 'https://cdn.example/app.js',
      sourceFile: 'https://arsnova.eu/main.js',
      lineNumber: 12,
      columnNumber: 7,
      disposition: 'report',
      statusCode: 200,
    });
    expect(JSON.stringify(report)).not.toMatch(
      /script-sample|password|referrer|identity|original-policy|token|alice|private/,
    );
  });

  it('kanonisiert URL-Sonderfälle ohne Query, Fragment oder Userinfo', () => {
    expect(minimizeCspUrl('https://user:secret@example.org/a/../b?q=1#x')).toBe(
      'https://example.org/b',
    );
    expect(minimizeCspUrl('data:text/javascript,alert(1)')).toBe('scheme:data');
    expect(minimizeCspUrl('blob:https://example.org/id')).toBe('scheme:blob');
    expect(minimizeCspUrl('eval')).toBe('category:eval');
    expect(minimizeCspUrl('inline')).toBe('category:inline');
    expect(minimizeCspUrl('about')).toBe('category:about');
    expect(minimizeCspUrl('https://example.org/' + 'x'.repeat(480))).toHaveLength(256);
    expect(minimizeCspUrl('not a url')).toBe('category:invalid');
  });
});

describe('CSP-Report-Redis-Aggregation', () => {
  it('hasht IPv6/IP und Dimensionen in bounded Keys und übergibt keine Rohdaten an Redis', async () => {
    const redis = new FakeRedis();
    const ingest = new CspReportIngest({
      redis,
      hashSecret: 'test-secret-with-sufficient-entropy',
      now: () => 1_720_000_000_000,
    });
    const reports = parseCspReportPayload(Buffer.from(JSON.stringify(VALID_REPORT)))!;

    await expect(ingest.ingest('2001:db8::cafe', reports)).resolves.toMatchObject({
      status: 'accepted',
    });

    const serialized = JSON.stringify(redis.calls);
    expect(serialized).not.toMatch(/2001:db8|arsnova|example|app\.js|main\.js|alice|secret/);
    expect(redis.calls[0]!.keys.every((key) => key.length < 160)).toBe(true);
    expect(redis.calls[0]!.keys.slice(3)).toEqual([
      'csp:dimensions:members',
      'csp:dimensions:counts',
    ]);
    expect(redis.calls[0]!.args.length).toBeGreaterThanOrEqual(10);
  });

  it('ordnet regulär erschöpfte globale und IP-Budgets als 429 ein', async () => {
    const redis = new FakeRedis();
    const ingest = new CspReportIngest({
      redis,
      hashSecret: 'test-secret',
      now: () => 60_000,
    });
    redis.result = [0, 1, 37];
    await expect(ingest.ingest('203.0.113.4', [])).resolves.toEqual({
      status: 'rate-limited',
      retryAfterSeconds: 37,
    });
    redis.result = [0, 2, 19];
    await expect(ingest.ingest('203.0.113.4', [])).resolves.toEqual({
      status: 'rate-limited',
      retryAfterSeconds: 19,
    });
  });

  it('fällt bei Redis-Ausfall auf ein hartes lokales Globalcap und 204/drop zurück', async () => {
    const redis = new FakeRedis();
    redis.error = new Error('Redis unavailable');
    const ingest = new CspReportIngest({
      redis,
      hashSecret: 'test-secret',
      config: { fallbackGlobalPerMinute: 2 },
      now: () => 60_000,
    });

    await expect(ingest.ingestRaw('203.0.113.1', Buffer.from('{}'))).resolves.toMatchObject({
      status: 'dropped',
    });
    await expect(
      ingest.ingestRaw('203.0.113.2', Buffer.from('{"deep":'.repeat(100))),
    ).resolves.toMatchObject({
      status: 'dropped',
    });
    await expect(ingest.ingestRaw('203.0.113.3', Buffer.from('{}'))).resolves.toMatchObject({
      status: 'dropped',
    });
    expect(redis.calls).toHaveLength(0);
    expect(redis.attempts).toBe(1);
  });

  it('verwendet ein atomisches global-first Lua-Skript mit TTL und Distinct-Cap', async () => {
    const redis = new FakeRedis();
    const ingest = new CspReportIngest({
      redis,
      hashSecret: 'test-secret',
      now: () => 60_000,
    });
    await ingest.ingest(
      '198.51.100.7',
      parseCspReportPayload(Buffer.from(JSON.stringify(VALID_REPORT)))!,
    );

    const script = redis.calls[0]!.script;
    expect(script).toContain('globalCurrent');
    expect(script.indexOf('globalCurrent')).toBeLessThan(script.indexOf("redis.call('INCR'"));
    expect(script).toContain('SCARD');
    expect(script).toContain('256');
    expect(script).toContain('newGeneration');
    expect(script).toContain("redis.call('HGET', KEYS[3], '_bucket')");
    expect(script).toContain('EXPIRE');
  });
});

describe('öffentlicher CSP-Report-Endpunkt', () => {
  let server: Server | undefined;

  afterEach(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!server) return resolve();
        server.close((error) => (error ? reject(error) : resolve()));
        server = undefined;
      }),
  );

  async function start(
    ingest: Pick<CspReportIngest, 'ingest'> = {
      ingest: vi.fn().mockResolvedValue({ status: 'accepted' }),
    },
    trustProxy = false,
  ): Promise<{ baseUrl: string; ingest: Pick<CspReportIngest, 'ingest'> }> {
    const app = express();
    app.disable('x-powered-by');
    if (trustProxy) app.set('trust proxy', 1);
    app.use('/csp-report', createCspReportRouter({ ingest }));
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const { port } = server.address() as AddressInfo;
    return { baseUrl: `http://127.0.0.1:${port}`, ingest };
  }

  it.each(['application/csp-report', 'application/reports+json; charset=UTF-8'])(
    'akzeptiert %s und antwortet rekursionsfrei 204',
    async (contentType) => {
      const { baseUrl } = await start();
      const body =
        contentType === 'application/csp-report'
          ? JSON.stringify(VALID_REPORT)
          : JSON.stringify([{ type: 'csp-violation', body: VALID_REPORTING_BODY }]);
      const response = await fetch(`${baseUrl}/csp-report`, {
        method: 'POST',
        headers: { 'content-type': contentType },
        body,
      });
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(response.headers.get('content-security-policy-report-only')).toBeNull();
      expect(response.headers.get('x-powered-by')).toBeNull();
    },
  );

  it('weist falsche Content-Types und Methoden deterministisch ab', async () => {
    const { baseUrl } = await start();
    const wrongType = await fetch(`${baseUrl}/csp-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(wrongType.status).toBe(415);
    expect(await wrongType.text()).toBe('');
    const wrongMethod = await fetch(`${baseUrl}/csp-report`);
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('POST');
    const nestedPath = await fetch(`${baseUrl}/csp-report/anything`, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: '{}',
    });
    expect(nestedPath.status).toBe(404);
    const queryPath = await fetch(`${baseUrl}/csp-report?redirect=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: '{}',
    });
    expect(queryPath.status).toBe(404);
    const encoded = await fetch(`${baseUrl}/csp-report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        'content-encoding': 'gzip',
      },
      body: '{}',
    });
    expect(encoded.status).toBe(415);
  });

  it('begrenzt den Raw Body vor JSON.parse hart auf 32 KiB', async () => {
    const { baseUrl, ingest } = await start();
    const response = await fetch(`${baseUrl}/csp-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: 'x'.repeat(CSP_REPORT_MAX_BODY_BYTES + 1),
    });
    expect(response.status).toBe(413);
    expect(await response.text()).toBe('');
    expect(ingest.ingest).not.toHaveBeenCalled();
  });

  it('droppt malformed Payloads billig mit 204 und ohne Oracle', async () => {
    const { baseUrl, ingest } = await start();
    const response = await fetch(`${baseUrl}/csp-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: '{"csp-report":',
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(ingest.ingest).toHaveBeenCalledWith('127.0.0.1', null);
  });

  it('nutzt ausschließlich die von Express vertrauenswürdig aufgelöste req.ip', async () => {
    const ingest = { ingest: vi.fn().mockResolvedValue({ status: 'accepted' }) };
    const { baseUrl } = await start(ingest);
    await fetch(`${baseUrl}/csp-report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        'x-forwarded-for': '198.51.100.99',
      },
      body: JSON.stringify(VALID_REPORT),
    });
    expect(ingest.ingest).toHaveBeenLastCalledWith('127.0.0.1', expect.any(Array));
  });

  it('liefert bei regulärem Redis-Budget 429 mit Retry-After', async () => {
    const { baseUrl } = await start({
      ingest: vi.fn().mockResolvedValue({ status: 'rate-limited', retryAfterSeconds: 42 }),
    });
    const response = await fetch(`${baseUrl}/csp-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify(VALID_REPORT),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(await response.text()).toBe('');
  });
});
