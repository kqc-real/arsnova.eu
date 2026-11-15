import { readFile, stat } from 'node:fs/promises';
import { request } from 'node:http';
import { loadavg } from 'node:os';
import { isAbsolute, resolve, sep } from 'node:path';
import { monotoneUhr } from './host-analyze-loop.mjs';

export const CGROUP_DATEIEN = [
  'cpu.stat',
  'cpu.max',
  'memory.current',
  'memory.peak',
  'memory.max',
  'memory.events',
  'pids.current',
  'pids.max',
];
const fehlt = (reason = 'UNAVAILABLE') => ({ available: false, value: null, reason });
const wert = (value, unit, extra = {}) => ({ available: true, value, unit, ...extra });
function ganzzahl(eingabe) {
  if (!/^\d+$/.test(String(eingabe ?? '').trim())) throw new Error('Ungültiger Zähler.');
  const zahl = Number(String(eingabe).trim());
  if (!Number.isSafeInteger(zahl)) throw new Error('Zähler nicht sicher darstellbar.');
  return zahl;
}
function zaehler(text, namen, erforderlich = namen) {
  if (typeof text !== 'string') throw new Error('Zähler fehlen.');
  const paare = {};
  for (const zeile of text.trim().split('\n')) {
    const [name, zahl, rest] = zeile.trim().split(/\s+/);
    if (!namen.includes(name)) continue;
    if (rest || Object.hasOwn(paare, name)) throw new Error('Widersprüchliche Zähler.');
    paare[name] = ganzzahl(zahl);
  }
  if (erforderlich.some((name) => !Object.hasOwn(paare, name))) throw new Error('Zähler fehlen.');
  return paare;
}
function gelesen(lesen) {
  try {
    return lesen();
  } catch {
    return fehlt();
  }
}

export function parseCgroupV2(dateien) {
  const einzelwert = (name, extra = {}) =>
    gelesen(() => wert(ganzzahl(dateien[name]), 'bytes', { source: name, ...extra }));
  const limit = (name, unit) =>
    gelesen(() =>
      String(dateien[name]).trim() === 'max'
        ? wert(null, unit, { unlimited: true, source: name, scope: 'local-cgroup' })
        : wert(ganzzahl(dateien[name]), unit, {
            unlimited: false,
            source: name,
            scope: 'local-cgroup',
          }),
    );
  return {
    cpuStat: gelesen(() =>
      wert(
        zaehler(
          dateien['cpu.stat'],
          [
            'usage_usec',
            'user_usec',
            'system_usec',
            'nr_periods',
            'nr_throttled',
            'throttled_usec',
          ],
          ['usage_usec', 'user_usec', 'system_usec'],
        ),
        'counts-and-usec',
        { source: 'cpu.stat' },
      ),
    ),
    cpuLimit: gelesen(() => {
      const teile = dateien['cpu.max'].trim().split(/\s+/);
      if (teile.length !== 2) throw new Error();
      const periodUsec = ganzzahl(teile[1]);
      if (!periodUsec) throw new Error();
      const quotaUsec = teile[0] === 'max' ? null : ganzzahl(teile[0]);
      if (quotaUsec === 0) throw new Error();
      return wert(quotaUsec === null ? null : quotaUsec / periodUsec, 'cpus', {
        source: 'cpu.max',
        quotaUsec,
        periodUsec,
        unlimited: quotaUsec === null,
        scope: 'local-cgroup',
      });
    }),
    memoryCurrent: einzelwert('memory.current'),
    memoryPeak: einzelwert('memory.peak', { scope: 'container-lifetime-including-warmup' }),
    memoryLimit: limit('memory.max', 'bytes'),
    oomKill: gelesen(() =>
      wert(zaehler(dateien['memory.events'], ['oom_kill']).oom_kill, 'count', {
        source: 'memory.events',
        scope: 'hierarchical',
      }),
    ),
    pidsCurrent: gelesen(() =>
      wert(ganzzahl(dateien['pids.current']), 'count', { source: 'pids.current' }),
    ),
    pidsLimit: limit('pids.max', 'count'),
  };
}

