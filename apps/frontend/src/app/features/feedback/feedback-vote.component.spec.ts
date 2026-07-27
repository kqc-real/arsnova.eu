import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackVoteComponent } from './feedback-vote.component';
import { ThemePresetService } from '../../core/theme-preset.service';

const {
  getInfoQueryMock,
  quickFeedbackIsActiveQueryMock,
  quickFeedbackResultsQueryMock,
  quickFeedbackVoteMutateMock,
  quickFeedbackLeaveTempoMutateMock,
  quickFeedbackOnResultsSubscribeMock,
} = vi.hoisted(() => ({
  getInfoQueryMock: vi.fn(),
  quickFeedbackIsActiveQueryMock: vi.fn(),
  quickFeedbackResultsQueryMock: vi.fn(),
  quickFeedbackVoteMutateMock: vi.fn(),
  quickFeedbackLeaveTempoMutateMock: vi.fn(),
  quickFeedbackOnResultsSubscribeMock: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    session: {
      getInfo: { query: getInfoQueryMock },
    },
    quickFeedback: {
      isActive: { query: quickFeedbackIsActiveQueryMock },
      results: { query: quickFeedbackResultsQueryMock },
      vote: { mutate: quickFeedbackVoteMutateMock },
      leaveTempo: { mutate: quickFeedbackLeaveTempoMutateMock },
      onResults: { subscribe: quickFeedbackOnResultsSubscribeMock },
    },
  },
}));

