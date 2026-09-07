import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostPairingDialogComponent } from './host-pairing-dialog.component';

const { createInviteMock, listPairedHostsMock, approveMock, rejectMock } = vi.hoisted(() => ({
  createInviteMock: vi.fn(),
  listPairedHostsMock: vi.fn(),
  approveMock: vi.fn(),
  rejectMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      createHostPairingInvite: { mutate: createInviteMock },
      listPairedHosts: { query: listPairedHostsMock },
      approveHostPairing: { mutate: approveMock },
      rejectHostPairing: { mutate: rejectMock },
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

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    vi.clearAllMocks();
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
        { provide: MAT_DIALOG_DATA, useValue: { code: 'ABC123' } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
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

  it('zeigt den Fragment-Link und kein Token vor der Freigabe', async () => {
    const current = await render();

    expect(createInviteMock).toHaveBeenCalledWith({
      code: 'ABC123',
      screenVisibility: 'PROJECTED',
    });
    const link = current.nativeElement.querySelector(
      '[data-testid="host-pairing-link"]',
    ) as HTMLElement;
    expect(link.textContent).toContain('#s=');
    expect(link.textContent).not.toContain('?s=');
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1600);
    await flush();
    current.detectChanges();
    expect(current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')).toBeNull();
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('Happy Path: Pending erscheint, Freigabe ohne Token in der Host-UI', async () => {
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
      expect(current.nativeElement.textContent).toContain('Eule · 47');
    });
    expect(current.nativeElement.textContent).toContain('Als Host zulassen');
    current.nativeElement.querySelector('[data-testid="host-pairing-approve"]')?.click();
    await flush();
    current.detectChanges();
    expect(approveMock).toHaveBeenCalledWith({ code: 'ABC123', requestId: REQUEST_ID });
    expect(current.nativeElement.textContent).toContain('Smartphone verbunden');
    expect(current.nativeElement.textContent).not.toContain('pairedHostToken');
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
});
