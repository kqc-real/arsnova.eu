import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SwUpdate } from '@angular/service-worker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
import { ThemePresetService } from './core/theme-preset.service';
import { markContentPageFocusReturn } from './shared/content-page-nav';
import { TopToolbarComponent } from './shared/top-toolbar/top-toolbar.component';

const { footerBundleQueryMock, healthStatsQueryMock, swVersionUpdatesSubscribeMock } = vi.hoisted(
  () => ({
    footerBundleQueryMock: vi.fn(),
    healthStatsQueryMock: vi.fn(),
    swVersionUpdatesSubscribeMock: vi.fn(),
  }),
);

vi.mock('./core/trpc.client', () => ({
  trpc: {
    health: {
      footerBundle: {
        query: footerBundleQueryMock,
      },
      stats: {
        query: healthStatsQueryMock,
      },
    },
  },
}));

function createDialogMock(): MatDialog {
  return {
    open: vi.fn().mockReturnValue({
      afterClosed: () => ({ subscribe: vi.fn() }),
    }),
  } as unknown as MatDialog;
}

/** MatDialog-Mock mit steuerbarem afterClosed für Fokus-Rückgabe-Tests. */
function createCloseableDialogMock(): {
  dialog: MatDialog;
  close: () => void;
} {
  let closedHandler: (() => void) | undefined;
  const dialog = {
    open: vi.fn().mockReturnValue({
      afterClosed: () => ({
        subscribe: (cb: () => void) => {
          closedHandler = cb;
          return { unsubscribe: vi.fn() };
        },
      }),
    }),
  } as unknown as MatDialog;
  return {
    dialog,
    close: () => closedHandler?.(),
  };
}

function configureAppTestBed(): void {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter([]),
      provideNoopAnimations(),
      { provide: MatDialog, useValue: createDialogMock() },
      {
        provide: SwUpdate,
        useValue: {
          isEnabled: false,
          versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
          checkForUpdate: vi.fn().mockResolvedValue(false),
          activateUpdate: vi.fn().mockResolvedValue(undefined),
        },
      },
    ],
  });
}

