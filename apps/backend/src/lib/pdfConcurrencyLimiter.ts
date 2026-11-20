import { TRPCError } from '@trpc/server';
import { getRedis } from '../redis';
import { logger } from './logger';
import { recordPdfJobOutcome } from './pdfTelemetry';
import {
  PDF_WORKER_REQUEST_TIMEOUT_MS,
  PdfWorkerUncertainCompletionError,
  resolvePdfRenderMode,
} from './pdfWorkerTransport';
import { acquireRedisLease } from './redisLease';

export const PDF_MAX_CONCURRENT_JOBS = 1;
export const PDF_EXPORT_LEASE_KEY = 'pdf:export:lease:v1';
// Der Worker muss auch nach App-Abbruch Zeit zum Beenden seines Renderjobs haben.
const PDF_EXPORT_LEASE_MS = PDF_WORKER_REQUEST_TIMEOUT_MS + 15_000;
const PDF_EXPORT_RENEW_MS = 10_000;

function usesSharedPdfLimit(): boolean {
  return process.env['PDF_SHARED_LIMIT_ENABLED'] === 'true';
}

function leaseUnavailable(cause?: unknown): TRPCError {
  return new TRPCError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'PDF-Erstellung vorübergehend nicht verfügbar.',
    cause,
  });
}

async function acquireSharedLease() {
  if (resolvePdfRenderMode() !== 'worker') throw leaseUnavailable();
  const lease = await acquireRedisLease(PDF_EXPORT_LEASE_KEY, PDF_EXPORT_LEASE_MS).catch(
    (cause) => {
      throw leaseUnavailable(cause);
    },
  );
  if (!lease) return null;
  const { refresh, release } = lease;

  let stopped = false;
  let timer: NodeJS.Timeout;
  function scheduleRenewal() {
    timer = setTimeout(() => {
      void refresh()
        .catch(() => undefined)
        .finally(() => {
          if (!stopped) scheduleRenewal();
        });
    }, PDF_EXPORT_RENEW_MS);
    timer.unref();
  }
  scheduleRenewal();

  return {
    async beforeRender(): Promise<void> {
      const renewed = await refresh().catch((cause) => {
        throw leaseUnavailable(cause);
      });
      if (!renewed) throw leaseUnavailable();
    },
    async finish(releaseSlot: boolean): Promise<void> {
      stopped = true;
      clearTimeout(timer);
      if (releaseSlot) {
        try {
          await release();
        } catch {
          logger.warn('PDF-Reservierung konnte nicht freigegeben werden und läuft ab.');
        }
      }
    },
  };
}

export type PdfJobSource = 'session-history' | 'session-host';

export type PdfConcurrencySnapshot = {
  activeJobs: number;
  maxConcurrentJobs: number;
  startedTotal: number;
  completedTotal: number;
  failedTotal: number;
  rejectedTotal: number;
};

export class PdfConcurrencyLimiter {
  private activeJobs = 0;
  private startedTotal = 0;
  private completedTotal = 0;
  private failedTotal = 0;
  private rejectedTotal = 0;

  constructor(private readonly maxConcurrentJobs = PDF_MAX_CONCURRENT_JOBS) {
    if (!Number.isInteger(maxConcurrentJobs) || maxConcurrentJobs < 1) {
      throw new Error('PDF-Parallelitätslimit muss eine positive ganze Zahl sein.');
    }
  }

  snapshot(): PdfConcurrencySnapshot {
    return {
      activeJobs: this.activeJobs,
      maxConcurrentJobs: this.maxConcurrentJobs,
      startedTotal: this.startedTotal,
      completedTotal: this.completedTotal,
      failedTotal: this.failedTotal,
      rejectedTotal: this.rejectedTotal,
    };
  }

  async readActiveJobs(): Promise<number> {
    if (!usesSharedPdfLimit()) return this.activeJobs;
    try {
      return await getRedis().exists(PDF_EXPORT_LEASE_KEY);
    } catch {
      return this.activeJobs;
    }
  }

  private rejectBusy(): never {
    this.rejectedTotal += 1;
    void recordPdfJobOutcome('rejected');
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message:
        'Es werden bereits mehrere PDF-Berichte erstellt. Bitte versuche es in wenigen Sekunden erneut.',
    });
  }

  async run<T>(
    source: PdfJobSource,
    job: (beforeRender?: () => Promise<void>) => Promise<T>,
  ): Promise<T> {
    if (this.activeJobs >= this.maxConcurrentJobs) this.rejectBusy();
    const lease = usesSharedPdfLimit() ? await acquireSharedLease() : undefined;
    if (lease === null) this.rejectBusy();

    this.activeJobs += 1;
    this.startedTotal += 1;
    const startedAt = Date.now();
    logger.info('pdf:job_started', {
      source,
      ...this.snapshot(),
    });

    let release = true;
    try {
      const result = await job(lease?.beforeRender);
      this.completedTotal += 1;
      void recordPdfJobOutcome('completed');
      return result;
    } catch (error) {
      release = !(error instanceof PdfWorkerUncertainCompletionError);
      this.failedTotal += 1;
      void recordPdfJobOutcome('failed');
      throw error;
    } finally {
      if (lease) await lease.finish(release);
      this.activeJobs -= 1;
      logger.info('pdf:job_finished', {
        source,
        durationMs: Date.now() - startedAt,
        ...this.snapshot(),
      });
    }
  }
}

export const pdfConcurrencyLimiter = new PdfConcurrencyLimiter();
