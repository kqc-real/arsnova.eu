#!/usr/bin/env node
import { chmod, lstat, unlink } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { isAbsolute, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { setTimeout as warten } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { writeScenarioReport } from './lib/reporting.mjs';

const MAX_REQUEST_BYTES = 1_048_576;
export const VERZOEGERUNG_MS = 6000;

function endpunktHeader(headers) {
  const hop = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'host',
    ...String(headers.connection ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase()),
  ]);
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !hop.has(name.toLowerCase())),
  );
}

export async function starteVerzoegerungsproxy({
  listenSocket,
  upstreamSocket,
  delayMs = VERZOEGERUNG_MS,
  upstreamTimeoutMs = 15000,
  warte = (ms, signal) => warten(ms, undefined, { signal }),
} = {}) {
  if (
    ![listenSocket, upstreamSocket].every((pfad) => typeof pfad === 'string' && isAbsolute(pfad)) ||
    resolve(listenSocket) === resolve(upstreamSocket) ||
    !Number.isSafeInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 60000 ||
    !Number.isSafeInteger(upstreamTimeoutMs) ||
    upstreamTimeoutMs < 1 ||
    upstreamTimeoutMs > 60000
  ) {
    throw new Error('Ungültige Labor-Socketpfade oder Zeitgrenzen.');
  }
  try {
    await lstat(listenSocket);
    throw new Error('Der Proxy-Socketpfad ist bereits belegt.');
  } catch (fehler) {
    if (fehler.code !== 'ENOENT') throw fehler;
  }
  const zaehler = {
    receivedNormalize: 0,
    forwarded: 0,
    completed: 0,
    cancelledBeforeForward: 0,
    upstreamErrors: 0,
  };
  const steuerungen = new Set();
  const aufgaben = new Set();
  const server = createServer((req, res) => {
    const steuerung = new AbortController();
    const abbrechen = () => {
      if (!res.writableEnded) steuerung.abort();
    };
    res.once('close', abbrechen);
    req.once('aborted', abbrechen);
    steuerungen.add(steuerung);
    const aufgabe = (async () => {
      const pfad = req.url.split('?')[0];
      const normalisieren = req.method === 'POST' && pfad === '/normalize';
      const health = req.method === 'GET' && pfad === '/health';
      let weitergeleitet = false;
      function antworten(status) {
        if (!res.destroyed && !res.headersSent) {
          res.writeHead(status, { 'content-length': '0', 'cache-control': 'no-store' });
          res.end();
        }
      }
      try {
        if (!normalisieren && !health) {
          req.resume();
          antworten(404);
          return;
        }
        if (normalisieren) zaehler.receivedNormalize++;
        const laenge = req.headers['content-length'];
        if (normalisieren && !/^\d+$/.test(laenge ?? '')) {
          req.resume();
          antworten(400);
          return;
        }
        if (
          normalisieren &&
          (!Number.isSafeInteger(Number(laenge)) || Number(laenge) > MAX_REQUEST_BYTES)
        ) {
          req.resume();
          antworten(413);
          return;
        }
        const teile = [];
        let bytes = 0;
        for await (const teil of req) {
          bytes += teil.length;
          if (bytes > MAX_REQUEST_BYTES) {
            antworten(413);
            return;
          }
          teile.push(teil);
        }
        const body = Buffer.concat(teile);
        if (normalisieren) await warte(delayMs, steuerung.signal);
        steuerung.signal.throwIfAborted();
        const frist = AbortSignal.timeout(upstreamTimeoutMs);
        const signal = AbortSignal.any([steuerung.signal, frist]);
        await new Promise((fertig, reject) => {
          const upstream = request(
            {
              socketPath: upstreamSocket,
              path: req.url,
              method: req.method,
              headers: endpunktHeader(req.headers),
              signal,
            },
            (antwort) => {
              res.writeHead(antwort.statusCode ?? 502, endpunktHeader(antwort.headers));
              pipeline(antwort, res, { signal }).then(fertig, reject);
            },
          );
          upstream.once('error', reject);
          weitergeleitet = true;
          if (normalisieren) zaehler.forwarded++;
          upstream.end(body);
        });
        if (normalisieren) zaehler.completed++;
      } catch {
        if (steuerung.signal.aborted) {
          if (normalisieren && !weitergeleitet) zaehler.cancelledBeforeForward++;
        } else {
          zaehler.upstreamErrors++;
          if (res.headersSent) res.destroy();
          else antworten(502);
        }
      } finally {
        steuerungen.delete(steuerung);
        req.removeListener('aborted', abbrechen);
        res.removeListener('close', abbrechen);
      }
    })();
    aufgaben.add(aufgabe);
    aufgabe.finally(() => aufgaben.delete(aufgabe));
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  await new Promise((fertig, reject) => {
    server.once('error', reject);
    server.listen(listenSocket, fertig);
  });
  let socketInfo;
  try {
    await chmod(listenSocket, 0o600);
    socketInfo = await lstat(listenSocket);
  } catch (fehler) {
    await new Promise((fertig) => server.close(fertig));
    throw fehler;
  }
  let schliessen;
  return {
    snapshot: () => ({ delayMs, upstreamTimeoutMs, ...zaehler, active: steuerungen.size }),
    close() {
      schliessen ??= (async () => {
        for (const steuerung of steuerungen) steuerung.abort();
        server.closeAllConnections();
        await new Promise((fertig) => server.close(fertig));
        await Promise.allSettled([...aufgaben]);
        try {
          const aktuell = await lstat(listenSocket);
          if (aktuell.ino === socketInfo.ino && aktuell.dev === socketInfo.dev)
            await unlink(listenSocket);
        } catch (fehler) {
          if (fehler.code !== 'ENOENT') throw fehler;
        }
      })();
      return schliessen;
    },
  };
}

async function main(args) {
  if (args.length === 1 && args[0] === '--validate') {
    process.stdout.write(
      `${JSON.stringify({
        mode: 'network-free-validation',
        delayMs: VERZOEGERUNG_MS,
        delayedRoute: 'POST /normalize',
        healthDelayed: false,
        transport: 'unix',
        maxRequestBytes: MAX_REQUEST_BYTES,
      })}\n`,
    );
    return;
  }
  const werte = {};
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (Object.hasOwn(werte, option)) throw new Error('Doppelte Option.');
    if (['--run', '--lab'].includes(option)) werte[option] = true;
    else if (
      ['--listen-socket', '--upstream-socket', '--delay-ms'].includes(option) &&
      args[index + 1] &&
      !args[index + 1].startsWith('--')
    )
      werte[option] = args[++index];
    else throw new Error('Ungültige Option.');
  }
  if (!werte['--run'] || !werte['--lab']) throw new Error('Der Proxy erfordert --run und --lab.');
  const optionen = {
    listenSocket: werte['--listen-socket'],
    upstreamSocket: werte['--upstream-socket'],
  };
  if (werte['--delay-ms'] !== undefined) {
    if (!/^\d+$/.test(werte['--delay-ms'])) throw new Error('Ungültige Verzögerung.');
    optionen.delayMs = Number(werte['--delay-ms']);
  }
  let abbrechen;
  const beendet = new Promise((fertig) => {
    abbrechen = fertig;
  });
  process.once('SIGINT', abbrechen);
  process.once('SIGTERM', abbrechen);
  let proxy;
  try {
    proxy = await starteVerzoegerungsproxy(optionen);
    process.stdout.write(
      `${JSON.stringify({ status: 'ready', delayMs: proxy.snapshot().delayMs })}\n`,
    );
    await beendet;
  } finally {
    process.removeListener('SIGINT', abbrechen);
    process.removeListener('SIGTERM', abbrechen);
    if (proxy) {
      await proxy.close();
      await writeScenarioReport({ scenario: 'spacy-delay-proxy', metrics: proxy.snapshot() });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv.slice(2));
  } catch {
    process.stderr.write(
      'Der Laborproxy konnte nicht gestartet oder beendet werden. Optionen und Socketpfade prüfen.\n',
    );
    process.exitCode = 1;
  }
}
