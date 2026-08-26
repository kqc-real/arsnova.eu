import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, type CanActivateFn, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasHostTokenMock, setHostTokenMock, normalizeHostSessionCodeMock, clearHostTokenMock } =
  vi.hoisted(() => ({
    hasHostTokenMock: vi.fn(),
    setHostTokenMock: vi.fn(),
    normalizeHostSessionCodeMock: vi.fn((code: string) => code.trim().toUpperCase()),
    clearHostTokenMock: vi.fn(),
  }));

const { getParticipantsQueryMock } = vi.hoisted(() => ({
  getParticipantsQueryMock: vi.fn(),
}));

const { getStoredHostTokenMock, clearStoredHostTokenMock } = vi.hoisted(() => ({
  getStoredHostTokenMock: vi.fn(),
  clearStoredHostTokenMock: vi.fn(),
}));

vi.mock('../../../core/host-session-token', () => ({
  clearHostToken: clearHostTokenMock,
  hasHostToken: hasHostTokenMock,
  normalizeHostSessionCode: normalizeHostSessionCodeMock,
  setHostToken: setHostTokenMock,
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getParticipants: { query: getParticipantsQueryMock },
    },
  },
}));

import { presentViewGuard } from './present-view.guard';
import { SessionTokenStorageService } from './session-token-storage.service';

function createChildRouteSnapshot(parentCode: string): ActivatedRouteSnapshot {
  const parent = new ActivatedRouteSnapshot();
  parent.params = { code: parentCode };
  const child = new ActivatedRouteSnapshot();
  Object.defineProperty(child, 'parent', {
    configurable: true,
    get: () => parent,
  });
  Object.defineProperty(child, 'pathFromRoot', {
    configurable: true,
    get: () => [parent, child],
  });
  return child;
}

describe('presentViewGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 0, participants: [] });
    getStoredHostTokenMock.mockResolvedValue(null);
    clearStoredHostTokenMock.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SessionTokenStorageService,
          useValue: {
            getHostToken: getStoredHostTokenMock,
            clearHostToken: clearStoredHostTokenMock,
          },
        },
      ],
    });
  });

  async function runGuard(): Promise<
    ReturnType<CanActivateFn> | Awaited<ReturnType<CanActivateFn>>
  > {
    return TestBed.runInInjectionContext(() =>
      presentViewGuard(createChildRouteSnapshot('abc123'), {} as never),
    );
  }

  it('erlaubt den Present-Tab wenn sessionStorage bereits den Host-Token hat', async () => {
    hasHostTokenMock.mockReturnValue(true);

    await expect(runGuard()).resolves.toBe(true);
    expect(getStoredHostTokenMock).not.toHaveBeenCalled();
    expect(clearStoredHostTokenMock).not.toHaveBeenCalled();
    expect(getParticipantsQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
  });

  it('stellt den Host-Token aus IndexedDB wieder her und konsumiert den Handoff', async () => {
    hasHostTokenMock.mockReturnValueOnce(false).mockReturnValue(true);
    getStoredHostTokenMock.mockResolvedValue('stored-host-token');

    await expect(runGuard()).resolves.toBe(true);
    expect(getStoredHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(setHostTokenMock).toHaveBeenCalledWith('ABC123', 'stored-host-token');
    expect(getParticipantsQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(clearStoredHostTokenMock).toHaveBeenCalledWith('ABC123');
  });

  it('leitet ohne Tab-Token und ohne IndexedDB-Token auf Join um', async () => {
    hasHostTokenMock.mockReturnValue(false);
    const router = TestBed.inject(Router);

    const result = await runGuard();

    expect(setHostTokenMock).not.toHaveBeenCalled();
    expect(clearStoredHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/join/ABC123');
  });

  it('räumt IndexedDB und sessionStorage bei ungültigem Token', async () => {
    hasHostTokenMock.mockReturnValue(true);
    getParticipantsQueryMock.mockRejectedValue(
      new Error('UNAUTHORIZED: Host-Authentifizierung erforderlich.'),
    );
    const router = TestBed.inject(Router);

    const result = await runGuard();

    expect(clearHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(clearStoredHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/join/ABC123');
  });
});
