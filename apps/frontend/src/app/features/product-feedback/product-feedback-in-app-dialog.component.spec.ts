import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductFeedbackInAppDialogComponent } from './product-feedback-in-app-dialog.component';
import { ProductFeedbackLauncherService } from './product-feedback-launcher.service';

const { followUpMock } = vi.hoisted(() => ({
  followUpMock: vi.fn(),
}));

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    productFeedback: {
      followUpInApp: { mutate: followUpMock },
    },
  },
}));

describe('ProductFeedbackInAppDialogComponent', () => {
  const submitDraft = vi.fn();
  const close = vi.fn();
  const launchData = {
    role: 'PARTICIPANT' as const,
    routeGroup: 'SESSION_VOTE' as const,
    sessionPhase: 'ACTIVE' as const,
    activeChannel: 'QUIZ' as const,
    sessionRunning: true,
    suggestedArea: 'TECH_OR_CONNECTION' as const,
    errorRequestId: 'vote.submit:timeout',
  };

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    submitDraft.mockResolvedValue({
      ok: true,
      followUpCapability: 'f'.repeat(43),
      followUpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await TestBed.configureTestingModule({
      imports: [ProductFeedbackInAppDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: launchData },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: ProductFeedbackLauncherService,
          useValue: {
            buildContext: () => ({
              locale: 'de',
              appVersion: '0.1.0',
              routeGroup: 'SESSION_VOTE',
              sessionPhase: 'ACTIVE',
              activeChannel: 'QUIZ',
              deviceClass: 'PHONE',
              browserFamily: 'SAFARI',
              osFamily: 'IOS',
              onlineState: 'ONLINE',
              errorRequestId: 'vote.submit:timeout',
            }),
            submitDraft,
          },
        },
      ],
    }).compileComponents();
  });

  it('sortiert den Kontextvorschlag nach vorn, wählt ihn aber nicht voraus', () => {
    const fixture = TestBed.createComponent(ProductFeedbackInAppDialogComponent);
    const component = fixture.componentInstance;
    expect(component.areas()[0]).toBe('TECH_OR_CONNECTION');
    expect(component.kind()).toBeNull();
    expect(component.area()).toBeNull();
  });

  it('speichert nach genau zwei Auswahlen strukturiert und bleibt im Dialog', async () => {
    const fixture = TestBed.createComponent(ProductFeedbackInAppDialogComponent);
    const component = fixture.componentInstance;
    component.selectKind('NOT_WORKING');
    await component.selectArea('QUIZ_OR_ANSWER');

    expect(submitDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'PARTICIPANT',
        kind: 'NOT_WORKING',
        area: 'QUIZ_OR_ANSWER',
      }),
    );
    expect(component.step()).toBe('saved');
    expect(close).not.toHaveBeenCalled();
  });

  it('begrenzt optionalen Text und erlaubt Auswirkung ohne Schreibpflicht', async () => {
    followUpMock.mockResolvedValue({ ok: true });
    const fixture = TestBed.createComponent(ProductFeedbackInAppDialogComponent);
    const component = fixture.componentInstance;
    component.followUpCapability.set('f'.repeat(43));
    component.kind.set('NOT_WORKING');
    component.openDetail();
    component.onMessage('x'.repeat(501));
    component.impact.set('RETRIED');
    await component.submitDetail();

    expect(component.message()).toHaveLength(500);
    expect(followUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ impact: 'RETRIED', message: 'x'.repeat(500) }),
    );
    expect(component.step()).toBe('done');
  });

  it('zeigt denselben Kartenkopf wie die Post-Session-Karte', () => {
    const fixture = TestBed.createComponent(ProductFeedbackInAppDialogComponent);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector(
      '.product-feedback-in-app-dialog__brand-icon',
    ) as HTMLElement | null;
    const step = fixture.nativeElement.querySelector(
      '.product-feedback-in-app-dialog__step',
    ) as HTMLElement | null;
    expect(icon?.textContent?.trim()).toBe('insights');
    expect(step?.textContent?.trim()).toBe('1/2');
    expect(
      fixture.nativeElement.querySelector('.product-feedback-in-app-dialog__choice'),
    ).toBeTruthy();
  });

  it('hält Overlay-Chrome und Sheet-Position an die Post-Session-Karte gekoppelt', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(dir, 'product-feedback-in-app-dialog.component.scss'), 'utf8');
    const styles = readFileSync(join(dir, '../../../styles.scss'), 'utf8');
    const launcher = readFileSync(join(dir, 'product-feedback-launcher.service.ts'), 'utf8');

    expect(launcher).toContain("panelClass: 'product-feedback-in-app-dialog-panel'");
    expect(launcher).toContain("backdropClass: 'product-feedback-in-app-dialog-backdrop'");
    expect(launcher).toMatch(/position:\s*\{\s*bottom:\s*'1\.25rem',\s*right:\s*'1\.25rem'\s*\}/);
    expect(styles).toMatch(
      /\.cdk-overlay-backdrop\.product-feedback-in-app-dialog-backdrop\s*\{[^}]*--mat-sys-scrim/,
    );
    expect(styles).toContain(
      '.cdk-overlay-pane.product-feedback-in-app-dialog-panel .mat-mdc-dialog-surface',
    );
    expect(styles).toMatch(/background:\s*transparent/);
    expect(styles).toContain('bottom: 0 !important');
    expect(styles).toContain('margin: 0 !important');
    expect(scss).toContain('var(--mat-sys-primary-container)');
    expect(scss).toContain('--app-shadow-accent');
    expect(scss).toContain(':host-context(html.preset-playful)');
    expect(scss).not.toMatch(/max-height:\s*min\(\s*32rem/);
    expect(scss).not.toMatch(/max-height:\s*min\(\s*36rem/);
    expect(scss).toContain('100dvh');
    expect(scss).not.toContain('::ng-deep');
    expect(scss).not.toContain(':deep(');
  });

  it('wiederholt nach einem Ergänzungsfehler nur die Ergänzung', async () => {
    followUpMock
      .mockRejectedValueOnce({ data: { code: 'BAD_REQUEST' } })
      .mockResolvedValueOnce({ ok: true });
    const fixture = TestBed.createComponent(ProductFeedbackInAppDialogComponent);
    const component = fixture.componentInstance;
    component.followUpCapability.set('f'.repeat(43));
    component.kind.set('NOT_WORKING');
    component.openDetail();
    component.onMessage('Die Auswahl war unklar.');

    await component.submitDetail();
    expect(component.step()).toBe('error');

    component.retry();
    await vi.waitFor(() => expect(followUpMock).toHaveBeenCalledTimes(2));
    expect(submitDraft).not.toHaveBeenCalled();
    expect(component.step()).toBe('done');
  });
});
