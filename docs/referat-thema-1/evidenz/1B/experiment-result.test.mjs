import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExperimentResult } from './experiment-result.mjs';

const request = {
  consumer: 'summary',
  requestedAt: '2026-11-15T10:00:00Z',
  finishedAt: '2026-11-15T10:00:02Z',
  effectiveMode: 'extractive',
  fallbackReason: 'unavailable',
};
const log =
  "qa_summary:completed { effectiveMode: 'extractive', fallbackReason: 'unavailable', latencyMs: 88 }";
test('F1 wird mit Job-Zeit und beobachtetem RST bewertet, nicht mit Pollingzeit', () => {
  const r = buildExperimentResult({
    config: { variant: 'f1', timeoutMs: 300000 },
    driver: { auftraege: [request] },
    log,
    transport:
      '1794736800.1\t1\t192.168.150.10\t0\t\t\t\t1\t0\n1794736800.2\t1\t192.168.150.20\t0\t\t\t\t0\t1\n',
  });
  assert.equal(r.jobs[0].jobMs, 88);
  assert.equal(r.fallbackWithinBudget, true);
  assert.equal(r.f1Fast, true);
  assert.equal(r.jobs[0].faultObserved, true);
  assert.equal(r.jobs[0].inferMs, null);
});
test('fehlende oder widersprüchliche Logs sind kein bestandenes Timing-Kriterium', () => {
  for (const text of ['', log + '\n' + log, log.replace('unavailable', 'timeout')]) {
    const r = buildExperimentResult({
      config: { variant: 'f1', timeoutMs: 300000 },
      driver: { auftraege: [request] },
      log: text,
      transport: '',
    });
    assert.equal(r.jobs[0].jobMs, null);
    assert.equal(r.fallbackWithinBudget, null);
    assert.equal(r.f1Fast, null);
  }
});
test('Label bekommt ohne entsprechende Telemetrie keine erfundene Job- oder Inferenzzeit', () => {
  const r = buildExperimentResult({
    config: { variant: 'l3', timeoutMs: 300000 },
    driver: { auftraege: [{ ...request, consumer: 'label' }] },
    log: '',
    transport: '',
  });
  assert.equal(r.jobs[0].jobMs, null);
  assert.equal(r.fallbackWithinBudget, null);
});
