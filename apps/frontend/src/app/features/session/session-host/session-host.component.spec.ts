import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { LOCALE_ID, type Provider, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NEVER, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushComponentAfterStable,
  flushMacroTask,
} from '../../../../testing/component-test-utils';
import { SessionHostComponent } from './session-host.component';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { QuizStoreService } from '../../quiz/data/quiz-store.service';

const unsubscribeMock = vi.fn();

const {
  healthCheckQueryMock,
  getInfoQueryMock,
  getParticipantsQueryMock,
  getTeamsQueryMock,
  getLiveFreetextQueryMock,
  getCurrentQuestionForHostQueryMock,
  getHostVoteProgressQueryMock,
  getLeaderboardQueryMock,
  getTeamLeaderboardQueryMock,
  getExportDataQueryMock,
  getSessionConfidenceSummaryQueryMock,
  wordCloudAnalyzeQueryMock,
  qaListQueryMock,
  qaModerateMutateMock,
  qaToggleModerationMutateMock,
  qaOnQuestionsUpdatedSubscribeMock,
  nextQuestionMutateMock,
  revealAnswersMutateMock,
  revealResultsMutateMock,
  startSecondRoundMutateMock,
  startQaMutateMock,
  attachQuizToSessionMutateMock,
  enableQaChannelMutateMock,
  enableQuickFeedbackChannelMutateMock,
  setPreferredLiveChannelMutateMock,
  closeQaChannelMutateMock,
  reopenQaChannelMutateMock,
  closeQuickFeedbackChannelMutateMock,
  reopenQuickFeedbackChannelMutateMock,
  endMutateMock,
  quickFeedbackHostResultsQueryMock,
  quickFeedbackToggleLockMutateMock,
  updateQaTitleMutateMock,
  quizUploadMutateMock,
  onParticipantJoinedSubscribeMock,
  onStatusChangedSubscribeMock,
  onCurrentQuestionForHostChangedSubscribeMock,
  onHostVoteProgressChangedSubscribeMock,
  clearHostTokenMock,
  dialogOpenMock,
} = vi.hoisted(() => ({
  healthCheckQueryMock: vi.fn(),
  getInfoQueryMock: vi.fn(),
  getParticipantsQueryMock: vi.fn(),
  getTeamsQueryMock: vi.fn(),
  getLiveFreetextQueryMock: vi.fn(),
  getCurrentQuestionForHostQueryMock: vi.fn(),
  getHostVoteProgressQueryMock: vi.fn(),
  getLeaderboardQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  getExportDataQueryMock: vi.fn(),
  getSessionConfidenceSummaryQueryMock: vi.fn(),
  wordCloudAnalyzeQueryMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  qaModerateMutateMock: vi.fn(),
  qaToggleModerationMutateMock: vi.fn(),
  qaOnQuestionsUpdatedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  nextQuestionMutateMock: vi.fn(),
  revealAnswersMutateMock: vi.fn(),
  revealResultsMutateMock: vi.fn(),
  startSecondRoundMutateMock: vi.fn(),
  startQaMutateMock: vi.fn(),
  attachQuizToSessionMutateMock: vi.fn(),
  enableQaChannelMutateMock: vi.fn(),
  enableQuickFeedbackChannelMutateMock: vi.fn(),
  setPreferredLiveChannelMutateMock: vi.fn(),
  closeQaChannelMutateMock: vi.fn(),
  reopenQaChannelMutateMock: vi.fn(),
  closeQuickFeedbackChannelMutateMock: vi.fn(),
  reopenQuickFeedbackChannelMutateMock: vi.fn(),
  endMutateMock: vi.fn(),
  quickFeedbackHostResultsQueryMock: vi.fn(),
  quickFeedbackToggleLockMutateMock: vi.fn(),
  updateQaTitleMutateMock: vi.fn(),
  quizUploadMutateMock: vi.fn(),
  onParticipantJoinedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  onStatusChangedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  onCurrentQuestionForHostChangedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  onHostVoteProgressChangedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  clearHostTokenMock: vi.fn(),
  dialogOpenMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    health: {
      check: { query: healthCheckQueryMock },
    },
    session: {
      getInfo: { query: getInfoQueryMock },
      getParticipants: { query: getParticipantsQueryMock },
      getTeams: { query: getTeamsQueryMock },
      getLiveFreetext: { query: getLiveFreetextQueryMock },
      getCurrentQuestionForHost: { query: getCurrentQuestionForHostQueryMock },
      getHostVoteProgress: { query: getHostVoteProgressQueryMock },
      getLeaderboard: { query: getLeaderboardQueryMock },
      getTeamLeaderboard: { query: getTeamLeaderboardQueryMock },
      getExportData: { query: getExportDataQueryMock },
      getSessionConfidenceSummary: { query: getSessionConfidenceSummaryQueryMock },
      nextQuestion: { mutate: nextQuestionMutateMock },
      revealAnswers: { mutate: revealAnswersMutateMock },
      revealResults: { mutate: revealResultsMutateMock },
      startSecondRound: { mutate: startSecondRoundMutateMock },
      startQa: { mutate: startQaMutateMock },
      attachQuizToSession: { mutate: attachQuizToSessionMutateMock },
      enableQaChannel: { mutate: enableQaChannelMutateMock },
      enableQuickFeedbackChannel: { mutate: enableQuickFeedbackChannelMutateMock },
      setPreferredLiveChannel: { mutate: setPreferredLiveChannelMutateMock },
      closeQaChannel: { mutate: closeQaChannelMutateMock },
      reopenQaChannel: { mutate: reopenQaChannelMutateMock },
      closeQuickFeedbackChannel: { mutate: closeQuickFeedbackChannelMutateMock },
      reopenQuickFeedbackChannel: { mutate: reopenQuickFeedbackChannelMutateMock },
      end: { mutate: endMutateMock },
      updateQaTitle: { mutate: updateQaTitleMutateMock },
      onParticipantJoined: { subscribe: onParticipantJoinedSubscribeMock },
      onStatusChanged: { subscribe: onStatusChangedSubscribeMock },
      onCurrentQuestionForHostChanged: { subscribe: onCurrentQuestionForHostChangedSubscribeMock },
      onHostVoteProgressChanged: { subscribe: onHostVoteProgressChangedSubscribeMock },
    },
    quiz: {
      upload: { mutate: quizUploadMutateMock },
    },
    qa: {
      list: { query: qaListQueryMock },
      moderate: { mutate: qaModerateMutateMock },
      toggleModeration: { mutate: qaToggleModerationMutateMock },
      onQuestionsUpdated: { subscribe: qaOnQuestionsUpdatedSubscribeMock },
    },
    quickFeedback: {
      results: { query: vi.fn().mockResolvedValue({ totalVotes: 0, options: [] }) },
      hostResults: { query: quickFeedbackHostResultsQueryMock },
      toggleLock: { mutate: quickFeedbackToggleLockMutateMock },
    },
    wordCloud: {
      analyze: { mutate: wordCloudAnalyzeQueryMock },
    },
  },
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,placeholder') },
}));

vi.mock('../../../core/host-session-token', () => ({
  clearHostToken: clearHostTokenMock,
}));

const defaultSession = {
  id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
  code: 'ABC123',
  type: 'QUIZ' as const,
  status: 'LOBBY' as const,
  serverTime: '2026-03-24T12:00:00.000Z',
  quizName: 'Demo Quiz',
  quizMotifImageUrl: null as string | null,
  title: null,
  participantCount: 0,
  nicknameTheme: 'HIGH_SCHOOL' as const,
  allowCustomNicknames: false,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: null,
  teamNames: [] as string[],
};

const defaultLiveFreetext = {
  sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
  questionId: null,
  questionOrder: null,
  questionType: null,
  questionText: null,
  responses: [] as string[],
  updatedAt: '2026-03-08T12:00:00.000Z',
};

const quizStoreMock = {
  quizzes: signal([
    {
      id: 'local-quiz-1',
      name: 'Quiz Sammlung',
      description: 'Mitgebrachte Fragen',
      createdAt: '2026-03-20T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z',
      questionCount: 3,
      teamMode: false,
      hasBonus: false,
      lastServerQuizId: null,
      lastServerQuizAccessProof: null,
    },
  ]),
  getQuizById: vi.fn((id: string) =>
    id === 'local-quiz-1'
      ? {
          id: 'local-quiz-1',
          name: 'Quiz Sammlung',
          description: 'Mitgebrachte Fragen',
          motifImageUrl: null,
          createdAt: '2026-03-20T12:00:00.000Z',
          updatedAt: '2026-03-24T12:00:00.000Z',
          settings: {
            showLeaderboard: true,
            allowCustomNicknames: false,
            defaultTimer: 60,
            enableSoundEffects: true,
            enableRewardEffects: true,
            enableMotivationMessages: true,
            enableEmojiReactions: true,
            showQuestionTypeIndicators: true,
            anonymousMode: false,
            teamMode: false,
            teamCount: null,
            teamAssignment: 'AUTO',
            teamNames: [],
            backgroundMusic: null,
            nicknameTheme: 'HIGH_SCHOOL',
            bonusTokenCount: null,
            readingPhaseEnabled: true,
            preset: 'PLAYFUL',
          },
          questions: [],
        }
      : id === 'local-quiz-incompatible'
        ? {
            id: 'local-quiz-incompatible',
            name: 'Team Quiz',
            description: 'Nur für Teams',
            motifImageUrl: null,
            createdAt: '2026-03-21T12:00:00.000Z',
            updatedAt: '2026-03-25T12:00:00.000Z',
            settings: {
              showLeaderboard: true,
              allowCustomNicknames: false,
              defaultTimer: 60,
              enableSoundEffects: true,
              enableRewardEffects: true,
              enableMotivationMessages: true,
              enableEmojiReactions: true,
              showQuestionTypeIndicators: true,
              anonymousMode: false,
              teamMode: true,
              teamCount: 2,
              teamAssignment: 'MANUAL',
              teamNames: ['Rot', 'Blau'],
              backgroundMusic: null,
              nicknameTheme: 'HIGH_SCHOOL',
              bonusTokenCount: null,
              readingPhaseEnabled: true,
              preset: 'PLAYFUL',
            },
            questions: [],
          }
        : null,
  ),
  getUploadPayload: vi.fn(),
  setLastServerUploadAccess: vi.fn(),
};

