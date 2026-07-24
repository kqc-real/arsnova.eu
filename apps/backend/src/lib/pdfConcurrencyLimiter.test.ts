import { describe, expect, it, vi } from 'vitest';
import { PdfConcurrencyLimiter } from './pdfConcurrencyLimiter';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('PdfConcurrencyLimiter', () => {
  it('führt höchstens zwei PDF-Jobs gleichzeitig aus und lehnt weitere sofort ab', async () => {
    const limiter = new PdfConcurrencyLimiter(2);
    const first = deferred<string>();
    const second = deferred<string>();
    const firstJob = limiter.run('session-host', () => first.promise);
    const secondJob = limiter.run('session-history', () => second.promise);

    expect(limiter.snapshot()).toMatchObject({
      activeJobs: 2,
      maxConcurrentJobs: 2,
      startedTotal: 2,
    });

    const rejected = limiter.run('admin-authority', async () => 'unexpected');
    await expect(rejected).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message:
        'Es werden bereits mehrere PDF-Berichte erstellt. Bitte versuche es in wenigen Sekunden erneut.',
    });
    expect(limiter.snapshot()).toMatchObject({
      activeJobs: 2,
      rejectedTotal: 1,
    });

    first.resolve('first');
    second.resolve('second');
    await expect(Promise.all([firstJob, secondJob])).resolves.toEqual(['first', 'second']);
    expect(limiter.snapshot()).toEqual({
      activeJobs: 0,
      maxConcurrentJobs: 2,
      startedTotal: 2,
      completedTotal: 2,
      failedTotal: 0,
      rejectedTotal: 1,
    });
  });

  it('gibt den Slot auch nach einem fehlgeschlagenen PDF-Job frei', async () => {
    const limiter = new PdfConcurrencyLimiter(1);
    const failure = new Error('render failed');

    await expect(limiter.run('session-host', async () => Promise.reject(failure))).rejects.toBe(
      failure,
    );
    await expect(limiter.run('session-host', async () => 'recovered')).resolves.toBe('recovered');

    expect(limiter.snapshot()).toMatchObject({
      activeJobs: 0,
      startedTotal: 2,
      completedTotal: 1,
      failedTotal: 1,
    });
  });

  it('wartet nicht auf einen freien Slot und blockiert dadurch keine Live-Arbeit', async () => {
    const limiter = new PdfConcurrencyLimiter(1);
    const running = deferred<void>();
    const activeJob = limiter.run('session-host', () => running.promise);
    const liveWork = vi.fn(() => 'vote accepted');

    const rejected = limiter.run('session-history', async () => undefined);
    expect(liveWork()).toBe('vote accepted');
    expect(liveWork).toHaveBeenCalledOnce();
    await expect(rejected).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });

    running.resolve();
    await activeJob;
  });
});