export function berechneContainerDifferenzen(vorher, nachher) {
  const nichtVergleichbar = {
    cpuPercent: fehlt('NOT_COMPARABLE'),
    throttledPeriodRatio: fehlt('NOT_COMPARABLE'),
    oomKill: fehlt('NOT_COMPARABLE'),
  };
  if (
    !vorher?.available ||
    !nachher?.available ||
    !vorher.cgroup?.available ||
    !nachher.cgroup?.available ||
    vorher.alias !== nachher.alias ||
    vorher.generation !== nachher.generation ||
    !Number.isFinite(vorher.atMs) ||
    !Number.isFinite(nachher.atMs) ||
    nachher.atMs <= vorher.atMs
  )
    return nichtVergleichbar;
  const a = vorher.cgroup.metrics;
  const b = nachher.cgroup.metrics;
  const differenz = (links, rechts) => {
    if (!Number.isSafeInteger(links) || !Number.isSafeInteger(rechts) || rechts < links)
      throw new Error();
    return rechts - links;
  };
  const cpuDifferenz = (name) => {
    if (!a.cpuStat.available || !b.cpuStat.available) throw new Error();
    // Ein zurückgesetzter CPU-Zähler macht auch andere CPU-Differenzen unbrauchbar.
    for (const feld of Object.keys(a.cpuStat.value))
      if (Object.hasOwn(b.cpuStat.value, feld))
        differenz(a.cpuStat.value[feld], b.cpuStat.value[feld]);
    return differenz(a.cpuStat.value[name], b.cpuStat.value[name]);
  };
  return {
    cpuPercent: gelesen(() => {
      const von = a.cpuStat.observedAtMs ?? vorher.atMs;
      const bis = b.cpuStat.observedAtMs ?? nachher.atMs;
      if (!Number.isFinite(von) || !Number.isFinite(bis) || bis <= von) throw new Error();
      return wert((cpuDifferenz('usage_usec') / ((bis - von) * 1000)) * 100, 'percent-of-one-cpu');
    }),
    throttledPeriodRatio: gelesen(() => {
      const perioden = cpuDifferenz('nr_periods');
      const gedrosselt = cpuDifferenz('nr_throttled');
      if (!perioden) throw new Error();
      return wert(gedrosselt / perioden, 'ratio');
    }),
    oomKill: gelesen(() => {
      if (!a.oomKill.available || !b.oomKill.available) throw new Error();
      return wert(differenz(a.oomKill.value, b.oomKill.value), 'count');
    }),
  };
}

function dockerJson(socketPath, path, { signal, timeoutMs }) {
  return new Promise((resolveAntwort, reject) => {
    const frist = AbortSignal.timeout(timeoutMs);
    const req = request(
      { socketPath, path, method: 'GET', signal: AbortSignal.any([signal, frist]) },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error('DOCKER_HTTP_ERROR'));
          return;
        }
        const teile = [];
        let bytes = 0;
        res.on('data', (teil) => {
          bytes += teil.length;
          if (bytes > 8 * 1024 * 1024) {
            res.destroy(new Error('DOCKER_RESPONSE_TOO_LARGE'));
            return;
          }
          teile.push(teil);
        });
        res.once('error', () => reject(new Error('DOCKER_READ_ERROR')));
        res.once('end', () => {
          try {
            resolveAntwort(JSON.parse(Buffer.concat(teile).toString('utf8')));
          } catch {
            reject(new Error('DOCKER_INVALID_JSON'));
          }
        });
      },
    );
    req.once('error', () =>
      reject(
        new Error(signal.aborted ? 'ABORTED' : frist.aborted ? 'TIMEOUT' : 'DOCKER_UNAVAILABLE'),
      ),
    );
    req.end();
  });
}

function identitaet(info) {
  if (
    !/^[a-f0-9]{64}$/.test(info?.Id ?? '') ||
    !Number.isSafeInteger(info.State?.Pid) ||
    typeof info.State?.StartedAt !== 'string' ||
    !Number.isSafeInteger(info.RestartCount)
  )
    throw new Error('DOCKER_INVALID_IDENTITY');
  return `${info.Id}:${info.State.StartedAt}:${info.State.Pid}:${info.RestartCount}`;
}

