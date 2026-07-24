import { TRPCError } from '@trpc/server';
import { logger } from './logger';

export const PDF_MAX_CONCURRENT_JOBS = 2;

export type PdfJobSource = 'session-history' | 'session-host' | 'admin-authority';

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

  async run<T>(source: PdfJobSource, job: () => Promise<T>): Promise<T> {
    if (this.activeJobs >= this.maxConcurrentJobs) {
      this.rejectedTotal += 1;
      logger.warn('pdf:concurrency_rejected', {
        source,
        ...this.snapshot(),
      });
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message:
          'Es werden bereits mehrere PDF-Berichte erstellt. Bitte versuche es in wenigen Sekunden erneut.',
      });
    }

    this.activeJobs += 1;
    this.startedTotal += 1;
    const startedAt = Date.now();
    logger.info('pdf:job_started', {
      source,
      ...this.snapshot(),
    });

    try {
      const result = await job();
      this.completedTotal += 1;
      return result;
    } catch (error) {
      this.failedTotal += 1;
      throw error;
    } finally {
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
