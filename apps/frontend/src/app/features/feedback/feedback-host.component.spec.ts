import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedbackHostComponent } from './feedback-host.component';

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    session: {
      end: { mutate: vi.fn().mockResolvedValue({ status: 'FINISHED' }) },
    },
    quickFeedback: {
      updateStyle: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
      results: { query: vi.fn().mockRejectedValue(new Error('not found')) },
      onResults: { subscribe: vi.fn() },
      toggleLock: { mutate: vi.fn() },
      startDiscussion: { mutate: vi.fn() },
      startSecondRound: { mutate: vi.fn() },
      reset: { mutate: vi.fn() },
      end: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
      create: { mutate: vi.fn().mockResolvedValue({ feedbackId: 'qf:ABC123', sessionCode: 'ABC123' }) },
      changeType: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
    },
  },
}));

describe('FeedbackHostComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [FeedbackHostComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ code: 'ABC123' }),
            },
          },
        },
      ],
    });
  });

  function createComponent(): FeedbackHostComponent {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    return fixture.componentInstance;
  }

  it('wechselt bei bestehendem Blitzlicht nur den Typ und behält den Code', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    const comp = createComponent();
    comp.result.set({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    });

    await comp.startRound('ABC');

    expect(trpc.quickFeedback.changeType.mutate).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      type: 'ABC',
      theme: comp['themePreset'].theme(),
      preset: comp['themePreset'].preset(),
    });
    expect(trpc.quickFeedback.create.mutate).not.toHaveBeenCalled();
    expect(snackBarSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
  });

  it('blockiert den Formatwechsel nach Stimmen und zeigt einen Hinweis', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    const comp = createComponent();
    comp.result.set({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
    });

    await comp.startRound('ABC');

    expect(trpc.quickFeedback.changeType.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.create.mutate).not.toHaveBeenCalled();
    expect(snackBarSpy).toHaveBeenCalledWith(
      'Eine Vergleichsrunde funktioniert nur mit demselben Blitzlicht-Format. Bitte erst zurücksetzen. Das löscht die bisherigen Stimmen.',
      undefined,
      { duration: 5000 },
    );
  });

  it('legt bei fehlendem Ergebnis auf vorhandenem Code keine neue Code-Route an', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const comp = createComponent();

    await comp.startRound('TRUEFALSE_UNKNOWN');

    expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      type: 'TRUEFALSE_UNKNOWN',
      theme: comp['themePreset'].theme(),
      preset: comp['themePreset'].preset(),
    });
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
  });

  it('beendet die eingebettete Session und navigiert zur Startseite', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const onActionSubscribe = vi.fn((callback: () => void) => {
      callback();
      return { unsubscribe: vi.fn() };
    });
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({
      onAction: () => ({ subscribe: onActionSubscribe }),
    } as never);

    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.endSession();
    await Promise.resolve();

    expect(snackBarSpy).toHaveBeenCalledWith(
      'Eine zweite Vergleichsrunde ist dann nicht mehr möglich. Es werden alle Ergebnisse gelöscht.',
      'Trotzdem beenden',
      { duration: 7000 },
    );
    expect(trpc.session.end.mutate).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/');
    expect(onActionSubscribe).toHaveBeenCalled();
    fixture.destroy();
  });

  it('beendet ein direkt gestartetes Blitzlicht und navigiert zur Startseite', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const onActionSubscribe = vi.fn((callback: () => void) => {
      callback();
      return { unsubscribe: vi.fn() };
    });
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({
      onAction: () => ({ subscribe: onActionSubscribe }),
    } as never);

    const comp = createComponent();

    comp.endSession();
    await Promise.resolve();

    expect(snackBarSpy).toHaveBeenCalledWith(
      'Das Blitzlicht wird beendet. Es werden alle Ergebnisse gelöscht.',
      'Trotzdem beenden',
      { duration: 7000 },
    );
    expect(trpc.quickFeedback.end.mutate).toHaveBeenCalledWith({ sessionCode: 'ABC123' });
    expect(trpc.session.end.mutate).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/');
    expect(onActionSubscribe).toHaveBeenCalled();
  });
});
