import express from 'express';
import { request as httpRequest, type IncomingHttpHeaders, type Server } from 'http';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpCorsMiddleware } from './httpCors';

const servers: Server[] = [];

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
}

async function rawRequest(
  url: string,
  method: string,
  headers: Record<string, string> = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method, headers }, (response) => {
      response.resume();
      response.once('end', () =>
        resolve({ status: response.statusCode ?? 0, headers: response.headers }),
      );
    });
    request.once('error', reject);
    request.end();
  });
}

async function startApp(nodeEnv: string | undefined): Promise<string> {
  const app = express();
  app.disable('x-powered-by');
  const corsMiddleware = createHttpCorsMiddleware(nodeEnv);
  if (corsMiddleware) app.use(corsMiddleware);
  app.all('/trpc/health.check', (_req, res) => res.status(200).json({ ok: true }));
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

describe('HTTP-CORS', () => {
  it.each([undefined, 'test', 'production'])(
    'installiert außerhalb expliziter Development-Läufe keine Middleware (%s)',
    (nodeEnv) => {
      expect(createHttpCorsMiddleware(nodeEnv)).toBeNull();
    },
  );

  it('entfernt CORS in Produktion für Same-Origin- und No-Origin-Requests vollständig', async () => {
    const baseUrl = await startApp('production');

    for (const origin of [undefined, baseUrl, 'https://evil.example']) {
      const response = await rawRequest(`${baseUrl}/trpc/health.check`, 'GET', {
        ...(origin ? { Origin: origin } : {}),
      });
      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
      expect(response.headers['access-control-allow-headers']).toBeUndefined();
    }
  });

  it.each([
    'null',
    'https://localhost:4200',
    'http://localhost',
    'http://localhost:4201',
    'http://localhost:4200.evil.example',
    'http://localhost.evil.example:4200',
    'http://evil.example@localhost:4200',
    'http://LOCALHOST:4200',
    'http://localhost:4200/',
  ])('lehnt nicht-exakte oder nicht-kanonische Dev-Origin %s ab', async (origin) => {
    const baseUrl = await startApp('development');
    const response = await rawRequest(`${baseUrl}/trpc/health.check`, 'GET', { Origin: origin });

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it.each(['http://localhost:4200', 'http://127.0.0.1:4200', 'http://[::1]:4200'])(
    'erlaubt die exakte Angular-Dev-Origin %s',
    async (origin) => {
      const baseUrl = await startApp('development');
      const response = await rawRequest(`${baseUrl}/trpc/health.check`, 'GET', { Origin: origin });

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
      expect(response.headers.vary).toContain('Origin');
    },
  );

  it('beantwortet benötigte Dev-Preflights ohne Wildcard oder Credentials', async () => {
    const baseUrl = await startApp('development');
    const response = await rawRequest(`${baseUrl}/trpc/health.check`, 'OPTIONS', {
      Origin: 'http://localhost:4200',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers':
        'content-type,x-host-token,x-admin-token,x-feedback-host-token,x-admin-diagnostic-secret',
    });

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(response.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
    expect(response.headers['access-control-allow-headers']).toBe(
      'Content-Type,X-Host-Token,X-Admin-Token,X-Feedback-Host-Token,X-Admin-Diagnostic-Secret',
    );
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  it('liefert für fremde Dev-Preflights keine Freigabe', async () => {
    const baseUrl = await startApp('development');
    const response = await rawRequest(`${baseUrl}/trpc/health.check`, 'OPTIONS', {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'x-host-token',
    });

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toBeUndefined();
  });

  it('fügt dem CSP-Report-Endpunkt keine CORS-Header hinzu', async () => {
    const baseUrl = await startApp('production');
    const response = await rawRequest(`${baseUrl}/csp-report`, 'POST', {
      Origin: 'https://evil.example',
      'Content-Type': 'application/csp-report',
    });

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
