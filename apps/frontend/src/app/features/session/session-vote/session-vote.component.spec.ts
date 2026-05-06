import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { QaQuestionDTO } from '@arsnova/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  anchorCandidatesForPhase,
  focusTargetIdForAnchor,
  SessionVoteComponent,
} from './session-vote.component';
import * as vpc from './session-vote-participant-copy';
import {
  hasParticipantJoinArrival,
  setParticipantJoinArrival,
} from '../../../core/participant-join-arrival';

const {
  getInfoQueryMock,
  statusChangedSubscribeMock,
  currentQuestionQueryMock,
  confirmReadingReadyMutateMock,
  quickFeedbackResultsQueryMock,
  quickFeedbackOnResultsSubscribeMock,
  getParticipantSelfQueryMock,
  getTeamsQueryMock,
  getTeamLeaderboardQueryMock,
  getPersonalResultQueryMock,
  getHasSubmittedFeedbackQueryMock,
  getSessionFeedbackSummaryQueryMock,
  submitSessionFeedbackMutateMock,
  qaListQueryMock,
  qaSubmitMutateMock,
  qaUpvoteMutateMock,
  qaQuestionsUpdatedSubscribeMock,
  snackBarOpenMock,
} = vi.hoisted(() => ({
  getInfoQueryMock: vi.fn(),
  statusChangedSubscribeMock: vi.fn(),
  currentQuestionQueryMock: vi.fn(),
  confirmReadingReadyMutateMock: vi.fn(),
  quickFeedbackResultsQueryMock: vi.fn(),
  quickFeedbackOnResultsSubscribeMock: vi.fn(),
  getParticipantSelfQueryMock: vi.fn(),
  getTeamsQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  getPersonalResultQueryMock: vi.fn(),
  getHasSubmittedFeedbackQueryMock: vi.fn(),
  getSessionFeedbackSummaryQueryMock: vi.fn(),
  submitSessionFeedbackMutateMock: vi.fn(),
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
      confirmReadingReady: { mutate: confirmReadingReadyMutateMock },
      getParticipantSelf: { query: getParticipantSelfQueryMock },
      getTeams: { query: getTeamsQueryMock },
      getTeamLeaderboard: { query: getTeamLeaderboardQueryMock },
      getPersonalResult: { query: getPersonalResultQueryMock },
      getHasSubmittedFeedback: { query: getHasSubmittedFeedbackQueryMock },
      getSessionFeedbackSummary: { query: getSessionFeedbackSummaryQueryMock },
      submitSessionFeedback: { mutate: submitSessionFeedbackMutateMock },
    },
    quickFeedback: {
      results: { query: quickFeedbackResultsQueryMock },
      onResults: { subscribe: quickFeedbackOnResultsSubscribeMock },
    },
    qa: {
      list: { query: qaListQueryMock },
      submit: { mutate: qaSubmitMutateMock },
      upvote: { mutate: qaUpvoteMutateMock },
      onQuestionsUpdated: { subscribe: qaQuestionsUpdatedSubscribeMock },
    },
  },
}));

const MOCK_SERVER_TIME = '2026-03-24T12:00:00.000Z';

