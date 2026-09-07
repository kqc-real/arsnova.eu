import { describe, expect, it, vi } from 'vitest';
import {
  buildHostPairingAppPath,
  buildHostPairingUrl,
  hostPairingUrlLeaksSecretInQueryOrPath,
  readHostPairingSecretFromLocation,
} from './host-pairing-url';

vi.mock('../../../core/locale-router', () => ({
  resolveLocalizedAppUrl: (path: string) => `https://arsnova.eu/de${path}`,
}));

const SECRET = 'a'.repeat(32);

describe('host-pairing-url', () => {
  it('legt das Geheimnis nur ins Fragment, nicht in Query oder Pfad', () => {
    const url = buildHostPairingUrl('abc123', SECRET);
    expect(buildHostPairingAppPath('abc123')).toBe('/session/ABC123/pair');
    expect(url).toContain('/session/ABC123/pair');
    expect(url).toContain(`#s=${SECRET}`);
    expect(hostPairingUrlLeaksSecretInQueryOrPath(url)).toBe(false);
    expect(new URL(url).search).toBe('');
  });

  it('liest das Geheimnis aus dem Fragment und ignoriert die Query', () => {
    expect(
      readHostPairingSecretFromLocation({
        hash: `#s=${SECRET}`,
        search: `?s=wrong-query-secret-should-be-ignored-xxxx`,
      }),
    ).toBe(SECRET);
    expect(readHostPairingSecretFromLocation({ hash: '#s=short', search: '' })).toBeNull();
  });
});