describe('SessionHostComponent', { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
      },
    });
    quizStoreMock.quizzes.set([
      {
        id: 'local-quiz-1',
        name: 'Quiz Sammlung',
        description: 'Mitgebrachte Fragen',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-24T12:00:00.000Z',
        questionCount: 3,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
      {
        id: 'local-quiz-incompatible',
        name: 'Team Quiz',
        description: 'Nur für Teams',
        createdAt: '2026-03-21T12:00:00.000Z',
        updatedAt: '2026-03-25T12:00:00.000Z',
        questionCount: 4,
        teamMode: true,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);
    unsubscribeMock.mockClear();
    healthCheckQueryMock.mockResolvedValue({
      status: 'ok',
      timestamp: '2026-03-24T12:00:00.000Z',
      version: '0.1.0',
      redis: 'ok',
    });
    getInfoQueryMock.mockResolvedValue({ ...defaultSession });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 0, participants: [] });
    onParticipantJoinedSubscribeMock.mockImplementation(() => ({ unsubscribe: unsubscribeMock }));
    onStatusChangedSubscribeMock.mockImplementation(() => ({ unsubscribe: unsubscribeMock }));
    onCurrentQuestionForHostChangedSubscribeMock.mockImplementation(() => ({
      unsubscribe: unsubscribeMock,
    }));
    onHostVoteProgressChangedSubscribeMock.mockImplementation(() => ({
      unsubscribe: unsubscribeMock,
    }));
    getTeamsQueryMock.mockResolvedValue({ teams: [], teamCount: 0 });
    getLiveFreetextQueryMock.mockResolvedValue({ ...defaultLiveFreetext });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(null);
    getHostVoteProgressQueryMock.mockResolvedValue(null);
    getLeaderboardQueryMock.mockResolvedValue([]);
    getTeamLeaderboardQueryMock.mockResolvedValue([]);
    qaListQueryMock.mockResolvedValue([]);
    qaModerateMutateMock.mockResolvedValue({});
    qaOnQuestionsUpdatedSubscribeMock.mockImplementation(() => ({ unsubscribe: unsubscribeMock }));
    startQaMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: null,
      currentRound: 1,
    });
    startSecondRoundMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 2,
      activeAt: '2026-03-24T12:00:00.000Z',
    });
    attachQuizToSessionMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: false, open: false, title: null, moderationMode: false },
      quickFeedback: { enabled: true, open: true },
    });
    enableQaChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: true, open: true, title: null, moderationMode: true },
      quickFeedback: { enabled: false, open: false },
    });
    enableQuickFeedbackChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: false, open: false, title: null, moderationMode: false },
      quickFeedback: { enabled: true, open: true },
    });
    setPreferredLiveChannelMutateMock.mockResolvedValue({ preferredChannel: 'quiz' });
    closeQaChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: true, open: false, title: 'Fragen', moderationMode: true },
      quickFeedback: { enabled: false, open: false },
    });
    reopenQaChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
      quickFeedback: { enabled: false, open: false },
    });
    closeQuickFeedbackChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: false, open: false, title: null, moderationMode: false },
      quickFeedback: { enabled: true, open: false },
    });
    reopenQuickFeedbackChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: false, open: false, title: null, moderationMode: false },
      quickFeedback: { enabled: true, open: true },
    });
    quickFeedbackHostResultsQueryMock.mockResolvedValue({ totalVotes: 0, options: [] });
    quickFeedbackToggleLockMutateMock.mockResolvedValue({ locked: true });
    wordCloudAnalyzeQueryMock.mockResolvedValue({
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      generatedAt: '2026-03-24T12:00:00.000Z',
      fallbackUsed: true,
      entries: [],
    });
    quizUploadMutateMock.mockResolvedValue({
      quizId: '44444444-4444-4444-8444-444444444444',
    });
    quizStoreMock.getUploadPayload.mockReturnValue({
      name: 'Quiz Sammlung',
      description: 'Mitgebrachte Fragen',
      motifImageUrl: null,
      showLeaderboard: true,
      allowCustomNicknames: true,
      defaultTimer: 30,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      showQuestionTypeIndicators: true,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
      backgroundMusic: null,
      nicknameTheme: 'HIGH_SCHOOL',
      bonusTokenCount: null,
      readingPhaseEnabled: true,
      preset: 'PLAYFUL',
      questions: [
        {
          text: 'Frage 1',
          type: 'SINGLE_CHOICE',
          difficulty: 'MEDIUM',
          order: 0,
          timer: 30,
          answers: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        },
      ],
    });
    nextQuestionMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: null,
      currentRound: 1,
      activeAt: null,
    });
    revealAnswersMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      activeAt: null,
    });
    revealResultsMutateMock.mockResolvedValue({
      status: 'RESULTS',
      currentQuestion: 0,
      currentRound: 1,
      activeAt: null,
    });
    endMutateMock.mockResolvedValue({
      status: 'FINISHED',
      currentQuestion: null,
      activeAt: null,
    });
    updateQaTitleMutateMock.mockResolvedValue({
      title: 'Titel',
      qaTitle: 'Titel',
    });
    qaToggleModerationMutateMock.mockResolvedValue({ enabled: true });
    dialogOpenMock.mockReturnValue({ afterClosed: () => of(true) });
    getExportDataQueryMock.mockResolvedValue({
      sessionId: defaultSession.id,
      sessionCode: 'ABC123',
      quizName: 'Demo Quiz',
      finishedAt: '2026-03-24T12:30:00.000Z',
      participantCount: 0,
      teamMode: false,
      questions: [],
      teamLeaderboard: [],
      bonusTokens: [],
    });
    getSessionConfidenceSummaryQueryMock.mockResolvedValue(null);
  });

  const setup = (extraProviders: Provider[] = []) => {
    TestBed.configureTestingModule({
      imports: [SessionHostComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: QuizStoreService, useValue: quizStoreMock },
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
        ...extraProviders,
      ],
    });
    TestBed.inject(ThemePresetService).setPreset('spielerisch', { silent: true });
    return TestBed.createComponent(SessionHostComponent);
  };

  it('cacht gerendertes Markdown fuer identische Texte', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    const first = component.renderMarkdown('![Bild](https://example.org/test.png)');
    const second = component.renderMarkdown('![Bild](https://example.org/test.png)');

    expect(second).toBe(first);
    fixture.destroy();
  }, 15000);

  it('rendert gebuendelte App-Asset-Bilder in Live-Fragetexten', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    const rendered = component.renderMarkdown(
      '![Dachszene](/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png)',
    ) as unknown as {
      changingThisBreaksApplicationSecurity?: string;
    };

    expect(rendered.changingThisBreaksApplicationSecurity).toContain(
      'src="/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png"',
    );
    expect(rendered.changingThisBreaksApplicationSecurity).toContain('alt="Dachszene"');
    fixture.destroy();
  }, 15000);

  it('markiert fuehrende Emojis in Antworttexten fuer ein kompakteres Host-Layout', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    const rendered = component.renderMarkdown('😭 Gerade etwas überfordert') as unknown as {
      changingThisBreaksApplicationSecurity?: string;
    };

    expect(rendered.changingThisBreaksApplicationSecurity).toContain('answer-leading-emoji');
    expect(rendered.changingThisBreaksApplicationSecurity).toContain('Gerade etwas überfordert');
    fixture.destroy();
  }, 15000);

  it('baut QR-Join-Links unter einem localized production base href', () => {
    const base = document.createElement('base');
    base.setAttribute('href', '/en/');
    document.head.prepend(base);

    try {
      const fixture = setup();
      expect(fixture.componentInstance.joinUrl).toBe(
        `${window.location.origin}/en/join/ABC123?join=ABC123`,
      );
      fixture.destroy();
    } finally {
      base.remove();
    }
  });

  it('zeigt Lobby mit Session-Code und Button Erste Frage starten bei Status LOBBY', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('ABC123');
    expect(text).toContain('Erste Frage starten');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('h1.session-lobby__hero-title'),
    ).toBeTruthy();
    fixture.destroy();
  });

  it('zeigt im QR-Overlay einen klaren Zur-Lobby-Hinweis und schliesst ueber den CTA', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    (
      fixture.componentInstance as unknown as {
        suppressJoinMenuAutopen: boolean;
      }
    ).suppressJoinMenuAutopen = true;
    fixture.componentInstance.joinInfoPopoverOpen.set(true);
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector(
      '.session-host__join-viewport-overlay',
    ) as HTMLElement | null;
    const trigger = fixture.nativeElement.querySelector(
      '[aria-controls="session-host-join-info"]',
    ) as HTMLButtonElement | null;
    const text = overlay?.textContent ?? '';
    const closeButton = Array.from(overlay?.querySelectorAll('button') ?? []).find((button) =>
      (button.textContent ?? '').includes('Zur Lobby'),
    ) as HTMLButtonElement | undefined;

    expect(text).toContain('Live-Ansicht:');
    expect(closeButton).toBeDefined();
    expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);

    closeButton?.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(fixture.componentInstance.joinInfoPopoverOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    fixture.destroy();
  });

  it('aktualisiert den Host-Abstimmungsfortschritt ueber die Vote-Progress-Subscription waehrend ACTIVE', async () => {
    let onData:
      | ((
          data: {
            questionId: string;
            questionOrder: number;
            round: number;
            totalVotes: number;
            correctVoterCount?: number;
          } | null,
        ) => void)
      | undefined;

    onHostVoteProgressChangedSubscribeMock.mockImplementation(
      (_input, observer: { onData?: typeof onData }) => {
        onData = observer.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      participantCount: 501,
      currentQuestion: 0,
      currentRound: 1,
    });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 501, participants: [] });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 1,
      text: 'Was ist 2+2?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: '3', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: '4', isCorrect: true },
      ],
      totalVotes: 0,
      currentRound: 1,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(onData).toBeTypeOf('function'));

    onData?.({
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 0,
      round: 1,
      totalVotes: 1,
      correctVoterCount: 1,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.currentQuestionForHost()?.totalVotes).toBe(0);
    expect(
      fixture.componentInstance.hostVoteCount(
        fixture.componentInstance.displayedCurrentQuestionForHost(),
      ),
    ).toBe(1);
    expect(fixture.componentInstance.liveVoteProgress()?.votes).toBe(1);
    fixture.destroy();
  });

  it('rendert Nicht-Team-Teilnehmende in der Lobby als zentrierte Chips', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY', teamMode: false });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 3,
      participants: [
        { id: 'p1', nickname: 'Ada' },
        { id: 'p2', nickname: 'Linus' },
        { id: 'p3', nickname: 'Grace' },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector(
      '.session-lobby__list--chips',
    ) as HTMLElement | null;
    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.session-lobby__list-item--chip'),
    ) as HTMLElement[];
    const foyerStage = fixture.nativeElement.querySelector('.session-lobby__foyer-stage');

    expect(list).not.toBeNull();
    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => (chip.textContent ?? '').trim())).toEqual(['Grace', 'Linus', 'Ada']);
    expect(foyerStage).toBeNull();
    fixture.destroy();
  });

  it('zeigt in der Kindergarten-Nicht-Team-Lobby nur zentrierte Tier-Icons mit sr-only Namen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: false,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Mintgrüne Eidechse' },
        { id: 'p2', nickname: 'Lila Delfin' },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector(
      '.session-lobby__list--chips',
    ) as HTMLElement | null;
    const icons = Array.from(
      fixture.nativeElement.querySelectorAll('.session-lobby__nick-emoji--host-lobby'),
    ) as HTMLElement[];
    const srOnlyLabels = Array.from(fixture.nativeElement.querySelectorAll('.sr-only'), (el) =>
      (el.textContent ?? '').trim(),
    );

    expect(list).not.toBeNull();
    expect(icons.map((icon) => icon.textContent?.trim())).toEqual(['🐬', '🦎']);
    expect(srOnlyLabels).toEqual(['Lila Delfin', 'Mintgrüne Eidechse']);
    fixture.destroy();
  });

  it('zeigt bei Rating-Fragen auf dem Host die komplette Skala', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 6 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 6,
      totalQuestions: 7,
      text: 'Wie sicher fühlst du dich?',
      type: 'RATING',
      timer: 30,
      answers: [],
      ratingMin: 1,
      ratingMax: 5,
      ratingLabelMin: 'Unsicher',
      ratingLabelMax: 'Sicher',
      currentRound: 1,
      ratingCount: 0,
      totalVotes: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(
      () =>
        fixture.nativeElement.querySelectorAll('.session-host__rating-scale-value').length === 5,
      {
        timeout: 5000,
        interval: 25,
      },
    );
    fixture.detectChanges();

    const scaleValues = Array.from(
      fixture.nativeElement.querySelectorAll('.session-host__rating-scale-value'),
    ).map((node: Element) => node.textContent?.trim());

    expect(scaleValues).toEqual(['1', '2', '3', '4', '5']);
    fixture.destroy();
  });

  it('blendet bei aktiven SHORT_TEXT-Fragen die Musterlösungen in der Host-Ansicht aus', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 0,
      totalQuestions: 1,
      text: 'Welcher Fachbegriff ist gesucht?',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      timer: 30,
      answers: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'Peer Instruction',
          isCorrect: true,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'Mazur-Methode',
          isCorrect: true,
        },
      ],
      totalVotes: 0,
      currentRound: 1,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Welcher Fachbegriff ist gesucht?');
    expect(host.textContent).not.toContain('Peer Instruction');
    expect(host.textContent).not.toContain('Mazur-Methode');
    expect(host.querySelector('.session-host__results-wrap')).toBeNull();
    expect(host.querySelector('.session-host__answers')).toBeNull();
    fixture.destroy();
  });

  it('aktiviert im Quiz-Foyer bereits die immersive Host-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.isImmersiveMode()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.session-host__view-controls--inline'),
    ).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt im Host auch noch inaktive Kanaele als Tabs an', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Quiz');
    expect(text).toContain('Q&A');
    expect(text).toContain('Blitzlicht');
    expect(text).toContain('Aus');
    fixture.destroy();
  });

  it('blendet den Kanalwahlschalter nach Session-Ende aus', () => {
    const fixture = setup();
    fixture.componentInstance.session.set({
      ...defaultSession,
      status: 'FINISHED',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
        quickFeedback: { enabled: true, open: true },
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.showChannelTabs()).toBe(false);
    expect(fixture.nativeElement.querySelector('.session-channel-tabs')).toBeNull();
    fixture.destroy();
  });

  it('aktiviert den Q&A-Tab beim Klick auf einen inaktiven Kanal', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    qaOnQuestionsUpdatedSubscribeMock.mockClear();

    await fixture.componentInstance.selectChannel('qa');
    fixture.detectChanges();

    expect(enableQaChannelMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(qaOnQuestionsUpdatedSubscribeMock).toHaveBeenCalledWith(
      {
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        moderatorView: true,
        sort: 'BEST',
      },
      expect.any(Object),
    );
    expect(fixture.componentInstance.activeChannel()).toBe('qa');
    expect(fixture.componentInstance.channels().qa).toBe(true);
    fixture.destroy();
  });

  it('öffnet beim inaktiven Quiz-Tab die Sammlung, lädt das Quiz hoch und hängt es an die Session', async () => {
    getInfoQueryMock
      .mockResolvedValueOnce({
        ...defaultSession,
        quizName: null,
        channels: {
          quiz: { enabled: false },
          qa: { enabled: false, open: false, title: null, moderationMode: false },
          quickFeedback: { enabled: true, open: true },
        },
      })
      .mockResolvedValueOnce({
        ...defaultSession,
        quizName: 'Quiz Sammlung',
        channels: {
          quiz: { enabled: true },
          qa: { enabled: false, open: false, title: null, moderationMode: false },
          quickFeedback: { enabled: true, open: true },
        },
      });
    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => of('local-quiz-1') });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance.selectChannel('quiz');
    fixture.detectChanges();

    expect(dialogOpenMock).toHaveBeenCalled();
    expect(quizStoreMock.getUploadPayload).toHaveBeenCalledWith('local-quiz-1');
    expect(quizUploadMutateMock).toHaveBeenCalledTimes(1);
    expect(attachQuizToSessionMutateMock).toHaveBeenCalledWith({
      code: 'ABC123',
      quizId: '44444444-4444-4444-8444-444444444444',
    });
    expect(quizStoreMock.setLastServerUploadAccess).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.activeChannel()).toBe('quiz');
    expect(fixture.componentInstance.channels().quiz).toBe(true);
    expect(fixture.componentInstance.session()?.quizName).toBe('Quiz Sammlung');
    fixture.destroy();
  });

  it('zeigt vor dem ersten Quizstart nur kompatible Quizze zum Wechsel an', async () => {
    getInfoQueryMock
      .mockResolvedValueOnce({
        ...defaultSession,
        quizName: 'Erstes Quiz',
        channels: {
          quiz: { enabled: true },
          qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
          quickFeedback: { enabled: false, open: false },
        },
      })
      .mockResolvedValueOnce({
        ...defaultSession,
        quizName: 'Quiz Sammlung',
        channels: {
          quiz: { enabled: true },
          qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
          quickFeedback: { enabled: false, open: false },
        },
      });
    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => of('local-quiz-1') });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.canReplaceQuizBeforeStart()).toBe(true);
    await fixture.componentInstance.replaceQuizBeforeStart();
    fixture.detectChanges();

    expect(dialogOpenMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          sessionProfile: expect.objectContaining({
            nicknameTheme: 'HIGH_SCHOOL',
            allowCustomNicknames: false,
            anonymousMode: false,
            teamMode: false,
            teamCount: null,
            teamAssignment: 'AUTO',
          }),
          quizzes: [
            expect.objectContaining({
              id: 'local-quiz-1',
              name: 'Quiz Sammlung',
            }),
          ],
        }),
      }),
    );
    expect(quizStoreMock.getUploadPayload).toHaveBeenCalledWith('local-quiz-1');
    expect(attachQuizToSessionMutateMock).toHaveBeenCalledWith({
      code: 'ABC123',
      quizId: '44444444-4444-4444-8444-444444444444',
    });
    fixture.destroy();
  });

  it('schließt den aktiven Q&A-Kanal über die Sichtbarkeitsaktion', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.selectChannel('qa');
    fixture.detectChanges();

    expect(fixture.componentInstance.activeChannelVisibilityActionLabel()).toBe('Kanal schließen');
    expect(fixture.componentInstance.activeChannelVisibilityIcon()).toBe('visibility_off');

    await fixture.componentInstance.toggleActiveChannelOpen();
    fixture.detectChanges();

    expect(closeQaChannelMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(fixture.componentInstance.isChannelOpen('qa')).toBe(false);
    expect(fixture.componentInstance.channelTabMetaLabel('qa')).toBe('Zu');
    fixture.destroy();
  });

  it('öffnet den aktiven Blitzlicht-Kanal über die Sichtbarkeitsaktion wieder', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: false },
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.activeChannel.set('quickFeedback');
    fixture.detectChanges();

    expect(fixture.componentInstance.activeChannelVisibilityActionLabel()).toBe(
      'Kanal wieder öffnen',
    );
    expect(fixture.componentInstance.activeChannelVisibilityIcon()).toBe('visibility');

    await fixture.componentInstance.toggleActiveChannelOpen();
    fixture.detectChanges();

    expect(reopenQuickFeedbackChannelMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(fixture.componentInstance.isChannelOpen('quickFeedback')).toBe(true);
    fixture.destroy();
  });

  it('räumt den Host-Token weg, wenn das Verlassen bestätigt wird', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });

    const fixture = setup();
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const canLeave = await fixture.componentInstance.canDeactivate();

    expect(canLeave).toBe(false);
    expect(endMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(clearHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
    fixture.destroy();
  });

  it('navigiert nach Home, wenn die Session beim Verlassen serverseitig schon gelöscht war', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    endMutateMock.mockRejectedValueOnce(new Error('Session nicht gefunden.'));

    const fixture = setup();
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const canLeave = await fixture.componentInstance.canDeactivate();

    expect(canLeave).toBe(false);
    expect(clearHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
    fixture.destroy();
  });

  it('blockiert beforeunload nur mit aktivem Schutz', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as SessionHostComponent & {
      unloadWarningEnabled: boolean;
    };

    component.unloadWarningEnabled = true;
    const blockedEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(blockedEvent);
    expect(blockedEvent.defaultPrevented).toBe(true);

    component.unloadWarningEnabled = false;
    const allowedEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(allowedEvent);
    expect(allowedEvent.defaultPrevented).toBe(false);

    fixture.destroy();
  });

  it('warnt in der leeren Lobby nicht vor beforeunload', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 0, participants: [] });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as SessionHostComponent & {
      unloadWarningEnabled: boolean;
      participantsPayload: {
        set(value: { participantCount: number; participants: unknown[] }): void;
      };
    };

    component.unloadWarningEnabled = true;
    component.participantsPayload.set({ participantCount: 0, participants: [] });
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(event);
    expect(event.defaultPrevented).toBe(false);

    fixture.destroy();
  });

  it('warnt in der Lobby mit Teilnehmenden vor beforeunload', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 3, participants: [] });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as SessionHostComponent & {
      unloadWarningEnabled: boolean;
      participantsPayload: {
        set(value: { participantCount: number; participants: unknown[] }): void;
      };
    };

    component.unloadWarningEnabled = true;
    component.participantsPayload.set({ participantCount: 3, participants: [] });
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(event);
    expect(event.defaultPrevented).toBe(true);

    fixture.destroy();
  });

  it('schaltet Musik beim Preset-Wechsel sofort um', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY', preset: 'PLAYFUL' });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => onStatusChangedSubscribeMock.mock.calls.length > 0, {
      timeout: 5000,
      interval: 25,
    });

    const component = fixture.componentInstance;
    const syncMusicSpy = vi.spyOn(component as never, 'syncMusic' as never);
    syncMusicSpy.mockClear();

    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setPreset('serious');

    await vi.waitUntil(() => component.musicMuted() === true, {
      timeout: 1000,
      interval: 10,
    });
    await vi.waitUntil(() => syncMusicSpy.mock.calls.length > 0, {
      timeout: 1000,
      interval: 10,
    });
    expect(component.musicMuted()).toBe(true);
    expect(syncMusicSpy.mock.calls.length).toBeGreaterThan(0);
    fixture.destroy();
  });

  it('schaltet Musik nach Kanalwechsel von Q&A zu Blitzlicht beim Preset-Wechsel sofort um', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => onStatusChangedSubscribeMock.mock.calls.length > 0, {
      timeout: 5000,
      interval: 25,
    });

    const component = fixture.componentInstance;
    component.selectChannel('qa');
    component.selectChannel('quickFeedback');
    expect(component.activeChannel()).toBe('quickFeedback');

    const syncMusicSpy = vi.spyOn(component as never, 'syncMusic' as never);
    syncMusicSpy.mockClear();

    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setPreset('spielerisch');
    themePreset.setPreset('serious');

    await vi.waitUntil(() => component.musicMuted() === true, {
      timeout: 1000,
      interval: 10,
    });
    await vi.waitUntil(() => syncMusicSpy.mock.calls.length > 0, {
      timeout: 1000,
      interval: 10,
    });
    expect(component.musicMuted()).toBe(true);
    expect(syncMusicSpy.mock.calls.length).toBeGreaterThan(0);
    fixture.destroy();
  });

  it('navigiert bei verwaister Session mit Session beenden zurück nach Home', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    endMutateMock.mockRejectedValueOnce(new Error('Session nicht gefunden.'));

    const fixture = setup();
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance.endSession();

    expect(clearHostTokenMock).toHaveBeenCalledWith('ABC123');
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
    expect(fixture.componentInstance.hostSteeringCallout()).toBeNull();
    fixture.destroy();
  });

  it('öffnet per Klick auf den fixierten Exit-Button den Beenden-Dialog', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor-button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    dialogOpenMock.mockClear();
    button?.click();
    await vi.waitUntil(() => dialogOpenMock.mock.calls.length === 1, {
      timeout: 1000,
      interval: 10,
    });
    expect(dialogOpenMock).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('blendet den Bonus-Code-Hinweis im Beenden-Dialog aus, wenn noch keine Ergebnisse vorliegen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      participantCount: 0,
      bonusTokenCount: 3,
    });
    getExportDataQueryMock.mockResolvedValue({
      sessionId: defaultSession.id,
      sessionCode: 'ABC123',
      quizName: 'Demo Quiz',
      finishedAt: '2026-03-24T12:30:00.000Z',
      participantCount: 0,
      teamMode: false,
      questions: [],
      teamLeaderboard: [],
      bonusTokens: [],
    });
    getLeaderboardQueryMock.mockResolvedValue([]);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    dialogOpenMock.mockClear();
    await fixture.componentInstance.onSessionEndAnchorClick();

    const dialogConfig = dialogOpenMock.mock.calls[0]?.[1] as
      { data?: { consequences?: string[] } } | undefined;
    expect(dialogConfig?.data?.consequences?.join(' ')).not.toContain('Bonus-Code');
    fixture.destroy();
  });

  it('zeigt den Bonus-Code-Hinweis im Beenden-Dialog nur mit verwertbaren Ergebnissen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      participantCount: 4,
      bonusTokenCount: 3,
    });
    getExportDataQueryMock.mockResolvedValue({
      sessionId: defaultSession.id,
      sessionCode: 'ABC123',
      quizName: 'Demo Quiz',
      finishedAt: '2026-03-24T12:30:00.000Z',
      participantCount: 4,
      teamMode: false,
      questions: [{ participantCount: 4, optionDistribution: [], freetextAggregates: [] }],
      teamLeaderboard: [],
      bonusTokens: [],
    });
    getLeaderboardQueryMock.mockResolvedValue([
      { participantId: 'p1', nickname: 'Ada', totalScore: 1200, rank: 1 },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    dialogOpenMock.mockClear();
    await fixture.componentInstance.onSessionEndAnchorClick();

    const dialogConfig = dialogOpenMock.mock.calls[0]?.[1] as
      { data?: { consequences?: string[] } } | undefined;
    expect(dialogConfig?.data?.consequences?.join(' ')).toContain('Bonus-Code');
    fixture.destroy();
  });

  it('zeigt für Q&A in der Lobby den Button Fragerunde starten', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      type: 'Q_AND_A',
      quizName: null,
      title: 'Offene Fragen',
      status: 'LOBBY',
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Offene Fragen');
    expect(text).toContain('Fragerunde starten');
    fixture.destroy();
  });

  it('zeigt nach initialem Q&A-Tabwechsel zum ungestarteten Quiz keinen leeren Quiz-Hinweis', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = setup([
      {
        provide: ActivatedRoute,
        useValue: {
          parent: {
            snapshot: {
              paramMap: convertToParamMap({ code: 'ABC123' }),
            },
          },
          snapshot: {
            queryParamMap: convertToParamMap({ tab: 'qa' }),
          },
        },
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.activeChannel()).toBe('qa');

    await component.selectChannel('quiz');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const steering = host.querySelector('.session-host__steering') as HTMLElement | null;
    expect(component.activeChannel()).toBe('quiz');
    expect(host.textContent ?? '').toContain('Erste Frage starten');
    expect(host.querySelector('.session-host__no-question')).toBeNull();
    expect(steering?.className).toContain('session-host__steering--prestart');
    fixture.destroy();
  });

  it('zeigt Kanal-Tabs für Quiz, Q&A und Blitzlicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Quiz');
    expect(text).toContain('Q&A');
    expect(text).toContain('Blitzlicht');
    fixture.destroy();
  });

  it('zeigt am Blitzlicht-Tab das Tempo-Icon bei abgehängter Tendenz', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    quickFeedbackHostResultsQueryMock.mockResolvedValue({
      type: 'TEMPO',
      locked: false,
      totalVotes: 12,
      distribution: { LOST: 12 },
      tempoTrend: {
        status: 'LOST',
        active: true,
        activeParticipants: 20,
        tempoVotes: 12,
        requiredVotes: 3,
        windowSeconds: 60,
        bucketSeconds: 15,
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.quickFeedbackResult.set({
      type: 'TEMPO',
      locked: false,
      totalVotes: 12,
      distribution: { LOST: 12 },
      tempoTrend: {
        status: 'LOST',
        active: true,
        activeParticipants: 20,
        tempoVotes: 12,
        requiredVotes: 3,
        windowSeconds: 60,
        bucketSeconds: 15,
      },
    });
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector(
      '.session-channel-tabs__tempo-indicator',
    ) as HTMLElement | null;

    expect(indicator).not.toBeNull();
    expect(indicator?.classList.contains('session-channel-tabs__tempo-indicator--alert')).toBe(
      true,
    );
    expect(indicator?.textContent?.trim()).toBe('🙈');
    expect(indicator?.getAttribute('aria-label')).toBe('Mehrere Teilnehmende sind abgehängt.');
    fixture.destroy();
  });

  it('ordnet Tempo-Tendenzen am Kanal-Tab den Tempo-Icons zu', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const baseResult = {
      type: 'TEMPO' as const,
      locked: false,
      totalVotes: 10,
      distribution: {},
      tempoTrend: {
        status: 'NEUTRAL' as const,
        active: false,
        activeParticipants: 20,
        tempoVotes: 1,
        requiredVotes: 3,
        windowSeconds: 60,
        bucketSeconds: 15,
      },
    };

    component.quickFeedbackResult.set(baseResult);
    expect(component.quickFeedbackTempoIndicator()).toBeNull();

    component.quickFeedbackResult.set({
      ...baseResult,
      tempoTrend: { ...baseResult.tempoTrend, status: 'FOLLOWING', active: true },
    });
    expect(component.quickFeedbackTempoIndicator()).toMatchObject({ tone: 'good', icon: '🙂' });

    component.quickFeedbackResult.set({
      ...baseResult,
      tempoTrend: { ...baseResult.tempoTrend, status: 'TOO_FAST', active: true },
    });
    expect(component.quickFeedbackTempoIndicator()).toMatchObject({ tone: 'caution', icon: '🐢' });

    component.quickFeedbackResult.set({
      ...baseResult,
      tempoTrend: { ...baseResult.tempoTrend, status: 'TOO_SLOW', active: true },
    });
    expect(component.quickFeedbackTempoIndicator()).toMatchObject({ tone: 'caution', icon: '🐇' });

    component.quickFeedbackResult.set({
      ...baseResult,
      tempoTrend: { ...baseResult.tempoTrend, status: 'HETEROGENEOUS', active: true },
    });
    expect(component.quickFeedbackTempoIndicator()).toMatchObject({
      tone: 'caution',
      icon: '🐇🐢',
      compound: true,
    });

    component.quickFeedbackResult.set({
      ...baseResult,
      tempoTrend: { ...baseResult.tempoTrend, status: 'LOST', active: true },
    });
    expect(component.quickFeedbackTempoIndicator()).toMatchObject({ tone: 'alert', icon: '🙈' });
    fixture.destroy();
  });

  it('behaelt den Tempo-Indikator bei transienten Ergebnisfehlern stabil', async () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const refreshQuickFeedbackResult = component as unknown as {
      refreshQuickFeedbackResult(): Promise<void>;
    };
    const tempoResult = {
      type: 'TEMPO' as const,
      locked: false,
      totalVotes: 12,
      distribution: { LOST: 12 },
      tempoTrend: {
        status: 'LOST' as const,
        active: true,
        activeParticipants: 20,
        tempoVotes: 12,
        requiredVotes: 3,
        windowSeconds: 60,
        bucketSeconds: 15,
      },
    };

    component.session.set({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    component.quickFeedbackResult.set(tempoResult);
    quickFeedbackHostResultsQueryMock.mockRejectedValueOnce(
      new Error('temporary quick feedback outage'),
    );

    await refreshQuickFeedbackResult.refreshQuickFeedbackResult();

    expect(quickFeedbackHostResultsQueryMock).toHaveBeenCalledWith({ sessionCode: 'ABC123' });
    expect(component.quickFeedbackResult()).toBe(tempoResult);
    expect(component.channelTempoIndicator('quickFeedback')).toMatchObject({
      tone: 'alert',
      icon: '🙈',
    });
    fixture.destroy();
  });

  it('zeigt fuer Freitext-Fragen die Word-Cloud-Aktion mit Live-Hinweis', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 5 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 5,
      text: 'Warum bleibt ein Satellit im Orbit?',
      type: 'FREETEXT',
      answers: [],
    });
    getLiveFreetextQueryMock.mockResolvedValue({
      ...defaultLiveFreetext,
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 5,
      questionType: 'FREETEXT',
      questionText: 'Warum bleibt ein Satellit im Orbit?',
      responses: ['Gravitation', 'Orbit'],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(
      () => (fixture.nativeElement.textContent ?? '').includes('Wortwolke anzeigen'),
      {
        timeout: 5000,
        interval: 25,
      },
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    const wordCloudDetails = fixture.nativeElement.querySelector('.session-host__extra');

    expect(wordCloudDetails?.className).toContain('session-host__extra--freetext');
    expect(wordCloudDetails?.className).toContain('session-host__extra--no-divider');
    expect(text).toContain('Wortwolke anzeigen');
    expect(text).not.toContain('Weitere Aktionen');
    expect(text).toContain('2 Antworten');
    expect(text).toContain('Live-Freitext wird aktualisiert.');
    expect(text).toContain('Live-Freitext');
    expect(text).toContain('Häufige Wörter aus den Antworten.');
    expect(text).toContain('Wortwolke einfrieren');
    fixture.destroy();
  });

  it('kann die Host-Wortwolke einfrieren und wieder live fortsetzen', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 5,
      text: 'Warum bleibt ein Satellit im Orbit?',
      type: 'FREETEXT',
      difficulty: 'EASY',
      answers: [],
    });
    getLiveFreetextQueryMock
      .mockResolvedValueOnce({
        ...defaultLiveFreetext,
        questionId: '11111111-1111-4111-8111-111111111111',
        questionOrder: 5,
        questionType: 'FREETEXT',
        questionText: 'Warum bleibt ein Satellit im Orbit?',
        responses: ['Gravitation', 'Orbit'],
      })
      .mockResolvedValue({
        ...defaultLiveFreetext,
        questionId: '11111111-1111-4111-8111-111111111111',
        questionOrder: 5,
        questionType: 'FREETEXT',
        questionText: 'Warum bleibt ein Satellit im Orbit?',
        responses: ['Gravitation', 'Orbit', 'Trägheit'],
      });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.displayedFreetextResponses().length === 2, {
      timeout: 5000,
      interval: 25,
    });

    const component = fixture.componentInstance;
    await component.toggleWordCloudFreeze();
    fixture.detectChanges();

    expect(component.wordCloudFrozen()).toBe(true);
    expect(component.displayedFreetextResponses()).toEqual(['Gravitation', 'Orbit']);
    expect(component.wordCloudFreezeLabel()).toBe('Live fortsetzen');
    expect(component.displayedWordCloudInfo()).toBe('Wortwolke eingefroren.');

    component.freetextResponses.set(['Gravitation', 'Orbit', 'Trägheit']);
    expect(component.displayedFreetextResponses()).toEqual(['Gravitation', 'Orbit']);

    await component.toggleWordCloudFreeze();
    fixture.detectChanges();
    await vi.waitUntil(() => component.displayedFreetextResponses().length === 3, {
      timeout: 5000,
      interval: 25,
    });

    expect(component.wordCloudFrozen()).toBe(false);
    expect(component.displayedFreetextResponses()).toEqual(['Gravitation', 'Orbit', 'Trägheit']);
    expect(component.wordCloudFreezeLabel()).toBe('Wortwolke einfrieren');
    fixture.destroy();
  });

  it('schaltet fuer Freitext zwischen Einzelwoertern und Woertern mit Phrasen um', async () => {
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 5,
      text: 'Warum bleibt ein Satellit im Orbit?',
      type: 'FREETEXT',
      difficulty: 'EASY',
      answers: [],
    });
    getLiveFreetextQueryMock.mockResolvedValue({
      ...defaultLiveFreetext,
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 5,
      questionType: 'FREETEXT',
      questionText: 'Warum bleibt ein Satellit im Orbit?',
      responses: ['Lineare Regression im Projekt', 'Lineare Regression hilft'],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.displayedFreetextResponses().length === 2, {
      timeout: 5000,
      interval: 25,
    });

    const component = fixture.componentInstance;
    expect(component.freetextWordCloudMode()).toBe('PHRASES');
    expect(component.displayedFreetextWordCloudTerms().some((term) => term.key.includes(' '))).toBe(
      true,
    );

    component.setFreetextWordCloudMode('WORDS');
    fixture.detectChanges();

    expect(component.freetextWordCloudMode()).toBe('WORDS');
    expect(
      component.displayedFreetextWordCloudTerms().every((term) => !term.key.includes(' ')),
    ).toBe(true);

    component.setFreetextWordCloudMode('PHRASES');
    fixture.detectChanges();

    expect(component.displayedFreetextWordCloudTerms().some((term) => term.key.includes(' '))).toBe(
      true,
    );
    fixture.destroy();
  });

  it('oeffnet die Freitext-Wortwolke im Vollbild mit Analyse-Toggle und Freeze-Steuerung', async () => {
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 5,
      text: 'Warum bleibt ein Satellit im Orbit?',
      type: 'FREETEXT',
      difficulty: 'EASY',
      answers: [],
    });
    getLiveFreetextQueryMock.mockResolvedValue({
      ...defaultLiveFreetext,
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 5,
      questionType: 'FREETEXT',
      questionText: 'Warum bleibt ein Satellit im Orbit?',
      responses: ['Lineare Regression im Projekt', 'Lineare Regression hilft'],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.displayedFreetextResponses().length === 2, {
      timeout: 5000,
      interval: 25,
    });

    const component = fixture.componentInstance;
    component.setFreetextWordCloudMode('WORDS');
    await component.toggleWordCloudFreeze();

    const documentRef = TestBed.inject(DOCUMENT);
    const requestFullscreenSpy = vi.fn().mockResolvedValue(undefined);
    const previousDescriptor = Object.getOwnPropertyDescriptor(
      documentRef.documentElement,
      'requestFullscreen',
    );
    Object.defineProperty(documentRef.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenSpy,
    });

    dialogOpenMock.mockClear();
    try {
      await component.openFreetextWordCloudDialog();

      expect(requestFullscreenSpy).toHaveBeenCalledWith({ navigationUI: 'hide' });
      expect(dialogOpenMock).toHaveBeenCalledTimes(1);
      const [, config] = dialogOpenMock.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(config['panelClass']).toBe('word-cloud-dialog-panel');
      expect(config['height']).toBe('100dvh');
      const data = config['data'] as {
        analysisVariant: () => string;
        setAnalysisVariant: (variant: 'WORDS' | 'PHRASES') => void;
        frozen: () => boolean;
        freezeLabel: () => string;
        toggleFreeze: () => Promise<void>;
        terms: () => Array<{ key: string }>;
      };
      expect(data.analysisVariant()).toBe('WORDS');
      expect(data.frozen()).toBe(true);
      expect(data.freezeLabel()).toBe('Live fortsetzen');
      expect(data.terms().every((term) => !term.key.includes(' '))).toBe(true);

      data.setAnalysisVariant('PHRASES');
      expect(component.freetextWordCloudMode()).toBe('PHRASES');
      expect(data.terms().some((term) => term.key.includes(' '))).toBe(true);

      await data.toggleFreeze();
      expect(component.wordCloudFrozen()).toBe(false);
    } finally {
      if (previousDescriptor) {
        Object.defineProperty(documentRef.documentElement, 'requestFullscreen', previousDescriptor);
      } else {
        delete (documentRef.documentElement as Partial<HTMLElement>).requestFullscreen;
      }
    }
    fixture.destroy();
  });

  it('zeigt im Fragen-Tab eine upvote-gewichtete Q&A-Word-Cloud fuer sichtbare Fragen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
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
        hasUpvoted: false,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        text: 'Ist das klausurrelevant?',
        upvoteCount: 12,
        status: 'PENDING',
        createdAt: '2026-03-13T12:02:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudQuestions().length === 2, {
      timeout: 5000,
      interval: 25,
    });

    fixture.componentInstance.activeChannel.set('qa');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Wortwolke anzeigen');
    expect(text).toContain(
      '2 sichtbare Fragen · Größe von Wörtern und Phrasen: belastbare Zustimmung',
    );
    expect(fixture.componentInstance.qaWordCloudQuestions()).toHaveLength(2);
    expect(fixture.componentInstance.qaWordCloudWeightedResponses()[0]?.weight).toBe(4);
    expect(fixture.componentInstance.qaWordCloudTitle()).toBe('Q&A-Wortwolke');

    dialogOpenMock.mockClear();
    const trigger = fixture.nativeElement.querySelector(
      '.session-host__extra-summary--button',
    ) as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();

    trigger?.click();
    await vi.waitUntil(() => dialogOpenMock.mock.calls.length === 1, {
      timeout: 1000,
      interval: 10,
    });

    const [, config] = dialogOpenMock.mock.calls[0] as [unknown, Record<string, unknown>];
    const data = config['data'] as {
      title: () => string;
      weightingHint: () => string | null;
      terms: () => Array<{ key: string }>;
    };
    expect(data.title()).toBe('Q&A-Wortwolke');
    expect(data.weightingHint()).toContain('viel Zustimmung');
    expect(data.terms().some((term) => term.key === 'kapitel')).toBe(true);
    fixture.destroy();
  });

  it('markiert Markdown-Container im Q&A-Kanal fuer responsive Bild-Styles', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: '![Frage](https://example.com/qa.png)',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaQuestions().length === 1, {
      timeout: 5000,
      interval: 25,
    });

    fixture.componentInstance.activeChannel.set('qa');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const qaText = fixture.nativeElement.querySelector(
      '.session-qa-card__text',
    ) as HTMLElement | null;

    expect(qaText?.classList.contains('markdown-body')).toBe(true);
    fixture.destroy();
  });

  it('zeigt im Host-Q&A fuer Kita-Reserve-Namen ein eindeutiges Tier-Badge an', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
        text: 'Kannst du das Beispiel noch einmal erklären?',
        upvoteCount: 5,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        authorNickname: 'Roter Drache 2',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaQuestions().length === 1, {
      timeout: 5000,
      interval: 25,
    });

    fixture.componentInstance.activeChannel.set('qa');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector(
      '.session-qa-card__author-icon',
    ) as HTMLElement | null;

    expect(badge?.textContent?.trim()).toBe('🐉 2');
    expect(badge?.getAttribute('title')).toBe('Roter Drache 2');
    fixture.destroy();
  });

  it('selektiert Host-Q&A-Fragen per Tier-Badge und hebt die Auswahl mit Escape wieder auf', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    component.session.set({
      ...defaultSession,
      status: 'ACTIVE',
      nicknameTheme: 'KINDERGARTEN',
      anonymousMode: false,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    component.activeChannel.set('qa');
    component.qaQuestions.set([
      {
        id: 'question-1',
        text: 'Kannst du das Beispiel noch einmal erklären?',
        upvoteCount: 5,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        authorNickname: 'Roter Drache 2',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
      {
        id: 'question-2',
        text: 'Gibt es die Folien später online?',
        upvoteCount: 3,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:05:00.000Z',
        authorNickname: 'Grüner Frosch',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const badges = host.querySelectorAll('.session-qa-card__author-icon');
    (badges[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    let cards = host.querySelectorAll('.session-qa-card');

    expect(component.qaSelectedAuthorNickname()).toBe('Roter Drache 2');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.className).toContain('session-qa-card--author-selected');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    cards = host.querySelectorAll('.session-qa-card');

    expect(component.qaSelectedAuthorNickname()).toBeNull();
    expect(cards).toHaveLength(2);
    expect(cards[0]?.className).not.toContain('session-qa-card--author-selected');
    fixture.destroy();
  });

  it('zeigt bei aktiver reiner Q&A-Session das Fragen-Panel statt nur der Live-Karte', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      type: 'Q_AND_A',
      quizName: null,
      title: 'Offene Fragen',
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: false },
        qa: { enabled: true, open: true, title: 'Offene Fragen', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Welche Hilfsmittel sind in der Klausur erlaubt?',
        upvoteCount: 7,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudQuestions().length === 1, {
      timeout: 5000,
      interval: 25,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    const exitAnchor = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor',
    ) as HTMLElement;
    expect(fixture.componentInstance.activeChannel()).toBe('qa');
    expect(fixture.componentInstance.showPrimaryLiveView()).toBe(false);
    expect(text).toContain('Vorab-Moderation');
    expect(text).toContain('Session beenden');
    expect(exitAnchor.className).toContain('session-host__exit-anchor--fixed');
    expect(text).toContain('Wortwolke anzeigen');
    fixture.destroy();
  });

  it('führt im Fragen-Tab eine Moderationsaktion aus', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Was ist klausurrelevant?',
        upvoteCount: 3,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    fixture.detectChanges();
    await component.moderateQaQuestion('44444444-4444-4444-8444-444444444444', 'APPROVE');

    expect(qaModerateMutateMock).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      questionId: '44444444-4444-4444-8444-444444444444',
      action: 'APPROVE',
    });
    fixture.destroy();
  });

  it('zählt gelöschte Q&A-Fragen nicht mehr im Gesamtstand des Forums', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Sichtbare Frage',
        upvoteCount: 3,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        text: 'Bereits entfernte Frage',
        upvoteCount: 0,
        status: 'DELETED',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Gesamt: 1');
    expect(text).not.toContain('Gesamt: 2');
    expect(text).toContain('Sichtbare Frage');
    expect(text).not.toContain('Bereits entfernte Frage');
    expect(fixture.nativeElement.querySelectorAll('.session-qa-card')).toHaveLength(1);
    fixture.destroy();
  });

  it('schaltet im Host zwischen Q&A-Sortiermodi um und lädt BEST neu', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Welche Frage gewinnt?',
        upvoteCount: 4,
        score: 4,
        positiveVoteCount: 5,
        negativeVoteCount: 1,
        voteCount: 6,
        bestScore: 0.71,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    fixture.detectChanges();
    const qaList = fixture.nativeElement.querySelector('.session-qa-list') as HTMLElement | null;
    expect(qaList).toBeTruthy();
    Object.defineProperty(qaList!, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const scrollToSpy = vi.spyOn(qaList!, 'scrollTo').mockImplementation(() => undefined);

    await component.setQaSortMode('TOP');
    fixture.detectChanges();
    qaListQueryMock.mockClear();
    qaOnQuestionsUpdatedSubscribeMock.mockClear();
    scrollToSpy.mockClear();

    await component.setQaSortMode('BEST');
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 0);

    expect(qaListQueryMock).toHaveBeenCalledWith({
      sessionId: defaultSession.id,
      moderatorView: true,
      sort: 'BEST',
    });
    expect(qaOnQuestionsUpdatedSubscribeMock).toHaveBeenCalledWith(
      {
        sessionId: defaultSession.id,
        moderatorView: true,
        sort: 'BEST',
      },
      expect.any(Object),
    );
    expect(component.qaSortMode()).toBe('BEST');
    expect(component.qaWordCloudQuestionWeight(component.qaQuestions()[0]!)).toBe(21);
    expect(component.qaWordCloudTitle()).toBe('Q&A-Wortwolke');
    expect(component.qaWordCloudInfo()).toBe(
      '1 sichtbare Frage · Größe von Wörtern und Phrasen: belastbare Zustimmung',
    );
    expect(fixture.nativeElement.textContent ?? '').toContain(
      'Zeigt Fragen mit viel Zustimmung und genug Stimmen zuerst. Angeheftete Fragen sind markiert, aber nicht vorgezogen.',
    );
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    scrollToSpy.mockRestore();
    fixture.destroy();
  });

  it('kennzeichnet kontroverse Fragen in der Host-Liste sichtbar', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Das Publikum ist gespalten.',
        upvoteCount: 0,
        score: 0,
        positiveVoteCount: 8,
        negativeVoteCount: 8,
        voteCount: 16,
        controversyScore: 0.8,
        isControversial: true,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    await component.setQaSortMode('CONTROVERSIAL');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(component.qaWordCloudQuestionWeight(component.qaQuestions()[0]!)).toBe(27);
    expect(component.qaWordCloudTitle()).toBe('Q&A-Wortwolke');
    expect(component.qaWordCloudInfo()).toBe(
      '1 sichtbare Frage · Größe von Wörtern und Phrasen: Kontroverse',
    );
    expect(text).toContain('Umstritten');
    expect(text).toContain('8 positiv · 8 negativ');
    expect(text).toContain('Geteilte Reaktionen 80 %');
    fixture.destroy();
  });

  it('oeffnet die Q&A-Wortwolke im Vollbild mit Sortierzustand des Hosts', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Welche Frage gewinnt?',
        upvoteCount: 0,
        score: 0,
        positiveVoteCount: 8,
        negativeVoteCount: 8,
        voteCount: 16,
        controversyScore: 0.8,
        isControversial: true,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    await component.setQaSortMode('CONTROVERSIAL');
    fixture.detectChanges();

    const requestFullscreenSpy = vi.fn(() => Promise.resolve());
    const documentRef = TestBed.inject(DOCUMENT);
    const previousDescriptor = Object.getOwnPropertyDescriptor(
      documentRef.documentElement,
      'requestFullscreen',
    );
    Object.defineProperty(documentRef.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenSpy,
    });

    dialogOpenMock.mockClear();
    try {
      await component.openQaWordCloudDialog();

      expect(requestFullscreenSpy).toHaveBeenCalledWith({ navigationUI: 'hide' });
      expect(dialogOpenMock).toHaveBeenCalledTimes(1);
      const [, config] = dialogOpenMock.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(config['panelClass']).toBe('word-cloud-dialog-panel');
      expect(config['height']).toBe('100dvh');
      const data = config['data'] as {
        analysisVariant: () => string;
        themeModeAvailable: () => boolean;
        sortMode: () => string;
        title: () => string;
        tooltipMetricLabel: () => string;
        weightingHint: () => string | null;
      };
      expect(data.analysisVariant()).toBe('THEME');
      expect(data.themeModeAvailable()).toBe(true);
      expect(data.sortMode()).toBe('CONTROVERSIAL');
      expect(data.title()).toBe('Q&A-Wortwolke');
      expect(data.tooltipMetricLabel()).toBe('Kontroverse');
      expect(data.weightingHint()).toContain('gegensätzlichen Reaktionen');
    } finally {
      if (previousDescriptor) {
        Object.defineProperty(documentRef.documentElement, 'requestFullscreen', previousDescriptor);
      } else {
        delete (documentRef.documentElement as Partial<HTMLElement>).requestFullscreen;
      }
    }
    fixture.destroy();
  });

  it('startet die Q&A-Wortwolke standardmaessig im Themenmodus', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
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
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);
    wordCloudAnalyzeQueryMock.mockResolvedValue({
      mode: 'THEME',
      locale: 'de',
      metric: 'BEST',
      generatedAt: '2026-03-24T12:00:00.000Z',
      fallbackUsed: false,
      entries: [
        {
          key: 'kapitel-4',
          label: 'Kapitel 4',
          count: 7,
          basisLabel: 'Kapitel 4',
          members: [
            {
              sourceId: '11111111-1111-4111-8111-111111111111',
              text: 'Kommt Kapitel 4 in der Klausur vor?',
              weight: 4,
            },
            {
              sourceId: '22222222-2222-4222-8222-222222222222',
              text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
              weight: 3,
            },
          ],
          variants: ['Kapitel 4'],
          confidence: 0.88,
        },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudQuestions().length === 2, {
      timeout: 5000,
      interval: 25,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(wordCloudAnalyzeQueryMock).not.toHaveBeenCalled();

    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => NEVER });
    await fixture.componentInstance.openQaWordCloudDialog();
    await vi.waitUntil(() => wordCloudAnalyzeQueryMock.mock.calls.length >= 1, {
      timeout: 5000,
      interval: 25,
    });
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudAnalysisEntries()?.length === 1, {
      timeout: 5000,
      interval: 25,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.qaWordCloudAnalysisVariant()).toBe('THEME');
    expect(wordCloudAnalyzeQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionCode: 'ABC123',
        mode: 'THEME',
      }),
    );
    expect(fixture.componentInstance.qaWordCloudAnalysisEntries()).toMatchObject([
      {
        label: 'Kapitel 4',
      },
    ]);
    fixture.destroy();
  });

  it('nutzt den lokalen Themenmodus fuer Q&A-Live-Lokalisierungen ohne Backend-Analyzer', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Questions du public', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        text: 'Comment suivre les questions importantes?',
        upvoteCount: 5,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup([{ provide: LOCALE_ID, useValue: 'fr' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudQuestions().length === 1, {
      timeout: 5000,
      interval: 25,
    });

    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => NEVER });
    await fixture.componentInstance.openQaWordCloudDialog();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(wordCloudAnalyzeQueryMock).not.toHaveBeenCalled();
    expect(fixture.componentInstance.qaWordCloudAnalysisLocale()).toBeNull();
    expect(fixture.componentInstance.qaWordCloudEffectiveAnalysisVariant()).toBe('THEME');
    expect(fixture.componentInstance.qaWordCloudTerms().length).toBeGreaterThan(0);

    const [, config] = dialogOpenMock.mock.calls[0] as [unknown, Record<string, unknown>];
    const data = config['data'] as {
      analysisVariant: () => string;
      themeModeAvailable: () => boolean;
      themeFallbackHint: () => string | null;
      terms: () => Array<{ key: string }>;
    };
    expect(data.analysisVariant()).toBe('THEME');
    expect(data.themeModeAvailable()).toBe(true);
    expect(data.themeFallbackHint()).toBeNull();
    expect(data.terms().length).toBeGreaterThan(0);
    fixture.destroy();
  });

  it('schaltet fuer die Q&A-Wortwolke in den Themenmodus und rendert erfolgreiche Theme-Entries', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
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
        hasUpvoted: false,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);
    wordCloudAnalyzeQueryMock.mockResolvedValue({
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      generatedAt: '2026-03-24T12:00:00.000Z',
      fallbackUsed: false,
      entries: [
        {
          key: 'kapitel-4',
          label: 'Kapitel 4',
          count: 7,
          basisLabel: 'Kapitel 4',
          members: [
            {
              sourceId: '11111111-1111-4111-8111-111111111111',
              text: 'Kommt Kapitel 4 in der Klausur vor?',
              weight: 4,
            },
            {
              sourceId: '22222222-2222-4222-8222-222222222222',
              text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
              weight: 3,
            },
          ],
          variants: ['Kapitel 4'],
          confidence: 0.88,
        },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudQuestions().length === 2, {
      timeout: 5000,
      interval: 25,
    });

    fixture.componentInstance.activeChannel.set('qa');
    fixture.componentInstance.setQaWordCloudAnalysisVariant('THEME');
    fixture.detectChanges();

    dialogOpenMock.mockClear();
    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => NEVER });
    await fixture.componentInstance.openQaWordCloudDialog();

    await vi.waitUntil(() => wordCloudAnalyzeQueryMock.mock.calls.length >= 1, {
      timeout: 5000,
      interval: 25,
    });
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudAnalysisEntries()?.length === 1, {
      timeout: 5000,
      interval: 25,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(wordCloudAnalyzeQueryMock).toHaveBeenCalledWith({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: fixture.componentInstance.qaWordCloudAnalysisLocale(),
      metric: 'BEST',
      maxEntries: 40,
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          weight: 4,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
          weight: 3,
        },
      ],
    });
    expect(fixture.componentInstance.qaWordCloudThemeFallbackHint()).toBeNull();
    expect(fixture.componentInstance.qaWordCloudAnalysisEntries()).toMatchObject([
      {
        label: 'Kapitel 4',
      },
    ]);

    const [, config] = dialogOpenMock.mock.calls[0] as [unknown, Record<string, unknown>];
    const data = config['data'] as {
      analysisVariant: () => string;
      analysisEntries: () => Array<{ label: string }> | null;
      themeModeAvailable: () => boolean;
      themeFallbackHint: () => string | null;
    };
    expect(data.analysisVariant()).toBe('THEME');
    expect(data.themeModeAvailable()).toBe(true);
    expect(data.analysisEntries()).toMatchObject([{ label: 'Kapitel 4' }]);
    expect(data.themeFallbackHint()).toBeNull();
    fixture.destroy();
  });

  it('gibt Analysemodus und erfolgreiche Theme-Entries an den Q&A-Wortwolken-Dialog weiter', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Kommt Kapitel 4 in der Klausur vor?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
        upvoteCount: 9,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:01:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);
    wordCloudAnalyzeQueryMock.mockResolvedValue({
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      generatedAt: '2026-03-24T12:00:00.000Z',
      fallbackUsed: false,
      entries: [
        {
          key: 'kapitel-4',
          label: 'Kapitel 4',
          count: 7,
          basisLabel: 'Kapitel 4',
          members: [
            {
              sourceId: '44444444-4444-4444-8444-444444444444',
              text: 'Kommt Kapitel 4 in der Klausur vor?',
              weight: 3,
            },
            {
              sourceId: '55555555-5555-4555-8555-555555555555',
              text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
              weight: 4,
            },
          ],
          variants: ['Kapitel 4'],
          confidence: 0.88,
        },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudQuestions().length === 2, {
      timeout: 5000,
      interval: 25,
    });

    fixture.componentInstance.activeChannel.set('qa');
    fixture.componentInstance.setQaWordCloudAnalysisVariant('THEME');

    dialogOpenMock.mockClear();
    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => NEVER });
    await fixture.componentInstance.openQaWordCloudDialog();

    await vi.waitUntil(() => wordCloudAnalyzeQueryMock.mock.calls.length >= 1, {
      timeout: 5000,
      interval: 25,
    });
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudAnalysisEntries()?.length === 1, {
      timeout: 5000,
      interval: 25,
    });
    fixture.detectChanges();

    const [, config] = dialogOpenMock.mock.calls[0] as [unknown, Record<string, unknown>];
    const data = config['data'] as {
      analysisVariant: () => string;
      analysisEntries: () => Array<{ label: string }> | null;
      themeModeAvailable: () => boolean;
      themeFallbackHint: () => string | null;
    };
    expect(data.analysisVariant()).toBe('THEME');
    expect(data.themeModeAvailable()).toBe(true);
    expect(data.analysisEntries()?.[0]?.label).toBe('Kapitel 4');
    expect(data.themeFallbackHint()).toBeNull();
    fixture.destroy();
  });

  it('unterdrueckt Backend-Fallback-Hinweise, wenn lokale Terme verfuegbar sind', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '66666666-6666-4666-8666-666666666666',
        text: 'Welche Frage gewinnt?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);
    wordCloudAnalyzeQueryMock.mockResolvedValue({
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      generatedAt: '2026-03-24T12:00:00.000Z',
      fallbackUsed: true,
      entries: [
        {
          key: 'gewinnt',
          label: 'gewinnt',
          count: 3,
          basisLabel: null,
          members: [
            {
              sourceId: '66666666-6666-4666-8666-666666666666',
              text: 'Welche Frage gewinnt?',
              weight: 3,
            },
          ],
          variants: ['gewinnt'],
          confidence: null,
        },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudQuestions().length === 1, {
      timeout: 5000,
      interval: 25,
    });

    fixture.componentInstance.activeChannel.set('qa');
    fixture.componentInstance.setQaWordCloudAnalysisVariant('THEME');

    dialogOpenMock.mockClear();
    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => NEVER });
    await fixture.componentInstance.openQaWordCloudDialog();

    await vi.waitUntil(() => wordCloudAnalyzeQueryMock.mock.calls.length >= 1, {
      timeout: 5000,
      interval: 25,
    });
    await vi.waitUntil(() => fixture.componentInstance.qaWordCloudAnalysisEntries()?.length === 1, {
      timeout: 5000,
      interval: 25,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.qaWordCloudThemeFallbackHint()).toBeNull();

    const [, config] = dialogOpenMock.mock.calls[0] as [unknown, Record<string, unknown>];
    const data = config['data'] as {
      analysisVariant: () => string;
      themeModeAvailable: () => boolean;
      themeFallbackHint: () => string | null;
      terms: () => Array<{ key: string }>;
    };
    expect(data.analysisVariant()).toBe('THEME');
    expect(data.themeModeAvailable()).toBe(true);
    expect(data.themeFallbackHint()).toBeNull();
    expect(data.terms().length).toBeGreaterThan(0);
    fixture.destroy();
  });

  it('zeigt am Fragen-Tab einen Hinweis auf neue Fragen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Ist das klausurrelevant?',
        upvoteCount: 1,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('1 neu');
    fixture.destroy();
  });

  it('hebt neue Fragen im Fragen-Tab in der Liste hervor', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Was kommt in der Klausur dran?',
        upvoteCount: 2,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const highlightedCard = fixture.nativeElement.querySelector('.session-qa-card--highlight');
    expect(highlightedCard).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt Steuerungs-Ansicht mit Frage und Button bei Status ACTIVE', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    const question = {
      order: 0,
      text: 'Was ist 2+2?',
      type: 'SINGLE_CHOICE' as const,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: '3', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: '4', isCorrect: true },
      ],
    };
    getCurrentQuestionForHostQueryMock.mockResolvedValue(question);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => (fixture.nativeElement.textContent ?? '').includes('Was ist 2+2?'), {
      timeout: 5000,
      interval: 25,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Was ist 2+2?');
    expect(text).toContain('Ergebnis zeigen');
    expect(getCurrentQuestionForHostQueryMock).toHaveBeenCalled();
    fixture.destroy();
  });

  it('zeigt die Schwierigkeit der aktuellen Frage in der Host-Karte an', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: 'Was ist 2+2?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'HARD' as const,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: '3', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: '4', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => (fixture.nativeElement.textContent ?? '').includes('Schwer'), {
      timeout: 5000,
      interval: 25,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Single Choice');
    expect(text).toContain('Schwer');
    fixture.destroy();
  });

  it('zeigt bei RESULTS die Sicherheitsgrad-Auswertung mit Fehlkonzept-Hinweis', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'RESULTS' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 1,
      text: 'Was ist 2+2?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      currentRound: 1,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: '5', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: '4', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: '5',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 50,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: '4',
          isCorrect: true,
          voteCount: 1,
          votePercentage: 50,
        },
      ],
      totalVotes: 2,
      correctVoterCount: 1,
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
      confidenceResult: {
        distribution: { '1': 1, '2': 0, '3': 0, '4': 0, '5': 1 },
        crossTab: {
          correctHigh: 0,
          correctMid: 0,
          correctLow: 1,
          incorrectHigh: 1,
          incorrectMid: 0,
          incorrectLow: 0,
        },
        highConfidenceWrongCount: 1,
        highConfidenceWrongOptions: [
          { answerId: 'aaaaaaaa-1111-4111-8111-111111111111', text: '5', count: 1 },
        ],
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(
      () => fixture.nativeElement.querySelector('.session-host__confidence') !== null,
      { timeout: 5000, interval: 25 },
    );
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.session-host__confidence-alert')?.textContent).toContain(
      'selbstsicher falsch',
    );
    expect(host.querySelector('.session-host__confidence-crosstab-cell--heat-risk')).not.toBeNull();
    expect(
      host.querySelector('.session-host__confidence-crosstab-cell--heat-focus'),
    ).not.toBeNull();
    expect(host.querySelector('.session-host__confidence-wrong-options-list')).not.toBeNull();
    fixture.destroy();
  });

  it('markiert Markdown-Container im Quiz-Livekanal fuer responsive Bild-Styles', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: '![Frage](https://example.com/question.png)',
      type: 'SINGLE_CHOICE' as const,
      answers: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: '![Antwort](https://example.com/answer.png)',
          isCorrect: false,
        },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'Text', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(
      () => fixture.nativeElement.querySelector('.session-host__question-title-inner') !== null,
      {
        timeout: 5000,
        interval: 25,
      },
    );
    fixture.detectChanges();

    const questionText = fixture.nativeElement.querySelector(
      '.session-host__question-title-inner',
    ) as HTMLElement | null;
    const answerText = fixture.nativeElement.querySelector(
      '.session-host__answer-text',
    ) as HTMLElement | null;

    expect(questionText?.classList.contains('markdown-body')).toBe(true);
    expect(questionText?.closest('h1.session-host__question-title')).toBeTruthy();
    expect(questionText?.closest('[role="heading"][aria-level="1"]')).toBeNull();
    expect(answerText?.classList.contains('markdown-body')).toBe(true);
    fixture.destroy();
  });

  it('empfiehlt bei passendem Korridor eine zweite Runde statt aktiver Ergebnisanzeige', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 4, participants: [] });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0, currentRound: 1 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: 'Was ist 2+2?',
      type: 'SINGLE_CHOICE' as const,
      currentRound: 1,
      totalVotes: 4,
      peerInstructionSuggestion: {
        suggested: true,
        reason: 'CORRECTNESS_WINDOW' as const,
      },
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: '3', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: '4', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(
      () => (fixture.nativeElement.textContent ?? '').includes('Peer Instruction empfohlen'),
      {
        timeout: 5000,
        interval: 25,
      },
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('Peer Instruction empfohlen');
    expect(text).toMatch(/35\s*[–-]\s*70/);
    const exitAnchor = el.querySelector('.session-host__exit-anchor') as HTMLElement;
    const buttonTexts = Array.from(exitAnchor.querySelectorAll('button'), (button) =>
      (button.textContent ?? '').replace(/^groups/, '').trim(),
    );
    expect(exitAnchor.className).toContain('session-host__exit-anchor--with-primary');
    expect(buttonTexts).toEqual([
      'Diskussionsphase',
      'Ergebnis trotzdem zeigen',
      'Session beenden',
    ]);
    fixture.destroy();
  });

  it('stoppt Musik, sobald alle abgestimmt haben, und aktiviert sie wieder bei neuer Abstimmung', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE', preset: 'PLAYFUL' });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 4, participants: [] });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: 'Was ist 2+2?',
      type: 'SINGLE_CHOICE' as const,
      currentRound: 1,
      totalVotes: 4,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: '3', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: '4', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.musicMuted.set(false);
    fixture.detectChanges();

    expect(component.allHaveVoted()).toBe(true);
    expect(component.activeMusicTrack()).toBeNull();

    component.currentQuestionForHost.update((q) => (q ? { ...q, totalVotes: 2 } : q));
    fixture.detectChanges();

    expect(component.allHaveVoted()).toBe(false);
    expect(component.activeMusicTrack()).toBe('COUNTDOWN_0');
    fixture.destroy();
  });

  it('aktiviert nach einer beendeten Countdown-Phase wieder Lesephasen-Musik', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'QUESTION_OPEN',
      preset: 'PLAYFUL',
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.musicMuted.set(false);
    component.countdownEnded.set(true);
    component.countdownSfxPhase.set(true);
    component.statusUpdate.set({
      status: 'QUESTION_OPEN',
      currentQuestion: 1,
      activeAt: null,
    });
    fixture.detectChanges();

    expect(component.currentMusicPhase()).toBe('reading');
    expect(component.activeMusicTrack()).toBe('READING_0');
    fixture.destroy();
  });

  it('startet die passende Live-Musik bei Musik-Phasenwechseln sofort', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY', preset: 'PLAYFUL' });

    const fixture = setup();
    const component = fixture.componentInstance;
    const playMusicSpy = vi.spyOn(component.sound, 'playMusic').mockResolvedValue();
    const stopMusicSpy = vi.spyOn(component.sound, 'stopMusic').mockImplementation(() => {});

    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => onStatusChangedSubscribeMock.mock.calls.length > 0, {
      timeout: 5000,
      interval: 25,
    });

    component.musicMuted.set(false);
    playMusicSpy.mockClear();
    stopMusicSpy.mockClear();

    const statusHandler = onStatusChangedSubscribeMock.mock.calls[0]?.[1]?.onData as
      | ((data: {
          status: string;
          currentQuestion: number | null;
          activeAt?: string | null;
        }) => void)
      | undefined;

    expect(statusHandler).toBeTypeOf('function');

    statusHandler?.({ status: 'QUESTION_OPEN', currentQuestion: 0, activeAt: null });
    await vi.waitUntil(() => playMusicSpy.mock.calls.some(([track]) => track === 'READING_0'), {
      timeout: 1000,
      interval: 10,
    });

    playMusicSpy.mockClear();
    statusHandler?.({ status: 'ACTIVE', currentQuestion: 0, activeAt: null });
    await vi.waitUntil(() => playMusicSpy.mock.calls.some(([track]) => track === 'COUNTDOWN_0'), {
      timeout: 1000,
      interval: 10,
    });

    playMusicSpy.mockClear();
    stopMusicSpy.mockClear();
    statusHandler?.({ status: 'RESULTS', currentQuestion: 0, activeAt: null });
    await vi.waitUntil(() => stopMusicSpy.mock.calls.length > 0, {
      timeout: 1000,
      interval: 10,
    });

    playMusicSpy.mockClear();
    statusHandler?.({ status: 'LOBBY', currentQuestion: null, activeAt: null });
    await vi.waitUntil(() => playMusicSpy.mock.calls.some(([track]) => track === 'LOBBY_2'), {
      timeout: 1000,
      interval: 10,
    });

    fixture.destroy();
  });

  it('startet bei Phasenwechseln keine Live-Musik, wenn das Preset sie deaktiviert', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY', preset: 'SERIOUS' });

    const fixture = setup();
    TestBed.inject(ThemePresetService).setPreset('serious', { silent: true });
    const component = fixture.componentInstance;
    const playMusicSpy = vi.spyOn(component.sound, 'playMusic').mockResolvedValue();
    const stopMusicSpy = vi.spyOn(component.sound, 'stopMusic').mockImplementation(() => {});

    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => onStatusChangedSubscribeMock.mock.calls.length > 0, {
      timeout: 5000,
      interval: 25,
    });
    await vi.waitUntil(() => component.musicMuted() === true, {
      timeout: 1000,
      interval: 10,
    });

    playMusicSpy.mockClear();
    stopMusicSpy.mockClear();

    const statusHandler = onStatusChangedSubscribeMock.mock.calls[0]?.[1]?.onData as
      | ((data: {
          status: string;
          currentQuestion: number | null;
          activeAt?: string | null;
        }) => void)
      | undefined;

    statusHandler?.({ status: 'QUESTION_OPEN', currentQuestion: 0, activeAt: null });
    statusHandler?.({ status: 'ACTIVE', currentQuestion: 0, activeAt: null });
    statusHandler?.({ status: 'LOBBY', currentQuestion: null, activeAt: null });
    await flushMacroTask(25);

    expect(component.activeMusicTrack()).toBeNull();
    expect(playMusicSpy).not.toHaveBeenCalled();

    fixture.destroy();
  });

  it('deaktiviert Hintergrundmusik im Q&A-Kanal und startet sie im Quiz-Kanal wieder', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'QUESTION_OPEN',
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = setup();
    const component = fixture.componentInstance;
    const playMusicSpy = vi.spyOn(component.sound, 'playMusic').mockResolvedValue();
    const stopMusicSpy = vi.spyOn(component.sound, 'stopMusic').mockImplementation(() => {});

    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    component.musicMuted.set(false);
    fixture.detectChanges();
    await vi.waitUntil(() => playMusicSpy.mock.calls.some(([track]) => track === 'READING_0'), {
      timeout: 1000,
      interval: 10,
    });

    playMusicSpy.mockClear();
    stopMusicSpy.mockClear();
    await component.selectChannel('qa');
    fixture.detectChanges();

    expect(component.activeChannel()).toBe('qa');
    expect(component.activeMusicTrack()).toBeNull();
    await vi.waitUntil(() => stopMusicSpy.mock.calls.length > 0, {
      timeout: 1000,
      interval: 10,
    });

    playMusicSpy.mockClear();
    await component.selectChannel('quiz');
    fixture.detectChanges();

    expect(component.activeChannel()).toBe('quiz');
    expect(component.activeMusicTrack()).toBe('READING_0');
    await vi.waitUntil(() => playMusicSpy.mock.calls.some(([track]) => track === 'READING_0'), {
      timeout: 1000,
      interval: 10,
    });

    fixture.destroy();
  });

  it('stoppt und startet Hintergrundmusik mit Blitzlicht-Stopp und Fortsetzen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    quickFeedbackHostResultsQueryMock.mockResolvedValue({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    });

    const fixture = setup();
    const component = fixture.componentInstance;
    const playMusicSpy = vi.spyOn(component.sound, 'playMusic').mockResolvedValue();
    const stopMusicSpy = vi.spyOn(component.sound, 'stopMusic').mockImplementation(() => {});

    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    component.musicMuted.set(false);
    component.activeChannel.set('quickFeedback');
    fixture.detectChanges();

    expect(component.activeMusicTrack()).toBe('COUNTDOWN_0');

    quickFeedbackToggleLockMutateMock.mockResolvedValueOnce({ locked: true });
    await component.toggleQuickFeedbackRoundLock();
    fixture.detectChanges();

    expect(component.quickFeedbackResult()?.locked).toBe(true);
    expect(component.activeMusicTrack()).toBeNull();
    expect(stopMusicSpy).toHaveBeenCalled();

    playMusicSpy.mockClear();
    quickFeedbackToggleLockMutateMock.mockResolvedValueOnce({ locked: false });
    await component.toggleQuickFeedbackRoundLock();
    fixture.detectChanges();

    expect(component.quickFeedbackResult()?.locked).toBe(false);
    expect(component.activeMusicTrack()).toBe('COUNTDOWN_0');
    expect(playMusicSpy).toHaveBeenCalledWith('COUNTDOWN_0');

    fixture.destroy();
  });

  it('laesst Hintergrundmusik nach Q&A aus, wenn sie vorher bereits stumm war', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'QUESTION_OPEN',
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
        quickFeedback: { enabled: false, open: false },
      },
    });

    const fixture = setup();
    const component = fixture.componentInstance;
    const playMusicSpy = vi.spyOn(component.sound, 'playMusic').mockResolvedValue();

    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    component.musicMuted.set(true);
    fixture.detectChanges();
    playMusicSpy.mockClear();

    await component.selectChannel('qa');
    fixture.detectChanges();
    await component.selectChannel('quiz');
    fixture.detectChanges();

    expect(component.musicMuted()).toBe(true);
    expect(component.activeMusicTrack()).toBeNull();
    expect(playMusicSpy).not.toHaveBeenCalled();

    fixture.destroy();
  });

  it('zeigt in QUESTION_OPEN Fragentext und deutlichen Lesephase-Hinweis', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'QUESTION_OPEN' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'QUESTION_OPEN', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: 'Lies die Frage zuerst.',
      type: 'SINGLE_CHOICE' as const,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lies die Frage zuerst.');
    expect(el.textContent).toContain('Lesephase');
    expect(el.textContent).toContain('Antwortoptionen freigeben');
    const exitAnchor = el.querySelector('.session-host__exit-anchor') as HTMLElement;
    const buttonTexts = Array.from(exitAnchor.querySelectorAll('button'), (button) =>
      (button.textContent ?? '').trim(),
    );
    expect(exitAnchor.className).toContain('session-host__exit-anchor--with-primary');
    expect(buttonTexts).toEqual(['Antwortoptionen freigeben', 'Session beenden']);
    expect(el.querySelector('.session-host__answers')).toBeNull();
    fixture.destroy();
  });

  it('zeigt in QUESTION_OPEN den Ready-Fortschritt und den Freigabe-Hinweis für den Host', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'QUESTION_OPEN' });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Ada',
          teamId: null,
          teamName: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Linus',
          teamId: null,
          teamName: null,
        },
      ],
      readingReady: {
        readyCount: 2,
        connectedCount: 2,
        allConnectedReady: true,
      },
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'QUESTION_OPEN', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: 'Lese den Aufgabentext.',
      type: 'SINGLE_CHOICE' as const,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('2 von 2 bereit');
    expect(el.textContent).toContain(
      'Alle Teilnehmenden sind bereit – Antwortoptionen können freigegeben werden.',
    );

    fixture.destroy();
  });

  it('unterscheidet in QUESTION_OPEN zwischen verbundenen und insgesamt teilnehmenden Personen', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'QUESTION_OPEN' });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 501,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Ada',
          teamId: null,
          teamName: null,
        },
      ],
      readingReady: {
        readyCount: 1,
        connectedCount: 1,
        allConnectedReady: true,
      },
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'QUESTION_OPEN', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: 'Lese den Aufgabentext.',
      type: 'SINGLE_CHOICE' as const,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('1 von 1 verbunden bereit');
    expect(text).toContain('501 insgesamt');
    expect(text).toContain(
      'Alle verbundenen Teilnehmenden sind bereit – Antwortoptionen können freigegeben werden.',
    );
    fixture.destroy();
  });

  it('scrollt den Host-Inhalt hoch, sobald alle verbundenen Teilnehmenden bereit sind', async () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const componentAccess = component as SessionHostComponent & {
      scrollHostTargetIntoView: (targetRef: unknown) => void;
    };
    const scrollSpy = vi.spyOn(componentAccess, 'scrollHostTargetIntoView');

    fixture.detectChanges();
    await fixture.whenStable();

    component.session.set({ ...defaultSession, status: 'QUESTION_OPEN' });
    component.statusUpdate.set({
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      currentRound: 1,
      activeAt: null,
    });
    component.currentQuestionForHost.set({
      questionId: '33333333-3333-4333-8333-333333333333',
      order: 0,
      totalQuestions: 1,
      text: 'Lese den Aufgabentext.',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
    });
    component.participantsPayload.set({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Ada',
          teamId: null,
          teamName: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Linus',
          teamId: null,
          teamName: null,
        },
      ],
      readingReady: {
        readyCount: 1,
        connectedCount: 2,
        allConnectedReady: false,
      },
    });
    fixture.detectChanges();

    expect(scrollSpy).not.toHaveBeenCalled();

    component.participantsPayload.set({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Ada',
          teamId: null,
          teamName: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Linus',
          teamId: null,
          teamName: null,
        },
      ],
      readingReady: {
        readyCount: 2,
        connectedCount: 2,
        allConnectedReady: true,
      },
    });
    fixture.detectChanges();

    expect(scrollSpy).toHaveBeenCalledTimes(1);

    component.participantsPayload.set({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Ada',
          teamId: null,
          teamName: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Linus',
          teamId: null,
          teamName: null,
        },
      ],
      readingReady: {
        readyCount: 2,
        connectedCount: 2,
        allConnectedReady: true,
      },
    });
    fixture.detectChanges();

    expect(scrollSpy).toHaveBeenCalledTimes(1);

    fixture.destroy();
  });

  it('zeigt bei genau einer Person keine doppelte Ready-Anzahl im Live-Banner', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'QUESTION_OPEN',
      participantCount: 1,
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Ada',
          teamId: null,
          teamName: null,
        },
      ],
      readingReady: {
        readyCount: 1,
        connectedCount: 1,
        allConnectedReady: true,
      },
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'QUESTION_OPEN', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      order: 0,
      text: 'Lese den Aufgabentext.',
      type: 'SINGLE_CHOICE' as const,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const liveBanner = (fixture.nativeElement as HTMLElement).querySelector(
      '.session-host__live-code-block',
    );
    expect(liveBanner?.textContent).toContain('1 teilnehmende Person');
    expect(liveBanner?.textContent).toContain('1 von 1 bereit');
    expect(liveBanner?.textContent).not.toContain('1 1 von 1 bereit');

    fixture.destroy();
  });

  it('zeigt bei aktiver Frage die Aktion "Ergebnis zeigen" im unteren Exit-Anker neben "Session beenden"', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      timer: 30,
      activeAt: null,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const exitAnchor = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor',
    ) as HTMLElement;
    const buttonTexts = Array.from(exitAnchor.querySelectorAll('button'), (button) =>
      (button.textContent ?? '').trim(),
    );

    expect(exitAnchor.className).toContain('session-host__exit-anchor--with-primary');
    expect(buttonTexts).toEqual(['Ergebnis zeigen', 'Session beenden']);
    fixture.componentInstance.hostVoteProgress.set({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      questionOrder: 0,
      round: 1,
      totalVotes: 0,
      pendingTimerAccommodationCount: 1,
      blockingTimerAccommodationCount: 1,
    });
    fixture.detectChanges();
    const timerWarning = (fixture.nativeElement as HTMLElement).querySelector(
      '.session-host__timer-accommodation-warning',
    );
    expect(timerWarning?.textContent).toContain(
      'Eine Person nutzt noch ihre 10× Zeit. Warte auf den Raum-Countdown oder bis die 10× Zeit endet.',
    );
    const resultButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => (button.textContent ?? '').includes('Ergebnis zeigen'));
    expect(resultButton?.disabled).toBe(true);
    expect(resultButton?.getAttribute('aria-describedby')).toBe(
      'session-host-timer-accommodation-status',
    );
    fixture.destroy();
  });

  it('bietet nach Raum-Countdown Trotzdem-freigeben mit Bestaetigung an', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      timer: 30,
      activeAt: null,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.componentInstance.hostVoteProgress.set({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      questionOrder: 0,
      round: 1,
      totalVotes: 0,
      pendingTimerAccommodationCount: 1,
      blockingTimerAccommodationCount: 1,
    });
    fixture.componentInstance.countdownEnded.set(true);
    fixture.detectChanges();

    const timerWarning = (fixture.nativeElement as HTMLElement).querySelector(
      '.session-host__timer-accommodation-warning',
    );
    expect(timerWarning?.textContent).toContain('Trotzdem freigeben');
    const resultButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => (button.textContent ?? '').includes('Trotzdem freigeben'));
    expect(resultButton?.disabled).toBe(false);

    dialogOpenMock.mockClear();
    dialogOpenMock.mockReturnValueOnce({ afterClosed: () => of(true) });
    revealResultsMutateMock.mockClear();
    await fixture.componentInstance.revealResults();
    expect(dialogOpenMock).toHaveBeenCalled();
    expect(revealResultsMutateMock).toHaveBeenCalledWith({
      code: 'ABC123',
      forceClosePersonalTimers: true,
    });
    fixture.destroy();
  });

  it('zeigt im Host live den Abstimmungsfortschritt als Prozent mit Stimmenzaehler', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      participantCount: 3,
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 3,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: null, teamName: null },
        { id: 'p2', nickname: 'Alan', teamId: null, teamName: null },
        { id: 'p3', nickname: 'Grace', teamId: null, teamName: null },
      ],
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      timer: 30,
      activeAt: null,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 50,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 1,
          votePercentage: 50,
        },
      ],
      totalVotes: 2,
      correctVoterCount: 1,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const progress = fixture.nativeElement.querySelector(
      '.session-host__vote-progress',
    ) as HTMLElement | null;

    expect(progress).toBeTruthy();
    expect(progress?.textContent).toContain('67 %');
    expect(progress?.textContent).toContain('2 von 3');
    expect(progress?.getAttribute('aria-label')).toContain(
      '2 von 3 Teilnehmenden haben abgestimmt',
    );
    expect(progress?.getAttribute('aria-label')).toContain('67 Prozent erreicht');

    fixture.destroy();
  });

  it('markiert den Abstimmungsfortschritt bei voller Beteiligung als abgeschlossen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      participantCount: 2,
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: null, teamName: null },
        { id: 'p2', nickname: 'Alan', teamId: null, teamName: null },
      ],
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      timer: 30,
      activeAt: null,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 50,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 1,
          votePercentage: 50,
        },
      ],
      totalVotes: 2,
      correctVoterCount: 1,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const progress = fixture.nativeElement.querySelector(
      '.session-host__vote-progress',
    ) as HTMLElement | null;

    expect(progress).toBeTruthy();
    expect(progress?.className).toContain('session-host__vote-progress--complete');
    expect(progress?.textContent).toContain('100 %');
    expect(progress?.textContent).toContain('2 von 2');

    fixture.destroy();
  });

  it('zeigt ohne Peer-Instruction-Empfehlung keine Diskussionsphase, auch wenn schon Stimmen vorliegen', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      timer: 30,
      activeAt: null,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 50,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 1,
          votePercentage: 50,
        },
      ],
      totalVotes: 2,
      correctVoterCount: 1,
      peerInstructionSuggestion: {
        suggested: false,
        reason: 'CORRECTNESS_WINDOW' as const,
      },
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const exitAnchor = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor',
    ) as HTMLElement;
    const buttonTexts = Array.from(exitAnchor.querySelectorAll('button'), (button) =>
      (button.textContent ?? '').trim(),
    );
    const text = fixture.nativeElement.textContent ?? '';

    expect(text).not.toContain('Peer Instruction empfohlen');
    expect(buttonTexts).toEqual(['Ergebnis zeigen', 'Session beenden']);
    fixture.destroy();
  });

  it('zeigt "komplett richtig" nicht bei Single-Choice-Ergebnisfragen', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'RESULTS' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent ?? '').not.toContain('komplett richtig');
    fixture.destroy();
  });

  it('zeigt "komplett richtig" bei Multiple-Choice-Ergebnisfragen', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'RESULTS' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'cccccccc-3333-4333-8333-333333333333',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antworten sind richtig?',
      type: 'MULTIPLE_CHOICE',
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: true },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: false },
        { id: 'cccccccc-3333-4333-8333-333333333333', text: 'C', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: false,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'cccccccc-3333-4333-8333-333333333333',
          text: 'C',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent ?? '').toContain('0 von 0 komplett richtig');
    fixture.destroy();
  });

  it('blendet bei Freitext-Ergebnissen die redundante Antwortliste aus', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'RESULTS' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 1 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '11111111-1111-4111-8111-111111111111',
      order: 1,
      totalQuestions: 3,
      text: 'Warum bleibt ein Satellit im Orbit?',
      type: 'FREETEXT',
      difficulty: 'EASY',
      answers: [],
      freeTextResponses: ['Gravitation', 'Orbit', 'Traegheit'],
      totalVotes: 3,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const resultsWrap = fixture.nativeElement.querySelector('.session-host__results-wrap');
    const wordCloudDetails = fixture.nativeElement.querySelector('.session-host__extra');

    expect(resultsWrap).toBeNull();
    expect(wordCloudDetails?.className).toContain('session-host__extra--no-divider');
    expect(fixture.nativeElement.textContent ?? '').not.toContain('Gravitation');
    expect(fixture.nativeElement.textContent ?? '').not.toContain('haben geantwortet');
    fixture.destroy();
  });

  it('scrollt beim Ergebniszeigen zur Ergebniskarte', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'ACTIVE' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 50,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 1,
          votePercentage: 50,
        },
      ],
      totalVotes: 2,
      correctVoterCount: 1,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const resultsSection = fixture.nativeElement.querySelector(
      '.session-host__results-wrap',
    ) as HTMLElement | null;
    expect(resultsSection).toBeTruthy();
    resultsSection!.style.scrollMarginTop = '80px';
    Object.defineProperty(resultsSection!, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          top: 420,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 420,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    const scrollingElement = (document.scrollingElement ?? document.documentElement) as HTMLElement;
    scrollingElement.scrollTop = 180;
    Object.defineProperty(scrollingElement, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const scrollToSpy = vi.spyOn(scrollingElement, 'scrollTo').mockImplementation(() => undefined);

    await fixture.componentInstance.revealResults();
    await flushComponentAfterStable(fixture, 0);

    expect(revealResultsMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(scrollToSpy).toHaveBeenCalledWith({ behavior: 'smooth', top: 520 });

    scrollToSpy.mockRestore();
    fixture.destroy();
  });

  it('scrollt beim Freigeben der Antwortoptionen zur Antwortliste', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'PAUSED' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const answersList = fixture.nativeElement.querySelector(
      '.session-host__answers',
    ) as HTMLElement | null;
    expect(answersList).toBeTruthy();
    answersList!.style.scrollMarginTop = '88px';
    Object.defineProperty(answersList!, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          top: 360,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 360,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    const scrollingElement = (document.scrollingElement ?? document.documentElement) as HTMLElement;
    scrollingElement.scrollTop = 140;
    Object.defineProperty(scrollingElement, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const scrollToSpy = vi.spyOn(scrollingElement, 'scrollTo').mockImplementation(() => undefined);

    await fixture.componentInstance.revealAnswers();
    await flushComponentAfterStable(fixture, 0);

    expect(revealAnswersMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(scrollToSpy).toHaveBeenCalledWith({ behavior: 'smooth', top: 412 });

    scrollToSpy.mockRestore();
    fixture.destroy();
  });

  it('startet in Peer-Instruction-Runde 2 keinen Countdown mehr', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'DISCUSSION' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      currentRound: 2,
      timer: null,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    await component.startSecondRound();
    await flushComponentAfterStable(fixture, 0);
    fixture.detectChanges();

    expect(startSecondRoundMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(component.countdownSeconds()).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-host__countdown')).toBeNull();

    fixture.destroy();
  });

  it('haelt die bisherige Frage sichtbar, bis Antwortoptionen fuer den Host nachgeladen sind', async () => {
    const initialQuestion = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };
    let resolveRefresh: ((value: typeof initialQuestion) => void) | null = null;

    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'QUESTION_OPEN' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(initialQuestion);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.currentQuestionForHost.set(initialQuestion);
    getCurrentQuestionForHostQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingReveal = fixture.componentInstance.revealAnswers();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentQuestionForHost()?.questionId).toBe(
      initialQuestion.questionId,
    );

    resolveRefresh?.(initialQuestion);
    await pendingReveal;
    await fixture.whenStable();
    fixture.destroy();
  });

  it('behält die sichtbare Frage bei, wenn während derselben Phase kurz kein Host-Fragenpayload kommt', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const question = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };

    component.statusUpdate.set({ status: 'ACTIVE', currentQuestion: 0, currentRound: 1 });
    component.currentQuestionForHost.set(question);
    (
      component as unknown as {
        syncCurrentQuestionForHost: (next: typeof question | null) => void;
      }
    ).syncCurrentQuestionForHost(null);

    expect(component.displayedCurrentQuestionForHost()?.questionId).toBe(question.questionId);
    fixture.destroy();
  });

  it('nutzt den getInfo-Fragenindex bis das Realtime-Statusupdate eintrifft', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const question = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 7,
      totalQuestions: 10,
      text: 'In welchem Jahr begann die Französische Revolution?',
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [],
      totalVotes: 0,
      correctVoterCount: 0,
    };

    component.statusUpdate.set(null);
    component.session.set({
      ...defaultSession,
      status: 'ACTIVE',
      currentQuestion: 7,
      currentRound: 1,
    });
    component.currentQuestionForHost.set(question);
    fixture.detectChanges();

    expect(component.hasCurrentQuizQuestionForHost()).toBe(true);
    expect(component.displayedCurrentQuestionForHost()?.questionId).toBe(question.questionId);

    (
      component as unknown as {
        syncCurrentQuestionForHost: (next: typeof question | null) => void;
      }
    ).syncCurrentQuestionForHost(null);

    expect(component.displayedCurrentQuestionForHost()?.questionId).toBe(question.questionId);
    fixture.destroy();
  });

  it('drosselt Realtime-Resubscribe nach Host-Fragen-Subscriptionfehlern', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => onCurrentQuestionForHostChangedSubscribeMock.mock.calls.length > 0, {
      timeout: 5000,
      interval: 25,
    });

    const callsBeforeError = onCurrentQuestionForHostChangedSubscribeMock.mock.calls.length;
    const currentQuestionErrorHandler = onCurrentQuestionForHostChangedSubscribeMock.mock
      .calls[0]?.[1]?.onError as (() => void) | undefined;
    expect(currentQuestionErrorHandler).toBeTypeOf('function');

    vi.useFakeTimers();
    try {
      currentQuestionErrorHandler?.();
      await Promise.resolve();

      expect(onCurrentQuestionForHostChangedSubscribeMock).toHaveBeenCalledTimes(callsBeforeError);

      await vi.advanceTimersByTimeAsync(4999);
      expect(onCurrentQuestionForHostChangedSubscribeMock).toHaveBeenCalledTimes(callsBeforeError);

      await vi.advanceTimersByTimeAsync(1);
      expect(onCurrentQuestionForHostChangedSubscribeMock).toHaveBeenCalledTimes(
        callsBeforeError + 1,
      );
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it('aktualisiert die sichtbare Host-Frage, wenn Numeric-Ergebnisse nachgeladen werden', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const baseQuestion = {
      questionId: '66666666-6666-4666-8666-666666666666',
      order: 0,
      totalQuestions: 1,
      text: 'Schätze den Messwert der Kalibrierprobe.',
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 2,
      timer: null,
      answers: [],
      totalVotes: 3,
      numericToleranceMode: 'ABSOLUTE_INTERVAL' as const,
      numericReferenceValue: 100,
      numericTolerancePercent: null,
      numericIntervalLeft: 95,
      numericIntervalRight: 105,
      numericInputType: 'DECIMAL' as const,
      numericDecimalPlaces: 1,
      numericMin: 0,
      numericMax: 200,
      numericTwoRounds: true,
    };
    const emptyStats = {
      n: 0,
      mean: null,
      median: null,
      stdDev: null,
      q1: null,
      q3: null,
      iqr: null,
      min: null,
      max: null,
      inBandCount: 0,
      inBandPercent: null,
      meanAbsoluteError: null,
      meanRelativeError: null,
    };
    const round2Stats = {
      n: 3,
      mean: 101.9333,
      median: 101.1,
      stdDev: 2.09,
      q1: 99.9,
      q3: 104.8,
      iqr: 4.9,
      min: 99.9,
      max: 104.8,
      inBandCount: 3,
      inBandPercent: 100,
      meanAbsoluteError: 2,
      meanRelativeError: 2,
    };
    const nextQuestion = {
      ...baseQuestion,
      numericStats: round2Stats,
      numericHistogram: [{ from: 99.9, to: 104.8, count: 3, inBand: true }],
      numericRoundComparison: {
        round1Stats: { ...emptyStats, n: 3, inBandCount: 2, inBandPercent: 66.6667 },
        round2Stats,
        round1Histogram: [{ from: 98.2, to: 120, count: 3, inBand: false }],
        round2Histogram: [{ from: 99.9, to: 104.8, count: 3, inBand: true }],
        meanDelta: -4.9333,
        medianDelta: -1.3,
        inBandPercentDelta: 33.3333,
        deltaHistogram: [{ from: -15.2, to: 2.9, count: 3, inBand: false }],
        pairedAnalysis: {
          pairedCount: 3,
          closerCount: 3,
          fartherCount: 0,
          unchangedCount: 0,
        },
      },
    };

    component.statusUpdate.set({ status: 'RESULTS', currentQuestion: 0, currentRound: 2 });
    component.currentQuestionForHost.set(baseQuestion);
    (
      component as unknown as {
        syncCurrentQuestionForHost: (next: typeof nextQuestion | null) => void;
      }
    ).syncCurrentQuestionForHost(nextQuestion);

    expect(
      component.displayedCurrentQuestionForHost()?.numericRoundComparison?.pairedAnalysis
        ?.closerCount,
    ).toBe(3);
    fixture.destroy();
  });

  it('formatiert Jahreszahlen in Numeric-Estimate-Hostlabels ohne Tausenderpunkt', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const question = {
      questionId: '66666666-6666-4666-8666-666666666666',
      order: 0,
      totalQuestions: 1,
      text: 'In welchem Jahr begann die Französische Revolution?',
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 2,
      timer: null,
      answers: [],
      totalVotes: 20,
      numericToleranceMode: 'ABSOLUTE_INTERVAL' as const,
      numericReferenceValue: 1789,
      numericTolerancePercent: null,
      numericIntervalLeft: 1788.5,
      numericIntervalRight: 1789.5,
      numericInputType: 'INTEGER' as const,
      numericDecimalPlaces: null,
      numericMin: 1600,
      numericMax: 2000,
      numericTwoRounds: true,
    };

    expect(
      component.numericHistogramRangeEdgeLabel(
        question,
        [{ from: 1740, to: 1830, count: 20, inBand: false }],
        'min',
      ),
    ).toBe('1740');
    expect(component.numericReferenceLabel(question)).toBe('Referenz 1789');
    expect(component.numericToleranceBandLabel(question)).toBe('Akzeptierter Wert 1789');
    const stats = {
      n: 20,
      mean: 1789.15,
      median: 1789,
      stdDev: 1.01,
      q1: 1789,
      q3: 1789,
      iqr: 0,
      min: 1787,
      max: 1792,
      inBandCount: 13,
      inBandPercent: 65,
      meanAbsoluteError: 0.55,
      meanRelativeError: null,
    };
    expect(component.numericStatsPrimaryCaption(stats)).toBe('Median');
    expect(component.numericStatsPrimaryValue(stats, question)).toBe('1789');
    expect(component.numericStatsInBandValue(stats)).toBe('13/20');
    expect(component.numericStatsInBandCaption(stats)).toBe('65 % im akzeptierten Bereich');
    const compactLabel = component.numericStatsLabel(stats, question);
    expect(compactLabel).toContain('Ø 1789');
    expect(compactLabel).toContain('σ 1');
    expect(compactLabel).toContain('MAE 1');
    expect(compactLabel).not.toContain('1789.15');
    expect(compactLabel).not.toContain('0.55');
    expect(component.numericStatsErrorValue(stats, question)).toBe('1');
    const statItems = new Map(
      component.numericStatsItems(stats, question).map((item) => [item.id, item.value]),
    );
    expect(statItems.get('mean')).toBe('1789');
    expect(statItems.get('median')).toBe('1789');
    expect(statItems.get('stdDev')).toBe('1');
    expect(statItems.get('middle50')).toBe('1789–1789');
    expect(statItems.get('range')).toBe('1787–1792');
    expect(statItems.get('meanAbsoluteError')).toBe('1');
    const roundComparison = {
      round1Stats: stats,
      round2Stats: stats,
      round1Histogram: [],
      round2Histogram: [],
      meanDelta: -4.9333,
      medianDelta: -1.3,
      inBandPercentDelta: 33.3333,
      deltaHistogram: [],
      pairedAnalysis: null,
    };
    expect(component.numericRoundDeltaValue(roundComparison, question)).toBe('-1');
    expect(component.numericRoundDeltaLabel(roundComparison, question)).toContain('Mittelwert -5');
    expect(component.numericRoundDeltaLabel(roundComparison, question)).toContain('Median -1');
    expect(component.numericStatsInterpretation(stats, question)).toContain(
      '13 von 20 Schätzungen liegen im Toleranzband',
    );
    expect(component.numericStatsInterpretation(stats, question)).toContain(
      'Der mittlere Abstand zur Referenz beträgt 1',
    );
    const improvedRoundComparison = {
      ...roundComparison,
      pairedAnalysis: {
        pairedCount: 20,
        closerCount: 14,
        fartherCount: 4,
        unchangedCount: 2,
      },
    };
    expect(component.numericRoundInterpretation(improvedRoundComparison, question)).toContain(
      'Runde 2 liegt näher am Referenzwert',
    );
    expect(component.numericRoundInterpretation(improvedRoundComparison, question)).toContain(
      '14 von 20',
    );
    fixture.destroy();
  });

  it('belaesst Dezimalfragen in der Numeric-Estimate-Hoststatistik mit Dezimalstellen', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const question = {
      questionId: '66666666-6666-4666-8666-666666666666',
      order: 0,
      totalQuestions: 1,
      text: 'Schätze den Messwert der Kalibrierprobe.',
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: null,
      answers: [],
      totalVotes: 3,
      numericToleranceMode: 'ABSOLUTE_INTERVAL' as const,
      numericReferenceValue: 100,
      numericTolerancePercent: null,
      numericIntervalLeft: 95,
      numericIntervalRight: 105,
      numericInputType: 'DECIMAL' as const,
      numericDecimalPlaces: 1,
      numericMin: 0,
      numericMax: 200,
      numericTwoRounds: false,
    };
    const stats = {
      n: 3,
      mean: 101.9333,
      median: 101.1,
      stdDev: 2.09,
      q1: 99.9,
      q3: 104.8,
      iqr: 4.9,
      min: 99.9,
      max: 104.8,
      inBandCount: 3,
      inBandPercent: 100,
      meanAbsoluteError: 2,
      meanRelativeError: 2,
    };

    const statItems = new Map(
      component.numericStatsItems(stats, question).map((item) => [item.id, item.value]),
    );
    expect(statItems.get('mean')).toMatch(/^101[,.]93$/);
    expect(statItems.get('median')).toMatch(/^101[,.]1$/);
    expect(component.numericStatsLabel(stats, question)).toMatch(/Ø 101[,.]93/);
    fixture.destroy();
  });

  it('richtet bei identischer Einzelschaetzung Referenzlinie und Histogramm-Marker aus', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const question = {
      questionId: '66666666-6666-4666-8666-666666666666',
      order: 0,
      totalQuestions: 1,
      text: 'Schätze pi.',
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: null,
      answers: [],
      totalVotes: 1,
      numericToleranceMode: 'RELATIVE_PERCENT' as const,
      numericReferenceValue: 3.14,
      numericTolerancePercent: 10,
      numericIntervalLeft: null,
      numericIntervalRight: null,
      numericInputType: 'DECIMAL' as const,
      numericDecimalPlaces: 2,
      numericMin: 2,
      numericMax: 4,
      numericTwoRounds: false,
    };
    const histogram = [
      { from: 2.2, to: 3.1, count: 0, inBand: false },
      { from: 3.1, to: 3.28, count: 1, inBand: true },
      { from: 3.28, to: 4, count: 0, inBand: false },
    ];
    const stats = {
      n: 1,
      mean: 3.14,
      median: 3.14,
      stdDev: 0,
      q1: 3.14,
      q3: 3.14,
      iqr: 0,
      min: 3.14,
      max: 3.14,
      inBandCount: 1,
      inBandPercent: 100,
      meanAbsoluteError: 0,
      meanRelativeError: 0,
    };

    const referencePosition = component.numericReferenceLinePercent(question, histogram);
    const bucketCenterPosition = component.numericHistogramBinPositionPercent(
      histogram[1]!,
      histogram,
    );
    const markerPosition = component.numericHistogramBinPositionPercent(
      histogram[1]!,
      histogram,
      stats,
    );

    expect(referencePosition).not.toBeNull();
    expect(bucketCenterPosition).not.toBe(referencePosition);
    expect(markerPosition).toBe(referencePosition);
    fixture.destroy();
  });

  it('zeigt das Host-Scoreboard bei NUMERIC_ESTIMATE-Ergebnissen', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'RESULTS' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getLeaderboardQueryMock.mockResolvedValue([
      { rank: 1, nickname: 'Ada', totalScore: 120 },
      { rank: 2, nickname: 'Linus', totalScore: 90 },
    ]);
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: '66666666-6666-4666-8666-666666666666',
      order: 0,
      totalQuestions: 1,
      text: 'In welchem Jahr begann die Französische Revolution?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      currentRound: 2,
      timer: null,
      answers: [],
      totalVotes: 20,
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 1789,
      numericTolerancePercent: null,
      numericIntervalLeft: 1788.5,
      numericIntervalRight: 1789.5,
      numericInputType: 'INTEGER',
      numericDecimalPlaces: null,
      numericMin: 1600,
      numericMax: 2000,
      numericTwoRounds: true,
      numericStats: {
        n: 20,
        mean: 1789.15,
        median: 1789,
        stdDev: 1.01,
        q1: 1789,
        q3: 1789,
        iqr: 0,
        min: 1787,
        max: 1792,
        inBandCount: 13,
        inBandPercent: 65,
        meanAbsoluteError: 0.55,
        meanRelativeError: null,
      },
      numericHistogram: [{ from: 1786, to: 1793, count: 20, inBand: false }],
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const interim = fixture.nativeElement.querySelector('.session-host__interim-leaderboard');
    expect(interim).not.toBeNull();
    expect(interim?.textContent ?? '').toContain('Ada');
    expect(interim?.textContent ?? '').toContain('120 Pkt.');
    fixture.destroy();
  });

  it('gibt Antwortoptionen-Aktion erst frei, wenn die aus der Lobby gestartete Host-Frage geladen ist', async () => {
    const loadedQuestion = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };
    let resolveRefresh: ((value: typeof loadedQuestion) => void) | null = null;

    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
    nextQuestionMutateMock.mockResolvedValue({
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      currentRound: 1,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    getCurrentQuestionForHostQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingNextQuestion = component.nextQuestion();
    await Promise.resolve();
    fixture.detectChanges();

    const revealButtonWhilePending = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => (button.textContent ?? '').includes('Antwortoptionen freigeben'));
    expect(component.controlPending()).toBe(false);
    expect(component.quizStartQuestionPending()).toBe(true);
    expect(revealButtonWhilePending).toBeUndefined();

    resolveRefresh?.(loadedQuestion);
    await pendingNextQuestion;
    await fixture.whenStable();
    fixture.detectChanges();

    const revealButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => (button.textContent ?? '').includes('Antwortoptionen freigeben'));
    expect(component.quizStartQuestionPending()).toBe(false);
    expect(revealButton).toBeTruthy();
    expect(revealButton?.disabled).toBe(false);
    fixture.destroy();
  });

  it('haelt die Lobby-Teamkarten stabil, waehrend eine spaetere Startfrage nachlaedt', async () => {
    const loadedQuestion = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 1,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };
    let resolveRefresh: ((value: typeof loadedQuestion) => void) | null = null;

    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      preset: 'PLAYFUL',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 1 },
      ],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-b', teamName: 'Blau' },
      ],
    });
    nextQuestionMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 1,
      currentRound: 1,
      activeAt: '2026-03-24T12:00:00.000Z',
      timer: 30,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.session-lobby__team-card').length,
    ).toBe(2);
    component.foyerTeamPulseSequences.set({ 'team-a': 1 });
    fixture.detectChanges();
    expect(
      (
        (fixture.nativeElement as HTMLElement).querySelector(
          '[data-team-id="team-a"]',
        ) as HTMLElement | null
      )?.className ?? '',
    ).toContain('session-lobby__team-card--arrival-b');

    getCurrentQuestionForHostQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingNextQuestion = component.nextQuestion();
    await Promise.resolve();
    fixture.detectChanges();

    const hostWhilePending = fixture.nativeElement as HTMLElement;
    expect(component.effectiveStatus()).toBe('ACTIVE');
    expect(component.quizStartQuestionPending()).toBe(true);
    expect(component.showLobbyStage()).toBe(true);
    expect(component.foyerTeamPulseSequences()).toEqual({});
    expect(hostWhilePending.querySelectorAll('.session-lobby__team-card').length).toBe(2);
    expect(
      (hostWhilePending.querySelector('[data-team-id="team-a"]') as HTMLElement | null)
        ?.className ?? '',
    ).not.toMatch(/session-lobby__team-card--arrival-[ab]/);
    expect(hostWhilePending.textContent ?? '').not.toContain('Frage wird aktualisiert');

    resolveRefresh?.(loadedQuestion);
    await pendingNextQuestion;
    await fixture.whenStable();
    fixture.detectChanges();

    const hostAfterLoad = fixture.nativeElement as HTMLElement;
    expect(component.quizStartQuestionPending()).toBe(false);
    expect(component.showLobbyStage()).toBe(false);
    expect(hostAfterLoad.querySelectorAll('.session-lobby__team-card').length).toBe(0);
    expect(hostAfterLoad.textContent ?? '').toContain('Welche Antwort ist richtig?');
    fixture.destroy();
  });

  it('zeigt beim bekannten Fragenindex ohne Host-Details einen neutralen Aktualisierungshinweis', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.session.set({ ...defaultSession, status: 'ACTIVE' });
    component.statusUpdate.set({ status: 'ACTIVE', currentQuestion: 0, currentRound: 1 });
    component.currentQuestionForHost.set(null);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Frage wird aktualisiert');
    expect(text).not.toContain('Keine Frage aktiv');
    fixture.destroy();
  });

  it('behandelt fehlenden Fragenindex im Statusupdate nicht als neue Frage', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const question = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };

    component.session.set({ ...defaultSession, status: 'ACTIVE' });
    component.currentQuestionForHost.set(question);
    component.statusUpdate.set({
      status: 'ACTIVE',
      currentQuestion: undefined,
      currentRound: 1,
    } as unknown as Parameters<typeof component.statusUpdate.set>[0]);
    component.countdownSeconds.set(12);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(component.displayedCurrentQuestionForHost()?.questionId).toBe(question.questionId);
    expect(component.hasCurrentQuizQuestionForHost()).toBe(true);
    expect(host.textContent).toContain('Welche Antwort ist richtig?');
    expect(host.textContent).not.toContain('Frage wird aktualisiert');
    const countdown = host.querySelector('.session-host__countdown');
    expect(countdown?.textContent?.trim()).toBe('12');
    expect(countdown?.getAttribute('aria-label')).toBe('12 Sekunden verbleibend');
    fixture.destroy();
  });

  it('aktiviert Ergebnisaktion nicht allein wegen fehlendem Fragenindex im Statusupdate', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.session.set({ ...defaultSession, status: 'ACTIVE' });
    component.currentQuestionForHost.set(null);
    component.statusUpdate.set({
      status: 'ACTIVE',
      currentQuestion: undefined,
      currentRound: 1,
    } as unknown as Parameters<typeof component.statusUpdate.set>[0]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(component.hasCurrentQuizQuestionForHost()).toBe(false);
    expect(host.textContent).not.toContain('Ergebnis zeigen');
    fixture.destroy();
  });

  it('gibt Ergebnis-Aktion frei, waehrend Host-Fragendetails noch nachladen', async () => {
    const initialQuestion = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };
    let resolveRefresh: ((value: typeof initialQuestion) => void) | null = null;

    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'QUESTION_OPEN' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(initialQuestion);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.statusUpdate.set({ status: 'QUESTION_OPEN', currentQuestion: 0, currentRound: 1 });
    component.currentQuestionForHost.set(initialQuestion);
    getCurrentQuestionForHostQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingReveal = component.revealAnswers();
    await Promise.resolve();
    fixture.detectChanges();

    const resultButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => (button.textContent ?? '').includes('Ergebnis zeigen'));
    expect(component.controlPending()).toBe(false);
    expect(component.countdownSeconds()).toBeGreaterThan(0);
    expect(resultButton).toBeTruthy();
    expect(resultButton?.disabled).toBe(false);

    resolveRefresh?.(initialQuestion);
    await pendingReveal;
    await fixture.whenStable();
    fixture.destroy();
  });

  it('startet den Countdown nach, wenn der Timer erst mit Host-Details eintrifft', async () => {
    const loadedQuestion = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };

    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'QUESTION_OPEN' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(null);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.statusUpdate.set({ status: 'QUESTION_OPEN', currentQuestion: 0, currentRound: 1 });
    component.currentQuestionForHost.set(null);
    getCurrentQuestionForHostQueryMock.mockResolvedValueOnce(loadedQuestion);

    await component.revealAnswers();
    await fixture.whenStable();

    expect(component.countdownSeconds()).toBeGreaterThan(0);
    fixture.destroy();
  });

  it('startet den Countdown aus dem Realtime-Status-Timer auch ohne Host-Details', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitUntil(() => onStatusChangedSubscribeMock.mock.calls.length > 0, {
      timeout: 5000,
      interval: 25,
    });
    const component = fixture.componentInstance;
    const statusHandler = onStatusChangedSubscribeMock.mock.calls[0]?.[1]?.onData as
      | ((data: {
          status: string;
          currentQuestion: number | null;
          currentRound?: number;
          activeAt?: string | null;
          timer?: number | null;
          serverTime?: string;
        }) => void)
      | undefined;

    statusHandler?.({
      status: 'ACTIVE',
      currentQuestion: 1,
      currentRound: 1,
      activeAt: '2026-03-24T12:00:00.000Z',
      timer: 30,
      serverTime: '2026-03-24T12:00:01.000Z',
    });

    expect(component.statusUpdate()?.timer).toBe(30);
    expect(component.displayedCurrentQuestionForHost()).toBeNull();
    expect(component.countdownSeconds()).toBeGreaterThan(0);
    expect(component.countdownSeconds()).toBeLessThanOrEqual(30);
    fixture.destroy();
  });

  it('startet den Countdown bei direkter ACTIVE-Frage vor dem Nachladen der Host-Details', async () => {
    let resolveRefresh: ((value: null) => void) | null = null;

    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
    nextQuestionMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 1,
      currentRound: 1,
      activeAt: '2026-03-24T12:00:00.000Z',
      timer: 30,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    getCurrentQuestionForHostQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingNextQuestion = component.nextQuestion();
    await Promise.resolve();

    expect(component.controlPending()).toBe(false);
    expect(component.countdownSeconds()).toBeGreaterThan(0);

    resolveRefresh?.(null);
    await pendingNextQuestion;
    fixture.detectChanges();

    expect(component.countdownSeconds()).toBeGreaterThan(0);
    expect(component.quizStartQuestionPending()).toBe(true);
    expect(component.showLobbyStage()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toContain(
      'Frage wird aktualisiert',
    );
    fixture.destroy();
  });

  it('laedt Host-Details erneut nach, wenn der erste Start-Refresh leer bleibt', async () => {
    const loadedQuestion = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 1,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    };

    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
    nextQuestionMutateMock.mockResolvedValue({
      status: 'ACTIVE',
      currentQuestion: 1,
      currentRound: 1,
      activeAt: '2026-03-24T12:00:00.000Z',
      timer: 30,
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const refreshCallsBeforeStart = getCurrentQuestionForHostQueryMock.mock.calls.length;
    getCurrentQuestionForHostQueryMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(loadedQuestion);

    vi.useFakeTimers();
    try {
      await component.nextQuestion();
      fixture.detectChanges();

      const hostWhilePending = fixture.nativeElement as HTMLElement;
      expect(component.quizStartQuestionPending()).toBe(true);
      expect(component.showLobbyStage()).toBe(true);
      expect(hostWhilePending.textContent ?? '').not.toContain('Frage wird aktualisiert');

      await vi.advanceTimersByTimeAsync(250);
      await Promise.resolve();
      await fixture.whenStable();
      fixture.detectChanges();

      const hostAfterRetry = fixture.nativeElement as HTMLElement;
      expect(getCurrentQuestionForHostQueryMock).toHaveBeenCalledTimes(refreshCallsBeforeStart + 2);
      expect(component.quizStartQuestionPending()).toBe(false);
      expect(component.showLobbyStage()).toBe(false);
      expect(hostAfterRetry.textContent ?? '').toContain('Welche Antwort ist richtig?');
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it('haelt die laufende Frage sichtbar, bis Runde 2 geladen ist', async () => {
    const roundOneQuestion = {
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE' as const,
      currentRound: 1,
      timer: 30,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      totalVotes: 12,
      correctVoterCount: 6,
    };
    let resolveRefresh: ((value: typeof roundOneQuestion) => void) | null = null;

    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'DISCUSSION' });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(roundOneQuestion);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.currentQuestionForHost.set(roundOneQuestion);
    getCurrentQuestionForHostQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pendingRoundStart = component.startSecondRound();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.currentQuestionForHost()?.currentRound).toBe(1);

    resolveRefresh?.(roundOneQuestion);
    await pendingRoundStart;
    await fixture.whenStable();
    fixture.destroy();
  });

  it('zeigt bei Ergebnisstand die Aktion "Nächste Frage" im unteren Exit-Anker neben "Session beenden"', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'RESULTS' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 0,
          votePercentage: 0,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 0,
          votePercentage: 0,
        },
      ],
      totalVotes: 0,
      correctVoterCount: 0,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const exitAnchor = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor',
    ) as HTMLElement;
    const buttonTexts = Array.from(exitAnchor.querySelectorAll('button'), (button) =>
      (button.textContent ?? '').trim(),
    );

    expect(exitAnchor.className).toContain('session-host__exit-anchor--with-primary');
    expect(buttonTexts).toEqual(['Nächste Frage', 'Session beenden']);
    fixture.destroy();
  });

  it('zeigt in der Diskussionsphase die Aktionen "Zweite Abstimmung" und den klaren Weiter-Button im unteren Exit-Anker', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'DISCUSSION' });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'DISCUSSION', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      currentRound: 1,
      timer: 30,
      activeAt: null,
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 50,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 1,
          votePercentage: 50,
        },
      ],
      totalVotes: 2,
      correctVoterCount: 1,
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const exitAnchor = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor',
    ) as HTMLElement;
    const buttonTexts = Array.from(exitAnchor.querySelectorAll('button'), (button) =>
      (button.textContent ?? '').replace(/^replay/, '').trim(),
    );

    expect(exitAnchor.className).toContain('session-host__exit-anchor--with-primary');
    expect(buttonTexts).toEqual([
      'Zweite Abstimmung',
      'Zur nächsten Frage ohne zweite Abstimmung',
      'Session beenden',
    ]);
    fixture.destroy();
  });

  it('zieht im Blitzlicht-Kanal die Aktion "Stopp" in die untere Action-Bar neben "Session beenden"', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    quickFeedbackHostResultsQueryMock.mockResolvedValue({
      type: 'MOOD',
      locked: false,
      totalVotes: 2,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 0 },
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.componentInstance.activeChannel.set('quickFeedback');
    fixture.detectChanges();

    const exitAnchor = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor',
    ) as HTMLElement;
    const buttons = Array.from(exitAnchor.querySelectorAll('button'));
    const buttonTexts = buttons.map((button) =>
      (button.textContent ?? '').replace(/^stop/, '').trim(),
    );

    expect(exitAnchor.className).toContain('session-host__exit-anchor--with-primary');
    expect(buttonTexts).toEqual(['Stopp', 'Session beenden']);

    (buttons[0] as HTMLButtonElement | undefined)?.click();
    await fixture.whenStable();

    expect(quickFeedbackToggleLockMutateMock).toHaveBeenCalledWith({ sessionCode: 'ABC123' });
    fixture.destroy();
  });

  it('navigiert beim Beenden aus dem Blitzlicht-Kanal direkt zur Startseite', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      participantCount: 3,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    getExportDataQueryMock.mockResolvedValue({
      sessionId: defaultSession.id,
      sessionCode: 'ABC123',
      quizName: 'Demo Quiz',
      finishedAt: '2026-03-24T12:30:00.000Z',
      participantCount: 3,
      teamMode: false,
      questions: [{ participantCount: 3, optionDistribution: [], freetextAggregates: [] }],
      teamLeaderboard: [],
      bonusTokens: [],
    });
    quickFeedbackHostResultsQueryMock.mockResolvedValue({
      type: 'STARS',
      locked: false,
      totalVotes: 1,
      distribution: { '1': 0, '2': 0, '3': 1, '4': 0, '5': 0 },
    });

    const fixture = setup();
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.componentInstance.activeChannel.set('quickFeedback');
    fixture.detectChanges();

    await fixture.componentInstance.onSessionEndAnchorClick();

    expect(endMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
    fixture.destroy();
  });

  it('zeigt in der Live-Bar des Blitzlicht-Kanals die Session-Teilnehmenden statt der Stimmen', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'ACTIVE',
      participantCount: 12,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 12, participants: [] });
    quickFeedbackHostResultsQueryMock.mockResolvedValue({
      type: 'STARS',
      locked: false,
      totalVotes: 100,
      distribution: { '1': 20, '2': 20, '3': 20, '4': 20, '5': 20 },
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.componentInstance.activeChannel.set('quickFeedback');
    fixture.detectChanges();

    const liveParticipants = fixture.nativeElement.querySelector(
      '.session-host__live-participants',
    ) as HTMLElement | null;

    expect(liveParticipants?.textContent).toContain('12');
    expect(liveParticipants?.textContent).toContain('Teilnehmende');
    expect(liveParticipants?.textContent).not.toContain('Stimmen');
    fixture.destroy();
  });

  it('ruft Host-Realtime-Subscriptions auf', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    expect(onParticipantJoinedSubscribeMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function) }),
    );
    expect(onStatusChangedSubscribeMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function) }),
    );
    expect(onCurrentQuestionForHostChangedSubscribeMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function) }),
    );
    expect(onHostVoteProgressChangedSubscribeMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function) }),
    );
    fixture.destroy();
    expect(unsubscribeMock).toHaveBeenCalledTimes(4);
  });

  it('zeigt im spielerischen Quiz-Foyer nur fuer echte Neuzugaenge einen Arrival-Chip', async () => {
    let participantJoinedHandler: ((data: unknown) => void) | null = null;
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      preset: 'PLAYFUL',
      enableRewardEffects: true,
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [{ id: 'p1', nickname: 'Ada' }],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (data: unknown) => void }) => {
        participantJoinedHandler = opts.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(0);

    participantJoinedHandler?.({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Ada' },
        { id: 'p2', nickname: 'Linus' },
      ],
    });
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip');
    expect(chips).toHaveLength(1);
    expect(fixture.nativeElement.textContent ?? '').toContain('Linus');
    fixture.destroy();
  });

  it('haelt Arrival-Chips im Dev-Host lange genug sichtbar, um sie im Browser wahrzunehmen', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 1,
        participants: [{ id: 'p1', nickname: 'Ada' }],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (data: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Ada' },
          { id: 'p2', nickname: 'Linus' },
        ],
      });
      fixture.detectChanges();

      await vi.advanceTimersByTimeAsync(1200);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(2500);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(0);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('unterdrueckt den Foyer-Einflug im serioesen Preset', async () => {
    let participantJoinedHandler: ((data: unknown) => void) | null = null;
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      preset: 'SERIOUS',
      enableRewardEffects: true,
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [{ id: 'p1', nickname: 'Ada' }],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (data: unknown) => void }) => {
        participantJoinedHandler = opts.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    TestBed.inject(ThemePresetService).setPreset('serious', { silent: true });
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    participantJoinedHandler?.({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Ada' },
        { id: 'p2', nickname: 'Linus' },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(0);
    fixture.destroy();
  });

  it('zeigt groessere Join-Wellen im Quiz-Foyer nur noch als Einzelankuenfte', async () => {
    let participantJoinedHandler: ((data: unknown) => void) | null = null;
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      preset: 'PLAYFUL',
      enableRewardEffects: true,
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [{ id: 'p1', nickname: 'Ada' }],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (data: unknown) => void }) => {
        participantJoinedHandler = opts.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    participantJoinedHandler?.({
      participantCount: 7,
      participants: [
        { id: 'p1', nickname: 'Ada' },
        { id: 'p2', nickname: 'Linus' },
        { id: 'p3', nickname: 'Grace' },
        { id: 'p4', nickname: 'Alan' },
        { id: 'p5', nickname: 'Emmy' },
        { id: 'p6', nickname: 'Hedy' },
        { id: 'p7', nickname: 'Niels' },
      ],
    });
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip');
    const shells = Array.from(
      fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
    ) as HTMLElement[];
    const chipTexts = Array.from(
      fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-text'),
    ).map((element) => (element.textContent ?? '').trim());

    expect(chips).toHaveLength(6);
    expect(shells.map((shell) => shell.style.getPropertyValue('--foyer-delay-ms'))).toEqual([
      '0ms',
      '920ms',
      '1840ms',
      '2760ms',
      '3680ms',
      '4600ms',
    ]);
    expect(chipTexts).toEqual(['Linus', 'Grace', 'Alan', 'Emmy', 'Hedy', 'Niels']);
    fixture.destroy();
  });

  it('staffelt spaetere Non-Team-Joins hinter bereits sichtbare Arrival-Chips', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 1,
        participants: [{ id: 'p1', nickname: 'Ada' }],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (data: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Ada' },
          { id: 'p2', nickname: 'Linus' },
        ],
      });
      fixture.detectChanges();

      participantJoinedHandler?.({
        participantCount: 3,
        participants: [
          { id: 'p1', nickname: 'Ada' },
          { id: 'p2', nickname: 'Linus' },
          { id: 'p3', nickname: 'Grace' },
        ],
      });
      fixture.detectChanges();

      const shells = Array.from(
        fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
      ) as HTMLElement[];
      expect(shells).toHaveLength(2);
      expect(shells[0]?.style.getPropertyValue('--foyer-delay-ms')).toBe('0ms');
      expect(shells[1]?.style.getPropertyValue('--foyer-delay-ms')).toBe('920ms');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('staffelt normale Team-Arrivals so, dass Namens-Badges nacheinander vorgestellt werden', async () => {
    let participantJoinedHandler: ((data: unknown) => void) | null = null;
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      preset: 'PLAYFUL',
      enableRewardEffects: true,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 }],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' }],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        participantJoinedHandler = opts.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    participantJoinedHandler?.({
      participantCount: 3,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p3', nickname: 'Grace Hopper', teamId: 'team-a', teamName: 'Rot' },
      ],
    });
    fixture.detectChanges();

    const shells = Array.from(
      fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
    ) as HTMLElement[];

    expect(shells).toHaveLength(2);
    expect(shells[0]?.style.getPropertyValue('--foyer-delay-ms')).toBe('0ms');
    expect(shells[1]?.style.getPropertyValue('--foyer-delay-ms')).toBe('1880ms');
    fixture.destroy();
  });

  it('zeigt Team-Leaderboard bei Teammodus im Abschlussstatus', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'FINISHED',
      teamMode: true,
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'FINISHED', currentQuestion: null });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Ada',
        totalScore: 120,
        correctCount: 3,
        totalQuestions: 4,
        totalResponseTimeMs: 5000,
        teamName: ':apple: Team A',
        teamColor: '#1E88E5',
      },
    ]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Team A',
        teamColor: '#1E88E5',
        totalScore: 220,
        memberCount: 3,
        averageScore: 220,
      },
      {
        rank: 2,
        teamName: 'Team B',
        teamColor: '#43A047',
        totalScore: 220,
        memberCount: 2,
        averageScore: 220,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Zur Startseite');
    expect(text).toContain('Team-Leaderboard');
    expect(text).toContain('Team A');
    expect(text).toContain('Gleichstand: Antwortzeit zählt.');
    expect(
      fixture.nativeElement.querySelector('td.session-host__lb-col--name')?.textContent ?? '',
    ).toContain('Team A');
    expect(getTeamLeaderboardQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
    fixture.destroy();
  });

  it('zeigt im finalen Leaderboard eine Sieger-Copy statt Zwischenstand', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'FINISHED',
      teamMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'FINISHED', currentQuestion: null });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Lila Delfin',
        totalScore: 9400,
        correctCount: 7,
        totalQuestions: 7,
        totalResponseTimeMs: 4200,
      },
      {
        rank: 2,
        nickname: 'Lagunenblaue Qualle',
        totalScore: 9100,
        correctCount: 6,
        totalQuestions: 7,
        totalResponseTimeMs: 4500,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    const winnerEmoji = fixture.nativeElement.querySelector(
      '.session-host__kindergarten-emoji--winner',
    ) as HTMLElement | null;
    const tableEntries = Array.from(
      fixture.nativeElement.querySelectorAll('.session-host__kindergarten-entry--table'),
    ) as HTMLElement[];
    const tableEmojis = tableEntries
      .map((entry) => entry.querySelector('.session-host__kindergarten-emoji--table'))
      .filter((entry): entry is HTMLElement => entry instanceof HTMLElement);
    const tableLabels = tableEntries.map(
      (entry) =>
        entry.querySelector('.session-host__kindergarten-label')?.textContent?.trim() ?? '',
    );

    expect(text).toContain('Gewonnen hat');
    expect(text).toContain('Lila Delfin');
    expect(text).toContain('Bei Punktgleichheit entscheidet die schnellere Antwortzeit.');
    expect(text).toMatch(/Mit 9[.,]400 Punkten/);
    expect(winnerEmoji?.getAttribute('title')).toBe('Lila Delfin');
    expect(
      fixture.nativeElement
        .querySelector(
          '.session-host__kindergarten-entry--winner .session-host__kindergarten-label',
        )
        ?.textContent?.trim(),
    ).toBe('Lila Delfin');
    expect(tableEmojis.map((emoji) => emoji.getAttribute('title'))).toEqual([
      'Lila Delfin',
      'Lagunenblaue Qualle',
    ]);
    expect(tableLabels).toEqual(['Lila Delfin', 'Lagunenblaue Qualle']);
    fixture.destroy();
  });

  it('zeigt die didaktische Confidence-Zusammenfassung im Abschluss', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.statusUpdate.set({
      status: 'FINISHED',
      currentQuestion: null,
    });
    fixture.componentInstance.finishedConfidenceSummary.set({
      responseCount: 5,
      includedQuestionCount: 1,
      suppressedQuestionCount: 0,
      priorityQuestionCount: 1,
      distribution: { '1': 1, '2': 0, '3': 0, '4': 2, '5': 2 },
      crossTab: {
        correctHigh: 2,
        correctMid: 0,
        correctLow: 1,
        incorrectHigh: 2,
        incorrectMid: 0,
        incorrectLow: 0,
      },
      highConfidenceWrongCount: 2,
      questions: [
        {
          questionOrder: 0,
          questionTextShort:
            '### Welche Aussage stimmt?\n\n> **Unterrichtsidee:** Nutze die Nachbesprechung.',
          questionType: 'SINGLE_CHOICE',
          responseCount: 5,
          result: {
            distribution: { '1': 1, '2': 0, '3': 0, '4': 2, '5': 2 },
            crossTab: {
              correctHigh: 2,
              correctMid: 0,
              correctLow: 1,
              incorrectHigh: 2,
              incorrectMid: 0,
              incorrectLow: 0,
            },
            highConfidenceWrongCount: 2,
          },
        },
      ],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Lernstand und Selbsteinschätzung');
    expect(text).toContain('Anteil Fehlkonzept-Hinweis');
    expect(text).toContain('Nachbesprechungsplan ansehen');
    expect(text).toContain('Welche Aussage stimmt?');
    expect(
      fixture.nativeElement.querySelector('.session-host__finished-confidence-question-markdown h4')
        ?.textContent,
    ).toContain('Welche Aussage stimmt?');
    expect(
      fixture.nativeElement.querySelector(
        '.session-host__finished-confidence-question-markdown blockquote strong',
      )?.textContent,
    ).toContain('Unterrichtsidee:');
    fixture.destroy();
  });

  it('zeigt im Host-Zwischenleaderboard Titles, Labels und den Gleichstandhinweis', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'RESULTS',
      teamMode: true,
      nicknameTheme: 'KINDERGARTEN',
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: false },
        { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        {
          id: 'aaaaaaaa-1111-4111-8111-111111111111',
          text: 'A',
          isCorrect: false,
          voteCount: 1,
          votePercentage: 33,
        },
        {
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          text: 'B',
          isCorrect: true,
          voteCount: 2,
          votePercentage: 67,
        },
      ],
      totalVotes: 3,
      correctVoterCount: 2,
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Lila Delfin',
        totalScore: 500,
        correctCount: 3,
        totalQuestions: 3,
        totalResponseTimeMs: 3000,
        teamName: ':apple: Team Apfel',
        teamColor: '#1E88E5',
      },
      {
        rank: 2,
        nickname: 'Lagunenblaue Qualle',
        totalScore: 500,
        correctCount: 2,
        totalQuestions: 3,
        totalResponseTimeMs: 3200,
        teamName: ':pear: Team Birne',
        teamColor: '#43A047',
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const interimEntries = Array.from(
      fixture.nativeElement.querySelectorAll('.session-host__kindergarten-entry--interim'),
    ) as HTMLElement[];
    const interimEmojis = interimEntries
      .map((entry) => entry.querySelector('.session-host__kindergarten-emoji--interim'))
      .filter((entry): entry is HTMLElement => entry instanceof HTMLElement);
    const interimLabels = interimEntries.map(
      (entry) =>
        entry.querySelector('.session-host__kindergarten-label')?.textContent?.trim() ?? '',
    );

    expect(interimEmojis.map((emoji) => emoji.getAttribute('title'))).toEqual([
      'Lila Delfin',
      'Lagunenblaue Qualle',
    ]);
    expect(interimLabels).toEqual(['Lila Delfin', 'Lagunenblaue Qualle']);
    expect(fixture.nativeElement.textContent ?? '').toContain('Team Apfel');
    expect(fixture.nativeElement.textContent ?? '').toContain('Gleichstand: Antwortzeit zählt.');
    fixture.destroy();
  });

  it('zeigt Host-Zwischenleaderboards auch nach bewerteten Kurzantworten', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'RESULTS',
      teamMode: true,
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Methode ist gemeint?',
      type: 'SHORT_TEXT',
      answers: [{ id: 'a1', text: 'Peer Instruction', isCorrect: true }],
      voteDistribution: [],
      totalVotes: 2,
      correctVoterCount: 2,
    });
    getLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        nickname: 'Ada',
        totalScore: 600,
        correctCount: 1,
        totalQuestions: 1,
        totalResponseTimeMs: 900,
      },
    ]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: ':apple: Team Apfel',
        teamColor: '#1E88E5',
        totalScore: 600,
        memberCount: 2,
        averageScore: 600,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent ?? '').toContain('Top 5');
    expect(fixture.nativeElement.textContent ?? '').toContain('Ada');
    expect(fixture.nativeElement.textContent ?? '').toContain('Team-Wertung');
    expect(fixture.nativeElement.textContent ?? '').toContain('Team Apfel');
    fixture.destroy();
  });

  it('blendet im Host-Team-Leaderboard den Farbpunkt bei Emoji-Shortcodes aus', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'FINISHED',
      teamMode: true,
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'FINISHED', currentQuestion: null });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getLeaderboardQueryMock.mockResolvedValue([]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: ':apple: Rot',
        teamColor: '#1E88E5',
        totalScore: 220,
        memberCount: 3,
        averageScore: 220,
      },
      {
        rank: 2,
        teamName: ':pear: Gruen',
        teamColor: '#43A047',
        totalScore: 220,
        memberCount: 2,
        averageScore: 220,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const boardName = fixture.nativeElement.querySelector(
      '.session-host__team-bar-name',
    ) as HTMLElement | null;
    expect(boardName?.textContent ?? '').toContain('Rot');
    expect(boardName?.querySelector('.session-host__team-bar-dot')).toBeNull();
    expect(boardName?.querySelector('.session-host__team-bar-emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('blendet in der Host-Teamwertung bei RESULTS den Farbpunkt bei Emoji-Shortcodes aus', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'RESULTS',
      teamMode: true,
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'a1', text: 'A', isCorrect: false },
        { id: 'a2', text: 'B', isCorrect: true },
      ],
      voteDistribution: [
        { id: 'a1', text: 'A', isCorrect: false, voteCount: 1, votePercentage: 50 },
        { id: 'a2', text: 'B', isCorrect: true, voteCount: 1, votePercentage: 50 },
      ],
      totalVotes: 2,
      correctVoterCount: 1,
    });
    getLeaderboardQueryMock.mockResolvedValue([]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: ':apple: Rot',
        teamColor: '#1E88E5',
        totalScore: 220,
        memberCount: 3,
        averageScore: 220,
      },
      {
        rank: 2,
        teamName: ':pear: Gruen',
        teamColor: '#43A047',
        totalScore: 220,
        memberCount: 2,
        averageScore: 220,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const teamInterim = fixture.nativeElement.querySelector(
      '.session-host__interim-leaderboard--teams',
    ) as HTMLElement | null;
    const interimName = teamInterim?.querySelector(
      '.session-host__interim-name',
    ) as HTMLElement | null;
    const interimScore = teamInterim?.querySelector(
      '.session-host__interim-score',
    ) as HTMLElement | null;
    expect(interimName?.textContent ?? '').toContain('Rot');
    expect(interimScore?.textContent ?? '').toContain('3 Mitglieder');
    expect(interimScore?.textContent ?? '').toContain('∅ 220');
    expect(teamInterim?.textContent ?? '').toContain('Gleichstand: Antwortzeit zählt.');
    expect(interimName?.querySelector('.session-host__interim-team-dot')).toBeNull();
    expect(interimName?.querySelector('.session-host__interim-team-emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('zeigt nach Umfrage-Ergebnissen kein Zwischen-Scoreboard an', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'RESULTS',
      teamMode: true,
    });
    onStatusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({ status: 'RESULTS', currentQuestion: 0 });
        return { unsubscribe: unsubscribeMock };
      },
    );
    getCurrentQuestionForHostQueryMock.mockResolvedValue({
      questionId: 'bbbbbbbb-2222-4222-8222-222222222222',
      order: 0,
      totalQuestions: 3,
      text: 'Wie hilfreich war das?',
      type: 'SURVEY',
      answers: [
        { id: 'a1', text: 'Sehr', isCorrect: false },
        { id: 'a2', text: 'Wenig', isCorrect: false },
      ],
      voteDistribution: [
        { id: 'a1', text: 'Sehr', isCorrect: false, voteCount: 5, votePercentage: 63 },
        { id: 'a2', text: 'Wenig', isCorrect: false, voteCount: 3, votePercentage: 37 },
      ],
      totalVotes: 8,
      correctVoterCount: 0,
    });
    getLeaderboardQueryMock.mockResolvedValue([
      { rank: 1, nickname: 'Ada', totalScore: 120 },
      { rank: 2, nickname: 'Linus', totalScore: 100 },
    ]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Rot',
        teamColor: '#1E88E5',
        totalScore: 220,
        memberCount: 3,
        averageScore: 73.3,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.session-host__interim-leaderboard')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.session-host__interim-leaderboard--teams'),
    ).toBeNull();
    fixture.destroy();
  });

  it('zeigt in der Lobby eine Teamübersicht mit Mitgliedern', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 2 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 1 },
      ],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 3,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p3', nickname: 'Grace', teamId: 'team-b', teamName: 'Blau' },
      ],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({
          participantCount: 3,
          participants: [
            { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
            { id: 'p2', nickname: 'Linus', teamId: 'team-a', teamName: 'Rot' },
            { id: 'p3', nickname: 'Grace', teamId: 'team-b', teamName: 'Blau' },
          ],
        });
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Warten auf die anderen...');
    expect(text).toContain('Rot');
    expect(text).toContain('Blau');
    expect(text).toContain('2 Mitglieder');
    expect(text).toContain('1 Mitglied');
    expect(text).toContain('Ada');
    expect(text).toContain('Grace');
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.session-lobby__team-card'),
    ) as HTMLElement[];
    const teamAMembers = Array.from(cards[0].querySelectorAll('.session-lobby__team-member')).map(
      (element) => (element.textContent ?? '').trim(),
    );
    expect(teamAMembers).toEqual(['Linus', 'Ada']);
    fixture.destroy();
  });

  it('aktualisiert Team-Mitgliedszahlen in der Lobby aus dem Teilnehmer-Payload ohne weiteren Team-Reload', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      preset: 'PLAYFUL',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
      ],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-a', teamName: 'Rot' },
      ],
    });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('2 Mitglieder');
    expect(text).toContain('0 Mitglieder');
    expect(getTeamsQueryMock).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('behaelt Teamkarten bei, wenn ein spaeterer Team-Refresh fehlschlaegt', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      preset: 'PLAYFUL',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
      ],
    });
    getParticipantsQueryMock.mockResolvedValue({ participantCount: 0, participants: [] });

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const cardsBefore = fixture.nativeElement.querySelectorAll('.session-lobby__team-card');
    expect(cardsBefore.length).toBe(2);
    getTeamsQueryMock.mockRejectedValueOnce(new Error('network'));

    await (
      fixture.componentInstance as unknown as {
        refreshLobbyTeams(): Promise<void>;
      }
    ).refreshLobbyTeams();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.session-lobby__team-card').length).toBe(2);
    expect(host.textContent ?? '').toContain('Rot');
    expect(host.textContent ?? '').toContain('Blau');
    fixture.destroy();
  });

  it('rendert Team-Einfluege lokal in der passenden Teamkarte und nutzt die Kartenrichtung', async () => {
    let participantJoinedHandler: ((data: unknown) => void) | null = null;
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      preset: 'PLAYFUL',
      enableRewardEffects: true,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 1 },
      ],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-b', teamName: 'Blau' },
      ],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        participantJoinedHandler = opts.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.session-lobby__team-card'),
    ) as HTMLElement[];
    expect(cards).toHaveLength(2);

    vi.spyOn(cards[0], 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 0,
      width: 220,
      height: 180,
      right: 260,
      bottom: 180,
      x: 40,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(cards[1], 'getBoundingClientRect').mockReturnValue({
      left: 700,
      top: 0,
      width: 220,
      height: 180,
      right: 920,
      bottom: 180,
      x: 700,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    participantJoinedHandler?.({
      participantCount: 3,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-b', teamName: 'Blau' },
        { id: 'p3', nickname: 'Grace', teamId: 'team-b', teamName: 'Blau' },
      ],
    });
    fixture.detectChanges();

    expect(cards[0].querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(0);
    expect(cards[1].querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(1);
    expect(cards[0].className).not.toContain('session-lobby__team-card--arrival');
    expect(cards[1].className).toContain('session-lobby__team-card--arrival');
    expect(cards[1].querySelector('.foyer-entrance-layer--overlay')).not.toBeNull();
    expect(cards[1].querySelector('.foyer-entrance-layer__chip-shell--from-right')).not.toBeNull();
    expect(cards[1].textContent ?? '').toContain('Grace');
    const teamBMembers = Array.from(cards[1].querySelectorAll('.session-lobby__team-member')).map(
      (element) => (element.textContent ?? '').trim(),
    );
    expect(teamBMembers).toEqual(['Linus']);
    fixture.destroy();
  });

  it('unterdrueckt Team-Foyer-Animationen bei sehr grossen Join-Wellen', async () => {
    let participantJoinedHandler: ((data: unknown) => void) | null = null;
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      preset: 'PLAYFUL',
      enableRewardEffects: true,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
      ],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 0,
      participants: [],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        participantJoinedHandler = opts.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    participantJoinedHandler?.({
      participantCount: 120,
      participants: Array.from({ length: 30 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        nickname: `Tier ${index + 1}`,
        teamId: index % 2 === 0 ? 'team-a' : 'team-b',
        teamName: index % 2 === 0 ? 'Rot' : 'Blau',
      })),
    });
    fixture.detectChanges();

    expect(component.foyerArrivalChips().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.session-lobby__team-foyer-stage')).toBeNull();
    fixture.destroy();
  });

  it('zeigt groessere Team-Join-Wellen lokal nur noch als Einzelankuenfte', async () => {
    let participantJoinedHandler: ((data: unknown) => void) | null = null;
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      preset: 'PLAYFUL',
      enableRewardEffects: true,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 },
        { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 1 },
      ],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-b', teamName: 'Blau' },
      ],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        participantJoinedHandler = opts.onData;
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.session-lobby__team-card'),
    ) as HTMLElement[];
    expect(cards).toHaveLength(2);

    vi.spyOn(cards[0], 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 0,
      width: 220,
      height: 180,
      right: 260,
      bottom: 180,
      x: 40,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(cards[1], 'getBoundingClientRect').mockReturnValue({
      left: 700,
      top: 0,
      width: 220,
      height: 180,
      right: 920,
      bottom: 180,
      x: 700,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    participantJoinedHandler?.({
      participantCount: 7,
      participants: [
        { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
        { id: 'p2', nickname: 'Linus', teamId: 'team-b', teamName: 'Blau' },
        { id: 'p3', nickname: 'Grace', teamId: 'team-b', teamName: 'Blau' },
        { id: 'p4', nickname: 'Alan', teamId: 'team-b', teamName: 'Blau' },
        { id: 'p5', nickname: 'Emmy', teamId: 'team-b', teamName: 'Blau' },
        { id: 'p6', nickname: 'Hedy', teamId: 'team-b', teamName: 'Blau' },
        { id: 'p7', nickname: 'Niels', teamId: 'team-b', teamName: 'Blau' },
      ],
    });
    fixture.detectChanges();

    expect(cards[0].querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(0);
    expect(cards[1].querySelectorAll('.foyer-entrance-layer__chip')).toHaveLength(5);
    expect(cards[1].querySelector('.foyer-entrance-layer__chip-shell--from-right')).not.toBeNull();
    const teamBMembers = Array.from(cards[1].querySelectorAll('.session-lobby__team-member')).map(
      (element) => (element.textContent ?? '').trim(),
    );
    expect(teamBMembers).toEqual(['Linus']);
    expect(cards[1].querySelector('.session-lobby__team-empty')).toBeNull();
    fixture.destroy();
  });

  it('rendert Kindergarten-Team-Arrivals mit Icon und separatem Namens-Badge', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 1,
        participants: [{ id: 'p1', nickname: 'Brauner Bär', teamId: 'team-a', teamName: 'Rot' }],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      const cards = Array.from(
        fixture.nativeElement.querySelectorAll('.session-lobby__team-card'),
      ) as HTMLElement[];
      expect(cards).toHaveLength(2);

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Brauner Bär', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Gelber Löwe', teamId: 'team-b', teamName: 'Blau' },
        ],
      });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(2140);
      fixture.detectChanges();

      const overlayChip = cards[1].querySelector(
        '.foyer-entrance-layer__chip',
      ) as HTMLElement | null;
      const overlayBadge = cards[1].querySelector(
        '.foyer-entrance-layer__name-badge',
      ) as HTMLElement | null;
      expect(overlayChip).not.toBeNull();
      expect(overlayChip?.className).toContain('foyer-entrance-layer__chip--emoji-only');
      expect(
        overlayChip?.querySelector('.foyer-entrance-layer__chip-emoji')?.textContent?.trim().length,
      ).toBeGreaterThan(0);
      expect(overlayChip?.querySelector('.foyer-entrance-layer__chip-text')).toBeNull();
      expect(overlayBadge?.textContent?.trim()).toBe('Gelber Löwe');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('zeigt bei Nobelpreistraeger-Arrivals in der Kindergarten-Session den Vollnamen als Badge', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 1,
        participants: [{ id: 'p1', nickname: 'Brauner Bär', teamId: 'team-a', teamName: 'Rot' }],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      const cards = Array.from(
        fixture.nativeElement.querySelectorAll('.session-lobby__team-card'),
      ) as HTMLElement[];

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Brauner Bär', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Barbara McClintock', teamId: 'team-b', teamName: 'Blau' },
        ],
      });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(2140);
      fixture.detectChanges();

      const overlayChip = cards[1].querySelector(
        '.foyer-entrance-layer__chip',
      ) as HTMLElement | null;
      const overlayBadge = cards[1].querySelector(
        '.foyer-entrance-layer__name-badge',
      ) as HTMLElement | null;

      expect(
        overlayChip?.querySelector('.foyer-entrance-layer__chip-text')?.textContent?.trim(),
      ).toBe('Barbara');
      expect(overlayBadge?.textContent?.trim()).toBe('Barbara McClintock');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stellt mehrteilige Pseudonym-Namen mit Vornamen im Chip und Vollnamen im Badge vor', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        allowCustomNicknames: false,
        nicknameTheme: 'HIGH_SCHOOL',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 1,
        participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' }],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      const cards = Array.from(
        fixture.nativeElement.querySelectorAll('.session-lobby__team-card'),
      ) as HTMLElement[];

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Ada Lovelace', teamId: 'team-b', teamName: 'Blau' },
        ],
      });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(1440);
      fixture.detectChanges();

      const overlayChip = cards[1].querySelector(
        '.foyer-entrance-layer__chip',
      ) as HTMLElement | null;
      const overlayBadge = cards[1].querySelector(
        '.foyer-entrance-layer__name-badge',
      ) as HTMLElement | null;

      expect(
        overlayChip?.querySelector('.foyer-entrance-layer__chip-text')?.textContent?.trim(),
      ).toBe('Ada');
      expect(overlayBadge?.textContent?.trim()).toBe('Ada Lovelace');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('staffelt Kindergarten-Team-Arrivals global, damit Tiere einzeln eintreten', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 0,
        participants: [],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      const cards = Array.from(
        fixture.nativeElement.querySelectorAll('.session-lobby__team-card'),
      ) as HTMLElement[];
      expect(cards).toHaveLength(2);

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Rosa Schmetterling', teamId: 'team-b', teamName: 'Blau' },
        ],
      });

      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const firstShell = cards[0].querySelector(
        '.foyer-entrance-layer__chip-shell',
      ) as HTMLElement | null;
      const secondShell = cards[1].querySelector(
        '.foyer-entrance-layer__chip-shell',
      ) as HTMLElement | null;
      expect(firstShell).not.toBeNull();
      expect(secondShell).not.toBeNull();
      expect(firstShell?.style.getPropertyValue('--foyer-delay-ms')).toBe('0ms');
      expect(secondShell?.style.getPropertyValue('--foyer-delay-ms')).toBe('5400ms');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('vermeidet bei laengeren Kindergarten-Serien sichtbare Ueberlappungen zwischen den Tieren', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 0,
        participants: [],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      participantJoinedHandler?.({
        participantCount: 3,
        participants: [
          { id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Rosa Schmetterling', teamId: 'team-b', teamName: 'Blau' },
          { id: 'p3', nickname: 'Brauner Bär', teamId: 'team-a', teamName: 'Rot' },
        ],
      });

      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const delays = Array.from(
        fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
      ).map((element) => (element as HTMLElement).style.getPropertyValue('--foyer-delay-ms'));
      expect(delays).toEqual(['0ms', '5400ms', '10200ms']);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('klemmt groessere Kindergarten-Wellen nicht mehr auf denselben Startzeitpunkt', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 0,
        participants: [],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      participantJoinedHandler?.({
        participantCount: 5,
        participants: [
          { id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Rosa Schmetterling', teamId: 'team-b', teamName: 'Blau' },
          { id: 'p3', nickname: 'Brauner Bär', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p4', nickname: 'Oranger Fuchs', teamId: 'team-b', teamName: 'Blau' },
          { id: 'p5', nickname: 'Grüner Frosch', teamId: 'team-a', teamName: 'Rot' },
        ],
      });

      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      const delays = Array.from(
        fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
      ).map((element) => (element as HTMLElement).style.getPropertyValue('--foyer-delay-ms'));

      expect(delays).toEqual(['0ms', '5400ms', '10200ms', '15000ms', '19100ms']);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('staffelt einen neuen Kindergarten-Einflug hinter ein bereits sichtbares Tier', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 0,
        participants: [],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      participantJoinedHandler?.({
        participantCount: 1,
        participants: [{ id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' }],
      });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
      ).toHaveLength(1);

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Rosa Schmetterling', teamId: 'team-b', teamName: 'Blau' },
        ],
      });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      const shells = Array.from(
        fixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
      ) as HTMLElement[];
      expect(shells).toHaveLength(2);
      expect(shells[1]?.style.getPropertyValue('--foyer-delay-ms')).toBe('4800ms');
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('retriggert die Team-Pulse-Variante fuer spaetere Kindergarten-Ankuenfte derselben Karte', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 0,
        participants: [],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      const firstCard = () =>
        fixture.nativeElement.querySelector('.session-lobby__team-card') as HTMLElement | null;

      participantJoinedHandler?.({
        participantCount: 1,
        participants: [{ id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' }],
      });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(firstCard()?.className).not.toContain('session-lobby__team-card--arrival-a');
      expect(firstCard()?.className).not.toContain('session-lobby__team-card--arrival-b');

      await vi.advanceTimersByTimeAsync(2779);
      fixture.detectChanges();
      expect(firstCard()?.className).not.toMatch(/session-lobby__team-card--arrival-[ab]/);

      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      expect(firstCard()?.className).toMatch(/session-lobby__team-card--arrival-[ab]/);

      await vi.advanceTimersByTimeAsync(980);
      fixture.detectChanges();
      expect(firstCard()?.className).not.toMatch(/session-lobby__team-card--arrival-[ab]/);

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Brauner Bär', teamId: 'team-a', teamName: 'Rot' },
        ],
      });

      await vi.advanceTimersByTimeAsync(7319);
      fixture.detectChanges();
      expect(firstCard()?.className).not.toMatch(/session-lobby__team-card--arrival-[ab]/);

      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      expect(firstCard()?.className).toMatch(/session-lobby__team-card--arrival-[ab]/);

      await vi.advanceTimersByTimeAsync(980);
      fixture.detectChanges();
      expect(firstCard()?.className).not.toMatch(/session-lobby__team-card--arrival-[ab]/);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('raeumt die Kindergarten-Queue beim Reload auf und startet nicht mit alten Pending-Tieren neu', async () => {
    vi.useFakeTimers();
    try {
      let participantJoinedHandler: ((data: unknown) => void) | null = null;
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'LOBBY',
        teamMode: true,
        anonymousMode: false,
        nicknameTheme: 'KINDERGARTEN',
        preset: 'PLAYFUL',
        enableRewardEffects: true,
      });
      getTeamsQueryMock.mockResolvedValue({
        teamCount: 2,
        teams: [
          { id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 0 },
          { id: 'team-b', name: 'Blau', color: '#43A047', memberCount: 0 },
        ],
      });
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 0,
        participants: [],
      });
      onParticipantJoinedSubscribeMock.mockImplementation(
        (_input: unknown, opts: { onData: (d: unknown) => void }) => {
          participantJoinedHandler = opts.onData;
          return { unsubscribe: unsubscribeMock };
        },
      );

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      fixture.detectChanges();

      participantJoinedHandler?.({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Rosa Schmetterling', teamId: 'team-b', teamName: 'Blau' },
        ],
      });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      fixture.destroy();

      await vi.advanceTimersByTimeAsync(6000);
      TestBed.resetTestingModule();

      getParticipantsQueryMock.mockResolvedValue({
        participantCount: 2,
        participants: [
          { id: 'p1', nickname: 'Gelber Löwe', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Rosa Schmetterling', teamId: 'team-b', teamName: 'Blau' },
        ],
      });

      const reloadFixture = setup();
      reloadFixture.detectChanges();
      await reloadFixture.whenStable();
      await vi.advanceTimersByTimeAsync(50);
      reloadFixture.detectChanges();

      expect(
        reloadFixture.nativeElement.querySelectorAll('.foyer-entrance-layer__chip-shell'),
      ).toHaveLength(0);
      reloadFixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('blendet den Farbpunkt aus, wenn der Teamname mit Emoji beginnt', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: '🍎 Rot', color: '#1E88E5', memberCount: 1 }],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: '🍎 Rot' }],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({
          participantCount: 1,
          participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: '🍎 Rot' }],
        });
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.session-lobby__team-card') as HTMLElement;
    expect(card.textContent ?? '').toContain('Rot');
    expect(card.querySelector('.session-lobby__team-card-dot')).toBeNull();
    expect(card.querySelector('.session-lobby__team-card-emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('zeigt bei emoji-only Teamnamen einen generischen Team-Text in der Lobby', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: ':apple:', color: '#1E88E5', memberCount: 1 }],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: ':apple:' }],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({
          participantCount: 1,
          participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: ':apple:' }],
        });
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.session-lobby__team-card') as HTMLElement;
    expect(card.textContent ?? '').toContain('Team');
    expect(card.querySelector('.session-lobby__team-card-dot')).toBeNull();
    expect(card.querySelector('.session-lobby__team-card-emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('zeigt in der Kindergarten-Teamlobby nur das Emoji und haelt den Tiernamen sr-only', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: 'Rot', color: '#1E88E5', memberCount: 1 }],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [
        { id: 'p1', nickname: 'Mintgrüne Eidechse', teamId: 'team-a', teamName: 'Rot' },
      ],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({
          participantCount: 1,
          participants: [
            { id: 'p1', nickname: 'Mintgrüne Eidechse', teamId: 'team-a', teamName: 'Rot' },
          ],
        });
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.session-lobby__team-card') as HTMLElement;
    expect(card.querySelector('.session-lobby__nick-emoji--host-lobby')).not.toBeNull();
    expect(card.querySelector('.session-lobby__nick-label--host-lobby')).toBeNull();
    expect(card.querySelector('.sr-only')?.textContent?.trim()).toBe('Mintgrüne Eidechse');
    fixture.destroy();
  });

  it('zeigt bei Teamnamen mit nachgestelltem Emoji keinen Farbpunk in der Lobby', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      status: 'LOBBY',
      teamMode: true,
      anonymousMode: false,
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [{ id: 'team-a', name: 'Team :apple:', color: '#1E88E5', memberCount: 1 }],
    });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Team :apple:' }],
    });
    onParticipantJoinedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        opts.onData({
          participantCount: 1,
          participants: [{ id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Team :apple:' }],
        });
        return { unsubscribe: unsubscribeMock };
      },
    );

    const fixture = setup();
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.session-lobby__team-card') as HTMLElement;
    expect(card.querySelector('.session-lobby__team-card-name')?.textContent ?? '').toContain(
      'Team',
    );
    expect(card.querySelector('.session-lobby__team-card-dot')).toBeNull();
    expect(card.querySelector('.session-lobby__team-card-emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  describe('Host-Steering-Callout bei Störfällen', () => {
    const steeringTitle = 'Das ist gerade nicht angekommen';
    const qaCalloutTitle = 'Mit den Fragen klappt es gerade nicht';
    const exportCalloutTitle = 'Export noch nicht bereit';

    const calloutEl = (fixture: ReturnType<typeof setup>) =>
      fixture.nativeElement.querySelector('.session-host__steering-callout') as HTMLElement | null;

    it('zeigt nach fehlgeschlagenem startQa den Steuerungs-Callout mit beruhigendem Titel', async () => {
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        type: 'Q_AND_A',
        quizName: null,
        title: 'Offene Fragen',
        status: 'LOBBY',
      });
      startQaMutateMock.mockRejectedValueOnce(new Error('network'));

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      const component = fixture.componentInstance;
      await component.startQa();
      fixture.detectChanges();

      expect(component.hostSteeringCallout()).not.toBeNull();
      expect(component.hostSteeringCallout()?.title).toContain(steeringTitle);
      expect(calloutEl(fixture)?.textContent ?? '').toContain(steeringTitle);
      expect(startQaMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
      fixture.destroy();
    });

    it('zeigt nach fehlgeschlagenem nextQuestion den Steuerungs-Callout', async () => {
      getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
      nextQuestionMutateMock.mockRejectedValueOnce(new Error('timeout'));

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.componentInstance.nextQuestion();
      fixture.detectChanges();

      expect(fixture.componentInstance.hostSteeringCallout()?.title).toContain(steeringTitle);
      expect(nextQuestionMutateMock).toHaveBeenCalledWith({ code: 'ABC123' });
      fixture.destroy();
    });

    it('zeigt nach fehlgeschlagener Q&A-Moderation den Q&A-Callout', async () => {
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        channels: {
          quiz: { enabled: true },
          qa: { enabled: true, open: true, title: 'Fragen', moderationMode: true },
          quickFeedback: { enabled: false, open: false },
        },
      });
      qaListQueryMock.mockResolvedValue([
        {
          id: '44444444-4444-4444-8444-444444444444',
          text: 'Testfrage',
          upvoteCount: 0,
          status: 'PENDING',
          createdAt: '2026-03-13T12:00:00.000Z',
          myVote: null,
          isOwn: false,
          hasUpvoted: false,
        },
      ]);
      qaModerateMutateMock.mockRejectedValueOnce(new Error('moderate failed'));

      const fixture = setup();
      fixture.detectChanges();
      await flushComponentAfterStable(fixture, 50);

      const component = fixture.componentInstance;
      component.activeChannel.set('qa');
      await component.moderateQaQuestion('44444444-4444-4444-8444-444444444444', 'APPROVE');
      fixture.detectChanges();

      expect(component.hostSteeringCallout()?.title).toContain(qaCalloutTitle);
      fixture.destroy();
    });

    it('zeigt nach fehlgeschlagenem Laden der Fragenliste den Q&A-Callout', async () => {
      qaListQueryMock.mockRejectedValueOnce(new Error('list failed'));
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        channels: {
          quiz: { enabled: true },
          qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
          quickFeedback: { enabled: false, open: false },
        },
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      // Zoneless TestBed: whenStable wartet nicht auf die volle async-ngOnInit-Kette; kurz entkoppeln.
      await flushMacroTask(0);
      fixture.detectChanges();

      expect(qaListQueryMock).toHaveBeenCalledWith({
        sessionId: defaultSession.id,
        moderatorView: true,
        sort: 'BEST',
      });
      expect(fixture.componentInstance.hostSteeringCallout()?.title).toContain(qaCalloutTitle);
      fixture.destroy();
    });

    it('zeigt nach fehlgeschlagenem Ergebnis-Export den Export-Callout', async () => {
      getExportDataQueryMock.mockRejectedValueOnce(new Error('export query failed'));

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.componentInstance.exportSessionResultsCsv();
      fixture.detectChanges();

      expect(fixture.componentInstance.hostSteeringCallout()?.title).toContain(exportCalloutTitle);
      fixture.destroy();
    });

    it('exportiert geladene Q&A-Fragen als CSV ohne Zusatzabfrage', async () => {
      let exportedCsv = '';
      const createObjectURLMock = vi.fn(() => 'blob:test-export');
      const revokeObjectURLMock = vi.fn();
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      const originalBlob = Blob;
      class CaptureBlob extends Blob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          exportedCsv = parts
            .map((part) => (typeof part === 'string' ? part : String(part)))
            .join('');
        }
      }
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: CaptureBlob,
      });
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        status: 'ACTIVE',
        channels: {
          quiz: { enabled: true },
          qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: true },
          quickFeedback: { enabled: false, open: false },
        },
      });
      qaListQueryMock.mockResolvedValue([
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Wann startet der Test?',
          upvoteCount: 4,
          score: 4,
          positiveVoteCount: 6,
          negativeVoteCount: 2,
          voteCount: 8,
          bestScore: 0.625,
          controversyScore: 0.375,
          isControversial: false,
          status: 'ACTIVE',
          createdAt: '2026-03-13T12:00:00.000Z',
          myVote: null,
          isOwn: false,
          hasUpvoted: false,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Ist die Abgabe schon geschlossen?',
          upvoteCount: -1,
          score: -1,
          positiveVoteCount: 1,
          negativeVoteCount: 2,
          voteCount: 3,
          bestScore: 0.12,
          controversyScore: 0.52,
          isControversial: true,
          status: 'DELETED',
          createdAt: '2026-03-13T12:01:00.000Z',
          myVote: null,
          isOwn: false,
          hasUpvoted: false,
        },
      ]);

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.waitUntil(() => fixture.componentInstance.qaQuestions().length === 2, {
        timeout: 5000,
        interval: 25,
      });

      fixture.componentInstance.activeChannel.set('qa');
      fixture.detectChanges();
      await fixture.whenStable();
      const qaQueryCallCount = qaListQueryMock.mock.calls.length;

      await fixture.componentInstance.exportQaQuestionsCsv();
      fixture.detectChanges();

      expect(qaListQueryMock).toHaveBeenCalledTimes(qaQueryCallCount);
      expect(getExportDataQueryMock).not.toHaveBeenCalled();
      expect(exportedCsv).toContain(
        'Nr.;Frage-ID;Status;Frage;Score;Positive Stimmen;Negative Stimmen;Stimmen gesamt;Wilson-Score;Kontroverse-Score;Umstritten;Erstellt am',
      );
      expect(exportedCsv).toContain(
        '1;11111111-1111-4111-8111-111111111111;ACTIVE;"Wann startet der Test?";4;6;2;8;0.625;0.375;false;2026-03-13T12:00:00.000Z',
      );
      expect(exportedCsv).toContain(
        '2;22222222-2222-4222-8222-222222222222;DELETED;"Ist die Abgabe schon geschlossen?";-1;1;2;3;0.12;0.52;true;2026-03-13T12:01:00.000Z',
      );
      expect(fixture.componentInstance.exportStatus()).toBe('Q&A-CSV exportiert.');

      fixture.destroy();
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: originalBlob,
      });
    });

    it('exportiert die Team-Wertung im Ergebnis-CSV', async () => {
      let exportedBlob: Blob | null = null;
      let exportedCsv = '';
      const createObjectURLMock = vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return 'blob:test-export';
      });
      const revokeObjectURLMock = vi.fn();
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      const originalBlob = Blob;
      class CaptureBlob extends Blob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          exportedCsv = parts
            .map((part) => (typeof part === 'string' ? part : String(part)))
            .join('');
        }
      }
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: CaptureBlob,
      });
      getExportDataQueryMock.mockResolvedValueOnce({
        sessionId: defaultSession.id,
        sessionCode: 'ABC123',
        quizName: 'Demo Quiz',
        finishedAt: '2026-03-24T12:30:00.000Z',
        participantCount: 3,
        teamMode: true,
        questions: [],
        teamLeaderboard: [
          {
            rank: 1,
            teamName: ':apple: Rot',
            teamColor: '#1E88E5',
            memberCount: 2,
            totalScore: 220,
            averageScore: 220,
          },
        ],
        bonusTokens: [],
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.componentInstance.exportSessionResultsCsv();
      fixture.detectChanges();

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-export');
      expect(exportedBlob).not.toBeNull();
      expect(exportedCsv).toContain('Team-Wertung');
      expect(exportedCsv).toContain('Rang;Team;Farbe;Mitglieder;Team-Punkte;Ø Punkte pro Mitglied');
      expect(exportedCsv).toContain('1;"🍎 Rot";#1E88E5;2;220;220');

      fixture.destroy();
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: originalBlob,
      });
    });

    it('exportiert lokalisierte Tabellenköpfe und Bonus-Codes im Ergebnis-CSV', async () => {
      let exportedCsv = '';
      const createObjectURLMock = vi.fn(() => 'blob:test-export');
      const revokeObjectURLMock = vi.fn();
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      const originalBlob = Blob;
      class CaptureBlob extends Blob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          exportedCsv = parts
            .map((part) => (typeof part === 'string' ? part : String(part)))
            .join('');
        }
      }
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: CaptureBlob,
      });
      getExportDataQueryMock.mockResolvedValueOnce({
        sessionId: defaultSession.id,
        sessionCode: 'ABC123',
        quizName: 'Demo Quiz',
        finishedAt: '2026-03-24T12:30:00.000Z',
        participantCount: 3,
        teamMode: false,
        questions: [
          {
            questionOrder: 0,
            questionTextShort: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            participantCount: 2,
            aggregationRound: 1,
            averageScore: null,
            confidenceResult: {
              distribution: { '1': 1, '2': 0, '3': 0, '4': 0, '5': 1 },
              crossTab: {
                correctHigh: 0,
                correctMid: 0,
                correctLow: 1,
                incorrectHigh: 1,
                incorrectMid: 0,
                incorrectLow: 0,
              },
              highConfidenceWrongCount: 1,
              highConfidenceWrongOptions: [
                { answerId: 'aaaaaaaa-1111-4111-8111-111111111111', text: '5', count: 1 },
              ],
            },
          },
        ],
        confidenceSummary: {
          responseCount: 5,
          includedQuestionCount: 1,
          suppressedQuestionCount: 0,
          priorityQuestionCount: 1,
          distribution: { '1': 1, '2': 0, '3': 0, '4': 2, '5': 2 },
          crossTab: {
            correctHigh: 2,
            correctMid: 0,
            correctLow: 1,
            incorrectHigh: 2,
            incorrectMid: 0,
            incorrectLow: 0,
          },
          highConfidenceWrongCount: 2,
          questions: [],
        },
        teamLeaderboard: [],
        bonusTokens: [
          {
            rank: 1,
            nickname: 'Ada',
            token: 'BONUS-123',
            totalScore: 220,
            generatedAt: '2026-03-24T12:31:00.000Z',
          },
        ],
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.componentInstance.exportSessionResultsCsv();
      fixture.detectChanges();

      expect(exportedCsv).toContain(
        'Frage Nr.;Fragentext;Typ;Teilnehmende;Aggregationsrunde;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Hinweis',
      );
      expect(exportedCsv).toContain(';2;"1";');
      expect(exportedCsv).toContain('selbstsicher falsch');
      expect(exportedCsv).toContain('Lernstand und Selbsteinschätzung');
      expect(exportedCsv).toContain('Gültige Antworten;Ausgewertete Fragen');
      expect(exportedCsv).toContain('Bonus-Codes');
      expect(exportedCsv).toContain('Rang;Nickname;Code;Punkte;Generiert am');
      expect(exportedCsv).toContain('1;Ada;BONUS-123;220;2026-03-24T12:31:00.000Z');

      fixture.destroy();
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: originalBlob,
      });
    });

    it('haengt Sicherheitsgrad-Details an bestehende Antwortverteilung im Ergebnis-CSV an', async () => {
      let exportedCsv = '';
      const createObjectURLMock = vi.fn(() => 'blob:test-export');
      const revokeObjectURLMock = vi.fn();
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      const originalBlob = Blob;
      class CaptureBlob extends Blob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          exportedCsv = parts
            .map((part) => (typeof part === 'string' ? part : String(part)))
            .join('');
        }
      }
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: CaptureBlob,
      });
      getExportDataQueryMock.mockResolvedValueOnce({
        sessionId: defaultSession.id,
        sessionCode: 'ABC123',
        quizName: 'Demo Quiz',
        finishedAt: '2026-03-24T12:30:00.000Z',
        participantCount: 2,
        teamMode: false,
        questions: [
          {
            questionOrder: 0,
            questionTextShort: 'Hauptstadt?',
            type: 'SINGLE_CHOICE',
            participantCount: 2,
            aggregationRound: 1,
            averageScore: 50,
            optionDistribution: [
              { text: 'Paris', count: 1, percentage: 50, isCorrect: true },
              { text: 'London', count: 1, percentage: 50, isCorrect: false },
            ],
            confidenceResult: {
              distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 },
              crossTab: {
                correctHigh: 1,
                correctMid: 0,
                correctLow: 0,
                incorrectHigh: 1,
                incorrectMid: 0,
                incorrectLow: 0,
              },
              highConfidenceWrongCount: 1,
              highConfidenceWrongOptions: [
                { answerId: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'London', count: 1 },
              ],
            },
          },
        ],
        teamLeaderboard: [],
        bonusTokens: [],
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.componentInstance.exportSessionResultsCsv();
      fixture.detectChanges();

      expect(exportedCsv).toContain('Paris: 1 (50%) ✓');
      expect(exportedCsv).toContain('Aggregationsrunde 1');
      expect(exportedCsv).toContain('selbstsicher falsch');

      fixture.destroy();
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: originalBlob,
      });
    });

    it('kennzeichnet Peer-Instruction-Runde 2 und Teilnahme-Lücken im Ergebnis-CSV', async () => {
      let exportedCsv = '';
      const createObjectURLMock = vi.fn(() => 'blob:test-export');
      const revokeObjectURLMock = vi.fn();
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      const originalBlob = Blob;
      class CaptureBlob extends Blob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          exportedCsv = parts
            .map((part) => (typeof part === 'string' ? part : String(part)))
            .join('');
        }
      }
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: CaptureBlob,
      });
      getExportDataQueryMock.mockResolvedValueOnce({
        sessionId: defaultSession.id,
        sessionCode: 'ABC123',
        quizName: 'Demo Quiz',
        finishedAt: '2026-03-24T12:30:00.000Z',
        participantCount: 3,
        teamMode: false,
        questions: [
          {
            questionOrder: 0,
            questionTextShort: 'PI-Frage',
            type: 'SINGLE_CHOICE',
            participantCount: 2,
            aggregationRound: 2,
            round1ParticipantCount: 3,
            round2ParticipantCount: 2,
            averageScore: null,
            confidenceResult: {
              distribution: { '1': 0, '2': 1, '3': 1, '4': 0, '5': 0 },
              crossTab: {
                correctHigh: 0,
                correctMid: 2,
                correctLow: 0,
                incorrectHigh: 0,
                incorrectMid: 0,
                incorrectLow: 0,
              },
              highConfidenceWrongCount: 0,
            },
          },
        ],
        teamLeaderboard: [],
        bonusTokens: [],
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.componentInstance.exportSessionResultsCsv();
      fixture.detectChanges();

      expect(exportedCsv).toContain('2 (Peer Instruction)');
      expect(exportedCsv).toContain('Runde 1: 3 Stimmen · Aggregiert: Runde 2 mit 2 Stimmen');

      fixture.destroy();
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
      Object.defineProperty(globalThis, 'Blob', {
        configurable: true,
        writable: true,
        value: originalBlob,
      });
    });

    it('verwendet für den Ergebnis-Export einen einheitlichen englischen Dateinamen', async () => {
      const createObjectURLMock = vi.fn(() => 'blob:test-export');
      const revokeObjectURLMock = vi.fn();
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement');
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      let createdAnchor: HTMLAnchorElement | null = null;
      createElementSpy.mockImplementation((tagName: string): HTMLElement => {
        const element = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          createdAnchor = element as HTMLAnchorElement;
        }
        return element as HTMLElement;
      });

      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      });
      getExportDataQueryMock.mockResolvedValueOnce({
        sessionId: defaultSession.id,
        sessionCode: 'ABC123',
        quizName: 'Demo Quiz',
        finishedAt: '2026-03-24T12:30:00.000Z',
        participantCount: 3,
        teamMode: false,
        questions: [],
        teamLeaderboard: [],
        bonusTokens: [],
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      await fixture.componentInstance.exportSessionResultsCsv();
      fixture.detectChanges();

      expect(createdAnchor?.download).toBe('arsnova-results-Demo-Quiz-ABC123.csv');

      fixture.destroy();
      anchorClickSpy.mockRestore();
      createElementSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    });

    it('schließt den Callout bei „Okay“ und führt Retry erneut aus', async () => {
      getInfoQueryMock.mockResolvedValue({
        ...defaultSession,
        type: 'Q_AND_A',
        quizName: null,
        title: 'Offene Fragen',
        status: 'LOBBY',
      });
      startQaMutateMock.mockRejectedValueOnce(new Error('first')).mockResolvedValueOnce({
        status: 'ACTIVE',
        currentQuestion: null,
        currentRound: 1,
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      const component = fixture.componentInstance;
      await component.startQa();
      fixture.detectChanges();

      expect(component.hostSteeringCallout()).not.toBeNull();

      const dismissBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (b) => (b.textContent ?? '').trim() === 'Okay',
      ) as HTMLButtonElement | undefined;
      expect(dismissBtn).toBeDefined();
      dismissBtn!.click();
      fixture.detectChanges();
      expect(component.hostSteeringCallout()).toBeNull();

      await component.startQa();
      fixture.detectChanges();
      expect(startQaMutateMock).toHaveBeenCalledTimes(2);
      expect(component.hostSteeringCallout()).toBeNull();
      fixture.destroy();
    });

    it('führt über „Nochmal probieren“ die gleiche Aktion erneut aus', async () => {
      getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
      nextQuestionMutateMock.mockRejectedValueOnce(new Error('first')).mockResolvedValueOnce({
        status: 'ACTIVE',
        currentQuestion: null,
        currentRound: 1,
        activeAt: null,
      });

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      const component = fixture.componentInstance;
      await component.nextQuestion();
      fixture.detectChanges();

      const retryBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
        (b.textContent ?? '').includes('Nochmal probieren'),
      ) as HTMLButtonElement | undefined;
      expect(retryBtn).toBeDefined();
      retryBtn!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(nextQuestionMutateMock).toHaveBeenCalledTimes(2);
      expect(component.hostSteeringCallout()).toBeNull();
      fixture.destroy();
    });

    it('bietet einen Reload-Link als Fallback an', async () => {
      getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
      nextQuestionMutateMock.mockRejectedValueOnce(new Error('first'));

      const fixture = setup();
      fixture.detectChanges();
      await fixture.whenStable();
      const component = fixture.componentInstance;
      await component.nextQuestion();
      fixture.detectChanges();

      const reloadLink = Array.from(fixture.nativeElement.querySelectorAll('a')).find((link) =>
        (link.textContent ?? '').includes('Seite neu laden'),
      ) as HTMLAnchorElement | undefined;
      expect(reloadLink).toBeDefined();
      expect(reloadLink?.getAttribute('href')).toBe(document.location.href);
      fixture.destroy();
    });
  });
});
