import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, type CanActivateFn, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasFeedbackHostTokenMock, normalizeFeedbackCodeMock } = vi.hoisted(() => ({
  hasFeedbackHostTokenMock: vi.fn(),
  normalizeFeedbackCodeMock: vi.fn((code: string) => code.trim().toUpperCase()),
}));

const { hasHostTokenMock, normalizeHostSessionCodeMock } = vi.hoisted(() => ({
  hasHostTokenMock: vi.fn(),
  normalizeHostSessionCodeMock: vi.fn((code: string) => code.trim().toUpperCase()),
}));

const { clearHostTokenMock, getParticipantsQueryMock } = vi.hoisted(() => ({
  clearHostTokenMock: vi.fn(),
  getParticipantsQueryMock: vi.fn(),
}));

const { getLocaleFromPathMock, getLocaleFromBaseHrefMock, getPreferredJoinLocaleMock } = vi.hoisted(
  () => ({
    getLocaleFromPathMock: vi.fn(),
    getLocaleFromBaseHrefMock: vi.fn(),
    getPreferredJoinLocaleMock: vi.fn(),
  }),
);

vi.mock('./core/feedback-host-token', () => ({
  hasFeedbackHostToken: hasFeedbackHostTokenMock,
  normalizeFeedbackCode: normalizeFeedbackCodeMock,
}));

vi.mock('./core/host-session-token', () => ({
  clearHostToken: clearHostTokenMock,
  getSessionEntryCommands: vi.fn((code: string) => ['join', code.trim().toUpperCase()]),
  hasHostToken: hasHostTokenMock,
  normalizeHostSessionCode: normalizeHostSessionCodeMock,
}));

vi.mock('./core/trpc.client', () => ({
  trpc: {
    session: {
      getParticipants: { query: getParticipantsQueryMock },
    },
  },
}));

vi.mock('./core/locale-from-path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./core/locale-from-path')>();
  return {
    ...actual,
    getLocaleFromPath: getLocaleFromPathMock,
    getLocaleFromBaseHref: getLocaleFromBaseHrefMock,
    getPreferredJoinLocale: getPreferredJoinLocaleMock,
  };
});

import { routes } from './app.routes';

function findRoute(path: string) {
  const route = routes.find((candidate) => candidate.path === path);
  if (!route) {
    throw new Error(`Route not found: ${path}`);
  }
  return route;
}

function findChildRoute(parentPath: string, childPath: string) {
  const parentRoute = routes.find(
    (candidate) => candidate.path === parentPath && Array.isArray(candidate.children),
  );
  const childRoute = parentRoute?.children?.find((candidate) => candidate.path === childPath);
  if (!childRoute) {
    throw new Error(`Child route not found: ${parentPath}/${childPath}`);
  }
  return childRoute;
}

function createRouteSnapshot(code: string): ActivatedRouteSnapshot {
  const snapshot = new ActivatedRouteSnapshot();
  snapshot.params = { code };
  return snapshot;
}

function createChildRouteSnapshot(parentCode: string): ActivatedRouteSnapshot {
  const parent = createRouteSnapshot(parentCode);
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

function createLocalizedJoinRouteSnapshot(locale: string, code: string): ActivatedRouteSnapshot {
  const parent = new ActivatedRouteSnapshot();
  parent.params = { locale };
  const child = new ActivatedRouteSnapshot();
  child.params = { code };
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

describe('app routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocaleFromPathMock.mockReturnValue(null);
    getLocaleFromBaseHrefMock.mockReturnValue(null);
    getPreferredJoinLocaleMock.mockReturnValue('de');
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 0, participants: [] });
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('erlaubt die Standalone-Blitzlicht-Host-Route mit gespeichertem Host-Token', () => {
    hasFeedbackHostTokenMock.mockReturnValue(true);
    const guard = findRoute('feedback/:code').canActivate?.[0] as CanActivateFn;

    const result = TestBed.runInInjectionContext(() =>
      guard(createRouteSnapshot('abc123'), {} as never),
    );

    expect(normalizeFeedbackCodeMock).toHaveBeenCalledWith('abc123');
    expect(result).toBe(true);
  });

  it('leitet die Standalone-Blitzlicht-Host-Route ohne Host-Token zur Vote-Ansicht um', () => {
    hasFeedbackHostTokenMock.mockReturnValue(false);
    const guard = findRoute('feedback/:code').canActivate?.[0] as CanActivateFn;
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() =>
      guard(createRouteSnapshot('abc123'), {} as never),
    );

    expect(normalizeFeedbackCodeMock).toHaveBeenCalledWith('abc123');
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/feedback/ABC123/vote',
    );
  });

  it('erlaubt die Session-Host-Route mit gültigem gespeichertem Host-Token', async () => {
    hasHostTokenMock.mockReturnValue(true);
    const guard = findChildRoute('session/:code', 'host').canActivate?.[0] as CanActivateFn;

    const result = await TestBed.runInInjectionContext(() =>
      guard(createChildRouteSnapshot('abc123'), {} as never),
    );

    expect(normalizeHostSessionCodeMock).toHaveBeenCalledWith('abc123');
    expect(getParticipantsQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(result).toBe(true);
  });

  it('leitet die Session-Host-Route ohne Host-Token auf Join um', () => {
    hasHostTokenMock.mockReturnValue(false);
    const guard = findChildRoute('session/:code', 'host').canActivate?.[0] as CanActivateFn;
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() =>
      guard(createChildRouteSnapshot('abc123'), {} as never),
    );

    expect(normalizeHostSessionCodeMock).toHaveBeenCalledWith('abc123');
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/join/ABC123');
  });

  it('räumt einen ungültigen gespeicherten Host-Token weg und leitet auf Join um', async () => {
    hasHostTokenMock.mockReturnValue(true);
    getParticipantsQueryMock.mockRejectedValue(
      new Error('UNAUTHORIZED: Host-Authentifizierung erforderlich.'),
    );
    const guard = findChildRoute('session/:code', 'host').canActivate?.[0] as CanActivateFn;
    const router = TestBed.inject(Router);

    const result = await TestBed.runInInjectionContext(() =>
      guard(createChildRouteSnapshot('abc123'), {} as never),
    );

    expect(clearHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/join/ABC123');
  });

  it('leitet nackte Join-Links auf die bevorzugte Locale um', () => {
    getPreferredJoinLocaleMock.mockReturnValue('fr');
    const guard = findRoute('join/:code').canActivate?.[0] as CanActivateFn;
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() =>
      guard(createRouteSnapshot('abc123'), {} as never),
    );

    expect(getPreferredJoinLocaleMock).toHaveBeenCalled();
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/fr/join/ABC123',
    );
  });

  it('lässt Join-Links mit expliziter Locale im Route-Tree unverändert durch', () => {
    const guard = findRoute('join/:code').canActivate?.[0] as CanActivateFn;

    const result = TestBed.runInInjectionContext(() =>
      guard(createLocalizedJoinRouteSnapshot('en', 'abc123'), {} as never),
    );

    expect(getPreferredJoinLocaleMock).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
