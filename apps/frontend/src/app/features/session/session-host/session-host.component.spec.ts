import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionHostComponent } from './session-host.component';
import { ThemePresetService } from '../../../core/theme-preset.service';

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
  enableQaChannelMutateMock,
  enableQuickFeedbackChannelMutateMock,
  endMutateMock,
  updatePresetMutateMock,
  quickFeedbackUpdateStyleMutateMock,
  updateQaTitleMutateMock,
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
  enableQaChannelMutateMock: vi.fn(),
  enableQuickFeedbackChannelMutateMock: vi.fn(),
  endMutateMock: vi.fn(),
  updatePresetMutateMock: vi.fn(),
  quickFeedbackUpdateStyleMutateMock: vi.fn(),
  updateQaTitleMutateMock: vi.fn(),
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
      enableQaChannel: { mutate: enableQaChannelMutateMock },
      enableQuickFeedbackChannel: { mutate: enableQuickFeedbackChannelMutateMock },
      end: { mutate: endMutateMock },
      updatePreset: { mutate: updatePresetMutateMock },
      updateQaTitle: { mutate: updateQaTitleMutateMock },
      onParticipantJoined: { subscribe: onParticipantJoinedSubscribeMock },
      onStatusChanged: { subscribe: onStatusChangedSubscribeMock },
    },
    qa: {
      list: { query: qaListQueryMock },
      moderate: { mutate: qaModerateMutateMock },
      toggleModeration: { mutate: qaToggleModerationMutateMock },
      onQuestionsUpdated: { subscribe: qaOnQuestionsUpdatedSubscribeMock },
    },
    quickFeedback: {
      results: { query: vi.fn().mockResolvedValue({ totalVotes: 0, options: [] }) },
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
    enableQaChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: true, title: null, moderationMode: true },
      quickFeedback: { enabled: false },
    });
    enableQuickFeedbackChannelMutateMock.mockResolvedValue({
      quiz: { enabled: true },
      qa: { enabled: false, title: null, moderationMode: false },
      quickFeedback: { enabled: true },
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

  it('zeigt im Host auch noch inaktive Kanaele als Tabs an', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false },
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
        qa: { enabled: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false },
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
        qa: { enabled: true, title: 'Fragen', moderationMode: false },
        quickFeedback: { enabled: true },
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
        qa: { enabled: true, title: 'Fragen aus dem Publikum', moderationMode: false },
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
        qa: { enabled: true, title: 'Fragen aus dem Publikum', moderationMode: true },
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
        qa: { enabled: true, title: 'Offene Fragen', moderationMode: true },
        quickFeedback: { enabled: false },
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
    expect(fixture.componentInstance.activeChannel()).toBe('qa');
    expect(fixture.componentInstance.showPrimaryLiveView()).toBe(false);
    expect(text).toContain('Vorab-Moderation');
    expect(text).toContain('Session beenden');
    expect(text).toContain('Q&A-Word-Cloud anzeigen');
    fixture.destroy();
  });

  it('führt im Fragen-Tab eine Moderationsaktion aus', async () => {
    getInfoQueryMock.mockResolvedValue({
      ...defaultSession,
      channels: {
        quiz: { enabled: true },
        qa: { enabled: true, title: 'Fragen aus dem Publikum', moderationMode: true },
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
        qa: { enabled: true, title: 'Fragen aus dem Publikum', moderationMode: true },
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
        qa: { enabled: true, title: 'Fragen aus dem Publikum', moderationMode: true },
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
    expect(el.querySelector('.session-host__answers')).toBeNull();
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
          qa: { enabled: true, title: 'Fragen', moderationMode: true },
          quickFeedback: { enabled: false },
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
          qa: { enabled: true, title: 'Fragen', moderationMode: false },
          quickFeedback: { enabled: false },
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
