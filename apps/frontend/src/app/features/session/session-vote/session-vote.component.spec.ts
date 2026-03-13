import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionVoteComponent } from './session-vote.component';

const {
  getInfoQueryMock,
  statusChangedSubscribeMock,
  currentQuestionQueryMock,
  quickFeedbackResultsQueryMock,
  getParticipantsQueryMock,
  getTeamLeaderboardQueryMock,
  getPersonalResultQueryMock,
  getHasSubmittedFeedbackQueryMock,
  qaListQueryMock,
  qaSubmitMutateMock,
  qaUpvoteMutateMock,
  qaQuestionsUpdatedSubscribeMock,
  snackBarOpenMock,
} = vi.hoisted(() => ({
  getInfoQueryMock: vi.fn(),
  statusChangedSubscribeMock: vi.fn(),
  currentQuestionQueryMock: vi.fn(),
  quickFeedbackResultsQueryMock: vi.fn(),
  getParticipantsQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  getPersonalResultQueryMock: vi.fn(),
  getHasSubmittedFeedbackQueryMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  qaSubmitMutateMock: vi.fn(),
  qaUpvoteMutateMock: vi.fn(),
  qaQuestionsUpdatedSubscribeMock: vi.fn(),
  snackBarOpenMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getInfo: { query: getInfoQueryMock },
      onStatusChanged: { subscribe: statusChangedSubscribeMock },
      getCurrentQuestionForStudent: { query: currentQuestionQueryMock },
      getParticipants: { query: getParticipantsQueryMock },
      getTeamLeaderboard: { query: getTeamLeaderboardQueryMock },
      getPersonalResult: { query: getPersonalResultQueryMock },
      getHasSubmittedFeedback: { query: getHasSubmittedFeedbackQueryMock },
    },
    quickFeedback: {
      results: { query: quickFeedbackResultsQueryMock },
    },
    qa: {
      list: { query: qaListQueryMock },
      submit: { mutate: qaSubmitMutateMock },
      upvote: { mutate: qaUpvoteMutateMock },
      onQuestionsUpdated: { subscribe: qaQuestionsUpdatedSubscribeMock },
    },
  },
}));

describe('SessionVoteComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('arsnova-participant-ABC123', '11111111-1111-4111-8111-111111111111');

    statusChangedSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Ada',
          teamId: '22222222-2222-4222-8222-222222222222',
          teamName: 'Rot',
        },
      ],
    });
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Rot',
        teamColor: '#1E88E5',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
      {
        rank: 2,
        teamName: 'Blau',
        teamColor: '#43A047',
        totalScore: 190,
        memberCount: 3,
        averageScore: 63.3,
      },
    ]);
    getPersonalResultQueryMock.mockResolvedValue({
      totalScore: 120,
      rank: 2,
      bonusToken: null,
    });
    getHasSubmittedFeedbackQueryMock.mockResolvedValue({ submitted: false });
    quickFeedbackResultsQueryMock.mockRejectedValue(new Error('not found'));
    qaListQueryMock.mockResolvedValue([]);
    qaSubmitMutateMock.mockResolvedValue({});
    qaUpvoteMutateMock.mockResolvedValue({});
    qaQuestionsUpdatedSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });

    TestBed.configureTestingModule({
      imports: [SessionVoteComponent],
      providers: [
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
        {
          provide: MatSnackBar,
          useValue: {
            open: snackBarOpenMock,
          },
        },
      ],
    });
  });

  it('zeigt im Ergebnisflow den Team-Fortschritt mit eigener Hervorhebung', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      teamMode: true,
      enableRewardEffects: true,
      preset: 'PLAYFUL',
      enableEmojiReactions: false,
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 1,
      text: 'Welche Antwort stimmt?',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'a1', text: 'Rot', isCorrect: true },
        { id: 'a2', text: 'Blau', isCorrect: false },
      ],
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Dein Team');
    expect(text).toContain('Rot');
    expect(text).toContain('Team-Punkte');
    expect(getTeamLeaderboardQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
    fixture.destroy();
  });

  it('zeigt nach Session-Ende den kollektiven Team-Abschluss', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      teamMode: true,
      enableRewardEffects: true,
      preset: 'PLAYFUL',
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Session beendet');
    expect(text).toContain('Dein Team');
    expect(text).toContain('Rot gewinnt das Teamduell');
    expect(text).toContain('Teamrang');
    fixture.destroy();
  });

  it('zeigt bei aktiver Q&A-Session einen neutralen Wartezustand', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'Q_AND_A',
      status: 'ACTIVE',
      quizName: null,
      title: 'Offene Fragen',
      participantCount: 6,
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Fragerunde läuft');
    expect(text).toContain('Neue Inhalte erscheinen hier automatisch.');
    fixture.destroy();
  });

  it('zeigt Kanal-Tabs für Quiz, Fragen und Blitz-Feedback', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen aus dem Saal', moderationMode: false },
        quickFeedback: { enabled: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quiz');
    expect(text).toContain('Fragen');
    expect(text).toContain('Blitz-Feedback');
    fixture.destroy();
  });

  it('zeigt im Blitz-Feedback-Tab den laufenden Rundenzustand', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 12,
      distribution: { POSITIVE: 5, NEUTRAL: 4, NEGATIVE: 3 },
      currentRound: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Blitz-Feedback');
    expect(text).toContain('R2');
    fixture.destroy();
  });

  it('sendet im Fragen-Tab eine neue Frage', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen aus dem Saal', moderationMode: false },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: 'question-1',
        text: 'Was ist klausurrelevant?',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    component.updateQaDraft('Kommt Aufgabe 3 in der Klausur vor?');
    fixture.detectChanges();
    await component.submitQaQuestion();

    expect(qaSubmitMutateMock).toHaveBeenCalledWith({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '11111111-1111-4111-8111-111111111111',
      text: 'Kommt Aufgabe 3 in der Klausur vor?',
    });
    fixture.destroy();
  });
});
