/** Offener Q&A-Kanal bleibt nach Quiz-FINISHED bis zur eigenen Frist beitretbar. */
export function isQaChannelJoinable(
  input: {
    type?: 'QUIZ' | 'Q_AND_A' | null;
    channels?: {
      qa?: {
        enabled?: boolean;
        open?: boolean;
        state?: 'DISABLED' | 'UNCONFIGURED' | 'OPEN' | 'MANUALLY_CLOSED' | 'DEADLINE_EXPIRED';
        closesAt?: string | null;
      } | null;
    } | null;
    qaEnabled?: boolean | null;
    qaOpen?: boolean | null;
    qaClosesAt?: string | Date | null;
  },
  now: Date = new Date(),
): boolean {
  const qa = input.channels?.qa;
  if (qa) {
    if (qa.state === 'OPEN') {
      return true;
    }
    if (qa.state !== undefined) {
      return false;
    }
    if (qa.enabled !== true || qa.open !== true) {
      return false;
    }
    if (!qa.closesAt) {
      return false;
    }
    const closesMs = Date.parse(qa.closesAt);
    return !Number.isNaN(closesMs) && closesMs > now.getTime();
  }

  const enabled = input.type === 'Q_AND_A' || input.qaEnabled === true;
  if (!enabled || input.qaOpen === false) {
    return false;
  }
  const raw = input.qaClosesAt;
  if (raw === undefined || raw === null) {
    return false;
  }
  const closesMs = raw instanceof Date ? raw.getTime() : Date.parse(raw);
  return !Number.isNaN(closesMs) && closesMs > now.getTime();
}
