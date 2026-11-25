import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  parseCgroupV2,
  berechneContainerDifferenzen,
  erstelleContainerMetriken,
  sammleContainerMetriken,
} from './container-metrics.mjs';

const id = 'a'.repeat(64);
const dateien = (usage = 10000, perioden = 10, gedrosselt = 1, oom = 0) => ({
  'cpu.stat': `usage_usec ${usage}\nuser_usec 8000\nsystem_usec 2000\nnr_periods ${perioden}\nnr_throttled ${gedrosselt}\nthrottled_usec 100\n`,
  'cpu.max': '25000 100000\n',
  'memory.current': '100000000\n',
  'memory.peak': '800000000\n',
  'memory.max': '1073741824\n',
  'memory.events': `low 0\nhigh 0\nmax 0\noom 0\noom_kill ${oom}\n`,
  'pids.current': '4\n',
  'pids.max': '64\n',
});
const einzelmessung = (werte, atMs = 0, generation = 1) => ({
  available: true,
  generation,
  atMs,
  cgroup: { available: true, metrics: parseCgroupV2(werte) },
});

test('liest cgroup-v2-Roheinheiten und unterscheidet Lebenszeit-Peak und aktuelles RAM', () => {
  const messung = parseCgroupV2(dateien());
  assert.equal(messung.cpuStat.value.usage_usec, 10000);
  assert.equal(messung.memoryCurrent.value, 100000000);
  assert.equal(messung.memoryPeak.value, 800000000);
  assert.equal(messung.memoryPeak.scope, 'container-lifetime-including-warmup');
  assert.equal(messung.memoryLimit.value, 1073741824);
  assert.equal(messung.cpuLimit.value, 0.25);
  assert.equal(messung.pidsCurrent.value, 4);
  assert.equal(messung.oomKill.value, 0);
});

test('kennzeichnet fehlende, ungültige und nicht sicher darstellbare Werte sowie unbegrenzte Limits', () => {
  const messung = parseCgroupV2({
    ...dateien(),
    'memory.peak': undefined,
    'memory.current': 'NaN',
    'memory.max': 'max\n',
    'pids.max': 'max\n',
    'cpu.max': 'max 100000\n',
    'cpu.stat': 'usage_usec 9007199254740993\nnr_periods -1\n',
  });
  assert.equal(messung.memoryPeak.available, false);
  assert.equal(messung.memoryCurrent.value, null);
  assert.equal(messung.cpuStat.available, false);
  assert.equal(messung.memoryLimit.available, true);
  assert.equal(messung.memoryLimit.unlimited, true);
  assert.equal(messung.memoryLimit.value, null);
  assert.equal(messung.cpuLimit.unlimited, true);
  assert.equal(messung.pidsLimit.unlimited, true);
});

test('berechnet CPU-, Throttling- und OOM-Differenzen nur über vergleichbare Messungen', () => {
  const vorher = einzelmessung(dateien());
  const nachher = einzelmessung(dateien(510000, 30, 2, 1), 2000);
  const delta = berechneContainerDifferenzen(vorher, nachher);
  assert.equal(delta.cpuPercent.value, 25);
  assert.equal(delta.throttledPeriodRatio.value, 0.05);
  assert.equal(delta.oomKill.value, 1);
  for (const ungeeignet of [
    undefined,
    { ...vorher, generation: 2 },
    { ...vorher, available: false },
    { ...vorher, atMs: 2000 },
    { ...vorher, atMs: NaN },
    { ...vorher, alias: 'anderer-container' },
    einzelmessung(dateien(610000, 40, 3, 2)),
  ]) {
    const ergebnis = berechneContainerDifferenzen(ungeeignet, nachher);
    assert.equal(ergebnis.cpuPercent.available, false);
  }
  assert.equal(
    berechneContainerDifferenzen(vorher, einzelmessung(dateien(20000, 10, 1), 2000))
      .throttledPeriodRatio.available,
    false,
  );
});

test('behält beobachtete Throttling-Verhältnisse auch oberhalb von eins unverfälscht bei', () => {
  const delta = berechneContainerDifferenzen(
    einzelmessung(dateien()),
    einzelmessung(dateien(20000, 11, 4), 2000),
  );
  assert.equal(delta.throttledPeriodRatio.value, 3);
});

