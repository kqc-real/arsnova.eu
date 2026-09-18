import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHostBrowserCapability,
  getHostRecoveryCandidate,
  getPendingHostCredentialActivation,
  persistPreparedHostRecovery,
} from '../../../core/host-recovery-access';
import { HostRecoveryComponent } from './host-recovery.component';

const { prepareMock, activateMock, issueMock, setHostTokenMock } = vi.hoisted(() => ({
  prepareMock: vi.fn(),
  activateMock: vi.fn(),
  issueMock: vi.fn(),
  setHostTokenMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      prepareHostCredentialExchange: { mutate: prepareMock },
      activateHostCredential: { mutate: activateMock },
      issueHostAccessToken: { mutate: issueMock },
    },
  },
  setHostToken: setHostTokenMock,
}));

const SUPPORT_ID = 'ARS-ABCD-2345';
const OLD_RECOVERY_CODE = 'old-recovery-capability-abcdefghijklmnopqrstuvwxyz';
const NEW_BROWSER_CAPABILITY = 'new-browser-capability-abcdefghijklmnopqrstuvwxyz';
const NEW_RECOVERY_CODE = 'New-recovery_capability-abcdefghijklmnopqrstuvwxyz';

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
    issueMock.mockResolvedValue({
      code: 'ABC123',
      hostToken: 'issued-host-token-abcdefghijklmnopqrstuvwxyz',
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

  async function prepareFlow(component: HostRecoveryComponent): Promise<void> {
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);
    await component.continueRecovery();
  }

  it('hebt die Wiederherstellungskarte mit Titelzeile vom Seitenhintergrund ab', () => {
    const host = render().nativeElement as HTMLElement;

    expect(host.querySelector('.dialog-title-header')).not.toBeNull();
    expect(host.querySelector('.dialog-title-header__icon mat-icon')?.textContent?.trim()).toBe(
      'admin_panel_settings',
    );
    expect(host.querySelector('.host-recovery-page__card')).not.toBeNull();
    expect(host.textContent).toContain('Host-Zugang wiederherstellen');
    expect(host.textContent).toContain('Gib die Session-Kennung und den Wiederherstellungscode');
    expect(host.textContent).toContain('weder die Session noch die Nachbereitungsfrist');
    expect(host.textContent).toContain('Kontaktdaten im Impressum');
    expect(host.textContent).toContain('Schritt 1 von 3');
    expect(host.querySelector('mat-button-toggle-group')).toBeNull();
    expect(
      host.querySelector('input[name="arsnova-host-support-id"]')?.getAttribute('placeholder'),
    ).toBeNull();
    expect(
      host.querySelector('input[name="arsnova-host-recovery-secret"]')?.getAttribute('type'),
    ).toBe('text');
  });

  it('bereitet vor, ohne automatisch zu aktivieren, und überträgt Geheimnisse nur im Body', async () => {
    const current = render();
    const component = current.componentInstance;
    await prepareFlow(component);
    current.detectChanges();

    expect(prepareMock).toHaveBeenCalledWith({
      supportId: SUPPORT_ID,
      recoveryExchangeId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      source: { kind: 'RECOVERY', recoveryCode: OLD_RECOVERY_CODE },
    });
    expect(getHostRecoveryCandidate('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
    expect(getHostBrowserCapability('ABC123')).toBeNull();
    expect(activateMock).not.toHaveBeenCalled();
    expect(current.nativeElement.textContent).toContain('Neue Zugangsdaten sichern');
    expect(current.nativeElement.textContent).toContain(
      'Die bisherigen Host-Zugänge werden ungültig',
    );
    expect(
      current.nativeElement.querySelector('[data-testid="host-recovery-activate"]'),
    ).toBeTruthy();
    expect(
      (
        current.nativeElement.querySelector(
          '[data-testid="host-recovery-activate"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(location.href).not.toContain(OLD_RECOVERY_CODE);
    expect(location.href).not.toContain(NEW_BROWSER_CAPABILITY);
  });

  it('aktiviert erst nach ausdrücklicher Sicherung und zeigt den Erfolg vor der Navigation', async () => {
    const current = render();
    const component = current.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await prepareFlow(component);
    component.newCardSaved.set(true);
    await component.activateAccess();
    current.detectChanges();

    expect(activateMock).toHaveBeenCalledWith({
      supportId: SUPPORT_ID,
      browserCapability: NEW_BROWSER_CAPABILITY,
    });
    expect(setHostTokenMock).toHaveBeenCalledWith(
      'ABC123',
      'short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(current.nativeElement.textContent).toContain('Host-Zugang wiederhergestellt');
    expect(current.nativeElement.textContent).toContain(
      'Verwende künftig den neuen Wiederherstellungscode',
    );

    await component.goToSession();
    expect(navigate).toHaveBeenCalledWith(expect.arrayContaining(['session', 'ABC123', 'host']));
  });

  it('zeigt die Support-Übergabe erst hinter einem stillen Wechsel, nicht als zweiten Tab', () => {
    const current = render();
    const host = current.nativeElement as HTMLElement;
    const component = current.componentInstance;

    expect(host.textContent).toContain('Ich habe einen Code vom Support');
    expect(host.textContent).not.toContain('Support-Übergabe');
    component.switchSource('ADMIN_HANDOFF');
    current.detectChanges();
    expect(host.textContent).toContain('Code vom Support');
    expect(host.textContent).toContain('Ich habe gespeicherte Zugangsdaten');
    expect(component.secret()).toBe('');
  });

  it('verwendet für eine Admin-Übergabe denselben begrenzten Austauschpfad', async () => {
    const current = render();
    const component = current.componentInstance;
    component.switchSource('ADMIN_HANDOFF');
    await prepareFlow(component);
    current.detectChanges();

    expect(prepareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supportId: SUPPORT_ID,
        source: { kind: 'ADMIN_HANDOFF', handoffCapability: OLD_RECOVERY_CODE },
      }),
    );
    expect(current.nativeElement.textContent).toContain(
      'Der Support hat die bisherigen Host-Zugänge bereits gesperrt',
    );
    expect(current.nativeElement.textContent).not.toContain(
      'Die bisherigen Host-Zugänge werden ungültig',
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
      activateMock.mockRejectedValueOnce(
        new Error('Antwort nach erfolgreicher Aktivierung verloren'),
      );
      issueMock.mockResolvedValueOnce({
        code: 'ABC123',
        hostToken: 'retried-short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
        hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
        role: 'ORIGINAL_HOST',
      });

      await component.continueRecovery();
      component.newCardSaved.set(true);
      await component.activateAccess();
      expect(component.view()).toBe('activationUnconfirmed');
      await component.resumeRecovery();

      expect(prepareMock).toHaveBeenCalledTimes(1);
      expect(prepareMock).toHaveBeenCalledWith(
        expect.objectContaining({ supportId: SUPPORT_ID, source: expectedSource }),
      );
      expect(activateMock).toHaveBeenCalledTimes(1);
      expect(issueMock).toHaveBeenCalledWith({
        code: 'ABC123',
        browserCapability: NEW_BROWSER_CAPABILITY,
      });
      expect(setHostTokenMock).toHaveBeenCalledWith(
        'ABC123',
        'retried-short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
      );
    },
  );

  it('nimmt nach Tabverlust und abgelaufenem Pending über die gespeicherte Capability wieder auf', async () => {
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: 'ABC123',
        browserCapability: NEW_BROWSER_CAPABILITY,
        recoveryCard: { supportId: SUPPORT_ID, recoveryCode: NEW_RECOVERY_CODE },
        pendingExpiresAt: new Date(Date.now() - 16 * 60_000).toISOString(),
      },
    });
    sessionStorage.clear();
    const current = render();
    const component = current.componentInstance;
    current.detectChanges();

    expect(component.view()).toBe('resume');
    expect(component.secret()).toBe('');
    await component.resumeRecovery();

    expect(prepareMock).not.toHaveBeenCalled();
    expect(issueMock).toHaveBeenCalledWith({
      code: 'ABC123',
      browserCapability: NEW_BROWSER_CAPABILITY,
    });
    expect(component.view()).toBe('success');
    expect(component.showNewCodeHint()).toBe(false);
  });

  it('erfindet nach Wiederaufnahme ohne Karte keine Sicherungsbestätigung', async () => {
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: 'ABC123',
        browserCapability: NEW_BROWSER_CAPABILITY,
        recoveryCard: { supportId: SUPPORT_ID, recoveryCode: NEW_RECOVERY_CODE },
        pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    sessionStorage.clear();
    localStorage.removeItem('arsnova-host-recovery-pending-card-ABC123');
    const component = render().componentInstance;
    await component.resumeRecovery();
    expect(issueMock).toHaveBeenCalled();
    expect(component.showNewCodeHint()).toBe(false);
  });

  it('markiert syntaktisch ungültige Zeichen am Feld und sendet keinen Request', async () => {
    const current = render();
    const component = current.componentInstance;
    component.supportId.set(SUPPORT_ID);
    component.secret.set('abc\\_not-valid-secret-value-here');
    await component.continueRecovery();
    current.detectChanges();

    expect(prepareMock).not.toHaveBeenCalled();
    expect(component.secretError()).toContain('Bindestriche und Unterstriche');
    expect(component.secret()).toBe('abc\\_not-valid-secret-value-here');
  });

  it('zeigt bei ungültigem Material nur die generische Recovery-Antwort', async () => {
    prepareMock.mockRejectedValue(new Error('UNAUTHORIZED: intern'));
    const component = render().componentInstance;
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);

    await component.continueRecovery();

    expect(component.bannerError()).toBe(
      'Der Zugang konnte nicht wiederhergestellt werden. Prüfe deine Angaben oder wende dich an den Support.',
    );
    expect(component.bannerError()).not.toContain('intern');
    expect(activateMock).not.toHaveBeenCalled();
  });

  it('unterscheidet Netzwerkfehler von falschen Zugangsdaten', async () => {
    prepareMock.mockRejectedValue(new Error('Failed to fetch'));
    const component = render().componentInstance;
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);
    await component.continueRecovery();
    expect(component.bannerError()).toBe('Verbindung unterbrochen. Bitte versuche es erneut.');
  });

  it('setzt die Sicherungscheckbox nicht durch Copy oder Download', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const current = render();
    const component = current.componentInstance;
    await prepareFlow(component);
    await component.copyAll();
    component.download();
    expect(component.newCardSaved()).toBe(false);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(NEW_RECOVERY_CODE));
    expect(writeText.mock.calls[0]?.[0]).toContain('New-recovery_capability');
    expect(writeText.mock.calls[0]?.[0]).not.toMatch(/\*\*|`/);
    expect(getPendingHostCredentialActivation(SUPPORT_ID)?.recoveryCard.recoveryCode).toBe(
      NEW_RECOVERY_CODE,
    );
  });
});
