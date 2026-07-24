import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { resolveClientIp, type Context, getClientIp } from './trpc';

function requestWithSpoofedHeaders(headers: Record<string, string>): IncomingMessage {
  return {
    headers,
    ip: '198.51.100.77',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as IncomingMessage;
}

describe('vertrauenswürdige Client-IP', () => {
  it('wechselt den Bucket nicht durch gefälschte CF-/XFF-/True-Client-Header', () => {
    const first = resolveClientIp(
      requestWithSpoofedHeaders({
        'cf-connecting-ip': '203.0.113.1',
        'true-client-ip': '203.0.113.2',
        'x-forwarded-for': '203.0.113.3',
        'x-real-ip': '203.0.113.4',
      }),
    );
    const second = resolveClientIp(
      requestWithSpoofedHeaders({
        'cf-connecting-ip': '192.0.2.10',
        'true-client-ip': '192.0.2.11',
        'x-forwarded-for': '192.0.2.12',
        'x-real-ip': '192.0.2.13',
      }),
    );

    expect(first).toEqual({ ip: '198.51.100.77', source: 'express-req-ip' });
    expect(second).toEqual(first);
    expect(
      getClientIp({ req: requestWithSpoofedHeaders({ 'x-forwarded-for': '203.0.113.9' }) }),
    ).toBe('198.51.100.77');
  });

  it('fällt ohne Express-Kontext ausschließlich auf die Socket-Adresse zurück', () => {
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.99' },
      socket: { remoteAddress: '192.0.2.44' },
    } as unknown as IncomingMessage;

    expect(resolveClientIp(request)).toEqual({
      ip: '192.0.2.44',
      source: 'socket',
    });
  });

  it('liefert ohne Request einen stabilen unbekannten Bucket', () => {
    expect(resolveClientIp(undefined)).toEqual({ ip: '0.0.0.0', source: 'missing-req' });
    expect(getClientIp({ req: undefined } as Context)).toBe('0.0.0.0');
  });
});
