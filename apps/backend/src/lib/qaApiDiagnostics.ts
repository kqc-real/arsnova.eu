type QaApiClass =
  | 'JOIN_REJOIN'
  | 'PARTICIPANT_QUERY'
  | 'QA_PAGE'
  | 'QA_SUBMIT'
  | 'QA_RATING'
  | 'QA_MODERATION'
  | 'QA_ANALYSIS';

type QaApiSample = {
  durationMs: number;
  outcome: 'SUCCESS' | 'EXPECTED_REJECTION' | 'TECHNICAL_ERROR';
  rejection: 'LIMIT' | 'DEADLINE' | 'OTHER' | null;
};

const MAX_SAMPLES_PER_CLASS = 1_000;
const samples = new Map<QaApiClass, QaApiSample[]>();

const PATH_CLASSES: Readonly<Record<string, QaApiClass>> = {
  'session.join': 'JOIN_REJOIN',
  'session.getParticipantSummary': 'PARTICIPANT_QUERY',
  'session.searchParticipants': 'PARTICIPANT_QUERY',
  'session.checkParticipantNickname': 'PARTICIPANT_QUERY',
  'session.heartbeatParticipantPresence': 'PARTICIPANT_QUERY',
  'qa.list': 'QA_PAGE',
  'qa.presentProjection': 'QA_PAGE',
  'qa.submit': 'QA_SUBMIT',
  'qa.upvote': 'QA_RATING',
  'qa.vote': 'QA_RATING',
  'qa.moderate': 'QA_MODERATION',
  'qa.deleteOwn': 'QA_MODERATION',
  'session.toggleQaModeration': 'QA_MODERATION',
  'wordCloud.analyzeQa': 'QA_ANALYSIS',
};

const EXPECTED_ERROR_CODES = new Set([
  'BAD_REQUEST',
  'CONFLICT',
  'FORBIDDEN',
  'NOT_FOUND',
  'PRECONDITION_FAILED',
  'TOO_MANY_REQUESTS',
  'UNAUTHORIZED',
]);

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] ?? null;
}

function rejectionKind(message: string | undefined): QaApiSample['rejection'] {
  const normalized = message?.toLocaleLowerCase('de-DE') ?? '';
  if (normalized.includes('limit') || normalized.includes('kontingent')) return 'LIMIT';
  if (
    normalized.includes('frist') ||
    normalized.includes('abgelaufen') ||
    normalized.includes('geschlossen') ||
    normalized.includes('beendet')
  ) {
    return 'DEADLINE';
  }
  return 'OTHER';
}

export function recordQaApiDiagnostic(input: {
  path: string;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
}): void {
  const apiClass = PATH_CLASSES[input.path];
  if (!apiClass) return;
  const outcome =
    input.errorCode === undefined
      ? 'SUCCESS'
      : EXPECTED_ERROR_CODES.has(input.errorCode)
        ? 'EXPECTED_REJECTION'
        : 'TECHNICAL_ERROR';
  const list = samples.get(apiClass) ?? [];
  list.push({
    durationMs: Math.max(0, Math.round(input.durationMs)),
    outcome,
    rejection: outcome === 'EXPECTED_REJECTION' ? rejectionKind(input.errorMessage) : null,
  });
  if (list.length > MAX_SAMPLES_PER_CLASS) {
    list.splice(0, list.length - MAX_SAMPLES_PER_CLASS);
  }
  samples.set(apiClass, list);
}

export function snapshotQaApiDiagnostics() {
  return Object.fromEntries(
    (Object.values(PATH_CLASSES) as QaApiClass[])
      .filter((value, index, all) => all.indexOf(value) === index)
      .map((apiClass) => {
        const current = samples.get(apiClass) ?? [];
        const successful = current.filter((sample) => sample.outcome === 'SUCCESS');
        const rejected = current.filter((sample) => sample.outcome === 'EXPECTED_REJECTION');
        const technicalErrors = current.filter(
          (sample) => sample.outcome === 'TECHNICAL_ERROR',
        ).length;
        return [
          apiClass,
          {
            samples: current.length,
            successes: successful.length,
            expectedRejections: rejected.length,
            technicalErrors,
            p95Ms: percentile(
              current.map((sample) => sample.durationMs),
              0.95,
            ),
            p99Ms: percentile(
              current.map((sample) => sample.durationMs),
              0.99,
            ),
            expectedRejectionP95Ms: percentile(
              rejected.map((sample) => sample.durationMs),
              0.95,
            ),
            expectedRejectionP99Ms: percentile(
              rejected.map((sample) => sample.durationMs),
              0.99,
            ),
            limitRejections: rejected.filter((sample) => sample.rejection === 'LIMIT').length,
            deadlineRejections: rejected.filter((sample) => sample.rejection === 'DEADLINE').length,
          },
        ];
      }),
  ) as Record<
    QaApiClass,
    {
      samples: number;
      successes: number;
      expectedRejections: number;
      technicalErrors: number;
      p95Ms: number | null;
      p99Ms: number | null;
      expectedRejectionP95Ms: number | null;
      expectedRejectionP99Ms: number | null;
      limitRejections: number;
      deadlineRejections: number;
    }
  >;
}

export function resetQaApiDiagnosticsForTests(): void {
  samples.clear();
}
