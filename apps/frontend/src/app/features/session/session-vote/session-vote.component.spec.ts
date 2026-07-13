import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { QaQuestionDTO } from '@arsnova/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushComponentAfterStable,
  flushMacroTask,
} from '../../../../testing/component-test-utils';
import {
  anchorCandidatesForPhase,
  focusTargetIdForAnchor,
  getNumericEstimateMotivation,
  SessionVoteComponent,
} from './session-vote.component';
import { NICKNAME_LISTS } from '../../join/nickname-themes';
import * as vpc from './session-vote-participant-copy';
import {
  hasParticipantJoinArrival,
  setParticipantJoinArrival,
} from '../../../core/participant-join-arrival';
import {
  peekConfirmedParticipantTeam,
  setConfirmedParticipantTeam,
} from '../../../core/participant-team-confirmation';
import { ThemePresetService } from '../../../core/theme-preset.service';

registerLocaleData(localeDe);

const {
  getInfoQueryMock,
  statusChangedSubscribeMock,
  currentQuestionQueryMock,
  voteSubmitMutateMock,
  confirmReadingReadyMutateMock,
  quickFeedbackResultsQueryMock,
  quickFeedbackOnResultsSubscribeMock,
  getParticipantSelfQueryMock,
  getTeamsQueryMock,
  getTeamLeaderboardQueryMock,
  getPersonalScorecardQueryMock,
  getPersonalResultQueryMock,
  getHasSubmittedFeedbackQueryMock,
  getSessionFeedbackSummaryQueryMock,
  submitSessionFeedbackMutateMock,
  getParticipantNicknamesQueryMock,
  markParticipantOfflineMutateMock,
  joinMutateMock,
  qaListQueryMock,
  qaSubmitMutateMock,
  qaUpvoteMutateMock,
  qaQuestionsUpdatedSubscribeMock,
  snackBarOpenMock,
} = vi.hoisted(() => ({
  getInfoQueryMock: vi.fn(),
  statusChangedSubscribeMock: vi.fn(),
  currentQuestionQueryMock: vi.fn(),
  voteSubmitMutateMock: vi.fn(),
  confirmReadingReadyMutateMock: vi.fn(),
  quickFeedbackResultsQueryMock: vi.fn(),
  quickFeedbackOnResultsSubscribeMock: vi.fn(),
  getParticipantSelfQueryMock: vi.fn(),
  getTeamsQueryMock: vi.fn(),
  getTeamLeaderboardQueryMock: vi.fn(),
  getPersonalScorecardQueryMock: vi.fn(),
  getPersonalResultQueryMock: vi.fn(),
  getHasSubmittedFeedbackQueryMock: vi.fn(),
  getSessionFeedbackSummaryQueryMock: vi.fn(),
  submitSessionFeedbackMutateMock: vi.fn(),
  getParticipantNicknamesQueryMock: vi.fn(),
  markParticipantOfflineMutateMock: vi.fn(),
  joinMutateMock: vi.fn(),
  qaListQueryMock: vi.fn(),
  qaSubmitMutateMock: vi.fn(),
  qaUpvoteMutateMock: vi.fn(),
  qaQuestionsUpdatedSubscribeMock: vi.fn(),
  snackBarOpenMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    vote: {
      submit: { mutate: voteSubmitMutateMock },
    },
    session: {
      getInfo: { query: getInfoQueryMock },
      onStatusChanged: { subscribe: statusChangedSubscribeMock },
      getCurrentQuestionForStudent: { query: currentQuestionQueryMock },
      confirmReadingReady: { mutate: confirmReadingReadyMutateMock },
      getParticipantSelf: { query: getParticipantSelfQueryMock },
      getTeams: { query: getTeamsQueryMock },
      getTeamLeaderboard: { query: getTeamLeaderboardQueryMock },
      getPersonalScorecard: { query: getPersonalScorecardQueryMock },
      getPersonalResult: { query: getPersonalResultQueryMock },
      getHasSubmittedFeedback: { query: getHasSubmittedFeedbackQueryMock },
      getSessionFeedbackSummary: { query: getSessionFeedbackSummaryQueryMock },
      submitSessionFeedback: { mutate: submitSessionFeedbackMutateMock },
      getParticipantNicknames: { query: getParticipantNicknamesQueryMock },
      markParticipantOffline: { mutate: markParticipantOfflineMutateMock },
      join: { mutate: joinMutateMock },
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

async function findNumericEstimateInput(
  fixture: ComponentFixture<SessionVoteComponent>,
): Promise<HTMLInputElement> {
  let input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
    '#vote-numeric-input',
  );
  for (let attempt = 0; attempt < 10 && !input; attempt += 1) {
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#vote-numeric-input',
    );
  }
  expect(input).toBeTruthy();
  return input!;
}

describe('SessionVoteComponent', { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(vpc.voteRound2Banner(true)).toBe('Nur Runde 2 zählt. Antworte erneut.');
    expect(vpc.voteRound2Banner(false)).toBe('Nur Runde 2 zählt. Antworte erneut.');
  });

  it('formuliert NUMERIC_ESTIMATE-Motivation nach Nähe statt binär richtig/falsch', () => {
    const toleranceBand = { left: 1700, right: 1900 };

    expect(getNumericEstimateMotivation({ value: 1789, referenceValue: 1789, toleranceBand })).toBe(
      'Volltreffer: genau am Referenzwert.',
    );
    expect(getNumericEstimateMotivation({ value: 1790, referenceValue: 1789, toleranceBand })).toBe(
      'Sehr nah am Referenzwert.',
    );
    expect(getNumericEstimateMotivation({ value: 1850, referenceValue: 1789, toleranceBand })).toBe(
      'Im akzeptierten Bereich.',
    );
    expect(getNumericEstimateMotivation({ value: 1901, referenceValue: 1789, toleranceBand })).toBe(
      'Außerhalb des Toleranzbands.',
    );
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
    getPersonalScorecardQueryMock.mockResolvedValue({
      questionOrder: 1,
      totalQuestions: 1,
      wasCorrect: null,
      questionScore: 0,
      baseScore: 0,
      streakCount: 0,
      streakMultiplier: 1,
      currentRank: 0,
      previousRank: null,
      rankChange: 0,
      totalScore: 0,
    });
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
    getParticipantNicknamesQueryMock.mockResolvedValue({ nicknames: [], participantCount: 0 });
    markParticipantOfflineMutateMock.mockResolvedValue({ ok: true });
    joinMutateMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '11111111-1111-4111-8111-111111111111',
    });
    voteSubmitMutateMock.mockResolvedValue({});
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
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
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
    TestBed.inject(ThemePresetService).setPreset('spielerisch', { silent: true });
  });

  it('markiert den Teilnehmer beim Verlassen der Session-Ansicht offline', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;
    component.participantId.set('11111111-1111-4111-8111-111111111111');

    component.ngOnDestroy();
    component.ngOnDestroy();

    expect(markParticipantOfflineMutateMock).toHaveBeenCalledTimes(1);
    expect(markParticipantOfflineMutateMock).toHaveBeenCalledWith({
      code: 'ABC123',
      participantId: '11111111-1111-4111-8111-111111111111',
    });
    fixture.destroy();
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
      await flushComponentAfterStable(fixture, 50);
      fixture.detectChanges();
      button = (fixture.nativeElement as HTMLElement).querySelector('.vote-reading-banner__cta');
    }
    expect(button).toBeTruthy();

    button?.click();
    let textContent = '';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await flushComponentAfterStable(fixture, 50);
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

  it('rendert gebuendelte App-Asset-Bilder in Live-Fragetexten', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;

    const rendered = component.renderMarkdown(
      '![Rooftop scene](/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png)',
    ) as unknown as {
      changingThisBreaksApplicationSecurity?: string;
    };

    expect(rendered.changingThisBreaksApplicationSecurity).toContain(
      'src="/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png"',
    );
    expect(rendered.changingThisBreaksApplicationSecurity).toContain('alt="Rooftop scene"');
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

  it('markiert fuehrende Shortcut-Emojis in Antworttexten fuer das Vote-Layout', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;

    const rendered = component.renderMarkdown(':cry: Gerade etwas überfordert') as unknown as {
      changingThisBreaksApplicationSecurity?: string;
    };

    expect(rendered.changingThisBreaksApplicationSecurity).toContain(
      'markdown-emoji answer-leading-emoji',
    );
    expect(rendered.changingThisBreaksApplicationSecurity).toContain('title=":cry:"');
    expect(rendered.changingThisBreaksApplicationSecurity).toContain('answer-leading-emoji-text');
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
    await flushMacroTask(50);
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
    await flushMacroTask(50);
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
    await flushMacroTask(50);
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
    await flushMacroTask(50);
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
    await flushMacroTask(50);
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
    await flushMacroTask(50);
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
    await flushMacroTask(50);
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

  it('behandelt eine serverseitig gespeicherte falsche Antwort nicht als Timeout', async () => {
    getPersonalScorecardQueryMock.mockResolvedValueOnce({
      questionOrder: 1,
      totalQuestions: 1,
      wasCorrect: false,
      questionScore: 0,
      baseScore: 0,
      streakCount: 0,
      streakMultiplier: 1,
      currentRank: 2,
      previousRank: null,
      rankChange: 0,
      totalScore: 2487,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    const inst = fixture.componentInstance;
    inst.participantId.set('11111111-1111-4111-8111-111111111111');
    inst.status.set('RESULTS');
    inst.currentQuestion.set({
      id: 'q-short-text',
      text: 'Kurzantwort',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [{ id: 's1', text: '1.69 ms', isCorrect: true, voteCount: 1, votePercentage: 100 }],
      totalVotes: 1,
      shortTextEvaluationKind: 'numeric_unit',
    } as never);
    inst.voteSent.set(false);
    inst.timeoutMessage.set('Zeit abgelaufen.');

    await inst.loadScorecard(0);

    expect(inst.scorecard()?.wasCorrect).toBe(false);
    expect(inst.voteSent()).toBe(true);
    expect(inst.timeoutMessage()).toBeNull();
    expect(inst.unansweredResultsMessage()).toBeNull();
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

  it('blendet den Kanalwahlschalter nach Session-Ende aus', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const inst = fixture.componentInstance;

    inst.status.set('FINISHED');
    inst.sessionSettings.set({
      type: 'QUIZ',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    } as never);
    fixture.detectChanges();

    expect(inst.showChannelTabs()).toBe(false);
    expect(fixture.nativeElement.querySelector('.session-channel-tabs')).toBeNull();
    fixture.destroy();
  });

  it.each(['qa', 'quickFeedback'] as const)(
    'rendert nach Session-Ende die Abschlussansicht statt dem aktiven Kanal %s',
    async (channel) => {
      getInfoQueryMock.mockResolvedValue({
        id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        serverTime: MOCK_SERVER_TIME,
        code: 'ABC123',
        type: 'QUIZ',
        status: 'ACTIVE',
        quizName: 'Team-Quiz',
        title: null,
        participantCount: 6,
        teamMode: false,
        preset: 'PLAYFUL',
        channels: {
          quiz: { enabled: true },
          qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
          quickFeedback: { enabled: true, open: true },
        },
      });
      currentQuestionQueryMock.mockResolvedValue(null);
      quickFeedbackResultsQueryMock.mockResolvedValue({
        type: 'MOOD',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        currentRound: 1,
      });

      const fixture = TestBed.createComponent(SessionVoteComponent);
      fixture.detectChanges();
      await flushComponentAfterStable(fixture, 50);

      const inst = fixture.componentInstance;
      inst.activeChannel.set(channel);
      inst.personalResultLoaded.set(true);
      inst.personalScore.set(42);
      inst.personalRank.set(2);
      inst.feedbackSubmitted.set(true);
      inst.status.set('FINISHED');
      fixture.detectChanges();

      expect(inst.showPrimaryLiveView()).toBe(true);
      expect(fixture.nativeElement.querySelector('.vote-finished-page')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.session-channel-card--qa')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('.session-channel-card--quick-feedback'),
      ).toBeNull();
      expect(fixture.nativeElement.querySelector('app-feedback-vote')).toBeNull();
      fixture.destroy();
    },
  );

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
    await flushComponentAfterStable(fixture, 50);

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
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    expect(fixture.componentInstance.voteSent()).toBe(true);
    expect(fixture.nativeElement.querySelector('.vote-answer--result-selected')).not.toBeNull();
    fixture.destroy();
  });

  it('lädt in RESULTS keine persönliche Scorecard für Umfrage-Fragen', async () => {
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
    const component = fixture.componentInstance;
    const loadScorecardSpy = vi.spyOn(component, 'loadScorecard');
    component.scorecard.set({
      questionOrder: 1,
      totalQuestions: 3,
      currentRank: 2,
      totalScore: 120,
      wasCorrect: true,
      streakCount: 1,
      rankChange: 0,
    } as never);

    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    expect(loadScorecardSpy).not.toHaveBeenCalled();
    expect(component.scorecard()).toBeNull();
    expect(fixture.nativeElement.querySelector('.vote-scorecard')).toBeNull();
    fixture.destroy();
  });

  it('fragt bei direktem Scorecard-Laden keine unbewerteten Fragetypen ab', async () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;
    component.participantId.set('11111111-1111-4111-8111-111111111111');
    component.currentQuestion.set({
      id: 'survey-direct-scorecard-guard',
      text: 'Wie fandest du das?',
      type: 'SURVEY',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      totalVotes: 0,
    } as never);

    await component.loadScorecard(0);

    expect(getPersonalScorecardQueryMock).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('sendet SHORT_TEXT-Antworten als freie Textabgabe', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-question',
      text: 'Welche Stadt ist die Hauptstadt von Frankreich?',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      currentRound: 1,
      shortTextMaxLength: 80,
      shortTextCaseSensitive: false,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.onTextVoteInput(' Paris ');
    await component.submitVote();

    expect(voteSubmitMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 'short-text-question',
        freeText: 'Paris',
        answerIds: undefined,
      }),
    );
    fixture.destroy();
  });

  it('zeigt den Sicherheitsgrad erst nach gewählter Antwort und sendet ihn mit', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'confidence-sc-question',
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'A', isCorrect: true },
        { id: 'a2', text: 'B', isCorrect: false },
      ],
      currentRound: 1,
      totalVotes: 0,
      participantCount: 2,
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    expect(component.showConfidencePrompt()).toBe(false);
    expect(fixture.nativeElement.querySelector('.vote-confidence')).toBeNull();

    component.toggleAnswer('a1');
    fixture.detectChanges();

    expect(component.showConfidencePrompt()).toBe(true);
    expect(fixture.nativeElement.querySelector('.vote-confidence')).not.toBeNull();
    expect(component.voteSubmitDisabled()).toBe(true);

    component.selectConfidence(4);
    expect(component.voteSubmitDisabled()).toBe(false);

    await component.submitVote();

    expect(voteSubmitMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 'confidence-sc-question',
        answerIds: ['a1'],
        confidenceValue: 4,
      }),
    );
    fixture.destroy();
  });

  it('sperrt den Vote-Client nach serverseitig abgelehntem Timeout-Vote', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'single-choice-timeout',
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'A', isCorrect: true },
        { id: 'a2', text: 'B', isCorrect: false },
      ],
      activeAt: new Date().toISOString(),
      timer: 10,
      currentRound: 1,
      totalVotes: 0,
      participantCount: 2,
    });
    voteSubmitMutateMock.mockRejectedValueOnce(
      new Error('BAD_REQUEST: Die Zeit für diese Frage ist abgelaufen.'),
    );

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.toggleAnswer('a1');
    fixture.detectChanges();

    await component.submitVote();
    fixture.detectChanges();

    expect(voteSubmitMutateMock).toHaveBeenCalledTimes(1);
    expect(component.voteSent()).toBe(false);
    expect(component.voteClosed()).toBe(true);
    expect(component.voteSubmitDisabled()).toBe(true);
    expect(component.voteError()).toContain('Die Zeit für diese Frage ist abgelaufen');

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector<HTMLButtonElement>('#vote-option-0')?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('#vote-submit')?.disabled).toBe(true);

    component.debounced.set(false);
    component.toggleAnswer('a2');
    await component.submitVote();

    expect(component.selectedAnswerIds()).toEqual(new Set(['a1']));
    expect(voteSubmitMutateMock).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('sendet einen bereits ausgeloesten Submit trotz lokal gerade abgelaufenem Countdown an den Server', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'single-choice-late-click',
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'A', isCorrect: true },
        { id: 'a2', text: 'B', isCorrect: false },
      ],
      activeAt: new Date().toISOString(),
      timer: 10,
      currentRound: 1,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.toggleAnswer('a1');
    component.countdownSeconds.set(0);
    component.voteClosed.set(false);
    fixture.detectChanges();

    expect(component.timerExpired()).toBe(true);
    expect(component.voteSubmitDisabled()).toBe(true);

    await component.submitVote();

    expect(voteSubmitMutateMock).toHaveBeenCalledTimes(1);
    expect(voteSubmitMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        answerIds: ['a1'],
        questionId: 'single-choice-late-click',
      }),
    );
    fixture.destroy();
  });

  it('erfasst den Submit-Intent bereits auf Pointer-Down, bevor ein spaeterer Click verschluckt wird', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'single-choice-pointer-submit',
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'A', isCorrect: true },
        { id: 'a2', text: 'B', isCorrect: false },
      ],
      activeAt: new Date().toISOString(),
      timer: 10,
      currentRound: 1,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.toggleAnswer('a1');
    component.countdownSeconds.set(1);
    fixture.detectChanges();

    const event = {
      button: 0,
      pointerType: 'touch',
      preventDefault: vi.fn(),
    } as unknown as PointerEvent;
    const submit = component.onVoteSubmitPointerDown(event);
    component.countdownSeconds.set(0);
    await submit;

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(voteSubmitMutateMock).toHaveBeenCalledTimes(1);
    expect(voteSubmitMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        answerIds: ['a1'],
        questionId: 'single-choice-pointer-submit',
      }),
    );

    await component.submitVote();
    expect(voteSubmitMutateMock).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('sperrt den Vote-Client nach dem lokalen Late-Submit-Fenster', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'single-choice-local-timeout',
      text: 'Welche Antwort ist richtig?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [
        { id: 'a1', text: 'A', isCorrect: true },
        { id: 'a2', text: 'B', isCorrect: false },
      ],
      activeAt: new Date().toISOString(),
      timer: 10,
      currentRound: 1,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.voteSent.set(false);
    component.voteClosed.set(false);
    vi.useFakeTimers();
    try {
      (
        component as unknown as {
          scheduleLateSubmitClose(): void;
        }
      ).scheduleLateSubmitClose();
      vi.advanceTimersByTime(2000);
      expect(component.voteClosed()).toBe(true);
    } finally {
      vi.useRealTimers();
      fixture.destroy();
    }
  });

  it('zaehlt bei normalisierten SHORT_TEXT-Eingaben dieselbe Laenge wie die Validierung', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-question-counter',
      text: 'Nenne den Fachbegriff.',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      currentRound: 1,
      shortTextMaxLength: 3,
      shortTextCaseSensitive: false,
      shortTextTrimWhitespace: true,
      shortTextNormalizeWhitespace: true,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.onTextVoteInput('  a   b  ');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const counter = host.querySelector('.vote-freetext__counter');
    const input = host.querySelector('.vote-freetext__input--short');

    expect(component.shortTextValidationError()).toBeNull();
    expect(counter?.textContent).toContain('3/3');
    expect(input?.getAttribute('maxlength')).toBeNull();
    fixture.destroy();
  });

  it('setzt bei strenger SHORT_TEXT-Laengenpruefung weiterhin eine native maxlength-Grenze', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-question-native-maxlength',
      text: 'Nenne den Fachbegriff.',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      currentRound: 1,
      shortTextMaxLength: 3,
      shortTextCaseSensitive: false,
      shortTextTrimWhitespace: false,
      shortTextNormalizeWhitespace: false,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '.vote-freetext__input--short',
    );

    expect(input?.getAttribute('maxlength')).toBe('3');
    fixture.destroy();
  });

  it('zeigt in RESULTS bei SHORT_TEXT die Musterlösungen statt Antwort-Buttons', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-results',
      text: 'Welche Stadt ist die Hauptstadt von Frankreich?',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [{ id: 's1', text: 'Paris', isCorrect: true, voteCount: 1, votePercentage: 100 }],
      totalVotes: 1,
      shortTextMaxLength: 80,
      shortTextCaseSensitive: false,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    const loadScorecardSpy = vi
      .spyOn(fixture.componentInstance, 'loadScorecard')
      .mockResolvedValue(undefined);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.voteSent.set(true);
    component.freeTextValue.set('Paris');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(loadScorecardSpy).toHaveBeenCalled();
    expect(host.querySelector('.vote-freetext__solutions')).not.toBeNull();
    expect(host.querySelector('.vote-answer')).toBeNull();
    expect(host.textContent).toContain('Paris');
    expect(host.textContent).toContain('Musterlösungen');
    fixture.destroy();
  });

  it('bewertet nicht angenommene SHORT_TEXT-Eingaben in RESULTS nicht lokal', async () => {
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
      preset: 'PLAYFUL',
      enableEmojiReactions: false,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-results-missed',
      text: 'Wie lautet die Kreiszahl?',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [{ id: 's1', text: '3,14', isCorrect: true, voteCount: 1, votePercentage: 100 }],
      totalVotes: 1,
      shortTextMaxLength: 80,
      shortTextCaseSensitive: false,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    vi.spyOn(fixture.componentInstance, 'loadScorecard').mockResolvedValue(undefined);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.voteSent.set(false);
    component.freeTextValue.set('3,14');
    component.timeoutMessage.set('Knapp verpasst – nächste Runde! ⏱️');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Knapp verpasst – nächste Runde! ⏱️');
    expect(host.textContent).toContain('Diese Runde ohne Text');
    expect(host.textContent).toContain('Musterlösungen');
    expect(host.textContent).not.toContain('Du sagst:');
    expect(host.textContent).not.toContain('Voll gewertet');
    expect(host.querySelector('.vote-freetext__own--correct')).toBeNull();
    fixture.destroy();
  });

  it('markiert teilbewertete SHORT_TEXT-Antworten in RESULTS sichtbar', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-results-partial',
      text: 'Welche Stadt ist die Hauptstadt von Frankreich?',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [{ id: 's1', text: 'Paris', isCorrect: true, voteCount: 1, votePercentage: 100 }],
      totalVotes: 1,
      shortTextMaxLength: 80,
      shortTextCaseSensitive: false,
      shortTextEvaluationMode: 'levenshtein',
      shortTextToleranceLevel: 'medium',
      shortTextAllowPartialCredit: true,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    vi.spyOn(fixture.componentInstance, 'loadScorecard').mockResolvedValue(undefined);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.voteSent.set(true);
    component.freeTextValue.set('Pari');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-freetext__own--partial')).not.toBeNull();
    expect(host.textContent).toContain('Teilweise gewertet');
    expect(host.textContent).toContain('Gewertet als Musterlösung „Paris“.');
    expect(host.textContent).toContain(
      'Ein fehlendes oder zusätzliches Zeichen lag noch innerhalb der Toleranz.',
    );
    fixture.destroy();
  });

  it('blockiert numerische SHORT_TEXT-Eingaben mit ungueltigem Format bereits im Client', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-numeric-invalid',
      text: 'Wie groß ist die Beschleunigung?',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [{ id: 's1', text: '9.81', isCorrect: true, voteCount: 0, votePercentage: 0 }],
      currentRound: 1,
      shortTextEvaluationKind: 'numeric',
      shortTextMaxLength: 20,
      numericInputKind: 'decimal',
      numericToleranceMode: 'absolute',
      numericAbsoluteTolerance: 0.1,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.onTextVoteInput('neun komma acht');
    fixture.detectChanges();

    expect(component.shortTextValidationError()).toContain('Zahl im unterstützten Format');

    await component.submitVote();

    expect(voteSubmitMutateMock).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('blockiert NUMERIC_ESTIMATE-Dezimalwerte wenn Ganzzahl konfiguriert ist', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'numeric-estimate-integer',
      text: 'Wie viele Personen sind im Raum?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      activeAt: MOCK_SERVER_TIME,
      currentRound: 1,
      numericInputType: 'INTEGER',
      numericDecimalPlaces: null,
      numericMin: 0,
      numericMax: 100,
      numericTwoRounds: false,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    const input = await findNumericEstimateInput(fixture);
    expect(input?.type).toBe('text');
    expect(input?.getAttribute('inputmode')).toBe('numeric');
    expect(input?.getAttribute('aria-invalid')).toBeNull();
    expect(input?.getAttribute('aria-describedby')).toBe(
      'vote-numeric-format-hint vote-numeric-range-hint',
    );
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Ganzzahl');
    expect(host.textContent).toContain('Gib eine ganze Zahl ohne Nachkommastellen ein');
    expect(host.textContent).toContain('Erlaubte Eingabe: 0 bis 100');

    component.numericInputValue.set('3.14');
    fixture.detectChanges();

    expect(component.numericValidationError()).toContain('ganze Zahl');
    expect(component.voteSubmitDisabled()).toBe(true);
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe(
      'vote-numeric-format-hint vote-numeric-range-hint vote-numeric-input-error',
    );

    const error = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '#vote-numeric-input-error',
    );
    expect(error?.textContent).toContain('ganze Zahl');

    await component.submitVote();

    expect(voteSubmitMutateMock).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('blockiert NUMERIC_ESTIMATE-Werte mit zu vielen Nachkommastellen lokal', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'numeric-estimate-decimal',
      text: 'Wie groß ist die Strecke?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      activeAt: MOCK_SERVER_TIME,
      currentRound: 1,
      numericInputType: 'DECIMAL',
      numericDecimalPlaces: 2,
      numericMin: null,
      numericMax: null,
      numericTwoRounds: false,
      totalVotes: 0,
      participantCount: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    const input = await findNumericEstimateInput(fixture);
    expect(input?.type).toBe('text');
    expect(input?.getAttribute('inputmode')).toBe('decimal');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Dezimalzahl');
    expect(host.textContent).toContain('Komma oder Punkt möglich, maximal 2 Nachkommastellen');
    input!.value = '3,14';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.numericInputValue()).toBe('3,14');
    expect(component.numericParsedValue()).toBe(3.14);

    component.numericInputValue.set('1.000,5');
    fixture.detectChanges();

    expect(component.numericParsedValue()).toBeNull();
    expect(component.numericValidationError()).toContain('gültige Zahl');
    expect(component.numericValidationError()).not.toContain('Nachkommastellen');

    component.numericInputValue.set('3,141');
    fixture.detectChanges();

    expect(component.numericValidationError()).toContain('Maximal 2 Nachkommastellen');

    await component.submitVote();

    expect(voteSubmitMutateMock).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('zeigt bei NUMERIC_ESTIMATE-Ergebnissen Referenz, akzeptierten Wert und Rundenvergleich', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    localStorage.setItem(
      `arsnova-vote-response-ABC123-${participantId}-french-revolution-1`,
      JSON.stringify({ numericValue: 1750, sent: true, updatedAt: MOCK_SERVER_TIME }),
    );
    localStorage.setItem(
      `arsnova-vote-response-ABC123-${participantId}-french-revolution-2`,
      JSON.stringify({ numericValue: 1789, sent: true, updatedAt: MOCK_SERVER_TIME }),
    );
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Q',
      title: null,
      participantCount: 20,
      teamMode: false,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      preset: 'SERIOUS',
      enableEmojiReactions: false,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'french-revolution',
      text: 'In welchem Jahr begann die Französische Revolution?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      activeAt: MOCK_SERVER_TIME,
      currentRound: 2,
      numericInputType: 'INTEGER',
      numericDecimalPlaces: null,
      numericMin: 1600,
      numericMax: 2000,
      numericTwoRounds: true,
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 1789,
      numericTolerancePercent: null,
      numericIntervalLeft: 1788.5,
      numericIntervalRight: 1789.5,
      totalVotes: 20,
      participantCount: 20,
    });
    getPersonalScorecardQueryMock.mockResolvedValueOnce({
      questionOrder: 1,
      totalQuestions: 1,
      wasCorrect: true,
      questionScore: 100,
      baseScore: 100,
      streakCount: 1,
      streakMultiplier: 1,
      currentRank: 3,
      previousRank: null,
      rankChange: 0,
      totalScore: 100,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.voteSent.set(true);
    component.numericInputValue.set('1789');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Deine Antwort: 1789');
    expect(host.textContent).toContain('Im Toleranzband');
    expect(host.textContent).toContain('Referenzwert: 1789');
    expect(host.textContent).toContain('Akzeptierter Wert: 1789');
    expect(host.textContent).toContain('Genau am Referenzwert');
    expect(host.textContent).toContain('39 näher am Referenzwert als in Runde 1');
    expect(getPersonalScorecardQueryMock).toHaveBeenCalledWith({
      code: 'ABC123',
      participantId,
      questionIndex: 0,
      round: 2,
    });
    expect(host.textContent).toContain('100');
    expect(host.textContent).toContain('Punkte');
    expect(host.textContent).toContain('Gesamt');
    expect(component.showRewardEffect()).toBe(true);
    expect(component.motivationMessage()).toBe('Volltreffer: genau am Referenzwert.');
    fixture.destroy();
  });

  it('zeigt bei einrundigen NUMERIC_ESTIMATE-Ergebnissen keinen Rundenvergleich', async () => {
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'RESULTS',
      quizName: 'Q',
      title: null,
      participantCount: 20,
      teamMode: false,
      enableRewardEffects: false,
      enableMotivationMessages: false,
      preset: 'SERIOUS',
      enableEmojiReactions: false,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'single-round-estimate',
      text: 'In welchem Jahr begann die Französische Revolution?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [],
      activeAt: MOCK_SERVER_TIME,
      currentRound: 1,
      numericInputType: 'INTEGER',
      numericDecimalPlaces: null,
      numericMin: 1500,
      numericMax: 2000,
      numericTwoRounds: false,
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 1789,
      numericTolerancePercent: null,
      numericIntervalLeft: 1700,
      numericIntervalRight: 1900,
      totalVotes: 20,
      participantCount: 20,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.voteSent.set(true);
    component.numericInputValue.set('1789');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Deine Antwort: 1789');
    expect(host.textContent).toContain('Referenzwert: 1789');
    expect(component.numericResultRoundComparisonLabel()).toBeNull();
    expect(host.textContent).not.toContain('Gleich nah am Referenzwert wie in Runde 1');
    expect(host.textContent).not.toContain('Runde 1');
    fixture.destroy();
  });

  it('zeigt bei numerischen SHORT_TEXT-Ergebnissen Teilpunkte fuer fehlende Pflicht-Einheiten', async () => {
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
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
    currentQuestionQueryMock.mockResolvedValue({
      id: 'short-text-numeric-unit-results',
      text: 'Wie lang ist die Strecke?',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      order: 0,
      totalQuestions: 1,
      answers: [{ id: 's1', text: '2 m', isCorrect: true, voteCount: 1, votePercentage: 100 }],
      totalVotes: 1,
      shortTextEvaluationKind: 'numeric_unit',
      shortTextMaxLength: 20,
      numericInputKind: 'decimal',
      numericToleranceMode: 'exact',
      numericUnitFamily: 'length',
      numericRequireUnit: true,
      numericAcceptEquivalentUnits: true,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    vi.spyOn(fixture.componentInstance, 'loadScorecard').mockResolvedValue(undefined);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.voteSent.set(true);
    component.freeTextValue.set('2');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-freetext__own--partial')).not.toBeNull();
    expect(host.textContent).toContain('Teilweise gewertet');
    expect(host.textContent).toContain('Gewertet als Musterlösung „2 m“.');
    expect(host.textContent).toContain('die verlangte Einheit fehlte');
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
      quizStarted: true,
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
    await flushComponentAfterStable(fixture, 50);

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
      quizStarted: true,
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
    await flushComponentAfterStable(fixture, 80);
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
      quizStarted: true,
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
    await flushComponentAfterStable(fixture, 80);
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

  it('zeigt im Session-End-Gate keine Bewertung, wenn kein Quiz gestartet wurde', async () => {
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
      quizStarted: false,
      preset: 'PLAYFUL',
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    getPersonalResultQueryMock.mockResolvedValue({
      totalScore: 10,
      rank: 3,
      bonusToken: 'BONUS-123',
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 80);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const bottomActions = host.querySelector('.vote-page__bottom-actions') as HTMLElement | null;
    expect(host.querySelector('.vote-feedback-card')).toBeNull();
    expect(bottomActions).not.toBeNull();
    expect(bottomActions?.textContent).toContain('Code kopieren');
    expect(bottomActions?.textContent).toContain('Zur Startseite');
    expect(bottomActions?.textContent).not.toMatch(/Absenden!|Bewertung absenden/);
    expect(getHasSubmittedFeedbackQueryMock).not.toHaveBeenCalled();
    expect(navSpy).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('zeigt bei aktiver Standalone-Q&A-Session das Frageformular', async () => {
    localStorage.setItem('arsnova-nickname-ABC123', 'Roter Drache 2');
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
      nicknameTheme: 'KINDERGARTEN',
      anonymousMode: false,
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    TestBed.inject(ThemePresetService).setPreset('serious', { silent: true });
    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#qa-draft')).not.toBeNull();
    expect(host.querySelector('.session-qa-form__meta .session-qa-form__submit')).toBeNull();
    expect(
      host.querySelector('.vote-page__bottom-actions .session-qa-form__submit'),
    ).not.toBeNull();
    expect(host.querySelector('.session-qa-form__identity-badge')?.textContent?.trim()).toBe(
      '🐉 2',
    );
    expect(host.textContent).toContain('Du fragst als');
    expect(host.querySelector('.session-qa-form__label')).toBeNull();
    expect(host.querySelector('#qa-draft')?.getAttribute('aria-label')).toBe('Deine Frage');
    expect(host.textContent).not.toContain('Neue Inhalte erscheinen hier automatisch.');
    fixture.destroy();
  });

  it('leitet fuer Kindergarten-Q&A-Fragen eindeutige Tier-Badges ab', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.componentInstance.sessionSettings.set({
      nicknameTheme: 'KINDERGARTEN',
      anonymousMode: false,
    });

    expect(
      fixture.componentInstance.qaAuthorKindergartenBadgeLabel({
        id: 'question-1',
        text: 'Wie viel Stoff ist klausurrelevant?',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        authorNickname: 'Roter Drache 2',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      }),
    ).toBe('🐉 2');
    fixture.destroy();
  });

  it('nutzt fuer den Q&A-Autojoin fortlaufende Kita-Reserve-Namen statt Zufallszahlen', async () => {
    localStorage.removeItem('arsnova-participant-ABC123');
    localStorage.removeItem('arsnova-nickname-ABC123');
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'Q_AND_A',
      status: 'ACTIVE',
      quizName: null,
      title: 'Offene Fragen',
      participantCount: NICKNAME_LISTS.KINDERGARTEN.length + 1,
      preset: 'SERIOUS',
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    getParticipantNicknamesQueryMock.mockResolvedValue({
      nicknames: [...NICKNAME_LISTS.KINDERGARTEN, 'Roter Drache 2'],
      participantCount: NICKNAME_LISTS.KINDERGARTEN.length + 1,
    });
    joinMutateMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '33333333-3333-4333-8333-333333333333',
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.activeChannel.set('qa');
    component.updateQaDraft('Kommt Aufgabe 3 in der Klausur vor?');
    fixture.detectChanges();

    await component.submitQaQuestion();

    expect(joinMutateMock).toHaveBeenCalledWith({
      code: 'ABC123',
      nickname: 'Grüner Frosch 2',
    });
    expect(localStorage.getItem('arsnova-nickname-ABC123')).toBe('Grüner Frosch 2');
    expect(qaSubmitMutateMock).toHaveBeenCalledWith({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '33333333-3333-4333-8333-333333333333',
      text: 'Kommt Aufgabe 3 in der Klausur vor?',
    });
    fixture.destroy();
  });

  it('selektiert Q&A-Fragen per Tier-Badge und hebt die Auswahl wieder auf', () => {
    localStorage.setItem('arsnova-nickname-ABC123', 'Roter Drache 2');
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;
    component.status.set('ACTIVE');
    component.activeChannel.set('qa');
    component.sessionSettings.set({
      type: 'Q_AND_A',
      status: 'ACTIVE',
      title: 'Offene Fragen',
      nicknameTheme: 'KINDERGARTEN',
      anonymousMode: false,
    } as never);
    component.qaQuestions.set([
      {
        id: 'question-1',
        text: 'Wie viel Stoff ist klausurrelevant?',
        upvoteCount: 2,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        authorNickname: 'Roter Drache 2',
        myVote: null,
        isOwn: false,
        hasUpvoted: false,
      },
      {
        id: 'question-2',
        text: 'Gibt es eine Musterlösung?',
        upvoteCount: 1,
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

    (host.querySelector('.session-qa-card__author-icon') as HTMLButtonElement).click();
    fixture.detectChanges();
    cards = host.querySelectorAll('.session-qa-card');

    expect(component.qaSelectedAuthorNickname()).toBeNull();
    expect(cards).toHaveLength(2);
    expect(cards[0]?.className).not.toContain('session-qa-card--author-selected');

    (host.querySelectorAll('.session-qa-card__author-icon')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    cards = host.querySelectorAll('.session-qa-card');

    expect(component.qaSelectedAuthorNickname()).toBe('Grüner Frosch');
    expect(cards).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    cards = host.querySelectorAll('.session-qa-card');

    expect(component.qaSelectedAuthorNickname()).toBeNull();
    expect(cards).toHaveLength(2);
    expect(cards[1]?.className).not.toContain('session-qa-card--author-selected');

    (host.querySelector('.session-qa-form__identity-badge') as HTMLButtonElement).click();
    fixture.detectChanges();
    cards = host.querySelectorAll('.session-qa-card');

    expect(component.qaSelectedAuthorNickname()).toBe('Roter Drache 2');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.className).toContain('session-qa-card--author-selected');
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
    await flushComponentAfterStable(fixture, 50);
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
    setConfirmedParticipantTeam('ABC123', {
      id: '22222222-2222-4222-8222-222222222222',
      name: ':apple:',
      color: '#1E88E5',
    });
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
      teamMode: true,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
      },
    });
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
          memberCount: 2,
        },
      ],
    });
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-player-badge--arrival')).not.toBeNull();
    expect(host.querySelector('.vote-lobby--arrival')).not.toBeNull();
    expect(host.querySelector('.vote-player-badge__team-emoji')?.textContent).toBe('🍎');
    expect(host.textContent ?? '').toContain('Perfekt!');
    expect(host.textContent ?? '').toContain('wartet schon auf dich.');
    expect(sessionStorage.getItem('arsnova-join-arrival:ABC123')).toBeNull();
    expect(peekConfirmedParticipantTeam('ABC123')).toBeNull();
    fixture.destroy();
  });

  it('unterdrueckt den Arrival-Moment, wenn Belohnungseffekte deaktiviert sind', async () => {
    localStorage.setItem('arsnova-nickname-ABC123', 'Ada');
    setParticipantJoinArrival('ABC123');
    getInfoQueryMock.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      serverTime: MOCK_SERVER_TIME,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      preset: 'PLAYFUL',
      enableRewardEffects: false,
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
    await flushComponentAfterStable(fixture, 50);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.vote-player-badge--arrival')).toBeNull();
    expect(host.querySelector('.vote-lobby--arrival')).toBeNull();
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
    await flushComponentAfterStable(fixture, 50);
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
      locked: false,
      totalVotes: 12,
      distribution: { POSITIVE: 5, NEUTRAL: 4, NEGATIVE: 3 },
      currentRound: 2,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);
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
    await flushComponentAfterStable(fixture, 50);

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
    await flushComponentAfterStable(fixture, 50);
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
    await flushComponentAfterStable(fixture, 50);

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
    await flushComponentAfterStable(fixture, 50);

    const component = fixture.componentInstance;
    component.selectChannel('quickFeedback');
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

  it('lässt Clients manuell vom Blitzlicht zurück in den Q&A-Kanal wechseln', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;
    component.status.set('ACTIVE');
    component.sessionSettings.set({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      serverTime: MOCK_SERVER_TIME,
      quizName: 'Team-Quiz',
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    } as never);
    component.quickFeedbackResult.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
      currentRound: 1,
    });
    (
      component as unknown as {
        ensureActiveChannel: () => void;
      }
    ).ensureActiveChannel();

    expect(component.activeChannel()).toBe('quickFeedback');

    component.selectChannel('qa');

    expect(component.activeChannel()).toBe('qa');

    component.quickFeedbackResult.set({
      type: 'MOOD',
      locked: false,
      totalVotes: 4,
      distribution: { POSITIVE: 2, NEUTRAL: 1, NEGATIVE: 1 },
      currentRound: 1,
    });
    (
      component as unknown as {
        ensureActiveChannel: () => void;
      }
    ).ensureActiveChannel();

    expect(component.activeChannel()).toBe('qa');
    fixture.destroy();
  });

  it('zieht Clients bei einer neuen Blitzlicht-Vergleichsrunde wieder in den Blitzlicht-Kanal', () => {
    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;
    component.status.set('ACTIVE');
    component.sessionSettings.set({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      serverTime: MOCK_SERVER_TIME,
      quizName: 'Team-Quiz',
      participantCount: 6,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    } as never);
    (
      component as unknown as {
        applyQuickFeedbackResult: (result: unknown) => void;
        ensureActiveChannel: () => void;
      }
    ).applyQuickFeedbackResult({
      type: 'MOOD',
      locked: true,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
      currentRound: 1,
      discussion: true,
    });
    (
      component as unknown as {
        ensureActiveChannel: () => void;
      }
    ).ensureActiveChannel();

    expect(component.activeChannel()).toBe('quickFeedback');

    component.selectChannel('qa');

    expect(component.activeChannel()).toBe('qa');

    (
      component as unknown as {
        applyQuickFeedbackResult: (result: unknown) => void;
        ensureActiveChannel: () => void;
      }
    ).applyQuickFeedbackResult({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
      currentRound: 2,
      discussion: false,
    });
    (
      component as unknown as {
        ensureActiveChannel: () => void;
      }
    ).ensureActiveChannel();

    expect(component.activeChannel()).toBe('quickFeedback');
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
    await flushMacroTask(0);
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
    await flushMacroTask(0);
    fixture.detectChanges();

    c.activeChannel.set('quickFeedback');
    fixture.detectChanges();
    expect(c.activeChannel()).toBe('quiz');

    fixture.destroy();
  });

  it('folgt einem geänderten bevorzugten Live-Kanal, ohne die Rückkehr ins Quiz zu blockieren', async () => {
    let quickFeedbackListener: ((data: unknown) => void) | null = null;

    quickFeedbackOnResultsSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        quickFeedbackListener = opts.onData;
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
    currentQuestionQueryMock.mockResolvedValue(null);

    const fixture = TestBed.createComponent(SessionVoteComponent);
    const component = fixture.componentInstance;
    component.status.set('ACTIVE');
    component.sessionSettings.set({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      serverTime: MOCK_SERVER_TIME,
      quizName: 'Team-Quiz',
      participantCount: 6,
      preset: 'SERIOUS',
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
      preferredChannel: 'quickFeedback',
    } as never);
    expect(component.channels().quickFeedback).toBe(true);
    (
      component as unknown as {
        applyPreferredChannelIfChanged: (channel: 'quiz' | 'qa' | 'quickFeedback') => void;
        ensureQuickFeedbackSubscription: () => void;
        ensureActiveChannel: () => void;
      }
    ).ensureQuickFeedbackSubscription();
    (
      component as unknown as {
        applyPreferredChannelIfChanged: (channel: 'quiz' | 'qa' | 'quickFeedback') => void;
      }
    ).applyPreferredChannelIfChanged('quickFeedback');
    (
      component as unknown as {
        ensureActiveChannel: () => void;
      }
    ).ensureActiveChannel();

    expect(quickFeedbackOnResultsSubscribeMock).toHaveBeenCalledWith(
      { sessionCode: 'ABC123' },
      expect.objectContaining({ onData: expect.any(Function) }),
    );

    quickFeedbackListener?.({
      type: 'MOOD',
      locked: false,
      totalVotes: 3,
      distribution: { POSITIVE: 1, NEUTRAL: 1, NEGATIVE: 1 },
      currentRound: 1,
    });
    fixture.detectChanges();

    expect(component.activeChannel()).toBe('quickFeedback');

    component.sessionSettings.update((current) => ({
      ...current,
      preferredChannel: 'qa',
    }));
    (
      component as unknown as {
        applyPreferredChannelIfChanged: (channel: 'quiz' | 'qa' | 'quickFeedback') => void;
      }
    ).applyPreferredChannelIfChanged('qa');

    expect(component.activeChannel()).toBe('qa');

    component.currentQuestion.set({
      id: 'question-1',
      type: 'RATING',
      order: 1,
      points: 0,
      timeLimit: 60,
      currentRound: 1,
      answers: [],
    } as never);
    component.voteSent.set(true);
    component.selectChannel('quiz');

    expect(component.activeChannel()).toBe('quiz');
    (
      component as unknown as {
        ensureActiveChannel: () => void;
      }
    ).ensureActiveChannel();
    expect(component.activeChannel()).toBe('quiz');
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

  it('räumt Live-Kanal-Subscriptions beim FINISHED-Statussignal ab', async () => {
    const statusUnsubscribe = vi.fn();
    const qaUnsubscribe = vi.fn();
    const quickFeedbackUnsubscribe = vi.fn();
    let statusListener: ((data: unknown) => void) | null = null;

    statusChangedSubscribeMock.mockImplementation(
      (_input: unknown, opts: { onData: (d: unknown) => void }) => {
        statusListener = opts.onData;
        return { unsubscribe: statusUnsubscribe };
      },
    );
    qaQuestionsUpdatedSubscribeMock.mockReturnValue({ unsubscribe: qaUnsubscribe });
    quickFeedbackOnResultsSubscribeMock.mockReturnValue({ unsubscribe: quickFeedbackUnsubscribe });
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
        qa: { enabled: true, open: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true, open: true },
      },
    });
    currentQuestionQueryMock.mockResolvedValue(null);
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'MOOD',
      locked: false,
      totalVotes: 0,
      distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
      currentRound: 1,
    });

    const fixture = TestBed.createComponent(SessionVoteComponent);
    fixture.detectChanges();
    await flushComponentAfterStable(fixture, 50);

    expect(statusListener).not.toBeNull();
    expect(qaQuestionsUpdatedSubscribeMock).toHaveBeenCalled();
    expect(quickFeedbackOnResultsSubscribeMock).toHaveBeenCalled();

    statusListener?.({
      status: 'FINISHED',
      currentQuestion: null,
      currentRound: 1,
      serverTime: MOCK_SERVER_TIME,
    });

    expect(fixture.componentInstance.status()).toBe('FINISHED');
    expect(statusUnsubscribe).toHaveBeenCalled();
    expect(qaUnsubscribe).toHaveBeenCalled();
    expect(quickFeedbackUnsubscribe).toHaveBeenCalled();
    fixture.destroy();
  });

  it('setzt bei Peer-Instruction-Runde 2 ohne Status-Event den Abstimmungszustand zurück', async () => {
    const nowIso = new Date().toISOString();
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
        expect(fixture.componentInstance.currentRound()).toBe(1);
      },
      { timeout: 3000, interval: 10 },
    );

    const component = fixture.componentInstance;
    component.voteSent.set(true);
    component.selectedAnswerIds.set(new Set(['a1']));
    component.motivationMessage.set('Weiter so');
    component.scorecard.set({
      questionOrder: 1,
      totalQuestions: 3,
      currentRank: 2,
      totalScore: 120,
      wasCorrect: true,
      streakCount: 1,
      rankChange: 0,
    } as never);

    await (component as unknown as { refreshQuestion: () => Promise<void> }).refreshQuestion();
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(component.currentRound()).toBe(2);
        expect(component.voteSent()).toBe(false);
        expect(component.selectedAnswerIds().size).toBe(0);
        expect(component.motivationMessage()).toBeNull();
        expect(component.scorecard()).toBeNull();
      },
      { timeout: 3000, interval: 10 },
    );

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
    await flushMacroTask(0);
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
    await flushComponentAfterStable(fixture, 50);

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
    await flushComponentAfterStable(fixture, 50);

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
    await flushComponentAfterStable(fixture, 50);

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
