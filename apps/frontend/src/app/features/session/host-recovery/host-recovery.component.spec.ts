import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHostBrowserCapability,
  getStagedHostRecoveryCard,
} from '../../../core/host-recovery-access';
import { HostRecoveryComponent } from './host-recovery.component';

const { prepareMock, activateMock, setHostTokenMock } = vi.hoisted(() => ({
  prepareMock: vi.fn(),
  activateMock: vi.fn(),
  setHostTokenMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      prepareHostCredentialExchange: { mutate: prepareMock },
      activateHostCredential: { mutate: activateMock },
    },
  },
  setHostToken: setHostTokenMock,
}));

const SUPPORT_ID = 'ARS-ABCD-2345';
const OLD_RECOVERY_CODE = 'old-recovery-capability-abcdefghijklmnopqrstuvwxyz';
const NEW_BROWSER_CAPABILITY = 'new-browser-capability-abcdefghijklmnopqrstuvwxyz';
const NEW_RECOVERY_CODE = 'new-recovery-capability-abcdefghijklmnopqrstuvwxyz';

describe('HostRecoveryComponent', () => {
  let fixture: ComponentFixture<HostRecoveryComponent> | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    prepareMock.mockResolvedValue({
      code: 'ABC123',
      browserCapability: NEW_BROWSER_CAPABILITY,
      recoveryCard: { supportId: SUPPORT_ID, recoveryCode: NEW_RECOVERY_CODE },
      pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    activateMock.mockResolvedValue({
      code: 'ABC123',
      hostToken: 'short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
      hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
      role: 'ORIGINAL_HOST',
    });
    await TestBed.configureTestingModule({
      imports: [HostRecoveryComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  function render(): ComponentFixture<HostRecoveryComponent> {
    fixture = TestBed.createComponent(HostRecoveryComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('hebt die Wiederherstellungskarte mit Titelzeile vom Seitenhintergrund ab', () => {
    const host = render().nativeElement as HTMLElement;

    expect(host.querySelector('.dialog-title-header')).not.toBeNull();
    expect(host.querySelector('.dialog-title-header__icon mat-icon')?.textContent?.trim()).toBe(
      'admin_panel_settings',
    );
    expect(host.querySelector('.host-recovery-page__card')).not.toBeNull();
    expect(host.textContent).toContain('Host-Zugang wiederherstellen');
  });

  it('speichert Prepare-Material vor der Aktivierung und überträgt Geheimnisse nur im Body', async () => {
    const current = render();
    const component = current.componentInstance;
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await component.recover();

    expect(prepareMock).toHaveBeenCalledWith({
      supportId: SUPPORT_ID,
      recoveryExchangeId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      source: { kind: 'RECOVERY', recoveryCode: OLD_RECOVERY_CODE },
    });
    expect(getHostBrowserCapability('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
    expect(getStagedHostRecoveryCard('ABC123')).toEqual({
      supportId: SUPPORT_ID,
      recoveryCode: NEW_RECOVERY_CODE,
    });
    expect(activateMock).toHaveBeenCalledWith({
      supportId: SUPPORT_ID,
      browserCapability: NEW_BROWSER_CAPABILITY,
    });
    expect(setHostTokenMock).toHaveBeenCalledWith(
      'ABC123',
      'short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
    );
    expect(navigate).toHaveBeenCalledWith(expect.arrayContaining(['session', 'ABC123', 'host']));
    expect(location.href).not.toContain(OLD_RECOVERY_CODE);
    expect(location.href).not.toContain(NEW_BROWSER_CAPABILITY);
  });

  it('verwendet für eine Admin-Übergabe denselben begrenzten Austauschpfad', async () => {
    const component = render().componentInstance;
    component.sourceKind.set('ADMIN_HANDOFF');
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await component.recover();

    expect(prepareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supportId: SUPPORT_ID,
        source: { kind: 'ADMIN_HANDOFF', handoffCapability: OLD_RECOVERY_CODE },
      }),
    );
  });

  it.each([
    ['RECOVERY', { kind: 'RECOVERY', recoveryCode: OLD_RECOVERY_CODE }],
    ['ADMIN_HANDOFF', { kind: 'ADMIN_HANDOFF', handoffCapability: OLD_RECOVERY_CODE }],
  ] as const)(
    'nimmt die vorbereitete %s-Aktivierung nach verlorener Erfolgsantwort wieder auf',
    async (sourceKind, expectedSource) => {
      const component = render().componentInstance;
      component.sourceKind.set(sourceKind);
      component.supportId.set(SUPPORT_ID);
      component.secret.set(OLD_RECOVERY_CODE);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      activateMock
        .mockRejectedValueOnce(new Error('Antwort nach erfolgreicher Aktivierung verloren'))
        .mockResolvedValueOnce({
          code: 'ABC123',
          hostToken: 'retried-short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
          hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
          role: 'ORIGINAL_HOST',
        });

      await component.recover();
      await component.recover();

      expect(prepareMock).toHaveBeenCalledTimes(1);
      expect(prepareMock).toHaveBeenCalledWith(
        expect.objectContaining({ supportId: SUPPORT_ID, source: expectedSource }),
      );
      expect(activateMock).toHaveBeenCalledTimes(2);
      expect(activateMock).toHaveBeenNthCalledWith(2, {
        supportId: SUPPORT_ID,
        browserCapability: NEW_BROWSER_CAPABILITY,
      });
      expect(setHostTokenMock).toHaveBeenCalledWith(
        'ABC123',
        'retried-short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
      );
      expect(navigate).toHaveBeenCalledWith(expect.arrayContaining(['session', 'ABC123', 'host']));
    },
  );

  it('zeigt bei ungültigem Material nur die generische Recovery-Antwort', async () => {
    prepareMock.mockRejectedValue(new Error('UNAUTHORIZED: intern'));
    const component = render().componentInstance;
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);

    await component.recover();

    expect(component.error()).toBe('Wiederherstellung nicht möglich oder abgelaufen.');
    expect(component.error()).not.toContain('intern');
    expect(activateMock).not.toHaveBeenCalled();
  });
});
