import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostPairingDialogComponent } from './host-pairing-dialog.component';
import {
  PresentationStartDialogComponent,
  type PresentationStartDialogData,
} from './presentation-start-dialog.component';

const { listPairedHostsMock, dialogOpenMock, dialogCloseMock } = vi.hoisted(() => ({
  listPairedHostsMock: vi.fn(),
  dialogOpenMock: vi.fn(),
  dialogCloseMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      listPairedHosts: { query: listPairedHostsMock },
    },
  },
}));

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

describe('PresentationStartDialogComponent', () => {
  let fixture: ComponentFixture<PresentationStartDialogComponent> | undefined;
  const dialogData: PresentationStartDialogData = { code: 'ABC123' };

  beforeEach(async () => {
    vi.clearAllMocks();
    delete dialogData.startPresenterView;
    listPairedHostsMock.mockResolvedValue({
      devices: [],
      pending: null,
      invite: null,
      caps: EMPTY_CAPS,
    });
    dialogOpenMock.mockReturnValue({ afterClosed: () => of(undefined) });
    await TestBed.configureTestingModule({
      imports: [PresentationStartDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: { close: dialogCloseMock } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<PresentationStartDialogComponent>> {
    fixture = TestBed.createComponent(PresentationStartDialogComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return fixture;
  }

  it('startet die Präsentation ohne Pairing und defaultet auf projiziert', async () => {
    const current = await render();
    expect(current.nativeElement.textContent).toContain('Präsentation starten');
    expect(current.nativeElement.textContent).toContain('Mit Smartphone steuern');
    expect(current.nativeElement.textContent).toContain('Weiteres Host-Gerät verbinden');
    expect(
      current.nativeElement.querySelector('[data-testid="presentation-start-connected"]'),
    ).toBeNull();
    const projected = current.nativeElement.querySelector(
      '[data-testid="presentation-start-visibility-projected"] input',
    ) as HTMLInputElement | null;
    expect(projected?.checked).toBe(true);
    current.nativeElement.querySelector('[data-testid="presentation-start-fullscreen"]')?.click();
    expect(dialogCloseMock).toHaveBeenCalledWith('start');
  });

  it('zeigt den verbundenen Zustand und blockiert den Start nicht', async () => {
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
    expect(current.nativeElement.textContent).toContain('Smartphone verbunden');
    expect(
      current.nativeElement.querySelector('[data-testid="presentation-start-connect"]'),
    ).toBeNull();
    expect(
      current.nativeElement.querySelector('[data-testid="presentation-start-cohost"]'),
    ).not.toBeNull();
    current.nativeElement.querySelector('[data-testid="presentation-start-fullscreen"]')?.click();
    expect(dialogCloseMock).toHaveBeenCalledWith('start');
  });

  it('gibt die gewählte Sichtbarkeit an den Pairing-Dialog weiter', async () => {
    const current = await render();
    current.componentInstance.onVisibilityChange('PRIVATE');
    current.nativeElement.querySelector('[data-testid="presentation-start-connect"]')?.click();
    expect(dialogOpenMock).toHaveBeenCalledWith(
      HostPairingDialogComponent,
      expect.objectContaining({
        data: { code: 'ABC123', screenVisibility: 'PRIVATE' },
      }),
    );
  });

  it('lässt den Start zu, wenn Pairing nicht verfügbar ist', async () => {
    listPairedHostsMock.mockRejectedValue(new Error('FORBIDDEN'));
    const current = await render();
    expect(
      current.nativeElement.querySelector('[data-testid="presentation-start-connect"]'),
    ).toBeNull();
    expect(current.nativeElement.textContent).not.toContain('Mit Smartphone steuern');
    current.nativeElement.querySelector('[data-testid="presentation-start-fullscreen"]')?.click();
    expect(dialogCloseMock).toHaveBeenCalledWith('start');
  });

  it('zeigt das Gerätelimit verständlich', async () => {
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
    expect(
      current.nativeElement.querySelector('[data-testid="presentation-start-cap"]'),
    ).toBeTruthy();
    expect(
      current.nativeElement.querySelector('[data-testid="presentation-start-cohost"]'),
    ).toBeNull();
    expect(
      current.nativeElement.querySelector('[data-testid="presentation-start-manage"]'),
    ).toBeTruthy();
  });

  it('öffnet die Presenter-Ansicht im Klick der Primäraktion', async () => {
    const startPresenterView = vi.fn().mockResolvedValue({ closed: false });
    dialogData.startPresenterView = startPresenterView;
    const current = await render();
    current.nativeElement.querySelector('[data-testid="presentation-start-fullscreen"]')?.click();
    await flush();
    expect(startPresenterView).toHaveBeenCalledTimes(1);
    expect(dialogCloseMock).toHaveBeenCalledWith('start');
  });

  it('meldet ein blockiertes Presenter-Fenster', async () => {
    dialogData.startPresenterView = vi.fn().mockResolvedValue(null);
    const current = await render();
    current.nativeElement.querySelector('[data-testid="presentation-start-fullscreen"]')?.click();
    await flush();
    expect(dialogCloseMock).toHaveBeenCalledWith('blocked');
  });
});
