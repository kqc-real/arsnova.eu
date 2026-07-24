import type { IncomingMessage } from 'node:http';
import proxyAddr from 'proxy-addr';

export type TrustProxyFunction = (address: string, hop: number) => boolean;

type IncomingMessageWithIp = IncomingMessage & { ip?: string };

/**
 * Express' numerisches `trust proxy`-Modell als wiederverwendbare Funktion.
 * Nur vollständige, nichtnegative Hop-Zahlen sind gültig; Fehlkonfigurationen
 * fallen sicher auf direkte Socket-Adressen zurück.
 */
export function createTrustProxyFunction(hops: number): TrustProxyFunction {
  const trustedHops = Number.isSafeInteger(hops) && hops > 0 ? hops : 0;
  return (_address, hop) => hop < trustedHops;
}

/**
 * Ergänzt einem rohen Upgrade-Request dieselbe vertrauenswürdig aufgelöste IP,
 * die Express über `req.ip` bereitstellt. `proxy-addr` berücksichtigt Header
 * nur bis zu den explizit vertrauten Proxy-Hops.
 */
export function attachTrustedClientIp(
  req: IncomingMessage,
  trustProxy: TrustProxyFunction,
): IncomingMessage {
  (req as IncomingMessageWithIp).ip = proxyAddr(req, trustProxy);
  return req;
}