describe('SessionVoteComponent', () => {
  it('liefert phasenabhängige Einsprung-Anker mit korrekten Fallbacks', () => {
    expect(anchorCandidatesForPhase('read', false)).toEqual([
      'vote-question-anchor',
      'vote-options-start',
      'vote-top',
    ]);
    expect(anchorCandidatesForPhase('vote', true)).toEqual([
      'vote-option-0',
      'vote-options-start',
      'vote-question-anchor',
      'vote-top',
    ]);
    expect(anchorCandidatesForPhase('vote', true, true)).toEqual([
      'vote-question-anchor',
      'vote-options-start',
      'vote-option-0',
      'vote-top',
    ]);
    expect(anchorCandidatesForPhase('vote', false)).toEqual([
      'vote-question-anchor',
      'vote-options-start',
      'vote-option-0',
      'vote-top',
    ]);
    expect(anchorCandidatesForPhase('result', false)).toEqual([
      'vote-result-message',
      'vote-result-score',
      'vote-result-anchor',
      'vote-top',
      'vote-error',
    ]);
  });

  it('fokussiert im Abstimmungsflow keine Antwortoption als Scrollziel', () => {
    expect(focusTargetIdForAnchor('vote-option-0')).toBe('vote-question-anchor');
    expect(focusTargetIdForAnchor('vote-options-start')).toBe('vote-question-anchor');
    expect(focusTargetIdForAnchor('vote-result-message')).toBe('vote-result-message');
  });

  it('verwendet die aktualisierte Participant-Copy für Bonus, Singular und Frage', () => {
    expect(vpc.voteBonusTitle(true)).toBe('Dein Bonus-Code');
    expect(vpc.voteFeedbackDoneCount(true, 1)).toBe('1 Stimme insgesamt');
    expect(vpc.voteFeedbackDoneCount(true, 3)).toBe('3 Stimmen insgesamt');
    expect(vpc.voteQuestionLabel(true, 2)).toBe('Frage 2');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('arsnova-participant-ABC123', '11111111-1111-4111-8111-111111111111');
    localStorage.removeItem('arsnova-nickname-ABC123');
    sessionStorage.clear();

    statusChangedSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
    getParticipantSelfQueryMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Ada',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: 'Rot',
    });
    getTeamsQueryMock.mockResolvedValue({ teams: [], teamCount: 0 });
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
    getSessionFeedbackSummaryQueryMock.mockResolvedValue({
      totalResponses: 0,
      overallAverage: 0,
      overallDistribution: {},
      questionQualityAverage: null,
      questionQualityDistribution: null,
      wouldRepeatYes: 0,
      wouldRepeatNo: 0,
    });
    submitSessionFeedbackMutateMock.mockResolvedValue({ success: true });
    quickFeedbackResultsQueryMock.mockRejectedValue(new Error('not found'));
    quickFeedbackOnResultsSubscribeMock.mockReturnValue({ unsubscribe: vi.fn() });
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

  it('zeigt in der Lesephase die Bereitschafts-CTA und bestätigt sie für den aktuellen Teilnehmenden', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: 'session-1',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'QUESTION_OPEN',
      serverTime: MOCK_SERVER_TIME,
      quizName: 'Demo Quiz',
      title: null,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
      participantCount: 2,
      teamMode: false,
      anonymousMode: false,
      nicknameTheme: 'HIGH_SCHOOL',
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      text: 'Lies zuerst die Frage.',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      order: 0,
      participantReady: false,
    });
    confirmReadingReadyMutateMock.mockResolvedValue({
      connectedCount: 1,
      readyCount: 1,
      allConnectedReady: true,
      participantReady: true,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    let button: HTMLButtonElement | null = null;
    for (let attempt = 0; attempt < 10 && !button; attempt += 1) {
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 50));
      fixture.detectChanges();
      button = (fixture.nativeElement as HTMLElement).querySelector('.vote-reading-banner__cta');
    }
    expect(button).toBeTruthy();

    button?.click();
    let textContent = '';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 50));
      fixture.detectChanges();
      textContent = (fixture.nativeElement as HTMLElement).textContent ?? '';
      if (
        textContent.includes('Du bist als bereit markiert') ||
        textContent.includes('Bereit bestätigt')
      ) {
        break;
      }
    }

    expect(currentQuestionQueryMock).toHaveBeenCalledWith({
      code: 'ABC123',
      participantId: '11111111-1111-4111-8111-111111111111',
    });
    expect(confirmReadingReadyMutateMock).toHaveBeenCalledWith({
      code: 'ABC123',
      participantId: '11111111-1111-4111-8111-111111111111',
      questionId: 'aaaaaaaa-1111-4111-8111-111111111111',
    });
    expect(
      textContent.includes('Du bist als bereit markiert') ||
        textContent.includes('Bereit bestätigt'),
    ).toBe(true);

    fixture.destroy();
  });

  it('cacht gerendertes Markdown fuer identische Texte', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;

    const first = component.renderMarkdown('![Bild](https://example.org/test.png)');
    const second = component.renderMarkdown('![Bild](https://example.org/test.png)');

    expect(second).toBe(first);
    fixture.destroy();
  });

  it('markiert fuehrende Emojis in Antworttexten fuer ein kompakteres Live-Layout', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;

    const rendered = component.renderMarkdown('😄 Bereit loszulegen') as unknown as {
      changingThisBreaksApplicationSecurity?: string;
    };

    expect(rendered.changingThisBreaksApplicationSecurity).toContain('answer-leading-emoji');
    expect(rendered.changingThisBreaksApplicationSecurity).toContain('Bereit loszulegen');
    fixture.destroy();
  });

  it('baut QR-Join-Links unter einem localized production base href', () => {
    const base = document.createElement('base');
    base.setAttribute('href', '/fr/');
    document.head.prepend(base);

    try {
      const fixture = TestBed.createComponent(SessionVoteComponent);
      expect(fixture.componentInstance.joinUrl).toBe(
        `${window.location.origin}/fr/join/ABC123?join=ABC123`,
      );
      fixture.destroy();
    } finally {
      base.remove();
    }
  });

  it('zeigt im Ergebnisflow den Team-Fortschritt mit eigener Hervorhebung', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
    // ngOnInit → loadSessionInfo (inkl. getTeams) läuft asynchron; ohne Warten kann
    // loadTeamRewardState zu früh teamMode=false sehen und die Leaderboard-Signale leeren (CI-Flake).
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        const inst = fixture.componentInstance;
        expect(inst.status()).toBe('RESULTS');
        expect(inst.sessionSettings().teamMode).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    // refreshQuestion wird erst beim Polling (alle 2s) aufgerufen – manuell auslösen
    await (
      fixture.componentInstance as unknown as { refreshQuestion: () => Promise<void> }
    ).refreshQuestion();
    await (
      fixture.componentInstance as unknown as { loadTeamRewardState: () => Promise<void> }
    ).loadTeamRewardState();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Euer Team');
    expect(text).toContain('Rot');
    expect(text).toContain('Team-Punkte');
    expect(text).toContain('3 Mitglieder');
    expect(text).toContain('∅');
    expect(getTeamLeaderboardQueryMock).toHaveBeenCalledWith({ code: 'ABC123' });
    fixture.destroy();
  });

  it('zeigt im Client Fragetyp und Schwierigkeit an', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Quiz',
      title: null,
      participantCount: 3,
      teamMode: false,
      enableRewardEffects: true,
      preset: 'PLAYFUL',
      enableEmojiReactions: false,
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 0,
      totalQuestions: 3,
      text: 'Welche Antwort stimmt?',
      type: 'SINGLE_CHOICE',
      difficulty: 'HARD',
      answers: [
        { id: 'a1', text: 'Rot' },
        { id: 'a2', text: 'Blau' },
      ],
      activeAt: MOCK_SERVER_TIME,
      participantCount: 3,
      totalVotes: 0,
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.status()).toBe('ACTIVE');
      },
      { timeout: 5000, interval: 10 },
    );

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Single Choice');
    expect(text).toContain('Schwer');
    fixture.destroy();
  });

  it('zeigt Teamnamen mit fuehrendem Emoji ohne Farbpunkte im Vote-Client', async () => {
    getParticipantSelfQueryMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Ada',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: '🍎 Rot',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: '🍎 Rot',
          color: '#1E88E5',
          memberCount: 3,
        },
      ],
    });
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: '🍎 Rot',
        teamColor: '#1E88E5',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
    ]);
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.status()).toBe('RESULTS');
        expect(fixture.componentInstance.sessionSettings().teamMode).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    await (
      fixture.componentInstance as unknown as { refreshQuestion: () => Promise<void> }
    ).refreshQuestion();
    await (
      fixture.componentInstance as unknown as { loadTeamRewardState: () => Promise<void> }
    ).loadTeamRewardState();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent ?? '').toContain('Rot');
    expect(host.querySelector('.vote-player-badge__team-dot')).toBeNull();
    expect(host.querySelector('.vote-team-reward__dot')).toBeNull();
    expect(host.querySelector('.vote-player-badge__team-emoji')?.textContent).toBe('🍎');
    expect(host.querySelector('.vote-team-reward__emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('zeigt Teamnamen mit fuehrendem Emoji-Shortcode ohne Farbpunkte im Vote-Client', async () => {
    getParticipantSelfQueryMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Ada',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: ':apple: Rot',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: ':apple: Rot',
          color: '#1E88E5',
          memberCount: 3,
        },
      ],
    });
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: ':apple: Rot',
        teamColor: '#1E88E5',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
    ]);
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.status()).toBe('RESULTS');
        expect(fixture.componentInstance.sessionSettings().teamMode).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    await (
      fixture.componentInstance as unknown as { refreshQuestion: () => Promise<void> }
    ).refreshQuestion();
    await (
      fixture.componentInstance as unknown as { loadTeamRewardState: () => Promise<void> }
    ).loadTeamRewardState();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent ?? '').toContain('Rot');
    expect(host.querySelector('.vote-player-badge__team-dot')).toBeNull();
    expect(host.querySelector('.vote-team-reward__dot')).toBeNull();
    expect(host.querySelector('.vote-player-badge__team-emoji')?.textContent).toBe('🍎');
    expect(host.querySelector('.vote-team-reward__emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('zeigt bei emoji-only Teamnamen einen generischen Team-Text im Vote-Client', async () => {
    getParticipantSelfQueryMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Ada',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: ':apple:',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: ':apple:',
          color: '#1E88E5',
          memberCount: 3,
        },
      ],
    });
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: ':apple:',
        teamColor: '#1E88E5',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
    ]);
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.status()).toBe('RESULTS');
        expect(fixture.componentInstance.sessionSettings().teamMode).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    await (
      fixture.componentInstance as unknown as { refreshQuestion: () => Promise<void> }
    ).refreshQuestion();
    await (
      fixture.componentInstance as unknown as { loadTeamRewardState: () => Promise<void> }
    ).loadTeamRewardState();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent ?? '').toContain('Team');
    expect(host.querySelector('.vote-player-badge__team-dot')).toBeNull();
    expect(host.querySelector('.vote-team-reward__dot')).toBeNull();
    expect(host.querySelector('.vote-player-badge__team-emoji')?.textContent).toBe('🍎');
    expect(host.querySelector('.vote-team-reward__emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('zeigt im Leader-Hinweis auch emoji-only Teambezeichnungen statt nur generischem Team', async () => {
    getParticipantSelfQueryMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Ada',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: 'Rot',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 2,
      teams: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Rot',
          color: '#1E88E5',
          memberCount: 3,
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: ':apple:',
          color: '#43A047',
          memberCount: 3,
        },
      ],
    });
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: ':apple:',
        teamColor: '#43A047',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
      {
        rank: 2,
        teamName: 'Rot',
        teamColor: '#1E88E5',
        totalScore: 200,
        memberCount: 3,
        averageScore: 67,
      },
    ]);
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.status()).toBe('RESULTS');
        expect(fixture.componentInstance.sessionSettings().teamMode).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    await (
      fixture.componentInstance as unknown as { refreshQuestion: () => Promise<void> }
    ).refreshQuestion();
    await (
      fixture.componentInstance as unknown as { loadTeamRewardState: () => Promise<void> }
    ).loadTeamRewardState();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-team-reward__hint')?.textContent).toContain(':apple:');
    fixture.destroy();
  });

  it('zeigt bei Teamnamen mit nachgestelltem Emoji keinen Farbpunk im Vote-Client', async () => {
    getParticipantSelfQueryMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      nickname: 'Ada',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: 'Team :apple:',
    });
    getTeamsQueryMock.mockResolvedValue({
      teamCount: 1,
      teams: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Team :apple:',
          color: '#1E88E5',
          memberCount: 3,
        },
      ],
    });
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Team :apple:',
        teamColor: '#1E88E5',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
    ]);
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.status()).toBe('RESULTS');
        expect(fixture.componentInstance.sessionSettings().teamMode).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    await (
      fixture.componentInstance as unknown as { refreshQuestion: () => Promise<void> }
    ).refreshQuestion();
    await (
      fixture.componentInstance as unknown as { loadTeamRewardState: () => Promise<void> }
    ).loadTeamRewardState();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-player-badge__team')?.textContent ?? '').toContain('Team');
    expect(host.querySelector('.vote-team-reward__team')?.textContent ?? '').toContain('Team');
    expect(host.querySelector('.vote-player-badge__team-dot')).toBeNull();
    expect(host.querySelector('.vote-team-reward__dot')).toBeNull();
    expect(host.querySelector('.vote-player-badge__team-emoji')?.textContent).toBe('🍎');
    expect(host.querySelector('.vote-team-reward__emoji')?.textContent).toBe('🍎');
    fixture.destroy();
  });

  it('behauptet bei 0 Team-Punkten für alle nicht „Ihr führt gerade“', async () => {
    getTeamLeaderboardQueryMock.mockResolvedValue([
      {
        rank: 1,
        teamName: 'Rot',
        teamColor: '#1E88E5',
        totalScore: 0,
        memberCount: 3,
        averageScore: 0,
      },
      {
        rank: 2,
        teamName: 'Blau',
        teamColor: '#43A047',
        totalScore: 0,
        memberCount: 3,
        averageScore: 0,
      },
    ]);
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
      text: 'Frage',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'a1', text: 'A', isCorrect: true },
        { id: 'a2', text: 'B', isCorrect: false },
      ],
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        const inst = fixture.componentInstance;
        expect(inst.status()).toBe('RESULTS');
        expect(inst.sessionSettings().teamMode).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    await (
      fixture.componentInstance as unknown as { refreshQuestion: () => Promise<void> }
    ).refreshQuestion();
    await (
      fixture.componentInstance as unknown as { loadTeamRewardState: () => Promise<void> }
    ).loadTeamRewardState();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const inst = fixture.componentInstance;
    expect(inst.teamRewardTitle()).toContain('Zeigt, was in euch steckt');
    expect(inst.teamRewardMessage()).toContain('Mit richtigen Antworten');
    expect(inst.teamRewardRankDisplay(1)).toBe('\u2014');
    expect(
      (
        fixture.nativeElement.querySelector('.vote-team-reward__board-rank') as HTMLElement | null
      )?.textContent?.trim(),
    ).toBe('');
    expect((fixture.nativeElement.textContent as string).includes('Ihr führt gerade')).toBe(false);
    fixture.destroy();
  });

  it('zeigt in RESULTS ohne eigene Antwort einen klaren Hinweis statt leerer Motivation', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const inst = fixture.componentInstance;

    inst.status.set('RESULTS');
    inst.currentQuestion.set({
      id: 'q1',
      text: 'Frage',
      type: 'SINGLE_CHOICE',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'A', isCorrect: true, voteCount: 1, votePercentage: 100 },
        { id: 'a2', text: 'B', isCorrect: false, voteCount: 0, votePercentage: 0 },
      ],
      totalVotes: 1,
    } as never);
    inst.voteSent.set(false);
    inst.timeoutMessage.set(null);

    expect(inst.unansweredResultsMessage()).toContain('Leider verpasst');
    fixture.destroy();
  });

  it('zeigt für Platz 1 im Finale eine explizite Sieger-Copy', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const inst = fixture.componentInstance;

    inst.personalResultLoaded.set(true);
    inst.personalScore.set(180);
    inst.personalRank.set(1);

    expect(inst.finishedHeroTitle()).toContain('gewonnen');
    fixture.destroy();
  });

  it('zeigt beim finalen Teamsieg eine stärkere Teamsieg-Copy', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const inst = fixture.componentInstance;

    inst.status.set('FINISHED');
    inst.participantTeam.set({ teamName: 'Rot' } as never);
    inst.teamLeaderboard.set([
      {
        rank: 1,
        teamName: 'Rot',
        teamColor: '#1E88E5',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
    ]);

    expect(inst.teamRewardTitle()).toBe('Finaler Score');
    expect(inst.teamRewardEyebrow()).toBeNull();
    expect(inst.teamRewardMessage()).toContain('Platz 1');
    fixture.destroy();
  });

  it('zeigt im Ergebnis der letzten Frage bereits den finalen Score-Titel', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const inst = fixture.componentInstance;

    inst.status.set('RESULTS');
    inst.participantTeam.set({ teamName: 'Rot' } as never);
    inst.teamLeaderboard.set([
      {
        rank: 1,
        teamName: 'Rot',
        teamColor: '#1E88E5',
        totalScore: 240,
        memberCount: 3,
        averageScore: 80,
      },
    ]);
    inst.currentQuestion.set({
      id: 'q1',
      text: 'Frage',
      type: 'SINGLE_CHOICE',
      order: 2,
      totalQuestions: 3,
      answers: [],
      totalVotes: 3,
    } as never);

    expect(inst.teamRewardTitle()).toBe('Finaler Score');
    expect(inst.teamRewardEyebrow()).toBeNull();
    fixture.destroy();
  });

  it('übernimmt bei ACTIVE → RESULTS die aufgelösten Antworten (isCorrect), statt die Student-Liste zu behalten', async () => {
    const qid = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    const studentQ = {
      id: qid,
      text: 'Test?',
      type: 'SINGLE_CHOICE' as const,
      timer: 60,
      difficulty: 'MEDIUM' as const,
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'Ja' },
        { id: 'a2', text: 'Nein' },
      ],
      activeAt: MOCK_SERVER_TIME,
      participantCount: 2,
      totalVotes: 1,
      currentRound: 1,
    };
    const revealedQ = {
      id: qid,
      text: 'Test?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'Ja', isCorrect: true, voteCount: 1, votePercentage: 100 },
        { id: 'a2', text: 'Nein', isCorrect: false, voteCount: 0, votePercentage: 0 },
      ],
      totalVotes: 1,
    };

    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Q',
      title: null,
      participantCount: 2,
      teamMode: false,
      enableRewardEffects: false,
      preset: 'SERIOUS',
      enableEmojiReactions: false,
    });
    currentQuestionQueryMock.mockResolvedValue(studentQ);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.currentQuestion()).not.toBeNull();
      },
      { timeout: 3000, interval: 10 },
    );

    const inst = fixture.componentInstance;
    const firstAfterActive = (
      inst.currentQuestion() as { answers?: Array<{ isCorrect?: boolean }> } | null
    )?.answers?.[0];
    expect(firstAfterActive?.isCorrect).toBeUndefined();

    currentQuestionQueryMock.mockResolvedValue(revealedQ);
    inst.status.set('RESULTS');
    await (inst as unknown as { refreshQuestion: () => Promise<void> }).refreshQuestion();
    fixture.detectChanges();

    const firstAfterResults = (
      inst.currentQuestion() as { answers?: Array<{ isCorrect: boolean }> } | null
    )?.answers?.[0] as { isCorrect: boolean };
    expect(firstAfterResults.isCorrect).toBe(true);
    fixture.destroy();
  });

  it('markiert Umfrage-Antworten in der Ergebnisansicht nicht als falsch', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Q',
      title: null,
      participantCount: 2,
      teamMode: false,
      enableRewardEffects: false,
      preset: 'SERIOUS',
      enableEmojiReactions: false,
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      text: 'Wie fandest du das?',
      type: 'SURVEY',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'Gut', isCorrect: false, voteCount: 1, votePercentage: 100 },
        { id: 'a2', text: 'Nicht so gut', isCorrect: false, voteCount: 0, votePercentage: 0 },
      ],
      totalVotes: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    const component = fixture.componentInstance;
    component.selectedAnswerIds.set(new Set(['a1']));
    component.voteSent.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.vote-answer--result-selected')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.vote-answer--wrong')).toBeNull();
    expect(fixture.nativeElement.querySelector('.vote-answer__icon--wrong')).toBeNull();
    expect(fixture.nativeElement.querySelector('.vote-answer__icon--correct')).toBeNull();
    expect(fixture.nativeElement.querySelector('.vote-motivation')).toBeNull();
    fixture.destroy();
  });

  it('stellt eigene Umfrage-Antworten aus lokalem Speicher in RESULTS wieder her', async () => {
    const questionId = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
    localStorage.setItem(
      `arsnova-vote-response-ABC123-11111111-1111-4111-8111-111111111111-${questionId}-1`,
      JSON.stringify({
        answerIds: ['a1'],
        sent: true,
        updatedAt: '2026-04-23T06:00:00.000Z',
      }),
    );
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Q',
      title: null,
      participantCount: 2,
      teamMode: false,
      enableRewardEffects: false,
      preset: 'SERIOUS',
      enableEmojiReactions: false,
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: questionId,
      text: 'Wie fandest du das?',
      type: 'SURVEY',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'Gut', isCorrect: false, voteCount: 1, votePercentage: 100 },
        { id: 'a2', text: 'Nicht so gut', isCorrect: false, voteCount: 0, votePercentage: 0 },
      ],
      totalVotes: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.voteSent()).toBe(true);
    expect(fixture.nativeElement.querySelector('.vote-answer--result-selected')).not.toBeNull();
    fixture.destroy();
  });

  it('leitet nach Session-Ende (FINISHED) zur Startseite um', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
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
    getHasSubmittedFeedbackQueryMock.mockResolvedValue({ submitted: true });
    getPersonalResultQueryMock.mockResolvedValue({
      totalScore: 120,
      rank: 2,
      bonusToken: null,
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    expect(navSpy).toHaveBeenCalled();
    const opts = navSpy.mock.calls[0]?.[1] as { replaceUrl?: boolean };
    expect(opts?.replaceUrl).toBe(true);
    fixture.destroy();
  });

  it('zeigt nach FINISHED den Abschluss-Screen mit Feedback, wenn noch keine Bewertung abgegeben wurde', async () => {
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
      preset: 'PLAYFUL',
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    getHasSubmittedFeedbackQueryMock.mockResolvedValue({ submitted: false });
    getPersonalResultQueryMock.mockResolvedValue({
      totalScore: 10,
      rank: 3,
      bonusToken: null,
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));
    fixture.detectChanges();

    const inst = fixture.componentInstance;
    expect(inst.showSessionEndGate()).toBe(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Die Session ist beendet.');
    expect(text).toContain('bewerte sie kurz');
    expect(text).toMatch(/Kurzes Feedback\?|Deine Meinung zählt/);
    const bottomActions = fixture.nativeElement.querySelector('.vote-page__bottom-actions');
    expect(bottomActions?.textContent).toContain('Zur Startseite');
    expect(bottomActions?.textContent).toMatch(/Absenden!|Bewertung absenden/);
    expect(bottomActions?.className).toContain('vote-page__bottom-actions--session-end');
    expect(navSpy).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('zeigt im Session-End-Gate Bonus, Feedback und Startseite gemeinsam im unteren Aktionsanker', async () => {
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
      preset: 'PLAYFUL',
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    getHasSubmittedFeedbackQueryMock.mockResolvedValue({ submitted: false });
    getPersonalResultQueryMock.mockResolvedValue({
      totalScore: 10,
      rank: 3,
      bonusToken: 'BONUS-123',
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));
    fixture.detectChanges();

    const bottomActions = fixture.nativeElement.querySelector(
      '.vote-page__bottom-actions',
    ) as HTMLElement | null;
    expect(bottomActions).not.toBeNull();
    expect(bottomActions?.textContent).toContain('Code kopieren');
    expect(bottomActions?.textContent).toMatch(/Absenden!|Bewertung absenden/);
    expect(bottomActions?.textContent).toContain('Zur Startseite');
    expect(bottomActions?.className).toContain('vote-page__bottom-actions--session-end');
    expect(navSpy).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('zeigt bei aktiver Standalone-Q&A-Session das Frageformular', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'Q_AND_A',
      status: 'ACTIVE',
      quizName: null,
      title: 'Offene Fragen',
      participantCount: 6,
      preset: 'SERIOUS',
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#qa-draft')).not.toBeNull();
    expect(host.querySelector('.session-qa-form__meta .session-qa-form__submit')).toBeNull();
    expect(
      host.querySelector('.vote-page__bottom-actions .session-qa-form__submit'),
    ).not.toBeNull();
    expect(host.textContent).not.toContain('Neue Inhalte erscheinen hier automatisch.');
    fixture.destroy();
  });

  it('zeigt bei aktiver Quizfrage den Abstimmen-Button im unteren Aktionsanker', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      preset: 'SERIOUS',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 0,
      text: 'Welche Antwort stimmt?',
      type: 'SINGLE_CHOICE',
      timer: 60,
      difficulty: 'MEDIUM',
      answers: [
        { id: 'a1', text: 'Rot' },
        { id: 'a2', text: 'Blau' },
      ],
      activeAt: MOCK_SERVER_TIME,
      participantCount: 6,
      totalVotes: 1,
      currentRound: 1,
    });
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.currentQuestion()).not.toBeNull();
      },
      { timeout: 3000, interval: 10 },
    );

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-answers')).not.toBeNull();
    const bottomActions = host.querySelector('.vote-page__bottom-actions') as HTMLElement | null;
    expect(bottomActions?.className).toContain('vote-page__bottom-actions--floating');
    expect(host.querySelector('.vote-page__bottom-actions #vote-submit')).not.toBeNull();
    fixture.destroy();
  });

  it('zeigt Kanal-Tabs für Quiz, Q&A und Blitzlicht', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
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
    expect(text).toContain('Q&A');
    expect(text).toContain('Blitzlicht');
    fixture.destroy();
  });

  it('zeigt nach frischem Join im spielerischen Lobby-Client einen einmaligen Arrival-Moment', async () => {
    localStorage.setItem('arsnova-nickname-ABC123', 'Ada');
    setParticipantJoinArrival('ABC123');
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      preset: 'PLAYFUL',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-player-badge--arrival')).not.toBeNull();
    expect(host.querySelector('.vote-lobby--arrival')).not.toBeNull();
    expect(sessionStorage.getItem('arsnova-join-arrival:ABC123')).toBeNull();
    fixture.destroy();
  });

  it('behaelt das Arrival-Flag bis zum ersten erfolgreichen Session-Load', async () => {
    localStorage.setItem('arsnova-nickname-ABC123', 'Ada');
    setParticipantJoinArrival('ABC123');
    getInfoQueryMock.mockRejectedValueOnce(new Error('temporary offline')).mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      preset: 'PLAYFUL',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-player-badge--arrival')).toBeNull();
    expect(hasParticipantJoinArrival('ABC123')).toBe(true);

    await (
      fixture.componentInstance as unknown as { refreshSessionInfoFallback: () => Promise<void> }
    ).refreshSessionInfoFallback();
    fixture.detectChanges();

    expect(host.querySelector('.vote-player-badge--arrival')).not.toBeNull();
    expect(sessionStorage.getItem('arsnova-join-arrival:ABC123')).toBeNull();
    fixture.destroy();
  });

  it('zeigt im Blitzlicht-Tab den laufenden Rundenzustand', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: true },
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
    expect(text).toContain('Blitzlicht');
    expect(text).toContain('R2');
    fixture.destroy();
  });

  it('zeigt im Q&A-Tab einen Geschlossen-Hinweis statt Eingabeformular', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: false, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain(
      'Der Q&A-Kanal wurde von der Lehrperson geschlossen. Fragen und Bewertungen sind gerade nicht möglich.',
    );
    expect(host.querySelector('#qa-draft')).toBeNull();
    fixture.destroy();
  });

  it('zieht Clients nicht automatisch in einen geschlossenen Q&A-Kanal', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: false, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();

    expect(fixture.componentInstance.activeChannel()).toBe('quiz');
    fixture.destroy();
  });

  it('zeigt im Blitzlicht-Tab einen Geschlossen-Hinweis statt Voting', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: true, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    const component = fixture.componentInstance;
    component.activeChannel.set('quickFeedback');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Blitzlicht geschlossen');
    expect(host.textContent).toContain(
      'Der Blitzlicht-Kanal wurde von der Lehrperson geschlossen. Neue Abstimmungen sind gerade nicht möglich.',
    );
    fixture.destroy();
  });

  it('bleibt nach dem Schließen von Blitzlicht im Blitzlicht-Kanal und zeigt den Geschlossen-Hinweis', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    const component = fixture.componentInstance;
    component.activeChannel.set('quickFeedback');
    fixture.detectChanges();

    expect(component.activeChannel()).toBe('quickFeedback');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Blitzlicht geschlossen');
    fixture.destroy();
  });

  it('zieht Clients bei laufendem Blitzlicht in den Blitzlicht-Kanal', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.activeChannel()).toBe('quickFeedback');
      },
      { timeout: 3000, interval: 10 },
    );
    fixture.destroy();
  });

  it('zieht verspätete Clients bei laufender Quizfrage nicht aus dem Quiz in den Blitzlicht-Kanal', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      text: 'Welche Antwort stimmt?',
      type: 'SINGLE_CHOICE',
      timer: 60,
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 3,
      answers: [
        { id: 'a1', text: 'Rot' },
        { id: 'a2', text: 'Blau' },
      ],
      activeAt: MOCK_SERVER_TIME,
      participantCount: 6,
      totalVotes: 1,
      currentRound: 1,
    });
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'MOOD',
      theme: 'system',
      preset: 'serious',
      locked: false,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.currentQuestion()).not.toBeNull();
      },
      { timeout: 3000, interval: 10 },
    );

    expect(fixture.componentInstance.activeChannel()).toBe('quiz');
    fixture.destroy();
  });

  it('markiert Markdown-Container in der Quizsession fuer responsive Bild-Styles', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      text: '![Frage](https://example.com/question.png)',
      type: 'SINGLE_CHOICE',
      timer: 60,
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 3,
      answers: [
        { id: 'a1', text: '![Antwort](https://example.com/answer.png)' },
        { id: 'a2', text: 'Blau' },
      ],
      activeAt: MOCK_SERVER_TIME,
      participantCount: 6,
      totalVotes: 1,
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.currentQuestion()).not.toBeNull();
      },
      { timeout: 3000, interval: 10 },
    );

    const questionText = fixture.nativeElement.querySelector(
      '.vote-question__text',
    ) as HTMLElement | null;
    const answerText = fixture.nativeElement.querySelector(
      '.vote-answer__text',
    ) as HTMLElement | null;

    expect(questionText?.classList.contains('markdown-body')).toBe(true);
    expect(answerText?.classList.contains('markdown-body')).toBe(true);
    fixture.destroy();
  });

  it('erzwingt Quiz-Kanal nur in Lesephase und Abstimmung, nicht in Ergebnisphase', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 1,
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      answers: [
        { id: 'a1', text: 'Ja', isCorrect: true },
        { id: 'a2', text: 'Nein', isCorrect: false },
      ],
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    await (c as unknown as { refreshQuestion: () => Promise<void> }).refreshQuestion();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    c.activeChannel.set('qa');
    fixture.detectChanges();
    expect(c.activeChannel()).toBe('qa');

    fixture.destroy();
  });

  it('erzwingt Quiz-Kanal während ACTIVE mit laufender Frage solange nicht abgestimmt', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 1,
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      timer: 60,
      difficulty: 'MEDIUM',
      answers: [
        { id: 'a1', text: 'A' },
        { id: 'a2', text: 'B' },
      ],
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    await (c as unknown as { refreshQuestion: () => Promise<void> }).refreshQuestion();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    c.activeChannel.set('quickFeedback');
    fixture.detectChanges();
    expect(c.activeChannel()).toBe('quiz');

    fixture.destroy();
  });

  it('entfernt in Peer-Instruction-Runde 2 den Countdown bei gleicher Frage', async () => {
    const nowIso = new Date().toISOString();
    let statusListener: ((data: unknown) => void) | null = null;
    statusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        statusListener = opts.onData;
        return { unsubscribe: vi.fn() };
      },
    );
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      preset: 'SERIOUS',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock
      .mockResolvedValueOnce({
        id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        order: 0,
        text: 'Welche Antwort stimmt?',
        type: 'SINGLE_CHOICE',
        timer: 60,
        difficulty: 'MEDIUM',
        answers: [
          { id: 'a1', text: 'Rot' },
          { id: 'a2', text: 'Blau' },
        ],
        activeAt: nowIso,
        participantCount: 6,
        totalVotes: 1,
        currentRound: 1,
      })
      .mockResolvedValueOnce({
        id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        order: 0,
        text: 'Welche Antwort stimmt?',
        type: 'SINGLE_CHOICE',
        timer: null,
        difficulty: 'MEDIUM',
        answers: [
          { id: 'a1', text: 'Rot' },
          { id: 'a2', text: 'Blau' },
        ],
        activeAt: nowIso,
        participantCount: 6,
        totalVotes: 1,
        currentRound: 2,
      });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.currentQuestion()).not.toBeNull();
      },
      { timeout: 3000, interval: 10 },
    );

    expect(fixture.componentInstance.countdownSeconds()).not.toBeNull();

    statusListener?.({
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 2,
      activeAt: nowIso,
      timer: null,
      serverTime: nowIso,
    });

    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.currentRound()).toBe(2);
        expect(fixture.componentInstance.countdownSeconds()).toBeNull();
      },
      { timeout: 3000, interval: 10 },
    );

    expect(fixture.nativeElement.querySelector('.vote-countdown')).toBeNull();
    fixture.destroy();
  });

  it('erlaubt nach Abstimmung in ACTIVE den Wechsel zu anderen Kanälen', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      preset: 'PLAYFUL',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      order: 1,
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      timer: 60,
      difficulty: 'MEDIUM',
      answers: [
        { id: 'a1', text: 'A' },
        { id: 'a2', text: 'B' },
      ],
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    await (c as unknown as { refreshQuestion: () => Promise<void> }).refreshQuestion();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    c.voteSent.set(true);
    c.activeChannel.set('qa');
    fixture.detectChanges();
    expect(c.activeChannel()).toBe('qa');

    fixture.destroy();
  });

  it('sendet im Fragen-Tab eine neue Frage', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen aus dem Publikum', moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    qaListQueryMock.mockResolvedValue([
      {
        id: 'question-1',
        text: 'Was ist klausurrelevant?',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
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

  it('informiert per Snackbar, wenn die Moderation eine eigene Frage entfernt', async () => {
    snackBarOpenMock.mockClear();
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    qaListQueryMock.mockResolvedValue([]);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    const c = fixture.componentInstance;
    const prev: QaQuestionDTO[] = [
      {
        id: 'q-own',
        text: 'Meine Frage',
        upvoteCount: 1,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: true,
        hasUpvoted: false,
      },
    ];
    c.qaQuestions.set(prev);
    (
      c as unknown as {
        notifyQaModeratorRemovals: (p: QaQuestionDTO[], n: QaQuestionDTO[]) => void;
      }
    ).notifyQaModeratorRemovals(prev, []);

    expect(snackBarOpenMock).toHaveBeenCalledTimes(1);
    const [message, , opts] = snackBarOpenMock.mock.calls[0]!;
    expect(message).toMatch(/Moderation|host|modération|moderación|moderatore/i);
    expect(opts).toMatchObject({ duration: 8000 });
    fixture.destroy();
  });

  it('informiert per Snackbar, wenn die Moderation eine fremde Frage entfernt', async () => {
    snackBarOpenMock.mockClear();
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      quizName: 'Team-Quiz',
      title: null,
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    qaListQueryMock.mockResolvedValue([]);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));

    const c = fixture.componentInstance;
    const prev: QaQuestionDTO[] = [
      {
        id: 'q-other',
        text: 'Fremde Frage',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
    ];
    c.qaQuestions.set(prev);
    (
      c as unknown as {
        notifyQaModeratorRemovals: (p: QaQuestionDTO[], n: QaQuestionDTO[]) => void;
      }
    ).notifyQaModeratorRemovals(prev, []);

    expect(snackBarOpenMock).toHaveBeenCalledTimes(1);
    const [message] = snackBarOpenMock.mock.calls[0]!;
    expect(message).toMatch(/Frage|question|pregunta|domanda/i);
    fixture.destroy();
  });
});
