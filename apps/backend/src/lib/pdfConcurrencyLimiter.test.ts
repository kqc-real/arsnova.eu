import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDF_EXPORT_LEASE_KEY, PdfConcurrencyLimiter } from './pdfConcurrencyLimiter';
import { PdfWorkerUncertainCompletionError } from './pdfWorkerTransport';

const redisMock = vi.hoisted(() => ({ set: vi.fn(), eval: vi.fn(), exists: vi.fn() }));
vi.mock('../redis', () => ({ getRedis: () => redisMock }));
vi.mock('./pdfTelemetry', () => ({ recordPdfJobOutcome: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.useRealTimers();
});

function enableSharedLimit() {
  vi.stubEnv('PDF_SHARED_LIMIT_ENABLED', 'true');
  vi.stubEnv('PDF_RENDER_MODE', 'worker');
}

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
  it('teilt einen Slot, erneuert ihn vor dem Rendern und gibt ihn nur mit dem Besitzer frei', async () => {
    enableSharedLimit();
    redisMock.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    redisMock.eval.mockResolvedValue(1);
    redisMock.exists.mockResolvedValue(1);
    const a = new PdfConcurrencyLimiter();
    const b = new PdfConcurrencyLimiter();
    const started = deferred<void>();
    const running = deferred<void>();
    const first = a.run('session-host', async (beforeRender) => {
      await beforeRender?.();
      started.resolve();
      await running.promise;
    });
    await started.promise;
    const second = vi.fn();
    await expect(b.run('session-history', second)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(second).not.toHaveBeenCalled();
    await expect(b.readActiveJobs()).resolves.toBe(1);
    const owner = redisMock.set.mock.calls[0]?.[1];
    expect(redisMock.set).toHaveBeenNthCalledWith(
      1,
      PDF_EXPORT_LEASE_KEY,
      owner,
      'PX',
      90_000,
      'NX',
    );
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining('PEXPIRE'),
      1,
      PDF_EXPORT_LEASE_KEY,
      owner,
      90_000,
    );
    running.resolve();
    await first;
    expect(redisMock.eval).toHaveBeenLastCalledWith(
      expect.stringContaining('DEL'),
      1,
      PDF_EXPORT_LEASE_KEY,
      owner,
    );
    expect(redisMock.eval.mock.lastCall?.[0]).toContain("redis.call('GET', KEYS[1]) ~= ARGV[1]");
  });

  it('übergibt nach Verlust der Reservierung keinen verspäteten Job an den Worker', async () => {
    enableSharedLimit();
    redisMock.set.mockResolvedValue('OK');
    redisMock.eval.mockResolvedValue(0);
    const render = vi.fn();
    const limiter = new PdfConcurrencyLimiter();
    await expect(
      limiter.run('session-host', async (beforeRender) => {
        await beforeRender?.();
        render();
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(render).not.toHaveBeenCalled();
  });

  it('verlängert einen laufenden Job und beendet die Verlängerung nach der Freigabe', async () => {
    enableSharedLimit();
    vi.useFakeTimers();
    redisMock.set.mockResolvedValue('OK');
    redisMock.eval.mockResolvedValue(1);
    const running = deferred<void>();
    const first = new PdfConcurrencyLimiter().run('session-host', () => running.promise);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(redisMock.eval).toHaveBeenCalledTimes(2);
    expect(redisMock.eval.mock.calls.every(([script]) => script.includes('PEXPIRE'))).toBe(true);
    running.resolve();
    await first;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(redisMock.eval).toHaveBeenCalledTimes(3);
    expect(redisMock.eval.mock.lastCall?.[0]).toContain('DEL');
  });

  it('lässt die Reservierung bei unklarem Worker-Abschluss auslaufen', async () => {
    enableSharedLimit();
    redisMock.set.mockResolvedValue('OK');
    const limiter = new PdfConcurrencyLimiter();
    const failure = new PdfWorkerUncertainCompletionError('socket disconnected');
    await expect(
      limiter.run('session-host', async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it('lässt bei ausgefallenem Redis keine weitere Erstellung zu', async () => {
    enableSharedLimit();
    redisMock.set.mockRejectedValue(new Error('connection closed'));
    const job = vi.fn();
    await expect(new PdfConcurrencyLimiter().run('session-host', job)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(job).not.toHaveBeenCalled();
  });

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

    const rejected = limiter.run('session-host', async () => 'unexpected');
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
