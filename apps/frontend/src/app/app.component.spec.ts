import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SwUpdate } from '@angular/service-worker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';
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

function configureAppTestBed(): void {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter([]),
      { provide: MatDialog, useValue: { open: vi.fn() } },
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

    expect(main.getAttribute('tabindex')).toBe('-1');
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

  it('rendert den Update-Banner als auffaelliges Callout mit primaerer CTA', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
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
        { provide: MatDialog, useValue: { open: vi.fn() } },
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
        { provide: MatDialog, useValue: { open: vi.fn() } },
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
        { provide: MatDialog, useValue: { open: vi.fn() } },
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
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-server-status-widget'),
    ).toBeNull();

    fixture.destroy();
    window.history.pushState({}, '', '/');
  });

  it('blendet Footer-Links zu Help, News-Archiv und Legal aus, wenn die App offline ist', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
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

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('News-Archiv');
    expect(text).not.toContain('So funktioniert’s');
    expect(text).not.toContain('Impressum');
    expect(text).not.toContain('Datenschutz');

    fixture.destroy();
  });

  it('füllt leere Tageshistorien lokal im Dev-Modus für die visuelle Prüfung mit Demo-Werten', async () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: vi.fn() } },
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
        { provide: MatDialog, useValue: { open: vi.fn() } },
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
