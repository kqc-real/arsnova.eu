/**
 * Durchreichender, aufzeichnender HTTP-Proxy für den Laborlauf der
 * Q&A-Zusammenfassung (Messinstrument, kein Prüfgegenstand).
 *
 * Der Proxy lauscht auf 127.0.0.1 (freier Port). Der Backend-Client wird per Env
 * auf ihn gerichtet; er leitet jede Anfrage unverändert an die Runtime weiter
 * (`upstream`) und die Antwort unverändert zurück. Unverändert heißt: dieselbe
 * Methode, derselbe Pfad, dieselben Header außer `host` (wird auf die Runtime
 * gesetzt, wie es jeder HTTP-Proxy tun muss) und den hop-by-hop-Headern
 * `connection`, `keep-alive` und `transfer-encoding`, und **dieselben Body-Bytes**
 * in beide Richtungen. Statuscode und Antwort-Header gehen ebenfalls unverändert
 * zurück, außer denselben hop-by-hop-Headern (der Body wird vollständig gepuffert
 * und mit `content-length` ausgeliefert).
 *
 * Aufgezeichnet werden die rohen Bytes beider Bodys, Zeitpunkte und
 * SHA-256-Prüfsummen. **Nicht** aufgezeichnet wird der Wert des
 * `authorization`-Headers; festgehalten wird nur, ob er vorhanden war und ob er
 * dem erwarteten Token entsprach. So gelangt kein Secret in die Rohdaten.
 */
import { createHash } from 'node:crypto';
import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type OutgoingHttpHeaders,
  type Server,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { AddressInfo } from 'node:net';

export type ProxyExchange = {
  readonly method: string;
  readonly path: string;
  /** Header-Namen der Anfrage (klein geschrieben), ohne Werte. */
  readonly requestHeaderNames: readonly string[];
  readonly requestContentType: string | null;
  readonly authorizationPresent: boolean;
  /** `true`, wenn `authorization` exakt `Bearer <expectedToken>` war; `null` ohne Erwartung. */
  readonly authorizationMatchesExpected: boolean | null;
  /** Rohe Bytes des Anfrage-Bodys (UTF-8), so wie sie empfangen und weitergeleitet wurden. */
  readonly requestBody: string;
  readonly requestBodyBytes: number;
  readonly requestBodySha256: string;
  /**
   * `true`, wenn die weitergeleiteten Bytes dieselben sind wie die empfangenen. Das ist eine
   * Invariante der Konstruktion, keine unabhängige Messung: Verglichen wird eine Kopie
   * (`Buffer.from(body)`) mit dem Original. Dass genau diese Bytes an die Runtime gehen,
   * folgt aus dem Code (`outgoing.end(forwarded)`), nicht aus diesem Feld.
   */
  readonly forwardedBodyIdentical: boolean;
  readonly responseStatus: number | null;
  readonly responseContentType: string | null;
  readonly responseBody: string | null;
  readonly responseBodyBytes: number | null;
  readonly responseBodySha256: string | null;
  /** Fehler auf der Strecke zur Runtime (z. B. Verbindungsabbruch), sonst `null`. */
  readonly upstreamError: string | null;
  /** `performance.now()`-Zeitpunkte im Testprozess. */
  readonly at: {
    readonly requestReceived: number;
    readonly forwardStarted: number;
    readonly upstreamHeaders: number | null;
    readonly upstreamEnded: number | null;
    readonly responseSent: number | null;
  };
};

export type RecordingProxy = {
  readonly baseUrl: string;
  readonly exchanges: ProxyExchange[];
  close(): Promise<void>;
};

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding']);

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function header(headers: IncomingHttpHeaders, name: string): string | null {
  const value = headers[name];
  if (Array.isArray(value)) return value.join(', ');
  return value ?? null;
}

/**
 * Startet den Proxy. `upstream` ist eine Basis-URL (`http:` oder `https:`, ohne
 * Pfad); die Prüfung, dass sie privat ist, liegt beim Aufrufer.
 */
