import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HostPairingDialogComponent,
  type HostPairingDialogData,
} from './host-pairing-dialog.component';

const {
  createInviteMock,
  listPairedHostsMock,
  approveMock,
  rejectMock,
  revokeMock,
  dialogCloseMock,
} = vi.hoisted(() => ({
  createInviteMock: vi.fn(),
  listPairedHostsMock: vi.fn(),
  approveMock: vi.fn(),
  rejectMock: vi.fn(),
  revokeMock: vi.fn(),
  dialogCloseMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      createHostPairingInvite: { mutate: createInviteMock },
      listPairedHosts: { query: listPairedHostsMock },
      approveHostPairing: { mutate: approveMock },
      rejectHostPairing: { mutate: rejectMock },
      revokePairedHost: { mutate: revokeMock },
    },
  },
}));

vi.mock('./host-pairing-url', () => ({
  buildHostPairingUrl: (code: string, secret: string) =>
    `https://arsnova.eu/de/session/${code}/pair#s=${secret}`,
}));

vi.mock('qrcode-generator', () => ({
  default: () => ({
    addData: vi.fn(),
    make: vi.fn(),
    createDataURL: () => 'data:image/gif;base64,qr',
  }),
}));

const SECRET = 'b'.repeat(32);
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';

const EMPTY_CAPS = {
  maxPairedHosts: 3,
  maxActiveInvites: 1,
  maxPendingPerInvite: 1,
  inviteTtlSeconds: 300,
  pendingTtlSeconds: 300,
};

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('HostPairingDialogComponent', () => {
  let fixture: ComponentFixture<HostPairingDialogComponent> | undefined;
  const dialogData: HostPairingDialogData = {
    code: 'ABC123',
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    vi.clearAllMocks();
    delete dialogData.screenVisibility;
    delete dialogData.startPresenterView;
    createInviteMock.mockResolvedValue({
      inviteId: '11111111-1111-4111-8111-111111111111',
      pairingSecret: SECRET,
      expiresAt: '2026-09-07T14:00:00.000Z',
      state: 'PAIRING_INVITE_CREATED',
      screenVisibility: 'PROJECTED',
      caps: EMPTY_CAPS,
    });
    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: null,
      invite: {
        inviteId: '11111111-1111-4111-8111-111111111111',
        state: 'PAIRING_INVITE_CREATED',
        screenVisibility: 'PROJECTED',
        expiresAt: '2026-09-07T14:00:00.000Z',
      },
      caps: EMPTY_CAPS,
    });
    await TestBed.configureTestingModule({
      imports: [HostPairingDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: { close: dialogCloseMock } },
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

  async function render(): Promise<ComponentFixture<HostPairingDialogComponent>> {
    fixture = TestBed.createComponent(HostPairingDialogComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return fixture;
  }

  it('zeigt den QR-Code ohne Secret-Link und kopiert nur das Fragment', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const current = await render();

    expect(createInviteMock).toHaveBeenCalledWith({
      code: 'ABC123',
      screenVisibility: 'PROJECTED',
    });
    expect(
      current.nativeElement.querySelector('.dialog-title-header mat-icon')?.textContent?.trim(),
    ).toBe('devices');
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-link"]')).toBeNull();
    expect(current.nativeElement.textContent).not.toContain('#s=');
    expect(current.nativeElement.textContent).not.toContain(SECRET);
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')).toBeNull();
    current.nativeElement.querySelector('[data-testid="host-pairing-copy"]')?.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith(`https://arsnova.eu/de/session/ABC123/pair#s=${SECRET}`);
    expect(writeText.mock.calls[0]?.[0]).not.toContain('?s=');
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    current.detectChanges();
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')).toBeNull();
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('Happy Path: Pending erscheint, Freigabe ohne Token in der Host-UI', async () => {
    let approved = false;
    listPairedHostsMock.mockImplementation(async () =>
      approved
        ? {
            devices: [
              {
                tokenId: '33333333-3333-4333-8333-333333333333',
                deviceLabel: 'Smartphone',
                pairedAt: '2026-09-07T14:00:00.000Z',
                state: 'CONNECTED',
              },
            ],
            pending: null,
            invite: null,
            caps: EMPTY_CAPS,
          }
        : {
            devices: [],
            pending: {
              requestId: REQUEST_ID,
              confirmationIndicator: 'Eule · 47',
              deviceLabel: 'Smartphone',
              state: 'PENDING_APPROVAL',
              expiresAt: '2026-09-07T14:00:00.000Z',
              createdAt: '2026-09-07T13:55:00.000Z',
            },
            invite: null,
            caps: EMPTY_CAPS,
          },
    );
    approveMock.mockImplementation(async () => {
      approved = true;
      return {
        requestId: REQUEST_ID,
        tokenId: '33333333-3333-4333-8333-333333333333',
        state: 'CONNECTED',
        confirmationIndicator: 'Eule · 47',
      };
    });

    const current = await render();
    await vi.waitFor(() => {
      current.detectChanges();
      expect(current.nativeElement.textContent).toContain('Eule · 47');
    });
    expect(current.nativeElement.textContent).toContain('Als Host zulassen');
    current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')?.click();
    await flush();
    current.detectChanges();
    expect(approveMock).toHaveBeenCalledWith({ code: 'ABC123', requestId: REQUEST_ID });
    expect(current.nativeElement.textContent).toContain('Smartphone verbunden');
    expect(current.nativeElement.textContent).not.toContain('pairedHostToken');
    expect(dialogCloseMock).not.toHaveBeenCalled();
  });

  it('startet die Presenter-Ansicht beim Freigeben aus Präsentation starten', async () => {
    const startPresenterView = vi.fn().mockResolvedValue({ closed: false });
    dialogData.startPresenterView = startPresenterView;
    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: {
        requestId: REQUEST_ID,
        confirmationIndicator: 'Eule · 47',
        deviceLabel: 'Smartphone',
        state: 'PENDING_APPROVAL',
        expiresAt: '2026-09-07T14:00:00.000Z',
        createdAt: '2026-09-07T13:55:00.000Z',
      },
      invite: null,
      caps: EMPTY_CAPS,
    });
    approveMock.mockResolvedValue({
      requestId: REQUEST_ID,
      tokenId: '33333333-3333-4333-8333-333333333333',
      state: 'CONNECTED',
      confirmationIndicator: 'Eule · 47',
    });

    const current = await render();
    await vi.waitFor(() => {
      current.detectChanges();
      expect(
        current.nativeElement.querySelector('[data-testid="host-pairing-approve"]'),
      ).toBeTruthy();
    });
    current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')?.click();
    await flush();
    current.detectChanges();

    expect(startPresenterView).toHaveBeenCalledTimes(1);
    expect(approveMock).toHaveBeenCalledWith({ code: 'ABC123', requestId: REQUEST_ID });
    expect(startPresenterView.mock.invocationCallOrder[0]).toBeLessThan(
      approveMock.mock.invocationCallOrder[0],
    );
    expect(dialogCloseMock).toHaveBeenCalledWith({
      connected: true,
      presenterOpened: true,
    });
  });

  it('startet die Presenter-Ansicht beim Schließen, wenn schon ein Gerät verbunden ist', async () => {
    const startPresenterView = vi.fn().mockResolvedValue({ closed: false });
    dialogData.startPresenterView = startPresenterView;
    listPairedHostsMock.mockResolvedValue({
      devices: [
        {
          tokenId: '33333333-3333-4333-8333-333333333333',
          deviceLabel: 'Smartphone',
          pairedAt: '2026-09-07T14:00:00.000Z',
          state: 'CONNECTED',
        },
      ],
      pending: null,
      invite: null,
      caps: EMPTY_CAPS,
    });

    const current = await render();
    current.nativeElement.querySelector('[data-testid="host-pairing-close"]')?.click();
    await flush();

    expect(startPresenterView).toHaveBeenCalledTimes(1);
    expect(dialogCloseMock).toHaveBeenCalledWith({
      connected: true,
      presenterOpened: true,
    });
  });

  it('lehnt ab, ohne ein Token zu zeigen', async () => {
    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: {
        requestId: REQUEST_ID,
        confirmationIndicator: 'Fuchs · 12',
        deviceLabel: null,
        state: 'PENDING_APPROVAL',
        expiresAt: '2026-09-07T14:00:00.000Z',
        createdAt: '2026-09-07T13:55:00.000Z',
      },
      invite: null,
      caps: EMPTY_CAPS,
    });
    rejectMock.mockResolvedValue({ requestId: REQUEST_ID, state: 'REJECTED' });

    const current = await render();
    await vi.waitFor(() => {
      current.detectChanges();
      expect(
        current.nativeElement.querySelector('[data-testid="host-pairing-reject"]'),
      ).toBeTruthy();
    });
    current.nativeElement.querySelector('[data-testid="host-pairing-reject"]')?.click();
    await flush();
    current.detectChanges();
    expect(rejectMock).toHaveBeenCalled();
    expect(current.nativeElement.textContent).toContain('abgelehnt');
    expect(current.nativeElement.textContent).not.toContain('pairedHostToken');
  });

  it('nutzt die private Copy ohne automatische Freigabe', async () => {
    dialogData.screenVisibility = 'PRIVATE';
    const current = await render();
    expect(createInviteMock).toHaveBeenCalledWith({
      code: 'ABC123',
      screenVisibility: 'PRIVATE',
    });
    expect(current.nativeElement.textContent).toContain('automatisch wird niemand Host');
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')).toBeNull();
  });

  it('zeigt Geräteverwaltung und trennt eine Verbindung', async () => {
    const device = {
      tokenId: '33333333-3333-4333-8333-333333333333',
      deviceLabel: 'Tutorin',
      pairedAt: '2026-09-07T14:02:00.000Z',
      state: 'CONNECTED' as const,
    };
    listPairedHostsMock.mockResolvedValue({
      devices: [device],
      pending: null,
      invite: null,
      caps: EMPTY_CAPS,
    });
    revokeMock.mockResolvedValue({ tokenId: device.tokenId, state: 'REVOKED' });

    const current = await render();
    expect(createInviteMock).not.toHaveBeenCalled();
    expect(current.nativeElement.textContent).toContain('Tutorin');
    expect(current.nativeElement.textContent).toContain('Verbindung trennen');
    expect(current.nativeElement.textContent).not.toContain(device.tokenId);

    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: null,
      invite: null,
      caps: EMPTY_CAPS,
    });
    current.nativeElement.querySelector('[data-testid="host-pairing-revoke"]')?.click();
    await flush();
    current.detectChanges();
    expect(revokeMock).toHaveBeenCalledWith({
      code: 'ABC123',
      tokenId: device.tokenId,
    });
    expect(current.nativeElement.textContent).toContain('Verbindung getrennt');
  });

  it('zeigt das Limit verständlich und startet keine neue Einladung', async () => {
    listPairedHostsMock.mockResolvedValue({
      devices: [
        {
          tokenId: '33333333-3333-4333-8333-333333333331',
          deviceLabel: 'Gerät 1',
          pairedAt: '2026-09-07T14:00:00.000Z',
          state: 'CONNECTED',
        },
        {
          tokenId: '33333333-3333-4333-8333-333333333332',
          deviceLabel: 'Gerät 2',
          pairedAt: '2026-09-07T14:01:00.000Z',
          state: 'CONNECTED',
        },
        {
          tokenId: '33333333-3333-4333-8333-333333333333',
          deviceLabel: 'Gerät 3',
          pairedAt: '2026-09-07T14:02:00.000Z',
          state: 'CONNECTED',
        },
      ],
      pending: null,
      invite: null,
      caps: EMPTY_CAPS,
    });
    const current = await render();
    expect(createInviteMock).not.toHaveBeenCalled();
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-cap"]')).toBeTruthy();
    expect(
      current.nativeElement.querySelector('[data-testid="host-pairing-add-another"]'),
    ).toBeNull();
    expect(current.nativeElement.textContent).toContain('drei weitere Geräte');
  });

  it('zeigt Rate-Limit ohne Technikbegriffe', async () => {
    createInviteMock.mockRejectedValue({
      data: { code: 'TOO_MANY_REQUESTS', retryAfterSeconds: 12 },
      message: 'Zu viele Verbindungsversuche. Bitte später erneut versuchen.',
    });
    const current = await render();
    expect(current.nativeElement.textContent).toContain('Zu viele Verbindungsversuche');
    expect(current.nativeElement.textContent).not.toContain('WebSocket');
    expect(current.nativeElement.textContent).not.toContain('tokenId');
  });

  it('beendet einen abgelaufenen QR und bietet Neu versuchen', async () => {
    const current = await render();
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-copy"]')).toBeTruthy();
    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: null,
      invite: null,
      caps: EMPTY_CAPS,
    });
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    current.detectChanges();
    expect(current.nativeElement.textContent).toContain('abgelaufen');
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-copy"]')).toBeNull();
  });

  it('beendet eine abgelaufene Freigabeanfrage', async () => {
    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: {
        requestId: REQUEST_ID,
        confirmationIndicator: 'Eule · 47',
        deviceLabel: 'Smartphone',
        state: 'PENDING_APPROVAL',
        expiresAt: '2026-09-07T14:00:00.000Z',
        createdAt: '2026-09-07T13:55:00.000Z',
      },
      invite: null,
      caps: EMPTY_CAPS,
    });
    const current = await render();
    await vi.waitFor(() => {
      current.detectChanges();
      expect(
        current.nativeElement.querySelector('[data-testid="host-pairing-approve"]'),
      ).toBeTruthy();
    });
    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: null,
      invite: null,
      caps: EMPTY_CAPS,
    });
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    current.detectChanges();
    expect(current.nativeElement.textContent).toContain('abgelaufen');
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')).toBeNull();
  });
});
