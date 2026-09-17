export type QaDeadlineClockParts = {
  formatted: string;
  remainingMs: number;
  relative: string;
};

export function resolveQaDeadlineClockParts(input: {
  closesAt: string | null | undefined;
  nowMs: number;
  localeId: string;
  timeZone?: string | null;
}): QaDeadlineClockParts | null {
  if (!input.closesAt) {
    return null;
  }

  const deadline = Date.parse(input.closesAt);
  if (!Number.isFinite(deadline)) {
    return null;
  }

  const formatted = new Intl.DateTimeFormat(input.localeId, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: input.timeZone || 'UTC',
    timeZoneName: 'short',
  }).format(new Date(deadline));
  const remainingMs = deadline - input.nowMs;
  if (remainingMs <= 0) {
    return { formatted, remainingMs, relative: '' };
  }

  const relativeFormatter = new Intl.RelativeTimeFormat(input.localeId, { numeric: 'always' });
  const relative =
    remainingMs >= 48 * 60 * 60_000
      ? relativeFormatter.format(Math.ceil(remainingMs / (24 * 60 * 60_000)), 'day')
      : remainingMs >= 90 * 60_000
        ? relativeFormatter.format(Math.ceil(remainingMs / (60 * 60_000)), 'hour')
        : relativeFormatter.format(Math.max(1, Math.ceil(remainingMs / 60_000)), 'minute');

  return { formatted, remainingMs, relative };
}
