import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SessionPresentComponent } from './session-present.component';

const { liveQueryMock, getInfoQueryMock, getTeamLeaderboardQueryMock, qaListQueryMock, quickFeedbackResultsQueryMock } = vi.hoisted(() => ({
  liveQueryMock: vi.fn(),
  getInfoQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  quickFeedbackResultsQueryMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getInfo: {
        query: getInfoQueryMock,
      },
      getTeamLeaderboard: {
        query: getTeamLeaderboardQueryMock,
      },
      getLiveFreetext: {
        query: liveQueryMock,
      },
    },
    qa: {
      list: {
        query: qaListQueryMock,
      },
    },
    quickFeedback: {
      results: {
        query: quickFeedbackResultsQueryMock,
      },
    },
  },
}));

describe('SessionPresentComponent', () => {
  beforeEach(() => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preset: 'PLAYFUL',
    });
    getTeamLeaderboardQueryMock.mockResolvedValue([]);
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

    TestBed.configureTestingModule({
      imports: [SessionPresentComponent],
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
  });

  it('rendert die Word-Cloud in der Presenter-Ansicht mit Live-Hinweis', async () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Word-Cloud');
    expect(text).toContain('Live-Freitext');
    expect(text).toContain('Frage 2');
    fixture.destroy();
  });

  it('zeigt im Teammodus eine Siegerkarte auf der Beamer-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'FINISHED',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: true,
      preset: 'PLAYFUL',
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

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Team-Sieg');
    expect(text).toContain('Rot');
    expect(text).toContain('Team-Finale');
    expect(text).not.toContain('Noch keine aktive Frage.');
    expect(text).not.toContain('Word-Cloud');
    expect(getTeamLeaderboardQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
    fixture.destroy();
  });

  it('zeigt eine angepinnte Frage prominent in der Presenter-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preset: 'PLAYFUL',
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
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Frage aus dem Saal');
    expect(text).toContain('Wird gerade beantwortet');
    expect(text).toContain('Welche Themen sind heute besonders wichtig?');
    fixture.destroy();
  });

  it('zeigt aktive Fragen als sichtbare Q&A-Warteschlange in der Presenter-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preset: 'PLAYFUL',
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
        hasUpvoted: false,
      },
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Als Nächstes im Raum');
    expect(text).toContain('Kommt Kapitel 4 in der Klausur vor?');
    expect(text).toContain('Kannst du das Beispiel noch einmal erklären?');
    fixture.destroy();
  });

  it('zeigt laufendes Blitzlicht in der Presenter-Ansicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true },
      },
    });
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'YESNO',
      theme: 'system',
      preset: 'serious',
      locked: false,
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
    fixture.destroy();
  });
});
