#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { evaluateLiveComparison } from './experiment.mjs';
const median = (values) => {
  const a = [...values].sort((a, b) => a - b),
    n = a.length;
  return n ? (n % 2 ? a[Math.floor(n / 2)] : (a[n / 2 - 1] + a[n / 2]) / 2) : null;
};
function manifest(r) {
  if (
    !r?.settings ||
    !r?.commit ||
    !r.rechner ||
    !r.energieprofil ||
    !r.appHost?.image ||
    !r.llmHost?.modellSha256 ||
    !r.umgebung?.rechner ||
    !r.umgebung?.hypervisor ||
    !r.umgebung?.vms?.length ||
    !r.experiment?.config?.consumer
  )
    return null;
  if (
    r.experiment.config.consumer === 'label' &&
    (!r.runtimeVersions?.appHost ||
      !r.runtimeVersions?.llmHost ||
      !r.runtimeVersions?.appContainer ||
      !r.treiber?.fixtureId ||
      r.settingsSource !== 'app-container-environment')
  )
    return null;
  // Zeitstempel, Prozesszustände und freie RAM-Mengen sind keine Versuchsparameter.
  const host = r.umgebung.rechner;
  return {
    settings: r.settings,
    settingsSource: r.settingsSource ?? null,
    runtimeVersions: r.runtimeVersions ?? null,
    fixtureId: r.treiber?.fixtureId ?? null,
    commit: r.commit,
    rechner: r.rechner,
    energieprofil: r.energieprofil,
    timeoutMs: r.timeoutMs,
    appHost: r.appHost,
    llmHost: r.llmHost,
    encoderImage: r.encoderImage,
    consumer: r.experiment.config.consumer,
    host: {
      cpu: host.cpu,
      kerne: host.kerne,
      threads: host.threads,
      ramGib: host.ramGib,
      os: host.os,
      kernel: host.kernel,
    },
    hypervisor: r.umgebung.hypervisor,
    vms: r.umgebung.vms.map((v) => ({
      name: v.name,
      vcpu: v.vcpu,
      ramGib: v.ramGib,
      cpuset: v.cpuset,
      cpuReserveProzent: v.cpuReserveProzent,
      cpuGewicht: v.cpuGewicht,
      plattenMaxGib: v.plattenMaxGib,
    })),
  };
}
export function compareExperiments(baseline, candidate) {
  const a = manifest(baseline),
    b = manifest(candidate);
  if (!a || !b || !isDeepStrictEqual(a, b))
    return {
      comparable: false,
      reason: 'MANIFEST_MISSING_OR_DIFFERENT',
      live: { passed: null },
      f2OverF1: { passed: null },
    };
  const result = {
    comparable: true,
    live: evaluateLiveComparison(baseline.experiment.live, candidate.experiment.live),
    f2OverF1: { passed: null },
  };
  if (baseline.experiment.config.variant === 'f1' && candidate.experiment.config.variant === 'f2') {
    const observed = (r) =>
      (r.experiment.jobs ?? []).filter(
        (j) => j.faultObserved === true && Number.isFinite(j.jobMs) && j.jobMs > 0,
      );
    const f1 = observed(baseline),
      f2 = observed(candidate),
      m1 = median(f1.map((j) => j.jobMs)),
      m2 = median(f2.map((j) => j.jobMs));
    if (m1 && m2)
      result.f2OverF1 = {
        passed: m2 / m1 > 10,
        ratio: m2 / m1,
        medianF1Ms: m1,
        medianF2Ms: m2,
        nF1: f1.length,
        nF2: f2.length,
      };
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b)
    throw new Error('Aufruf: vergleichen.mjs BASIS/ergebnis.json VARIANTE/ergebnis.json');
  const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
  process.stdout.write(JSON.stringify(compareExperiments(read(a), read(b)), null, 2) + '\n');
}
