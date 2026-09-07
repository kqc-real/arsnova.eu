import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionHostPairingRequestComponent } from './session-host-pairing-request.component';

const { requestMock, getRequestMock, setHostTokenMock, setPendingMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  getRequestMock: vi.fn(),
  setHostTokenMock: vi.fn(),
  setPendingMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      requestHostPairing: { mutate: requestMock },
      getHostPairingRequest: { query: getRequestMock },
    },
  },
  setPendingHostSessionCode: setPendingMock,
}));

vi.mock('../../../core/host-session-token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/host-session-token')>();
  return {
    ...actual,
    setHostToken: setHostTokenMock,
  };
});

const SECRET = 'c'.repeat(32);
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_SECRET = 'd'.repeat(32);

function pendingClaim(overrides: Record<string, unknown> = {}) {
  return {
    requestId: REQUEST_ID,
    state: 'PENDING_APPROVAL',
    confirmationIndicator: 'Eule · 47',
    expiresAt: '2026-09-07T14:00:00.000Z',
    token: null,
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('SessionHostPairingRequestComponent', () => {
  let fixture: ComponentFixture<SessionHostPairingRequestComponent> | undefined;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    vi.clearAllMocks();
    window.history.replaceState(null, '', `/session/ABC123/pair#s=${SECRET}`);
    requestMock.mockResolvedValue({
      requestId: REQUEST_ID,
      requestSecret: REQUEST_SECRET,
      confirmationIndicator: 'Eule · 47',
      state: 'PENDING_APPROVAL',
      alreadyPending: false,
      expiresAt: '2026-09-07T14:00:00.000Z',
    });
    getRequestMock.mockResolvedValue(pendingClaim());
    await TestBed.configureTestingModule({
      imports: [SessionHostPairingRequestComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { snapshot: { paramMap: convertToParamMap({ code: 'ABC123' }) } },
            snapshot: { paramMap: convertToParamMap({ code: 'ABC123' }) },
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function render(): ComponentFixture<SessionHostPairingRequestComponent> {
    fixture = TestBed.createComponent(SessionHostPairingRequestComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('zeigt den Pairing-Kopf mit MD3-devices-Icon', () => {
    const current = render();
    expect(current.nativeElement.querySelector('.dialog-title-header')).not.toBeNull();
    expect(
      current.nativeElement.querySelector('.dialog-title-header mat-icon')?.textContent?.trim(),
    ).toBe('devices');
    expect(current.nativeElement.textContent).toContain('Mit Veranstaltung verbinden');
    expect(current.nativeElement.textContent).toContain('Nach der Freigabe');
  });

  it('fragt die Verbindung an und bleibt ohne Approve im Pending', async () => {
    const current = render();
    current.nativeElement.querySelector('[data-testid="host-pairing-request"]')?.click();
    await flush();
    current.detectChanges();
    expect(requestMock).toHaveBeenCalledWith({
      code: 'ABC123',
      pairingSecret: SECRET,
    });
    expect(current.nativeElement.textContent).toContain('Eule · 47');
    expect(setHostTokenMock).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('legt nach Freigabe das Host-Token ab und leitet zur Host-Route', async () => {
    getRequestMock.mockResolvedValue({
      requestId: REQUEST_ID,
      state: 'PAIRED_HOST_TOKEN_ISSUED',
      confirmationIndicator: null,
      expiresAt: null,
      token: {
        tokenId: '33333333-3333-4333-8333-333333333333',
        pairedHostToken: 'paired-token',
        role: 'PAIRED_HOST',
      },
    });
    const current = render();
    current.nativeElement.querySelector('[data-testid="host-pairing-request"]')?.click();
    await flush();
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    expect(setHostTokenMock).toHaveBeenCalledWith('ABC123', 'paired-token');
    expect(setPendingMock).toHaveBeenCalledWith('ABC123');
  });

  it('zeigt Ablehnung ohne Token', async () => {
    getRequestMock.mockResolvedValue(pendingClaim({ state: 'REJECTED' }));
    const current = render();
    current.nativeElement.querySelector('[data-testid="host-pairing-request"]')?.click();
    await flush();
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    current.detectChanges();
    expect(current.nativeElement.textContent).toContain('abgelehnt');
    expect(setHostTokenMock).not.toHaveBeenCalled();
  });

  it('zeigt Ablauf ohne Token', async () => {
    getRequestMock.mockResolvedValue(pendingClaim({ state: 'EXPIRED' }));
    const current = render();
    current.nativeElement.querySelector('[data-testid="host-pairing-request"]')?.click();
    await flush();
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    current.detectChanges();
    expect(current.nativeElement.textContent).toContain('abgelaufen');
    expect(setHostTokenMock).not.toHaveBeenCalled();
  });

  it('behandelt Replay / bereits angefragt ohne Token', async () => {
    requestMock.mockResolvedValue({
      requestId: null,
      requestSecret: null,
      confirmationIndicator: 'Eule · 47',
      state: 'PENDING_APPROVAL',
      alreadyPending: true,
      expiresAt: '2026-09-07T14:00:00.000Z',
    });
    const current = render();
    current.nativeElement.querySelector('[data-testid="host-pairing-request"]')?.click();
    await flush();
    current.detectChanges();
    expect(current.nativeElement.textContent).toContain('bereits');
    expect(setHostTokenMock).not.toHaveBeenCalled();
  });

  it('liest kein Geheimnis aus der Query und bleibt ohne Fragment unvollständig', async () => {
    window.history.replaceState(null, '', `/session/ABC123/pair?s=${SECRET}`);
    const current = render();
    expect(current.nativeElement.textContent).toContain('unvollständig');
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-request"]')).toBeNull();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('führt von der unvollständigen Pair-Karte zur Startseite', async () => {
    window.history.replaceState(null, '', `/session/ABC123/pair?s=${SECRET}`);
    const current = render();
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    current.nativeElement.querySelector('[data-testid="host-pairing-go-home"]')?.click();
    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
