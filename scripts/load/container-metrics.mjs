#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  CGROUP_DATEIEN,
  erstelleContainerMetriken,
  sammleContainerMetriken,
} from './lib/container-metrics.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';

async function main(args) {
  if (args.length === 1 && args[0] === '--validate') {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'network-free-validation',
          intervalMs: 2000,
          durationMs: 300000,
          transport: 'local-docker-unix-socket',
          cgroupVersion: 2,
          files: CGROUP_DATEIEN,
          peakScope: 'container-lifetime-including-warmup',
          productionChanges: false,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (args.length !== 3 || args[0] !== '--run' || args[1] !== '--config-file') {
    throw new Error('Genau --validate oder --run mit --config-file verwenden.');
  }
  let config;
  try {
    config = JSON.parse(await readFile(args[2], 'utf8'));
  } catch {
    throw new Error('Die Laborzuordnung konnte nicht gelesen werden.');
  }
  const collector = erstelleContainerMetriken(config);
  const abbruch = new AbortController();
  const abbrechen = () => abbruch.abort();
  process.once('SIGINT', abbrechen);
  process.once('SIGTERM', abbrechen);
  try {
    const bericht = await sammleContainerMetriken({
      collector,
      durationMs: config.durationMs,
      intervalMs: config.intervalMs,
      signal: abbruch.signal,
    });
    // Eine vollständige Erfassung ist noch keine bestandene A1-Grenzwertprüfung.
    bericht.complete =
      !bericht.interrupted &&
      bericht.skippedSamples.length === 0 &&
      bericht.snapshots.length === bericht.plannedSamples &&
      bericht.snapshots.every(
        (snapshot) =>
          snapshot.containers.every(
            (eintrag) =>
              eintrag.available &&
              eintrag.cgroup.available &&
              Object.values(eintrag.cgroup.metrics).every((metrik) => metrik.available) &&
              ['memoryUsage', 'memoryWorkingSet', 'memoryLimit', 'pidsCurrent'].every(
                (name) => eintrag.docker[name].available,
              ),
          ) &&
          ['memoryTotal', 'memoryAvailable', 'swapTotal', 'swapFree'].every(
            (name) => snapshot.host[name].available,
          ),
      );
    await writeScenarioReport({
      scenario: 'container-metrics',
      metrics: bericht,
      failures: bericht.complete
        ? []
        : ['Container-Erfassung unvollständig, nicht verfügbar oder abgebrochen.'],
    });
    process.stdout.write(`${JSON.stringify(bericht, null, 2)}\n`);
    if (!bericht.complete) process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', abbrechen);
    process.removeListener('SIGTERM', abbrechen);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv.slice(2));
  } catch {
    process.stderr.write(
      'Die Metrikerfassung konnte nicht ausgeführt werden. Optionen, Laborzuordnung und Schreibrechte prüfen.\n',
    );
    process.exitCode = 1;
  }
}
