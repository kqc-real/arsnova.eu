import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, type CanActivateFn, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasFeedbackHostTokenMock, normalizeFeedbackCodeMock } = vi.hoisted(() => ({
  hasFeedbackHostTokenMock: vi.fn(),
  normalizeFeedbackCodeMock: vi.fn((code: string) => code.trim().toUpperCase()),
}));

const { clearHostTokenMock, hasHostTokenMock, normalizeHostSessionCodeMock, setHostTokenMock } =
  vi.hoisted(() => ({
    clearHostTokenMock: vi.fn(),
    hasHostTokenMock: vi.fn(),
    normalizeHostSessionCodeMock: vi.fn((code: string) => code.trim().toUpperCase()),
    setHostTokenMock: vi.fn(),
  }));

const {
  clearHostBrowserCapabilityMock,
  clearRecoveryExchangeIdMock,
  getHostBrowserCapabilityMock,
  getOrCreateRecoveryExchangeIdMock,
  getStagedHostRecoveryCardMock,
  persistInitialHostRecoveryMock,
} = vi.hoisted(() => ({
  clearHostBrowserCapabilityMock: vi.fn(),
  clearRecoveryExchangeIdMock: vi.fn(),
  getHostBrowserCapabilityMock: vi.fn(),
  getOrCreateRecoveryExchangeIdMock: vi.fn(),
  getStagedHostRecoveryCardMock: vi.fn(),
  persistInitialHostRecoveryMock: vi.fn(),
}));

const {
  activateHostCredentialMock,
  getParticipantSummaryQueryMock,
  issueHostAccessTokenMock,
  prepareHostCredentialBootstrapMock,
} = vi.hoisted(() => ({
  activateHostCredentialMock: vi.fn(),
  getParticipantSummaryQueryMock: vi.fn(),
  issueHostAccessTokenMock: vi.fn(),
  prepareHostCredentialBootstrapMock: vi.fn(),
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
  setHostToken: setHostTokenMock,
}));

vi.mock('./core/host-recovery-access', () => ({
  clearHostBrowserCapability: clearHostBrowserCapabilityMock,
  clearRecoveryExchangeId: clearRecoveryExchangeIdMock,
  getHostBrowserCapability: getHostBrowserCapabilityMock,
  getOrCreateRecoveryExchangeId: getOrCreateRecoveryExchangeIdMock,
  getStagedHostRecoveryCard: getStagedHostRecoveryCardMock,
  persistInitialHostRecovery: persistInitialHostRecoveryMock,
}));

vi.mock('./core/trpc.client', () => ({
  trpc: {
    session: {
      activateHostCredential: { mutate: activateHostCredentialMock },
      getParticipantSummary: { query: getParticipantSummaryQueryMock },
      issueHostAccessToken: { mutate: issueHostAccessTokenMock },
      prepareHostCredentialBootstrap: { mutate: prepareHostCredentialBootstrapMock },
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
    getHostBrowserCapabilityMock.mockReturnValue(null);
    getOrCreateRecoveryExchangeIdMock.mockReturnValue('recovery-exchange-id');
    getStagedHostRecoveryCardMock.mockReturnValue(null);
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 0,
      activeParticipantCount: 0,
    });
    prepareHostCredentialBootstrapMock.mockRejectedValue(new Error('Legacy migration unavailable'));
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
    expect(getParticipantSummaryQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(result).toBe(true);
  });

  it('leitet die Session-Host-Route ohne Host-Token zur Wiederherstellung um', async () => {
    hasHostTokenMock.mockReturnValue(false);
    const guard = findChildRoute('session/:code', 'host').canActivate?.[0] as CanActivateFn;
    const router = TestBed.inject(Router);

    const result = await TestBed.runInInjectionContext(() =>
      guard(createChildRouteSnapshot('abc123'), {} as never),
    );

    expect(normalizeHostSessionCodeMock).toHaveBeenCalledWith('abc123');
    expect(getParticipantSummaryQueryMock).not.toHaveBeenCalled();
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/host-recovery',
    );
  });

  it('räumt einen ungültigen gespeicherten Host-Token weg und leitet zur Wiederherstellung um', async () => {
    hasHostTokenMock.mockReturnValue(true);
    getParticipantSummaryQueryMock.mockRejectedValue(
      new Error('UNAUTHORIZED: Host-Authentifizierung erforderlich.'),
    );
    const guard = findChildRoute('session/:code', 'host').canActivate?.[0] as CanActivateFn;
    const router = TestBed.inject(Router);

    const result = await TestBed.runInInjectionContext(() =>
      guard(createChildRouteSnapshot('abc123'), {} as never),
    );

    expect(clearHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/host-recovery',
    );
  });

  it('lässt die Pairing-Anfrage ohne Host-Token zu', () => {
    const pair = findChildRoute('session/:code', 'pair');
    expect(pair.canActivate).toBeUndefined();
    expect(typeof pair.loadComponent).toBe('function');
  });

  it('lädt die Present-Route lazy und hält den Guard aus dem App-Routing', () => {
    const present = findChildRoute('session/:code', 'present');
    expect(present.canActivate).toBeUndefined();
    expect(present.loadComponent).toBeUndefined();
    expect(typeof present.loadChildren).toBe('function');
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

  it('kennzeichnet den codefreien Join-Pfad als expliziten Fokus-Einstieg', () => {
    expect(findRoute('join').data?.['focusSessionCode']).toBe(true);
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