function dockerMetriken(daten, vorher) {
  const cpu = daten?.cpu_stats;
  const alt = daten?.precpu_stats?.system_cpu_usage > 0 ? daten.precpu_stats : vorher?.cpu_stats;
  return {
    cpuPercent: gelesen(() => {
      const nutzung = ganzzahl(cpu?.cpu_usage?.total_usage) - ganzzahl(alt?.cpu_usage?.total_usage);
      const system = ganzzahl(cpu?.system_cpu_usage) - ganzzahl(alt?.system_cpu_usage);
      const cpus = ganzzahl(cpu?.online_cpus ?? cpu?.cpu_usage?.percpu_usage?.length);
      if (nutzung < 0 || system <= 0 || cpus <= 0) throw new Error();
      return wert((nutzung / system) * cpus * 100, 'percent-of-one-cpu', {
        source: 'docker-engine-stats',
      });
    }),
    memoryUsage: gelesen(() =>
      wert(ganzzahl(daten?.memory_stats?.usage), 'bytes', {
        source: 'docker-engine-stats-unadjusted',
      }),
    ),
    memoryWorkingSet: gelesen(() => {
      const ram = ganzzahl(daten?.memory_stats?.usage);
      const cache = ganzzahl(
        daten?.memory_stats?.stats?.inactive_file ??
          daten?.memory_stats?.stats?.total_inactive_file,
      );
      return wert(cache < ram ? ram - cache : ram, 'bytes', {
        source: 'docker-cli-style-cache-adjusted',
      });
    }),
    memoryLimit: gelesen(() =>
      wert(ganzzahl(daten?.memory_stats?.limit), 'bytes', { source: 'docker-engine-stats' }),
    ),
    pidsCurrent: gelesen(() =>
      wert(ganzzahl(daten?.pids_stats?.current), 'count', { source: 'docker-engine-stats' }),
    ),
  };
}

