import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackHostComponent } from './feedback-host.component';
import type { QuickFeedbackResult } from '@arsnova/shared-types';

const { clearFeedbackHostTokenMock, setFeedbackHostTokenMock } = vi.hoisted(() => ({
  clearFeedbackHostTokenMock: vi.fn(),
  setFeedbackHostTokenMock: vi.fn(),
}));

const { clearHostTokenMock } = vi.hoisted(() => ({
  clearHostTokenMock: vi.fn(),
}));

const { onHostResultsSubscribeMock } = vi.hoisted(() => {
  const impl = vi.fn(() => ({ unsubscribe: vi.fn() }));
  return {
    onHostResultsSubscribeMock: new Proxy(impl, {
      get(target, prop, receiver) {
        // Spiegelt tRPC-Proxy: `.bind` ist kein Function.prototype.bind, sondern ein Pfadsegment.
        if (prop === 'bind') {
          throw new TypeError('client[bind] is not a function');
        }
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

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
      dismissFinishProjection: { mutate: vi.fn().mockResolvedValue({ finishProjection: 'idle' }) },
    },
    quickFeedback: {
      results: { query: vi.fn().mockRejectedValue(new Error('not found')) },
      onResults: { subscribe: vi.fn() },
      hostResults: { query: vi.fn().mockRejectedValue(new Error('not found')) },
      onHostResults: { subscribe: onHostResultsSubscribeMock },
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
      setLiveResults: { mutate: vi.fn().mockResolvedValue({ showLiveResults: true }) },
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

  function createEmbeddedFixture(initial?: QuickFeedbackResult) {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    const comp = fixture.componentInstance;
    vi.spyOn(comp, 'ngOnInit').mockResolvedValue(undefined);
    const applyResult = (data: QuickFeedbackResult) => {
      (comp as unknown as { applyHostResult(data: QuickFeedbackResult): void }).applyHostResult(
        data,
      );
    };
    if (initial) {
      applyResult(initial);
    }
    fixture.detectChanges();
    return { fixture, comp, applyResult };
  }

  const moodRound: QuickFeedbackResult = {
    type: 'MOOD',
    locked: false,
    totalVotes: 3,
    distribution: { POSITIVE: 2, NEUTRAL: 1, NEGATIVE: 0 },
  };

  it('bietet leer Tempo empfohlen und kompakte benannte Formate ohne weiteren Dialog', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const { fixture, comp } = createEmbeddedFixture();
    const button = fixture.nativeElement.querySelector(
      '[data-testid="feedback-empty-tempo"]',
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Empfohlen: Tempo');
    const formats = fixture.nativeElement.querySelector('[data-testid="feedback-empty-formats"]');
    expect(formats.querySelectorAll('button').length).toBe(comp.presetChips.length);
    for (const chip of comp.presetChips) {
      expect(formats.textContent).toContain(chip.label);
    }
    let finish!: (value: { feedbackId: string; sessionCode: string }) => void;
    vi.mocked(trpc.quickFeedback.create.mutate).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(trpc.quickFeedback.hostResults.query).mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      totalVotes: 0,
      distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
    });
    button.focus();
    const first = comp.startRound('TEMPO');
    await comp.startRound('TEMPO');
    fixture.detectChanges();
    expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    finish({ feedbackId: 'qf:ABC123', sessionCode: 'ABC123' });
    await first;
    fixture.detectChanges();
    expect(comp.tempoViewMode()).toBe('trend');
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.feedback-host__workspace-title'),
    );
    expect(document.activeElement?.classList.contains('app-content-focus-target')).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="feedback-empty-tempo"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.feedback-host__tempo-trend')).not.toBeNull();
    fixture.destroy();
  });

  it('hält Rundeneinstellungen geschlossen und erhält ihre Werte und Fokus beim Einklappen', () => {
    const { fixture, comp } = createEmbeddedFixture(moodRound);
    const trigger = fixture.nativeElement.querySelector(
      '[data-testid="feedback-round-settings-trigger"]',
    ) as HTMLButtonElement;
    const settings = fixture.nativeElement.querySelector(
      '[data-testid="feedback-round-settings"]',
    ) as HTMLElement;
    const primary = fixture.nativeElement.querySelector(
      '.feedback-host__round-primary',
    ) as HTMLElement;
    expect(trigger.textContent).toContain('Weitere Formate');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(settings.hidden).toBe(true);
    expect(settings.querySelector('[data-testid="feedback-compare-round"]')).toBeNull();
    expect(settings.querySelector('[data-testid="feedback-reset-round"]')).toBeNull();
    expect(settings.textContent).not.toContain('Link kopieren');
    expect(primary.querySelector('[data-testid="feedback-compare-round"]')).not.toBeNull();
    expect(primary.querySelector('[data-testid="feedback-reset-round"]')).not.toBeNull();
    expect(settings.querySelector('[data-testid="feedback-live-results"]')).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.feedback-host__results')
        .compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    trigger.click();
    fixture.detectChanges();
    expect(settings.hidden).toBe(false);
    const liveResults = settings.querySelector(
      '[data-testid="feedback-live-results"] button',
    ) as HTMLButtonElement;
    liveResults.focus();
    comp.toggleRoundSettings();
    expect(document.activeElement).toBe(trigger);
    fixture.detectChanges();
    expect(settings.hidden).toBe(true);
    comp.toggleRoundSettings();
    fixture.detectChanges();
    expect(comp.result()).toEqual(moodRound);
    expect(comp.showLiveResults()).toBe(true);
    fixture.destroy();
  });

  it('führt Fokus vor Vergleichsphasen, Formatwechsel und fehlender Runde an vorhandene Ziele', () => {
    const { fixture, comp, applyResult } = createEmbeddedFixture(moodRound);
    comp.toggleRoundSettings();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      '[data-testid="feedback-round-settings-trigger"]',
    );
    const heading = fixture.nativeElement.querySelector('.feedback-host__workspace-title');
    const compare = fixture.nativeElement.querySelector(
      '[data-testid="feedback-compare-round"]',
    ) as HTMLButtonElement;
    compare.focus();
    applyResult({
      ...moodRound,
      discussion: true,
      locked: true,
      round1Total: 3,
      round1Distribution: moodRound.distribution,
    });
    expect(document.activeElement).toBe(heading);
    fixture.detectChanges();
    const second = fixture.nativeElement.querySelector(
      '[data-testid="feedback-second-round"]',
    ) as HTMLButtonElement;
    second.focus();
    applyResult({ ...moodRound, discussion: false, currentRound: 2, totalVotes: 0 });
    expect(document.activeElement).toBe(heading);
    fixture.detectChanges();
    const stars = fixture.nativeElement.querySelector(
      '[data-feedback-type="STARS"]',
    ) as HTMLButtonElement;
    stars.focus();
    applyResult({
      type: 'STARS',
      locked: false,
      totalVotes: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
    expect(document.activeElement).toBe(trigger);
    fixture.detectChanges();
    const reset = fixture.nativeElement.querySelector(
      '[data-testid="feedback-reset-round"]',
    ) as HTMLButtonElement;
    reset.focus();
    (comp as unknown as { markFeedbackRoundMissing(code: string): void }).markFeedbackRoundMissing(
      'ABC123',
    );
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.feedback-host__workspace-title'),
    );
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="feedback-empty-tempo"]'),
    ).not.toBeNull();
    fixture.destroy();
  });

  it('erhält Fokus bei fachlich identischen Snapshots mit expliziten Rundendefaults', () => {
    const { fixture, comp, applyResult } = createEmbeddedFixture(moodRound);
    comp.toggleRoundSettings();
    fixture.detectChanges();
    const compare = fixture.nativeElement.querySelector(
      '[data-testid="feedback-compare-round"]',
    ) as HTMLButtonElement;
    compare.focus();
    applyResult({ ...moodRound, discussion: false, currentRound: 1 });
    fixture.detectChanges();
    expect(document.activeElement).toBe(compare);
    applyResult(moodRound);
    fixture.detectChanges();
    expect(document.activeElement).toBe(compare);
    fixture.destroy();
  });

  it('stiehlt bei neuen Stimmen und entfernten Vergleichsaktionen keinen fremden Fokus', () => {
    const { fixture, comp, applyResult } = createEmbeddedFixture(moodRound);
    comp.toggleRoundSettings();
    fixture.detectChanges();
    const reset = fixture.nativeElement.querySelector(
      '[data-testid="feedback-reset-round"]',
    ) as HTMLButtonElement;
    reset.focus();
    applyResult({ ...moodRound, totalVotes: 4 });
    fixture.detectChanges();
    expect(document.activeElement).toBe(reset);
    applyResult({ ...moodRound, discussion: true, locked: true });
    fixture.detectChanges();
    expect(document.activeElement).toBe(reset);
    fixture.destroy();
  });

  it('erhält nach abgelehntem Start den Auslöser und erlaubt denselben Start als Retry', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const { fixture, comp } = createEmbeddedFixture();
    vi.mocked(trpc.quickFeedback.create.mutate).mockRejectedValueOnce(new Error('offline'));
    const button = fixture.nativeElement.querySelector(
      '[data-testid="feedback-empty-tempo"]',
    ) as HTMLButtonElement;
    button.focus();
    expect(await comp.startRound('TEMPO')).toBe('failed');
    fixture.detectChanges();
    expect(document.activeElement).toBe(button);
    expect(comp.roundActionBusy()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Bitte erneut versuchen.',
    );
    vi.mocked(trpc.quickFeedback.hostResults.query).mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      totalVotes: 0,
      distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
    });
    expect(await comp.startRound('TEMPO')).toBe('applied');
    expect(comp.roundActionError()).toBeNull();
    expect(trpc.quickFeedback.create.mutate).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it('zeigt den Aktualisierungshinweis beim Zurücksetzen nicht sofort', async () => {
    vi.useFakeTimers();
    const { fixture, comp } = createEmbeddedFixture(moodRound);
    comp.roundActionPending.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Blitzlicht wird aktualisiert');

    await vi.advanceTimersByTimeAsync(400);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Blitzlicht wird aktualisiert');

    comp.roundActionPending.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Blitzlicht wird aktualisiert');
    fixture.destroy();
  });

  it('bewahrt Reset-Fokus bei Pending und Ablehnung, sperrt Doppelklick und ermöglicht Retry', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const { fixture, comp } = createEmbeddedFixture(moodRound);
    comp.toggleRoundSettings();
    fixture.detectChanges();
    const reset = fixture.nativeElement.querySelector(
      '[data-testid="feedback-reset-round"]',
    ) as HTMLButtonElement;
    let reject!: (error: Error) => void;
    vi.mocked(trpc.quickFeedback.reset.mutate).mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    reset.focus();
    const pending = comp.resetRound();
    await comp.resetRound();
    fixture.detectChanges();
    expect(trpc.quickFeedback.reset.mutate).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(reset);
    expect(reset.disabled).toBe(false);
    expect(reset.getAttribute('aria-disabled')).toBe('true');
    reject(new Error('offline'));
    await pending;
    fixture.detectChanges();
    expect(document.activeElement).toBe(reset);
    expect(comp.roundActionBusy()).toBe(false);
    expect(comp.roundActionError()).not.toBeNull();
    await comp.resetRound();
    expect(trpc.quickFeedback.reset.mutate).toHaveBeenCalledTimes(2);
    expect(comp.roundActionError()).toBeNull();
    fixture.destroy();
  });

  it('sperrt alle Rundeneinstellungen während einer übergeordneten Hostaktion', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const { fixture, comp } = createEmbeddedFixture(moodRound);
    fixture.componentRef.setInput('roundControlPending', true);
    fixture.detectChanges();
    await comp.startRound('TEMPO');
    await comp.startDiscussion();
    await comp.startSecondRound();
    await comp.resetRound();
    await comp.setLiveResults(false);
    expect(trpc.quickFeedback.changeType.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.startDiscussion.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.startSecondRound.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.reset.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.setLiveResults.mutate).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('bewahrt Fokus und Ergebnisfreigabe beim fehlgeschlagenen Live-Schalter und dessen Retry', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const { fixture, comp } = createEmbeddedFixture({ ...moodRound, showLiveResults: true });
    comp.toggleRoundSettings();
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="feedback-live-results"] button',
    ) as HTMLButtonElement;
    toggle.focus();
    vi.mocked(trpc.quickFeedback.setLiveResults.mutate).mockRejectedValueOnce(new Error('offline'));
    await comp.setLiveResults(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(toggle);
    expect(comp.showLiveResults()).toBe(true);
    expect(comp.roundActionBusy()).toBe(false);
    await comp.setLiveResults(false);
    fixture.detectChanges();
    expect(comp.showLiveResults()).toBe(false);
    expect(document.activeElement).toBe(toggle);
    fixture.destroy();
  });

  it('wechselt bei bestehendem Blitzlicht nur den Typ und behält den Code', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    const comp = createComponent();
    comp.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    });

    await comp.startRound('STARS');

    expect(trpc.quickFeedback.changeType.mutate).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      type: 'STARS',
    });
    expect(trpc.quickFeedback.create.mutate).not.toHaveBeenCalled();
    expect(snackBarSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
  });

  it('verwendet typabhängige Voreinstellungen für Live-Ergebnisse', () => {
    const comp = createComponent();
    comp.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    });
    expect(comp.showLiveResults()).toBe(true);

    comp.result.set({
      type: 'YESNO',
      locked: false,
      totalVotes: 0,
      distribution: { YES: 0, NO: 0, MAYBE: 0 },
    });
    expect(comp.showLiveResults()).toBe(false);
  });

  it('ändert die Live-Ergebnisfreigabe ohne die Runde zurückzusetzen', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const comp = createComponent();
    comp.result.set({
      type: 'YESNO',
      locked: false,
      showLiveResults: false,
      totalVotes: 3,
      distribution: { YES: 2, NO: 1, MAYBE: 0 },
    });

    await comp.setLiveResults(true);

    expect(trpc.quickFeedback.setLiveResults.mutate).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      showLiveResults: true,
    });
    expect(comp.result()).toMatchObject({
      showLiveResults: true,
      totalVotes: 3,
      distribution: { YES: 2, NO: 1, MAYBE: 0 },
    });
  });

  it('baut eingebettete Join-Links unter einem localized production base href', () => {
    const base = document.createElement('base');
    base.setAttribute('href', '/it/');
    document.head.prepend(base);

    try {
      const fixture = TestBed.createComponent(FeedbackHostComponent);
      fixture.componentRef.setInput('embeddedInSession', true);
      expect(fixture.componentInstance.joinUrl).toBe(
        `${window.location.origin}/it/join/ABC123?join=ABC123`,
      );
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
      locked: false,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
    });

    await comp.startRound('STARS');

    expect(trpc.quickFeedback.changeType.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.create.mutate).not.toHaveBeenCalled();
    expect(snackBarSpy).toHaveBeenCalledWith(
      'Formatwechsel gesperrt. Sobald Stimmen vorliegen oder die Vergleichsrunde läuft, bleibt das aktuelle Blitzlicht-Format aktiv. Für einen Wechsel setze das Blitzlicht zuerst zurück. Dabei werden alle bisherigen Stimmen gelöscht.',
      'Zurücksetzen',
      {
        duration: 12000,
        panelClass: 'feedback-compare-round-snackbar',
      },
    );
  });

  it('ersetzt ein laufendes Tempo-Blitzlicht trotz vorhandener Tempo-Rückmeldungen', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    const comp = createComponent();
    comp.result.set({
      type: 'TEMPO',
      locked: false,
      totalVotes: 3,
      distribution: { SPEED_UP: 0, FOLLOWING: 2, SLOW_DOWN: 1, LOST: 0 },
      tempoTrend: {
        status: 'TOO_FAST',
        active: true,
        activeParticipants: 3,
        tempoVotes: 3,
        requiredVotes: 3,
        windowSeconds: 60,
        bucketSeconds: 15,
      },
    });

    await comp.startRound('MOOD');

    expect(trpc.quickFeedback.changeType.mutate).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      type: 'MOOD',
    });
    expect(snackBarSpy).not.toHaveBeenCalled();
  });

  it('rendert Tempo in der leeren Host-Auswahl als Spotlight-Kachel', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.detectChanges();

    const spotlight = fixture.nativeElement.querySelector(
      '.feedback-host__tempo-spotlight',
    ) as HTMLElement | null;

    expect(spotlight?.textContent).toContain('Empfohlen: Tempo');
    expect(spotlight?.textContent).toContain('Starten');
    fixture.destroy();
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
    });
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
  });

  it('startet nach einem fehlgeschlagenen Ergebnisabruf keine neue Runde', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as { queryParamMap: ReturnType<typeof convertToParamMap> }).queryParamMap =
      convertToParamMap({ feedbackType: 'TEMPO' });
    vi.mocked(trpc.quickFeedback.hostResults.query).mockRejectedValueOnce(
      new Error('temporärer Fehler'),
    );
    vi.mocked(trpc.quickFeedback.create.mutate).mockClear();
    vi.mocked(trpc.quickFeedback.changeType.mutate).mockClear();

    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trpc.quickFeedback.create.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.changeType.mutate).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('abonniert Host-Ergebnisse nach erfolgreichem Abruf ohne Proxy-.bind', async () => {
    expect(() =>
      (
        onHostResultsSubscribeMock as unknown as {
          bind: (thisArg: unknown) => unknown;
        }
      ).bind(null),
    ).toThrow(/client\[bind\] is not a function/);

    const { trpc } = await import('../../core/trpc.client');
    const hostResultsQuery = vi.mocked(trpc.quickFeedback.hostResults.query);
    hostResultsQuery.mockReset();
    hostResultsQuery.mockResolvedValue({
      type: 'MOOD',
      locked: false,
      totalVotes: 2,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 0 },
    });
    onHostResultsSubscribeMock.mockClear();

    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    const comp = fixture.componentInstance as FeedbackHostComponent & {
      loadInitialResult(): Promise<void>;
      subscription: { unsubscribe(): void } | null;
    };
    comp.subscription = null;
    await comp.loadInitialResult();

    expect(comp.result()?.type).toBe('MOOD');
    expect(onHostResultsSubscribeMock).toHaveBeenCalledWith(
      { sessionCode: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function), onError: expect.any(Function) }),
    );
    fixture.destroy();
  });

  it('zeigt bei gesperrtem Formatwechsel den Hinweis nur einmal und wiederholt ihn nicht beim Polling', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as { queryParamMap: ReturnType<typeof convertToParamMap> }).queryParamMap =
      convertToParamMap({ feedbackType: 'STARS' });
    vi.mocked(trpc.quickFeedback.hostResults.query).mockResolvedValue({
      type: 'MOOD',
      locked: false,
      totalVotes: 1,
      distribution: { POSITIVE: 1, NEUTRAL: 0, NEGATIVE: 0 },
    });
    vi.mocked(trpc.quickFeedback.create.mutate).mockClear();
    vi.mocked(trpc.quickFeedback.changeType.mutate).mockClear();
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({
      onAction: () => ({ subscribe: vi.fn() }),
    } as never);

    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    const comp = fixture.componentInstance as FeedbackHostComponent & {
      consumeRequestedFeedbackType(): Promise<void>;
      hostResultLoad: 'unknown' | 'ready' | 'missing' | 'failed';
    };
    comp.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 1,
      distribution: { POSITIVE: 1, NEUTRAL: 0, NEGATIVE: 0 },
    });
    comp.hostResultLoad = 'ready';

    await comp.consumeRequestedFeedbackType();

    expect(snackBarSpy).toHaveBeenCalledTimes(1);
    expect(trpc.quickFeedback.create.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.changeType.mutate).not.toHaveBeenCalled();

    await comp.consumeRequestedFeedbackType();
    await comp.consumeRequestedFeedbackType();
    await comp.consumeRequestedFeedbackType();

    expect(snackBarSpy).toHaveBeenCalledTimes(1);
    expect(trpc.quickFeedback.create.mutate).not.toHaveBeenCalled();
    expect(trpc.quickFeedback.changeType.mutate).not.toHaveBeenCalled();
    fixture.destroy();
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

  it('rendert aktualisierte Standalone-Ergebnisse auch bei offenem Beitritts-Overlay', async () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentInstance.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    });

    fixture.componentInstance.feedbackJoinPopoverOpen.set(true);
    fixture.detectChanges();
    fixture.componentInstance.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 1,
      distribution: { POSITIVE: 1, NEUTRAL: 0, NEGATIVE: 0 },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.feedbackJoinPopoverOpen()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('1 Stimme');
    expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    expect(
      fixture.nativeElement.querySelector(
        '.feedback-host__join-menu-head .dialog-title-header__icon',
      ),
    ).toBeNull();
    fixture.destroy();
  });

  it('zeigt den Standalone-Join-Trigger nur als QR-Icon mit zugaenglichem Namen', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', false);
    fixture.componentInstance.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    });
    fixture.detectChanges();

    const joinControl = fixture.nativeElement.querySelector(
      '.feedback-host__standalone-join-control',
    ) as HTMLButtonElement | null;

    expect(joinControl).not.toBeNull();
    expect(joinControl?.getAttribute('aria-label')).toBe('Beitrittsinformationen öffnen');
    expect(joinControl?.querySelector('mat-icon')?.textContent?.trim()).toBe('qr_code_2');
    expect(joinControl?.textContent?.replace(/\s+/g, ' ').trim()).toBe('qr_code_2');
    const liveCode = fixture.nativeElement.querySelector(
      '.feedback-host__standalone-code',
    ) as HTMLElement;
    expect(liveCode).not.toBeNull();
    expect(liveCode.hasAttribute('aria-label')).toBe(false);
    expect(liveCode.querySelector('.sr-only')?.textContent?.trim()).toBe('Session-Code ABC123');
    expect(liveCode.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('ABC123');
    fixture.destroy();
  });

  it('zeigt im Beitritts-Overlay Host und Code und stellt nach Abbau der Fokusfalle den Trigger wieder her', async () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', false);
    fixture.componentInstance.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    });
    fixture.detectChanges();
    fixture.nativeElement.setAttribute('tabindex', '-1');
    fixture.nativeElement.focus();
    fixture.componentInstance.feedbackJoinPopoverOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = fixture.nativeElement.querySelector(
      '.feedback-host__join-viewport-overlay',
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    const overlayCode = overlay?.querySelector('.feedback-host__join-menu-origin--code');
    expect(overlayCode).not.toBeNull();
    expect(overlayCode?.hasAttribute('aria-label')).toBe(false);
    expect(overlayCode?.querySelector('.sr-only')?.textContent?.trim()).toBe('Session-Code ABC123');
    expect(overlayCode?.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('ABC123');
    expect(overlay?.textContent).toContain('Link kopieren');
    expect(overlay?.textContent).not.toContain('Session-Link kopieren');
    fixture.componentInstance.closeFeedbackJoinPopover();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.feedback-host__join-viewport-overlay')).toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('[aria-controls="feedback-host-join-info"]'),
    );
    fixture.destroy();
  });

  it('überlässt das globale Ende im eingebetteten Modus dem gemeinsamen Session-Host', async () => {
    const { trpc } = await import('../../core/trpc.client');
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const snackBarSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.endSession();

    expect(snackBarSpy).not.toHaveBeenCalled();
    expect(trpc.session.end.mutate).not.toHaveBeenCalled();
    expect(trpc.session.dismissFinishProjection.mutate).not.toHaveBeenCalled();
    expect(clearHostTokenMock).not.toHaveBeenCalled();
    expect(clearFeedbackHostTokenMock).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
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

  it('fixiert im Standalone-Host die primaere Aktion "Vergleichsrunde" unten neben "Blitzlicht beenden"', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'MOOD',
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
    expect(bottomActions?.textContent).toContain('Blitzlicht beenden');
    expect(inlineActions?.textContent).not.toContain('Link kopieren');
    expect(inlineActions?.textContent).toContain('Zurücksetzen');
    expect(inlineActions?.textContent).not.toContain('Vergleichsrunde');
    expect(inlineActions?.textContent).not.toContain('Blitzlicht beenden');
  });

  it('fixiert im Standalone-Host bei Diskussionsphase die Aktion "Zweite Abstimmung" unten', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'MOOD',
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
    expect(bottomActions?.textContent).toContain('Blitzlicht beenden');
  });

  it('leitet Wheel- und Touch-Scrollen über den Standalone-Aktionen an den Hauptinhalt weiter', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const main = document.createElement('main');
    main.id = 'main-content';
    main.scrollTop = 100;
    document.body.append(main);

    const wheelPreventDefault = vi.fn();
    const zoomPreventDefault = vi.fn();
    const shortTouchPreventDefault = vi.fn();
    const scrollTouchPreventDefault = vi.fn();

    try {
      fixture.componentInstance.onBottomActionsWheel({
        deltaY: 2,
        deltaMode: 1,
        cancelable: true,
        preventDefault: wheelPreventDefault,
      } as unknown as WheelEvent);

      fixture.componentInstance.onBottomActionsWheel({
        ctrlKey: true,
        deltaY: 100,
        deltaMode: 0,
        cancelable: true,
        preventDefault: zoomPreventDefault,
      } as unknown as WheelEvent);

      fixture.componentInstance.onBottomActionsTouchStart({
        touches: [{ clientY: 300 }],
      } as unknown as TouchEvent);
      fixture.componentInstance.onBottomActionsTouchMove({
        touches: [{ clientY: 296 }],
        cancelable: true,
        preventDefault: shortTouchPreventDefault,
      } as unknown as TouchEvent);
      fixture.componentInstance.onBottomActionsTouchMove({
        touches: [{ clientY: 280 }],
        cancelable: true,
        preventDefault: scrollTouchPreventDefault,
      } as unknown as TouchEvent);
      fixture.componentInstance.onBottomActionsTouchEnd();

      expect(main.scrollTop).toBe(152);
      expect(wheelPreventDefault).toHaveBeenCalledOnce();
      expect(zoomPreventDefault).not.toHaveBeenCalled();
      expect(shortTouchPreventDefault).not.toHaveBeenCalled();
      expect(scrollTouchPreventDefault).toHaveBeenCalledOnce();
    } finally {
      main.remove();
      fixture.destroy();
    }
  });

  it('priorisiert die destruktiven MD3-Farben vor nachgeladenen Tonal-Button-Stilen', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const componentDir = dirname(fileURLToPath(import.meta.url));
    const styles = readFileSync(join(componentDir, 'feedback-host.component.scss'), 'utf8');

    expect(styles).toMatch(
      /\.feedback-host__bottom-action-secondary\.mat-tonal-button:not\(:disabled\)\s*\{[^}]*background:[^}]*--mat-sys-error-container[^}]*color:\s*var\(--mat-sys-on-error-container\)/,
    );
  });

  it('hält den Verbessern-Link unter der floating App-Bar', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const styles = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'feedback-host.component.scss'),
      'utf8',
    );

    expect(styles).toMatch(
      /\.feedback-host__product-feedback-utility\s*\{[^}]*padding-top:\s*1\.75rem/,
    );
    expect(styles).toMatch(
      /\.feedback-host__product-feedback-utility\s*\{[\s\S]*?@media \(min-width: 840px\)\s*\{[^}]*padding-top:\s*2\.25rem/,
    );
  });

  it('hält Host-Radii auf Material-Corner-Tokens', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const componentDir = dirname(fileURLToPath(import.meta.url));
    const styles = readFileSync(join(componentDir, 'feedback-host.component.scss'), 'utf8');

    expect(styles).not.toMatch(/border-radius:\s*(0\.(75|85|9)|1(\.25)?)rem/);
    expect(styles).toMatch(/border-radius:\s*var\(--mat-sys-corner-extra-large\)/);
    expect(styles).toMatch(/border-radius:\s*var\(--mat-sys-corner-large\)/);
    expect(styles).toMatch(/border-radius:\s*var\(--mat-sys-corner-medium\)/);
  });

  it('rendert im eingebetteten Session-Host keine eigene Bottom-Leiste mit "Blitzlicht beenden"', () => {
    window.history.replaceState({}, '', '/session/ABC123/host');
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    fixture.componentRef.setInput('embeddedInSession', true);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 4,
      distribution: { POSITIVE: 2, NEUTRAL: 1, NEGATIVE: 1 },
    });
    fixture.detectChanges();

    const bottomActions = fixture.nativeElement.querySelector(
      '.feedback-host__bottom-actions',
    ) as HTMLElement | null;

    expect(bottomActions).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Blitzlicht beenden');
  });

  it('zeigt den Tempo-Umschalter im eingebetteten Host neben der Rundenaktion', () => {
    const { fixture } = createEmbeddedFixture({
      type: 'TEMPO',
      locked: false,
      totalVotes: 4,
      distribution: { SPEED_UP: 0, FOLLOWING: 3, SLOW_DOWN: 1, LOST: 0 },
    });
    const settings = fixture.nativeElement.querySelector(
      '[data-testid="feedback-round-settings"]',
    ) as HTMLElement;
    const primary = fixture.nativeElement.querySelector(
      '.feedback-host__round-primary',
    ) as HTMLElement;

    expect(settings.querySelector('.feedback-host__tempo-view-toggle')).toBeNull();
    expect(primary.querySelector('.feedback-host__tempo-view-toggle')).not.toBeNull();
    expect(primary.textContent).toContain('Details');
    expect(primary.textContent).toContain('Tendenz');
    expect(
      primary.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fixture.destroy();
  });

  it('zeigt im Standalone-Tempo-Modus Tendenz, Zaehler, Umschalter und Ende-Aktion', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'TEMPO',
      locked: false,
      totalVotes: 9,
      distribution: { SPEED_UP: 0, FOLLOWING: 7, SLOW_DOWN: 2, LOST: 0 },
      tempoTrend: {
        status: 'FOLLOWING',
        active: true,
        activeParticipants: 12,
        tempoVotes: 9,
        requiredVotes: 3,
        windowSeconds: 60,
        bucketSeconds: 15,
      },
    });
    comp.tempoViewMode.set('trend');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Die Mehrheit kann folgen.');
    expect(text).toContain('Online');
    expect(text).toContain('Im Barometer');
    expect(text).not.toContain('12 aktive Personen');
    expect(text).not.toContain('9 Rückmeldungen');
    expect(text).toContain('Details');
    expect(text).toContain('Tendenz');
    expect(text).toContain('Blitzlicht beenden');
    const trendPane = fixture.nativeElement.querySelector(
      '.feedback-host__tempo-pane:has(.feedback-host__tempo-trend)',
    );
    const detailsPane = fixture.nativeElement.querySelector(
      '.feedback-host__tempo-pane:has(.feedback-host__tempo-strip)',
    );
    expect(trendPane?.getAttribute('aria-hidden')).toBeNull();
    expect(detailsPane?.getAttribute('aria-hidden')).toBe('true');
    expect(detailsPane?.hasAttribute('inert')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.feedback-host__tempo-trend--standalone'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.feedback-host__tempo-trend-icon')?.textContent?.trim(),
    ).toBe('🙂');

    const detailsButton = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.feedback-host__tempo-view-button',
      ),
    ).find((button) => button.textContent?.includes('Details'));
    detailsButton?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.feedback-host__tempo-strip')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('9 Teilnehmende im Barometer');
    expect(
      fixture.nativeElement.querySelector('.feedback-host__tempo-strip-icon')?.textContent?.trim(),
    ).toBe('🙂');
    expect(fixture.nativeElement.querySelector('.feedback-host__bars')).toBeTruthy();
    expect(trendPane?.getAttribute('aria-hidden')).toBe('true');
    expect(detailsPane?.getAttribute('aria-hidden')).toBeNull();
    expect(fixture.nativeElement.querySelector('.feedback-host__tempo-trend')).not.toBeNull();
    fixture.destroy();
  });

  it('öffnet die Tempo-Hilfe modal in Details und Tendenz', async () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'TEMPO',
      locked: false,
      totalVotes: 3,
      distribution: { SPEED_UP: 0, FOLLOWING: 3, SLOW_DOWN: 0, LOST: 0 },
      tempoTrend: {
        status: 'FOLLOWING',
        active: true,
        activeParticipants: 3,
        tempoVotes: 3,
        requiredVotes: 3,
        windowSeconds: 60,
        bucketSeconds: 15,
      },
    });
    fixture.detectChanges();

    const detailHelp = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.feedback-host__tempo-details-help .feedback-host__tempo-help-button',
    );
    expect(detailHelp?.getAttribute('aria-label')).toBe('Tempo-Barometer erklären');
    detailHelp?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.feedback-host__tempo-help')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Schweigen gilt als Zustimmung');
    expect(fixture.nativeElement.textContent).toContain('ab drei Aktiven');
    expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    expect(
      (fixture.nativeElement.querySelector('.feedback-host') as HTMLElement).hasAttribute('inert'),
    ).toBe(true);

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('.feedback-host__tempo-help-actions button')
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(fixture.nativeElement.querySelector('.feedback-host__tempo-help')).toBeNull();
    expect(document.activeElement).toBe(detailHelp);

    comp.tempoViewMode.set('trend');
    fixture.detectChanges();

    const trendHelp = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.feedback-host__tempo-trend-heading .feedback-host__tempo-help-button',
    );
    expect(trendHelp?.getAttribute('aria-label')).toBe('Tempo-Barometer erklären');
    trendHelp?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.feedback-host__tempo-help')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.feedback-host__tempo-help')).toBeNull();
    fixture.destroy();
  });

  it('zeigt im Sterne-Vergleich die Durchschnittswerte beider Runden', () => {
    const fixture = TestBed.createComponent(FeedbackHostComponent);
    const comp = fixture.componentInstance;
    comp.result.set({
      type: 'STARS',
      locked: false,
      currentRound: 2,
      totalVotes: 3,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 2 },
      round1Total: 2,
      round1Distribution: { '1': 1, '2': 0, '3': 1, '4': 0, '5': 0 },
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Durchschnitt Runde 1');
    expect(text).toContain('2,0 / 5');
    expect(text).toContain('Durchschnitt Runde 2');
    expect(text).toContain('4,7 / 5');
    expect(text).toContain('star_half');
    expect(text).toContain('1 (50');
    expect(text).toContain('2 (67');
  });
});
