import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SwUpdate } from '@angular/service-worker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from './app.component';

const { footerBundleQueryMock, swVersionUpdatesSubscribeMock } = vi.hoisted(() => ({
  footerBundleQueryMock: vi.fn(),
  swVersionUpdatesSubscribeMock: vi.fn(),
}));

vi.mock('./core/trpc.client', () => ({
  trpc: {
    health: {
      footerBundle: {
        query: footerBundleQueryMock,
      },
    },
  },
}));

describe('AppComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    footerBundleQueryMock.mockResolvedValue({
      check: { status: 'ok' },
      stats: null,
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
});
