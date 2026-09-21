import { isQaOpenForParticipants } from '@arsnova/shared-types';

export type SessionDeadlineSnapshot = {
  status?: string;
  serverNow?: string;
  expiresAt?: string;
  sessionLifecycleRevision?: number;
  type?: 'QUIZ' | 'Q_AND_A' | null;
  channels?: Parameters<typeof isQaOpenForParticipants>[0]['channels'];
  qaEnabled?: boolean | null;
  qaOpen?: boolean | null;
  qaClosesAt?: string | Date | null;
  hostEnded?: boolean;
};

export function enrichDeadlineSnapshot(
  snapshot: SessionDeadlineSnapshot,
  known?: Pick<
    SessionDeadlineSnapshot,
    'type' | 'channels' | 'qaEnabled' | 'qaOpen' | 'qaClosesAt'
  >,
): SessionDeadlineSnapshot {
  if (!known) {
    return snapshot;
  }
  return {
    ...snapshot,
    type: snapshot.type ?? known.type,
    channels: snapshot.channels ?? known.channels,
    qaEnabled: snapshot.qaEnabled ?? known.qaEnabled,
    qaOpen: snapshot.qaOpen ?? known.qaOpen,
    qaClosesAt: snapshot.qaClosesAt ?? known.qaClosesAt,
  };
}

export type SessionDeadlineClock = {
  monotonicNow(): number;
};

const defaultDeadlineClock: SessionDeadlineClock = {
  monotonicNow: () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now(),
};

/**
 * Fail-closed Sessionfrist ohne Vertrauen in die laufende Geräte-Wanduhr.
 * Ein lokales Ende ist gelatcht; nur ein autoritativer Snapshot mit höherer
 * Revision kann anschließend wieder einen aktiven Zustand bestätigen.
 * Quiz-FINISHED bei tatsächlich offenem Q&A ist kein globales Teilnahmeende.
 */
export class SessionDeadlineController {
  private revision = -1;
  private expiresAtMs: number | null = null;
  private serverNowAtSampleMs = 0;
  private monotonicAtSampleMs = 0;
  private expired = false;

  constructor(private readonly clock: SessionDeadlineClock = defaultDeadlineClock) {}

  applySnapshot(snapshot: SessionDeadlineSnapshot): boolean {
    if (
      typeof snapshot.serverNow !== 'string' ||
      typeof snapshot.expiresAt !== 'string' ||
      typeof snapshot.sessionLifecycleRevision !== 'number'
    ) {
      return false;
    }
    const serverNowMs = Date.parse(snapshot.serverNow);
    const expiresAtMs = Date.parse(snapshot.expiresAt);
    const revision = snapshot.sessionLifecycleRevision;
    const previousRevision = this.revision;
    const monotonicNow = this.clock.monotonicNow();
    const previousEstimatedServerNow =
      this.expiresAtMs === null
        ? null
        : this.serverNowAtSampleMs + Math.max(0, monotonicNow - this.monotonicAtSampleMs);
    const wasExpired =
      this.expired ||
      (this.expiresAtMs !== null &&
        previousEstimatedServerNow !== null &&
        previousEstimatedServerNow >= this.expiresAtMs);
    if (wasExpired) {
      this.expired = true;
    }
    if (
      !Number.isFinite(serverNowMs) ||
      !Number.isFinite(expiresAtMs) ||
      !Number.isInteger(revision) ||
      revision < 0 ||
      revision < this.revision
    ) {
      return false;
    }
    if (
      revision === this.revision &&
      this.expiresAtMs !== null &&
      expiresAtMs !== this.expiresAtMs
    ) {
      return false;
    }
    if (revision === this.revision && wasExpired && snapshot.status !== 'FINISHED') {
      this.expired = true;
      return false;
    }

    this.revision = revision;
    this.expiresAtMs = expiresAtMs;
    // Verspätete Snapshots derselben oder einer höheren Revision dürfen die
    // bereits monoton fortgeschriebene Serverzeit nie zurücksetzen.
    this.serverNowAtSampleMs = Math.max(serverNowMs, previousEstimatedServerNow ?? serverNowMs);
    this.monotonicAtSampleMs = monotonicNow;
    const qaStillOpen = isQaOpenForParticipants(
      {
        type: snapshot.type,
        channels: snapshot.channels,
        qaEnabled: snapshot.qaEnabled,
        qaOpen: snapshot.qaOpen,
        qaClosesAt: snapshot.qaClosesAt,
        expiresAt: snapshot.expiresAt,
      },
      new Date(this.serverNowAtSampleMs),
    );
    this.expired =
      (snapshot.status === 'FINISHED' && !qaStillOpen) ||
      this.serverNowAtSampleMs >= expiresAtMs ||
      (wasExpired && revision === previousRevision);
    return true;
  }

  currentRevision(): number {
    return this.revision;
  }

  currentExpiresAt(): string | null {
    return this.expiresAtMs === null ? null : new Date(this.expiresAtMs).toISOString();
  }

  estimatedServerNowMs(): number | null {
    if (this.expiresAtMs === null) return null;
    return (
      this.serverNowAtSampleMs + Math.max(0, this.clock.monotonicNow() - this.monotonicAtSampleMs)
    );
  }

  remainingMs(): number | null {
    const estimatedNow = this.estimatedServerNowMs();
    if (estimatedNow === null || this.expiresAtMs === null) return null;
    return Math.max(0, this.expiresAtMs - estimatedNow);
  }

  isExpired(): boolean {
    if (this.expired) return true;
    const remaining = this.remainingMs();
    if (remaining !== null && remaining <= 0) {
      this.expired = true;
    }
    return this.expired;
  }

  /** Globale `expiresAt`, ohne das Quiz-FINISHED-Latch bei geschlossenem Q&A. */
  isAbsoluteDeadlineReached(): boolean {
    const remaining = this.remainingMs();
    return remaining !== null && remaining <= 0;
  }
}
