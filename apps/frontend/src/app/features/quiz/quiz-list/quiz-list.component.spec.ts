import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { webcrypto } from 'node:crypto';
import { createLegacyQuizHistoryAccessProof } from '@arsnova/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizListComponent } from './quiz-list.component';
import { DEMO_QUIZ_ID, QuizStoreService, type QuizSummary } from '../data/quiz-store.service';

const {
  getActiveQuizIdsQueryMock,
  getQuizCollectionHistoryAvailabilityQueryMock,
  bindQuizHistoryScopeMutationMock,
  snackBarOpenMock,
} = vi.hoisted(() => ({
  getActiveQuizIdsQueryMock: vi.fn(),
  getQuizCollectionHistoryAvailabilityQueryMock: vi.fn(),
  bindQuizHistoryScopeMutationMock: vi.fn(),
  snackBarOpenMock: vi.fn(),
}));

vi.mock('../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive', async () => {
  const { Directive } = await import('@angular/core');

  class MarkdownImageLightboxDirective {}
  Directive({
    selector: '[appMarkdownImageLightbox]',
    standalone: true,
  })(MarkdownImageLightboxDirective);

  return { MarkdownImageLightboxDirective };
});

vi.mock('../../../core/trpc.client', () => ({
  clearPendingHostSessionCode: vi.fn(),
  setHostToken: vi.fn(),
  setPendingHostSessionCode: vi.fn(),
  trpc: {
    session: {
      getActiveQuizIds: {
        query: getActiveQuizIdsQueryMock,
      },
      getQuizCollectionHistoryAvailability: {
        query: getQuizCollectionHistoryAvailabilityQueryMock,
      },
      bindQuizHistoryScope: {
        mutate: bindQuizHistoryScopeMutationMock,
      },
    },
  },
}));

