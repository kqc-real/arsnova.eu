import test from 'node:test';
import assert from 'node:assert/strict';
import { compareExperiments } from './vergleichen.mjs';
const run = () => ({
  commit: 'a'.repeat(40),
  rechner: 'lab',
  energieprofil: 'power',
  timeoutMs: 300000,
  settings: { OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS: '30000' },
  appHost: { vcpu: 2, image: 'sha256:app' },
  llmHost: { info: '8cpu-10gb', modellSha256: 'model' },
  encoderImage: '',
  umgebung: {
    rechner: { cpu: 'cpu', ramGib: 32 },
    hypervisor: { name: 'Hyper-V', pinning: false },
    vms: [
      { name: 'app', vcpu: 2, ramGib: 4 },
      { name: 'llm', vcpu: 8, ramGib: 10 },
    ],
  },
  experiment: {
    config: { variant: 'f1', consumer: 'summary' },
    jobs: [{ faultObserved: true, jobMs: 100 }],
    medianF1JobMs: 100,
    live: null,
  },
});
test('F2/F1 bewertet nur beobachtete Netzversuche bei gleichem Versuchsstand', () => {
  const b = run(),
    c = run();
  c.experiment.config.variant = 'f2';
  c.experiment.jobs[0].jobMs = 2000;
  assert.equal(compareExperiments(b, c).f2OverF1.passed, true);
  c.experiment.jobs[0].faultObserved = false;
  assert.equal(compareExperiments(b, c).f2OverF1.passed, null);
});
test('fehlende Metadaten, Commitwechsel und andere Consumer verhindern positive Vergleiche', () => {
  for (const edit of [
    (r) => delete r.umgebung,
    (r) => (r.settings.OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS = '60000'),
    (r) => (r.commit = 'b'.repeat(40)),
    (r) => (r.experiment.config.consumer = 'label'),
    (r) => (r.runtimeVersions = { appHost: 'v24.22.3' }),
    (r) => (r.treiber = { fixtureId: 'different-corpus' }),
  ]) {
    const b = run(),
      c = run();
    edit(c);
    assert.equal(compareExperiments(b, c).comparable, false);
    assert.equal(compareExperiments(b, c).live.passed, null);
  }
});

test('Label-Vergleiche benötigen vollständige Node-Versionen, Korpus und Container-Settings', () => {
  const b = run(),
    c = run();
  for (const r of [b, c]) r.experiment.config.consumer = 'label';
  assert.equal(compareExperiments(b, c).comparable, false);
  for (const r of [b, c]) {
    r.runtimeVersions = { appHost: 'v24.22.3', llmHost: 'v24.22.3', appContainer: 'v24.19.0' };
    r.treiber = { fixtureId: 'label-identical-pair-v1' };
    r.settingsSource = 'app-container-environment';
  }
  assert.equal(compareExperiments(b, c).comparable, true);
  delete c.runtimeVersions.llmHost;
  assert.equal(compareExperiments(b, c).comparable, false);
});
