import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { attachTrustedClientIp, createTrustProxyFunction } from './trustedProxy';

function upgradeRequest(
  remoteAddress: string,
  forwardedFor?: string,
): IncomingMessage & { ip?: string } {
  return {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    socket: { remoteAddress },
  } as unknown as IncomingMessage & { ip?: string };
}

describe('trustedProxy', () => {
  it('übernimmt hinter genau einem Proxy dessen überschriebenen Client-Wert', () => {
    const req = upgradeRequest('127.0.0.1', '198.51.100.77');

    attachTrustedClientIp(req, createTrustProxyFunction(1));

    expect(req.ip).toBe('198.51.100.77');
  });

  it('vertraut bei einem Hop nur dem rechten XFF-Wert neben dem Socket', () => {
    const req = upgradeRequest('127.0.0.1', '203.0.113.9, 198.51.100.77');

    attachTrustedClientIp(req, createTrustProxyFunction(1));

    expect(req.ip).toBe('198.51.100.77');
  });

  it('ignoriert XFF vollständig, wenn kein Proxy-Hop konfiguriert ist', () => {
    const req = upgradeRequest('192.0.2.44', '203.0.113.9');

    attachTrustedClientIp(req, createTrustProxyFunction(0));

    expect(req.ip).toBe('192.0.2.44');
  });

  it('behandelt ungültige Hop-Zahlen fail-closed', () => {
    const req = upgradeRequest('192.0.2.44', '203.0.113.9');

    attachTrustedClientIp(req, createTrustProxyFunction(Number.NaN));

    expect(req.ip).toBe('192.0.2.44');
  });
});