export function erstelleContainerMetriken({
  containers,
  dockerSocketPath = '/var/run/docker.sock',
  cgroupRoot = '/sys/fs/cgroup',
  procRoot = '/proc',
  requestTimeoutMs = 1500,
  uhr = monotoneUhr,
  startAtMs,
} = {}) {
  if (
    !Array.isArray(containers) ||
    !containers.length ||
    containers.length > 16 ||
    containers.some(
      (eintrag) =>
        !/^[a-z][a-z0-9-]{0,39}$/.test(eintrag?.alias ?? '') ||
        typeof eintrag.container !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(eintrag.container),
    ) ||
    new Set(containers.map(({ alias }) => alias)).size !== containers.length ||
    new Set(containers.map(({ container }) => container)).size !== containers.length ||
    ![dockerSocketPath, cgroupRoot, procRoot].every(
      (pfad) => typeof pfad === 'string' && isAbsolute(pfad),
    ) ||
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1 ||
    requestTimeoutMs > 60_000 ||
    (startAtMs !== undefined && !Number.isFinite(startAtMs))
  ) {
    throw new Error('Ungültige Containerzuordnung, lokale Pfade oder Anfragefrist.');
  }
  const zustand = new Map();
  const snapshots = [];
  const start = startAtMs ?? uhr.now();
  let aktiv = false;
  async function cgroupLesen(info) {
    try {
      await readFile(resolve(cgroupRoot, 'cgroup.controllers'), 'utf8');
      const zuordnung = await readFile(resolve(procRoot, String(info.State.Pid), 'cgroup'), 'utf8');
      const gruppe = zuordnung
        .split('\n')
        .find((zeile) => zeile.startsWith('0::/'))
        ?.slice(3);
      if (!gruppe || !gruppe.includes(info.Id) || gruppe.split('/').includes('..'))
        throw new Error();
      const pfad = resolve(cgroupRoot, `.${gruppe}`);
      if (!pfad.startsWith(`${resolve(cgroupRoot)}${sep}`)) throw new Error();
      const davor = await stat(pfad, { bigint: true });
      const zeitpunkte = {};
      const werte = Object.fromEntries(
        await Promise.all(
          CGROUP_DATEIEN.map(async (name) => {
            try {
              const text = await readFile(resolve(pfad, name), 'utf8');
              zeitpunkte[name] = uhr.now() - start;
              return [name, text];
            } catch {
              return [name, undefined];
            }
          }),
        ),
      );
      const danach = await stat(pfad, { bigint: true });
      if (davor.ino !== danach.ino || davor.dev !== danach.dev) throw new Error();
      const metrics = parseCgroupV2(werte);
      for (const metrik of Object.values(metrics))
        if (metrik.available) {
          metrik.observedAtMs = zeitpunkte[metrik.source];
        }
      return {
        available: true,
        version: 2,
        metrics,
        identity: `${davor.dev}:${davor.ino}`,
      };
    } catch {
      return {
        available: false,
        reason: 'CGROUP_MAPPING_UNAVAILABLE',
        metrics: parseCgroupV2({}),
        identity: 'unavailable',
      };
    }
  }
  async function hostLesen() {
    let daten = '';
    try {
      daten = await readFile(resolve(procRoot, 'meminfo'), 'utf8');
    } catch {
      /* Fehlende Hostdaten bleiben sichtbar. */
    }
    const speicher = (name) =>
      gelesen(() => {
        const treffer = daten.match(new RegExp(`^${name}:\\s+(\\d+) kB$`, 'm'));
        return wert(ganzzahl(treffer?.[1]) * 1024, 'bytes', {
          source: 'collector-host-proc-meminfo',
        });
      });
    return {
      scope: 'collector-host',
      dockerHostMatchVerified: false,
      memoryTotal: speicher('MemTotal'),
      memoryAvailable: speicher('MemAvailable'),
      swapTotal: speicher('SwapTotal'),
      swapFree: speicher('SwapFree'),
      loadAverage: wert(loadavg(), 'load-1m-5m-15m', { source: 'collector-host-os' }),
    };
  }
  return {
    async sample(phase = 'DURING', signal = new AbortController().signal) {
      if (aktiv) throw new Error('Die vorherige Metrikerfassung läuft noch.');
      if (!['BEFORE', 'DURING', 'AFTER'].includes(phase)) throw new Error('Ungültige Messphase.');
      aktiv = true;
      const begonnen = uhr.now();
      const at = new Date().toISOString();
      try {
        const reihen = await Promise.all(
          containers.map(async ({ alias, container }) => {
            const get = (path) =>
              dockerJson(dockerSocketPath, path, { signal, timeoutMs: requestTimeoutMs });
            try {
              const info = await get(`/containers/${encodeURIComponent(container)}/json`);
              const identisch = identitaet(info);
              if (!info.State.Running) throw new Error('CONTAINER_STOPPED');
              const [daten, gruppe] = await Promise.all([
                get(`/containers/${info.Id}/stats?stream=false&one-shot=true`),
                cgroupLesen(info),
              ]);
              const bestaetigt = await get(`/containers/${encodeURIComponent(container)}/json`);
              if (identitaet(bestaetigt) !== identisch || !bestaetigt.State.Running)
                throw new Error('CONTAINER_CHANGED');
              const schluessel = `${identisch}:${gruppe.identity}`;
              const alt = zustand.get(alias);
              const generation =
                alt?.identity === schluessel ? alt.generation : (alt?.generation ?? 0) + 1;
              const messung = {
                alias,
                available: true,
                generation,
                atMs: uhr.now() - start,
                docker: dockerMetriken(daten, alt?.identity === schluessel ? alt.rawDocker : null),
                cgroup: {
                  available: gruppe.available,
                  version: gruppe.version ?? null,
                  reason: gruppe.reason ?? null,
                  metrics: gruppe.metrics,
                },
              };
              messung.delta = berechneContainerDifferenzen(alt?.previous, messung);
              zustand.set(alias, {
                identity: schluessel,
                generation,
                rawDocker: { cpu_stats: daten.cpu_stats },
                previous: messung,
              });
              return messung;
            } catch (fehler) {
              const sicher = new Set([
                'ABORTED',
                'TIMEOUT',
                'DOCKER_UNAVAILABLE',
                'DOCKER_HTTP_ERROR',
                'DOCKER_INVALID_JSON',
                'DOCKER_INVALID_IDENTITY',
                'DOCKER_READ_ERROR',
                'CONTAINER_STOPPED',
                'CONTAINER_CHANGED',
              ]);
              const messung = {
                alias,
                available: false,
                generation: zustand.get(alias)?.generation ?? null,
                atMs: uhr.now() - start,
                reason: sicher.has(fehler.message) ? fehler.message : 'COLLECTION_ERROR',
              };
              const alt = zustand.get(alias);
              if (alt) {
                alt.previous = messung;
                alt.rawDocker = null;
              }
              return messung;
            }
          }),
        );
        const host = await hostLesen();
        const ergebnis = {
          at,
          atMs: begonnen - start,
          phase,
          captureDurationMs: uhr.now() - begonnen,
          containers: reihen,
          host,
        };
        snapshots.push(ergebnis);
        return ergebnis;
      } finally {
        aktiv = false;
      }
    },
    summary() {
      return {
        snapshots: structuredClone(snapshots),
        containers: containers.map(({ alias }) => {
          const reihen = snapshots.flatMap((snapshot) =>
            snapshot.containers.filter((eintrag) => eintrag.alias === alias && eintrag.available),
          );
          const generationen = [...new Set(reihen.map(({ generation }) => generation))];
          return {
            alias,
            generations: generationen.map((generation) => {
              const gruppe = reihen.filter((eintrag) => eintrag.generation === generation);
              const maxima = (name) => {
                const werte = gruppe
                  .map((eintrag) => eintrag.cgroup.metrics[name])
                  .filter((metrik) => metrik.available)
                  .map(({ value }) => value);
                return werte.length ? Math.max(...werte) : null;
              };
              return {
                generation,
                samples: gruppe.length,
                sampledPeakMemoryBytes: maxima('memoryCurrent'),
                lifetimePeakMemoryBytes: maxima('memoryPeak'),
                peakScope: 'container-lifetime-including-warmup',
              };
            }),
          };
        }),
      };
    },
  };
}

