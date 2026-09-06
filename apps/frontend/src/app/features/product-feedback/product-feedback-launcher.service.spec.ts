import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import {
  ProductFeedbackLauncherService,
  resolveProductFeedbackRole,
  resolveProductFeedbackRouteGroup,
} from './product-feedback-launcher.service';

describe('ProductFeedbackLauncher route context', () => {
  it.each([
    ['/de/session/ABC123/vote', 'SESSION_VOTE', 'PARTICIPANT'],
    ['/en/session/ABC123/host', 'SESSION_HOST', 'HOST'],
    ['/quiz/new', 'QUIZ_EDITOR', 'HOST'],
    ['/help', 'HELP', 'GENERAL'],
    ['/feedback/ABC123/vote', 'QUICK_FEEDBACK', 'GENERAL'],
  ] as const)('mappt %s ohne Parameter auf %s / %s', (url, routeGroup, role) => {
    const resolved = resolveProductFeedbackRouteGroup(url);
    expect(resolved).toBe(routeGroup);
    expect(resolveProductFeedbackRole(resolved)).toBe(role);
  });

  it('leitet aus der Presenter-Route keine persönliche Rolle ab', () => {
    const routeGroup = resolveProductFeedbackRouteGroup('/session/ABC123/present');
    expect(routeGroup).toBe('OTHER');
    expect(resolveProductFeedbackRole(routeGroup)).toBe('GENERAL');
  });
});

describe('ProductFeedbackLauncher overlay', () => {
  it('öffnet den In-App-Dialog als Sheet mit Post-Session-Chrome', async () => {
    const open = vi.fn().mockReturnValue({ afterClosed: () => ({ subscribe: vi.fn() }) });
    TestBed.configureTestingModule({
      providers: [
        ProductFeedbackLauncherService,
        provideRouter([]),
        { provide: MatDialog, useValue: { open } },
      ],
    });

    await TestBed.inject(ProductFeedbackLauncherService).open();

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        hasBackdrop: true,
        panelClass: 'product-feedback-in-app-dialog-panel',
        backdropClass: 'product-feedback-in-app-dialog-backdrop',
        position: { bottom: '1.25rem', right: '1.25rem' },
      }),
    );
  });
});
