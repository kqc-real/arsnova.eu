import { SessionMusicService } from '../session-music.service';
import { SessionUnloadWarningService } from '../session-unload-warning.service';
import { getSkewAdjustedNow, resetServerClockSkew } from '../session-server-clock';
import { SoundService } from '../../../core/sound.service';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SessionPresentComponent } from './session-present.component';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { getQaWordCloudQuestionWeight } from './word-cloud-weight.util';
import { NICKNAME_LISTS } from '../../join/nickname-themes';

const {
  liveQueryMock,
  setPresenterSurfaceMutateMock,
  revealAnswersMutateMock,
  revealResultsMutateMock,
  startDiscussionMutateMock,
  startSecondRoundMutateMock,
  nextQuestionMutateMock,
  pauseQuizMutateMock,
  resumeQuizMutateMock,
  getInfoQueryMock,
  getLeaderboardQueryMock,
  getTeamLeaderboardQueryMock,
  getParticipantSummaryQueryMock,
  getTeamsQueryMock,
  getParticipantNicknamesQueryMock,
  qaListQueryMock,
  setPresenterSortModeMutateMock,
  quickFeedbackResultsQueryMock,
  getCurrentQuestionForHostQueryMock,
  getHostVoteProgressQueryMock,
  getReactionsQueryMock,
  getQaWordCloudProjectionQueryMock,
  getFreetextWordCloudProjectionQueryMock,
  setFreetextWordCloudEntryVisibilityMock,
  setFreetextWordCloudProjectionMutateMock,
  analyzeWordCloudMutateMock,
  subscribeMock,
} = vi.hoisted(() => ({
  liveQueryMock: vi.fn(),
  setFreetextWordCloudEntryVisibilityMock: vi.fn(),
  setPresenterSurfaceMutateMock: vi.fn(),
  revealAnswersMutateMock: vi.fn(),
  revealResultsMutateMock: vi.fn(),
  startDiscussionMutateMock: vi.fn(),
  startSecondRoundMutateMock: vi.fn(),
  nextQuestionMutateMock: vi.fn(),
  pauseQuizMutateMock: vi.fn(),
  resumeQuizMutateMock: vi.fn(),
  getInfoQueryMock: vi.fn(),
  getLeaderboardQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  getParticipantSummaryQueryMock: vi.fn(),
  getTeamsQueryMock: vi.fn(),
  getParticipantNicknamesQueryMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  setPresenterSortModeMutateMock: vi.fn(),
  quickFeedbackResultsQueryMock: vi.fn(),
  getCurrentQuestionForHostQueryMock: vi.fn(),
  getHostVoteProgressQueryMock: vi.fn(),
  getReactionsQueryMock: vi.fn(),
  getQaWordCloudProjectionQueryMock: vi.fn(),
  getFreetextWordCloudProjectionQueryMock: vi.fn(),
  setFreetextWordCloudProjectionMutateMock: vi.fn(),
  analyzeWordCloudMutateMock: vi.fn(),
  subscribeMock: vi.fn((_input: never, _opts: never) => ({ unsubscribe: vi.fn() })),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      setPresenterSurface: { mutate: setPresenterSurfaceMutateMock },
      revealAnswers: { mutate: revealAnswersMutateMock },
      revealResults: { mutate: revealResultsMutateMock },
      startDiscussion: { mutate: startDiscussionMutateMock },
      startSecondRound: { mutate: startSecondRoundMutateMock },
      nextQuestion: { mutate: nextQuestionMutateMock },
      pauseQuiz: { mutate: pauseQuizMutateMock },
      resumeQuiz: { mutate: resumeQuizMutateMock },
      getInfo: {
        query: getInfoQueryMock,
      },
      getInfoForReconnect: {
        query: getInfoQueryMock,
      },
      getLeaderboard: {
        query: getLeaderboardQueryMock,
      },
      getTeamLeaderboard: {
        query: getTeamLeaderboardQueryMock,
      },
      getParticipantSummary: {
        query: getParticipantSummaryQueryMock,
      },
      getTeams: {
        query: getTeamsQueryMock,
      },
      getParticipantNicknames: {
        query: getParticipantNicknamesQueryMock,
      },
      getLiveFreetext: {
        query: liveQueryMock,
      },
      setFreetextWordCloudEntryVisibility: { mutate: setFreetextWordCloudEntryVisibilityMock },
      getCurrentQuestionForHost: {
        query: getCurrentQuestionForHostQueryMock,
      },
      getHostVoteProgress: {
        query: getHostVoteProgressQueryMock,
      },
      getReactions: {
        query: getReactionsQueryMock,
      },
      getQaWordCloudProjection: {
        query: getQaWordCloudProjectionQueryMock,
      },
      getFreetextWordCloudProjection: {
        query: getFreetextWordCloudProjectionQueryMock,
      },
      setFreetextWordCloudProjection: {
        mutate: setFreetextWordCloudProjectionMutateMock,
      },
      onCurrentQuestionForHostChanged: {
        subscribe: subscribeMock,
      },
      onHostVoteProgressChanged: {
        subscribe: subscribeMock,
      },
      onStatusChanged: {
        subscribe: subscribeMock,
      },
    },
    wordCloud: {
      analyze: {
        mutate: analyzeWordCloudMutateMock,
      },
    },
    qa: {
      presentProjection: {
        query: qaListQueryMock,
      },
      setPresenterSortMode: {
        mutate: setPresenterSortModeMutateMock,
      },
    },
    quickFeedback: {
      results: {
        query: quickFeedbackResultsQueryMock,
      },
    },
  },
}));

const MOCK_SERVER_TIME = '2026-03-24T12:00:00.000Z';
const TIMED_PRESENTER_QUESTION = {
  questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
  text: 'Was war hilfreich?',
  type: 'SINGLE_CHOICE',
  difficulty: 'MEDIUM',
  order: 0,
  currentRound: 1,
  answers: [],
};

function wordCloudEntry(label: string, key: string, confidence: number | null = null) {
  return {
    key,
    label,
    count: 1,
    members: [{ sourceId: 'response-0', text: label, weight: 1 }],
    variants: [label],
    confidence,
  };
}

function expectNoHostControls(root: HTMLElement): void {
  const forbiddenSelectors = [
    'app-session-host',
    'app-feedback-host',
    '.session-host',
    '.session-channel-tabs',
    '[data-testid^="host-"]',
  ];
  for (const selector of forbiddenSelectors) {
    expect(root.querySelector(selector), `Unerlaubte Host-Steuerung: ${selector}`).toBeNull();
  }
}

