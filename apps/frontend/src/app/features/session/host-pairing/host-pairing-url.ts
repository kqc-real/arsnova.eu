import { normalizeHostSessionCode } from '../../../core/host-session-token';
import { resolveLocalizedAppUrl } from '../../../core/locale-router';

/** Fragment-Key; darf niemals als Query oder Pfad an Server/Proxy gehen. */
export const HOST_PAIRING_FRAGMENT_KEY = 's';

export function buildHostPairingAppPath(sessionCode: string): string {
  return `/session/${normalizeHostSessionCode(sessionCode)}/pair`;
}

export function buildHostPairingUrl(sessionCode: string, pairingSecret: string): string {
  const base = resolveLocalizedAppUrl(buildHostPairingAppPath(sessionCode));
  const url = new URL(base, 'https://arsnova.eu');
  url.search = '';
  url.hash = `${HOST_PAIRING_FRAGMENT_KEY}=${pairingSecret}`;
  return url.toString();
}

export function readHostPairingSecretFromLocation(locationLike: {
  hash: string;
  search?: string;
}): string | null {
  const rawHash = locationLike.hash.startsWith('#')
    ? locationLike.hash.slice(1)
    : locationLike.hash;
  const fromHash = new URLSearchParams(rawHash).get(HOST_PAIRING_FRAGMENT_KEY)?.trim() ?? '';
  if (fromHash.length >= 32) {
    return fromHash;
  }
  return null;
}

export function hostPairingUrlLeaksSecretInQueryOrPath(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://arsnova.eu');
    if (parsed.searchParams.has(HOST_PAIRING_FRAGMENT_KEY)) return true;
    if (parsed.searchParams.has('pairingSecret')) return true;
    return /pairingSecret|\/s=[A-Za-z0-9_-]{32,}/.test(parsed.pathname);
  } catch {
    return true;
  }
}