describe('FeedbackVoteComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light', 'preset-playful');
    getInfoQueryMock.mockRejectedValue(new Error('not found'));
    quickFeedbackIsActiveQueryMock.mockResolvedValue({ active: true });
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'YESNO',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { YES: 0, NO: 0, MAYBE: 0 },
      currentRound: 1,
    });
    quickFeedbackVoteMutateMock.mockResolvedValue({});
    quickFeedbackLeaveTempoMutateMock.mockResolvedValue({ ok: true });

    TestBed.configureTestingModule({
      imports: [FeedbackVoteComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
      ],
    });
  });

  it('leitet standalone Feedback-Routen für laufende Quiz-Sessions in den Session-Vote-Flow um', async () => {
    quickFeedbackIsActiveQueryMock.mockResolvedValueOnce({
      active: true,
      sessionType: 'QUIZ',
      sessionStatus: 'ACTIVE',
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentRef.setInput('sessionCode', 'ABC123');

    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(quickFeedbackIsActiveQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionCode: 'ABC123', anonymousClientId: expect.any(String) }),
    );
    expect(getInfoQueryMock).not.toHaveBeenCalled();
    expect(quickFeedbackResultsQueryMock).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/session/ABC123/vote?tab=quickFeedback', {
      replaceUrl: true,
    });
    fixture.destroy();
  });

  it('zeigt eine vorhandene standalone Redis-Runde, wenn keine gleichnamige Session existiert', async () => {
    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentRef.setInput('sessionCode', 'ABC123');

    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(quickFeedbackIsActiveQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionCode: 'ABC123', anonymousClientId: expect.any(String) }),
    );
    expect(getInfoQueryMock).not.toHaveBeenCalled();
    expect(quickFeedbackResultsQueryMock).toHaveBeenCalledWith({ sessionCode: 'ABC123' });
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent ?? '').toContain('Ja · Nein · Vielleicht');
    fixture.destroy();
  });

  it('zeigt bei beendeter Redis-Runde trotz gleichnamiger FINISHED-Quiz-Session keine Session-Bewertung', async () => {
    quickFeedbackResultsQueryMock.mockRejectedValueOnce(new Error('not found'));
    quickFeedbackIsActiveQueryMock.mockResolvedValueOnce({
      active: false,
      sessionType: 'QUIZ',
      sessionStatus: 'FINISHED',
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentRef.setInput('sessionCode', 'ABC123');

    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(quickFeedbackIsActiveQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionCode: 'ABC123', anonymousClientId: expect.any(String) }),
    );
    expect(getInfoQueryMock).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
    expect(text).toContain('Feedback-Runde nicht gefunden oder abgelaufen.');
    expect(text).toContain('Zur Startseite');
    expect(text).not.toContain('Bewertung absenden');
    expect(text).not.toContain('Die Session ist beendet.');
    fixture.destroy();
  });

  it('lädt eingebettetes Blitzlicht nach gesetztem Session-Code-Input', async () => {
    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('participantId', 'participant-1');
    fixture.componentRef.setInput('participantName', 'Ada');
    fixture.componentRef.setInput('participantAvatar', '🦊');
    fixture.componentRef.setInput('participantTeamName', 'Team Blau');
    fixture.componentRef.setInput('sessionTitle', 'Demo-Session');
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.componentRef.setInput('showSessionCode', false);

    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(quickFeedbackResultsQueryMock).toHaveBeenCalledWith({ sessionCode: 'ABC123' });
    expect(text).toContain('Demo-Session');
    expect(text).toContain('ABC123');
    expect(text).toContain('🦊');
    expect(text).toContain('Team Blau');
    const context = fixture.nativeElement.querySelector('.feedback-vote__context');
    expect(context?.getAttribute('aria-label')).toContain('Ada');
    expect(text).toContain('Ja · Nein · Vielleicht');
    fixture.destroy();
  });

  it('blendet die anonyme Fallback-Identität im Vote-Kontext aus', async () => {
    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('participantId', 'participant-1');
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.componentRef.setInput('showSessionCode', false);

    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('ABC123');
    expect(text).not.toContain('Ansicht');
    expect(text).not.toContain('Teilnehmende Person');
    const context = fixture.nativeElement.querySelector('.feedback-vote__context');
    expect(context?.getAttribute('aria-label')).toContain('Teilnehmeransicht');
    expect(context?.querySelector('.feedback-vote__context-item dt mat-icon')).toBeNull();
    fixture.destroy();
  });

  it('übernimmt einen Typwechsel per Live-Subscription sofort', async () => {
    quickFeedbackOnResultsSubscribeMock.mockImplementationOnce(
      (
        _input,
        opts: {
          onData: (result: {
            type: 'STARS';
            locked: false;
            discussion: false;
            totalVotes: 0;
            distribution: { 1: 0; 2: 0; 3: 0; 4: 0; 5: 0 };
            currentRound: 1;
          }) => void;
        },
      ) => {
        setTimeout(() => {
          opts.onData({
            type: 'STARS',
            locked: false,
            discussion: false,
            totalVotes: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            currentRound: 1,
          });
        }, 0);
        return { unsubscribe: vi.fn() };
      },
    );

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(quickFeedbackOnResultsSubscribeMock).toHaveBeenCalledWith(
      { sessionCode: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(text).toContain('Sterne');
    const starButtons = fixture.nativeElement.querySelectorAll('.feedback-vote__star-btn');
    expect(starButtons).toHaveLength(5);
    fixture.destroy();
  });

  it('sperrt die Stern-Buttons während die Stimme übertragen wird', async () => {
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'STARS',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      currentRound: 1,
    });
    let resolveVote: (() => void) | null = null;
    quickFeedbackVoteMutateMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveVote = resolve;
        }),
    );

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const starButtons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.feedback-vote__star-btn'),
    );
    expect(starButtons).toHaveLength(5);

    starButtons[2].click();
    fixture.detectChanges();

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(1);
    expect(starButtons.every((button) => button.disabled)).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.feedback-vote__panel')?.getAttribute('aria-busy'),
    ).toBe('true');

    starButtons[3].click();
    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(1);

    resolveVote?.();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent ?? '').toContain('Danke für dein Feedback!');
    fixture.destroy();
  });

  it('kennzeichnet Danke- und Pausenstatus als Live-Regionen', async () => {
    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    fixture.componentInstance.voted.set(true);
    fixture.detectChanges();
    let statusCard = fixture.nativeElement.querySelector('.feedback-vote__card');
    expect(statusCard?.getAttribute('role')).toBe('status');
    expect(statusCard?.getAttribute('aria-live')).toBe('polite');
    expect(statusCard?.getAttribute('aria-atomic')).toBe('true');

    fixture.componentInstance.voted.set(false);
    fixture.componentInstance.locked.set(true);
    fixture.detectChanges();
    statusCard = fixture.nativeElement.querySelector('.feedback-vote__card');
    expect(statusCard?.getAttribute('role')).toBe('status');
    expect(statusCard?.getAttribute('aria-live')).toBe('polite');
    expect(statusCard?.getAttribute('aria-atomic')).toBe('true');
    fixture.destroy();
  });

  it('zeigt Wahr/Falsch/Weiß nicht als Abstimmungsoptionen an', async () => {
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'TRUEFALSE_UNKNOWN',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { TRUE: 0, FALSE: 0, UNKNOWN: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Wahr · Falsch · Weiß nicht');
    expect(text).toContain('Wahr');
    expect(text).toContain('Falsch');
    expect(text).toContain('Weiß nicht');
    const positiveIcon = fixture.nativeElement.querySelector('.feedback-vote__mood-icon--positive');
    const negativeIcon = fixture.nativeElement.querySelector('.feedback-vote__mood-icon--negative');
    expect(positiveIcon?.textContent).toContain('check_circle');
    expect(negativeIcon?.textContent).toContain('cancel');
    fixture.destroy();
  });

  it('laesst Tempo-Auswahlen vom Default aus wechseln und per Re-Tap zuruecksetzen', async () => {
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.feedback-vote__mood-btn'),
    );
    const following = buttons.find((button) => button.textContent?.includes('Ich folge'));
    const faster = buttons.find((button) => button.textContent?.includes('Schneller'));
    expect(buttons).toHaveLength(4);
    expect(following).toBeTruthy();
    expect(faster).toBeTruthy();
    expect(following!.getAttribute('aria-pressed')).toBe('true');
    expect(following!.classList.contains('feedback-vote__mood-btn--tempo-active')).toBe(true);
    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(1);
    expect(quickFeedbackVoteMutateMock).toHaveBeenLastCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'FOLLOWING',
    });

    following!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent ?? '').not.toContain('Danke für dein Feedback!');
    expect(following!.getAttribute('aria-pressed')).toBe('true');

    faster!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(2);
    expect(quickFeedbackVoteMutateMock).toHaveBeenLastCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'SPEED_UP',
    });
    expect(faster!.getAttribute('aria-pressed')).toBe('true');
    expect(faster!.classList.contains('feedback-vote__mood-btn--tempo-active')).toBe(true);
    expect(following!.getAttribute('aria-pressed')).toBe('false');

    faster!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(3);
    expect(quickFeedbackVoteMutateMock).toHaveBeenLastCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'FOLLOWING',
    });
    expect(following!.getAttribute('aria-pressed')).toBe('true');
    expect(following!.classList.contains('feedback-vote__mood-btn--tempo-active')).toBe(true);
    expect(faster!.getAttribute('aria-pressed')).toBe('false');
    expect(faster!.classList.contains('feedback-vote__mood-btn--tempo-active')).toBe(false);
    fixture.destroy();
  });

  it('entfernt Standalone-Tempo-Auswahlen beim Verlassen nach der Default-Registrierung', async () => {
    let resolveDefaultRegistration: (() => void) | null = null;
    quickFeedbackVoteMutateMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDefaultRegistration = resolve;
        }),
    );
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'FOLLOWING',
    });

    fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(quickFeedbackLeaveTempoMutateMock).not.toHaveBeenCalled();

    resolveDefaultRegistration?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(quickFeedbackLeaveTempoMutateMock).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
    });
  });

  it('entfernt eingebettete Tempo-Auswahlen beim Verlassen nicht per Standalone-Cleanup', async () => {
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.componentRef.setInput('participantId', 'participant-1');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      voterId: 'participant-1',
      value: 'FOLLOWING',
    });

    fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(quickFeedbackLeaveTempoMutateMock).not.toHaveBeenCalled();
  });

  it('nutzt im eingebetteten Tempo-Blitzlicht ohne Participant-ID keine Standalone-ID', async () => {
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.feedback-vote__mood-btn'),
    );
    const faster = buttons.find((button) => button.textContent?.includes('Schneller'));
    faster?.click();
    await fixture.whenStable();

    expect(quickFeedbackVoteMutateMock).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('setzt Tempo-Auswahlen per Viewport-Backdrop zurueck', async () => {
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.feedback-vote__mood-btn'),
    );
    const following = buttons.find((button) => button.textContent?.includes('Ich folge'));
    const slower = buttons.find((button) => button.textContent?.includes('Langsamer'));

    expect(following).toBeTruthy();
    expect(slower).toBeTruthy();
    expect(following!.getAttribute('aria-pressed')).toBe('true');
    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(1);
    expect(quickFeedbackVoteMutateMock).toHaveBeenLastCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'FOLLOWING',
    });

    slower!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(2);
    expect(quickFeedbackVoteMutateMock).toHaveBeenLastCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'SLOW_DOWN',
    });
    expect(slower!.getAttribute('aria-pressed')).toBe('true');
    expect(following!.getAttribute('aria-pressed')).toBe('false');

    document.body.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledTimes(3);
    expect(quickFeedbackVoteMutateMock).toHaveBeenLastCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'FOLLOWING',
    });
    expect(following!.getAttribute('aria-pressed')).toBe('true');
    expect(following!.classList.contains('feedback-vote__mood-btn--tempo-active')).toBe(true);
    expect(slower!.getAttribute('aria-pressed')).toBe('false');
    expect(slower!.classList.contains('feedback-vote__mood-btn--tempo-active')).toBe(false);
    fixture.destroy();
  });

  it('verwirft stale Tempo-Abweichungen nach einem Reset', async () => {
    localStorage.setItem('qf-tempo-selection:ABC123', 'SLOW_DOWN');
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'TEMPO',
      locked: false,
      discussion: false,
      totalVotes: 3,
      distribution: { SPEED_UP: 0, FOLLOWING: 3, SLOW_DOWN: 0, LOST: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.feedback-vote__mood-btn'),
    );
    const following = buttons.find((button) => button.textContent?.includes('Ich folge'));
    const slower = buttons.find((button) => button.textContent?.includes('Langsamer'));

    expect(following?.getAttribute('aria-pressed')).toBe('true');
    expect(slower?.getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('qf-tempo-selection:ABC123')).toBeNull();
    expect(quickFeedbackVoteMutateMock).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      voterId: expect.any(String),
      value: 'FOLLOWING',
    });
    fixture.destroy();
  });

  it('laesst lokales Vote-Theme und Preset auch bei alten Host-Style-Feldern unveraendert', async () => {
    quickFeedbackResultsQueryMock.mockResolvedValueOnce({
      type: 'YESNO',
      theme: 'light',
      preset: 'serious',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { YES: 0, NO: 0, MAYBE: 0 },
      currentRound: 1,
    } as never);
    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setTheme('dark');
    themePreset.setPreset('spielerisch');

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(themePreset.theme()).toBe('dark');
    expect(themePreset.preset()).toBe('spielerisch');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('preset-playful')).toBe(true);
    fixture.destroy();
  });

  it('zeigt bei abgelaufener Runde einen direkten Link zur Startseite', async () => {
    quickFeedbackResultsQueryMock.mockRejectedValueOnce(
      new Error('NOT_FOUND: Feedback-Runde nicht gefunden oder abgelaufen.'),
    );

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Feedback-Runde nicht gefunden oder abgelaufen.');
    expect(text).toContain('Zur Startseite');
    expect(quickFeedbackOnResultsSubscribeMock).not.toHaveBeenCalled();
    expect(
      (fixture.componentInstance as unknown as { pollTimer: ReturnType<typeof setInterval> | null })
        .pollTimer,
    ).toBeNull();
    fixture.destroy();
  });

  it('zeigt bei geschlossenem Sitzungskanal den passenden Hinweis', async () => {
    quickFeedbackResultsQueryMock.mockRejectedValueOnce(
      new Error('Der Blitzlicht-Kanal ist aktuell geschlossen.'),
    );

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain(
      'Der Blitzlicht-Kanal wurde von der Lehrperson geschlossen. Neue Abstimmungen sind gerade nicht möglich.',
    );
    expect(text).toContain('Zur Startseite');
    fixture.destroy();
  });

  it('meldet eine beendete Standalone-Runde nach einem zuvor aktiven Poll', async () => {
    quickFeedbackResultsQueryMock
      .mockResolvedValueOnce({
        type: 'YESNO',
        locked: false,
        discussion: false,
        totalVotes: 0,
        distribution: { YES: 0, NO: 0, MAYBE: 0 },
        currentRound: 1,
      })
      .mockRejectedValueOnce(
        new Error('NOT_FOUND: Feedback-Runde nicht gefunden oder abgelaufen.'),
      );

    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent ?? '').toContain('Vielleicht');

    await (fixture.componentInstance as unknown as { pollStyle(): Promise<void> }).pollStyle();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Feedback-Runde nicht gefunden oder abgelaufen.');
    expect(text).toContain('Zur Startseite');
    expect(
      (fixture.componentInstance as unknown as { pollTimer: ReturnType<typeof setInterval> | null })
        .pollTimer,
    ).toBeNull();
    fixture.destroy();
  });
});
