import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveProductFeedbackAreaPromptKind } from '@arsnova/shared-types';
import { ProductFeedbackCardComponent } from './product-feedback-card.component';
import { storeProductFeedbackParticipantClaimToken } from './product-feedback-storage';

const { claimInviteMock, submitMock, followUpMock } = vi.hoisted(() => ({
  claimInviteMock: vi.fn(),
  submitMock: vi.fn(),
  followUpMock: vi.fn(),
}));

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    productFeedback: {
      claimInvite: { mutate: claimInviteMock },
      submit: { mutate: submitMock },
      followUp: { mutate: followUpMock },
    },
  },
}));

const hostSurvey = {
  surveyKey: 'POST_SESSION_EASE_HOST_V1' as const,
  surveyVersion: 1,
  role: 'HOST' as const,
  primaryAnswers: ['EASY', 'MINOR_FRICTION', 'HARD'] as const,
  areas: ['PREPARE_QUIZ', 'LIVE_CONTROL', 'TECH'] as const,
};

describe('ProductFeedbackCard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    claimInviteMock.mockResolvedValue({
      inviteToken: 'invite-token-value-123456789012345',
      survey: hostSurvey,
    });
    submitMock.mockResolvedValue({
      ok: true,
      followUpCapability: 'follow-up-capability-value-1234567890',
    });
    followUpMock.mockResolvedValue({ ok: true });
    await TestBed.configureTestingModule({
      imports: [ProductFeedbackCardComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  afterEach(() => {
    document.querySelector('[data-test-focus-origin]')?.remove();
  });

  it('mappt positive Antworten auf strength und Reibung auf hurdle', () => {
    expect(resolveProductFeedbackAreaPromptKind('EASY')).toBe('strength');
    expect(resolveProductFeedbackAreaPromptKind('YES')).toBe('strength');
    expect(resolveProductFeedbackAreaPromptKind('HARD')).toBe('hurdle');
    expect(resolveProductFeedbackAreaPromptKind('PARTIAL')).toBe('hurdle');
    expect(resolveProductFeedbackAreaPromptKind('NO')).toBe('hurdle');
    expect(resolveProductFeedbackAreaPromptKind('MINOR_FRICTION')).toBe('hurdle');
  });

  it('speichert nach genau zwei Pflichtauswahlen und bietet die freiwillige Ergänzung an', async () => {
    const fixture = TestBed.createComponent(ProductFeedbackCardComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('feedbackRole', 'HOST');
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.step()).toBe('primary'));
    fixture.detectChanges();

    expect(submitMock).not.toHaveBeenCalled();
    const easy = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Leicht'),
    ) as HTMLButtonElement;
    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.getAttribute('aria-live')).toBe('polite');
    easy.click();
    fixture.detectChanges();
    expect(submitMock).not.toHaveBeenCalled();

    const area = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Quiz vorbereiten'),
    ) as HTMLButtonElement;
    area.click();
    await vi.waitFor(() => expect(fixture.componentInstance.step()).toBe('thanks'));
    fixture.detectChanges();

    expect(submitMock).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Möchtest du noch etwas ergänzen?');
    expect(fixture.nativeElement.textContent).toContain('Deine Rückmeldung ist angekommen.');
    expect(fixture.nativeElement.textContent).toContain('Ergänzung hinzufügen');
  });

  it('bindet den Teilnehmer-Claim an den lokal gespeicherten Besitznachweis', async () => {
    storeProductFeedbackParticipantClaimToken('ABC123', 'participant-claim-token-value-1234567890');
    claimInviteMock.mockResolvedValue({ inviteToken: null, survey: null });
    const fixture = TestBed.createComponent(ProductFeedbackCardComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('feedbackRole', 'PARTICIPANT');
    fixture.componentRef.setInput('participantId', '11111111-1111-4111-8111-111111111111');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(claimInviteMock).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      role: 'PARTICIPANT',
      participantId: '11111111-1111-4111-8111-111111111111',
      participantClaimToken: 'participant-claim-token-value-1234567890',
    });
  });

  it('bietet bei dauerhaft abgelehntem Invite-Claim keinen wirkungslosen Retry an', async () => {
    claimInviteMock.mockRejectedValue({ data: { code: 'UNAUTHORIZED' } });
    const fixture = TestBed.createComponent(ProductFeedbackCardComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('feedbackRole', 'HOST');
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.step()).toBe('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Diese Rückmeldung kann nicht gesendet werden.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Erneut senden');
  });

  it('zeigt eine typisierte Einmaligkeitsablehnung ohne wirkungslosen Retry', async () => {
    submitMock.mockRejectedValue({ data: { code: 'CONFLICT' } });
    const fixture = TestBed.createComponent(ProductFeedbackCardComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('feedbackRole', 'HOST');
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.step()).toBe('primary'));
    fixture.detectChanges();

    (
      [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
        button.textContent.includes('Leicht'),
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
        button.textContent.includes('Quiz vorbereiten'),
      ) as HTMLButtonElement
    ).click();
    await vi.waitFor(() => expect(fixture.componentInstance.step()).toBe('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Diese Einladung wurde bereits verwendet.');
    expect(fixture.nativeElement.textContent).not.toContain('Erneut senden');
  });

  it('gibt den Fokus beim Schließen zuverlässig an den Auslöser zurück', async () => {
    const origin = document.createElement('button');
    origin.dataset['testFocusOrigin'] = 'true';
    document.body.append(origin);
    origin.focus();

    const fixture = TestBed.createComponent(ProductFeedbackCardComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('feedbackRole', 'HOST');
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.step()).toBe('primary'));
    fixture.detectChanges();

    const close = fixture.nativeElement.querySelector(
      'button[aria-label="Schließen"]',
    ) as HTMLButtonElement;
    close.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(origin);
  });
});