test('berechnet die CPU-Auslastung mit den Zeitpunkten der Zählerlesung statt dem späteren Dockerabschluss', () => {
  const vorher = einzelmessung(dateien(), 500);
  const nachher = einzelmessung(dateien(510000, 30, 2), 2600);
  vorher.cgroup.metrics.cpuStat.observedAtMs = 0;
  nachher.cgroup.metrics.cpuStat.observedAtMs = 2000;
  assert.equal(berechneContainerDifferenzen(vorher, nachher).cpuPercent.value, 25);
});

async function umgebung(t, { ohneVorherigeCpu = false, cpuNull = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'arsnova-cgroup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cgroupRoot = join(root, 'cgroup');
  const procRoot = join(root, 'proc');
  const pfad = join(cgroupRoot, `docker-${id}.scope`);
  await mkdir(pfad, { recursive: true });
  await mkdir(join(procRoot, '123'), { recursive: true });
  await writeFile(join(cgroupRoot, 'cgroup.controllers'), 'cpu memory pids');
  await writeFile(join(procRoot, '123/cgroup'), `0::/docker-${id}.scope\n`);
  await writeFile(
    join(procRoot, 'meminfo'),
    'MemTotal: 16000 kB\nMemAvailable: 8000 kB\nSwapTotal: 4000 kB\nSwapFree: 3000 kB\n',
  );
  async function aktualisieren(werte) {
    await Promise.all(
      Object.entries(werte).map(([name, wert]) => writeFile(join(pfad, name), wert)),
    );
  }
  await aktualisieren(dateien());
  let startedAt = '2026-11-11T00:00:00Z';
  let running = true;
  let waehrendErfassungNeustarten = false;
  const anfragen = [];
  let statistikNummer = 0;
  const server = createServer((req, res) => {
    anfragen.push({ method: req.method, url: req.url });
    res.setHeader('content-type', 'application/json');
    if (req.url.endsWith('/json')) {
      res.end(
        JSON.stringify({
          Id: id,
          RestartCount: 0,
          State: { Running: running, Pid: 123, StartedAt: startedAt },
          Config: { Env: ['VERTRAULICH=niemals-ausgeben'] },
        }),
      );
    } else if (req.url.includes('/stats?')) {
      if (waehrendErfassungNeustarten) startedAt = '2026-11-11T00:01:00Z';
      statistikNummer++;
      const statistik = {
        cpu_stats: {
          cpu_usage: { total_usage: 100 + statistikNummer * 500 },
          system_cpu_usage: 1000 + statistikNummer * 1000,
          online_cpus: 2,
        },
        precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000 },
        memory_stats: { usage: 100000000, limit: 1073741824, stats: { inactive_file: 20000000 } },
        pids_stats: { current: 4 },
      };
      if (cpuNull) {
        statistik.cpu_stats.cpu_usage.total_usage = 0;
        statistik.precpu_stats.cpu_usage.total_usage = 0;
      }
      if (ohneVorherigeCpu) delete statistik.precpu_stats;
      res.end(JSON.stringify(statistik));
    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  });
  const dockerSocketPath = join(root, 'docker.sock');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(dockerSocketPath, resolve);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  let zeit = 0;
  const config = {
    containers: [{ alias: 'spacy', container: 'labor-spacy' }],
    dockerSocketPath,
    cgroupRoot,
    procRoot,
  };
  const collector = erstelleContainerMetriken({ ...config, uhr: { now: () => zeit } });
  return {
    collector,
    config,
    root,
    aktualisieren,
    anfragen,
    pfad,
    procRoot,
    zeit: (wert) => {
      zeit = wert;
    },
    stoppen: () => {
      running = false;
    },
    neustarten: () => {
      startedAt = '2026-11-11T00:02:00Z';
    },
    neustartImSample: () => {
      waehrendErfassungNeustarten = true;
    },
  };
}

test('richtet Container- und Zählerzeitpunkte am gemeinsamen Messfensterbeginn aus', async (t) => {
  const env = await umgebung(t);
  const collector = erstelleContainerMetriken({
    ...env.config,
    startAtMs: 900,
    uhr: { now: () => 1000 },
  });
  const messung = await collector.sample('BEFORE');
  assert.equal(messung.atMs, 100);
  assert.equal(messung.containers[0].atMs, 100);
  assert.equal(messung.containers[0].cgroup.metrics.cpuStat.observedAtMs, 100);
});

test('erfasst echte Docker-HTTP-Antworten und cgroup-Dateien ohne private Metadaten im Report', async (t) => {
  const env = await umgebung(t);
  const vorher = await env.collector.sample('BEFORE');
  await env.aktualisieren({ ...dateien(510000, 30, 2, 1), 'memory.current': '120000000\n' });
  env.zeit(2000);
  const nachher = await env.collector.sample('AFTER');
  const messung = nachher.containers[0];
  assert.equal(messung.available, true);
  assert.equal(messung.docker.cpuPercent.value, 100);
  assert.equal(messung.docker.memoryUsage.value, 100000000);
  assert.equal(messung.docker.memoryWorkingSet.value, 80000000);
  assert.equal(messung.cgroup.metrics.memoryCurrent.value, 120000000);
  assert.equal(messung.delta.throttledPeriodRatio.value, 0.05);
  assert.equal(nachher.host.memoryAvailable.value, 8192000);
  const summary = env.collector.summary();
  assert.equal(summary.containers[0].generations[0].sampledPeakMemoryBytes, 120000000);
  assert.equal(summary.containers[0].generations[0].lifetimePeakMemoryBytes, 800000000);
  assert.ok(env.anfragen.every(({ method }) => method === 'GET'));
  assert.ok(
    env.anfragen.some(({ url }) => url.includes('stream=false') && url.includes('one-shot=true')),
  );
  assert.doesNotMatch(
    JSON.stringify({ vorher, nachher, summary }),
    /niemals-ausgeben|labor-spacy|docker\.sock|aaaaa/,
  );
});

test('trennt Neustarts und verwirft einen Containerwechsel während der Erfassung', async (t) => {
  const env = await umgebung(t);
  await env.collector.sample();
  env.neustarten();
  env.zeit(2000);
  const danach = (await env.collector.sample()).containers[0];
  assert.equal(danach.generation, 2);
  assert.equal(danach.delta.cpuPercent.available, false);
  env.neustartImSample();
  const instabil = (await env.collector.sample()).containers[0];
  assert.equal(instabil.available, false);
  assert.equal(instabil.reason, 'CONTAINER_CHANGED');
});

test('meldet gestoppte Container, falsche PID-Zuordnung und fehlende cgroup-Dateien als nicht verfügbar', async (t) => {
  const env = await umgebung(t);
  await rm(join(env.pfad, 'memory.peak'));
  const unvollstaendig = (await env.collector.sample()).containers[0];
  assert.equal(unvollstaendig.cgroup.metrics.memoryPeak.available, false);
  assert.equal(unvollstaendig.cgroup.metrics.memoryCurrent.available, true);
  await writeFile(join(env.procRoot, '123/cgroup'), '0::/anderer-prozess\n');
  const falsch = (await env.collector.sample()).containers[0];
  assert.equal(falsch.docker.memoryUsage.available, true);
  assert.equal(falsch.cgroup.available, false);
  env.stoppen();
  assert.equal((await env.collector.sample()).containers[0].reason, 'CONTAINER_STOPPED');
  const leer = erstelleContainerMetriken({
    containers: [{ alias: 'app', container: 'labor-app' }],
    dockerSocketPath: join(env.pfad, 'fehlt.sock'),
  });
  assert.equal((await leer.sample()).containers[0].available, false);
});

test('verwendet bei Docker-Einzelabfragen erst ab der zweiten Messung eigene vorherige CPU-Zähler', async (t) => {
  const env = await umgebung(t, { ohneVorherigeCpu: true });
  assert.equal((await env.collector.sample()).containers[0].docker.cpuPercent.available, false);
  env.zeit(2000);
  assert.equal((await env.collector.sample()).containers[0].docker.cpuPercent.value, 100);
});

test('unterscheidet vorhandene CPU-Zähler mit Nullwerten von einer fehlenden vorherigen Statistik', async (t) => {
  const env = await umgebung(t, { cpuNull: true });
  const cpu = (await env.collector.sample()).containers[0].docker.cpuPercent;
  assert.equal(cpu.available, true);
  assert.equal(cpu.value, 0);
});

test('erstellt eine Zeitreihe mit Anfangs- und Endmessung ohne überlappende Erfassung', async () => {
  let zeit = 0;
  const phasen = [];
  const collector = {
    async sample(phase) {
      phasen.push(phase);
    },
    summary: () => ({ snapshots: phasen }),
  };
  const bericht = await sammleContainerMetriken({
    collector,
    durationMs: 4000,
    intervalMs: 2000,
    uhr: {
      now: () => zeit,
      async waitUntil(ziel) {
        zeit = Math.max(zeit, ziel);
      },
    },
  });
  assert.deepEqual(phasen, ['BEFORE', 'DURING', 'AFTER']);
  assert.equal(bericht.interrupted, false);
  assert.equal(bericht.plannedSamples, 3);
});

test('protokolliert ausgelassene Abtastpunkte und beendet eine abgebrochene Erfassung ohne weitere Messungen', async () => {
  let zeit = 0;
  const phasen = [];
  const collector = {
    async sample(phase) {
      phasen.push(phase);
      zeit += 2500;
    },
    summary: () => ({ snapshots: phasen }),
  };
  const uhr = {
    now: () => zeit,
    async waitUntil(ziel) {
      zeit = Math.max(zeit, ziel);
    },
  };
  const langsam = await sammleContainerMetriken({
    collector,
    durationMs: 4000,
    intervalMs: 1000,
    uhr,
  });
  assert.ok(langsam.skippedSamples.length > 0);
  assert.equal(phasen.at(-1), 'AFTER');
  const abbruch = new AbortController();
  const vorAbbruch = phasen.length;
  const abgebrochen = await sammleContainerMetriken({
    collector: {
      async sample() {
        phasen.push('BEFORE');
        abbruch.abort();
      },
      summary: collector.summary,
    },
    durationMs: 4000,
    intervalMs: 1000,
    uhr,
    signal: abbruch.signal,
  });
  assert.equal(abgebrochen.interrupted, true);
  assert.equal(phasen.length, vorAbbruch + 1);
});

test('validiert die Metrik-CLI offline und schreibt einen bereinigten Laborreport', async (t) => {
  const env = await umgebung(t);
  const cli = fileURLToPath(new URL('../container-metrics.mjs', import.meta.url));
  const ausfuehren = promisify(execFile);
  const validierung = await ausfuehren(process.execPath, [cli, '--validate'], { timeout: 15000 });
  assert.equal(JSON.parse(validierung.stdout).intervalMs, 2000);
  assert.equal(env.anfragen.length, 0);
  const datei = join(env.root, 'zuordnung.json');
  const report = join(env.root, 'report.json');
  const junit = join(env.root, 'report.xml');
  await writeFile(datei, JSON.stringify({ ...env.config, durationMs: 200, intervalMs: 100 }));
  const { stdout } = await ausfuehren(process.execPath, [cli, '--run', '--config-file', datei], {
    env: { ...process.env, REPORT_FILE: report, JUNIT_FILE: junit },
    timeout: 15000,
  });
  assert.equal(JSON.parse(stdout).complete, true);
  const artefakt = await readFile(report, 'utf8');
  assert.equal(JSON.parse(artefakt).metrics.complete, true);
  assert.match(await readFile(junit, 'utf8'), /failures="0"/);
  assert.doesNotMatch(artefakt + stdout, /niemals-ausgeben|labor-spacy|docker\.sock|aaaaa/);
});

test('speichert nicht verfügbare Container als fehlgeschlagene Erfassung statt als Nullwerte', async (t) => {
  const env = await umgebung(t);
  const cli = fileURLToPath(new URL('../container-metrics.mjs', import.meta.url));
  const datei = join(env.root, 'nicht-verfuegbar.json');
  const report = join(env.root, 'fehlgeschlagen.json');
  await writeFile(
    datei,
    JSON.stringify({
      ...env.config,
      dockerSocketPath: join(env.root, 'fehlt.sock'),
      durationMs: 20,
      intervalMs: 10,
    }),
  );
  await assert.rejects(
    promisify(execFile)(process.execPath, [cli, '--run', '--config-file', datei], {
      env: { ...process.env, REPORT_FILE: report, JUNIT_FILE: '' },
      timeout: 15000,
    }),
    (fehler) => {
      assert.equal(fehler.code, 1);
      assert.equal(JSON.parse(fehler.stdout).complete, false);
      return true;
    },
  );
  const daten = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(daten.metrics.snapshots[0].containers[0].available, false);
  assert.ok(daten.assertions.some(({ passed }) => !passed));
});