export async function startRecordingProxy(options: {
  readonly upstream: string;
  readonly expectedToken?: string;
}): Promise<RecordingProxy> {
  const upstream = new URL(options.upstream);
  if (upstream.protocol !== 'http:' && upstream.protocol !== 'https:') {
    throw new Error('Upstream des Proxys muss http oder https verwenden');
  }
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const exchanges: ProxyExchange[] = [];

  const server: Server = createServer((req, res) => {
    const requestReceived = performance.now();
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const forwardStarted = performance.now();
      const authorization = header(req.headers, 'authorization');
      const headers: OutgoingHttpHeaders = {};
      for (const [name, value] of Object.entries(req.headers)) {
        if (name === 'host' || HOP_BY_HOP.has(name) || value === undefined) continue;
        headers[name] = value;
      }
      headers['host'] = upstream.host;
      const forwarded = Buffer.from(body);
      const base = {
        method: req.method ?? '',
        path: req.url ?? '',
        requestHeaderNames: Object.keys(req.headers).sort(),
        requestContentType: header(req.headers, 'content-type'),
        authorizationPresent: authorization !== null,
        authorizationMatchesExpected:
          options.expectedToken === undefined
            ? null
            : authorization === `Bearer ${options.expectedToken}`,
        requestBody: body.toString('utf8'),
        requestBodyBytes: body.byteLength,
        requestBodySha256: sha256(body),
        forwardedBodyIdentical: forwarded.equals(body),
      };
      let upstreamHeaders: number | null = null;
      const outgoing = send(
        {
          protocol: upstream.protocol,
          hostname: upstream.hostname,
          port: upstream.port || undefined,
          method: req.method,
          path: req.url,
          headers,
        },
        (upstreamRes) => {
          upstreamHeaders = performance.now();
          const responseChunks: Buffer[] = [];
          upstreamRes.on('data', (chunk: Buffer) => responseChunks.push(chunk));
          upstreamRes.on('end', () => {
            const upstreamEnded = performance.now();
            const responseBody = Buffer.concat(responseChunks);
            const responseHeaders: OutgoingHttpHeaders = {};
            for (const [name, value] of Object.entries(upstreamRes.headers)) {
              if (HOP_BY_HOP.has(name) || name === 'content-length' || value === undefined) {
                continue;
              }
              responseHeaders[name] = value;
            }
            responseHeaders['content-length'] = String(responseBody.byteLength);
            const status = upstreamRes.statusCode ?? 502;
            const record = (responseSent: number | null): void => {
              exchanges.push({
                ...base,
                responseStatus: status,
                responseContentType: header(upstreamRes.headers, 'content-type'),
                responseBody: responseBody.toString('utf8'),
                responseBodyBytes: responseBody.byteLength,
                responseBodySha256: sha256(responseBody),
                upstreamError: null,
                at: {
                  requestReceived,
                  forwardStarted,
                  upstreamHeaders,
                  upstreamEnded,
                  responseSent,
                },
              });
            };
            if (res.destroyed) {
              // Der Client hat abgebrochen (z. B. Timeout); die Antwort wird nur aufgezeichnet.
              record(null);
              return;
            }
            res.writeHead(status, responseHeaders);
            res.end(responseBody, () => record(performance.now()));
          });
          upstreamRes.on('error', (error: Error) => fail(error));
        },
      );
      const fail = (error: Error): void => {
        exchanges.push({
          ...base,
          responseStatus: null,
          responseContentType: null,
          responseBody: null,
          responseBodyBytes: null,
          responseBodySha256: null,
          upstreamError: `${error.name}: ${error.message}`,
          at: {
            requestReceived,
            forwardStarted,
            upstreamHeaders,
            upstreamEnded: null,
            responseSent: null,
          },
        });
        // Wie ein abgebrochener Transport: Verbindung schließen, keine erfundene Antwort.
        res.destroy();
      };
      outgoing.on('error', fail);
      // Bricht der Client ab, wird auch die Weiterleitung abgebrochen.
      res.on('close', () => {
        if (!res.writableFinished) outgoing.destroy();
      });
      outgoing.end(forwarded);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    exchanges,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