describe('AppComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    footerBundleQueryMock.mockResolvedValue({
      check: { status: 'ok' },
      stats: { serviceStatus: 'stable', loadStatus: 'healthy' },
    });
    healthStatsQueryMock.mockResolvedValue({
      openSessions: 1,
      activeSessions: 1,
      totalParticipants: 5,
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
      completedSessions: 2,
      activeBlitzRounds: 0,
      maxParticipantsSingleSession: 5,
      dailyHighscores: Array.from({ length: 100 }, (_, index) => ({
        date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
        count: 0,
        updatedAt: null,
      })),
      dailyHighscoresStatistics: {
        median: 0,
        standardDeviation: 0,
        max: 0,
      },
      maxParticipantsStatisticUpdatedAt: null,
      serviceStatus: 'stable',
      loadStatus: 'healthy',
    });
    vi.stubGlobal('requestIdleCallback', vi.fn());
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it('macht das Main-Landmark zum verlässlichen Skip-Link-Ziel', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const main = fixture.nativeElement.querySelector('#main-content') as HTMLElement;

    expect(main.getAttribute('tabindex')).toBe('0');
    fixture.destroy();
  });

  it('verschiebt den Fokus beim Aktivieren des Skip-Links auf den Hauptinhalt', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const skipLink = fixture.nativeElement.querySelector('.app-skip-link') as HTMLAnchorElement;
    const main = fixture.nativeElement.querySelector('#main-content') as HTMLElement;

    skipLink.click();

    expect(document.activeElement).toBe(main);
    fixture.destroy();
  });

  it('blendet den Skip-Link nur für sichtbaren Tastaturfokus ein', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const componentDir = dirname(fileURLToPath(import.meta.url));
    const styles = readFileSync(join(componentDir, 'app.component.scss'), 'utf8');

    expect(styles).toContain('.app-skip-link:focus-visible');
    expect(styles).not.toMatch(/\.app-skip-link:focus(?:\s|,|\{)/);
  });

  it('führt den Fokus beim Öffnen der mobilen Einstellungen in das Panel', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const toolbar = fixture.debugElement.query(By.directive(TopToolbarComponent))
      .componentInstance as TopToolbarComponent;
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toolbar.controlsMenuOpen()).toBe(true);
    expect(
      (document.activeElement as HTMLElement | null)?.closest('#top-toolbar-mobile'),
    ).not.toBeNull();
    fixture.destroy();
  });

  it('schließt die mobilen Einstellungen mit Escape und fokussiert den Auslöser', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const toolbar = fixture.debugElement.query(By.directive(TopToolbarComponent))
      .componentInstance as TopToolbarComponent;
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;
    const triggerFocusSpy = vi.spyOn(trigger, 'focus');
    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toolbar.controlsMenuOpen()).toBe(false);
    expect(triggerFocusSpy).toHaveBeenCalledWith({ preventScroll: true });
    fixture.destroy();
  });

  it('lässt die mobilen Einstellungen offen, wenn Escape nur ein Untermenü schließt', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const toolbar = fixture.debugElement.query(By.directive(TopToolbarComponent))
      .componentInstance as TopToolbarComponent;
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlay = document.createElement('div');
    overlay.className = 'cdk-overlay-pane';
    const menuItem = document.createElement('button');
    overlay.append(menuItem);
    document.body.append(overlay);
    menuItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(toolbar.controlsMenuOpen()).toBe(true);
    overlay.remove();
    fixture.destroy();
  });

  it('fokussiert nach einer Folge-Navigation die neue Hauptüberschrift', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('.app-main__content') as HTMLElement;
    const heading = document.createElement('h1');
    heading.textContent = 'Neue Seite';
    content.append(heading);

    (
      fixture.componentInstance as AppComponent & {
        focusPrimaryContent: () => void;
      }
    ).focusPrimaryContent();

    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');

    heading.blur();
    expect(heading.hasAttribute('tabindex')).toBe(false);
    fixture.destroy();
  });

  it('stellt Footer-Fokus nach Content-Page-Dismiss wieder her und entfernt inert', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('footer.app-footer') as HTMLElement;
    const helpLink = footer.querySelector(
      'a[data-footer-focus="footer-help"]',
    ) as HTMLAnchorElement;
    expect(helpLink).toBeTruthy();
    footer.setAttribute('inert', '');
    (footer as HTMLElement & { inert: boolean }).inert = true;

    markContentPageFocusReturn('footer-help');
    component.isContentOverlayRoute.set(false);

    const restored = (
      component as AppComponent & { restoreContentPageFocusReturn: () => boolean }
    ).restoreContentPageFocusReturn();

    expect(restored).toBe(true);
    expect(footer.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(helpLink);

    fixture.destroy();
  });

  it('setzt Toolbar, Footer und Skip-Link auf Content-Overlay-Routen inert', () => {
    window.history.pushState({}, '', '/help');
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    (component as AppComponent & { updateRouteFlags: () => void }).updateRouteFlags();
    fixture.detectChanges();

    expect(component.isContentOverlayRoute()).toBe(true);

    const root = fixture.nativeElement as HTMLElement;
    const footer = root.querySelector('footer.app-footer') as HTMLElement & { inert?: boolean };
    const toolbar = root.querySelector('app-top-toolbar') as HTMLElement & { inert?: boolean };
    const skip = root.querySelector('a.app-skip-link') as HTMLElement & { inert?: boolean };
    const helpLink = root.querySelector('a[data-footer-focus="footer-help"]') as HTMLAnchorElement;

    // attr.inert '' wird je nach Host als Attribut und/oder Property gesetzt
    expect(footer.hasAttribute('inert') || footer.inert === true).toBe(true);
    expect(toolbar.hasAttribute('inert') || toolbar.inert === true).toBe(true);
    expect(skip.hasAttribute('inert') || skip.inert === true).toBe(true);
    // Inerter Footer: Hilfe-Link ist für Pointer/Tastatur außerhalb des Modal-Dialogs nicht bedienbar.
    expect(helpLink.closest('[inert]')).toBeTruthy();

    window.history.pushState({}, '', '/');
    fixture.destroy();
  });

  it('entfernt Bootstrap-Fokus aus dem Footer, damit der Skip-Link erster Tab-Stop bleibt', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('footer.app-footer') as HTMLElement;
    const firstFooterLink = footer.querySelector('a[href]') as HTMLAnchorElement;
    firstFooterLink.focus();
    expect(document.activeElement).toBe(firstFooterLink);

    (component as AppComponent & { blurFooterIfFocused: () => void }).blurFooterIfFocused();

    expect(document.activeElement === firstFooterLink).toBe(false);

    fixture.destroy();
  });

  it('blendet eine versteckte Toolbar ein, sobald ein enthaltenes Element Fokus erhält', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    fixture.componentInstance.toolbarHidden.set(true);
    fixture.detectChanges();
    const brand = fixture.nativeElement.querySelector(
      'app-top-toolbar .top-toolbar__brand',
    ) as HTMLAnchorElement;

    brand.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(fixture.componentInstance.toolbarHidden()).toBe(false);
    fixture.destroy();
  });

  it('beschreibt die Vorteile der beiden Gestaltungen in der Preset-Snackbar', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    const themePreset = TestBed.inject(ThemePresetService);

    themePreset.setPreset('spielerisch', { silent: true });
    expect(fixture.componentInstance.presetSnackbarLabel()).toBe(
      'Spielerisch gewählt – lebendig, motivierend und mit mehr Tempo.',
    );

    themePreset.setPreset('serious', { silent: true });
    expect(fixture.componentInstance.presetSnackbarLabel()).toBe(
      'Seriös gewählt – ruhig, klar und auf Inhalte fokussiert.',
    );

    fixture.destroy();
  });

  it('unterdrueckt den eigenen Installationshinweis in Samsung Internet', async () => {
    localStorage.removeItem('pwa-install-dismissed');
    const userAgentSpy = vi
      .spyOn(window.navigator, 'userAgent', 'get')
      .mockReturnValue(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36',
      );
    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);

    try {
      fixture.detectChanges();
      window.dispatchEvent(installEvent);
      fixture.detectChanges();

      expect(installEvent.defaultPrevented).toBe(true);
      expect(fixture.nativeElement.querySelector('.app-install-snackbar')).toBeNull();

      await fixture.componentInstance.triggerInstall();
      expect(prompt).not.toHaveBeenCalled();
    } finally {
      fixture.destroy();
      userAgentSpy.mockRestore();
    }
  });

  it('zeigt den eigenen Installationshinweis weiterhin in unterstuetztem Chromium', () => {
    localStorage.removeItem('pwa-install-dismissed');
    const userAgentSpy = vi
      .spyOn(window.navigator, 'userAgent', 'get')
      .mockReturnValue(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
      );
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);

    try {
      fixture.detectChanges();
      window.dispatchEvent(installEvent);
      fixture.detectChanges();

      expect(installEvent.defaultPrevented).toBe(true);
      expect(fixture.nativeElement.querySelector('.app-install-snackbar')).toBeTruthy();
    } finally {
      fixture.destroy();
      userAgentSpy.mockRestore();
    }
  });

  it('rendert den Update-Banner als auffaelliges Callout mit primaerer CTA', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: createDialogMock() },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    component.updateAvailable.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.app-update-banner') as HTMLElement | null;
    const action = fixture.nativeElement.querySelector(
      '.app-update-banner__action',
    ) as HTMLButtonElement | null;

    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('Neue Version bereit');
    expect(banner?.textContent).toContain('Aktualisieren für den neuesten Stand.');
    expect(action?.textContent).toContain('Jetzt aktualisieren');
    expect(fixture.nativeElement.querySelector('.app-update-banner__inner')).toBeTruthy();

    fixture.destroy();
  });

  it('laedt PWA-Updates per Seitenreload statt per activateUpdate', () => {
    const activateUpdateMock = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: createDialogMock() },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: activateUpdateMock,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const reloadPageSpy = vi
      .spyOn(component as unknown as { reloadPage: () => void }, 'reloadPage')
      .mockImplementation(() => undefined);

    component.reloadWithUpdate();
    component.reloadWithUpdate();

    expect(component.updateReloading()).toBe(true);
    expect(reloadPageSpy).toHaveBeenCalledTimes(1);
    expect(activateUpdateMock).not.toHaveBeenCalled();

    fixture.destroy();
  });

  it('stellt im Dev-Modus einen globalen Trigger fuer den Update-Banner bereit', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: createDialogMock() },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const win = window as Window & { __triggerUpdateBanner?: () => void };
    expect(typeof win.__triggerUpdateBanner).toBe('function');

    win.__triggerUpdateBanner?.();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.app-update-banner') as HTMLElement | null;
    expect(banner?.textContent).toContain('Neue Version bereit');

    fixture.destroy();
  });

  it('unterdrueckt Footer-Status-Polling auf Join- und Session-Live-Routen', async () => {
    window.history.pushState({}, '', '/de/join/ABC123');
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: createDialogMock() },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(footerBundleQueryMock).not.toHaveBeenCalled();
    const moreButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-footer-focus="footer-more"]',
    ) as HTMLButtonElement;
    moreButton.click();
    fixture.detectChanges();
    const menuText = document.body.textContent ?? '';
    expect(menuText).not.toContain('Betriebsstatus');

    fixture.destroy();
    window.history.pushState({}, '', '/');
  });

  it('haelt Hilfe und Mehr offline sichtbar und deaktiviert den externen Info-Link', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: createDialogMock() },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.onOffline();
    fixture.detectChanges();

    const footer = (fixture.nativeElement as HTMLElement).querySelector(
      'footer.app-footer',
    ) as HTMLElement;
    const text = footer.textContent ?? '';
    const offlineInfo = footer.querySelector(
      'button.app-footer__link--offline',
    ) as HTMLButtonElement | null;

    expect(text).toContain('So funktioniert’s');
    expect(text).toContain('Mehr');
    expect(text).toContain('Was arsnova.eu kann');
    expect(text).not.toContain('News-Archiv');
    expect(footer.querySelector('a.app-footer__link--external')).toBeNull();
    expect(offlineInfo?.disabled).toBe(true);
    expect(offlineInfo?.getAttribute('aria-label')).toContain('offline');

    fixture.destroy();
  });

  it('verlinkt Was arsnova.eu kann locale-sicher mit neuem Tab und Aria-Hinweis', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a.app-footer__link--external',
    ) as HTMLAnchorElement | null;

    expect(link?.textContent ?? '').toContain('Was arsnova.eu kann');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
    expect(link?.href).toContain('?theme=');
    expect(link?.href).toContain('#features');
    expect(link?.getAttribute('aria-label') ?? '').toContain('öffnet in neuem Tab');
    expect(link?.querySelector('.app-footer__primary-stack')).toBeTruthy();

    fixture.destroy();
  });

  it('aktualisiert den Info-Landing-Footer-Link reaktiv bei Theme-Wechsel', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setTheme('light');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = () =>
      (fixture.nativeElement as HTMLElement).querySelector(
        'a.app-footer__link--external',
      ) as HTMLAnchorElement | null;

    expect(link()?.getAttribute('href')).toBe('https://info.arsnova.eu/de/?theme=light#features');

    themePreset.setTheme('dark');
    fixture.detectChanges();
    expect(link()?.getAttribute('href')).toBe('https://info.arsnova.eu/de/?theme=dark#features');

    themePreset.setPreset('serious', { silent: true });
    fixture.detectChanges();
    expect(link()?.getAttribute('href')).toBe('https://info.arsnova.eu/de/?theme=dark#features');

    fixture.destroy();
  });

  it('zeigt genau drei primaere Footer-Eintraege in verbindlicher Reihenfolge', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const footer = (fixture.nativeElement as HTMLElement).querySelector(
      'footer.app-footer',
    ) as HTMLElement;
    const primaries = Array.from(footer.querySelectorAll('.app-footer__primary')) as HTMLElement[];
    const labels = primaries.map(
      (el) => el.querySelector('.app-footer__link-text')?.textContent?.trim() ?? '',
    );

    expect(primaries).toHaveLength(3);
    expect(labels).toEqual(['Was arsnova.eu kann', 'So funktioniert’s', 'Mehr']);
    expect(footer.querySelector('.app-footer__link--news-archive')).toBeNull();
    expect(footer.querySelector('app-server-status-widget')).toBeNull();
    expect(footer.querySelector('a[href*="/legal/imprint"]')).toBeNull();

    fixture.destroy();
  });

  it('oeffnet unter Mehr direkt Impressum, Datenschutz, Barrierefreiheit und Betriebsstatus', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const moreButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-footer-focus="footer-more"]',
    ) as HTMLButtonElement;
    moreButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menu = document.querySelector('.app-footer__more-menu, .mat-mdc-menu-panel');
    const items = Array.from(
      document.querySelectorAll('.mat-mdc-menu-panel .mat-mdc-menu-item'),
    ) as HTMLElement[];
    const itemLabels = items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');

    expect(menu).toBeTruthy();
    expect(itemLabels).toEqual([
      expect.stringContaining('Impressum'),
      expect.stringContaining('Datenschutz'),
      expect.stringContaining('Barrierefreiheit'),
      expect.stringContaining('Betriebsstatus'),
    ]);
    expect(items).toHaveLength(4);
    expect((items[0] as HTMLAnchorElement).getAttribute('href')).toContain('/legal/imprint');
    expect((items[1] as HTMLAnchorElement).getAttribute('href')).toContain('/legal/privacy');
    expect((items[2] as HTMLAnchorElement).getAttribute('href')).toContain('/legal/accessibility');

    fixture.destroy();
  });

  it('stellt Footer-Fokus nach Legal-Dismiss auf Mehr wieder her', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('footer.app-footer') as HTMLElement;
    const moreButton = footer.querySelector(
      'button[data-footer-focus="footer-more"]',
    ) as HTMLButtonElement;
    expect(moreButton).toBeTruthy();
    footer.setAttribute('inert', '');
    (footer as HTMLElement & { inert: boolean }).inert = true;

    markContentPageFocusReturn('footer-more');
    component.isContentOverlayRoute.set(false);

    const restored = (
      component as AppComponent & { restoreContentPageFocusReturn: () => boolean }
    ).restoreContentPageFocusReturn();

    expect(restored).toBe(true);
    expect(footer.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(moreButton);

    fixture.destroy();
  });

  it('zeigt Offline den API-Retry sichtbar im Footer', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.footerHealthCheckDone.set(true);
    fixture.componentInstance.apiStatus.set(null);
    fixture.detectChanges();

    const retry = (fixture.nativeElement as HTMLElement).querySelector(
      '.app-footer__status-action',
    ) as HTMLButtonElement | null;
    expect(retry).toBeTruthy();
    expect(retry?.textContent ?? '').toContain('Nochmal versuchen');

    fixture.destroy();
  });

  it('markiert die drei primaeren Footer-Labels sichtbar', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.app-footer__primary .app-footer__link-text',
      ),
    ) as HTMLElement[];

    expect(labels).toHaveLength(3);
    expect(labels.map((label) => label.textContent?.trim())).toEqual([
      'Was arsnova.eu kann',
      'So funktioniert’s',
      'Mehr',
    ]);
    for (const label of labels) {
      const style = getComputedStyle(label);
      expect(style.clipPath === 'none' || style.clipPath === '').toBe(true);
      // Kompakt: kein nowrap/Einzeilen-Clip (#196). jsdom liefert oft leere Computed Styles.
      expect(style.whiteSpace === 'nowrap').toBe(false);
      expect(style.overflow === 'hidden').toBe(false);
      if (label.clientWidth > 0) {
        expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
      }
    }

    fixture.destroy();
  });

  // Tastatur Enter/Space/Escape für Mehr-Menü: verbindlicher Nachweis in
  // apps/frontend/scripts/check-viewport-320.mjs (Playwright, ohne Reparatur-Fallbacks).

  it('stiehlt nach dem Escape-Grace-Callback keinen bereits neu gesetzten Fokus', () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const footer = (fixture.nativeElement as HTMLElement).querySelector('footer.app-footer')!;
    const moreButton = footer.querySelector(
      'button[data-footer-focus="footer-more"]',
    ) as HTMLButtonElement;
    const otherLink = footer.querySelector('a[href]') as HTMLAnchorElement;
    otherLink.focus();

    (
      component as unknown as {
        ensureFooterMoreFocusAfterEscape: () => void;
      }
    ).ensureFooterMoreFocusAfterEscape();

    expect(document.activeElement).toBe(otherLink);
    expect(document.activeElement).not.toBe(moreButton);
    fixture.destroy();
  });

  it('setzt Fokus nach Schliessen des Betriebsstatus-Dialogs auf Mehr', async () => {
    const { dialog, close } = createCloseableDialogMock();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: MatDialog, useValue: dialog },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const moreButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-footer-focus="footer-more"]',
    ) as HTMLButtonElement;
    moreButton.focus();

    await component.openServerStatusHelp();
    expect(dialog.open).toHaveBeenCalled();

    close();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(moreButton);
    fixture.destroy();
  });

  it('fokussiert nach Status-Dialog nicht ein detached Mehr-Target', async () => {
    const { dialog, close } = createCloseableDialogMock();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: MatDialog, useValue: dialog },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const content = fixture.nativeElement.querySelector('.app-main__content') as HTMLElement;
    const fallbackHeading = document.createElement('h1');
    fallbackHeading.textContent = 'Ersatzziel nach Dialog';
    content.append(fallbackHeading);

    await component.openServerStatusHelp();
    const moreButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-footer-focus="footer-more"]',
    ) as HTMLButtonElement;
    moreButton.remove();

    close();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(fallbackHeading);
    expect(fallbackHeading.getAttribute('tabindex')).toBe('-1');

    fallbackHeading.blur();
    expect(fallbackHeading.hasAttribute('tabindex')).toBe(false);
    fixture.destroy();
  });

  it('nutzt more_vert als Footer-Mehr-Icon (etablierter Menu-Trigger)', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const moreIcon = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-footer-focus="footer-more"] .app-footer__icon',
    );
    expect(moreIcon?.textContent?.trim()).toBe('more_vert');

    fixture.destroy();
  });

  it('zeigt im Mehr-Menü den Live-Betriebsstatus-Dot anhand von footerStatus', async () => {
    configureAppTestBed();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.footerHealthCheckDone.set(true);
    component.apiStatus.set('ok');
    component.footerStatus.set({ serviceStatus: 'stable', loadStatus: 'healthy' });
    fixture.detectChanges();
    expect(component.footerStatusColor()).toBe('green');

    const moreButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[data-footer-focus="footer-more"]',
    ) as HTMLButtonElement;
    moreButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const statusIcon = document.querySelector(
      '.mat-mdc-menu-panel .app-footer__status-dot',
    ) as HTMLElement | null;
    expect(statusIcon).toBeTruthy();
    expect(statusIcon?.classList.contains('app-footer__status-dot--healthy')).toBe(true);
    expect(statusIcon?.style.color).toBe('var(--app-status-healthy)');
    expect(component.footerStatusDotCssColor()).toBe('var(--app-status-healthy)');
    expect(statusIcon?.textContent?.trim()).toBe('lens');

    component.footerStatus.set({ serviceStatus: 'limited', loadStatus: 'busy' });
    fixture.detectChanges();
    expect(component.footerStatusColor()).toBe('yellow');
    expect(component.footerStatusDotCssColor()).toBe('var(--app-status-busy)');
    expect(
      document
        .querySelector('.mat-mdc-menu-panel .app-footer__status-dot')
        ?.classList.contains('app-footer__status-dot--busy'),
    ).toBe(true);
    expect(
      (document.querySelector('.mat-mdc-menu-panel .app-footer__status-dot') as HTMLElement | null)
        ?.style.color,
    ).toBe('var(--app-status-busy)');

    component.footerStatus.set({ serviceStatus: 'critical', loadStatus: 'overloaded' });
    fixture.detectChanges();
    expect(component.footerStatusColor()).toBe('red');
    expect(
      document
        .querySelector('.mat-mdc-menu-panel .app-footer__status-dot')
        ?.classList.contains('app-footer__status-dot--overloaded'),
    ).toBe(true);

    component.apiStatus.set(null);
    fixture.detectChanges();
    expect(component.footerStatusColor()).toBe('gray');
    expect(
      document
        .querySelector('.mat-mdc-menu-panel .app-footer__status-dot')
        ?.classList.contains('app-footer__status-dot--unknown'),
    ).toBe(true);

    fixture.destroy();
  });

  it('füllt leere Tageshistorien lokal im Dev-Modus für die visuelle Prüfung mit Demo-Werten', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: createDialogMock() },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      loadFooterStats: (options?: { forceFresh?: boolean }) => Promise<void>;
    };

    await component.loadFooterStats({ forceFresh: true });

    const stats = component.footerStats();
    expect(stats).not.toBeNull();
    expect(stats?.dailyHighscores).toHaveLength(100);
    expect(stats?.dailyHighscores.some((entry) => entry.count > 0)).toBe(true);
    expect(stats?.dailyHighscoresStatistics.max).toBeGreaterThan(0);
    expect(stats?.dailyHighscoresStatistics.median).toBeGreaterThan(0);
    expect(stats?.dailyHighscoresStatistics.standardDeviation).toBeGreaterThan(0);

    fixture.destroy();
  });

  it('behält vorhandene Statistikwerte bei, wenn lokal nur die Kurve für die Sichtprüfung aufgefüllt wird', async () => {
    healthStatsQueryMock.mockResolvedValueOnce({
      openSessions: 1,
      activeSessions: 1,
      totalParticipants: 5,
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
      completedSessions: 2,
      activeBlitzRounds: 0,
      maxParticipantsSingleSession: 600,
      dailyHighscores: Array.from({ length: 100 }, (_, index) => ({
        date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
        count: index === 99 ? 600 : 0,
        updatedAt: index === 99 ? '2026-04-16T12:00:00.000Z' : null,
      })),
      dailyHighscoresStatistics: {
        median: 15,
        standardDeviation: 70,
        max: 600,
      },
      maxParticipantsStatisticUpdatedAt: '2026-04-16T12:00:00.000Z',
      serviceStatus: 'stable',
      loadStatus: 'healthy',
    });

    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: createDialogMock() },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: false,
            versionUpdates: { subscribe: swVersionUpdatesSubscribeMock },
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      loadFooterStats: (options?: { forceFresh?: boolean }) => Promise<void>;
    };

    await component.loadFooterStats({ forceFresh: true });

    const stats = component.footerStats();
    expect(stats).not.toBeNull();
    expect(stats?.dailyHighscores.some((entry) => entry.count > 0)).toBe(true);
    expect(stats?.dailyHighscoresStatistics).toEqual({
      median: 15,
      standardDeviation: 70,
      max: 600,
    });

    fixture.destroy();
  });
});
