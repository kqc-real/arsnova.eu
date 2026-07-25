export function percentile(values, percentileValue) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

export function summarizeDurations(values) {
  return {
    p50Ms: Math.round(percentile(values, 50)),
    p95Ms: Math.round(percentile(values, 95)),
    p99Ms: Math.round(percentile(values, 99)),
    maxMs: Math.round(Math.max(0, ...values)),
  };
}

export function violatesExclusiveUpperBound(observed, limit) {
  return !Number.isFinite(observed) || observed >= limit;
}

export function violatesExclusiveRate(errors, total, limit) {
  return (
    !Number.isInteger(errors) ||
    !Number.isInteger(total) ||
    total < 1 ||
    errors < 0 ||
    errors / total >= limit
  );
}
