import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaUpdateService } from './pwa-update.service';

const originalWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('PwaUpdateService', () => {
  let events: Subject<VersionEvent>;
  let check: ReturnType<typeof vi.fn>;
  let worker: EventTarget & { ready: Promise<unknown> };
  let meta: HTMLMetaElement;

  beforeEach(() => {
    vi.useFakeTimers();
    events = new Subject<VersionEvent>();
    check = vi.fn().mockResolvedValue(false);
    worker = Object.assign(new EventTarget(), { ready: Promise.resolve({}) });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => worker });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    meta = document.createElement('meta');
    meta.name = 'arsnova-pwa-build';
    meta.content = 'loaded-build';
    document.head.append(meta);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: events,
            checkForUpdate: check,
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    meta?.remove();
    if (originalWorker) Object.defineProperty(navigator, 'serviceWorker', originalWorker);
    else Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('captures VERSION_READY before deferred startup checks begin', () => {
    const service = TestBed.inject(PwaUpdateService);
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(service.available()).toBe(true);
    expect(check).not.toHaveBeenCalled();
  });

  it('recovers a missed ready event for a version already downloaded by another window', async () => {
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    await flush();
    events.next({
      type: 'NO_NEW_VERSION_DETECTED',
      version: { hash: 'new', appData: { pwaBuildId: 'new-build' } },
    });
    expect(service.available()).toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
    events.next({
      type: 'NO_NEW_VERSION_DETECTED',
      version: { hash: 'new', appData: { pwaBuildId: 'loaded-build' } },
    });
    expect(service.available()).toBe(true);
  });

  it('does not show false updates for matching builds, missing metadata or downloads in progress', () => {
    const service = TestBed.inject(PwaUpdateService);
    for (const appData of [
      { pwaBuildId: 'loaded-build' },
      undefined,
      { pwaBuildId: 42 },
      { pwaBuildId: '' },
    ]) {
      events.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'new', appData } });
      expect(service.available()).toBe(false);
    }
    events.next({
      type: 'VERSION_DETECTED',
      version: { hash: 'new', appData: { pwaBuildId: 'new-build' } },
    });
    events.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: { hash: 'new' },
      error: 'offline',
    });
    expect(service.available()).toBe(false);
  });

  it('keeps legacy documents without build metadata working via VERSION_READY', () => {
    meta.remove();
    const service = TestBed.inject(PwaUpdateService);
    events.next({
      type: 'NO_NEW_VERSION_DETECTED',
      version: { hash: 'new', appData: { pwaBuildId: 'new-build' } },
    });
    expect(service.available()).toBe(false);
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(service.available()).toBe(true);
  });

  it('uses a successful explicit check even without an accompanying event', async () => {
    check.mockResolvedValue(true);
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    await flush();
    expect(service.available()).toBe(true);
  });

  it('checks every five minutes while visible and coalesces resume events', async () => {
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    service.start();
    await flush();
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(check).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15_000);
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));
    worker.dispatchEvent(new Event('controllerchange'));
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('waits in the background and checks on returning to the foreground', async () => {
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    await flush();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('retries after offline/rejection and does not overlap pending checks', async () => {
    check.mockRejectedValueOnce(new Error('offline'));
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    await flush();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(1);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    check.mockReturnValueOnce(new Promise(() => {}));
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
    expect(check).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('starts after the ready fallback and ignores late readiness and late results after destruction', async () => {
    let ready!: () => void;
    worker.ready = new Promise((resolve) => {
      ready = () => resolve({});
    });
    let complete!: (value: boolean) => void;
    check.mockReturnValue(
      new Promise<boolean>((resolve) => {
        complete = resolve;
      }),
    );
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(check).toHaveBeenCalledTimes(1);
    service.ngOnDestroy();
    ready();
    complete(true);
    await flush();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    window.dispatchEvent(new Event('online'));
    expect(check).toHaveBeenCalledTimes(1);
    expect(service.available()).toBe(false);
  });

  it('does not start timers when readiness arrives after destruction', async () => {
    let ready!: () => void;
    worker.ready = new Promise((resolve) => {
      ready = () => resolve({});
    });
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    service.ngOnDestroy();
    ready();
    await flush();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(check).not.toHaveBeenCalled();
  });

  it('does not subscribe or poll when service workers are disabled', async () => {
    TestBed.overrideProvider(SwUpdate, {
      useValue: { isEnabled: false, versionUpdates: events, checkForUpdate: check },
    });
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(check).not.toHaveBeenCalled();
    expect(service.available()).toBe(false);
  });

  it('never starts browser work during SSR or when the service worker is disabled', () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const service = TestBed.inject(PwaUpdateService);
    service.start();
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(service.available()).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });
});
