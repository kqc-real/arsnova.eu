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
