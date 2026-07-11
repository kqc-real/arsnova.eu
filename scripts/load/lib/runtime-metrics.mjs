import { execFile } from 'node:child_process';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? null;
}

function rounded(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function unavailable(reason) {
  return { available: false, reason };
}

function summarizeSamples(samples) {
  const values = samples
    .map((sample) => sample.durationMs)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const errors = samples.filter((sample) => sample.ok === false);
  return {
    available: values.length > 0,
    samples: samples.length,
    successfulSamples: values.length,
    errors: errors.length,
    errorRatePercent: samples.length > 0 ? rounded((errors.length / samples.length) * 100) : null,
    p50Ms: rounded(percentile(values, 50)),
    p95Ms: rounded(percentile(values, 95)),
    p99Ms: rounded(percentile(values, 99)),
    maxMs: rounded(values.length > 0 ? Math.max(...values) : null),
    lastError: errors.at(-1)?.error ?? null,
  };
}

async function importWithFallback(packageName, fallbackUrl) {
  try {
    return await import(packageName);
  } catch {
    return import(fallbackUrl);
  }
}

async function createRedisProbe(redisUrl) {
  if (!redisUrl) return { probe: null, close: null, status: unavailable('keine URL konfiguriert') };
  try {
    const module = await importWithFallback(
      'ioredis',
      new URL('../../../apps/backend/node_modules/ioredis/built/index.js', import.meta.url).href,
    );
    const Redis = module.default;
    const client = new Redis(redisUrl, {
      connectTimeout: 2_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    client.on('error', () => {});
    return {
      status: { available: true, source: 'configured-url' },
      async probe() {
        if (client.status === 'wait') await client.connect();
        const result = await client.ping();
        if (result !== 'PONG') throw new Error(`unerwartete Redis-Antwort: ${result}`);
      },
      async close() {
        if (client.status === 'ready') await client.quit();
        else client.disconnect();
      },
    };
  } catch (error) {
    return { probe: null, close: null, status: unavailable(errorMessage(error)) };
  }
}

async function createPostgresProbe(databaseUrl) {
  if (!databaseUrl) {
    return { probe: null, close: null, status: unavailable('keine URL konfiguriert') };
  }
  try {
    const module = await importWithFallback(
      'pg',
      new URL('../../../apps/backend/node_modules/pg/lib/index.js', import.meta.url).href,
    );
    const Client = module.Client ?? module.default?.Client;
    const client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2_000,
      query_timeout: 2_000,
    });
    await client.connect();
    return {
      status: { available: true, source: 'configured-url' },
      async probe() {
        await client.query('SELECT 1');
      },
      async close() {
        await client.end();
      },
    };
  } catch (error) {
    return { probe: null, close: null, status: unavailable(errorMessage(error)) };
  }
}

async function readProcessSample(pid) {
  const { stdout } = await execFileAsync('ps', ['-o', 'rss=,vsz=,%cpu=', '-p', String(pid)], {
    timeout: 2_000,
  });
  const fields = stdout.trim().split(/\s+/);
  if (fields.length < 3) throw new Error(`Prozess ${pid} nicht gefunden`);
  const [rssKb, virtualKb, cpuPercent] = fields.map(Number);
  if (![rssKb, virtualKb, cpuPercent].every(Number.isFinite)) {
    throw new Error(`ps-Ausgabe für PID ${pid} ist nicht auswertbar`);
  }
  return {
    rssBytes: rssKb * 1024,
    virtualBytes: virtualKb * 1024,
    cpuPercent,
  };
}

async function timedSample(target, operation) {
  const startedAt = performance.now();
  try {
    await operation();
    target.push({
      at: new Date().toISOString(),
      ok: true,
      durationMs: rounded(performance.now() - startedAt),
    });
  } catch (error) {
    target.push({
      at: new Date().toISOString(),
      ok: false,
      durationMs: null,
      error: errorMessage(error),
    });
  }
}

export function createRuntimeMetrics(options = {}) {
  const intervalMs = Math.max(1_000, Number(options.intervalMs ?? 10_000));
  const backendPid =
    options.backendPid === undefined || options.backendPid === null
      ? null
      : Number(options.backendPid);
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  const startedAt = new Date();
  const operationSamples = [];
  const healthSamples = [];
  const redisSamples = [];
  const postgresSamples = [];
  const processSamples = [];
  let redis = { probe: null, close: null, status: unavailable('noch nicht initialisiert') };
  let postgres = { probe: null, close: null, status: unavailable('noch nicht initialisiert') };
  let interval = null;
  let sampleInFlight = null;
  let processStatus =
    backendPid === null
      ? unavailable('SOAK_BACKEND_PID nicht gesetzt')
      : { available: true, source: 'ps', pid: backendPid };

  async function sample() {
    if (sampleInFlight) return sampleInFlight;
    sampleInFlight = (async () => {
      const tasks = [];
      if (typeof options.healthStats === 'function') {
        tasks.push(
          (async () => {
            const started = performance.now();
            try {
              const stats = await options.healthStats();
              healthSamples.push({
                at: new Date().toISOString(),
                ok: true,
                durationMs: rounded(performance.now() - started),
                stats: {
                  serviceStatus: stats?.serviceStatus ?? null,
                  loadStatus: stats?.loadStatus ?? null,
                  openSessions: stats?.openSessions ?? null,
                  activeSessions: stats?.activeSessions ?? null,
                  totalParticipants: stats?.totalParticipants ?? null,
                  votesLastMinute: stats?.votesLastMinute ?? null,
                  sessionTransitionsLastMinute: stats?.sessionTransitionsLastMinute ?? null,
                  activeCountdownSessions: stats?.activeCountdownSessions ?? null,
                  activeBlitzRounds: stats?.activeBlitzRounds ?? null,
                },
              });
            } catch (error) {
              healthSamples.push({
                at: new Date().toISOString(),
                ok: false,
                durationMs: null,
                error: errorMessage(error),
              });
            }
          })(),
        );
      }
      if (redis.probe) tasks.push(timedSample(redisSamples, redis.probe));
      if (postgres.probe) tasks.push(timedSample(postgresSamples, postgres.probe));
      if (backendPid !== null) {
        tasks.push(
          readProcessSample(backendPid)
            .then((value) => {
              processStatus = { available: true, source: 'ps', pid: backendPid };
              processSamples.push({ at: new Date().toISOString(), ok: true, ...value });
            })
            .catch((error) => {
              processStatus = unavailable(errorMessage(error));
              processSamples.push({
                at: new Date().toISOString(),
                ok: false,
                error: errorMessage(error),
              });
            }),
        );
      }
      await Promise.all(tasks);
    })().finally(() => {
      sampleInFlight = null;
    });
    return sampleInFlight;
  }

  return {
    async start() {
      if (interval) return;
      [redis, postgres] = await Promise.all([
        createRedisProbe(options.redisUrl),
        createPostgresProbe(options.databaseUrl),
      ]);
      eventLoop.enable();
      await sample();
      interval = setInterval(() => void sample(), intervalMs);
      interval.unref();
    },

    async measure(label, operation) {
      const started = performance.now();
      try {
        const value = await operation();
        operationSamples.push({
          at: new Date().toISOString(),
          label,
          ok: true,
          durationMs: rounded(performance.now() - started),
        });
        return value;
      } catch (error) {
        operationSamples.push({
          at: new Date().toISOString(),
          label,
          ok: false,
          durationMs: rounded(performance.now() - started),
          error: errorMessage(error),
        });
        throw error;
      }
    },

    async stop() {
      if (interval) clearInterval(interval);
      interval = null;
      await sampleInFlight;
      eventLoop.disable();
      await Promise.allSettled([redis.close?.(), postgres.close?.()]);
    },

    report() {
      const validProcessSamples = processSamples.filter((sample) => sample.ok);
      const firstProcess = validProcessSamples[0];
      const lastProcess = validProcessSamples.at(-1);
      const healthSummary = summarizeSamples(healthSamples);
      return {
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        targetHttp: {
          ...summarizeSamples(operationSamples),
          byOperation: Object.fromEntries(
            [...new Set(operationSamples.map((sample) => sample.label))].map((label) => [
              label,
              summarizeSamples(operationSamples.filter((sample) => sample.label === label)),
            ]),
          ),
        },
        eventLoop: {
          available: eventLoop.count > 0,
          source: 'load-generator-process',
          count: eventLoop.count,
          meanMs: rounded(eventLoop.mean / 1e6),
          p95Ms: rounded(eventLoop.percentile(95) / 1e6),
          p99Ms: rounded(eventLoop.percentile(99) / 1e6),
          maxMs: rounded(eventLoop.max / 1e6),
        },
        healthStats: {
          ...healthSummary,
          source: 'health.stats',
          rawSloFields: unavailable(
            'health.stats exponiert nur serviceStatus/loadStatus, keine rohen SLO-Perzentile',
          ),
          snapshots: healthSamples,
        },
        backendProcess: {
          ...processStatus,
          samples: processSamples,
          rssStartBytes: firstProcess?.rssBytes ?? null,
          rssEndBytes: lastProcess?.rssBytes ?? null,
          rssGrowthBytes:
            validProcessSamples.length >= 2 && firstProcess && lastProcess
              ? lastProcess.rssBytes - firstProcess.rssBytes
              : null,
          peakRssBytes:
            validProcessSamples.length > 0
              ? Math.max(...validProcessSamples.map((sample) => sample.rssBytes))
              : null,
        },
        redisPing: { ...redis.status, ...summarizeSamples(redisSamples) },
        postgresSelect1: { ...postgres.status, ...summarizeSamples(postgresSamples) },
      };
    },
  };
}