describe('SessionPresentComponent', () => {
  afterEach(() => {
    liveQueryMock.mockClear();
    getCurrentQuestionForHostQueryMock.mockClear();
    getHostVoteProgressQueryMock.mockClear();
  });

  beforeEach(() => {
    getInfoQueryMock.mockClear();
    setPresenterSurfaceMutateMock.mockReset();
    setPresenterSortModeMutateMock.mockReset();
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
    });
    getLeaderboardQueryMock.mockResolvedValue([]);
    getTeamLeaderboardQueryMock.mockResolvedValue([]);
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 0,
      connectedCount: 0,
      revision: 0,
      recentArrivals: [],
    });
    getTeamsQueryMock.mockResolvedValue({ teams: [], teamCount: 0 });
    getParticipantNicknamesQueryMock.mockResolvedValue({ nicknames: [], participantCount: 0 });
    qaListQueryMock.mockResolvedValue([]);
    quickFeedbackResultsQueryMock.mockRejectedValue(new Error('not found'));
    liveQueryMock.mockResolvedValue({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      questionOrder: 1,
      questionType: 'FREETEXT',
      questionText: 'Was war hilfreich?',
      responses: ['Klare Struktur'],
      updatedAt: '2026-03-08T12:00:00.000Z',
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(null);
    getHostVoteProgressQueryMock.mockResolvedValue(null);
    getReactionsQueryMock.mockResolvedValue({ reactions: {}, total: 0 });
    getQaWordCloudProjectionQueryMock.mockResolvedValue({ projection: null });
    getFreetextWordCloudProjectionQueryMock.mockResolvedValue({ projection: null });
    setFreetextWordCloudProjectionMutateMock.mockReset();
    setFreetextWordCloudProjectionMutateMock.mockResolvedValue({ ok: true });
    analyzeWordCloudMutateMock.mockReset();
    analyzeWordCloudMutateMock.mockResolvedValue({
      mode: 'SEMANTIC',
      status: 'ready',
      fallbackUsed: false,
      entries: [
        {
          key: 'struktur',
          label: 'Struktur',
          count: 2,
          members: [{ sourceId: 'response-0', text: 'Klare Struktur', weight: 1 }],
          variants: ['Struktur'],
          confidence: 0.9,
        },
      ],
    });
    subscribeMock.mockClear();
    subscribeMock.mockReturnValue({ unsubscribe: vi.fn() });

    TestBed.configureTestingModule({
      imports: [SessionPresentComponent],
      providers: [
        SessionMusicService,
        SessionUnloadWarningService,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            parent: {
              snapshot: {
                paramMap: convertToParamMap({ code: 'ABC123' }),
              },
            },
          },
        },
      ],
    });
    TestBed.inject(ThemePresetService).setPreset('spielerisch', { silent: true });
  });

  it('behält beim Ansichtswechsel die Tab-Warnung bis zum Ende der Abstimmung', async () => {
    const warning = TestBed.inject(SessionUnloadWarningService);
    Object.defineProperty(warning, 'enabled', { value: true });
    // Die Session-Shell behält den bereits aktiven Host-Schutz bis zum Presenter-Snapshot.
    warning.sync('ABC123', 'ACTIVE');
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);

    await fixture.whenStable();
    fixture.detectChanges();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(false);

    fixture.componentInstance.session.update(
      (session) => session && { ...session, status: 'FINISHED' },
    );
    fixture.detectChanges();
    expect(window.dispatchEvent(new Event('beforeunload', { cancelable: true }))).toBe(true);
    fixture.destroy();
  });

  it.each([false, true])(
    'übernimmt den laufenden Countdown mit Gong im Host: %s',
    async (gongInHost) => {
      const music = TestBed.inject(SessionMusicService);
      const sound = TestBed.inject(SoundService);
      const play = vi.spyOn(sound, 'play').mockResolvedValue();
      vi.spyOn(sound, 'preload').mockResolvedValue();
      getInfoQueryMock.mockResolvedValue({
        ...(await getInfoQueryMock()),
        currentQuestion: 0,
        currentRound: 1,
        enableSoundEffects: true,
      });

      // Host und Presenter beziehen denselben Countdown von der Session-Shell.
      music.enter('ABC123');
      const fixture = TestBed.createComponent(SessionPresentComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const component = fixture.componentInstance;
      await vi.waitFor(() => expect(component['musicReady']()).toBe(true));
      component['stopPolling']();
      const remaining = gongInHost ? 7 : 9;
      const startedAt = getSkewAdjustedNow() - (30.5 - remaining) * 1_000;
      const deadline = music.resolveCountdownDeadline('ABC123', {
        timerSeconds: 30,
        activeAt: new Date(startedAt).toISOString(),
        currentDeadlineMs: null,
        currentKey: null,
        nextKey: '0:1:30',
        nowMs: startedAt,
      });
      music.tickCountdown('ABC123', deadline, remaining, true);
      expect(play).toHaveBeenCalledTimes(gongInHost ? 1 : 0);
      getCurrentQuestionForHostQueryMock.mockResolvedValue({
        ...TIMED_PRESENTER_QUESTION,
        timer: 30,
      });

      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      try {
        await component['refreshHostQuestion']();
        expect(component.countdownSeconds()).toBe(remaining);
        await vi.advanceTimersByTimeAsync(remaining * 1_000);
        expect(component.countdownSeconds()).toBe(0);
        expect(play.mock.calls.map(([key]) => key)).toEqual(['countdownEnd', 'sessionEnd']);
      } finally {
        fixture.destroy();
        vi.useRealTimers();
      }
    },
  );

  it('bleibt bei HTTP-Fragenabruf ohne Status-Stream stumm', async () => {
    resetServerClockSkew();
    const sound = TestBed.inject(SoundService);
    const play = vi.spyOn(sound, 'play').mockResolvedValue();
    getInfoQueryMock.mockResolvedValue({
      ...(await getInfoQueryMock()),
      serverTime: new Date().toISOString(),
      currentQuestion: 0,
      currentRound: 1,
      enableSoundEffects: true,
    });
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    await vi.waitFor(() => expect(component['musicReady']()).toBe(true));
    component['stopPolling']();
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      ...TIMED_PRESENTER_QUESTION,
      timer: 5,
    });

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      await component['refreshHostQuestion']();
      expect(component.countdownSeconds()).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(6_000);
      expect(component.countdownSeconds()).toBe(0);
      expect(play).not.toHaveBeenCalled();

      const expiredStart = new Date(getSkewAdjustedNow() - 10_000).toISOString();
      component['syncCountdownFromStatus'](5, expiredStart);
      expect(play).not.toHaveBeenCalled();
    } finally {
      fixture.destroy();
      vi.useRealTimers();
      resetServerClockSkew();
    }
  });

  it('übernimmt die Blitzlichtmusik einer Q&A-Session und stoppt sie beim Pausieren', async () => {
    const music = TestBed.inject(SessionMusicService);
    const sound = TestBed.inject(SoundService);
    const play = vi.spyOn(sound, 'playMusic').mockResolvedValue();
    const stop = vi.spyOn(sound, 'stopMusic').mockImplementation(() => {});
    getInfoQueryMock.mockResolvedValue({
      ...(await getInfoQueryMock()),
      type: 'Q_AND_A',
      status: 'LOBBY',
      preferredChannel: 'quickFeedback',
      channels: {
        quiz: { enabled: false },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    const feedback = {
      type: 'YESNO' as const,
      locked: false,
      totalVotes: 0,
      distribution: { YES: 0, NO: 0, MAYBE: 0 },
      currentRound: 1,
    };
    quickFeedbackResultsQueryMock.mockResolvedValue(feedback);
    music.enter('ABC123');
    music.quickFeedbackMusicEnabled.set(true);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(play).toHaveBeenCalledWith('LOBBY_2');
    });
    stop.mockClear();
    fixture.componentInstance.quickFeedbackResult.set({ ...feedback, locked: true });
    fixture.detectChanges();
    expect(stop).toHaveBeenCalled();
    fixture.destroy();
  });

  it('folgt im Presenter der Quizphase, der Stummschaltung und dem Session-Ende', async () => {
    const music = TestBed.inject(SessionMusicService);
    const sound = TestBed.inject(SoundService);
    const play = vi.spyOn(sound, 'playMusic').mockResolvedValue();
    const stop = vi.spyOn(sound, 'stopMusic').mockImplementation(() => {});
    getInfoQueryMock.mockResolvedValue({ ...(await getInfoQueryMock()), status: 'LOBBY' });
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(play).toHaveBeenCalledWith('LOBBY_2');
    });

    const component = fixture.componentInstance;
    component.session.update((session) => session && { ...session, status: 'QUESTION_OPEN' });
    fixture.detectChanges();
    expect(play).toHaveBeenLastCalledWith('READING_0');

    stop.mockClear();
    music.musicMuted.set(true);
    fixture.detectChanges();
    expect(stop).toHaveBeenCalled();
    play.mockClear();
    component.session.update((session) => session && { ...session, status: 'ACTIVE' });
    fixture.detectChanges();
    expect(play).not.toHaveBeenCalled();

    music.musicMuted.set(false);
    fixture.detectChanges();
    expect(play).toHaveBeenCalledWith('COUNTDOWN_1');
    stop.mockClear();
    component.session.update((session) => session && { ...session, status: 'FINISHED' });
    fixture.detectChanges();
    expect(stop).toHaveBeenCalled();
    fixture.destroy();
  });

  it('startet nach Zerstörung während des ersten Ladens weder Polling noch Subscriptions', async () => {
    const session = await getInfoQueryMock();
    let resolveInfo: (value: unknown) => void = () => undefined;
    getInfoQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInfo = resolve;
        }),
    );
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(getInfoQueryMock).toHaveBeenCalledTimes(2));
    // Navigation weg von der Präsentation, bevor die Session-Daten ankommen.
    fixture.destroy();
    const intervalsAtDestroy = setIntervalSpy.mock.calls.length;
    const subscriptionsAtDestroy = subscribeMock.mock.calls.length;
    resolveInfo(session);
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(setIntervalSpy.mock.calls.length).toBe(intervalsAtDestroy);
    expect(subscribeMock.mock.calls.length).toBe(subscriptionsAtDestroy);
    setIntervalSpy.mockRestore();
  });

  it('startet nach Zerstörung während des Leaderboard-Ladens kein Board-Intervall', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Großes Quiz',
      title: null,
      participantCount: 24,
      teamMode: false,
      finishProjection: 'leaderboard',
    });
    let resolveLeaderboard: (value: unknown) => void = () => undefined;
    getLeaderboardQueryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLeaderboard = resolve;
        }),
    );
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(getLeaderboardQueryMock).toHaveBeenCalled());
    // Präsentation verlassen, während die Abschluss-Leaderboards noch laden.
    fixture.destroy();
    const intervalsAtDestroy = setIntervalSpy.mock.calls.length;
    resolveLeaderboard(
      Array.from({ length: 24 }, (_, index) => ({
        rank: index + 1,
        nickname: `Spieler ${index + 1}`,
        totalScore: 240 - index * 5,
        correctCount: 12,
        totalQuestions: 12,
        totalResponseTimeMs: 1000 + index * 80,
      })),
    );
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(setIntervalSpy.mock.calls.length).toBe(intervalsAtDestroy);
    expect(fixture.componentInstance.finishBoardsResolved()).toBe(false);
    setIntervalSpy.mockRestore();
  });

  it('startet nach Zerstörung während des Fragen-Abrufs keinen Countdown', async () => {
    let resolveQuestion: (value: unknown) => void = () => undefined;
    getCurrentQuestionForHostQueryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQuestion = resolve;
        }),
    );
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(getCurrentQuestionForHostQueryMock).toHaveBeenCalled());
    fixture.destroy();
    const intervalsAtDestroy = setIntervalSpy.mock.calls.length;
    resolveQuestion({
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 1,
      totalQuestions: 13,
      text: 'Was war hilfreich?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      showQuestionTypeIndicators: true,
      timer: 30,
      answers: [],
    });
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(setIntervalSpy.mock.calls.length).toBe(intervalsAtDestroy);
    setIntervalSpy.mockRestore();
  });

  it('retries a failed page measurement and ignores a delayed result from an old context', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(SessionPresentComponent);
    const component = fixture.componentInstance;
    const session = await getInfoQueryMock();
    component.session.set({ ...session, presenterPage: { context: 'first', index: 0, count: 1 } });
    getInfoQueryMock.mockImplementation(async () => component.session());
    setPresenterSurfaceMutateMock.mockRejectedValueOnce(new Error('offline'));
    setPresenterSurfaceMutateMock.mockResolvedValueOnce({
      presenterSurface: 'default',
      presenterPage: { context: 'first', index: 0, count: 3 },
    });
    try {
      await component.reportProjectionPages(3);
      expect(component.session()?.presenterPage?.count).toBe(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(component.session()?.presenterPage?.count).toBe(3);
      let resolve!: (result: unknown) => void;
      setPresenterSurfaceMutateMock.mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const pending = component.reportProjectionPages(4);
      component.session.update((current) => ({
        ...current!,
        presenterPage: { context: 'second', index: 0, count: 1 },
      }));
      resolve({
        presenterSurface: 'default',
        presenterPage: { context: 'first', index: 0, count: 4 },
      });
      await pending;
      expect(component.session()?.presenterPage).toEqual({ context: 'second', index: 0, count: 1 });
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it('zeigt nach beendetem Presenter einen eindeutigen Standby mit Sessioncode statt Quizinhalt', async () => {
    const endedSession = {
      ...(await getInfoQueryMock()),
      status: 'ACTIVE' as const,
      presenterSurface: 'ended' as const,
      presenterPage: { context: 'quiz:0:ACTIVE', index: 0, count: 3 },
    };
    getInfoQueryMock.mockResolvedValue(endedSession);
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const ended = fixture.nativeElement.querySelector(
      '[data-testid="presenter-presentation-ended"]',
    ) as HTMLElement | null;
    expect(ended?.getAttribute('role')).toBe('status');
    expect(ended?.textContent).toContain('Die Live-Projektion ist ausgeblendet.');
    expect(ended?.textContent).toContain('Das Quiz läuft weiter.');
    expect(ended?.textContent).toContain('Bitte warte auf weitere Anweisungen.');
    expect(ended?.textContent).toContain('ABC123');
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.projection-pages')).toBeNull();
    fixture.destroy();
  });

  it('leert die unauthentifizierte Projektion ohne Terminalevent am lokalen Deadline-Fallback', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(SessionPresentComponent);
    const component = fixture.componentInstance;
    component.session.set({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: '2026-09-15T08:00:00.000Z',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Quiz',
      title: null,
      participantCount: 2,
      teamMode: false,
    } as never);
    component.presenterQaOrderedQuestions.set([{ id: 'qa-1', text: 'Noch sichtbar' } as never]);
    component.quickFeedbackResult.set({ totalVotes: 1, options: [] } as never);
    component.freetextResponses.set(['Noch sichtbar']);
    component.hostQuestion.set({
      questionId: 'question-1',
      order: 0,
      totalQuestions: 1,
      text: 'Noch sichtbar',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      showQuestionTypeIndicators: true,
      answers: [],
    } as never);

    expect(
      (
        component as unknown as {
          applySessionDeadlineSnapshot(snapshot: {
            status: string;
            serverNow: string;
            expiresAt: string;
            sessionLifecycleRevision: number;
          }): boolean;
        }
      ).applySessionDeadlineSnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:00:00.000Z',
        expiresAt: '2026-09-15T08:00:01.000Z',
        sessionLifecycleRevision: 2,
      }),
    ).toBe(true);

    vi.advanceTimersByTime(1_000);

    expect(component.session()?.status).toBe('FINISHED');
    expect(component.presenterQaQuestions()).toEqual([]);
    expect(component.pinnedQaQuestion()).toBeNull();
    expect(component.quickFeedbackResult()).toBeNull();
    expect(component.freetextResponses()).toEqual([]);
    expect(component.hostQuestion()).toBeNull();
    fixture.destroy();
    vi.useRealTimers();
  });

  it('lässt den Presenter bei abgelehntem Vollbild bedienbar und erlaubt einen erneuten Versuch', async () => {
    const { DOCUMENT } = await import('@angular/common');
    const documentRef = TestBed.inject(DOCUMENT);
    const requestFullscreenSpy = vi.fn(() => Promise.resolve());
    requestFullscreenSpy.mockRejectedValueOnce(new Error('Fullscreen denied'));
    const previousDescriptor = Object.getOwnPropertyDescriptor(
      documentRef.documentElement,
      'requestFullscreen',
    );
    const previousEnabled = Object.getOwnPropertyDescriptor(documentRef, 'fullscreenEnabled');
    const previousElement = Object.getOwnPropertyDescriptor(documentRef, 'fullscreenElement');
    Object.defineProperty(documentRef.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenSpy,
    });
    Object.defineProperty(documentRef, 'fullscreenEnabled', {
      configurable: true,
      value: true,
    });
    let fullscreenElement: Element | null = null;
    Object.defineProperty(documentRef, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    try {
      const fixture = TestBed.createComponent(SessionPresentComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const fullscreenAction = fixture.nativeElement.querySelector(
        '[data-testid="presenter-fullscreen-enter"]',
      ) as HTMLButtonElement;
      const presenterSurface = fixture.nativeElement.querySelector(
        '[data-testid="presenter-surface"]',
      ) as HTMLElement;
      expect(fullscreenAction.textContent).toContain('Vollbild');
      expect(fullscreenAction.closest('[aria-modal="true"]')).toBeNull();
      expect(requestFullscreenSpy).not.toHaveBeenCalled();

      fullscreenAction.focus();
      fullscreenAction.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fullscreenAction.isConnected).toBe(true);
      expect(documentRef.activeElement).toBe(fullscreenAction);

      fullscreenAction.click();
      expect(requestFullscreenSpy).toHaveBeenCalledWith({ navigationUI: 'hide' });
      expect(requestFullscreenSpy).toHaveBeenCalledTimes(2);
      fullscreenElement = documentRef.documentElement;
      documentRef.dispatchEvent(new Event('fullscreenchange'));
      await Promise.resolve();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="presenter-fullscreen-enter"]'),
      ).toBeNull();
      expect(documentRef.activeElement).toBe(presenterSurface);

      const router = TestBed.inject(Router);
      const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const open = vi.spyOn(window, 'open');
      fullscreenElement = null;
      documentRef.dispatchEvent(new Event('fullscreenchange'));
      documentRef.dispatchEvent(new Event('webkitfullscreenchange'));
      await Promise.resolve();

      expect(navigateByUrlSpy).toHaveBeenCalledExactlyOnceWith('/session/ABC123/host');
      expect(open).not.toHaveBeenCalled();
      open.mockRestore();
      fixture.destroy();
    } finally {
      if (previousDescriptor) {
        Object.defineProperty(documentRef.documentElement, 'requestFullscreen', previousDescriptor);
      } else {
        delete (documentRef.documentElement as Partial<HTMLElement>).requestFullscreen;
      }
      if (previousEnabled) {
        Object.defineProperty(documentRef, 'fullscreenEnabled', previousEnabled);
      } else {
        Reflect.deleteProperty(documentRef, 'fullscreenEnabled');
      }
      if (previousElement) {
        Object.defineProperty(documentRef, 'fullscreenElement', previousElement);
      } else {
        Reflect.deleteProperty(documentRef, 'fullscreenElement');
      }
    }
  });

  it('behält bei abgebrochener Rückkehr die Presenter-Ansicht und erlaubt einen erneuten Versuch', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await component.returnToHost();
    expect(component.returnToHostError()).toContain('Bitte versuche es erneut.');
    expect(component.returnToHostPending()).toBe(false);
    await component.returnToHost();
    expect(component.returnToHostError()).toBe('');
    expect(navigate).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it('rendert die Word-Cloud in der Presenter-Ansicht mit Live-Hinweis', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Live-Freitext');
    expect(text).toContain('Frage 2: Was war hilfreich?');
    expect(text).toContain('Wortgruppen');
    expect(text).toContain('Anzeige anhalten');
    expect(text).toContain('Nach Grundform bündeln');
    expect(text).toContain('Wörter und kurze Wortgruppen');
    expect(fixture.nativeElement.querySelector('.word-cloud__description')).toBeNull();
    const viewHint = fixture.nativeElement.querySelector(
      '.session-present__word-cloud-view-hint',
    ) as HTMLElement;
    expect(viewHint).toBeTruthy();
    expect(viewHint.closest('details')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-freetext-word-cloud-words"]'),
    ).toBeTruthy();
    expect(text).not.toContain('Je größer ein Wort, desto öfter wurde es genannt.');
    expect(
      fixture.nativeElement.querySelector('.word-cloud__meta .word-cloud__reading-hint'),
    ).toBeNull();
    expect(text).not.toContain('CSV speichern');
    expect(text).not.toContain('PNG speichern');
    expect(text).not.toContain('Antwort anzeigen');
    expect(text).not.toContain('Maximieren');
    fixture.destroy();
  });

  it('ignoriert einen alten Themenfehler, solange noch keine Freitext-Beiträge vorliegen', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    fixture.componentInstance.session.update((session) =>
      session ? { ...session, presenterSurface: 'freetextWordCloud' } : session,
    );
    fixture.componentInstance.freetextQuestionId.set(questionId);
    fixture.componentInstance.freetextResponses.set([]);
    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'SEMANTIC',
      effectiveMode: 'SEMANTIC',
      analysisStatus: 'failed',
      analysisLanguage: 'de',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.presenterFreetextWordCloudHint()).toBeNull();
    expect(fixture.componentInstance.presenterFreetextShowThemeRefresh()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain(
      'Themen konnten gerade nicht aktualisiert werden.',
    );
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-freetext-word-cloud-refresh"]'),
    ).toBeNull();
    fixture.destroy();
  });

  it('schaltet die Freitext-Wortwolke über die Presenter-Werkzeugleiste um', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const words = fixture.nativeElement.querySelector(
      '[data-testid="presenter-freetext-word-cloud-words"] button',
    ) as HTMLButtonElement;
    const phrases = fixture.nativeElement.querySelector(
      '[data-testid="presenter-freetext-word-cloud-phrases"] button',
    ) as HTMLButtonElement;
    const semantic = fixture.nativeElement.querySelector(
      '[data-testid="presenter-freetext-word-cloud-semantic"] button',
    ) as HTMLButtonElement;
    const freeze = fixture.nativeElement.querySelector(
      '[data-testid="presenter-freetext-word-cloud-freeze"]',
    ) as HTMLButtonElement;
    const smooth = fixture.nativeElement.querySelector(
      '[data-testid="presenter-freetext-word-cloud-smooth"]',
    ) as HTMLButtonElement;
    expect(words.disabled).toBe(false);
    expect(phrases.disabled).toBe(false);
    expect(semantic.disabled).toBe(false);
    expect(freeze.disabled).toBe(false);
    expect(smooth.disabled).toBe(false);

    words.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextWordCloudModeEffective()).toBe('WORDS');
    expect(fixture.nativeElement.querySelector('.word-cloud__description')).toBeNull();
    expect(setFreetextWordCloudProjectionMutateMock).toHaveBeenCalled();

    freeze.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextWordCloudFrozen()).toBe(true);
    expect(freeze.getAttribute('aria-pressed')).toBe('true');

    semantic.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(analyzeWordCloudMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'SEMANTIC', channel: 'FREETEXT' }),
    );
    expect(fixture.nativeElement.textContent).toContain('Struktur');
    expect(fixture.nativeElement.querySelector('.word-cloud__analysis-toolbar')).toBeNull();
    fixture.destroy();
  });

  it('hält Glättung, Modus, Einfrieren und den Antwortstand auseinander', async () => {
    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    fixture.componentInstance.freetextResponses.set(['Alt']);
    fixture.detectChanges();

    let releaseAnalysis: (value: unknown) => void = () => undefined;
    analyzeWordCloudMutateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseAnalysis = resolve;
        }),
    );

    const smooth = fixture.nativeElement.querySelector(
      '[data-testid="presenter-freetext-word-cloud-smooth"]',
    ) as HTMLButtonElement;
    smooth.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextLemmaPending()).toBe(true);

    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-words"] button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextLemmaPending()).toBe(false);
    expect(smooth.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Analyse läuft');

    releaseAnalysis({
      normalizationApplied: 'LEMMA',
      normalizationFallbackReason: null,
      entries: [wordCloudEntry('verspätet', 'verspatet')],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('verspätet');

    analyzeWordCloudMutateMock.mockResolvedValue({
      normalizationApplied: 'LEMMA',
      normalizationFallbackReason: null,
      entries: [
        wordCloudEntry('klare Struktur', 'klare struktur'),
        wordCloudEntry('Struktur', 'struktur'),
      ],
    });
    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-phrases"] button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    smooth.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      fixture.componentInstance.presenterFreetextLemmaDisplayEntries()?.map((entry) => entry.key),
    ).toEqual(expect.arrayContaining(['klare struktur', 'struktur']));
    expect(fixture.componentInstance.presenterFreetextLemmaDisplayEntries()).toHaveLength(2);

    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-words"] button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(
      fixture.componentInstance.presenterFreetextLemmaDisplayEntries()?.map((entry) => entry.key),
    ).toEqual(['struktur']);

    analyzeWordCloudMutateMock.mockResolvedValue({
      normalizationApplied: 'LEMMA',
      normalizationFallbackReason: null,
      entries: [wordCloudEntry('Wort', 'wort')],
    });
    smooth.click();
    await fixture.whenStable();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-phrases"] button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextLemmaDisplayEntries()).toBeNull();

    analyzeWordCloudMutateMock.mockResolvedValue({
      normalizationApplied: 'NONE',
      normalizationFallbackReason: 'NLP_DISABLED',
      entries: [wordCloudEntry('Fallback', 'fallback')],
    });
    smooth.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextSmoothingStatus()).toBe('idle');
    expect(fixture.nativeElement.textContent).toContain(
      'Das Bündeln nach Grundform ist hier nicht verfügbar. Du kannst die Wortwolke weiterhin nutzen.',
    );
    const smoothingFeedback = fixture.nativeElement.querySelector(
      '.session-present__word-cloud-options .session-present__word-cloud-toolbar-status',
    ) as HTMLElement | null;
    expect(smoothingFeedback?.textContent).toContain(
      'Das Bündeln nach Grundform ist hier nicht verfügbar.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Nach Grundform gebündelt');
    const publishedFallback = setFreetextWordCloudProjectionMutateMock.mock.calls.at(-1)?.[0] as {
      projection: { smoothingActive: boolean };
    };
    expect(publishedFallback.projection.smoothingActive).toBe(false);

    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'LEXICAL',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [{ key: 'alt', label: 'AlteProjektion', count: 2 }],
    });
    fixture.componentInstance.presenterFreetextWordCloudModeOverride.set(null);
    fixture.componentInstance.presenterFreetextLemmaPreferred.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('AlteProjektion');
    expect(fixture.nativeElement.querySelector('.word-cloud__description')).toBeNull();
    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-freeze"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'THEME',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [{ key: 'neu', label: 'NeueProjektion', count: 2 }],
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextWordCloudModeEffective()).toBe('WORDS');
    expect(fixture.nativeElement.textContent).toContain('AlteProjektion');
    expect(fixture.nativeElement.querySelector('.word-cloud__description')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('NeueProjektion');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Wörter und kurze Wortgruppen wie »roter Faden«.',
    );

    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-freeze"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    fixture.componentInstance.freetextResponses.set([
      'Nach 10 Minuten Pause',
      'Bitte 10 Minuten einplanen',
    ]);
    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'LEXICAL',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [],
    });
    fixture.componentInstance.presenterFreetextWordCloudModeOverride.set(null);
    fixture.detectChanges();
    expect(
      fixture.componentInstance.freetextWordCloudTerms()?.some((term) => term.key === '10 minuten'),
    ).toBe(false);
    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-freeze"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'THEME',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [],
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextWordCloudModeEffective()).toBe('WORDS');
    expect(
      fixture.componentInstance.freetextWordCloudTerms()?.some((term) => term.key === '10 minuten'),
    ).toBe(false);

    fixture.componentInstance.presenterFreetextWordCloudFrozen.set(false);
    fixture.componentInstance.freetextResponses.set(['Alt']);
    fixture.detectChanges();
    let releaseSemantic: (value: unknown) => void = () => undefined;
    analyzeWordCloudMutateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSemantic = resolve;
        }),
    );
    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-semantic"] button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    fixture.componentInstance.freetextResponses.set(['Alt', 'Neu']);
    fixture.detectChanges();
    releaseSemantic({
      entries: [wordCloudEntry('Alt', 'alt', 0.4)],
    });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.presenterFreetextSemanticPending()).toBe(false);
    });
    fixture.detectChanges();
    const semanticItems = analyzeWordCloudMutateMock.mock.calls.at(-1)?.[0] as {
      items: Array<{ text: string }>;
      mode: string;
    };
    expect(semanticItems.mode).toBe('SEMANTIC');
    expect(semanticItems.items.map((item) => item.text)).toEqual(['Alt']);
    expect(fixture.componentInstance.presenterFreetextShowThemeRefresh()).toBe(true);

    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-phrases"] button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    fixture.componentInstance.freetextResponses.set(['Alt']);
    fixture.detectChanges();
    let releaseLemma: (value: unknown) => void = () => undefined;
    analyzeWordCloudMutateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseLemma = resolve;
        }),
    );
    (
      fixture.nativeElement.querySelector(
        '[data-testid="presenter-freetext-word-cloud-smooth"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    fixture.componentInstance.freetextResponses.set(['Alt', 'Neu']);
    fixture.detectChanges();
    releaseLemma({
      normalizationApplied: 'LEMMA',
      normalizationFallbackReason: null,
      entries: [wordCloudEntry('Alt', 'alt')],
    });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.presenterFreetextLemmaPending()).toBe(false);
    });
    fixture.detectChanges();
    const lemmaItems = analyzeWordCloudMutateMock.mock.calls.at(-1)?.[0] as {
      items: Array<{ text: string }>;
      normalization: string;
    };
    expect(lemmaItems.normalization).toBe('LEMMA');
    expect(lemmaItems.items.map((item) => item.text)).toEqual(['Alt']);
    expect(fixture.componentInstance.presenterFreetextSmoothingStatus()).toBe('stale');

    fixture.destroy();
  });

  it('behält eine geglättete Host-Phrasenwolke bei Pending und Encoder-Fallback', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const component = fixture.componentInstance;
    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    component.freetextQuestionId.set(questionId);
    component.freetextResponses.set(['Die Stichprobe wird größer.', 'Größere Stichproben helfen.']);
    component.freetextWordCloudProjection.set({
      mode: 'THEME',
      effectiveMode: 'THEME',
      locale: 'de',
      questionId,
      smoothingActive: true,
      entries: [{ key: 'grosse stichprobe', label: 'Große Stichprobe', count: 2 }],
    });
    let complete: (value: unknown) => void = () => undefined;
    analyzeWordCloudMutateMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );

    component.setPresenterFreetextWordCloudMode('SEMANTIC');
    expect(component.presenterFreetextSemanticPending()).toBe(true);
    expect(component.freetextStageAnalysisEntries()?.[0]?.label).toBe('Große Stichprobe');
    complete({
      mode: 'SEMANTIC',
      status: 'fallback',
      fallbackUsed: true,
      entries: [wordCloudEntry('Stichproben', 'stichproben')],
    });
    await vi.waitFor(() => expect(component.presenterFreetextSemanticPending()).toBe(false));
    expect(component.presenterFreetextDisplayMode()).toBe('THEME');
    expect(component.presenterFreetextWordCloudViewHint()).toContain(
      'Wörter und kurze Wortgruppen',
    );
    expect(component.presenterFreetextWordCloudViewHint()).not.toContain(
      'zusammengefasst als Themen',
    );
    expect(component.freetextStageAnalysisEntries()?.[0]?.label).toBe('Große Stichprobe');
    expect(setFreetextWordCloudProjectionMutateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projection: expect.objectContaining({ effectiveMode: 'THEME', smoothingActive: true }),
      }),
    );
    fixture.destroy();
  });

  it('verwirft das eigene Analyseergebnis bei einem Sprachwechsel während des Einfrierens', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const component = fixture.componentInstance;
    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    component.freetextQuestionId.set(questionId);
    component.freetextResponses.set(['Die Stichprobe wird größer.', 'Größere Stichproben helfen.']);
    const projection = {
      mode: 'SEMANTIC',
      effectiveMode: 'SEMANTIC',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [],
    } as const;
    component.freetextWordCloudProjection.set({ ...projection, entries: [] });
    analyzeWordCloudMutateMock.mockResolvedValueOnce({
      mode: 'SEMANTIC',
      status: 'ready',
      fallbackUsed: false,
      entries: [wordCloudEntry('Stichprobengröße', 'sample-size', 0.92)],
    });
    component.setPresenterFreetextWordCloudMode('SEMANTIC');
    await vi.waitFor(() => expect(component.presenterFreetextSemanticPending()).toBe(false));
    component.togglePresenterFreetextWordCloudFreeze();
    component.freetextWordCloudProjection.set({ ...projection, locale: 'en', entries: [] });
    expect(component.presenterFreetextTermLocale()).toBe('de');
    expect(component.freetextStageAnalysisEntries()?.[0]?.label).toBe('Stichprobengröße');

    component.togglePresenterFreetextWordCloudFreeze();
    expect(component.presenterFreetextTermLocale()).toBe('en');
    expect(component.freetextStageAnalysisEntries()).toBeNull();
    expect(component.presenterFreetextDisplayMode()).not.toBe('SEMANTIC');
    fixture.destroy();
  });

  it('hält eingefrorene Glättung und den Fokus der Themen-Aktualisierung', async () => {
    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.freetextResponses.set(['Wort']);
    fixture.componentInstance.presenterFreetextWordCloudModeOverride.set(null);
    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'LEXICAL',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [{ key: 'wort', label: 'Wort', count: 1 }],
    });
    fixture.detectChanges();
    root
      .querySelector<HTMLButtonElement>('[data-testid="presenter-freetext-word-cloud-freeze"]')
      ?.click();
    fixture.detectChanges();
    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'LEXICAL',
      locale: 'de',
      questionId,
      smoothingActive: true,
      entries: [{ key: 'glatt', label: 'Glatt', count: 1 }],
    });
    fixture.detectChanges();
    const unsmoothed = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-smooth"]',
    );
    expect(unsmoothed?.getAttribute('aria-pressed')).toBe('false');
    expect(root.textContent).toContain('Wort');
    expect(root.textContent).not.toContain('Glatt');
    unsmoothed?.click();
    fixture.detectChanges();
    expect(analyzeWordCloudMutateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ normalization: 'LEMMA' }),
    );
    await vi.waitFor(() => {
      expect(fixture.componentInstance.presenterFreetextLemmaPending()).toBe(false);
    });
    fixture.destroy();

    const smoothedFixture = TestBed.createComponent(SessionPresentComponent);
    smoothedFixture.detectChanges();
    await smoothedFixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    smoothedFixture.detectChanges();
    const smoothedRoot = smoothedFixture.nativeElement as HTMLElement;
    smoothedFixture.componentInstance.freetextResponses.set(['Glatt']);
    smoothedFixture.componentInstance.presenterFreetextWordCloudModeOverride.set(null);
    smoothedFixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'LEXICAL',
      locale: 'de',
      questionId,
      smoothingActive: true,
      entries: [{ key: 'glatt', label: 'Glatt', count: 1 }],
    });
    smoothedFixture.detectChanges();
    smoothedRoot
      .querySelector<HTMLButtonElement>('[data-testid="presenter-freetext-word-cloud-freeze"]')
      ?.click();
    smoothedFixture.detectChanges();
    smoothedFixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'LEXICAL',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [{ key: 'wort', label: 'Wort', count: 1 }],
    });
    smoothedFixture.detectChanges();
    const smoothed = smoothedRoot.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-smooth"]',
    );
    expect(smoothed?.getAttribute('aria-pressed')).toBe('true');
    expect(smoothedRoot.textContent).toContain('Glatt');
    const analyzeCallsAtOff = analyzeWordCloudMutateMock.mock.calls.length;
    smoothed?.click();
    await smoothedFixture.whenStable();
    smoothedFixture.detectChanges();
    expect(analyzeWordCloudMutateMock.mock.calls.length).toBe(analyzeCallsAtOff);
    const published = setFreetextWordCloudProjectionMutateMock.mock.calls.at(-1)?.[0] as {
      projection: { smoothingActive: boolean };
    };
    expect(published.projection.smoothingActive).toBe(false);
    smoothedFixture.destroy();

    const focusFixture = TestBed.createComponent(SessionPresentComponent);
    focusFixture.detectChanges();
    await focusFixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    focusFixture.detectChanges();
    const focusRoot = focusFixture.nativeElement as HTMLElement;
    focusFixture.componentInstance.freetextResponses.set(['Alt']);
    focusFixture.detectChanges();
    analyzeWordCloudMutateMock.mockResolvedValue({
      entries: [wordCloudEntry('Alt', 'alt', 0.4)],
    });
    focusRoot
      .querySelector<HTMLButtonElement>(
        '[data-testid="presenter-freetext-word-cloud-semantic"] button',
      )
      ?.click();
    await focusFixture.whenStable();
    focusFixture.detectChanges();
    focusFixture.componentInstance.freetextResponses.set(['Alt', 'Neu']);
    focusFixture.detectChanges();
    const refresh = focusRoot.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-refresh"]',
    );
    expect(refresh).not.toBeNull();
    refresh?.focus();
    let rejectRefresh: (reason?: unknown) => void = () => undefined;
    analyzeWordCloudMutateMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRefresh = reject;
        }),
    );
    refresh?.click();
    focusFixture.detectChanges();
    const pendingRefresh = focusRoot.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-refresh"]',
    );
    expect(pendingRefresh?.isConnected).toBe(true);
    expect(pendingRefresh?.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(pendingRefresh);

    rejectRefresh(new Error('Analyse fehlgeschlagen'));
    await vi.waitFor(() => {
      expect(focusFixture.componentInstance.presenterFreetextSemanticPending()).toBe(false);
    });
    focusFixture.detectChanges();
    await focusFixture.whenStable();
    focusFixture.detectChanges();
    const failedRefresh = focusRoot.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-refresh"]',
    );
    expect(failedRefresh?.isConnected).toBe(true);
    expect(document.activeElement).toBe(failedRefresh);

    analyzeWordCloudMutateMock.mockResolvedValue({
      entries: [wordCloudEntry('Alt', 'alt', 0.4)],
    });
    failedRefresh?.click();
    await vi.waitFor(() => {
      expect(focusFixture.componentInstance.presenterFreetextSemanticPending()).toBe(false);
    });
    focusFixture.detectChanges();
    await focusFixture.whenStable();
    focusFixture.detectChanges();
    const successfulRefresh = focusRoot.querySelector(
      '[data-testid="presenter-freetext-word-cloud-refresh"]',
    );
    expect(successfulRefresh).not.toBeNull();
    expect(document.activeElement).toBe(successfulRefresh);
    focusFixture.destroy();
  });

  it('behält den Fokus auf der Wort-Glättung während der Analyse', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.freetextResponses.set(['Alt']);
    fixture.detectChanges();

    const focusSmooth = () => {
      const button = root.querySelector<HTMLButtonElement>(
        '[data-testid="presenter-freetext-word-cloud-smooth"]',
      );
      button?.focus();
      return button;
    };

    let rejectSmoothing: (reason?: unknown) => void = () => undefined;
    analyzeWordCloudMutateMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSmoothing = reject;
        }),
    );
    focusSmooth()?.click();
    fixture.detectChanges();
    const pending = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-smooth"]',
    );
    expect(pending?.disabled).toBe(false);
    expect(pending?.getAttribute('aria-disabled')).toBe('true');
    expect(pending?.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(pending);
    pending?.click();
    expect(analyzeWordCloudMutateMock).toHaveBeenCalledTimes(1);

    rejectSmoothing(new Error('Analyse fehlgeschlagen'));
    await vi.waitFor(() => {
      expect(fixture.componentInstance.presenterFreetextLemmaPending()).toBe(false);
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const failed = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-smooth"]',
    );
    expect(failed?.getAttribute('aria-busy')).toBeNull();
    expect(document.activeElement).toBe(failed);

    let releaseSmoothing: (value: unknown) => void = () => undefined;
    analyzeWordCloudMutateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSmoothing = resolve;
        }),
    );
    focusSmooth()?.click();
    fixture.detectChanges();
    const pendingAgain = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-freetext-word-cloud-smooth"]',
    );
    expect(pendingAgain?.disabled).toBe(false);
    expect(document.activeElement).toBe(pendingAgain);
    releaseSmoothing({
      normalizationApplied: 'LEMMA',
      normalizationFallbackReason: null,
      entries: [wordCloudEntry('Alt', 'alt')],
    });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.presenterFreetextLemmaPending()).toBe(false);
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-freetext-word-cloud-smooth"]'),
    );
    expect(fixture.componentInstance.presenterFreetextSmoothingStatus()).toBe('active');

    fixture.destroy();
  });

  it('zeigt während der Freitext-Abstimmung die Frage statt der Wortwolke', async () => {
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 1,
      totalQuestions: 13,
      text: 'Was war hilfreich?',
      type: 'FREETEXT',
      difficulty: 'EASY',
      showQuestionTypeIndicators: true,
      answers: [],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Was war hilfreich?');
    expect(text).toContain('Freitextantwort');
    expect(text).not.toContain('Live-Freitext');
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]'),
    ).toBeTruthy();

    fixture.componentInstance.session.update((session) =>
      session ? { ...session, presenterSurface: 'freetextWordCloud' } : session,
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Live-Freitext');
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]')).toBeNull();

    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    fixture.componentInstance.freetextQuestionId.set(questionId);
    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'SEMANTIC',
      effectiveMode: 'SEMANTIC',
      analysisLanguage: 'de',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [{ key: 'sample-size', label: 'Stichprobengröße', count: 2, labelOrigin: 'model' }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Stichprobengröße');
    expect(fixture.componentInstance.presenterFreetextDisplayMode()).toBe('SEMANTIC');
    expect(fixture.componentInstance.freetextWordCloudTerms()).toBeNull();

    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'SEMANTIC',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [{ key: 'semantic-0-response-0', label: 'Stichprobengröße', count: 2 }],
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextDisplayMode()).toBe('SEMANTIC');

    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'SEMANTIC',
      effectiveMode: 'LEXICAL',
      analysisStatus: 'fallback',
      locale: 'de',
      questionId,
      smoothingActive: false,
      entries: [{ key: 'stichprobe', label: 'Stichprobe', count: 2 }],
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.presenterFreetextDisplayMode()).toBe('LEXICAL');
    expect(fixture.nativeElement.textContent).toContain(
      'Ähnliche Beiträge lassen sich gerade nicht zuverlässig zusammenfassen. Stattdessen werden Wörter oder Wortgruppen gezeigt.',
    );
    expect(fixture.nativeElement.querySelector('.word-cloud__analysis-toolbar')).toBeNull();

    fixture.componentInstance.freetextWordCloudProjection.update((projection) =>
      projection ? { ...projection, effectiveMode: undefined, analysisStatus: undefined } : null,
    );
    expect(fixture.componentInstance.presenterFreetextDisplayMode()).toBe('LEXICAL');

    fixture.componentInstance.freetextWordCloudProjection.set({
      mode: 'SEMANTIC',
      locale: 'de',
      questionId: '11111111-1111-4111-8111-111111111111',
      smoothingActive: false,
      entries: [{ key: 'alt', label: 'AlteFrage', count: 1 }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('AlteFrage');
    expect(fixture.componentInstance.freetextStageAnalysisEntries()).toBeNull();
    fixture.destroy();
  });

  it('zeigt nach Freitext-Freigabe die Wortwolke ohne Quizbühne', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 1,
      totalQuestions: 13,
      text: 'Was war hilfreich?',
      type: 'FREETEXT',
      difficulty: 'EASY',
      showQuestionTypeIndicators: true,
      answers: [],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Live-Freitext');
    expect(text).toContain('Frage 2: Was war hilfreich?');
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]')).toBeNull();
    fixture.destroy();
  });

  it('blendet auf der Bühne mit Host-Zugriff ein Wort aus und hält die leere Wolke', async () => {
    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    liveQueryMock.mockResolvedValue({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId,
      questionOrder: 1,
      questionType: 'FREETEXT',
      questionText: 'Was war hilfreich?',
      responses: ['Praxis'],
      wordCloudVisibility: { questionId, hiddenLabels: [] },
      wordCloudProjection: {
        questionId,
        mode: 'LEXICAL',
        locale: 'de',
        smoothingActive: false,
        entries: [{ key: 'praxis', label: 'Praxis', count: 1 }],
      },
    });
    setFreetextWordCloudEntryVisibilityMock.mockResolvedValue({
      questionId,
      hiddenLabels: ['Praxis'],
    });
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.canHideFreetextWord());
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button.word-cloud__word')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.word-cloud__responses-panel')).toBeNull();
    root.querySelector<HTMLButtonElement>('.word-cloud__hide-action')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setFreetextWordCloudEntryVisibilityMock).toHaveBeenCalledWith(
      {
        code: 'ABC123',
        questionId,
        label: 'Praxis',
        hidden: true,
      },
      expect.anything(),
    );
    expect(root.querySelector('.word-cloud__word')).toBeNull();
    expect(root.textContent).toContain('Keine Wörter sichtbar.');
    expect(root.textContent).not.toContain('Ausgeblendete Wörter');
    fixture.destroy();
  });

  it('zeigt die Presenter-Frage als Klartext statt Roh-Markdown', async () => {
    liveQueryMock.mockResolvedValue({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      questionOrder: 1,
      questionType: 'FREETEXT',
      questionText:
        '### Was hilft dir beim Lernen?\n\nDie Antworten werden als **Wortwolke** dargestellt.',
      responses: ['Praxis', 'Beispiele'],
      updatedAt: '2026-03-08T12:00:00.000Z',
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Frage 2: Was hilft dir beim Lernen?');
    expect(text).not.toContain('Die Antworten werden als Wortwolke dargestellt.');
    expect(text).not.toContain('###');
    expect(text).not.toContain('**Wortwolke**');
    fixture.destroy();
  });

  it('zeigt in der Beamer-Ansicht bei FINISHED das vollständige Leaderboard und den Gewinner', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: true,
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Ada',
        totalScore: 42,
        correctCount: 4,
        totalQuestions: 5,
        totalResponseTimeMs: 1200,
        teamName: '🦊 Füchse',
        teamColor: '#ff8800',
      },
      {
        rank: 2,
        nickname: 'Ben',
        totalScore: 21,
        correctCount: 2,
        totalQuestions: 5,
        totalResponseTimeMs: 2400,
        teamName: '🦉 Eulen',
        teamColor: '#3366ff',
      },
      {
        rank: 3,
        nickname: 'Cara',
        totalScore: 10,
        correctCount: 1,
        totalQuestions: 5,
        totalResponseTimeMs: 3000,
        teamName: '🦊 Füchse',
        teamColor: '#ff8800',
      },
    ]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Füchse',
        teamColor: '#ff8800',
        totalScore: 30,
        memberCount: 2,
        averageScore: 30,
      },
      {
        rank: 2,
        teamName: 'Eulen',
        teamColor: '#3366ff',
        totalScore: 12,
        memberCount: 2,
        averageScore: 12,
      },
    ]);

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(navSpy).not.toHaveBeenCalled();
    expect(getLeaderboardQueryMock).toHaveBeenCalled();
    expect(getTeamLeaderboardQueryMock).toHaveBeenCalled();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ada');
    expect(text).toContain('Ben');
    expect(text).toContain('Cara');
    expect(text).toContain('Füchse');
    expect(text).toContain('Eulen');
    expect(text).toContain('Gewonnen hat');
    expect(
      fixture.nativeElement.querySelector('.session-present__winner-name--champion')?.textContent,
    ).toContain('Ada');
    expect(fixture.nativeElement.querySelectorAll('.session-present__board-item').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.session-present__team-board-item').length).toBe(
      2,
    );
    const hero = fixture.nativeElement.querySelector(
      '.session-present__finish-hero--with-teams',
    ) as HTMLElement | null;
    expect(hero).not.toBeNull();
    expect(hero?.querySelector('[data-testid="presenter-personal-winner"]')).not.toBeNull();
    expect(hero?.querySelector('[data-testid="presenter-team-winner"]')).not.toBeNull();
    expect(
      hero?.querySelector(
        '[data-testid="presenter-team-winner"] .session-present__winner-name--champion',
      )?.textContent,
    ).toContain('Füchse');
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-team-board"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__board-list')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.session-present__board-list--overflow'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.session-present__board-lead').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.session-present__board-tail').length).toBe(3);
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__board-medal--gold').length,
    ).toBe(1);
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__board-medal--silver').length,
    ).toBe(1);
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__board-medal--bronze').length,
    ).toBe(1);
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__participant-team-icon').length,
    ).toBe(4);
    const finish = fixture.nativeElement.querySelector(
      '.session-present__finish',
    ) as HTMLElement | null;
    expect(finish).not.toBeNull();
    expect(finish?.querySelector(':scope > .session-present__finish-hero')).not.toBeNull();
    expect(finish?.querySelector(':scope > .session-present__board-card')).not.toBeNull();
    expect(finish?.querySelector(':scope > .session-present__team-board-card')).not.toBeNull();
    expect(finish?.querySelector('.session-present__finish-home')).toBeNull();
    expect(finish?.textContent).not.toContain('Zur Startseite');
    const teamTracks = fixture.nativeElement.querySelectorAll('.session-present__team-board-track');
    expect(teamTracks.length).toBe(2);
    fixture.destroy();
  });

  it('zeigt im Finale geteilte Goldplätze auch auf der nächsten Seite', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Quiz',
      participantCount: 10,
      teamMode: true,
      finishProjection: 'leaderboard',
    });
    getLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        rank: index + 1,
        nickname: `Person ${index + 1}`,
        totalScore: index < 9 ? 2000 : 1000,
        correctCount: 1,
        totalQuestions: 1,
        totalResponseTimeMs: 1000 + index,
      })),
    );
    getTeamLeaderboardQueryMock.mockResolvedValue(
      ['A', 'B'].map((teamName, index) => ({
        rank: index + 1,
        teamName,
        teamColor: '#3366ff',
        totalScore: 2000,
        memberCount: 5,
        averageScore: 2000,
      })),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const presenter = fixture.nativeElement as HTMLElement;
    expect(presenter.querySelector('.session-present__finish-hero')).toBeNull();
    expect(presenter.querySelectorAll('.session-present__board-medal--gold')).toHaveLength(8);
    expect(
      Array.from(presenter.querySelectorAll('.session-present__team-board-rank .sr-only'), (rank) =>
        rank.textContent?.trim(),
      ),
    ).toEqual(['1', '1']);

    presenter
      .querySelector<HTMLButtonElement>('[data-testid="presenter-personal-board-next"]')
      ?.click();
    fixture.detectChanges();
    expect(presenter.querySelectorAll('.session-present__board-medal--gold')).toHaveLength(1);
    expect(
      presenter.querySelectorAll(
        '.session-present__board-medal--silver, .session-present__board-medal--bronze',
      ),
    ).toHaveLength(0);
    expect(
      Array.from(presenter.querySelectorAll('.session-present__board-rank'), (rank) =>
        (rank.querySelector('.sr-only') ?? rank).textContent?.trim(),
      ),
    ).toEqual(['1', '10']);
    fixture.destroy();
  });

  it('zeigt bei 0 Punkten das Team-Leaderboard statt der Endseite', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 1,
      teamMode: true,
      finishProjection: 'leaderboard',
    });
    getLeaderboardQueryMock.mockResolvedValue([]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Apfel',
        teamColor: '#c62828',
        totalScore: 0,
        memberCount: 1,
        averageScore: 0,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="presenter-finish-idle"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Apfel');
    expect(fixture.nativeElement.textContent).toContain('Team-Leaderboard');
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-team-winner"]')).toBeNull();
    fixture.destroy();
  });

  it('behält das Gesamtleaderboard nach Quiz-FINISHED, solange expiresAt in der Zukunft liegt', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      serverNow: MOCK_SERVER_TIME,
      expiresAt: '2026-03-25T12:00:00.000Z',
      sessionLifecycleRevision: 4,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 1,
      teamMode: true,
      finishProjection: 'leaderboard',
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Red dragon 1',
        totalScore: 2000,
        correctCount: 2,
        totalQuestions: 2,
        totalResponseTimeMs: 1000,
        teamName: 'Team A',
        teamColor: '#c62828',
      },
    ]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Team A',
        teamColor: '#c62828',
        totalScore: 2000,
        memberCount: 1,
        averageScore: 2000,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="presenter-finish-idle"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Red dragon 1');
    expect(fixture.nativeElement.textContent).toContain('Team A');
    expect(fixture.nativeElement.textContent).toContain('Team-Leaderboard');
    fixture.destroy();
  });

  it('lädt den Zwischenstand für die letzte Presenter-Seite der Ergebnisphase', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      showLeaderboard: true,
      currentQuestion: 0,
      presenterPage: { context: 'results-question-1', index: 0, count: 1 },
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Ada',
        totalScore: 120,
        correctCount: 1,
        totalQuestions: 1,
        totalResponseTimeMs: 900,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(getLeaderboardQueryMock).toHaveBeenCalled();
    expect(fixture.componentInstance.personalLeaderboard()[0]?.nickname).toBe('Ada');
    fixture.destroy();
  });

  it('zeigt ohne Beteiligung nur einen passiven Hinweis auf das Session-Ende', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Vorlesung',
      title: null,
      participantCount: 0,
      teamMode: false,
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const idle = fixture.nativeElement.querySelector(
      '[data-testid="presenter-finish-idle"]',
    ) as HTMLElement | null;
    expect(idle).not.toBeNull();
    const idleText = idle?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(idleText).toContain('arsnova.eu');
    expect(idleText).toContain('Die Session ist beendet.');
    expect(idle?.querySelector('.session-present__finish-brand')).toBeTruthy();
    const finishIcon = idle?.querySelector(
      '.session-present__finish-brand-icon',
    ) as SVGElement | null;
    expect(finishIcon?.querySelector('rect[x="2"]')).toBeNull();
    expect(idle?.querySelector('.session-present__finish-brand-title')?.textContent?.trim()).toBe(
      'arsnova.eu',
    );
    expect(idle?.querySelector('a, button, mat-card')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Gesamtauswertung');
    expect(fixture.nativeElement.textContent).not.toContain('Zur Startseite');
    fixture.destroy();
  });

  it('blendet das Leaderboard aus, wenn der Host die Abschlussprojektion dismissed', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Vorlesung',
      title: null,
      participantCount: 2,
      teamMode: false,
      finishProjection: 'idle',
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Ada',
        totalScore: 42,
        correctCount: 4,
        totalQuestions: 5,
        totalResponseTimeMs: 1200,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const idle = fixture.nativeElement.querySelector(
      '[data-testid="presenter-finish-idle"]',
    ) as HTMLElement | null;
    expect(idle).not.toBeNull();
    expect(idle?.textContent).toContain('Die Session ist beendet.');
    expect(idle?.textContent).toContain('arsnova.eu');
    expect(fixture.nativeElement.querySelector('.session-present__board-item')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__finish-hero')).toBeNull();
    fixture.destroy();
  });

  it('zeigt Leaderboard nur bei finishProjection leaderboard, sonst Exit-Branding', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Vorlesung',
      title: null,
      participantCount: 2,
      teamMode: false,
      finishProjection: 'leaderboard',
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Ada',
        totalScore: 42,
        correctCount: 4,
        totalQuestions: 5,
        totalResponseTimeMs: 1200,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.session-present__board-item')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-finish-idle"]')).toBeNull();
    fixture.destroy();
  });

  it('wechselt live vom Leaderboard auf Idle, wenn finishProjection idle wird', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Vorlesung',
      title: null,
      participantCount: 2,
      teamMode: false,
      finishProjection: 'leaderboard',
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Ada',
        totalScore: 42,
        correctCount: 4,
        totalQuestions: 5,
        totalResponseTimeMs: 1200,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.session-present__board-item')).not.toBeNull();

    fixture.componentInstance.session.update((current) =>
      current ? { ...current, finishProjection: 'idle' } : current,
    );
    fixture.detectChanges();

    const idle = fixture.nativeElement.querySelector(
      '[data-testid="presenter-finish-idle"]',
    ) as HTMLElement | null;
    expect(idle).not.toBeNull();
    expect(idle?.textContent).toContain('Die Session ist beendet.');
    expect(fixture.nativeElement.querySelector('.session-present__board-item')).toBeNull();
    fixture.destroy();
  });

  it('schneidet das Presenter-Leaderboard bei FINISHED nicht auf Top-Platzierungen zusammen', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      teamMode: false,
    });
    getLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        rank: index + 1,
        nickname: `Spieler ${index + 1}`,
        totalScore: 60 - index * 5,
        correctCount: 6 - index,
        totalQuestions: 6,
        totalResponseTimeMs: 1000 + index * 200,
      })),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Spieler 1');
    expect(text).toContain('Spieler 6');
    expect(fixture.nativeElement.querySelectorAll('.session-present__board-item').length).toBe(6);
    fixture.destroy();
  });

  it('legt die Personenliste ab 9 Einträgen mehrspaltig an', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Großes Quiz',
      title: null,
      participantCount: 9,
      teamMode: false,
    });
    getLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        rank: index + 1,
        nickname: `Spieler ${index + 1}`,
        totalScore: 90 - index * 5,
        correctCount: 9 - index,
        totalQuestions: 9,
        totalResponseTimeMs: 1000 + index * 200,
      })),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.session-present__board-list--overflow'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.session-present__board-item').length).toBe(8);
    fixture.destroy();
  });

  it('zeigt in der Presenter-Gesamtauswertung alle Personen ohne Kürzung', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Großes Quiz',
      title: null,
      participantCount: 24,
      teamMode: false,
    });
    getLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 24 }, (_, index) => ({
        rank: index + 1,
        nickname: `Spieler ${index + 1}`,
        totalScore: 240 - index * 5,
        correctCount: 12,
        totalQuestions: 12,
        totalResponseTimeMs: 1000 + index * 80,
      })),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.session-present__board-item');
    expect(items.length).toBe(8);
    expect(fixture.componentInstance.personalBoardPageCount()).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Spieler 8');
    const list = fixture.nativeElement.querySelector(
      '.session-present__board-list',
    ) as HTMLElement | null;
    expect(list?.classList.contains('session-present__board-list--overflow')).toBe(true);
    expect(list?.classList.contains('session-present__board-list--compact')).toBe(false);
    expect(list?.style.getPropertyValue('--board-cols').trim()).toBe('2');
    const finish = fixture.nativeElement.querySelector(
      '.session-present__finish',
    ) as HTMLElement | null;
    expect(finish?.querySelector('.session-present__finish-title')).toBeNull();
    expect(finish?.hasAttribute('aria-labelledby')).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Gesamtauswertung');
    fixture.destroy();
  });

  it('paginiert Leaderboards, die nicht auf eine Beamerseite passen', () => {
    expect(SessionPresentComponent.columnCountForParticipantTotal(500)).toBe(2);
    expect(SessionPresentComponent.pageSizeForParticipantTotal(24)).toBe(8);
    expect(SessionPresentComponent.pageSizeForParticipantTotal(500)).toBe(8);
    expect(
      SessionPresentComponent.pageSlice(
        Array.from({ length: 500 }, (_, i) => i),
        0,
      ),
    ).toHaveLength(8);
    expect(
      SessionPresentComponent.pageSlice(
        Array.from({ length: 500 }, (_, i) => i),
        2,
      ),
    ).toEqual(Array.from({ length: 8 }, (_, i) => i + 16));
  });

  it('zeigt große Leaderboards seitenweise statt sie hinter overflow:hidden abzuschneiden', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Hörsaal-Quiz',
      title: null,
      participantCount: 250,
      teamMode: false,
    });
    getLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 250 }, (_, index) => ({
        rank: index + 1,
        nickname: `Spieler ${index + 1}`,
        totalScore: 2500 - index,
        correctCount: 12,
        totalQuestions: 12,
        totalResponseTimeMs: 1000 + index * 10,
      })),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const pageSize = SessionPresentComponent.pageSizeForParticipantTotal(250);
    const items = fixture.nativeElement.querySelectorAll('.session-present__board-item');
    expect(items.length).toBe(pageSize);
    expect(fixture.nativeElement.textContent).toContain('Spieler 1');
    expect(fixture.nativeElement.textContent).not.toContain('Spieler 250');
    expect(fixture.nativeElement.querySelector('.session-present__board-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__finish--paged')).not.toBeNull();
    fixture.destroy();
  });

  it('hält die Gesamtrangliste an und blättert Personen und Teams von Hand', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Großes Quiz',
      title: null,
      participantCount: 20,
      teamMode: true,
    });
    getLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        rank: index + 1,
        nickname: `Spieler ${index + 1}`,
        totalScore: 200 - index,
        correctCount: 10,
        totalQuestions: 10,
        totalResponseTimeMs: 1000 + index * 20,
      })),
    );
    getTeamLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        rank: index + 1,
        teamName: `Team ${index + 1}`,
        teamColor: '#1565c0',
        totalScore: 120 - index,
        memberCount: 2,
        averageScore: 60,
      })),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const visibleNames = (selector: string): string[] =>
      [...fixture.nativeElement.querySelectorAll(selector)].map((node) =>
        (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );

    expect(fixture.nativeElement.querySelectorAll('.session-present__board-item').length).toBe(8);
    expect(fixture.nativeElement.querySelectorAll('.session-present__team-board-item').length).toBe(
      8,
    );
    expect(fixture.nativeElement.textContent).toContain('1–8 von 20');
    expect(fixture.nativeElement.textContent).toContain('1–8 von 12');
    expect(visibleNames('.session-present__board-name')).toEqual(
      Array.from({ length: 8 }, (_, index) => `Spieler ${index + 1}`),
    );
    expect(visibleNames('.session-present__team-board-name')).toEqual(
      Array.from({ length: 8 }, (_, index) => `Team ${index + 1}`),
    );

    const personalNext = fixture.nativeElement.querySelector(
      '[data-testid="presenter-personal-board-next"]',
    ) as HTMLButtonElement;
    personalNext.click();
    fixture.detectChanges();

    const pause = fixture.nativeElement.querySelector(
      '[data-testid="presenter-board-page-pause"]',
    ) as HTMLButtonElement;
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    expect(pause.textContent).toContain('Automatisch');
    expect(fixture.componentInstance.boardPagePaused()).toBe(true);
    expect(visibleNames('.session-present__board-name')).toEqual(
      Array.from({ length: 8 }, (_, index) => `Spieler ${index + 9}`),
    );
    expect(fixture.nativeElement.textContent).toContain('9–16 von 20');
    expect(visibleNames('.session-present__team-board-name')[0]).toBe('Team 1');

    const teamNext = fixture.nativeElement.querySelector(
      '[data-testid="presenter-team-board-next"]',
    ) as HTMLButtonElement;
    teamNext.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.session-present__team-board-item').length).toBe(
      4,
    );
    expect(visibleNames('.session-present__team-board-name')).toEqual([
      'Team 9',
      'Team 10',
      'Team 11',
      'Team 12',
    ]);
    expect(fixture.nativeElement.textContent).toContain('9–12 von 12');

    pause.click();
    fixture.detectChanges();
    expect(pause.getAttribute('aria-pressed')).toBe('false');
    expect(pause.textContent).toContain('Anhalten');
    expect(fixture.componentInstance.boardPagePaused()).toBe(false);
    fixture.destroy();
  });

  it('blättert die Gesamtrangliste nach zwölf Sekunden von selbst weiter', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Großes Quiz',
      title: null,
      participantCount: 20,
      teamMode: true,
      finishProjection: 'leaderboard',
    });
    getLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        rank: index + 1,
        nickname: `Spieler ${index + 1}`,
        totalScore: 200 - index,
        correctCount: 10,
        totalQuestions: 10,
        totalResponseTimeMs: 1000 + index * 20,
      })),
    );
    getTeamLeaderboardQueryMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        rank: index + 1,
        teamName: `Team ${index + 1}`,
        teamColor: '#1565c0',
        totalScore: 120 - index,
        memberCount: 2,
        averageScore: 60,
      })),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();

      const visibleNames = (selector: string): string[] =>
        [...fixture.nativeElement.querySelectorAll(selector)].map((node) =>
          (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
        );

      expect(visibleNames('.session-present__board-name')).toEqual(
        Array.from({ length: 8 }, (_, index) => `Spieler ${index + 1}`),
      );
      expect(fixture.nativeElement.textContent).toContain('1–8 von 20');

      await vi.advanceTimersByTimeAsync(12_000);
      fixture.detectChanges();

      expect(fixture.componentInstance.boardPagePaused()).toBe(false);
      expect(visibleNames('.session-present__board-name')).toEqual(
        Array.from({ length: 8 }, (_, index) => `Spieler ${index + 9}`),
      );
      expect(fixture.nativeElement.textContent).toContain('9–16 von 20');
      expect(visibleNames('.session-present__team-board-name')).toEqual([
        'Team 9',
        'Team 10',
        'Team 11',
        'Team 12',
      ]);
      expect(fixture.nativeElement.textContent).toContain('9–12 von 12');
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it('zeigt im Fehlerzustand einen direkten Link zur Startseite', async () => {
    getInfoQueryMock.mockRejectedValue(new Error('Session nicht gefunden.'));

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Session nicht gefunden.');
    expect(text).toContain('Zur Startseite');
    fixture.destroy();
  });

  it('kennzeichnet einen fehlgeschlagenen Meta-Poll als verzögerte Aktualisierung', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const stableSession = fixture.componentInstance.session();
    expect(stableSession).not.toBeNull();

    getInfoQueryMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    await fixture.componentInstance['refreshSessionMeta']();
    fixture.detectChanges();

    expect(fixture.componentInstance.session()).toEqual(stableSession);
    expect(fixture.componentInstance.showHomeCta()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-refresh-status"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Aktualisierung verzögert.');
    expect(fixture.nativeElement.textContent).toContain('Der letzte Stand bleibt sichtbar.');
    expect(fixture.nativeElement.textContent).not.toContain('Verbindung wird wiederhergestellt.');

    await fixture.componentInstance['refreshSessionMeta']();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-refresh-status"]'),
    ).toBeNull();
    fixture.destroy();
  });

  it('zeigt bei einem einzelnen fehlgeschlagenen Live-Abruf keinen Reconnect-Hinweis', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    liveQueryMock.mockRejectedValueOnce(new Error('Failed to fetch'));

    await fixture.componentInstance['refreshPresenterLiveData']();
    fixture.detectChanges();

    expect(fixture.componentInstance.connectionDegraded()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-refresh-status"]'),
    ).toBeNull();
    fixture.destroy();
  });

  it('abonniert eine beendete Status-Subscription nach erfolgreichem Meta-Poll erneut', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const statusCall = subscribeMock.mock.calls.find(
      ([input]) => typeof input === 'object' && input !== null && 'anonymousClientId' in input,
    );
    expect(statusCall).toBeDefined();
    const callsBeforeError = subscribeMock.mock.calls.length;

    (statusCall?.[1] as unknown as { onError?: () => void } | undefined)?.onError?.();
    await fixture.componentInstance['refreshSessionMeta']();

    expect(subscribeMock).toHaveBeenCalledTimes(callsBeforeError + 1);
    fixture.destroy();
  });

  it('zeigt eine angepinnte Frage prominent in der Presenter-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: true },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Welche Themen sind heute besonders wichtig?',
        upvoteCount: 7,
        status: 'PINNED',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Frage aus dem Publikum');
    expect(text).toContain('Wird gerade beantwortet');
    expect(text).toContain('Welche Themen sind heute besonders wichtig?');
    fixture.destroy();
  });

  it('projiziert Emoji-Reaktionen der laufenden Quizfrage passiv', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      enableEmojiReactions: true,
      preferredChannel: 'quiz',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 3,
      text: 'Was hilft beim Lernen?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM' as const,
      showQuestionTypeIndicators: true,
      currentRound: 2,
      timer: 30,
      answers: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          text: 'Üben',
          isCorrect: true,
        },
      ],
    });
    getReactionsQueryMock.mockResolvedValue({
      reactions: { '👏': 2, '🎉': 1 },
      total: 3,
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(getReactionsQueryMock).toHaveBeenCalledWith({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId: '11111111-1111-4111-8111-111111111111',
      round: 2,
    });
    const reactions = fixture.nativeElement.querySelector(
      '[data-testid="presenter-emoji-reactions"]',
    ) as HTMLElement | null;
    expect(reactions?.textContent).toContain('Reaktionen der Teilnehmenden');
    expect(reactions?.textContent).toContain('👏');
    expect(reactions?.textContent).toContain('2');
    expect(reactions?.querySelector('button, a, input')).toBeNull();
    fixture.destroy();
  });

  it('zeigt während einer Quiz-Pause eine exklusive Pause-Bühne', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'quiz',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 3,
      text: 'Diese Frage bleibt pausiert.',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM' as const,
      showQuestionTypeIndicators: true,
      timer: 30,
      answers: [],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]'),
    ).not.toBeNull();
    const statusHandlers = subscribeMock.mock.calls.at(-1)?.[1] as
      | {
          onData: (data: {
            status: 'PAUSED';
            currentQuestion: number;
            pausedFromStatus: 'ACTIVE';
            preferredChannel: 'quiz';
            presenterSurface: 'default';
          }) => void;
        }
      | undefined;
    statusHandlers?.onData({
      status: 'PAUSED',
      currentQuestion: 0,
      pausedFromStatus: 'ACTIVE',
      preferredChannel: 'quiz',
      presenterSurface: 'default',
    });
    fixture.detectChanges();

    const paused = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-paused"]',
    ) as HTMLElement | null;
    expect(paused?.dataset['state']).toBe('paused');
    expect(paused?.textContent).not.toContain('Presenter-Ansicht');
    expect(paused?.textContent).toContain('Quiz pausiert');
    expect(paused?.textContent).toContain('Gleich geht es mit derselben Frage weiter.');
    expect(paused?.textContent).toContain('ABC123');
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Diese Frage bleibt pausiert.');

    fixture.componentInstance.session.update((session) =>
      session ? { ...session, status: 'ACTIVE' } : session,
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-paused"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]'),
    ).not.toBeNull();
    fixture.destroy();
  });

  it('ersetzt die Lobby durch Q&A, sobald der ausgewählte Kanal präsentationsbereit ist', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: true },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Welche Themen sind heute besonders wichtig?',
        upvoteCount: 7,
        status: 'PINNED',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const root = fixture.nativeElement.querySelector('.session-present') as HTMLElement | null;
    expect(root?.classList.contains('session-present--lobby')).toBe(false);
    expect(root?.classList.contains('session-present--qa')).toBe(true);
    expect(fixture.nativeElement.querySelector('.session-present__lobby-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-list-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-placeholder')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Welche Themen sind heute besonders wichtig?',
    );
    expect(fixture.nativeElement.textContent).toContain('Kommt Kapitel 4 in der Klausur vor?');
    fixture.destroy();
  });

  it('zeigt auf der Q&A-Bühne Erstellungszeit und nur die Sortier-Metrik', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:12:00.000Z'));
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: true },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Hero mit Metriken',
        upvoteCount: 12,
        positiveVoteCount: 10,
        negativeVoteCount: 2,
        bestScore: 0.71,
        controversyScore: 0.42,
        isControversial: false,
        controversyInsufficientVotes: false,
        status: 'PINNED',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        text: 'Queue mit Metriken',
        upvoteCount: 4,
        positiveVoteCount: 3,
        negativeVoteCount: 1,
        bestScore: 0.55,
        controversyScore: 0.38,
        isControversial: false,
        controversyInsufficientVotes: false,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:05:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    try {
      fixture.componentInstance.presenterQaSortMode.set('BEST');
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      let text = fixture.nativeElement.textContent ?? '';
      expect(
        fixture.nativeElement.querySelector('[data-testid="presenter-qa-hero-meta"]'),
      ).not.toBeNull();
      expect(text).toContain('vor 12\u00A0Min.');
      expect(text).toContain('Zustimmung 71 %');
      expect(text).toContain('Zustimmung 55 %');
      expect(text).not.toContain('Geteilte Reaktionen');
      expect(text).not.toContain('Einseitig');

      fixture.componentInstance.presenterQaSortMode.set('CONTROVERSIAL');
      fixture.detectChanges();
      text = fixture.nativeElement.textContent ?? '';
      expect(text).toContain('Einseitig');
      expect(text).not.toContain('Geteilte Reaktionen');
      expect(text).not.toContain('Zustimmung:');
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it('zeigt für einen leeren Q&A-Kanal eine Standby-Bühne mit Beitrittsdaten', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const root = fixture.nativeElement.querySelector('.session-present') as HTMLElement;
    const standby = fixture.nativeElement.querySelector(
      '[data-testid="presenter-channel-standby"]',
    ) as HTMLElement | null;
    expect(root.classList.contains('session-present--standby')).toBe(true);
    expect(root.classList.contains('session-present--lobby')).toBe(false);
    expect(standby?.dataset['channel']).toBe('qa');
    expect(standby?.textContent).not.toContain('Presenter-Ansicht');
    expect(standby?.textContent).toContain('Fragen');
    expect(standby?.textContent).toContain('Noch keine freigegebenen Fragen.');
    expect(standby?.textContent).toContain('ABC123');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-qr')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-audience')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-stage')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]')).toBeNull();

    fixture.componentInstance.presenterQaOrderedQuestions.set([
      {
        passagesRedacted: false,
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Jetzt ist die Frage freigegeben.',
        upvoteCount: 1,
        status: 'ACTIVE',
        createdAt: '2026-08-25T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-channel-standby"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-stage')).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt für geschlossenes Q&A einen Hinweis statt vorhandener Fragen', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: false, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.presenterQaOrderedQuestions.set([
      {
        passagesRedacted: false,
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Diese alte Frage darf geschlossen nicht sichtbar sein.',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-08-25T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);
    fixture.detectChanges();

    const standby = fixture.nativeElement.querySelector(
      '[data-testid="presenter-channel-standby"]',
    ) as HTMLElement | null;
    expect(standby?.dataset['channel']).toBe('qa');
    expect(standby?.dataset['state']).toBe('closed');
    expect(standby?.textContent).toContain('Q&A ist geschlossen.');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Diese alte Frage darf geschlossen nicht sichtbar sein.',
    );
    expect(fixture.nativeElement.querySelector('.session-present__qa-stage')).toBeNull();

    fixture.componentInstance.session.update((session) =>
      session?.channels
        ? {
            ...session,
            channels: {
              ...session.channels,
              qa: { ...session.channels.qa, open: true },
            },
          }
        : session,
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-channel-standby"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-stage')).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt aktive Fragen als sichtbare Q&A-Warteschlange in der Presenter-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Kannst du das Beispiel noch einmal erklären?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Als Nächstes…');
    expect(text).toContain('Kommt Kapitel 4 in der Klausur vor?');
    expect(text).toContain('Kannst du das Beispiel noch einmal erklären?');
    expect(text).not.toContain('Q&A-Wortwolke');
    expectNoHostControls(fixture.nativeElement as HTMLElement);
    fixture.destroy();
  });

  it('ordnet die Q&A-Projektion im Landscape als Hero oben und Queue darunter an', () => {
    const scss = readFileSync(
      resolve(
        process.cwd(),
        'src/app/features/session/session-present/session-present.component.scss',
      ),
      'utf8',
    );
    expect(scss).toMatch(
      /\.session-present__qa-stage\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow-y:\s*auto/s,
    );
    expect(scss).toMatch(/\.session-present__qa-footer\s*\{[^}]*flex:\s*0\s*0\s*auto/s);
    expect(scss).toMatch(
      /\.session-present__qa-stage\s*>\s*\.session-present__qa-card,\s*\.session-present__qa-stage\s*>\s*\.session-present__qa-list-card\s*\{[^}]*width:\s*100%/s,
    );
    expect(scss).toMatch(/--present-qa-vote-breakdown-w:\s*clamp\(14rem,\s*28vmin,\s*20rem\)/);
    expect(scss).toMatch(
      /\.session-present__qa-text\s*\{[^}]*font-size:\s*clamp\(2\.25rem,\s*4\.6vmin/s,
    );
    expect(scss).toMatch(/\.session-present__qa-vote-breakdown--hero\s*\{/);
    expect(scss).toMatch(
      /\.session-present__qa-vote-breakdown\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
    );
    expect(scss).not.toMatch(/\.session-present__qa-list-votes\s*\{/);
    expect(scss).not.toMatch(/\.session-present__qa-vote-breakdown--queue\s*\{/);
    expect(scss).not.toMatch(
      /\.session-present__qa-stage\s+\.session-present__qa-list\s*\{[^}]*grid-auto-rows:\s*1fr/s,
    );
    expect(scss).not.toMatch(/--present-qa-vote-badge-w/);
    expect(scss).toMatch(/--present-qa-vote-breakdown-w/);
    expect(scss).toMatch(/\.session-present__qa-text\s*\{[^}]*max-width:\s*min\(100%,\s*58rem\)/s);
    expect(scss).not.toMatch(/grid-template-areas:\s*'pinned queue'/);
  });

  it('rückt den Hero vor und zeigt alle folgenden freigegebenen Fragen', () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.componentInstance.presenterQaOrderedQuestions.set(
      Array.from({ length: 6 }, (_, index) => ({
        id: `00000000-0000-4000-8000-00000000000${index}`,
        text: `Publikumsfrage ${index + 1}`,
        upvoteCount: 6 - index,
        status: 'ACTIVE' as const,
        createdAt: `2026-03-13T12:0${index}:00.000Z`,
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      })),
    );
    fixture.componentInstance.session.set({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 0, count: 6 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    } as never);

    expect(fixture.componentInstance.qaQueuePageCount()).toBe(6);
    expect(fixture.componentInstance.pinnedQaQuestion()?.text).toBe('Publikumsfrage 1');
    expect(fixture.componentInstance.visibleQaQueueQuestions()).toHaveLength(5);
    expect(fixture.componentInstance.visibleQaQueueQuestions().map((q) => q.text)).toEqual([
      'Publikumsfrage 2',
      'Publikumsfrage 3',
      'Publikumsfrage 4',
      'Publikumsfrage 5',
      'Publikumsfrage 6',
    ]);
    expect(fixture.componentInstance.qaQueueCountLabel()).toBe('5 Fragen');

    fixture.componentInstance.session.update((session) =>
      session
        ? {
            ...session,
            presenterPage: { context: 'qa-page', index: 1, count: 6 },
          }
        : session,
    );
    expect(fixture.componentInstance.pinnedQaQuestion()?.text).toBe('Publikumsfrage 2');
    expect(fixture.componentInstance.visibleQaQueueQuestions().map((q) => q.text)).toEqual([
      'Publikumsfrage 3',
      'Publikumsfrage 4',
      'Publikumsfrage 5',
      'Publikumsfrage 6',
    ]);
    expect(fixture.componentInstance.qaQueueCountLabel()).toBe('4 Fragen');
    fixture.destroy();
  });

  it('zeigt die Queue-Gesamtzahl nur im Badge und ohne Seiten-/Restzeile', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 0, count: 2 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Hero-Frage',
        upvoteCount: 9,
        positiveVoteCount: 12,
        negativeVoteCount: 3,
        status: 'PINNED',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Queue-Frage A',
        upvoteCount: 4,
        positiveVoteCount: 7,
        negativeVoteCount: 3,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        text: 'Queue-Frage B',
        upvoteCount: 3,
        positiveVoteCount: 5,
        negativeVoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:02:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('2 Fragen');
    const sortGroup = fixture.nativeElement.querySelector(
      '[data-testid="presenter-qa-sort"]',
    ) as HTMLElement | null;
    const sortText = sortGroup?.textContent ?? '';
    const controversyAt = sortText.indexOf('Kontroverse');
    const bestAt = sortText.indexOf('Klare Zustimmung');
    const netAt = sortText.indexOf('Stimmensaldo');
    const timeAt = sortText.indexOf('Zeit');
    expect(controversyAt).toBeGreaterThanOrEqual(0);
    expect(bestAt).toBeGreaterThan(controversyAt);
    expect(netAt).toBeGreaterThan(bestAt);
    expect(timeAt).toBeGreaterThan(netAt);
    expect(sortGroup?.querySelector('input:checked')?.getAttribute('value')).toBe('BEST');
    expect(text).not.toContain('Sortierung:');
    expect(text).toContain('Als Nächstes…');
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__qa-vote-stat--up').length,
    ).toBeGreaterThan(0);
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__qa-vote-stat--down').length,
    ).toBeGreaterThan(0);
    expect(text).toContain('12');
    expect(text).toContain('3');
    expect(text).not.toContain('weitere');
    expect(text).not.toMatch(/Fragen\s+\d+[–-]\d+\s+von/);
    expect(text).not.toMatch(/Seite\s+\d+\s*\/\s*\d+/);
    expect(fixture.nativeElement.querySelector('.session-present__qa-page')).toBeNull();
    const navigator = fixture.nativeElement.querySelector(
      '[data-testid="presenter-qa-navigator"]',
    ) as HTMLElement | null;
    expect(navigator?.textContent).toContain('Vorherige Frage');
    expect(navigator?.textContent).toContain('Nächste Frage');
    expect(navigator?.textContent).toMatch(/1\s*\/\s*3/);
    expect(fixture.nativeElement.querySelector('.session-present__qa-more')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-criteria')).not.toBeNull();
    fixture.destroy();
  });

  it('schaltet die Presenter-Sortierung auf Zeit und lädt die Bühne neu', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 1, count: 2 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    const bestFirst = {
      id: '11111111-1111-4111-8111-111111111111',
      text: 'Beste zuerst',
      upvoteCount: 4,
      positiveVoteCount: 4,
      negativeVoteCount: 0,
      status: 'ACTIVE' as const,
      createdAt: '2026-03-13T12:00:00.000Z',
      myVote: null,
      isOwn: false,
      passagesRedacted: false,
      hasUpvoted: false,
    };
    const newest = {
      ...bestFirst,
      id: '22222222-2222-4222-8222-222222222222',
      text: 'Neueste zuerst',
      createdAt: '2026-03-13T12:05:00.000Z',
    };
    qaListQueryMock.mockResolvedValue([bestFirst, newest]);
    setPresenterSortModeMutateMock.mockResolvedValue({
      sortMode: 'TIME',
      search: '',
      pinnedOnly: false,
      authorNickname: null,
      source: 'presenter',
    });
    setPresenterSurfaceMutateMock.mockImplementation(
      async (input: { page?: { context?: string; index?: number; count?: number } }) => ({
        presenterSurface: 'default',
        presenterPage: {
          context: input.page?.context ?? 'qa-page',
          index: input.page?.index ?? 0,
          count: input.page?.count ?? 2,
        },
      }),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    qaListQueryMock.mockResolvedValue([newest, bestFirst]);
    const timeButton = [
      ...fixture.nativeElement.querySelectorAll(
        '[data-testid="presenter-qa-sort"] mat-radio-button',
      ),
    ].find((button) => (button.textContent ?? '').includes('Zeit')) as HTMLElement | undefined;
    expect(timeButton?.textContent).toContain('Zeit');
    (timeButton?.querySelector('input') as HTMLInputElement | null)?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(setPresenterSortModeMutateMock).toHaveBeenCalledWith(
        {
          code: 'ABC123',
          sortMode: 'TIME',
          source: 'presenter',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(setPresenterSurfaceMutateMock).toHaveBeenCalledWith(
        {
          code: 'ABC123',
          page: { context: 'qa-page', index: 0, count: 2 },
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(
        fixture.nativeElement.querySelector('.session-present__qa-card')?.textContent,
      ).toContain('Neueste zuerst');
      expect(
        fixture.nativeElement.querySelector('[data-testid="presenter-qa-navigator"]')?.textContent,
      ).toMatch(/1\s*\/\s*2/);
    });
    expect(fixture.componentInstance.qaSortError()).toBe('');
    expect(fixture.componentInstance.qaNavError()).toBe('');
    fixture.destroy();
  });

  it('lässt die Sortierung stehen, solange der Fragenwechsel noch läuft', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 0, count: 2 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Erste Frage',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Zweite Frage',
        upvoteCount: 1,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    let releaseNavigation: (() => void) | undefined;
    const navigationSettled = new Promise<void>((resolve) => {
      releaseNavigation = resolve;
    });
    setPresenterSurfaceMutateMock.mockImplementation(
      async (input: { page?: { context?: string; index?: number; count?: number } }) => {
        await navigationSettled;
        return {
          presenterSurface: 'default',
          presenterPage: {
            context: input.page?.context ?? 'qa-page',
            index: input.page?.index ?? 0,
            count: input.page?.count ?? 2,
          },
        };
      },
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const navigation = fixture.componentInstance.changeQaProjectionPage(1);
    fixture.detectChanges();
    const sortGroup = fixture.nativeElement.querySelector(
      '[data-testid="presenter-qa-sort"]',
    ) as HTMLElement | null;
    expect(fixture.componentInstance.qaNavPending()).toBe(true);
    expect(
      [...(sortGroup?.querySelectorAll('input') ?? [])].every(
        (input) => (input as HTMLInputElement).disabled,
      ),
    ).toBe(true);

    await fixture.componentInstance.setPresenterQaSortMode('TIME');
    expect(setPresenterSortModeMutateMock).not.toHaveBeenCalled();
    expect(fixture.componentInstance.presenterQaSortMode()).toBe('BEST');

    releaseNavigation?.();
    await navigation;
    fixture.detectChanges();
    expect(fixture.componentInstance.session()?.presenterPage?.index).toBe(1);
    expect(fixture.componentInstance.presenterQaSortMode()).toBe('BEST');
    fixture.destroy();
  });

  it('behält die neue Sortierung, wenn der Navigator nicht auf 1 zurückgesetzt werden kann', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 1, count: 2 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Beste zuerst',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Neueste zuerst',
        upvoteCount: 1,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:05:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    setPresenterSortModeMutateMock.mockResolvedValue({
      sortMode: 'TIME',
      search: '',
      pinnedOnly: false,
      authorNickname: null,
      source: 'presenter',
    });
    setPresenterSurfaceMutateMock.mockRejectedValueOnce(new Error('offline'));

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    await fixture.componentInstance.setPresenterQaSortMode('TIME');
    fixture.detectChanges();

    expect(fixture.componentInstance.presenterQaSortMode()).toBe('TIME');
    expect(fixture.componentInstance.qaSortError()).toBe('');
    expect(fixture.componentInstance.qaNavError()).toContain(
      'Fragen konnten nicht gewechselt werden',
    );
    expect(fixture.componentInstance.session()?.presenterPage?.index).toBe(1);
    fixture.destroy();
  });

  it('hält die Q&A-Projektion mit maximal langen Fragen (1000 Zeichen) stabil', async () => {
    const maxText = 'A'.repeat(1000);
    expect(maxText).toHaveLength(1000);
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 0, count: 2 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: maxText,
        upvoteCount: 40,
        positiveVoteCount: 56,
        negativeVoteCount: 16,
        status: 'PINNED',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: maxText,
        upvoteCount: 20,
        positiveVoteCount: 30,
        negativeVoteCount: 10,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        text: maxText,
        upvoteCount: 10,
        positiveVoteCount: 18,
        negativeVoteCount: 8,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:02:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const heroText = root.querySelector('.session-present__qa-text');
    const queueItems = root.querySelectorAll('.session-present__qa-list-item');
    const queueVotes = root.querySelectorAll(
      '.session-present__qa-list .session-present__qa-vote-breakdown--hero',
    );

    expect(heroText?.textContent).toContain(maxText);
    expect(queueItems).toHaveLength(2);
    expect(queueVotes).toHaveLength(2);
    expect(root.querySelector('.session-present__qa-list-votes')).toBeNull();
    expect(root.querySelector('.session-present__qa-stage')).not.toBeNull();
    expect(root.textContent).toContain('56');
    expect(root.textContent).toContain('16');
    expect(root.textContent).toContain('30');
    expect(root.textContent).toContain('10');
    fixture.destroy();
  });

  it('zeigt in der Presenter-Ansicht eine upvote-gewichtete Q&A-Word-Cloud', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Kannst du das Beispiel noch einmal erklären?',
        upvoteCount: 4,
        status: 'PINNED',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const root = fixture.nativeElement.querySelector('.session-present') as HTMLElement | null;
    expect(root?.classList.contains('session-present--qa')).toBe(true);
    expect(root?.classList.contains('session-present--word-cloud')).toBe(true);
    expect(text).toContain('Q&A-Wortwolke');
    expect(text).toContain('2 Fragen');
    expect(fixture.componentInstance.presenterQaWordCloudQuestions()).toHaveLength(2);
    expect(fixture.componentInstance.presenterQaWordCloudWeightedResponses()[0]?.weight).toBe(3);
    expect(text).not.toContain('CSV speichern');
    expect(text).not.toContain('PNG speichern');
    expect(text).not.toContain('Antwort anzeigen');
    expect(text).not.toContain('Maximieren');
    expect(text).not.toContain('Als Nächstes…');
    expect(text).not.toContain('Je größer ein Wort, desto öfter wurde es genannt.');
    expect(fixture.nativeElement.querySelector('.session-present__qa-list-card')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-qa-navigator"]'),
    ).toBeNull();
    expectNoHostControls(fixture.nativeElement as HTMLElement);
    fixture.destroy();
  });

  it('schaltet den Presenter-Footer auf die nächste freigegebene Frage', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 0, count: 1 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({
        id: `00000000-0000-4000-8000-00000000000${index}`,
        text: `Publikumsfrage ${index + 1}`,
        upvoteCount: 3 - index,
        status: 'ACTIVE',
        createdAt: `2026-03-13T12:0${index}:00.000Z`,
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      })),
    );
    setPresenterSurfaceMutateMock.mockImplementation(
      async (input: { page?: { context?: string; index?: number; count?: number } }) => ({
        presenterSurface: 'default',
        presenterPage: {
          context: input.page?.context ?? 'qa-page',
          index: input.page?.index ?? 0,
          count: input.page?.count ?? 1,
        },
      }),
    );

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const previous = fixture.nativeElement.querySelector(
      '[data-testid="presenter-qa-previous"]',
    ) as HTMLButtonElement | null;
    const next = fixture.nativeElement.querySelector(
      '[data-testid="presenter-qa-next"]',
    ) as HTMLButtonElement | null;
    expect(previous?.getAttribute('aria-disabled')).toBe('true');
    expect(next?.getAttribute('aria-disabled')).not.toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.session-present__qa-list-item')).toHaveLength(
      2,
    );
    expect(fixture.nativeElement.textContent).toContain('Publikumsfrage 3');

    next?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setPresenterSurfaceMutateMock).toHaveBeenCalledWith(
      {
        code: 'ABC123',
        page: { context: 'qa-page', index: 1, count: 3 },
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fixture.componentInstance.pinnedQaQuestion()?.text).toBe('Publikumsfrage 2');
    expect(fixture.componentInstance.qaNavError()).toBe('');
    fixture.destroy();
  });

  it('meldet einen fehlgeschlagenen Fragenwechsel und behält die aktuelle Frage', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    const component = fixture.componentInstance;
    component.presenterQaOrderedQuestions.set([
      {
        id: '00000000-0000-4000-8000-000000000001',
        text: 'Erste Frage',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        text: 'Zweite Frage',
        upvoteCount: 1,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    component.session.set({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      preferredChannel: 'qa',
      presenterSurface: 'default',
      presenterPage: { context: 'qa-page', index: 0, count: 2 },
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    } as never);
    setPresenterSurfaceMutateMock.mockRejectedValueOnce(new Error('offline'));

    await component.changeQaProjectionPage(1);

    expect(component.qaNavPending()).toBe(false);
    expect(component.qaNavError()).toContain('Fragen konnten nicht gewechselt werden');
    expect(component.pinnedQaQuestion()?.text).toBe('Erste Frage');
    fixture.destroy();
  });

  it('zeigt die Q&A-Wortwolke auch wenn der Beitragskanal geschlossen ist', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: false, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.showQaWordCloud()).toBe(true);
    expect(fixture.nativeElement.textContent as string).toContain('Q&A-Wortwolke');
    fixture.destroy();
  });

  it('zeigt eine ausdrücklich projizierte Q&A-Wortwolke auch nach Quizabschluss', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'quiz',
      presenterSurface: 'qaWordCloud',
      finishProjection: 'idle',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: false, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.showQaWordCloud()).toBe(true);
    expect(fixture.componentInstance.showFinishProjection()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-finish-idle"]')).toBeNull();
    expect(fixture.nativeElement.textContent as string).toContain('Q&A-Wortwolke');

    fixture.componentInstance.session.update((session) =>
      session ? { ...session, presenterSurface: 'default' } : session,
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.showQaWordCloud()).toBe(false);
    expect(fixture.componentInstance.showFinishProjection()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-finish-idle"]'),
    ).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt die Q&A-Wortwolke statt der leeren Freitext-Wolke', async () => {
    liveQueryMock.mockResolvedValue({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      questionOrder: 1,
      questionType: 'FREETEXT',
      questionText: 'Was war hilfreich?',
      responses: [],
      updatedAt: '2026-03-08T12:00:00.000Z',
    });
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.showQaWordCloud()).toBe(true);
    expect(fixture.componentInstance.showPresenterFreetextResultsStage()).toBe(false);
    expect(text).toContain('Q&A-Wortwolke');
    expect(text).not.toContain('Noch keine Freitext-Antworten vorhanden.');
    expect(text).not.toContain('Live-Freitext');
    fixture.destroy();
  });

  it('übernimmt die Host-Wortwolken-Einstellungen auf dem Presenter', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    getQaWordCloudProjectionQueryMock.mockResolvedValue({
      projection: {
        mode: 'SEMANTIC',
        effectiveMode: 'SEMANTIC',
        metric: 'BEST',
        locale: 'de',
        analysisEntries: [
          {
            key: 'kapitel-4',
            label: 'Stichprobengröße',
            labelOrigin: 'model',
            count: 7,
            basisLabel: 'Kapitel',
            members: [
              {
                sourceId: '11111111-1111-4111-8111-111111111111',
                text: 'Kommt Kapitel 4 in der Klausur vor?',
                weight: 4,
              },
            ],
            variants: ['Kapitel 4'],
            confidence: 0.88,
          },
        ],
        analyzedQuestionCount: 1,
        eligibleQuestionCount: 1,
        modelVersion: 'topic-v1',
        smoothingActive: false,
      },
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.presenterQaWordCloudTerms()).toBeNull();
    expect(fixture.componentInstance.presenterQaWordCloudAnalysisEntries()).toMatchObject([
      { label: 'Stichprobengröße', labelOrigin: 'model' },
    ]);
    expect(text).toContain('Themen in den Fragen');
    expect(text).toContain('Stichprobengröße');
    expect(text).toContain('Inhaltlich ähnliche Fragen sind zu Themen zusammengefasst.');
    expect(fixture.componentInstance.qaWordCloudReadingHint()).toContain(
      'Größer erscheinen Begriffe',
    );
    expect(text).toContain('Das sagt nichts über ihre fachliche Richtigkeit aus.');
    expect(text).not.toContain('ohne Wort-Glättung');

    fixture.componentInstance.qaWordCloudProjection.update((projection) =>
      projection ? { ...projection, effectiveMode: undefined } : null,
    );
    expect(fixture.componentInstance.qaWordCloudDisplayMode()).toBe('SEMANTIC');
    fixture.destroy();
  });

  it('zeigt in der Fragen-Pill die ausgewertete Korpusgroesse, nicht die gekuerzten Mitglieder', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    getQaWordCloudProjectionQueryMock.mockResolvedValue({
      projection: {
        mode: 'THEME',
        metric: 'TIME',
        locale: 'de',
        analysisEntries: [
          {
            key: 'klausur',
            label: 'Klausur',
            count: 1,
            basisLabel: 'Klausur',
            members: [
              {
                sourceId: '11111111-1111-4111-8111-111111111111',
                text: 'Kommt Kapitel 4 in der Klausur vor?',
                weight: 1,
              },
            ],
            variants: ['Klausur'],
            confidence: 0.8,
            memberCount: 80,
            membersTruncated: true,
          },
        ],
        analyzedQuestionCount: 120,
        eligibleQuestionCount: 120,
        modelVersion: 'theme-v1',
        smoothingActive: false,
      },
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const pills = [...fixture.nativeElement.querySelectorAll('.word-cloud__meta-pill')].map((el) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(pills).toContain('120 von 120 Fragen analysiert');
    expect(fixture.nativeElement.textContent).toContain('Pro Frage zählt er einmal.');
    expect(
      pills.some((pill) => pill === '1 Frage' || pill === '12 Fragen' || pill === 'Zeit'),
    ).toBe(false);
    fixture.destroy();
  });

  it('zeigt Option, Sortierung und Glättung als Pills neben Begriffe und Fragen', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    getQaWordCloudProjectionQueryMock.mockResolvedValue({
      projection: {
        mode: 'LEXICAL',
        metric: 'CONTROVERSIAL',
        locale: 'de',
        analysisEntries: [],
        analyzedQuestionCount: 1,
        eligibleQuestionCount: 1,
        modelVersion: null,
        smoothingActive: true,
      },
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const pills = [
      ...fixture.nativeElement.querySelectorAll('.word-cloud__meta-pill--context'),
    ].map((el) => (el.textContent ?? '').trim());
    expect(fixture.componentInstance.qaWordCloudReadingHint()).toContain(
      'Größer erscheinen Begriffe',
    );
    expect(pills).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Dafür- und Dagegen-Stimmen');
    fixture.destroy();
  });

  it('gewichtet die Fallback-Wortwolke nach der projizierten Metrik', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 25,
        bestScore: 0.25,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
        upvoteCount: 1,
        bestScore: 0.9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    getQaWordCloudProjectionQueryMock.mockResolvedValue({
      projection: {
        mode: 'LEXICAL',
        metric: 'BEST',
        locale: 'de',
        analysisEntries: [],
        analyzedQuestionCount: 2,
        eligibleQuestionCount: 2,
        modelVersion: null,
      },
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.presenterQaWordCloudAnalysisEntries()).toBeNull();
    expect(fixture.componentInstance.presenterQaWordCloudTermDocuments()).toEqual([
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        weight: getQaWordCloudQuestionWeight({ upvoteCount: 25, bestScore: 0.25 }, 'BEST'),
      }),
      expect.objectContaining({
        id: '22222222-2222-4222-8222-222222222222',
        weight: getQaWordCloudQuestionWeight({ upvoteCount: 1, bestScore: 0.9 }, 'BEST'),
      }),
    ]);
    fixture.destroy();
  });

  it('zeigt bei fehlender Wortwolken-Projektion kein Verbindungsbanner', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    getQaWordCloudProjectionQueryMock.mockRejectedValue(new Error('Failed to fetch'));

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.connectionDegraded()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-refresh-status"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent as string).toContain('Q&A-Wortwolke');
    fixture.destroy();
  });

  it('holt auf der Q&A-Wortwolke keine Freitext- oder Quiz-Live-Daten', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'qa',
      presenterSurface: 'qaWordCloud',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    liveQueryMock.mockClear();
    getCurrentQuestionForHostQueryMock.mockClear();
    getHostVoteProgressQueryMock.mockClear();
    liveQueryMock.mockRejectedValue(new Error('Failed to fetch'));
    getCurrentQuestionForHostQueryMock.mockRejectedValue(new Error('Failed to fetch'));
    getHostVoteProgressQueryMock.mockRejectedValue(new Error('Failed to fetch'));

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(fixture.componentInstance.showQaWordCloud()).toBe(true);
    });
    fixture.detectChanges();

    expect(liveQueryMock).not.toHaveBeenCalled();
    expect(getCurrentQuestionForHostQueryMock).not.toHaveBeenCalled();
    expect(getHostVoteProgressQueryMock).not.toHaveBeenCalled();
    expect(fixture.componentInstance.connectionDegraded()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-refresh-status"]'),
    ).toBeNull();
    fixture.destroy();
  });

  it('zeigt für Blitzlicht ohne gestartete Runde eine Standby-Bühne', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'quickFeedback',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    quickFeedbackResultsQueryMock.mockRejectedValue(new Error('not found'));

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const standby = fixture.nativeElement.querySelector(
      '[data-testid="presenter-channel-standby"]',
    ) as HTMLElement | null;
    expect(standby?.dataset['channel']).toBe('quickFeedback');
    expect(standby?.textContent).toContain('Blitzlicht');
    expect(standby?.textContent).toContain('Blitzlicht noch nicht gestartet.');
    expect(standby?.textContent).toContain('ABC123');
    expect(fixture.nativeElement.querySelector('.session-present__feedback-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]')).toBeNull();

    fixture.componentInstance.quickFeedbackResult.set({
      type: 'YESNO',
      locked: false,
      totalVotes: 0,
      distribution: { YES: 0, NO: 0, MAYBE: 0 },
      currentRound: 1,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-channel-standby"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__feedback-card')).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt für geschlossenes Blitzlicht einen Hinweis statt alter Ergebnisse', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'quickFeedback',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: false },
      },
    });
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'YESNO',
      locked: true,
      totalVotes: 9,
      distribution: { YES: 5, NO: 2, MAYBE: 2 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const standby = fixture.nativeElement.querySelector(
      '[data-testid="presenter-channel-standby"]',
    ) as HTMLElement | null;
    expect(standby?.dataset['channel']).toBe('quickFeedback');
    expect(standby?.dataset['state']).toBe('closed');
    expect(standby?.textContent).toContain('Blitzlicht ist geschlossen.');
    expect(fixture.nativeElement.querySelector('.session-present__feedback-card')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('9 Stimmen');

    fixture.componentInstance.session.update((session) =>
      session?.channels
        ? {
            ...session,
            channels: {
              ...session.channels,
              quickFeedback: { ...session.channels.quickFeedback, open: true },
            },
          }
        : session,
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-channel-standby"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__feedback-card')).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt laufendes Blitzlicht in der Presenter-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'quickFeedback',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true },
      },
    });
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'YESNO',
      locked: false,
      showLiveResults: true,
      resultsVisible: true,
      totalVotes: 9,
      distribution: { YES: 5, NO: 2, MAYBE: 2 },
      currentRound: 2,
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).replace(/\u00a0/g, ' ');
    expect(text).toContain('Blitzlicht');
    expect(text).toContain('Ja · Nein · Vielleicht');
    expect(text).toContain('Runde 2 läuft');
    expect(text).toContain('9 Stimmen');
    expectNoHostControls(fixture.nativeElement as HTMLElement);
    fixture.destroy();
  });

  it('zeigt bei verdeckten Blitzlicht-Ergebnissen nur die Beteiligung', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 8,
      teamMode: false,
      preferredChannel: 'quickFeedback',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'YESNO',
      locked: false,
      showLiveResults: false,
      resultsVisible: false,
      totalVotes: 3,
      distribution: { YES: 0, NO: 0, MAYBE: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('3 Stimmen');
    expect(text).toContain('Antworten werden gesammelt');
    expect(text).toContain('Die Verteilung erscheint nach dem Pausieren oder Rundenende.');
    expect(fixture.nativeElement.querySelector('.session-present__feedback-bars')).toBeNull();
    fixture.destroy();
  });

  it('zeigt Prozentwerte im Blitzlicht erst ab fünf Stimmen', () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.componentInstance.quickFeedbackResult.set({
      type: 'YESNO',
      locked: false,
      showLiveResults: true,
      resultsVisible: true,
      totalVotes: 4,
      distribution: { YES: 3, NO: 1, MAYBE: 0 },
    });
    expect(fixture.componentInstance.quickFeedbackShowsPercentages()).toBe(false);

    fixture.componentInstance.quickFeedbackResult.update((result) =>
      result ? { ...result, totalVotes: 5 } : result,
    );
    expect(fixture.componentInstance.quickFeedbackShowsPercentages()).toBe(true);
    fixture.destroy();
  });

  it('zeigt ausschließlich Blitzlicht, wenn Q&A-Daten weiterhin vorhanden sind', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preferredChannel: 'quickFeedback',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Diese Frage darf nicht parallel sichtbar bleiben.',
        upvoteCount: 5,
        status: 'PINNED',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        passagesRedacted: false,
        hasUpvoted: false,
      },
    ]);
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'YESNO',
      locked: false,
      totalVotes: 3,
      distribution: { YES: 2, NO: 1, MAYBE: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.session-present__feedback-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-list-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__word-cloud-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-placeholder')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Diese Frage darf nicht parallel sichtbar bleiben.',
    );
    fixture.destroy();
  });

  it('zeigt in der Lobby den Session-Code für den Beamer', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      quizMotifImageUrl: 'https://example.com/motif.jpg',
      quizMotifImageCredit: 'Pass / Le Brun (1821), via Wikimedia Commons',
    });
    liveQueryMock.mockResolvedValue({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId: null,
      questionOrder: null,
      questionType: null,
      questionText: null,
      responses: [],
      updatedAt: '2026-03-08T12:00:00.000Z',
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('ABC123');
    expect(text).toContain('arsnova.eu');
    expect(text).toContain('Warten auf die anderen');
    expect(text).not.toContain('Mit Code oder QR-Code teilnehmen.');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-brand')).toBeTruthy();
    expect(text).not.toContain('Aktuelle Frage ist keine Freitext-Frage.');
    const motif = fixture.nativeElement.querySelector(
      '.session-present__lobby-motif',
    ) as HTMLImageElement | null;
    expect(motif?.getAttribute('src')).toBe('https://example.com/motif.jpg');
    const motifCredit = fixture.nativeElement.querySelector(
      '.session-present__lobby-motif-credit',
    ) as HTMLElement | null;
    expect(motifCredit?.textContent?.trim()).toBe('Pass / Le Brun (1821), via Wikimedia Commons');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-join-stack')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.session-present__lobby-stage--with-motif'),
    ).toBeTruthy();
    const codeEl = fixture.nativeElement.querySelector(
      '.session-present__lobby-code',
    ) as HTMLElement | null;
    expect(codeEl?.textContent?.trim()).toBe('ABC123');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-qr')).toBeTruthy();
    fixture.destroy();
  });

  it('zeigt in der Lobby Teams und einfliegende Teilnehmende', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 2,
      teamMode: true,
      anonymousMode: false,
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamName: 'Rot',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Milo',
          teamId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          teamName: 'Blau',
        },
      ],
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Rot',
          color: '#c62828',
          memberCount: 1,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Blau',
          color: '#1565c0',
          memberCount: 1,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Rot');
    expect(text).toContain('Blau');
    expect(text).toContain('Luna');
    expect(text).toContain('Milo');
    expect(text).toContain('Warten auf die anderen');
    expect(text).toContain('2 Teilnehmende');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-audience')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-teams-grid')).toBeTruthy();
    const teamNames = [
      ...fixture.nativeElement.querySelectorAll('.session-present__lobby-team-name'),
    ].map((el) => (el.textContent ?? '').trim());
    expect(teamNames).toEqual(['Rot', 'Blau']);
    const teamCounts = [
      ...fixture.nativeElement.querySelectorAll('.session-present__lobby-team-count'),
    ].map((el) => (el.textContent ?? '').trim());
    expect(teamCounts.every((label) => label.includes('Mitglied'))).toBe(true);
    expect(fixture.nativeElement.querySelector('app-foyer-entrance-layer')).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-mat-icon').length,
    ).toBe(2);
    expect(fixture.nativeElement.querySelector('.session-present__lobby-team--crowd')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-team--packed')).toBeNull();
    const sparseMembers = fixture.nativeElement.querySelector(
      '.session-present__lobby-team-members',
    ) as HTMLElement | null;
    expect(sparseMembers?.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
    fixture.destroy();
  });

  it('hält sparse Team-Pills kompakt statt Kartenhöhe und -breite', () => {
    const styles = readFileSync(
      resolve(
        process.cwd(),
        'src/app/features/session/session-present/session-present.component.scss',
      ),
      'utf8',
    );

    expect(styles).toMatch(
      /\.session-present__lobby-team-members \{[\s\S]*?grid-auto-rows:\s*auto;[\s\S]*?align-items:\s*start;[\s\S]*?justify-items:\s*start;/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-team-members li \{[\s\S]*?width:\s*fit-content;[\s\S]*?max-width:\s*100%;/,
    );
    expect(styles).not.toMatch(
      /\.session-present__lobby-team-members li \{\s*container-type:\s*size;/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-team--crowd \.session-present__lobby-team-members,[\s\S]*?\.session-present__lobby-team--packed \.session-present__lobby-team-members \{[\s\S]*?align-items:\s*stretch;[\s\S]*?justify-items:\s*stretch;/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-team--crowd \.session-present__lobby-team-members \{[\s\S]*?grid-auto-rows:\s*minmax\(min-content,\s*1fr\);/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-team--packed \.session-present__lobby-team-members \{[\s\S]*?grid-auto-rows:\s*minmax\(0,\s*1fr\);/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-team--crowd \.session-present__lobby-team-members li,[\s\S]*?\.session-present__lobby-team--packed \.session-present__lobby-team-members li \{[\s\S]*?container-type:\s*size;/,
    );
    const memberChipRule = styles.match(
      /\.session-present__lobby-team-members li,\s*\.session-present__lobby-person \{([^}]+)\}/,
    )?.[1];
    expect(memberChipRule).toMatch(/background:\s*transparent;/);
    expect(memberChipRule).toMatch(/border-radius:\s*0;/);
    expect(memberChipRule).not.toMatch(/corner-full/);
    expect(styles).toMatch(
      /\.session-present__lobby-team--crowd \.session-present__lobby-nick-icon,[\s\S]*?\.session-present__lobby-team--packed \.session-present__lobby-nick-icon \{[\s\S]*?min\(86cqh,\s*80cqw\)/,
    );
    expect(styles).not.toMatch(
      /\.session-present__lobby-audience--kindergarten \.session-present__lobby-team-members \{[\s\S]*?grid-auto-rows:\s*auto;/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-audience--kindergarten \.session-present__lobby-team-members \{[\s\S]*?grid-auto-rows:\s*minmax\(0,\s*1fr\);[\s\S]*?align-items:\s*stretch;[\s\S]*?justify-items:\s*stretch;/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-audience--kindergarten \.session-present__lobby-team-members li \{[\s\S]*?container-type:\s*size;/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-audience--kindergarten[\s\S]*?\.session-present__lobby-team:not\(\.session-present__lobby-team--packed\)[\s\S]*?\.session-present__lobby-nick-icon \{[\s\S]*?min\(86cqh,\s*80cqw\)[\s\S]*?16rem/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-audience--kindergarten \.session-present__lobby-person-col \{[\s\S]*?border:\s*none;[\s\S]*?background:\s*transparent;[\s\S]*?container-type:\s*size;/,
    );
    expect(styles).toMatch(
      /\.session-present__lobby-audience--kindergarten:not\(\.session-present__lobby-audience--packed\)[\s\S]*?\.session-present__lobby-person-col[\s\S]*?\.session-present__lobby-nick-icon \{[\s\S]*?min\(86cqh,\s*80cqw\)[\s\S]*?16rem/,
    );
  });

  it('packt volle Teamspalten ohne Scroll und haelt Namen nur fuer den Screenreader', async () => {
    const teamId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const participants = Array.from({ length: 30 }, (_, index) => ({
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
      nickname: `Person ${index + 1}`,
      teamId,
      teamName: 'Rot',
    }));
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 30,
      teamMode: true,
      anonymousMode: false,
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 30,
      recentArrivals: participants.slice(-20),
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [
        {
          id: teamId,
          name: 'Rot',
          color: '#c62828',
          memberCount: 30,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="presenter-audience-summary"]',
    );
    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain('30');
    expect(
      fixture.nativeElement.querySelector(
        '.session-present__lobby-person-col, .session-present__lobby-team-members',
      ),
    ).toBeNull();
    fixture.destroy();
  });

  it('fuellt Teamkarten auf die echte Mitgliederzahl statt 20 Ankuenfte zu strecken', async () => {
    const teamA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const teamB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const arrivals = [
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
        nickname: `Apfel ${index + 1}`,
        teamId: teamA,
        teamName: 'Äpfel',
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
        nickname: `Birne ${index + 1}`,
        teamId: teamB,
        teamName: 'Birnen',
      })),
    ];
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 60,
      teamMode: true,
      anonymousMode: false,
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 60,
      recentArrivals: arrivals,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: teamA, name: 'Äpfel', color: '#c62828', memberCount: 30 },
        { id: teamB, name: 'Birnen', color: '#1565c0', memberCount: 30 },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="presenter-audience-summary"]',
    );
    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain('60');
    expect(
      fixture.nativeElement.querySelector(
        '.session-present__lobby-person-col, .session-present__lobby-team-members',
      ),
    ).toBeNull();
    fixture.destroy();
  });

  it.each([
    {
      label: 'Mittelstufe',
      nicknameTheme: 'MIDDLE_SCHOOL' as const,
      anonymousMode: false,
      icon: 'school',
      themeClass: 'session-present__lobby-packed-identity--middle-school',
    },
    {
      label: 'Oberstufe',
      nicknameTheme: 'HIGH_SCHOOL' as const,
      anonymousMode: false,
      icon: 'school',
      themeClass: 'session-present__lobby-packed-identity--high-school',
    },
    {
      label: 'Nobelpreis',
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      anonymousMode: false,
      icon: 'military_tech',
      themeClass: 'session-present__lobby-packed-identity--nobel',
    },
  ])(
    'zeigt im Packed-Modus fuer $label höchstens 20 Theme-Icons mit stabilen Eingangsnummern',
    async ({ nicknameTheme, anonymousMode }) => {
      const participants = Array.from({ length: 26 }, (_, index) => ({
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
        nickname: `Person ${index + 1}`,
        teamId: null,
        teamName: null,
      }));
      getInfoQueryMock.mockResolvedValue({
        id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        serverTime: MOCK_SERVER_TIME,
        code: 'ABC123',
        type: 'QUIZ',
        status: 'LOBBY',
        quizName: 'Quiz',
        title: null,
        participantCount: participants.length,
        teamMode: false,
        anonymousMode,
        nicknameTheme,
      });
      getParticipantSummaryQueryMock.mockResolvedValue({
        participantCount: participants.length,
        recentArrivals: [...participants.slice(-20)].reverse(),
      });
      getTeamsQueryMock.mockResolvedValue({ teamCount: 0, teams: [] });

      const fixture = TestBed.createComponent(SessionPresentComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.session-present__lobby-packed-identity'),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="presenter-audience-summary"]')
          ?.textContent,
      ).toContain('26');
      fixture.destroy();
    },
  );

  it('zeigt im Anonymmodus nur das Aggregat und keine öffentliche individuelle Liste', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Quiz',
      title: null,
      participantCount: 26,
      teamMode: false,
      anonymousMode: true,
      nicknameTheme: 'HIGH_SCHOOL',
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 26,
      connectedCount: 26,
      revision: 26,
      recentArrivals: [],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('26 Teilnehmende');
    expect(
      fixture.nativeElement.querySelector('.session-present__lobby-packed-identity'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-nick-text')).toBeNull();
    fixture.destroy();
  });

  it('zeigt Kindergarten-Teilnehmende in der Lobby mit Tier-Icon', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 2,
      teamMode: true,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Roter Drache',
          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamName: 'Rot',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Grüner Frosch',
          teamId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          teamName: 'Blau',
        },
      ],
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Rot',
          color: '#c62828',
          memberCount: 1,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Blau',
          color: '#1565c0',
          memberCount: 1,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const icons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.session-present__lobby-nick-icon',
      ),
      (el) => (el.textContent ?? '').trim(),
    );
    expect(icons).toEqual(['🐉', '🐸']);
    expect(fixture.nativeElement.querySelector('.session-present__lobby-nick-mat-icon')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.session-present__lobby-audience--kindergarten'),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-team--crowd')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-team--packed')).toBeNull();
    const kindergartenMembers = [
      ...fixture.nativeElement.querySelectorAll('.session-present__lobby-team-members'),
    ] as HTMLElement[];
    expect(
      kindergartenMembers.every(
        (list) => list.style.gridTemplateColumns === 'repeat(1, minmax(0, 1fr))',
      ),
    ).toBe(true);
    const nickTexts = [
      ...fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-text'),
    ] as HTMLElement[];
    expect(nickTexts.every((node) => node.classList.contains('sr-only'))).toBe(true);
    fixture.destroy();
  });

  it('zeigt Kindergarten-Tiere auch bei ACTIVE ohne aktuelle Quizfrage', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 2,
      teamMode: true,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(null);
    liveQueryMock.mockRejectedValue(new Error('no live freetext'));
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Roter Drache 1',
          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamName: 'Rot',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Grüner Frosch 2',
          teamId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          teamName: 'Blau',
        },
      ],
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Rot',
          color: '#c62828',
          memberCount: 1,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Blau',
          color: '#1565c0',
          memberCount: 1,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.showLobbyProjection()).toBe(true);
    const icons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.session-present__lobby-nick-icon',
      ),
      (el) => (el.textContent ?? '').trim(),
    );
    expect(icons).toEqual(['🐉', '🐸']);
    fixture.destroy();
  });

  it('hält die Lobby zu, wenn ACTIVE bereits eine Quizfrage trägt', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      currentQuestion: 0,
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 2,
      teamMode: true,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(null);
    liveQueryMock.mockRejectedValue(new Error('no live freetext'));
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [],
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Rot',
          color: '#c62828',
          memberCount: 1,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Blau',
          color: '#1565c0',
          memberCount: 1,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.showLobbyProjection()).toBe(false);
    expect(fixture.nativeElement.querySelector('.session-present__lobby-audience')).toBeNull();
    fixture.destroy();
  });

  it('füllt Kindergarten-Teams ohne Personen-Platzhalter in Kreisen', async () => {
    const teamId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 20,
      teamMode: true,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 20,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Lavendelblaue Eule 27',
          teamId,
          teamName: 'Rot',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Beiger Igel 25',
          teamId,
          teamName: 'Rot',
        },
      ],
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [{ id: teamId, name: 'Rot', color: '#c62828', memberCount: 20 }],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="presenter-audience-summary"]',
    );
    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain('20');
    expect(
      fixture.nativeElement.querySelector(
        '.session-present__lobby-person-col, .session-present__lobby-team-members',
      ),
    ).toBeNull();
    fixture.destroy();
  });

  it('zeigt alle Kita-Tiere der Ankunftsliste statt nur 20 Icons', async () => {
    const teamA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const teamB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const names = NICKNAME_LISTS.KINDERGARTEN.slice(0, 40);
    const arrivals = [
      ...names.map((nickname, index) => ({
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
        nickname: `${nickname} ${index + 1}`,
        teamId: teamA,
        teamName: 'Äpfel',
      })),
      ...names.map((nickname, index) => ({
        id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
        nickname: `${nickname} ${index + 41}`,
        teamId: teamB,
        teamName: 'Birnen',
      })),
      {
        id: '11111111-1111-4111-8111-000000000041',
        nickname: 'Roter Drache 81',
        teamId: teamA,
        teamName: 'Äpfel',
      },
    ];
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 81,
      teamMode: true,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(null);
    liveQueryMock.mockRejectedValue(new Error('no live freetext'));
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 81,
      recentArrivals: arrivals,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: teamA, name: 'Äpfel', color: '#c62828', memberCount: 41 },
        { id: teamB, name: 'Birnen', color: '#1565c0', memberCount: 40 },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-icon').length).toBe(
      0,
    );
    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-audience-summary"]')
        ?.textContent,
    ).toContain('81');
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__lobby-placeholder').length,
    ).toBe(0);
    expect(fixture.nativeElement.querySelector('.session-present__lobby-nick-mat-icon')).toBeNull();
    fixture.destroy();
  });

  it('hält Beitritt und Wartehinweis ohne Motiv und ohne Teamspalten in der Fläche', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: '2KTYP7',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Quiz',
      title: null,
      participantCount: 0,
      teamMode: false,
      anonymousMode: false,
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 0,
      recentArrivals: [],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '.session-present__lobby-stage',
    ) as HTMLElement | null;
    expect(stage).toBeTruthy();
    expect(stage?.classList.contains('session-present__lobby-stage--solo-join')).toBe(false);
    expect(stage?.classList.contains('session-present__lobby-stage--with-motif')).toBe(false);
    expect(fixture.nativeElement.querySelector('.session-present--lobby-solo')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-poster')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-card')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-qr')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-audience')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.session-present__lobby-audience--empty'),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-teams-grid')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-people-cols')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ABC123');
    expect(fixture.nativeElement.textContent).toContain('Warten auf die anderen');
    fixture.destroy();
  });

  it('zeigt ohne Teams einfliegende Teilnehmende in einzelnen Spalten', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Quiz',
      title: null,
      participantCount: 2,
      teamMode: false,
      anonymousMode: false,
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Milo',
          teamId: null,
          teamName: null,
        },
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: null,
          teamName: null,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Luna');
    expect(text).toContain('Milo');
    expect(text).toContain('2 Teilnehmende');
    expect(fixture.componentInstance.lobbyPeople().map((person) => person.nickname)).toEqual([
      'Milo',
      'Luna',
    ]);
    expect(fixture.nativeElement.querySelector('.session-present__lobby-people-cols')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__lobby-person-col').length,
    ).toBe(2);
    expect(
      fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-mat-icon').length,
    ).toBe(2);
    expect(
      fixture.nativeElement.querySelector('.session-present__lobby-stage--solo-join'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present--lobby-solo')).toBeNull();
    fixture.destroy();
  });

  it('laesst neue Teilnehmende erst einfliegen und zeigt sie danach noch nicht als Badge', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Quiz',
      title: null,
      participantCount: 1,
      teamMode: false,
      anonymousMode: false,
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 1,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: null,
          teamName: null,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Luna');
    expect(fixture.nativeElement.querySelector('app-foyer-entrance-layer')).toBeNull();

    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Milo',
          teamId: null,
          teamName: null,
        },
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: null,
          teamName: null,
        },
      ],
    });
    await (
      fixture.componentInstance as unknown as { refreshLobbyAudience(): Promise<void> }
    ).refreshLobbyAudience();
    fixture.detectChanges();

    expect(fixture.componentInstance.lobbyFoyerChips().length).toBe(1);
    expect(fixture.componentInstance.lobbyPeople().map((person) => person.nickname)).toEqual([
      'Luna',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Luna');
    expect(
      fixture.nativeElement.querySelector('.session-present__lobby-nick-text')?.textContent,
    ).not.toContain('Milo');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-foyer')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-foyer-entrance-layer')).toBeTruthy();

    fixture.componentInstance.lobbyFoyerChips.set([]);
    fixture.componentInstance.hiddenFoyerParticipantIds.set(new Set());
    fixture.detectChanges();

    expect(fixture.componentInstance.lobbyPeople().map((person) => person.nickname)).toEqual([
      'Milo',
      'Luna',
    ]);
    expect(
      [...fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-text')].map((node) =>
        (node.textContent ?? '').trim(),
      ),
    ).toEqual(['Milo', 'Luna']);
    fixture.destroy();
  });

  it('laesst Kindergarten-Tiere ohne Team ohne dunkle Overlay-Kapsel einfliegen', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Quiz',
      title: null,
      participantCount: 1,
      teamMode: false,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 1,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Roter Drache 1',
          teamId: null,
          teamName: null,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Roter Drache 1',
          teamId: null,
          teamName: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Grüner Frosch 1',
          teamId: null,
          teamName: null,
        },
      ],
    });
    await (
      fixture.componentInstance as unknown as { refreshLobbyAudience(): Promise<void> }
    ).refreshLobbyAudience();
    fixture.detectChanges();

    const chip = fixture.componentInstance.lobbyFoyerChips()[0];
    expect(chip?.kind).toBe('emoji-only');
    expect(chip?.text).toBe('');
    expect(chip?.emoji).toBeTruthy();
    expect(chip?.fullLabel).toBe('Grüner Frosch 1');
    expect(
      fixture.nativeElement.querySelector('.foyer-entrance-layer__chip--emoji-only'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.foyer-entrance-layer__chip--emoji-with-text'),
    ).toBeNull();
    fixture.destroy();
  });

  it('unterdrueckt Team-Badges waehrend des Einflugs', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 1,
      teamMode: true,
      anonymousMode: false,
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 1,
      recentArrivals: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamName: 'Rot',
        },
      ],
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Rot',
          color: '#c62828',
          memberCount: 1,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Luna');
    expect(fixture.nativeElement.querySelector('app-foyer-entrance-layer')).toBeNull();

    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 2,
      recentArrivals: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Milo',
          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamName: 'Rot',
        },
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamName: 'Rot',
        },
      ],
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Rot',
          color: '#c62828',
          memberCount: 2,
        },
      ],
    });
    await (
      fixture.componentInstance as unknown as { refreshLobbyAudience(): Promise<void> }
    ).refreshLobbyAudience();
    fixture.detectChanges();

    expect(fixture.componentInstance.lobbyFoyerChips().length).toBe(1);
    expect(
      fixture.componentInstance.lobbyTeamsView()[0]?.members.map((member) => member.nickname),
    ).toEqual(['Luna']);
    expect(fixture.nativeElement.querySelector('.session-present__lobby-team-foyer')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-text').length).toBe(
      1,
    );

    fixture.componentInstance.lobbyFoyerChips.set([]);
    fixture.componentInstance.hiddenFoyerParticipantIds.set(new Set());
    fixture.detectChanges();

    expect(
      fixture.componentInstance.lobbyTeamsView()[0]?.members.map((member) => member.nickname),
    ).toEqual(['Milo', 'Luna']);
    expect(
      [...fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-text')].map((node) =>
        (node.textContent ?? '').trim(),
      ),
    ).toEqual(['Milo', 'Luna']);
    fixture.destroy();
  });

  it('zeigt Single-Choice-Frage und Optionen statt des Freitext-Platzhalters', async () => {
    liveQueryMock.mockResolvedValue({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 0,
      questionType: 'SINGLE_CHOICE',
      questionText: 'Was ist 2 + 2?',
      responses: [],
      updatedAt: '2026-03-08T12:00:00.000Z',
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 5,
      text: 'Was ist 2 + 2?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      showQuestionTypeIndicators: true,
      answers: [
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'Drei', isCorrect: false },
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'Vier', isCorrect: true },
      ],
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Was ist 2 + 2?');
    expect(text).toContain('Drei');
    expect(text).toContain('Vier');
    expect(text).not.toContain('Aktuelle Frage ist keine Freitext-Frage.');
    expect(text).not.toContain('check_circle');
    fixture.destroy();
  });

  it('zeigt nach der Freigabe Verteilung und richtige Antwort', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
    });
    liveQueryMock.mockResolvedValue({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 0,
      questionType: 'SINGLE_CHOICE',
      questionText: 'Was ist 2 + 2?',
      responses: [],
      updatedAt: '2026-03-08T12:00:00.000Z',
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 5,
      text: 'Was ist 2 + 2?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      showQuestionTypeIndicators: true,
      answers: [
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'Drei', isCorrect: false },
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'Vier', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          text: 'Drei',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 40,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          text: 'Vier',
          isCorrect: true,
          voteCount: 2,
          votePercentage: 60,
        },
      ],
      totalVotes: 3,
    });

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('40');
    expect(text).toContain('60');
    expect(text).toContain('check_circle');
    fixture.destroy();
  });

  it('nutzt die Beamer-Bühne ohne schmale Stack-Spalte', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const root = fixture.nativeElement.querySelector('.session-present') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.classList.contains('l-stack')).toBe(false);
    expect(root.classList.contains('l-stack--sm')).toBe(false);
    expect(getComputedStyle(root).maxWidth).not.toBe('none');
    fixture.destroy();
  });

  it('enthält keine Pairing-Freigabe und keine Pairing-Secrets', () => {
    const html = readFileSync(
      resolve(
        process.cwd(),
        'src/app/features/session/session-present/session-present.component.html',
      ),
      'utf8',
    );
    const ts = readFileSync(
      resolve(
        process.cwd(),
        'src/app/features/session/session-present/session-present.component.ts',
      ),
      'utf8',
    );
    expect(html).not.toContain('host-pairing');
    expect(html).not.toContain('Als Host zulassen');
    expect(html).not.toContain('pairingSecret');
    expect(html).not.toContain('connect-smartphone');
    expect(ts).not.toContain('HostPairingDialog');
    expect(ts).not.toContain('createHostPairingInvite');
    expect(ts).not.toContain('approveHostPairing');
  });

  it('steuert Peer Instruction aus dem Presenter und sperrt persönliche Zeitfenster', async () => {
    const question = {
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 2,
      text: 'Was ist 2 + 2?',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      hasUnopenedFollowingQuestion: true,
      peerInstructionSuggestion: { suggested: true },
      answers: [],
    };
    const progress = {
      questionId: question.questionId,
      questionOrder: 0,
      round: 1,
      totalVotes: 3,
      blockingTimerAccommodationCount: 1,
      peerInstructionSuggestion: { suggested: true },
    };
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      enableTimerAccommodation: true,
      presenterPage: { context: 'quiz:0:ACTIVE', index: 0, count: 2 },
    });
    getParticipantSummaryQueryMock.mockResolvedValue({
      participantCount: 3,
      connectedCount: 3,
      revision: 1,
      recentArrivals: [],
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(question);
    getHostVoteProgressQueryMock.mockResolvedValue(progress);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="presenter-return-to-host"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="presenter-quiz-pages"]')?.textContent).toContain(
      'Vorherige Seite',
    );
    expect(root.querySelector('[data-testid="presenter-quiz-pages"]')?.textContent).toContain(
      '1 / 2',
    );
    expect(root.querySelector('.projection-pages__indicator')).toBeNull();
    expect(root.textContent).toContain('Diskussionsphase');
    expect(root.textContent).toContain('Ergebnis zeigen');
    expect(root.textContent).not.toContain('Trotzdem freigeben');
    expect(root.textContent).not.toContain('Frage auslassen');

    root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-discussion"]')?.click();
    await fixture.whenStable();
    expect(startDiscussionMutateMock).not.toHaveBeenCalled();

    component.hostVoteProgress.set({
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 0,
      round: 1,
      totalVotes: 3,
      blockingTimerAccommodationCount: 0,
      peerInstructionSuggestion: { suggested: true },
    } as never);
    startDiscussionMutateMock.mockResolvedValue({
      status: 'DISCUSSION',
      currentQuestion: 0,
    });
    getCurrentQuestionForHostQueryMock.mockReturnValue(new Promise(() => undefined));
    fixture.detectChanges();
    const discussion =
      root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-discussion"]') ?? null;
    discussion?.focus();
    discussion?.click();
    await fixture.whenStable();

    expect(startDiscussionMutateMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(component.session()?.status).toBe('DISCUSSION');
    expect(component.quizControlPending()).toBe(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-second-round"]'),
    );
    expect(root.textContent).toContain('Zweite Abstimmung');
    expect(root.textContent).toContain('Zur nächsten Frage ohne zweite Abstimmung');

    nextQuestionMutateMock.mockResolvedValue({
      status: 'QUESTION_OPEN',
      currentQuestion: 1,
    });
    root
      .querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-skip-discussion"]')
      ?.click();
    await fixture.whenStable();
    expect(nextQuestionMutateMock).toHaveBeenCalledWith(
      { code: 'ABC123', skipCurrentResultQuestion: true },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fixture.destroy();
  });

  it('hält die neue Frage zurück, bis ihr Snapshot da ist, und führt das Quiz bis zur Auswertung', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 2,
      preferredChannel: 'quiz',
      currentQuestion: null,
      currentRound: 1,
    });
    const questionOne = {
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 2,
      text: 'Frage eins',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      hasUnopenedFollowingQuestion: true,
      peerInstructionSuggestion: { suggested: true, reason: 'CORRECTNESS_WINDOW' },
      answers: [],
    };
    const questionTwo = {
      ...questionOne,
      questionId: '22222222-2222-4222-8222-222222222222',
      order: 1,
      text: 'Frage zwei',
      hasUnopenedFollowingQuestion: false,
      peerInstructionSuggestion: undefined,
    };

    const fixture = TestBed.createComponent(SessionPresentComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    getInfoQueryMock.mockImplementation(async () => component.session());

    const root = fixture.nativeElement as HTMLElement;
    const start = root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-start"]');
    expect(start).not.toBeNull();
    start?.focus();

    let releaseQuestion: (value: unknown) => void = () => undefined;
    getCurrentQuestionForHostQueryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseQuestion = resolve;
        }),
    );
    nextQuestionMutateMock.mockResolvedValueOnce({
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      currentRound: 1,
    });
    start?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(nextQuestionMutateMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(root.textContent).not.toContain('Frage eins');
    expect(root.querySelector('[data-testid="presenter-quiz-reveal-answers"]')).toBeNull();
    expect(root.textContent).toContain('Die Frage wird geladen');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-question-pending"]'),
    );
    expect(component.quizControlPending()).toBe(false);

    releaseQuestion(questionOne);
    await fixture.whenStable();
    fixture.detectChanges();
    component.quizAudience.set({
      participantCount: 2,
      readingReady: {
        connectedCount: 2,
        readyCount: 1,
        allConnectedReady: false,
      },
    });
    fixture.detectChanges();
    expect(root.textContent).toContain('Frage eins');
    expect(root.textContent).toContain('1 von 2 bereit');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-reveal-answers"]'),
    );

    revealAnswersMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
    });
    const reveal = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-quiz-reveal-answers"]',
    );
    reveal?.focus();
    reveal?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(revealAnswersMutateMock).toHaveBeenCalled();
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-reveal-results"]'),
    );

    component.hostVoteProgress.set({
      questionId: questionOne.questionId,
      questionOrder: 0,
      round: 1,
      totalVotes: 2,
      blockingTimerAccommodationCount: 1,
      peerInstructionSuggestion: { suggested: true, reason: 'CORRECTNESS_WINDOW' },
    } as never);
    component.countdownSeconds.set(0);
    fixture.detectChanges();
    expect(root.textContent).toContain('Persönliche Zeitfenster laufen noch');
    startDiscussionMutateMock.mockClear();
    root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-discussion"]')?.click();
    await fixture.whenStable();
    expect(startDiscussionMutateMock).not.toHaveBeenCalled();

    component.hostVoteProgress.set({
      questionId: questionOne.questionId,
      questionOrder: 0,
      round: 1,
      totalVotes: 2,
      blockingTimerAccommodationCount: 0,
      peerInstructionSuggestion: { suggested: true, reason: 'CORRECTNESS_WINDOW' },
    } as never);
    startDiscussionMutateMock.mockResolvedValue({
      status: 'DISCUSSION',
      currentQuestion: 0,
      currentRound: 1,
    });
    fixture.detectChanges();
    const discussion = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-quiz-discussion"]',
    );
    discussion?.focus();
    discussion?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.session()?.status).toBe('DISCUSSION');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-second-round"]'),
    );

    getCurrentQuestionForHostQueryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseQuestion = resolve;
        }),
    );
    startSecondRoundMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 2,
    });
    const secondRound = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-quiz-second-round"]',
    );
    secondRound?.focus();
    secondRound?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.presentedQuizQuestion()).toBeNull();
    expect(component.session()?.currentRound).toBe(2);
    expect(root.textContent).not.toContain('Frage eins');
    expect(root.textContent).not.toContain('2. Runde');
    expect(root.querySelector('[data-testid="presenter-quiz-reveal-results"]')).toBeNull();
    expect(root.textContent).toContain('Die Frage wird geladen');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-question-pending"]'),
    );

    releaseQuestion({ ...questionOne, currentRound: 2 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.presentedQuizQuestion()?.order).toBe(0);
    expect(component.presentedQuizQuestion()?.currentRound).toBe(2);
    expect(root.textContent).toContain('Frage eins');
    expect(root.textContent).toContain('2. Runde');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-reveal-results"]'),
    );
    revealResultsMutateMock.mockResolvedValue({
      status: 'RESULTS',
      currentQuestion: 0,
      currentRound: 2,
    });
    const revealRoundTwo = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-quiz-reveal-results"]',
    );
    revealRoundTwo?.focus();
    revealRoundTwo?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-next-question"]'),
    );

    getCurrentQuestionForHostQueryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseQuestion = resolve;
        }),
    );
    nextQuestionMutateMock.mockResolvedValueOnce({
      status: 'QUESTION_OPEN',
      currentQuestion: 1,
      currentRound: 1,
    });
    const nextQuestion = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-quiz-next-question"]',
    );
    nextQuestion?.focus();
    nextQuestion?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(nextQuestionMutateMock).toHaveBeenLastCalledWith(
      { code: 'ABC123', skipCurrentResultQuestion: true },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(component.presentedQuizQuestion()).toBeNull();
    expect(component.session()?.currentQuestion).toBe(1);
    expect(root.textContent).not.toContain('Frage eins');
    expect(root.textContent).not.toContain('Frage zwei');
    expect(root.querySelector('[data-testid="presenter-quiz-reveal-answers"]')).toBeNull();
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-question-pending"]'),
    );
    const returnToHost = root.querySelector<HTMLElement>(
      '[data-testid="presenter-return-to-host"]',
    );
    returnToHost?.focus();

    releaseQuestion(questionTwo);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Frage zwei');
    expect(document.activeElement).toBe(returnToHost);

    pauseQuizMutateMock.mockResolvedValue({
      status: 'PAUSED',
      currentQuestion: 1,
      currentRound: 1,
      pausedFromStatus: 'QUESTION_OPEN',
    });
    const pause = root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-pause"]');
    pause?.focus();
    pause?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Quiz fortsetzen');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-resume"]'),
    );

    resumeQuizMutateMock.mockResolvedValue({
      status: 'QUESTION_OPEN',
      currentQuestion: 1,
      currentRound: 1,
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(questionTwo);
    root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-resume"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    revealAnswersMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 1,
      currentRound: 1,
    });
    root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-reveal-answers"]')?.click();
    await fixture.whenStable();
    revealResultsMutateMock.mockResolvedValue({
      status: 'RESULTS',
      currentQuestion: 1,
      currentRound: 1,
    });
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-reveal-results"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    nextQuestionMutateMock.mockResolvedValueOnce({
      status: 'FINISHED',
      currentQuestion: null,
      currentRound: 1,
    });
    getLeaderboardQueryMock.mockResolvedValue([]);
    getTeamLeaderboardQueryMock.mockResolvedValue([]);
    root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-finish"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.session()?.status).toBe('FINISHED');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-return-to-host"]'),
    );
    fixture.destroy();
  });

  it('bleibt nach einem fehlgeschlagenen Fragenabruf bedienbar', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 2,
      preferredChannel: 'quiz',
      currentQuestion: null,
      currentRound: 1,
    });
    getCurrentQuestionForHostQueryMock.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(SessionPresentComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    getInfoQueryMock.mockImplementation(async () => component.session());

    const root = fixture.nativeElement as HTMLElement;
    nextQuestionMutateMock.mockResolvedValueOnce({
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      currentRound: 1,
    });
    root.querySelector<HTMLButtonElement>('[data-testid="presenter-quiz-start"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Die Frage konnte nicht geladen werden');
    expect(root.querySelector('[data-testid="presenter-quiz-question-retry"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="presenter-quiz-reveal-answers"]')).toBeNull();
    expect(root.querySelector('[data-testid="presenter-return-to-host"]')).not.toBeNull();
    expect(component.quizControlPending()).toBe(false);

    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 1,
      text: 'Frage eins',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      answers: [],
    });
    const retry = root.querySelector<HTMLButtonElement>(
      '[data-testid="presenter-quiz-question-retry"]',
    );
    retry?.focus();
    retry?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Frage eins');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-reveal-answers"]'),
    );
    fixture.destroy();
  });

  it('übernimmt Frage und Runde aus dem Live-Status des Hosts', async () => {
    const roundOne = {
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 2,
      text: 'Frage eins',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      hasUnopenedFollowingQuestion: true,
      answers: [],
    };
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'DISCUSSION',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 2,
      preferredChannel: 'quiz',
      currentQuestion: 0,
      currentRound: 1,
    });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(roundOne);
    const fixture = TestBed.createComponent(SessionPresentComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    getInfoQueryMock.mockImplementation(async () => component.session());
    getCurrentQuestionForHostQueryMock.mockImplementation(() => new Promise(() => undefined));

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Frage eins');
    expect(component.session()?.currentRound).toBe(1);

    const statusCall = subscribeMock.mock.calls.find(
      ([input]) => typeof input === 'object' && input !== null && 'anonymousClientId' in input,
    );
    const questionCall = subscribeMock.mock.calls.find(
      ([input]) =>
        typeof input === 'object' &&
        input !== null &&
        'code' in input &&
        !('anonymousClientId' in input),
    );
    expect(statusCall?.[1]).toBeTypeOf('object');
    expect(questionCall?.[1]).toBeTypeOf('object');
    const statusHandler = statusCall?.[1] as unknown as { onData: (data: unknown) => void };
    const questionHandler = questionCall?.[1] as unknown as { onData: (data: unknown) => void };

    statusHandler.onData({
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 2,
      serverTime: MOCK_SERVER_TIME,
    });
    fixture.detectChanges();
    expect(component.session()?.status).toBe('ACTIVE');
    expect(component.session()?.currentRound).toBe(2);
    expect(component.presentedQuizQuestion()).toBeNull();
    expect(root.textContent).not.toContain('Frage eins');
    expect(root.textContent).toContain('Die Frage wird geladen');

    questionHandler.onData({ ...roundOne, currentRound: 2 });
    fixture.detectChanges();
    expect(component.presentedQuizQuestion()?.order).toBe(0);
    expect(component.presentedQuizQuestion()?.currentRound).toBe(2);
    expect(root.textContent).toContain('Frage eins');
    expect(root.textContent).toContain('2. Runde');
    expect(root.querySelector('[data-testid="presenter-quiz-reveal-results"]')).not.toBeNull();

    const questionTwo = {
      ...roundOne,
      questionId: '22222222-2222-4222-8222-222222222222',
      order: 1,
      text: 'Frage zwei',
      currentRound: 1,
      hasUnopenedFollowingQuestion: false,
    };
    getCurrentQuestionForHostQueryMock.mockResolvedValue(questionTwo);
    statusHandler.onData({
      status: 'QUESTION_OPEN',
      currentQuestion: 1,
      currentRound: 1,
      serverTime: MOCK_SERVER_TIME,
    });
    fixture.detectChanges();
    expect(component.session()?.currentQuestion).toBe(1);
    expect(component.session()?.currentRound).toBe(1);
    expect(component.presentedQuizQuestion()).toBeNull();
    expect(root.textContent).not.toContain('Frage eins');
    expect(root.textContent).not.toContain('Frage zwei');
    expect(root.textContent).toContain('Die Frage wird geladen');

    const pending = root.querySelector<HTMLElement>(
      '[data-testid="presenter-quiz-question-pending"]',
    );
    pending?.focus();
    await component.retryPresenterQuestion();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.presentedQuizQuestion()?.order).toBe(1);
    expect(component.presentedQuizQuestion()?.currentRound).toBe(1);
    expect(root.textContent).toContain('Frage zwei');
    expect(document.activeElement).toBe(
      root.querySelector('[data-testid="presenter-quiz-reveal-answers"]'),
    );
    fixture.destroy();
  });

  it('hält Present-Display-Gewicht ohne font-weight 800', () => {
    const styles = readFileSync(
      resolve(
        process.cwd(),
        'src/app/features/session/session-present/session-present.component.scss',
      ),
      'utf8',
    );
    expect(styles).not.toContain('font-weight: 800');
    expect(styles).not.toContain('::ng-deep');
    expect(styles).toMatch(
      /\.session-present__winner-card \{[\s\S]*primary-container\) 72%, var\(--mat-sys-surface\)/,
    );
    expect(styles).not.toMatch(/primary-container\) 72%, white/);
  });
});