export async function sammleContainerMetriken({
  collector,
  durationMs = 300_000,
  intervalMs = 2000,
  signal = new AbortController().signal,
  uhr = monotoneUhr,
  startAtMs = uhr.now(),
}) {
  if (
    ![durationMs, intervalMs].every((zahl) => Number.isSafeInteger(zahl) && zahl > 0) ||
    !Number.isFinite(startAtMs) ||
    Math.ceil(durationMs / intervalMs) > 100000
  )
    throw new Error('Ungültiger Messzeitplan.');
  const auslassungen = [];
  const ende = startAtMs + durationMs;
  try {
    await uhr.waitUntil(startAtMs, signal);
    if (!signal.aborted) await collector.sample('BEFORE', signal);
    for (let zeit = startAtMs + intervalMs; zeit < ende; zeit += intervalMs) {
      await uhr.waitUntil(zeit, signal);
      if (signal.aborted) break;
      if (uhr.now() >= Math.min(zeit + intervalMs, ende))
        auslassungen.push({ scheduledAtMs: zeit - startAtMs, reason: 'SCHEDULE_DELAY' });
      else await collector.sample('DURING', signal);
    }
    await uhr.waitUntil(ende, signal);
    if (!signal.aborted) await collector.sample('AFTER', signal);
  } catch (fehler) {
    if (!signal.aborted) throw fehler;
  }
  return {
    ...collector.summary(),
    interrupted: signal.aborted,
    durationMs,
    intervalMs,
    observedDurationMs: uhr.now() - startAtMs,
    plannedSamples: Math.ceil(durationMs / intervalMs) + 1,
    skippedSamples: auslassungen,
  };
}
