import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackHostComponent } from './feedback-host.component';

const { clearFeedbackHostTokenMock, setFeedbackHostTokenMock } = vi.hoisted(() => ({
  clearFeedbackHostTokenMock: vi.fn(),
  setFeedbackHostTokenMock: vi.fn(),
}));

const { clearHostTokenMock } = vi.hoisted(() => ({
  clearHostTokenMock: vi.fn(),
}));

vi.mock('../../core/feedback-host-token', () => ({
  clearFeedbackHostToken: clearFeedbackHostTokenMock,
  setFeedbackHostToken: setFeedbackHostTokenMock,
}));

vi.mock('../../core/host-session-token', () => ({
  clearHostToken: clearHostTokenMock,
}));

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    session: {
      end: { mutate: vi.fn().mockResolvedValue({ status: 'FINISHED' }) },
    },
    quickFeedback: {
      updateStyle: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
      results: { query: vi.fn().mockRejectedValue(new Error('not found')) },
      onResults: { subscribe: vi.fn() },
      hostResults: { query: vi.fn().mockRejectedValue(new Error('not found')) },
      onHostResults: { subscribe: vi.fn() },
      toggleLock: { mutate: vi.fn() },
      startDiscussion: { mutate: vi.fn() },
      startSecondRound: { mutate: vi.fn() },
      reset: { mutate: vi.fn() },
      end: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
      create: {
        mutate: vi.fn().mockResolvedValue({
          feedbackId: 'qf:ABC123',
          sessionCode: 'ABC123',
          hostToken: 'feedback-owner-token',
        }),
      },
      changeType: { mutate: vi.fn().mockResolvedValue({ ok: true }) },
    },
  },
}));

describe('FeedbackHostComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/feedback/ABC123/host');
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

  afterEach(() => {
    vi.useRealTimers();
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

  it('baut eingebettete Join-Links unter einem localized production base href', () => {
    const base = document.createElement('base');
    base.setAttribute('href', '/it/');
    document.head.prepend(base);

    try {
      const fixture = TestBed.createComponent(FeedbackHostComponent);
      fixture.componentRef.setInput('embeddedInSession', true);
      expect(fixture.componentInstance.joinUrl).toBe(`${window.location.origin}/it/join/ABC123`);
      fixture.destroy();
    } finally {
      base.remove();
    }
  });

  it('baut Standalone-Feedback-Links unter einem localized production base href', () => {
    const base = document.createElement('base');
    base.setAttribute('href', '/es/');
    document.head.prepend(base);

    try {
      const fixture = TestBed.createComponent(FeedbackHostComponent);
      expect(fixture.componentInstance.joinUrl).toBe(
        `${window.location.origin}/es/feedback/ABC123/vote`,
      );
      fixture.destroy();
    } finally {
      base.remove();
    }
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
      'Formatwechsel gesperrt. In Runde 2 bleibt das aktuelle Blitzlicht-Format aktiv. Für einen Wechsel setze das Blitzlicht zuerst zurück. Dabei werden die Stimmen aus Runde 1 gelöscht.',
      'Zurücksetzen',
      {
        duration: 12000,
        panelClass: 'feedback-compare-round-snackbar',
      },
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

  it('startet im eingebetteten Modus nach spaetem Start sofort die Live-Subscription', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const onResultsSubscribeMock = vi
      .mocked(trpc.quickFeedback.onHostResults.subscribe)
      .mockReturnValue({ unsubscribe: vi.fn() });
    vi.mocked(trpc.quickFeedback.hostResults.query)
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({
        type: 'TRUEFALSE_UNKNOWN',
        theme: 'system',
        preset: 'serious',
        locked: false,
        totalVotes: 0,
        distribution: { TRUE: 0, FALSE: 0, UNKNOWN: 0 },
      });

    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(onResultsSubscribeMock).not.toHaveBeenCalled();

    await fixture.componentInstance.startRound('TRUEFALSE_UNKNOWN');

    expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      type: 'TRUEFALSE_UNKNOWN',
      theme: fixture.componentInstance['themePreset'].theme(),
      preset: fixture.componentInstance['themePreset'].preset(),
    });
    expect(onResultsSubscribeMock).toHaveBeenCalledWith(
      { sessionCode: 'ABC123' },
      expect.any(Object),
    );
    fixture.destroy();
  });

  it('pollt im eingebetteten Modus weiter als Fallback, auch wenn eine Subscription aktiv ist', async () => {
    vi.useFakeTimers();
    const { trpc } = await import('../../core/trpc.client');
    vi.mocked(trpc.quickFeedback.hostResults.query).mockResolvedValue({
      type: 'TRUEFALSE_UNKNOWN',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 0,
      distribution: { TRUE: 0, FALSE: 0, UNKNOWN: 0 },
    });

    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    const comp = fixture.componentInstance as FeedbackHostComponent & {
      subscription: { unsubscribe(): void } | null;
      startPolling(): void;
      pollTimer: ReturnType<typeof setInterval> | null;
    };
    comp.subscription = { unsubscribe: vi.fn() };
    comp.startPolling();

    await vi.advanceTimersByTimeAsync(3000);

    expect(trpc.quickFeedback.hostResults.query).toHaveBeenCalledWith({ sessionCode: 'ABC123' });
    if (comp.pollTimer) {
      clearInterval(comp.pollTimer);
      comp.pollTimer = null;
    }
    fixture.destroy();
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
    expect(clearHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(clearFeedbackHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
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
    expect(clearFeedbackHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(trpc.session.end.mutate).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
    expect(onActionSubscribe).toHaveBeenCalled();
  });

  it('fixiert im Standalone-Host die primaere Aktion "Vergleichsrunde" unten neben "Session beenden"', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 4,
      distribution: { POSITIVE: 2, NEUTRAL: 1, NEGATIVE: 1 },
    });
    fixture.detectChanges();

    const bottomActions = fixture.nativeElement.querySelector(
      '.feedback-host__bottom-actions',
    ) as HTMLElement | null;
    const inlineActions = fixture.nativeElement.querySelector(
      '.feedback-host__actions',
    ) as HTMLElement | null;

    expect(bottomActions?.textContent).toContain('Vergleichsrunde');
    expect(bottomActions?.textContent).toContain('Session beenden');
    expect(inlineActions?.textContent).toContain('Link kopieren');
    expect(inlineActions?.textContent).toContain('Zurücksetzen');
    expect(inlineActions?.textContent).not.toContain('Vergleichsrunde');
    expect(inlineActions?.textContent).not.toContain('Session beenden');
  });

  it('fixiert im Standalone-Host bei Diskussionsphase die Aktion "Zweite Abstimmung" unten', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      discussion: true,
      totalVotes: 4,
      distribution: { POSITIVE: 2, NEUTRAL: 1, NEGATIVE: 1 },
    });
    fixture.detectChanges();

    const bottomActions = fixture.nativeElement.querySelector(
      '.feedback-host__bottom-actions',
    ) as HTMLElement | null;

    expect(bottomActions?.textContent).toContain('Zweite Abstimmung');
    expect(bottomActions?.textContent).toContain('Session beenden');
  });

  it('rendert im eingebetteten Session-Host keine eigene Bottom-Leiste mit "Session beenden"', () => {
    window.history.replaceState({}, '', '/session/ABC123/host');
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 4,
      distribution: { POSITIVE: 2, NEUTRAL: 1, NEGATIVE: 1 },
    });
    fixture.detectChanges();

    const bottomActions = fixture.nativeElement.querySelector(
      '.feedback-host__bottom-actions',
    ) as HTMLElement | null;

    expect(bottomActions).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Session beenden');
  });
});
