import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { resolveTrustedPublicCreateIp } from './trpc';

function requestWithSpoofedHeaders(headers: Record<string, string>): IncomingMessage {
  return {
    headers,
    ip: '198.51.100.77',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as IncomingMessage;
}

describe('vertrauenswürdige Public-Create-IP', () => {
  it('wechselt den Bucket nicht durch gefälschte CF-/XFF-/True-Client-Header', () => {
    const first = resolveTrustedPublicCreateIp(
      requestWithSpoofedHeaders({
        'cf-connecting-ip': '203.0.113.1',
        'true-client-ip': '203.0.113.2',
        'x-forwarded-for': '203.0.113.3',
      }),
    );
    const second = resolveTrustedPublicCreateIp(
      requestWithSpoofedHeaders({
        'cf-connecting-ip': '192.0.2.10',
        'true-client-ip': '192.0.2.11',
        'x-forwarded-for': '192.0.2.12',
      }),
    );

    expect(first).toEqual({ ip: '198.51.100.77', source: 'express-req-ip' });
    expect(second).toEqual(first);
  });

  it('fällt ohne Express-Kontext ausschließlich auf die Socket-Adresse zurück', () => {
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.99' },
      socket: { remoteAddress: '192.0.2.44' },
    } as unknown as IncomingMessage;

    expect(resolveTrustedPublicCreateIp(request)).toEqual({
      ip: '192.0.2.44',
      source: 'socket',
    });
  });
});
