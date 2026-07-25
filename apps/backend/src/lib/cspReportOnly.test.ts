import express from 'express';
import type { Server } from 'http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CSP_REPORT_ONLY_HEADER,
  CSP_REPORT_ONLY_POLICY,
  createCspReportOnlyMiddleware,
  isCspReportOnlyEnabled,
} from './cspReportOnly';

const servers: Server[] = [];

async function startApp(enabled: boolean): Promise<string> {
  const app = express();
  app.use(createCspReportOnlyMiddleware(enabled));
  app.get('/de/quiz/ABC123', (_req, res) =>
    res.type('html').send('<!doctype html><title>Quiz</title>'),
  );
  app.get('/en/help', (_req, res) => res.type('html').send('<!doctype html><title>Help</title>'));
  app.get('/main.js', (_req, res) => res.type('js').send('console.log("ok")'));
  app.get('/styles.css', (_req, res) => res.type('css').send('body{}'));
  app.get('/manifest.webmanifest', (_req, res) => res.type('json').send('{}'));
  app.get('/empty', (_req, res) => res.status(204).end());
  app.get('/error', (_req, res) => res.status(500).type('html').send('<h1>Fehler</h1>'));
  app.get('/trpc/health.check', (_req, res) => res.json({ result: 'ok' }));
  app.post('/csp-report', (_req, res) => res.status(204).end());

  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Testserver ohne TCP-Adresse');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('CSP Report-Only Policy', () => {
  it('enthält die reviewten Direktiven und ausschließlich den Report-Only-Endpunkt', () => {
    const directives = new Map(
      CSP_REPORT_ONLY_POLICY.split('; ').map((directive) => {
        const [name, ...values] = directive.split(' ');
        return [name, values];
      }),
    );

    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'self'"]);
    expect(directives.get('script-src')).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
    expect(directives.get('script-src-elem')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives.get('script-src-attr')).toEqual(["'unsafe-inline'"]);
    expect(directives.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives.get('img-src')).toEqual(["'self'", 'data:', 'blob:', 'https:']);
    expect(directives.get('font-src')).toEqual(["'self'", 'data:']);
    expect(directives.get('connect-src')).toEqual(["'self'", 'wss:']);
    expect(directives.get('worker-src')).toEqual(["'self'", 'blob:']);
    expect(directives.get('manifest-src')).toEqual(["'self'"]);
    expect(directives.get('frame-src')).toEqual(["'self'", 'blob:']);
    expect(directives.get('media-src')).toEqual(["'self'", 'blob:']);
    expect(directives.get('report-uri')).toEqual(['/csp-report']);
    expect(CSP_REPORT_ONLY_POLICY).not.toContain('\r');
    expect(CSP_REPORT_ONLY_POLICY).not.toContain('\n');
  });

  it('aktiviert nur den exakten rollback-sicheren Flag-Wert true', () => {
    expect(isCspReportOnlyEnabled('true')).toBe(true);
    for (const value of [undefined, '', 'false', 'TRUE', '1', ' true']) {
      expect(isCspReportOnlyEnabled(value)).toBe(false);
    }
  });

  it('setzt den Header genau einmal auf lokalisierte HTML-Dokumente', async () => {
    const baseUrl = await startApp(true);

    for (const path of ['/de/quiz/ABC123', '/en/help']) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get(CSP_REPORT_ONLY_HEADER)).toBe(CSP_REPORT_ONLY_POLICY);
      expect(response.headers.get('content-security-policy')).toBeNull();
      expect(response.headers.get(CSP_REPORT_ONLY_HEADER)?.split('report-uri')).toHaveLength(2);
    }

    const headResponse = await fetch(`${baseUrl}/de/quiz/ABC123`, { method: 'HEAD' });
    expect(headResponse.headers.get(CSP_REPORT_ONLY_HEADER)).toBe(CSP_REPORT_ONLY_POLICY);
  });

  it('setzt keinen CSP-Header auf API, Report-Ingest, Assets, JSON oder 204', async () => {
    const baseUrl = await startApp(true);
    const requests: Array<[string, RequestInit?]> = [
      ['/trpc/health.check'],
      ['/csp-report', { method: 'POST' }],
      ['/main.js'],
      ['/styles.css'],
      ['/manifest.webmanifest'],
      ['/empty'],
      ['/error'],
    ];

    for (const [path, init] of requests) {
      const response = await fetch(`${baseUrl}${path}`, init);
      expect(response.headers.get(CSP_REPORT_ONLY_HEADER), path).toBeNull();
      expect(response.headers.get('content-security-policy'), path).toBeNull();
    }
  });

  it('entfernt den Header per deaktiviertem Rollback-Flag vollständig', async () => {
    const baseUrl = await startApp(false);
    const response = await fetch(`${baseUrl}/de/quiz/ABC123`);

    expect(response.headers.get(CSP_REPORT_ONLY_HEADER)).toBeNull();
    expect(response.headers.get('content-security-policy')).toBeNull();
  });
});
