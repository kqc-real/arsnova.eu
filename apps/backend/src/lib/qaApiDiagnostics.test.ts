import { beforeEach, describe, expect, it } from 'vitest';
import {
  recordQaApiDiagnostic,
  resetQaApiDiagnosticsForTests,
  snapshotQaApiDiagnostics,
} from './qaApiDiagnostics';

describe('qaApiDiagnostics', () => {
  beforeEach(() => resetQaApiDiagnosticsForTests());

  it('trennt Erfolg, erwartete Ablehnung und technische Fehler je API-Klasse', () => {
    recordQaApiDiagnostic({ path: 'qa.submit', durationMs: 15 });
    recordQaApiDiagnostic({
      path: 'qa.submit',
      durationMs: 25,
      errorCode: 'TOO_MANY_REQUESTS',
      errorMessage: 'Fragenkontingent erreicht',
    });
    recordQaApiDiagnostic({
      path: 'qa.submit',
      durationMs: 35,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'interner Fehler',
    });

    expect(snapshotQaApiDiagnostics().QA_SUBMIT).toEqual({
      samples: 3,
      successes: 1,
      expectedRejections: 1,
      technicalErrors: 1,
      p95Ms: 35,
      p99Ms: 35,
      expectedRejectionP95Ms: 25,
      expectedRejectionP99Ms: 25,
      limitRejections: 1,
      deadlineRejections: 0,
    });
  });

  it('ignoriert unbekannte Pfade und hält höchstens 1.000 Laufzeitproben', () => {
    recordQaApiDiagnostic({ path: 'quiz.upload', durationMs: 99 });
    for (let index = 0; index < 1_050; index += 1) {
      recordQaApiDiagnostic({ path: 'qa.list', durationMs: index });
    }

    const snapshot = snapshotQaApiDiagnostics();
    expect(snapshot.QA_PAGE.samples).toBe(1_000);
    expect(snapshot.QA_PAGE.successes).toBe(1_000);
    expect(snapshot.QA_PAGE.p99Ms).toBe(1_039);
    expect(Object.keys(snapshot)).not.toContain('quiz.upload');
  });
});
