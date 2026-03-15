import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionHostComponent } from './session-host.component';

const unsubscribeMock = vi.fn();

const {
  getInfoQueryMock,
  getParticipantsQueryMock,
  getTeamsQueryMock,
  getLiveFreetextQueryMock,
  getCurrentQuestionForHostQueryMock,
  getLeaderboardQueryMock,
  getTeamLeaderboardQueryMock,
  qaListQueryMock,
  qaModerateMutateMock,
  qaOnQuestionsUpdatedSubscribeMock,
  startQaMutateMock,
  onParticipantJoinedSubscribeMock,
  onStatusChangedSubscribeMock,
} = vi.hoisted(() => ({
  getInfoQueryMock: vi.fn(),
  getParticipantsQueryMock: vi.fn(),
  getTeamsQueryMock: vi.fn(),
  getLiveFreetextQueryMock: vi.fn(),
  getCurrentQuestionForHostQueryMock: vi.fn(),
  getLeaderboardQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  qaModerateMutateMock: vi.fn(),
  qaOnQuestionsUpdatedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  startQaMutateMock: vi.fn(),
  onParticipantJoinedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
  onStatusChangedSubscribeMock: vi.fn(() => ({ unsubscribe: unsubscribeMock })),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getInfo: { query: getInfoQueryMock },
      getParticipants: { query: getParticipantsQueryMock },
      getTeams: { query: getTeamsQueryMock },
      getLiveFreetext: { query: getLiveFreetextQueryMock },
      getCurrentQuestionForHost: { query: getCurrentQuestionForHostQueryMock },
      getLeaderboard: { query: getLeaderboardQueryMock },
      getTeamLeaderboard: { query: getTeamLeaderboardQueryMock },
      startQa: { mutate: startQaMutateMock },
      onParticipantJoined: { subscribe: onParticipantJoinedSubscribeMock },
      onStatusChanged: { subscribe: onStatusChangedSubscribeMock },
    },
    qa: {
      list: { query: qaListQueryMock },
      moderate: { mutate: qaModerateMutateMock },
      onQuestionsUpdated: { subscribe: qaOnQuestionsUpdatedSubscribeMock },
    },
  },
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,placeholder') },
}));

const defaultSession = {
  id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
  code: 'ABC123',
  type: 'QUIZ' as const,
  status: 'LOBBY' as const,
  quizName: 'Demo Quiz',
  title: null,
  participantCount: 0,
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

describe('SessionHostComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribeMock.mockClear();
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
    startQaMutateMock.mockResolvedValue({ status: 'ACTIVE', currentQuestion: null, currentRound: 1 });
  });

  const setup = () => {
    TestBed.configureTestingModule({
      imports: [SessionHostComponent],
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
        qa: { enabled: true, title: 'Fragen aus dem Saal', moderationMode: false },
        quickFeedback: { enabled: true },
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

  it('führt im Fragen-Tab eine Moderationsaktion aus', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen aus dem Saal', moderationMode: true },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Was ist klausurrelevant?',
        upvoteCount: 3,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
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
        qa: { enabled: true, title: 'Fragen aus dem Saal', moderationMode: true },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Ist das klausurrelevant?',
        upvoteCount: 1,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
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
        qa: { enabled: true, title: 'Fragen aus dem Saal', moderationMode: true },
        quickFeedback: { enabled: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'Was kommt in der Klausur dran?',
        upvoteCount: 2,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
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
    onStatusChangedSubscribeMock.mockImplementation((_input: unknown, opts: { onData: (d: unknown) => void }) => {
      opts.onData({ status: 'ACTIVE', currentQuestion: 0 });
      return { unsubscribe: unsubscribeMock };
    });
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
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Was ist 2+2?');
    expect(text).toContain('Ergebnis zeigen');
    expect(getCurrentQuestionForHostQueryMock).toHaveBeenCalled();
    fixture.destroy();
  });

  it('zeigt in QUESTION_OPEN Fragentext und deutlichen Lesephase-Hinweis', async () => {
    getInfoQueryMock.mockResolvedValue({ ...defaultSession, status: 'QUESTION_OPEN' });
    onStatusChangedSubscribeMock.mockImplementation((_input: unknown, opts: { onData: (d: unknown) => void }) => {
      opts.onData({ status: 'QUESTION_OPEN', currentQuestion: 0 });
      return { unsubscribe: unsubscribeMock };
    });
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
    expect(el.textContent).toContain('Antworten freigeben');
    expect(el.querySelector('.session-host__answers')).toBeNull();
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
    onStatusChangedSubscribeMock.mockImplementation((_input: unknown, opts: { onData: (d: unknown) => void }) => {
      opts.onData({ status: 'FINISHED', currentQuestion: null });
      return { unsubscribe: unsubscribeMock };
    });
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
    onParticipantJoinedSubscribeMock.mockImplementation((_input: unknown, opts: { onData: (d: unknown) => void }) => {
      opts.onData({
        participantCount: 3,
        participants: [
          { id: 'p1', nickname: 'Ada', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p2', nickname: 'Linus', teamId: 'team-a', teamName: 'Rot' },
          { id: 'p3', nickname: 'Grace', teamId: 'team-b', teamName: 'Blau' },
        ],
      });
      return { unsubscribe: unsubscribeMock };
    });

    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Teams in der Lobby');
    expect(text).toContain('Rot');
    expect(text).toContain('Blau');
    expect(text).toContain('Ada');
    expect(text).toContain('Grace');
    fixture.destroy();
  });
});
