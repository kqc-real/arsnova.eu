import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  getLeaderboardQueryMock,
  getTeamLeaderboardQueryMock,
  getExportDataQueryMock,
  qaListQueryMock,
  qaModerateMutateMock,
  qaToggleModerationMutateMock,
  qaOnQuestionsUpdatedSubscribeMock,
  nextQuestionMutateMock,
  startQaMutateMock,
  attachQuizToSessionMutateMock,
  enableQaChannelMutateMock,
  enableQuickFeedbackChannelMutateMock,
  closeQaChannelMutateMock,
  reopenQaChannelMutateMock,
  closeQuickFeedbackChannelMutateMock,
  reopenQuickFeedbackChannelMutateMock,
  endMutateMock,
  updatePresetMutateMock,
  quickFeedbackHostResultsQueryMock,
  quickFeedbackUpdateStyleMutateMock,
  updateQaTitleMutateMock,
  quizUploadMutateMock,
  onParticipantJoinedSubscribeMock,
  onStatusChangedSubscribeMock,
  clearHostTokenMock,
  dialogOpenMock,
} = vi.hoisted(() => ({
  healthCheckQueryMock: vi.fn(),
  getInfoQueryMock: vi.fn(),
  getParticipantsQueryMock: vi.fn(),
  getTeamsQueryMock: vi.fn(),
  getLiveFreetextQueryMock: vi.fn(),
  getCurrentQuestionForHostQueryMock: vi.fn(),
  getLeaderboardQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  getExportDataQueryMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  qaModerateMutateMock: vi.fn(),
  qaToggleModerationMutateMock: vi.fn(),
  qaOnQuestionsUpdatedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  nextQuestionMutateMock: vi.fn(),
  startQaMutateMock: vi.fn(),
  attachQuizToSessionMutateMock: vi.fn(),
  enableQaChannelMutateMock: vi.fn(),
  enableQuickFeedbackChannelMutateMock: vi.fn(),
  closeQaChannelMutateMock: vi.fn(),
  reopenQaChannelMutateMock: vi.fn(),
  closeQuickFeedbackChannelMutateMock: vi.fn(),
  reopenQuickFeedbackChannelMutateMock: vi.fn(),
  endMutateMock: vi.fn(),
  updatePresetMutateMock: vi.fn(),
  quickFeedbackHostResultsQueryMock: vi.fn(),
  quickFeedbackUpdateStyleMutateMock: vi.fn(),
  updateQaTitleMutateMock: vi.fn(),
  quizUploadMutateMock: vi.fn(),
  onParticipantJoinedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  onStatusChangedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
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
      getLeaderboard: { query: getLeaderboardQueryMock },
      getTeamLeaderboard: { query: getTeamLeaderboardQueryMock },
      getExportData: { query: getExportDataQueryMock },
      nextQuestion: { mutate: nextQuestionMutateMock },
      startQa: { mutate: startQaMutateMock },
      attachQuizToSession: { mutate: attachQuizToSessionMutateMock },
      enableQaChannel: { mutate: enableQaChannelMutateMock },
      enableQuickFeedbackChannel: { mutate: enableQuickFeedbackChannelMutateMock },
      closeQaChannel: { mutate: closeQaChannelMutateMock },
      reopenQaChannel: { mutate: reopenQaChannelMutateMock },
      closeQuickFeedbackChannel: { mutate: closeQuickFeedbackChannelMutateMock },
      reopenQuickFeedbackChannel: { mutate: reopenQuickFeedbackChannelMutateMock },
      end: { mutate: endMutateMock },
      updatePreset: { mutate: updatePresetMutateMock },
      updateQaTitle: { mutate: updateQaTitleMutateMock },
      onParticipantJoined: { subscribe: onParticipantJoinedSubscribeMock },
      onStatusChanged: { subscribe: onStatusChangedSubscribeMock },
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
      updateStyle: { mutate: quickFeedbackUpdateStyleMutateMock },
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

describe('SessionHostComponent', () => {
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
    getTeamsQueryMock.mockResolvedValue({ teams: [], teamCount: 0 });
    getLiveFreetextQueryMock.mockResolvedValue({ ...defaultLiveFreetext });
    getCurrentQuestionForHostQueryMock.mockResolvedValue(null);
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
    endMutateMock.mockResolvedValue({
      status: 'FINISHED',
      currentQuestion: null,
      activeAt: null,
    });
    updatePresetMutateMock.mockResolvedValue({
      code: 'ABC123',
      preset: 'SERIOUS',
    });
    quickFeedbackUpdateStyleMutateMock.mockResolvedValue({});
    updateQaTitleMutateMock.mockResolvedValue({
      title: 'Titel',
      qaTitle: 'Titel',
    });
    qaToggleModerationMutateMock.mockResolvedValue({ enabled: true });
    dialogOpenMock.mockReturnValue({ afterClosed: () => of(true) });
    getExportDataQueryMock.mockResolvedValue({
      sessionCode: 'ABC123',
      questions: [],
      bonusTokens: [],
    });
  });

  const setup = () => {
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
      ],
    });
    return TestBed.createComponent(SessionHostComponent);
  };

  it('zeigt Lobby mit Session-Code und Button Erste Frage starten bei Status LOBBY', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('ABC123');
    expect(text).toContain('Erste Frage starten');
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
      { sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad', moderatorView: true },
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
    expect(updatePresetMutateMock).toHaveBeenCalledWith({ code: 'ABC123', preset: 'SERIOUS' });
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
    updatePresetMutateMock.mockClear();

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
    expect(updatePresetMutateMock).toHaveBeenCalledWith({ code: 'ABC123', preset: 'SERIOUS' });
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
      () => (fixture.nativeElement.textContent ?? '').includes('Word Cloud anzeigen'),
      {
        timeout: 5000,
        interval: 25,
      },
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Word Cloud anzeigen');
    expect(text).not.toContain('Weitere Aktionen');
    expect(text).toContain('2 Antworten');
    expect(text).toContain('Live-Freitext wird aktualisiert.');
    expect(text).toContain('Live-Freitext');
    expect(text).toContain('Antworten verdichten sich live zu einem gemeinsamen Themenbild.');
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

    let text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Q&A-Word-Cloud anzeigen');
    expect(text).toContain('2 Fragen');
    expect(fixture.componentInstance.qaWordCloudQuestions()).toHaveLength(2);
    expect(fixture.componentInstance.qaWordCloudWeightedResponses()[0]?.weight).toBe(10);

    fixture.componentInstance.qaWordCloudExpanded.set(true);
    fixture.detectChanges();

    text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Q&A-Word-Cloud ausblenden');
    expect(text).toContain('Q&A-Word-Cloud (Upvotes gewichtet)');
    expect(text).toContain('Publikumsfragen');
    expect(text).toContain('Größere Begriffe verbinden Häufigkeit und Upvotes.');
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
    expect(text).toContain('Q&A-Word-Cloud anzeigen');
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

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

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Peer Instruction empfohlen');
    expect(text).toMatch(/35\s*[–-]\s*70/);
    expect(text).toContain('Ergebnis trotzdem zeigen');
    expect(text).toContain('Diskussionsphase');
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

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
    await new Promise((r) => setTimeout(r, 25));

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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const exitAnchor = fixture.nativeElement.querySelector(
      '.session-host__exit-anchor',
    ) as HTMLElement;
    const buttonTexts = Array.from(exitAnchor.querySelectorAll('button'), (button) =>
      (button.textContent ?? '').trim(),
    );

    expect(exitAnchor.className).toContain('session-host__exit-anchor--with-primary');
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent ?? '').toContain('0 von 0 komplett richtig');
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
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

  it('ruft onParticipantJoined und onStatusChanged subscribe auf', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'LOBBY' });
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    expect(onParticipantJoinedSubscribeMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function) }),
    );
    expect(onStatusChangedSubscribeMock).toHaveBeenCalledWith(
      { code: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function) }),
    );
    fixture.destroy();
    expect(unsubscribeMock).toHaveBeenCalledTimes(2);
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
      },
    ]);
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Team A',
        teamColor: '#1E88E5',
        totalScore: 220,
        memberCount: 3,
        averageScore: 73.33,
      },
    ]);

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Zur Startseite');
    expect(text).toContain('Team-Leaderboard');
    expect(text).toContain('Team A');
    expect(getTeamLeaderboardQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
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
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Warten auf die anderen...');
    expect(text).toContain('Rot');
    expect(text).toContain('Blau');
    expect(text).toContain('Ada');
    expect(text).toContain('Grace');
    fixture.destroy();
  });

  describe('Host-Steering-Callout bei Störfällen', () => {
    const steeringTitle = 'Das ist gerade nicht angekommen';
    const qaCalloutTitle = 'Mit den Fragen klappt es gerade nicht';
    const exportCalloutTitle = 'Die Tabelle war noch nicht bereit';

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
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 50));

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
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();

      expect(qaListQueryMock).toHaveBeenCalledWith({
        sessionId: defaultSession.id,
        moderatorView: true,
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
  });
});
