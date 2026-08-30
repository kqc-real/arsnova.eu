import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SessionPresentComponent } from './session-present.component';
import { ThemePresetService } from '../../../core/theme-preset.service';

const {
  liveQueryMock,
  getInfoQueryMock,
  getLeaderboardQueryMock,
  getTeamLeaderboardQueryMock,
  getParticipantsQueryMock,
  getTeamsQueryMock,
  getParticipantNicknamesQueryMock,
  qaListQueryMock,
  quickFeedbackResultsQueryMock,
  getCurrentQuestionForHostQueryMock,
  getHostVoteProgressQueryMock,
  getReactionsQueryMock,
  subscribeMock,
} = vi.hoisted(() => ({
  liveQueryMock: vi.fn(),
  getInfoQueryMock: vi.fn(),
  getLeaderboardQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  getParticipantsQueryMock: vi.fn(),
  getTeamsQueryMock: vi.fn(),
  getParticipantNicknamesQueryMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  quickFeedbackResultsQueryMock: vi.fn(),
  getCurrentQuestionForHostQueryMock: vi.fn(),
  getHostVoteProgressQueryMock: vi.fn(),
  getReactionsQueryMock: vi.fn(),
  subscribeMock: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
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
      getParticipants: {
        query: getParticipantsQueryMock,
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
      getCurrentQuestionForHost: {
        query: getCurrentQuestionForHostQueryMock,
      },
      getHostVoteProgress: {
        query: getHostVoteProgressQueryMock,
      },
      getReactions: {
        query: getReactionsQueryMock,
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

const MOCK_SERVER_TIME = '2026-03-24T12:00:00.000Z';

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
  beforeEach(() => {
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
    getParticipantsQueryMock.mockResolvedValue({ participants: [], participantCount: 0 });
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
    subscribeMock.mockReturnValue({ unsubscribe: vi.fn() });

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
    TestBed.inject(ThemePresetService).setPreset('spielerisch', { silent: true });
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
    expect(text).toContain('Häufige Wörter aus den Antworten.');
    expect(text).not.toContain('CSV speichern');
    expect(text).not.toContain('PNG speichern');
    expect(text).not.toContain('Antwort anzeigen');
    expect(text).not.toContain('Maximieren');
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
    expect(text).toContain('Die Antworten werden als Wortwolke dargestellt.');
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
    expect(idle?.querySelector('.session-present__finish-brand-title')?.textContent?.trim()).toBe(
      'arsnova.eu',
    );
    expect(idle?.querySelector('a, button, mat-card')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Gesamtauswertung');
    expect(fixture.nativeElement.textContent).not.toContain('Zur Startseite');
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
    expect(fixture.nativeElement.querySelectorAll('.session-present__board-item').length).toBe(9);
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
    expect(items.length).toBe(24);
    expect(fixture.nativeElement.textContent).toContain('Spieler 24');
    const list = fixture.nativeElement.querySelector(
      '.session-present__board-list',
    ) as HTMLElement | null;
    expect(list?.classList.contains('session-present__board-list--overflow')).toBe(true);
    expect(list?.classList.contains('session-present__board-list--compact')).toBe(true);
    expect(list?.style.getPropertyValue('--board-cols').trim()).toBe('5');
    const finish = fixture.nativeElement.querySelector(
      '.session-present__finish',
    ) as HTMLElement | null;
    expect(finish?.querySelector('.session-present__finish-title')).toBeNull();
    expect(finish?.hasAttribute('aria-labelledby')).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Gesamtauswertung');
    fixture.destroy();
  });

  it('paginiert Leaderboards, die nicht auf eine Beamerseite passen', () => {
    expect(SessionPresentComponent.columnCountForParticipantTotal(500)).toBe(12);
    expect(SessionPresentComponent.pageSizeForParticipantTotal(24)).toBeGreaterThan(24);
    expect(SessionPresentComponent.pageSizeForParticipantTotal(500)).toBe(216);
    expect(
      SessionPresentComponent.pageSlice(
        Array.from({ length: 500 }, (_, i) => i),
        0,
      ),
    ).toHaveLength(216);
    expect(
      SessionPresentComponent.pageSlice(
        Array.from({ length: 500 }, (_, i) => i),
        2,
      ),
    ).toEqual(Array.from({ length: 68 }, (_, i) => i + 432));
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

  it('behält bei einem transienten Reconnect den letzten Presenter-Stand sichtbar', async () => {
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
      fixture.nativeElement.querySelector('[data-testid="presenter-reconnect-status"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Der letzte Stand bleibt sichtbar.');

    await fixture.componentInstance['refreshSessionMeta']();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="presenter-reconnect-status"]'),
    ).toBeNull();
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
      difficulty: 'MEDIUM',
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
      difficulty: 'MEDIUM',
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
    expect(standby?.textContent).toContain('Presenter-Ansicht');
    expect(standby?.textContent).toContain('Fragen');
    expect(standby?.textContent).toContain('Noch keine freigegebenen Fragen.');
    expect(standby?.textContent).toContain('ABC123');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-qr')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__lobby-audience')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-present__qa-stage')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="presenter-quiz-stage"]')).toBeNull();

    fixture.componentInstance.presenterQaQuestions.set([
      {
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
    fixture.componentInstance.presenterQaQuestions.set([
      {
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
    expect(text).not.toContain('Q&A-Wortwolke');
    expectNoHostControls(fixture.nativeElement as HTMLElement);
    fixture.destroy();
  });

  it('begrenzt die Q&A-Projektion auf vier kommende Fragen', () => {
    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.componentInstance.presenterQaQuestions.set(
      Array.from({ length: 6 }, (_, index) => ({
        id: `00000000-0000-4000-8000-00000000000${index}`,
        text: `Publikumsfrage ${index + 1}`,
        upvoteCount: 6 - index,
        status: 'ACTIVE' as const,
        createdAt: `2026-03-13T12:0${index}:00.000Z`,
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      })),
    );

    expect(fixture.componentInstance.visibleQaQueueQuestions()).toHaveLength(4);
    expect(fixture.componentInstance.visibleQaQueueQuestions()[3]?.text).toBe('Publikumsfrage 4');
    expect(fixture.componentInstance.qaQueueIsDense()).toBe(true);
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
    ]);

    const fixture = TestBed.createComponent(SessionPresentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Q&A-Wortwolke');
    expect(text).toContain('2 Fragen');
    expect(fixture.componentInstance.presenterQaWordCloudQuestions()).toHaveLength(2);
    expect(fixture.componentInstance.presenterQaWordCloudWeightedResponses()[0]?.weight).toBe(3);
    expect(text).not.toContain('CSV speichern');
    expect(text).not.toContain('PNG speichern');
    expect(text).not.toContain('Antwort anzeigen');
    expect(text).not.toContain('Maximieren');
    expect(text).not.toContain('Als Nächstes im Raum');
    expect(fixture.nativeElement.querySelector('.session-present__qa-list-card')).toBeNull();
    expectNoHostControls(fixture.nativeElement as HTMLElement);
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
    expect(text).toContain('Warten auf die Teilnehmenden');
    expect(text).not.toContain('Mit Code oder QR-Code teilnehmen.');
    expect(fixture.nativeElement.querySelector('.session-present__lobby-brand')).toBeTruthy();
    expect(text).not.toContain('Aktuelle Frage ist keine Freitext-Frage.');
    const motif = fixture.nativeElement.querySelector(
      '.session-present__lobby-motif',
    ) as HTMLImageElement | null;
    expect(motif?.getAttribute('src')).toBe('https://example.com/motif.jpg');
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
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
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
    expect(text).toContain('Warten auf die Teilnehmenden');
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
    expect(fixture.nativeElement.querySelector('.session-present__lobby-team--packed')).toBeNull();
    fixture.destroy();
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
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 30,
      participants,
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

    const team = fixture.nativeElement.querySelector(
      '.session-present__lobby-team',
    ) as HTMLElement | null;
    const nickTexts = [
      ...fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-text'),
    ] as HTMLElement[];
    expect(team?.classList.contains('session-present__lobby-team--crowd')).toBe(true);
    expect(team?.classList.contains('session-present__lobby-team--packed')).toBe(true);
    const members = fixture.nativeElement.querySelector(
      '.session-present__lobby-team-members',
    ) as HTMLElement | null;
    expect(members?.style.gridTemplateColumns.replace(/\s+/g, ' ').trim()).toBe(
      'repeat(4, minmax(0, 1fr))',
    );
    expect(nickTexts).toHaveLength(30);
    expect(nickTexts.every((node) => node.classList.contains('sr-only'))).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Person 1');
    expect(fixture.nativeElement.textContent).toContain('Person 30');
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
    {
      label: 'anonym',
      nicknameTheme: 'HIGH_SCHOOL' as const,
      anonymousMode: true,
      icon: 'theater_comedy',
      themeClass: 'session-present__lobby-packed-identity--anonymous',
    },
  ])(
    'zeigt im Packed-Modus fuer $label Theme-Icons mit stabilen Eingangsnummern',
    async ({ nicknameTheme, anonymousMode, icon, themeClass }) => {
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
      getParticipantsQueryMock.mockResolvedValue({
        participantCount: participants.length,
        participants,
      });
      getTeamsQueryMock.mockResolvedValue({ teamCount: 0, teams: [] });

      const fixture = TestBed.createComponent(SessionPresentComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();

      const identities = [
        ...fixture.nativeElement.querySelectorAll('.session-present__lobby-packed-identity'),
      ] as HTMLElement[];
      expect(identities).toHaveLength(participants.length);
      expect(identities.every((element) => element.classList.contains(themeClass))).toBe(true);
      expect(
        identities.map((element) =>
          (element.querySelector('.session-present__lobby-packed-icon')?.textContent ?? '').trim(),
        ),
      ).toEqual(Array.from({ length: participants.length }, () => icon));
      expect(
        identities.map((element) =>
          (
            element.querySelector('.session-present__lobby-packed-number')?.textContent ?? ''
          ).trim(),
        ),
      ).toEqual(
        Array.from({ length: participants.length }, (_, index) =>
          String(26 - index).padStart(2, '0'),
        ),
      );

      if (anonymousMode) {
        expect(identities[0]?.getAttribute('aria-label')).toBe('Anonyme Person 26');
        expect(identities.at(-1)?.getAttribute('aria-label')).toBe('Anonyme Person 01');
      } else {
        expect(identities[0]?.getAttribute('aria-label')).toBe('Person 26');
        expect(identities.at(-1)?.getAttribute('aria-label')).toBe('Person 1');
      }
      fixture.destroy();
    },
  );

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
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
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
      fixture.nativeElement.querySelectorAll('.session-present__lobby-nick-icon'),
      (el) => (el.textContent ?? '').trim(),
    );
    expect(icons).toEqual(['🐉', '🐸']);
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
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 0,
      participants: [],
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
    expect(fixture.nativeElement.textContent).toContain('Warten auf die Teilnehmenden');
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
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: null,
          teamName: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Milo',
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
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [
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

    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: null,
          teamName: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Milo',
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
    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 1,
      participants: [
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

    getParticipantsQueryMock.mockResolvedValue({
      participantCount: 2,
      participants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nickname: 'Luna',
          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamName: 'Rot',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          nickname: 'Milo',
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
});