async function flushAsyncEffects(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('QuizListComponent', () => {
  const uploadPayload = {
    name: 'Datenbanken',
    description: undefined,
    motifImageUrl: null,
    showLeaderboard: true,
    allowCustomNicknames: true,
    defaultTimer: null,
    timerScaleByDifficulty: false,
    enableSoundEffects: true,
    enableRewardEffects: true,
    enableMotivationMessages: true,
    enableEmojiReactions: true,
    showQuestionTypeIndicators: true,
    anonymousMode: false,
    teamMode: false,
    teamCount: undefined,
    teamAssignment: 'AUTO' as const,
    teamNames: [],
    backgroundMusic: undefined,
    nicknameTheme: 'NOBEL_LAUREATES' as const,
    bonusTokenCount: 3,
    readingPhaseEnabled: true,
    preset: 'PLAYFUL' as const,
    questions: [
      {
        text: 'Welche Sprache nutzt SQL?',
        type: 'SINGLE_CHOICE' as const,
        timer: null,
        difficulty: 'EASY' as const,
        order: 0,
        ratingMin: undefined,
        ratingMax: undefined,
        ratingLabelMin: undefined,
        ratingLabelMax: undefined,
        answers: [
          { text: 'Strukturierte Abfragen', isCorrect: true },
          { text: 'Nur Binärcode', isCorrect: false },
        ],
      },
    ],
  };
  const quizzesSignal = signal<QuizSummary[]>([]);
  const mockRoute = {
    snapshot: {
      queryParamMap: convertToParamMap({}),
    },
  };
  const mockStore = {
    quizzes: quizzesSignal.asReadonly(),
    syncRoomId: signal('sync-room-12345678'),
    syncConnectionState: signal<'connected' | 'connecting' | 'disconnected'>('connected'),
    librarySharingMode: signal<'local' | 'shared'>('local'),
    lastConnectedAt: signal<string | null>(null),
    lastLocalChangeAt: signal<string | null>(null),
    lastRemoteSyncAt: signal<string | null>(null),
    lastRemoteChangedQuizName: signal<string | null>(null),
    lastRemoteChangedQuizUpdatedAt: signal<string | null>(null),
    lastRemoteChangedByDeviceLabel: signal<string | null>(null),
    lastRemoteChangedByBrowserLabel: signal<string | null>(null),
    originSharedAt: signal<string | null>(null),
    originDeviceLabel: signal<string | null>(null),
    originBrowserLabel: signal<string | null>(null),
    currentDeviceLabel: signal('Mac'),
    currentBrowserLabel: signal('Firefox'),
    syncPeerInfos: signal<Array<{ deviceId: string; deviceLabel: string; browserLabel: string }>>(
      [],
    ),
    duplicateQuiz: vi.fn(),
    deleteQuiz: vi.fn(),
    exportQuiz: vi.fn(),
    getUploadPayload: vi.fn(),
    importQuiz: vi.fn(),
    setLastServerUploadAccess: vi.fn(),
    setLastServerQuizAccessProof: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    quizzesSignal.set([]);
    mockRoute.snapshot.queryParamMap = convertToParamMap({});
    mockStore.librarySharingMode.set('local');
    mockStore.syncConnectionState.set('connected');
    mockStore.lastConnectedAt.set(null);
    mockStore.lastLocalChangeAt.set(null);
    mockStore.lastRemoteSyncAt.set(null);
    mockStore.lastRemoteChangedQuizName.set(null);
    mockStore.lastRemoteChangedQuizUpdatedAt.set(null);
    mockStore.lastRemoteChangedByDeviceLabel.set(null);
    mockStore.lastRemoteChangedByBrowserLabel.set(null);
    mockStore.originSharedAt.set(null);
    mockStore.originDeviceLabel.set(null);
    mockStore.originBrowserLabel.set(null);
    mockStore.currentDeviceLabel.set('Mac');
    mockStore.currentBrowserLabel.set('Firefox');
    mockStore.syncPeerInfos.set([]);
    mockStore.getUploadPayload.mockReturnValue(uploadPayload);
    vi.stubGlobal('crypto', webcrypto);
    getActiveQuizIdsQueryMock.mockResolvedValue([]);
    getQuizCollectionHistoryAvailabilityQueryMock.mockResolvedValue([]);
    bindQuizHistoryScopeMutationMock.mockReset();
    TestBed.configureTestingModule({
      imports: [QuizListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: QuizStoreService, useValue: mockStore },
        {
          provide: ActivatedRoute,
          useValue: mockRoute,
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

  it('zeigt den Empty-State ohne Quizzes', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Willkommen!');
    expect(fixture.nativeElement.textContent).toContain('Neues Quiz erstellen');
  });

  it('zeigt den Sync-Button in der Sammlung', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sammlung teilen');
  });

  it('zeigt bei geteilter Bibliothek einen sichtbaren Sync-Status', () => {
    mockStore.librarySharingMode.set('shared');
    mockStore.lastConnectedAt.set('2026-03-16T18:07:00.000Z');
    mockStore.lastLocalChangeAt.set('2026-03-16T18:05:00.000Z');
    mockStore.lastRemoteSyncAt.set('2026-03-16T18:06:00.000Z');
    mockStore.lastRemoteChangedQuizName.set('Datenbanken');
    mockStore.lastRemoteChangedQuizUpdatedAt.set('2026-03-16T18:04:00.000Z');
    mockStore.lastRemoteChangedByDeviceLabel.set('iPad');
    mockStore.lastRemoteChangedByBrowserLabel.set('Safari');
    mockStore.originSharedAt.set('2026-03-16T17:55:00.000Z');
    mockStore.originDeviceLabel.set('MacBook');
    mockStore.originBrowserLabel.set('Chrome');
    mockStore.syncPeerInfos.set([
      { deviceId: 'peer-1', deviceLabel: 'iPhone', browserLabel: 'Safari' },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Geteilte Quiz-Sammlung');
    expect(text).toContain('Hier siehst du, ob deine Quiz-Sammlung auf dem neuesten Stand ist');
    expect(text).toContain('Diese Angaben helfen nur bei der Orientierung');
    expect(text).toContain('Entscheidend bleibt der Sync-Link');
    expect(text).toContain('Verbunden');
    expect(text).not.toContain('Sync-Kurzcode');
    expect(text).toContain('Du arbeitest gerade auf');
    expect(text).toContain('Mac · Firefox');
    expect(text).toContain('Gerade 1 weiteres Gerät aktiv');
    expect(text).toContain('iPhone · Safari');
    expect(text).toContain('Zuletzt verbunden');
    expect(text).toContain('Ursprünglich freigegeben von');
    expect(text).toContain('MacBook · Chrome');
    expect(text).toContain('Freigegeben am');
    expect(text).toContain('Zuletzt übernommen');
    expect(text).toContain('Datenbanken');
    expect(text).toContain('Datenbanken ·');
    expect(text).toContain('Kam von');
    expect(text).toContain('iPad · Safari');
    expect(text).toContain('Zuletzt hier geändert');
  });

  it('zeigt bei geteilter Bibliothek ohne weitere Geräte den Status "Bereit"', () => {
    mockStore.librarySharingMode.set('shared');
    mockStore.syncConnectionState.set('connected');
    mockStore.syncPeerInfos.set([]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Bereit');
    expect(text).not.toContain('Verbunden');
  });

  it('exportiert Quiz-Dateien mit sprachneutralem ASCII-Dateinamen', () => {
    mockStore.exportQuiz.mockReturnValue({
      quiz: {
        name: 'Überprüfung / SQL? 101',
      },
    });
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) =>
        tagName.toLowerCase() === 'a'
          ? anchor
          : originalCreateElement(tagName)) as typeof document.createElement);
    const urlCreateSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:quiz-export');
    const urlRevokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    component.exportQuiz('quiz-1');

    expect(anchor.download).toBe('arsnova-quiz-Uberprufung-SQL-101.json');
    expect(anchor.href).toContain('blob:quiz-export');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(urlCreateSpy).toHaveBeenCalledTimes(1);
    expect(urlRevokeSpy).toHaveBeenCalledWith('blob:quiz-export');

    createElementSpy.mockRestore();
    urlCreateSpy.mockRestore();
    urlRevokeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('zeigt nach einem Sync-Import einen Snackbar-Hinweis', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);
    mockRoute.snapshot.queryParamMap = convertToParamMap({ syncImported: '1' });

    const fixture = TestBed.createComponent(QuizListComponent);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await (
      fixture.componentInstance as QuizListComponent & {
        handleSyncImportNoticeIfRequested: () => Promise<void>;
      }
    ).handleSyncImportNoticeIfRequested();

    expect(snackBarOpenMock).toHaveBeenCalledTimes(1);
    expect(snackBarOpenMock.mock.calls[0]?.[0]).toContain(
      'Quiz-Sammlung erfolgreich synchronisiert.',
    );
    expect(snackBarOpenMock.mock.calls[0]?.[0]).toContain('Neuester Stand vom');
    expect(snackBarOpenMock).toHaveBeenCalledWith(expect.any(String), '', {
      duration: 9000,
      verticalPosition: 'top',
      horizontalPosition: 'center',
    });
  });

  it('zeigt gespeicherte Quizzes in der Liste', () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Datenbanken');
    expect(text).toContain('SQL Grundlagen');
    const link = fixture.nativeElement.querySelector('.quiz-list-item__link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('aria-label')).toContain('Datenbanken');
  });

  it('zeigt auf der Demo-Quizkarte einen Beispiellink zum Nachbesprechungsplan-PDF', () => {
    quizzesSignal.set([
      {
        id: DEMO_QUIZ_ID,
        name: 'Demo-Quiz',
        description: 'Showcase',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 3,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const demoPdfLinks = fixture.nativeElement.querySelectorAll(
      'a.quiz-list-item__demo-pdf',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(demoPdfLinks.length).toBe(1);
    expect(demoPdfLinks[0]?.textContent).toContain('Beispiel-Nachbesprechungsplan');
    expect(demoPdfLinks[0]?.getAttribute('href')).toContain(
      '/assets/demo/demo-session-results-30.pdf',
    );
    expect(demoPdfLinks[0]?.getAttribute('target')).toBe('_blank');
    expect(demoPdfLinks[0]?.getAttribute('rel')).toContain('noopener');
  });

  it('rendert Markdown in der Quiz-Beschreibung', () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Deep Learning Quiz',
        description: 'Teste dein Wissen über **Deep Learning**.',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const description = fixture.nativeElement.querySelector(
      '.quiz-list-item__description',
    ) as HTMLElement;
    expect(description.innerHTML).toContain('<strong>Deep Learning</strong>');
  });

  it('rendert Bilder mit relativem /assets-Pfad in der Quiz-Beschreibung', () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Demo',
        description: '![Banner](/assets/demo/9_konzeptfragen_panorama.svg)',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 1,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const description = fixture.nativeElement.querySelector(
      '.quiz-list-item__description',
    ) as HTMLElement;
    expect(description.innerHTML).toContain('<img');
    expect(description.innerHTML).toContain('assets/demo/9_konzeptfragen_panorama.svg');
  });

  it('cacht gerenderte Quiz-Beschreibungen fuer identische Texte', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    const source = '![Banner](/assets/demo/9_konzeptfragen_panorama.svg)';

    const first = component.renderDescription(source);
    const second = component.renderDescription(source);

    expect(second).toBe(first);
    fixture.destroy();
  });

  it('zeigt im More-Menü den Eintrag Bearbeiten', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushAsyncEffects();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '.quiz-list-item__menu-trigger',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Bearbeiten');
  });

  it('markiert Quizzes mit aktiver Session als live', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: '11111111-1111-4111-8111-111111111111',
        lastServerQuizAccessProof:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ]);
    getActiveQuizIdsQueryMock.mockResolvedValue([
      {
        quizId: '11111111-1111-4111-8111-111111111111',
        participantCountIncludingHost: 7,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    await fixture.componentInstance.ngOnInit();

    expect(getActiveQuizIdsQueryMock).toHaveBeenCalledWith([
      {
        quizId: '11111111-1111-4111-8111-111111111111',
        accessProof: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ]);

    fixture.componentInstance['activeLiveQuizParticipants'].set(
      new Map([['11111111-1111-4111-8111-111111111111', 7]]),
    );
    expect(fixture.componentInstance.isQuizLive('e31fef3f-f7b1-4705-a739-28c8ec4486bf')).toBe(true);
    expect(
      fixture.componentInstance.liveParticipantCountIncludingHost(
        'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      ),
    ).toBe(7);
  });

  it('graut Bonus-Codes und Nachbesprechungsplan aus, wenn noch keine Inhalte vorhanden sind', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: true,
        lastServerQuizId: '11111111-1111-4111-8111-111111111111',
        lastServerQuizAccessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      },
    ]);
    getQuizCollectionHistoryAvailabilityQueryMock.mockResolvedValue([
      {
        quizId: '11111111-1111-4111-8111-111111111111',
        hasBonusTokens: false,
        hasLastSessionAnalysis: false,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushAsyncEffects();
    fixture.detectChanges();
    await flushAsyncEffects();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.quiz-list-item__actions button'),
    ) as HTMLButtonElement[];
    const bonusButton = buttons.find((button) => button.textContent?.includes('Bonus-Codes'));
    const pdfButton = buttons.find((button) =>
      button.textContent?.includes('Nachbesprechungsplan'),
    );

    expect(getQuizCollectionHistoryAvailabilityQueryMock).toHaveBeenCalledWith([
      {
        quizId: '11111111-1111-4111-8111-111111111111',
        accessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      },
    ]);
    expect(bonusButton?.disabled).toBe(true);
    expect(pdfButton?.disabled).toBe(true);
  });

  it('aktiviert Bonus-Codes und Nachbesprechungsplan nur bei vorhandenen Inhalten', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: true,
        lastServerQuizId: '11111111-1111-4111-8111-111111111111',
        lastServerQuizAccessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      },
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.componentInstance.quizHistoryAvailability.set(
      new Map([
        [
          'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
          {
            hasBonusTokens: true,
            hasLastSessionAnalysis: true,
          },
        ],
      ]),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.quiz-list-item__actions button'),
    ) as HTMLButtonElement[];
    const bonusButton = buttons.find((button) => button.textContent?.includes('Bonus-Codes'));
    const pdfButton = buttons.find((button) =>
      button.textContent?.includes('Nachbesprechungsplan'),
    );

    expect(bonusButton?.disabled).toBe(false);
    expect(pdfButton?.disabled).toBe(false);
  });

  it('fragt Historie auch ohne gespeicherten Zugriffsnachweis ab und migriert Legacy-Scopes', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: true,
        lastServerQuizId: '11111111-1111-4111-8111-111111111111',
        lastServerQuizAccessProof: null,
      },
    ]);
    const legacyAccessProof = await createLegacyQuizHistoryAccessProof(uploadPayload);
    bindQuizHistoryScopeMutationMock.mockResolvedValue({
      accessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
    });
    getQuizCollectionHistoryAvailabilityQueryMock.mockResolvedValue([
      {
        quizId: '11111111-1111-4111-8111-111111111111',
        hasBonusTokens: true,
        hasLastSessionAnalysis: true,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushAsyncEffects();
    await vi.waitFor(() => {
      expect(bindQuizHistoryScopeMutationMock).toHaveBeenCalledWith({
        quizId: '11111111-1111-4111-8111-111111111111',
        accessProof: legacyAccessProof,
        historyScopeId: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      });
    });

    expect(mockStore.setLastServerQuizAccessProof).toHaveBeenCalledWith(
      'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
    );
    expect(getQuizCollectionHistoryAvailabilityQueryMock).toHaveBeenCalledWith([
      {
        quizId: '11111111-1111-4111-8111-111111111111',
        accessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      },
    ]);
    expect(
      fixture.componentInstance
        .quizHistoryAvailability()
        .get('e31fef3f-f7b1-4705-a739-28c8ec4486bf'),
    ).toEqual({
      hasBonusTokens: true,
      hasLastSessionAnalysis: true,
    });
  });

  it('blendet die Startvorlagen-Vorschau in Schritt 1 ein und aus', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    component.showAiImport.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('anspruchsvolle Quizfragen');
    expect(fixture.nativeElement.textContent).not.toContain('Antwort prüfen lassen');
    expect(fixture.nativeElement.textContent).toContain('Quizqualität prüfen');
    expect(fixture.nativeElement.textContent).toContain('Prüfvorlage kopieren');
    expect(component.showKiPromptPreview()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('You create importable quiz JSON');
    expect(component.showKiValidationPromptPreview()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain(
      'QA Postproduction for arsnova.eu Quiz JSON',
    );

    component.toggleKiPromptPreview();
    fixture.detectChanges();

    expect(component.showKiPromptPreview()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('You create importable quiz JSON');
    const pre = fixture.nativeElement.querySelector(
      '.quiz-list__ai-prompt-markdown pre code',
    ) as HTMLElement | null;
    expect(pre?.textContent).toContain('"exportVersion"');

    component.toggleKiValidationPromptPreview();
    fixture.detectChanges();

    expect(component.showKiValidationPromptPreview()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'QA Postproduction for arsnova.eu Quiz JSON',
    );

    component.toggleKiPromptPreview();
    fixture.detectChanges();
    expect(component.showKiPromptPreview()).toBe(false);
  });

  it('zeigt nach dem Kopieren der KI-Vorlagen eine sichtbare Bestätigung', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;

    await component.copyKiPrompt();

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('You create importable quiz JSON'),
    );
    expect(component.actionInfo()).toBe('Die Startvorlage wurde in die Zwischenablage kopiert.');
    expect(snackBarOpenMock).toHaveBeenLastCalledWith(
      'Die Startvorlage wurde in die Zwischenablage kopiert.',
      '',
      {
        duration: 4000,
        verticalPosition: 'top',
        horizontalPosition: 'center',
      },
    );

    await component.copyKiValidationPrompt();

    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining('QA Postproduction for arsnova.eu Quiz JSON'),
    );
    expect(component.actionInfo()).toBe('Die Prüfvorlage wurde in die Zwischenablage kopiert.');
    expect(snackBarOpenMock).toHaveBeenLastCalledWith(
      'Die Prüfvorlage wurde in die Zwischenablage kopiert.',
      '',
      {
        duration: 4000,
        verticalPosition: 'top',
        horizontalPosition: 'center',
      },
    );
    expect(snackBarOpenMock).toHaveBeenCalledTimes(2);
  });

  it('scrollt beim Öffnen der KI-Import-Karte zum Panel', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance as QuizListComponent & {
      scrollAiImportPanelIntoViewAfterRender: () => void;
    };
    const scrollSpy = vi
      .spyOn(component, 'scrollAiImportPanelIntoViewAfterRender')
      .mockImplementation(() => {});

    component.toggleAiImport();

    expect(component.showAiImport()).toBe(true);
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    component.showKiPromptPreview.set(true);
    component.showKiValidationPromptPreview.set(true);
    component.toggleAiImport();

    expect(component.showAiImport()).toBe(false);
    expect(component.showKiPromptPreview()).toBe(false);
    expect(component.showKiValidationPromptPreview()).toBe(false);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('richtet die KI-Import-Karte im App-Scrollcontainer aus', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance as QuizListComponent & {
      scrollAiImportPanelIntoView: () => boolean;
    };
    const scrollRoot = document.createElement('main');
    scrollRoot.className = 'app-main';
    scrollRoot.style.paddingTop = '64px';
    scrollRoot.scrollTop = 240;
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, bottom: 600, left: 0, right: 360, width: 360, height: 600 }) as DOMRect;
    const scrollTo = vi.fn((options: ScrollToOptions) => {
      scrollRoot.scrollTop = Number(options.top ?? 0);
    });
    scrollRoot.scrollTo = scrollTo;
    document.body.appendChild(scrollRoot);
    scrollRoot.appendChild(fixture.nativeElement);

    component.showAiImport.set(true);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.quiz-list__ai-card') as HTMLElement;
    card.getBoundingClientRect = () =>
      ({ top: 500, bottom: 900, left: 0, right: 360, width: 360, height: 400 }) as DOMRect;

    expect(component.scrollAiImportPanelIntoView()).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 668, behavior: 'smooth' });

    scrollRoot.remove();
  });

  it('setzt die KI-Eingabe ohne Schliessen der Karte zurueck', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;

    component.showAiImport.set(true);
    component.updateAiJsonInput('{"quiz":{"name":"Import"}}');
    component['actionError'].set('Fehler');
    component['actionInfo'].set('Info');

    component.resetAiImport();

    expect(component.showAiImport()).toBe(true);
    expect(component.aiJsonInput()).toBe('');
    expect(component.actionError()).toBeNull();
    expect(component.actionInfo()).toBeNull();
  });

  it('importiert auch eine komplette KI-Chat-Antwort mit json-Codeblock', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    mockStore.importQuiz.mockReturnValue({
      quiz: {
        id: 'caece014-f7cd-4d26-a101-bd494379f95f',
        name: 'KI Import',
      },
      warnings: [],
    });

    component.updateAiJsonInput(`Hier ist dein Quiz:

\`\`\`json
{"quiz":{"name":"KI Import"}}
\`\`\`

Viel Erfolg beim Import.`);

    component.importAiJson();

    expect(mockStore.importQuiz).toHaveBeenCalledWith({ quiz: { name: 'KI Import' } });
    expect(component.actionError()).toBeNull();
    expect(component.actionInfo()).toContain('KI Import');
  });

  it('importiert ueber den Datei-Import der Quiz-Sammlung und zeigt nur nicht uebernommene Fragen', async () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    mockStore.importQuiz.mockImplementation(() => {
      quizzesSignal.set([
        {
          id: 'caece014-f7cd-4d26-a101-bd494379f95f',
          name: 'Datei Import',
          description: 'Neu importiert',
          createdAt: '2026-05-18T12:00:00.000Z',
          updatedAt: '2026-05-18T12:00:00.000Z',
          questionCount: 1,
          teamMode: false,
          hasBonus: false,
          lastServerQuizId: null,
          lastServerQuizAccessProof: null,
        },
      ]);
      return {
        quiz: {
          id: 'caece014-f7cd-4d26-a101-bd494379f95f',
          name: 'Datei Import',
        },
        warnings: [
          {
            kind: 'skipped_question',
            questionNumber: 1,
            questionText: 'Schätzfrage',
            message: 'Dieser Fragetyp wird in arsnova.eu noch nicht unterstützt.',
          },
          {
            kind: 'simplified_question',
            questionNumber: 2,
            questionText: 'Freitext',
            message: 'Sonderregeln für Freitext-Antworten wurden nicht übernommen.',
          },
        ],
      };
    });

    const file = {
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Click Import',
          questionList: [
            {
              TYPE: 'SingleChoiceQuestion',
              questionText: 'Eine Frage',
              answerOptionList: [
                { answerText: 'A', isCorrect: false },
                { answerText: 'B', isCorrect: true },
              ],
            },
          ],
        }),
      ),
    } as unknown as File;
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    await component.onImportFileSelected({ target: input } as Event);
    fixture.detectChanges();
    await flushAsyncEffects();
    fixture.detectChanges();

    expect(mockStore.importQuiz).toHaveBeenCalledWith({
      name: 'Click Import',
      questionList: [
        {
          TYPE: 'SingleChoiceQuestion',
          questionText: 'Eine Frage',
          answerOptionList: [
            { answerText: 'A', isCorrect: false },
            { answerText: 'B', isCorrect: true },
          ],
        },
      ],
    });
    expect(component.actionInfo()).toContain('Datei Import');
    expect(component.actionInfoWarnings()).toHaveLength(1);
    const infoText = fixture.nativeElement.querySelector('.quiz-list__info')?.textContent as string;
    expect(infoText).toContain('Nicht übernommen:');
    expect(infoText).toContain(
      'Frage 1: Dieser Fragetyp wird in arsnova.eu noch nicht unterstützt.',
    );
    expect(infoText).toContain('Schätzfrage');
    expect(infoText).not.toContain('Freitext');
    expect(component.actionError()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Datei Import');
  });

  it('zeigt beim Import angepasste Hinweise wie Selbsteinschaetzung', async () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    mockStore.importQuiz.mockImplementation(() => {
      quizzesSignal.set([
        {
          id: 'caece014-f7cd-4d26-a101-bd494379f95f',
          name: 'Click Import',
          description: 'Neu importiert',
          createdAt: '2026-05-18T12:00:00.000Z',
          updatedAt: '2026-05-18T12:00:00.000Z',
          questionCount: 1,
          teamMode: false,
          hasBonus: false,
          lastServerQuizId: null,
          lastServerQuizAccessProof: null,
        },
      ]);
      return {
        quiz: {
          id: 'caece014-f7cd-4d26-a101-bd494379f95f',
          name: 'Click Import',
        },
        warnings: [
          {
            kind: 'mapped_question',
            message: 'Die Selbsteinschätzung wurde für bewertbare Fragen übernommen.',
          },
        ],
      };
    });

    const file = {
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Click Import',
          questionList: [
            {
              TYPE: 'SingleChoiceQuestion',
              questionText: 'Eine Frage',
              answerOptionList: [
                { answerText: 'A', isCorrect: false },
                { answerText: 'B', isCorrect: true },
              ],
            },
          ],
        }),
      ),
    } as unknown as File;
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    await component.onImportFileSelected({ target: input } as Event);
    fixture.detectChanges();
    await flushAsyncEffects();
    fixture.detectChanges();

    expect(component.actionInfoWarnings()).toHaveLength(1);
    const infoText = fixture.nativeElement.querySelector('.quiz-list__info')?.textContent as string;
    expect(infoText).toContain('Beim Import angepasst:');
    expect(infoText).toContain(
      'Quiz: Die Selbsteinschätzung wurde für bewertbare Fragen übernommen.',
    );
    expect(component.actionError()).toBeNull();
  });

  it('zeigt direkten Start-CTA bei startLive-Shortcut', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
      {
        id: 'bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a',
        name: 'Netzwerke',
        description: 'OSI-Modell',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 3,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.componentInstance.startLiveShortcutMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Starten');
    expect(fixture.componentInstance.startLiveShortcutMode()).toBe(true);
  });

  it('startet die angeforderte Live-Session direkt fuer das angeforderte Quiz', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
      {
        id: 'bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a',
        name: 'Netzwerke',
        description: 'OSI-Modell',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:31:00.000Z',
        questionCount: 3,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: null,
        lastServerQuizAccessProof: null,
      },
    ]);
    mockRoute.snapshot.queryParamMap = convertToParamMap({
      startLiveQuiz: 'bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a',
    });

    const fixture = TestBed.createComponent(QuizListComponent);
    const openSpy = vi
      .spyOn(fixture.componentInstance, 'openLiveStartDialog' as keyof QuizListComponent)
      .mockResolvedValue(undefined);

    await (
      fixture.componentInstance as QuizListComponent & {
        activateLiveStartShortcutIfRequested: () => Promise<void>;
      }
    ).activateLiveStartShortcutIfRequested();

    expect(openSpy).toHaveBeenCalledWith('bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a', 'Netzwerke', 3);
  });

  it('uebergibt gespeicherten Zugriffsnachweis an den Bonus-Code-Dialog', async () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    const dialogOpenSpy = vi.spyOn(component['dialog'], 'open').mockReturnValue({} as never);
    component.quizHistoryAvailability.set(
      new Map([
        [
          'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
          {
            hasBonusTokens: true,
            hasLastSessionAnalysis: false,
          },
        ],
      ]),
    );

    await component.openBonusCodesDialog({
      id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      name: 'Datenbanken',
      description: null,
      createdAt: '2026-03-08T10:00:00.000Z',
      updatedAt: '2026-03-08T11:30:00.000Z',
      questionCount: 2,
      teamMode: false,
      hasBonus: true,
      lastServerQuizId: '11111111-1111-4111-8111-111111111111',
      lastServerQuizAccessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
    });

    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          serverQuizId: '11111111-1111-4111-8111-111111111111',
          accessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
          quizName: 'Datenbanken',
        }),
      }),
    );
    expect(bindQuizHistoryScopeMutationMock).not.toHaveBeenCalled();
  });

  it('bindet legacy quiz-historie beim ersten oeffnen an die stabile quiz-id', async () => {
    bindQuizHistoryScopeMutationMock.mockResolvedValue({
      accessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
    });

    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    const dialogOpenSpy = vi.spyOn(component['dialog'], 'open').mockReturnValue({} as never);
    component.quizHistoryAvailability.set(
      new Map([
        [
          'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
          {
            hasBonusTokens: true,
            hasLastSessionAnalysis: false,
          },
        ],
      ]),
    );

    await component.openBonusCodesDialog({
      id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      name: 'Datenbanken',
      description: null,
      createdAt: '2026-03-08T10:00:00.000Z',
      updatedAt: '2026-03-08T11:30:00.000Z',
      questionCount: 2,
      teamMode: false,
      hasBonus: true,
      lastServerQuizId: '11111111-1111-4111-8111-111111111111',
      lastServerQuizAccessProof: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    expect(bindQuizHistoryScopeMutationMock).toHaveBeenCalledWith({
      quizId: '11111111-1111-4111-8111-111111111111',
      accessProof: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      historyScopeId: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
    });
    expect(mockStore.setLastServerQuizAccessProof).toHaveBeenCalledWith(
      'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
    );
    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          serverQuizId: '11111111-1111-4111-8111-111111111111',
          accessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
          quizName: 'Datenbanken',
        }),
      }),
    );
  });
});
