import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function buildExperimentResult({ config, driver, log, transport }) {
  const events = [...log.matchAll(/qa_summary:completed \{([^}]*)\}/g)].map((m) => ({
    mode: m[1].match(/effectiveMode: ['"]([^'"]+)['"]/)?.[1] ?? null,
    reason: m[1].match(/fallbackReason: ['"]([^'"]+)['"]/)?.[1] ?? null,
    jobMs: Number(m[1].match(/latencyMs: (\d+)/)?.[1]),
  }));
  const frames = transport
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [time, stream, source, len, method, uri, status, syn, reset] = line.split('\t');
      return {
        time: Number(time) * 1000,
        stream,
        source,
        len,
        method,
        uri,
        status: Number(status),
        syn: syn === '1',
        reset: reset === '1',
      };
    });
  const requests = driver.auftraege ?? [];
  const jobs = requests.map((r, i) => {
    const matched =
      r.consumer !== 'label' &&
      events.length === requests.length &&
      events[i]?.mode === r.effectiveMode &&
      events[i]?.reason === r.fallbackReason &&
      Number.isFinite(events[i]?.jobMs);
    const framesInWindow = frames.filter(
      (f) => f.time >= Date.parse(r.requestedAt) && f.time <= Date.parse(r.finishedAt),
    );
    const http = framesInWindow.filter((f) => f.source === '192.168.150.10');
    const slots = http.filter((f) => f.method === 'GET' && f.uri?.startsWith('/slots')).length;
    const posts = http.filter((f) => f.method === 'POST').length;
    const connections = new Set(http.filter((f) => f.syn).map((f) => f.stream)).size;
    const resets = framesInWindow.filter((f) => f.source === '192.168.150.20' && f.reset).length;
    const statuses = framesInWindow.filter((f) => f.status > 0).map((f) => f.status);
    let faultObserved = null;
    if (config.variant === 'f1') faultObserved = connections > 0 && resets > 0;
    if (config.variant === 'f2')
      faultObserved = connections > 0 && resets === 0 && statuses.length === 0;
    if (config.variant === 'l3') faultObserved = posts > 0;
    if (config.variant === 'busy')
      faultObserved = slots > 0 && posts === 0 && statuses.includes(503);
    if (config.variant === 'race') faultObserved = slots > 0 && posts > 0 && statuses.includes(503);
    return {
      index: r.index ?? i + 1,
      consumer: r.consumer ?? 'summary',
      effectiveMode: r.effectiveMode,
      fallbackReason: r.fallbackReason,
      labelSettlement: r.labelSettlement ?? null,
      jobMs: matched ? events[i].jobMs : null,
      inferMs: null,
      clientWaitMs: r.clientWaitMs,
      transport: { slots, posts, connections, resets, statuses },
      faultObserved,
      noTransportObserved: slots === 0 && posts === 0 && connections === 0,
    };
  });
  const timed = jobs.length > 0 && jobs.every((j) => j.consumer === 'summary' && j.jobMs !== null);
  const f1 = jobs.filter((j) => j.faultObserved === true);
  const times = f1.map((j) => j.jobMs).sort((a, b) => a - b);
  const median =
    times.length % 2
      ? times[Math.floor(times.length / 2)]
      : (times[times.length / 2 - 1] + times[times.length / 2]) / 2;
  return {
    config,
    jobs,
    live: driver.live ?? null,
    fallbackWithinBudget: timed
      ? jobs.every(
          (j) =>
            j.effectiveMode === 'extractive' &&
            j.fallbackReason &&
            j.jobMs <= config.timeoutMs + 1000,
        )
      : null,
    f1Fast: config.variant === 'f1' && timed && f1.length > 0 ? median <= 2000 : null,
    medianF1JobMs: config.variant === 'f1' && timed && f1.length > 0 ? median : null,
    breakerObservation:
      'indirect: compare sequential sessions, timing and transport; no internal breaker state exposed',
    inferenceTiming: 'not synthesized; use zerlegung for real-runtime timing when complete',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Laufverzeichnis fehlt.');
  const json = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  const result = buildExperimentResult({
    config: json('experiment-config.json'),
    driver: json('treiber.json'),
    log: readFileSync(join(dir, 'app.log'), 'utf8'),
    transport: readFileSync(join(dir, 'app.tsv'), 'utf8'),
  });
  writeFileSync(join(dir, 'experiment.json'), JSON.stringify(result, null, 2) + '\n');
}
