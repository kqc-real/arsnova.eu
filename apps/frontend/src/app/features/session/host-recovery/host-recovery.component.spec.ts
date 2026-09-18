import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHostBrowserCapability,
  getHostRecoveryCandidate,
  getHostRecoveryResume,
  getPendingHostCredentialActivation,
  markHostRecoveryActivationUnconfirmed,
  persistPreparedHostRecovery,
  storeHostBrowserCapability,
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
    vi.unstubAllGlobals();
    prepareMock.mockReset();
    activateMock.mockReset();
    issueMock.mockReset();
    setHostTokenMock.mockReset();
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
    vi.unstubAllGlobals();
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
    const imprintLink = host.querySelector('a[href*="/legal/imprint"]') as HTMLAnchorElement | null;
    expect(imprintLink?.textContent?.trim()).toBe('Kontaktdaten im Impressum');
    expect(imprintLink?.getAttribute('href') ?? '').not.toContain('host-recovery');
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
    const current = render();
    const component = current.componentInstance;
    await prepareFlow(component);
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0',
      clipboard: { writeText },
    });
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

  function persistPreparedState(options?: {
    pendingExpiresAt?: string;
    unconfirmed?: boolean;
    oldCapability?: string;
  }): void {
    if (options?.oldCapability) {
      storeHostBrowserCapability('ABC123', options.oldCapability);
    }
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: 'ABC123',
        browserCapability: NEW_BROWSER_CAPABILITY,
        recoveryCard: { supportId: SUPPORT_ID, recoveryCode: NEW_RECOVERY_CODE },
        pendingExpiresAt: options?.pendingExpiresAt ?? new Date(Date.now() + 60_000).toISOString(),
      },
    });
    if (options?.unconfirmed) {
      markHostRecoveryActivationUnconfirmed(SUPPORT_ID);
    }
  }

  function trpcError(code: string, message = `${code}: intern`): Error {
    return Object.assign(new Error(message), { data: { code } });
  }

  it.each([
    ['ohne Tabverlust', false],
    ['nach Tab- und TTL-Verlust', true],
  ])(
    'nimmt den neuen Kandidaten auf, wenn der Altzugang widerrufen ist (%s)',
    async (_label, lostTabAndTtl) => {
      persistPreparedState({
        oldCapability: 'old-browser-capability-abcdefghijklmnopqrstuvwxyz',
        unconfirmed: true,
        pendingExpiresAt: lostTabAndTtl
          ? new Date(Date.now() - 16 * 60_000).toISOString()
          : new Date(Date.now() + 60_000).toISOString(),
      });
      if (lostTabAndTtl) sessionStorage.clear();
      issueMock.mockImplementation(async ({ browserCapability }: { browserCapability: string }) => {
        if (browserCapability === NEW_BROWSER_CAPABILITY) {
          return {
            code: 'ABC123',
            hostToken: 'candidate-host-token-abcdefghijklmnopqrstuvwxyz',
            hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
            role: 'ORIGINAL_HOST',
          };
        }
        throw trpcError('UNAUTHORIZED');
      });

      const current = render();
      await current.componentInstance.resumeRecovery();
      current.detectChanges();

      expect(issueMock).toHaveBeenCalledWith({
        code: 'ABC123',
        browserCapability: NEW_BROWSER_CAPABILITY,
      });
      expect(current.componentInstance.view()).toBe('success');
      expect(getHostBrowserCapability('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
      expect(getHostRecoveryCandidate('ABC123')).toBeNull();
    },
  );

  it.each([
    ['ohne Tabverlust', false],
    ['nach Tab- und TTL-Verlust', true],
  ])(
    'bestätigt den Kandidaten nicht über einen noch gültigen Altzugang (%s)',
    async (_label, lostTabAndTtl) => {
      persistPreparedState({
        oldCapability: 'old-browser-capability-abcdefghijklmnopqrstuvwxyz',
        pendingExpiresAt: lostTabAndTtl
          ? new Date(Date.now() - 16 * 60_000).toISOString()
          : new Date(Date.now() + 60_000).toISOString(),
      });
      if (lostTabAndTtl) sessionStorage.clear();
      issueMock.mockImplementation(async ({ browserCapability }: { browserCapability: string }) => {
        if (browserCapability === 'old-browser-capability-abcdefghijklmnopqrstuvwxyz') {
          return {
            code: 'ABC123',
            hostToken: 'old-host-token-abcdefghijklmnopqrstuvwxyz',
            hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
            role: 'ORIGINAL_HOST',
          };
        }
        throw trpcError('UNAUTHORIZED');
      });

      const current = render();
      await current.componentInstance.resumeRecovery();
      current.detectChanges();

      expect(activateMock).not.toHaveBeenCalled();
      expect(getHostBrowserCapability('ABC123')).toBe(
        'old-browser-capability-abcdefghijklmnopqrstuvwxyz',
      );
      expect(getHostRecoveryResume(SUPPORT_ID)?.phase).not.toBe('activated');
      expect(current.componentInstance.view()).not.toBe('success');
      if (lostTabAndTtl) {
        expect(current.componentInstance.view()).toBe('pendingExpired');
      } else {
        expect(getHostRecoveryCandidate('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
        expect(current.componentInstance.view()).toBe('newCard');
      }
    },
  );

  it('behandelt einen Serverfehler beim Fortsetzen nicht als Ablauf und behält den Kandidaten', async () => {
    persistPreparedState({
      unconfirmed: true,
      pendingExpiresAt: new Date(Date.now() - 16 * 60_000).toISOString(),
    });
    sessionStorage.clear();
    issueMock
      .mockRejectedValueOnce(trpcError('INTERNAL_SERVER_ERROR', 'INTERNAL_SERVER_ERROR: redis'))
      .mockResolvedValueOnce({
        code: 'ABC123',
        hostToken: 'retried-host-token-abcdefghijklmnopqrstuvwxyz',
        hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
        role: 'ORIGINAL_HOST',
      });

    const current = render();
    const component = current.componentInstance;
    await component.resumeRecovery();
    current.detectChanges();

    expect(component.view()).toBe('activationUnconfirmed');
    expect(component.bannerError()).toBe(
      'Die Wiederherstellung ist vorübergehend nicht verfügbar. Versuche es später erneut.',
    );
    expect(current.nativeElement.textContent).toContain('vorübergehend nicht verfügbar');
    expect(current.nativeElement.textContent).toContain('Erneut versuchen');
    expect(getHostRecoveryCandidate('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
    expect(getHostRecoveryResume(SUPPORT_ID)?.phase).toBe('activation_unconfirmed');

    component.startOtherSession();
    current.detectChanges();
    expect(component.view()).toBe('credentials');
    expect(current.nativeElement.querySelector('form')).toBeTruthy();
    expect(getHostRecoveryCandidate('ABC123')).toBe(NEW_BROWSER_CAPABILITY);

    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);
    await component.continueRecovery();
    current.detectChanges();
    expect(component.view()).toBe('success');
    expect(getHostBrowserCapability('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
  });

  it('lässt nach erfolgreicher Wiederherstellung eine andere Session ohne Storage-Löschen zu', async () => {
    const current = render();
    const component = current.componentInstance;
    await prepareFlow(component);
    component.newCardSaved.set(true);
    await component.activateAccess();
    current.detectChanges();
    expect(component.view()).toBe('success');
    expect(getHostBrowserCapability('ABC123')).toBe(NEW_BROWSER_CAPABILITY);

    current.destroy();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostRecoveryComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const reopened = render();
    expect(reopened.componentInstance.view()).toBe('credentials');
    expect(
      reopened.nativeElement.querySelector('input[name="arsnova-host-support-id"]'),
    ).toBeTruthy();

    const otherSupportId = 'ARS-WXYZ-6789';
    prepareMock.mockResolvedValueOnce({
      code: 'DEF456',
      browserCapability: 'other-browser-capability-abcdefghijklmnopqrstuvwxyz',
      recoveryCard: { supportId: otherSupportId, recoveryCode: NEW_RECOVERY_CODE },
      pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    reopened.componentInstance.supportId.set(otherSupportId);
    reopened.componentInstance.secret.set(OLD_RECOVERY_CODE);
    await reopened.componentInstance.continueRecovery();
    expect(prepareMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ supportId: otherSupportId }),
    );
    expect(reopened.componentInstance.view()).toBe('newCard');
    expect(getHostBrowserCapability('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
  });

  it('zeigt Formatfehler nach Submit im DOM und fokussiert das erste fehlerhafte Feld', async () => {
    const current = render();
    const host = current.nativeElement as HTMLElement;
    const supportIdInput = host.querySelector(
      'input[name="arsnova-host-support-id"]',
    ) as HTMLInputElement;
    const secretInput = host.querySelector(
      'input[name="arsnova-host-recovery-secret"]',
    ) as HTMLInputElement;
    supportIdInput.value = 'UNGÜLTIG';
    supportIdInput.dispatchEvent(new Event('input'));
    secretInput.value = 'abc\\_not-valid-secret-value-here';
    secretInput.dispatchEvent(new Event('input'));
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await current.whenStable();
    current.detectChanges();

    const errors = [...host.querySelectorAll('mat-error')].map((node) => node.textContent ?? '');
    expect(prepareMock).not.toHaveBeenCalled();
    expect(errors.some((text) => text.includes('ARS-XXXX-XXXX'))).toBe(true);
    expect(errors.some((text) => text.includes('Bindestriche und Unterstriche'))).toBe(true);
    expect(supportIdInput.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(supportIdInput);

    supportIdInput.value = SUPPORT_ID;
    supportIdInput.dispatchEvent(new Event('input'));
    secretInput.value = OLD_RECOVERY_CODE;
    secretInput.dispatchEvent(new Event('input'));
    current.detectChanges();
    expect(host.querySelector('mat-error')).toBeNull();
    expect(supportIdInput.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('zeigt Netzwerkfehler beim Fortsetzen und behält den Wiederaufnahmestand', async () => {
    persistPreparedState();
    issueMock.mockImplementation(async () => {
      throw new Error('Failed to fetch');
    });
    const current = render();
    current.detectChanges();
    expect(current.componentInstance.view()).toBe('resume');
    await current.componentInstance.resumeRecovery();
    current.detectChanges();

    expect(current.componentInstance.view()).toBe('resume');
    expect(current.nativeElement.textContent).toContain('Verbindung unterbrochen');
    expect(current.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Verbindung unterbrochen',
    );
    expect(current.nativeElement.textContent).toContain('Erneut versuchen');
    expect(getHostRecoveryCandidate('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
  });

  it('zeigt Netzwerk- und Serverfehler auch bei unbestätigter Aktivierung', async () => {
    persistPreparedState({ unconfirmed: true });
    issueMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    const current = render();
    const component = current.componentInstance;
    expect(component.view()).toBe('activationUnconfirmed');
    await component.resumeRecovery();
    current.detectChanges();
    expect(component.view()).toBe('activationUnconfirmed');
    expect(current.nativeElement.textContent).toContain('Verbindung unterbrochen');
    expect(current.nativeElement.textContent).toContain('Erneut versuchen');

    issueMock.mockRejectedValueOnce(trpcError('INTERNAL_SERVER_ERROR'));
    await component.resumeRecovery();
    current.detectChanges();
    expect(component.view()).toBe('activationUnconfirmed');
    expect(current.nativeElement.textContent).toContain('vorübergehend nicht verfügbar');
    expect(getHostRecoveryCandidate('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
  });

  it('löst Speicherfehler beim Phasenwechsel und sendet keine Aktivierung', async () => {
    const current = render();
    const component = current.componentInstance;
    await prepareFlow(component);
    component.newCardSaved.set(true);
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (typeof value === 'string' && value.includes('activation_unconfirmed')) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    });

    try {
      await component.activateAccess();
      current.detectChanges();

      expect(activateMock).not.toHaveBeenCalled();
      expect(component.busy()).toBe(false);
      expect(component.view()).toBe('newCard');
      expect(component.bannerError()).toContain('Zugang nicht speichern');
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('gibt nach nie ausgeführtem Activate und Ablauf einen Neubeginn mit dem alten Code frei', async () => {
    persistPreparedState({
      oldCapability: 'old-browser-capability-abcdefghijklmnopqrstuvwxyz',
      unconfirmed: true,
      pendingExpiresAt: new Date(Date.now() - 16 * 60_000).toISOString(),
    });
    sessionStorage.clear();
    issueMock.mockRejectedValue(trpcError('UNAUTHORIZED'));
    activateMock.mockRejectedValue(trpcError('UNAUTHORIZED'));

    const current = render();
    const component = current.componentInstance;
    await component.resumeRecovery();
    current.detectChanges();

    expect(component.view()).toBe('pendingExpired');
    expect(getHostRecoveryCandidate('ABC123')).toBeNull();
    expect(getHostRecoveryResume(SUPPORT_ID)).toBeNull();
    expect(getHostBrowserCapability('ABC123')).toBe(
      'old-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );

    component.startOtherSession();
    current.detectChanges();
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);
    await component.continueRecovery();
    current.detectChanges();

    expect(prepareMock).toHaveBeenCalledTimes(1);
    expect(component.view()).toBe('newCard');
    expect(getHostBrowserCapability('ABC123')).toBe(
      'old-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
  });

  it('bereitet nach abgelaufenem unbestätigtem Resume in demselben Submit neu vor', async () => {
    persistPreparedState({
      unconfirmed: true,
      pendingExpiresAt: new Date(Date.now() - 16 * 60_000).toISOString(),
    });
    sessionStorage.clear();
    issueMock.mockRejectedValue(trpcError('UNAUTHORIZED'));
    activateMock.mockRejectedValue(trpcError('UNAUTHORIZED'));

    const component = render().componentInstance;
    component.supportId.set(SUPPORT_ID);
    component.secret.set(OLD_RECOVERY_CODE);
    await component.continueRecovery();

    expect(prepareMock).toHaveBeenCalledTimes(1);
    expect(component.view()).toBe('newCard');
  });

  it('nimmt eine nach Commit verlorene Aktivierung auch nach Fristablauf wieder auf', async () => {
    persistPreparedState({
      unconfirmed: true,
      pendingExpiresAt: new Date(Date.now() - 16 * 60_000).toISOString(),
    });
    sessionStorage.clear();
    issueMock.mockResolvedValue({
      code: 'ABC123',
      hostToken: 'committed-host-token-abcdefghijklmnopqrstuvwxyz',
      hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
      role: 'ORIGINAL_HOST',
    });

    const current = render();
    await current.componentInstance.resumeRecovery();
    current.detectChanges();

    expect(activateMock).not.toHaveBeenCalled();
    expect(current.componentInstance.view()).toBe('success');
    expect(getHostBrowserCapability('ABC123')).toBe(NEW_BROWSER_CAPABILITY);
  });

  it('überschreibt den Wechsel zu einer anderen Session nicht durch eine verspätete Antwort', async () => {
    persistPreparedState();
    const deferred = Promise.withResolvers<{
      code: string;
      hostToken: string;
      hostTokenExpiresAt: string;
      role: string;
    }>();
    issueMock.mockImplementation(() => deferred.promise);

    const current = render();
    const component = current.componentInstance;
    const resumePromise = component.resumeRecovery();
    current.detectChanges();
    expect(
      (
        current.nativeElement.querySelector(
          '[data-testid="host-recovery-other-session"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    component.startOtherSession();
    current.detectChanges();
    component.supportId.set('ARS-WXYZ-6789');
    component.supportIdControl.setValue('ARS-WXYZ-6789');
    expect(component.view()).toBe('credentials');

    deferred.resolve({
      code: 'ABC123',
      hostToken: 'late-host-token-abcdefghijklmnopqrstuvwxyz',
      hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
      role: 'ORIGINAL_HOST',
    });
    await resumePromise;
    current.detectChanges();

    expect(component.view()).toBe('credentials');
    expect(component.supportId()).toBe('ARS-WXYZ-6789');
    expect(component.sessionCode()).toBeNull();
    expect(component.busy()).toBe(false);
  });
});
