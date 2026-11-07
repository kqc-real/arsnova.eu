import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { webcrypto } from 'node:crypto';
import {
  createLegacyQuizHistoryAccessProof,
  QUIZ_UPLOAD_MAX_PAYLOAD_BYTES,
} from '@arsnova/shared-types';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionResultsExportService } from '../../../core/session-results-export.service';
import { QuizListComponent } from './quiz-list.component';
import { DEMO_QUIZ_ID, QuizStoreService, type QuizSummary } from '../data/quiz-store.service';
import {
  clearHostBrowserCapability,
  storeHostBrowserCapability,
} from '../../../core/host-recovery-access';
import { clearHostToken, setHostToken } from '../../../core/host-session-token';
import { HostScenarioService, type HostScenario } from '../../../core/host-scenario.service';
import type { SpecAccess } from '../../../testing/spec-access';

const {
  getActiveQuizIdsQueryMock,
  getQuizCollectionHistoryAvailabilityQueryMock,
  bindQuizHistoryScopeMutationMock,
  snackBarOpenMock,
  uploadQuizMutationMock,
  createSessionMutationMock,
} = vi.hoisted(() => ({
  getActiveQuizIdsQueryMock: vi.fn(),
  getQuizCollectionHistoryAvailabilityQueryMock: vi.fn(),
  bindQuizHistoryScopeMutationMock: vi.fn(),
  snackBarOpenMock: vi.fn(),
  uploadQuizMutationMock: vi.fn(),
  createSessionMutationMock: vi.fn(),
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
    quiz: { upload: { mutate: uploadQuizMutationMock } },
    session: {
      create: { mutate: createSessionMutationMock },
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
    motifImageCredit: null,
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
    deleteQuizzes: vi.fn(),
    exportQuiz: vi.fn(),
    getUploadPayload: vi.fn(),
    takeUploadLearningObjectiveWarning: vi.fn(),
    importQuiz: vi.fn(),
    setLastServerUploadAccess: vi.fn(),
    setLastServerQuizAccessProof: vi.fn(),
    unlinkSharedLibrary: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.deleteQuizzes.mockReset().mockReturnValue(0);
    localStorage.removeItem('arsnova-quiz-list-sort:v1');
    localStorage.removeItem('arsnova-host-scenario:v1');
    sessionStorage.removeItem('arsnova-host-scenario-session:v1:NEW123');
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
    mockStore.takeUploadLearningObjectiveWarning.mockReturnValue(null);
    vi.stubGlobal('crypto', webcrypto);
    getActiveQuizIdsQueryMock.mockResolvedValue([]);
    getQuizCollectionHistoryAvailabilityQueryMock.mockResolvedValue([]);
    bindQuizHistoryScopeMutationMock.mockReset();
    uploadQuizMutationMock.mockResolvedValue({ quizId: '11111111-1111-4111-8111-111111111111' });
    createSessionMutationMock.mockResolvedValue({ code: 'NEW123', hostToken: 'host-token' });
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

  afterEach(() => {
    localStorage.removeItem('arsnova-quiz-list-sort:v1');
    localStorage.removeItem('arsnova-host-scenario:v1');
    sessionStorage.removeItem('arsnova-host-scenario-session:v1:NEW123');
  });

  function summary(overrides: Partial<QuizSummary> = {}): QuizSummary {
    return {
      id: 'alpha',
      name: 'Alpha',
      description: null,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-02T10:00:00.000Z',
      questionCount: 5,
      teamMode: false,
      hasBonus: false,
      lastServerQuizId: null,
      lastServerQuizAccessProof: null,
      ...overrides,
    };
  }

  const sortableQuizzes = [
    summary({
      id: 'quiz10',
      name: 'Quiz 10',
      questionCount: 10,
      createdAt: '2026-03-03T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    }),
    summary({
      id: 'zebra',
      name: 'Zebra',
      questionCount: 2,
      createdAt: '2026-03-02T10:00:00.000Z',
      updatedAt: '2026-03-03T10:00:00.000Z',
    }),
    summary({ id: 'quiz2', name: 'Quiz 2' }),
    summary(),
  ];

  it('sortiert standardmäßig natürlich nach Titel, ohne die Sammlung zu verändern', () => {
    quizzesSignal.set(sortableQuizzes);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.sortMode()).toBe('title-asc');
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('.quiz-list-item__title')).map((title) =>
        (title as HTMLElement).textContent?.trim(),
      ),
    ).toEqual(['Alpha', 'Quiz 2', 'Quiz 10', 'Zebra']);
    expect(quizzesSignal()).toBe(sortableQuizzes);
    expect(quizzesSignal().map((quiz) => quiz.id)).toEqual(['quiz10', 'zebra', 'quiz2', 'alpha']);
  });

  it.each([
    ['title-asc', ['alpha', 'quiz2', 'quiz10', 'zebra']],
    ['title-desc', ['zebra', 'quiz10', 'quiz2', 'alpha']],
    ['updated-desc', ['zebra', 'alpha', 'quiz2', 'quiz10']],
    ['created-desc', ['quiz10', 'zebra', 'alpha', 'quiz2']],
    ['questions-asc', ['zebra', 'alpha', 'quiz2', 'quiz10']],
    ['questions-desc', ['quiz10', 'alpha', 'quiz2', 'zebra']],
  ])('sortiert nach %s und löst Gleichstände nach Titel auf', (mode, expected) => {
    quizzesSignal.set(sortableQuizzes);
    const component = TestBed.createComponent(QuizListComponent).componentInstance;
    component.setSortMode(mode as string);
    expect(component.sortedQuizzesForList().map((quiz) => quiz.id)).toEqual(expected);
  });

  it('löst identische Titel unabhängig von der Eingangsreihenfolge stabil auf', () => {
    quizzesSignal.set([summary({ id: 'b' }), summary({ id: 'a' })]);
    const component = TestBed.createComponent(QuizListComponent).componentInstance;
    expect(component.sortedQuizzesForList().map((quiz) => quiz.id)).toEqual(['a', 'b']);
    quizzesSignal.update((quizzes) => [...quizzes].reverse());
    expect(component.sortedQuizzesForList().map((quiz) => quiz.id)).toEqual(['a', 'b']);
  });

  it('speichert die Auswahl aus dem Sortierfeld und stellt sie beim erneuten Öffnen wieder her', async () => {
    quizzesSignal.set(sortableQuizzes);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('mat-select') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const option = Array.from(document.querySelectorAll('mat-option')).find((element) =>
      element.textContent?.includes('Wenigste Fragen zuerst'),
    ) as HTMLElement;
    option.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.sortMode()).toBe('questions-asc');
    expect(localStorage.getItem('arsnova-quiz-list-sort:v1')).toBe('questions-asc');
    fixture.destroy();
    const reopened = TestBed.createComponent(QuizListComponent);
    reopened.detectChanges();
    await reopened.whenStable();
    reopened.detectChanges();
    expect(reopened.componentInstance.sortMode()).toBe('questions-asc');
    expect(reopened.nativeElement.querySelector('mat-select').textContent).toContain(
      'Wenigste Fragen zuerst',
    );
  });

  it('verwendet bei ungültig gespeicherter Auswahl A–Z und ignoriert ungültige Änderungen', () => {
    localStorage.setItem('arsnova-quiz-list-sort:v1', 'legacy-or-invalid');
    const component = TestBed.createComponent(QuizListComponent).componentInstance;
    expect(component.sortMode()).toBe('title-asc');
    component.setSortMode('unrecognized');
    expect(component.sortMode()).toBe('title-asc');
    expect(localStorage.getItem('arsnova-quiz-list-sort:v1')).toBe('legacy-or-invalid');
  });

  it('bleibt bei gesperrtem Browser-Speicher sortierbar', () => {
    const getItem = Storage.prototype.getItem;
    const readSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key,
    ) {
      if (key === 'arsnova-quiz-list-sort:v1') throw new DOMException('Blocked', 'SecurityError');
      return getItem.call(this, key);
    });
    const setItem = Storage.prototype.setItem;
    const writeSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === 'arsnova-quiz-list-sort:v1') throw new DOMException('Full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    try {
      quizzesSignal.set(sortableQuizzes);
      const component = TestBed.createComponent(QuizListComponent).componentInstance;
      expect(component.sortMode()).toBe('title-asc');
      expect(() => component.setSortMode('questions-asc')).not.toThrow();
      expect(component.sortedQuizzesForList().map((quiz) => quiz.id)).toEqual([
        'zebra',
        'alpha',
        'quiz2',
        'quiz10',
      ]);
    } finally {
      readSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });

  it('durchsucht Titel und Beschreibung ohne Beachtung der Großschreibung und behält den Eingabefokus', () => {
    quizzesSignal.set([
      summary({ name: 'Datenbanken', description: 'SQL und Transaktionen' }),
      summary({ id: 'null-description', name: 'SQL Grundlagen' }),
      summary({ id: 'other', name: 'Netzwerke', description: 'Routing' }),
      summary({ id: 'fourth', name: 'Betriebssysteme' }),
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.focus();
    input.value = '  datenBANKEN   sQl  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.sortedQuizzesForList().map((quiz) => quiz.id)).toEqual([
      'alpha',
    ]);
    expect(document.activeElement).toBe(input);
    expect(fixture.nativeElement.querySelector('.quiz-list__results').textContent).toContain(
      '1 von 4',
    );
    input.value = 'SQL';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.quiz-list-item')).toHaveLength(2);
    input.value = '  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.quiz-list-item')).toHaveLength(4);
    expect(document.activeElement).toBe(input);
  });

  it('zeigt ein dekoratives Suchsymbol und bei leerem Feld keine Löschaktion', () => {
    quizzesSignal.set(sortableQuizzes);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelector('.quiz-list__search') as HTMLElement;
    const icon = field.querySelector('mat-icon[matIconPrefix]')!;
    expect(icon.textContent?.trim()).toBe('search');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(field.querySelector('button')).toBeNull();
  });

  it.each(['Quiz 2', 'missing', '   '])(
    'löscht den Suchtext %j und erhält den Eingabefokus',
    (query) => {
      quizzesSignal.set(sortableQuizzes);
      const fixture = TestBed.createComponent(QuizListComponent);
      fixture.componentInstance.setSortMode('questions-desc');
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
      input.value = query;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      const clear = fixture.nativeElement.querySelector(
        '.quiz-list__search button',
      ) as HTMLButtonElement;
      expect(clear.getAttribute('aria-label')).toBe('Suche löschen');
      expect(clear.type).toBe('button');
      clear.focus();
      clear.click();
      fixture.detectChanges();

      expect(input.value).toBe('');
      expect(fixture.componentInstance.searchQuery()).toBe('');
      expect(document.activeElement).toBe(input);
      expect(fixture.nativeElement.querySelector('input[type="search"]')).toBe(input);
      expect(fixture.nativeElement.querySelector('.quiz-list__search button')).toBeNull();
      expect(fixture.nativeElement.querySelector('.quiz-list__no-results')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.quiz-list-item')).toHaveLength(4);
      expect(fixture.componentInstance.sortMode()).toBe('questions-desc');
    },
  );

  it('zeigt einen leeren Suchtrefferzustand und aktualisiert Treffer nach Sammlungsänderungen', () => {
    quizzesSignal.set(sortableQuizzes);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.componentInstance.searchQuery.set('beta');
    fixture.componentInstance.setSortMode('questions-desc');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.quiz-list-item')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.quiz-list__no-results').textContent).toContain(
      'Keine passenden Quizze',
    );
    const status = fixture.nativeElement.querySelector('.quiz-list__results') as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toContain('0 von 4');

    quizzesSignal.update((quizzes) => [
      ...quizzes,
      summary({ id: 'beta2', name: 'Beta 2', questionCount: 2 }),
      summary({ id: 'beta1', name: 'Beta 1', questionCount: 10 }),
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.sortedQuizzesForList().map((quiz) => quiz.id)).toEqual([
      'beta1',
      'beta2',
    ]);
    expect(fixture.nativeElement.querySelector('.quiz-list__no-results')).toBeNull();
    expect(status.textContent).toContain('2 von 6');
  });

  it.each([0, 1, 2, 3, 4])('zeigt Such- und Sortieroptionen nur ab vier Quizzen: %i', (count) => {
    quizzesSignal.set(sortableQuizzes.slice(0, count));
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    const tools = fixture.nativeElement.querySelector('.quiz-list__tools')
      .parentElement as HTMLElement;
    expect(tools.hidden).toBe(count <= 3);
    expect(fixture.componentInstance.showCollectionTools()).toBe(count > 3);
    const deleteAll = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Alle Quizze löschen'),
    );
    expect(!!deleteAll).toBe(count > 3);
  });

  it.each([false, undefined])(
    'löscht bei Abbruch der Sicherheitsabfrage (%s) keine Quizze',
    async (confirmed) => {
      const { of } = await import('rxjs');
      quizzesSignal.set(sortableQuizzes);
      const fixture = TestBed.createComponent(QuizListComponent);
      fixture.detectChanges();
      const open = vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
        afterClosed: () => of(confirmed),
      } as never);
      await fixture.componentInstance.deleteAllQuizzes();
      expect(open).toHaveBeenCalledOnce();
      expect(mockStore.deleteQuizzes).not.toHaveBeenCalled();
      expect(quizzesSignal()).toEqual(sortableQuizzes);
      expect(fixture.componentInstance.deleteAllDialogOpen()).toBe(false);
    },
  );

  it('bestätigt die gesamte Sammlung trotz Suchfilter und fokussiert nach Löschung Quiz erstellen', async () => {
    const { of } = await import('rxjs');
    quizzesSignal.set(sortableQuizzes);
    mockStore.deleteQuizzes.mockImplementation((ids: string[]) => {
      const removed = quizzesSignal().filter((quiz) => ids.includes(quiz.id)).length;
      quizzesSignal.update((quizzes) => quizzes.filter((quiz) => !ids.includes(quiz.id)));
      return removed;
    });
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.componentInstance.searchQuery.set('Alpha');
    fixture.detectChanges();
    const open = vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);
    await fixture.componentInstance.deleteAllQuizzes();
    fixture.detectChanges();
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        autoFocus: 'dialog',
        role: 'alertdialog',
        restoreFocus: '.quiz-list__delete-all',
        data: expect.objectContaining({
          message: expect.stringContaining('Alle 4 Quizze'),
          confirmLabel: 'Alle Quizze löschen',
          consequences: expect.arrayContaining([
            expect.stringContaining('nicht rückgängig'),
            expect.stringContaining('Laufende Sessions bleiben geöffnet'),
          ]),
        }),
      }),
    );
    expect(mockStore.deleteQuizzes).toHaveBeenCalledWith(sortableQuizzes.map((quiz) => quiz.id));
    expect(fixture.componentInstance.actionInfo()).toBe('Gelöschte Quizze: 4.');
    expect(quizzesSignal()).toEqual([]);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('a[routerLink="new"]'));
    expect(fixture.componentInstance.searchQuery()).toBe('');
  });

  it('fokussiert bei Abbruch nach externer Verkleinerung einen weiterhin sichtbaren Auslöser', async () => {
    const { Subject } = await import('rxjs');
    const closed = new Subject<boolean>();
    quizzesSignal.set(sortableQuizzes);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
      afterClosed: () => closed,
    } as never);
    const pending = fixture.componentInstance.deleteAllQuizzes();
    quizzesSignal.set(sortableQuizzes.slice(0, 3));
    fixture.detectChanges();
    closed.next(false);
    closed.complete();
    await pending;
    expect(mockStore.deleteQuizzes).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('a[routerLink="new"]'));
  });

  it('verhindert doppelte Sicherheitsabfragen und erhält währenddessen neu hinzugekommene Quizze', async () => {
    const { Subject } = await import('rxjs');
    const closed = new Subject<boolean>();
    quizzesSignal.set(sortableQuizzes);
    mockStore.deleteQuizzes.mockImplementation((ids: string[]) => {
      const removed = quizzesSignal().filter((quiz) => ids.includes(quiz.id)).length;
      quizzesSignal.update((quizzes) => quizzes.filter((quiz) => !ids.includes(quiz.id)));
      return removed;
    });
    mockStore.librarySharingMode.set('shared');
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    const open = vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
      afterClosed: () => closed,
    } as never);
    const pending = fixture.componentInstance.deleteAllQuizzes();
    await fixture.componentInstance.deleteAllQuizzes();
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          consequences: expect.arrayContaining([expect.stringContaining('verbundenen Geräte')]),
        }),
      }),
    );
    quizzesSignal.set([...sortableQuizzes.slice(1), summary({ id: 'new', name: 'Neu' })]);
    closed.next(true);
    closed.complete();
    await pending;
    fixture.detectChanges();
    expect(quizzesSignal().map((quiz) => quiz.id)).toEqual(['new']);
    expect(fixture.componentInstance.actionInfo()).toBe('Gelöschte Quizze: 3.');
    expect(fixture.componentInstance.deleteAllDialogOpen()).toBe(false);
  });

  it('zeigt Löschfehler und lässt einen erneuten Versuch zu', async () => {
    const { of } = await import('rxjs');
    quizzesSignal.set(sortableQuizzes);
    mockStore.deleteQuizzes.mockImplementation(() => {
      throw new Error('Löschen fehlgeschlagen');
    });
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    const open = vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);
    await fixture.componentInstance.deleteAllQuizzes();
    fixture.detectChanges();
    expect(fixture.componentInstance.actionError()).toBe('Löschen fehlgeschlagen');
    expect(fixture.componentInstance.deleteAllDialogOpen()).toBe(false);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('a[routerLink="new"]'));
    expect(quizzesSignal()).toEqual(sortableQuizzes);
    mockStore.deleteQuizzes.mockReturnValue(4);
    await fixture.componentInstance.deleteAllQuizzes();
    expect(open).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.actionError()).toBeNull();
  });

  it('öffnet bei höchstens drei Quizzen auch programmgesteuert keine Sammellöschung', async () => {
    quizzesSignal.set(sortableQuizzes.slice(0, 3));
    const fixture = TestBed.createComponent(QuizListComponent);
    const open = vi.spyOn(fixture.componentInstance['dialog'], 'open');
    await fixture.componentInstance.deleteAllQuizzes();
    expect(open).not.toHaveBeenCalled();
    expect(mockStore.deleteQuizzes).not.toHaveBeenCalled();
  });

  it.each(['input', 'clear'] as const)(
    'setzt bei vier auf drei Quizzen die Suche zurück und gibt den Fokus von %s an Quiz erstellen',
    (focusTarget) => {
      quizzesSignal.set(sortableQuizzes);
      const fixture = TestBed.createComponent(QuizListComponent);
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
      input.focus();
      input.value = 'missing';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(fixture.componentInstance.visibleQuizCount()).toBe(0);
      expect(fixture.componentInstance.showCollectionTools()).toBe(true);

      if (focusTarget === 'clear') {
        (
          fixture.nativeElement.querySelector('.quiz-list__search button') as HTMLButtonElement
        ).focus();
      }

      quizzesSignal.set(sortableQuizzes.slice(0, 3));
      fixture.detectChanges();
      expect(fixture.componentInstance.searchQuery()).toBe('');
      expect(fixture.componentInstance.visibleQuizCount()).toBe(3);
      expect(fixture.nativeElement.querySelectorAll('.quiz-list-item')).toHaveLength(3);
      const create = fixture.nativeElement.querySelector('a[routerLink="new"]') as HTMLElement;
      expect(document.activeElement).toBe(create);
      expect(create.closest('[hidden]')).toBeNull();
      quizzesSignal.set(sortableQuizzes);
      fixture.detectChanges();
      expect(fixture.componentInstance.visibleQuizCount()).toBe(4);
      expect(fixture.componentInstance.searchQuery()).toBe('');
    },
  );

  it('rettet bei vier auf drei Quizzen den Fokus vom Sammellösch-Button', () => {
    quizzesSignal.set(sortableQuizzes);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    const deleteAll = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Alle Quizze löschen'))!;
    deleteAll.focus();
    expect(document.activeElement).toBe(deleteAll);

    quizzesSignal.set(sortableQuizzes.slice(0, 3));
    fixture.detectChanges();

    const create = fixture.nativeElement.querySelector('a[routerLink="new"]') as HTMLElement;
    expect(document.activeElement).toBe(create);
    expect(create.closest('[hidden]')).toBeNull();
  });

  it('zählt die Demo zur Schwelle und durchsucht sie zusammen mit eigenen Quizzen', () => {
    const demo = summary({ id: DEMO_QUIZ_ID, name: 'Demo', description: 'SQL' });
    quizzesSignal.set([demo]);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.quiz-list__lead-demo')).toBeTruthy();
    expect(fixture.componentInstance.showCollectionTools()).toBe(false);
    quizzesSignal.set([demo, ...sortableQuizzes.slice(0, 3)]);
    fixture.detectChanges();
    expect(fixture.componentInstance.showCollectionTools()).toBe(true);
    fixture.componentInstance.searchQuery.set('sql');
    fixture.detectChanges();
    expect(fixture.componentInstance.sortedQuizzesForList().map((quiz) => quiz.id)).toEqual([
      DEMO_QUIZ_ID,
    ]);
    expect(fixture.nativeElement.querySelector('.quiz-list__lead-demo')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.quiz-list-item')).toHaveLength(1);
  });

  it('schließt bei kleiner werdender Sammlung auch eine offene Sortierauswahl und erhält ein sichtbares Fokusziel', async () => {
    quizzesSignal.set(sortableQuizzes);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('mat-select') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();
    quizzesSignal.set(sortableQuizzes.slice(0, 3));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('a[routerLink="new"]'));
  });

  it('startet ohne eigene Quizzes bei der Aktionsleiste statt einem Willkommen-Text', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Willkommen!');
    expect(text).not.toContain('Du hast noch kein eigenes Quiz');
    expect(text).not.toContain('Die Demo ist ein Probelauf');
    expect(text).toContain('Quiz erstellen');
    expect(text).not.toContain('Neues Quiz erstellen');
  });

  it('betitelt die Demo-Sektion nur mit Demo-Quiz', () => {
    quizzesSignal.set([
      {
        id: DEMO_QUIZ_ID,
        name: 'Praxis-Showcase: Team-Quiz',
        description: 'Showcase',
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
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('#quiz-demo-heading') as HTMLElement | null;
    expect(heading?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Demo-Quiz');
    expect(fixture.nativeElement.textContent).not.toContain('Demo-Quiz ausprobieren');
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
    const details = fixture.nativeElement.querySelector(
      '.quiz-list__sync-status-expander',
    ) as HTMLDetailsElement;
    expect(details.open).toBe(false);
    const statusLine = fixture.nativeElement.querySelector(
      '.quiz-list__sync-status-summary-meta',
    ) as HTMLElement;
    expect(statusLine.textContent).toContain('Datenbanken');
    expect(text).toContain('Teilen beenden');
  });

  it('klappt Sync-Details nach einer Änderung zu und zeigt die Statuszeile', () => {
    mockStore.librarySharingMode.set('shared');
    mockStore.lastRemoteSyncAt.set('2026-03-16T18:06:00.000Z');
    mockStore.lastRemoteChangedQuizName.set('Datenbanken');
    mockStore.lastLocalChangeAt.set('2026-03-16T18:05:00.000Z');

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector(
      '.quiz-list__sync-status-expander',
    ) as HTMLDetailsElement;
    const statusLine = () =>
      (fixture.nativeElement.querySelector('.quiz-list__sync-status-summary-meta') as HTMLElement)
        .textContent;

    expect(details.open).toBe(false);
    expect(statusLine()).toContain('Datenbanken');

    fixture.componentInstance.syncDetailsOpen.set(true);
    fixture.detectChanges();
    expect(details.open).toBe(true);

    mockStore.lastLocalChangeAt.set('2026-03-16T18:09:00.000Z');
    fixture.detectChanges();

    expect(fixture.componentInstance.syncDetailsOpen()).toBe(false);
    expect(details.open).toBe(false);
    expect(statusLine()).toContain('Hier geändert');
    expect(statusLine()).not.toContain('Datenbanken');
  });

  it('beendet Teilen nach Bestaetigung und setzt die Verknuepfung zurueck', async () => {
    const { of } = await import('rxjs');
    mockStore.librarySharingMode.set('shared');

    const fixture = TestBed.createComponent(QuizListComponent);
    const dialogOpenSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);

    await fixture.componentInstance.unlinkSharedLibrary();

    expect(dialogOpenSpy).toHaveBeenCalled();
    expect(mockStore.unlinkSharedLibrary).toHaveBeenCalledTimes(1);
    expect(snackBarOpenMock).toHaveBeenCalledWith(
      expect.stringContaining('Teilen beendet'),
      '',
      expect.objectContaining({ duration: 4500 }),
    );
  });

  it('laesst die geteilte Sammlung unveraendert wenn Teilen beenden abgebrochen wird', async () => {
    const { of } = await import('rxjs');
    mockStore.librarySharingMode.set('shared');

    const fixture = TestBed.createComponent(QuizListComponent);
    vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as never);

    await fixture.componentInstance.unlinkSharedLibrary();

    expect(mockStore.unlinkSharedLibrary).not.toHaveBeenCalled();
    expect(snackBarOpenMock).not.toHaveBeenCalled();
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
    expect(snackBarOpenMock).toHaveBeenCalledWith(
      expect.stringContaining('Ältere arsnova.eu-Versionen'),
      '',
      expect.objectContaining({ duration: 10000 }),
    );

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
      fixture.componentInstance as unknown as SpecAccess<
        QuizListComponent,
        {
          handleSyncImportNoticeIfRequested: () => Promise<void>;
        }
      >
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
    expect(link.getAttribute('aria-label')).toBeNull();
    expect(link.textContent).toContain('Datenbanken');
  });

  it('zeigt auf der Demo-Quizkarte ein Untermenü mit Standard- und PDF/UA-Beispiel', () => {
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
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const demoLocale = String((TestBed.inject(LOCALE_ID) as string) || 'en')
      .slice(0, 2)
      .toLowerCase();
    expect(component.demoSessionResultsPdfUrl).toContain(
      `/assets/demo/demo-session-results-30.${demoLocale}.pdf`,
    );
    expect(component.demoSessionResultsPdfUaUrl).toContain(
      `/assets/demo/demo-session-results-30.${demoLocale}-pdfua.pdf`,
    );

    expect(fixture.nativeElement.querySelector('.quiz-list-item__feature-chip--demo')).toBeNull();

    const demoPdfTrigger = fixture.nativeElement.querySelector(
      'button.quiz-list-item__demo-pdf',
    ) as HTMLButtonElement | null;
    expect(demoPdfTrigger).toBeTruthy();
    expect(demoPdfTrigger?.textContent).toContain('Beispiel-Nachbesprechungsplan');

    demoPdfTrigger?.click();
    fixture.detectChanges();

    const demoPdfLinks = Array.from(
      document.body.querySelectorAll('a[mat-menu-item]') as NodeListOf<HTMLAnchorElement>,
    ).filter((link) => (link.getAttribute('href') ?? '').includes('demo-session-results-30'));
    expect(demoPdfLinks).toHaveLength(2);
    expect(
      demoPdfLinks.some((link) =>
        (link.getAttribute('href') ?? '').endsWith(`demo-session-results-30.${demoLocale}.pdf`),
      ),
    ).toBe(true);
    expect(
      demoPdfLinks.some((link) =>
        (link.getAttribute('href') ?? '').endsWith(
          `demo-session-results-30.${demoLocale}-pdfua.pdf`,
        ),
      ),
    ).toBe(true);
    for (const link of demoPdfLinks) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
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

  it('zeigt im Szenario EVENT weiterhin Bearbeiten im More-Menü', async () => {
    TestBed.inject(HostScenarioService).selectScenario('EVENT');
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

    expect(document.querySelector('[role="menu"]')?.textContent).toContain('Bearbeiten');
    expect(fixture.nativeElement.querySelector('.quiz-list-item__actions-primary a')).toBeNull();
  });

  it.each<HostScenario>(['CLASSROOM', 'QUICK'])(
    'zeigt im Szenario %s Starten primär und Bearbeiten direkt daneben',
    async (scenario) => {
      // Relative RouterLinks need a real route tree; the shortcut mock only supplies query params.
      TestBed.overrideProvider(ActivatedRoute, {
        useFactory: (router: Router) => router.routerState.root,
        deps: [Router],
      });
      TestBed.inject(HostScenarioService).selectScenario(scenario);
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
          lastServerQuizId: null,
          lastServerQuizAccessProof: null,
        },
      ]);
      const fixture = TestBed.createComponent(QuizListComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const actions: HTMLElement = fixture.nativeElement.querySelector(
        '.quiz-list-item__actions-primary',
      );
      expect(actions.querySelector('button.mat-mdc-unelevated-button')?.textContent).toContain(
        'Starten',
      );
      expect(actions.querySelector('a')?.textContent).toContain('Bearbeiten');
      expect(actions.querySelector('a')?.getAttribute('href')).toContain(
        'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
      );
      actions.querySelector<HTMLButtonElement>('.quiz-list-item__menu-trigger')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const menuText = document.querySelector('[role="menu"]')?.textContent;
      expect(menuText).not.toContain('Bearbeiten');
      expect(menuText).toContain('Exportieren');
      expect(menuText).toContain('Duplizieren');
    },
  );

  it.each<HostScenario | null>([null, 'CLASSROOM', 'EVENT', 'QUICK'])(
    'ordnet einer neu erstellten Sitzung nur den beim Start erfassten Kontext %s zu',
    async (scenario) => {
      const service = TestBed.inject(HostScenarioService);
      if (scenario) service.selectScenario(scenario);
      const fixture = TestBed.createComponent(QuizListComponent);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const starting = fixture.componentInstance.openLiveStartDialog('local-quiz', 'Quiz', 1);
      service.selectScenario(scenario === 'EVENT' ? 'CLASSROOM' : 'EVENT');

      await starting;

      expect(createSessionMutationMock).toHaveBeenCalledWith({
        quizId: '11111111-1111-4111-8111-111111111111',
        type: 'QUIZ',
        timeZone: expect.any(String),
      });
      expect(service.getForSession('NEW123')).toBe(scenario ?? 'QUICK');
      expect(navigate).toHaveBeenCalledWith(
        expect.stringContaining('/session/NEW123/host?tab=quiz'),
      );
      expect(fixture.componentInstance.liveStartPending()).toBe(false);
    },
  );

  it('setzt nach einem fehlgeschlagenen Quiz-Start keinen Sitzungskontext und erlaubt Wiederholung', async () => {
    const service = TestBed.inject(HostScenarioService);
    service.selectScenario('CLASSROOM');
    createSessionMutationMock.mockRejectedValueOnce(new Error('offline'));
    const fixture = TestBed.createComponent(QuizListComponent);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.openLiveStartDialog('local-quiz', 'Quiz', 1);

    expect(service.getForSession('NEW123')).toBeNull();
    expect(fixture.componentInstance.actionError()).not.toBeNull();
    expect(fixture.componentInstance.liveStartPending()).toBe(false);

    await fixture.componentInstance.openLiveStartDialog('local-quiz', 'Quiz', 1);

    expect(service.getForSession('NEW123')).toBe('CLASSROOM');
    expect(fixture.componentInstance.actionError()).toBeNull();
    expect(createSessionMutationMock).toHaveBeenCalledTimes(2);
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
        lastServerQuizAccessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
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
        accessProof: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
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

  it('öffnet eine laufende Sitzung wieder, wenn dieser Browser die Host-Fähigkeit hat', async () => {
    const scenarioService = TestBed.inject(HostScenarioService);
    scenarioService.selectScenario('EVENT');
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const serverQuizId = '11111111-1111-4111-8111-111111111111';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: serverQuizId,
        lastServerQuizAccessProof: localQuizId,
      },
    ]);
    storeHostBrowserCapability('LIVE01', 'browser-capability');
    getActiveQuizIdsQueryMock.mockResolvedValue([
      {
        quizId: serverQuizId,
        participantCountIncludingHost: 2,
        sessionCodes: ['LIVE01'],
      },
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.openLiveStartDialog(localQuizId, 'Datenbanken', 2);

    expect(navigateByUrl).toHaveBeenCalledWith(
      expect.stringContaining('/session/LIVE01/host?tab=quiz'),
    );
    expect(scenarioService.getForSession('LIVE01')).toBeNull();
    clearHostBrowserCapability('LIVE01');
  });

  it('startet kein zweites Quiz, wenn die Host-Fähigkeit fehlt', async () => {
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const serverQuizId = '11111111-1111-4111-8111-111111111111';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: serverQuizId,
        lastServerQuizAccessProof: localQuizId,
      },
    ]);
    clearHostBrowserCapability('LIVE01');
    getActiveQuizIdsQueryMock.mockResolvedValue([
      {
        quizId: serverQuizId,
        participantCountIncludingHost: 2,
        sessionCodes: ['LIVE01'],
      },
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);

    await fixture.componentInstance.openLiveStartDialog(localQuizId, 'Datenbanken', 2);
    fixture.detectChanges();

    expect(fixture.componentInstance.actionInfo()).toContain('bereits live');
    expect(fixture.componentInstance.actionInfo()).toContain('unabhängige Kopie');
    const startCopy = fixture.nativeElement.querySelector(
      '[data-testid="quiz-live-start-copy"]',
    ) as HTMLButtonElement | null;
    expect(startCopy?.textContent).toContain('Als Kopie neu starten');
    const recovery = fixture.nativeElement.querySelector(
      '[data-testid="quiz-live-recovery"]',
    ) as HTMLAnchorElement | null;
    expect(recovery?.textContent).toContain('Host-Zugang wiederherstellen');
    expect(fixture.componentInstance.hostRecoveryCommands).toContain('host-recovery');
    expect(mockStore.getUploadPayload).not.toHaveBeenCalled();
  });

  it('startet ohne Host-Wiederherstellung eine unabhängige Quiz-Kopie', async () => {
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const copyQuizId = '91f3dd2b-27cf-424f-ae33-0bb13df0ab81';
    mockStore.duplicateQuiz.mockReturnValue({ id: copyQuizId });
    const fixture = TestBed.createComponent(QuizListComponent);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.startAsNewQuizCopy(localQuizId);

    expect(mockStore.duplicateQuiz).toHaveBeenCalledWith(localQuizId);
    expect(mockStore.getUploadPayload).toHaveBeenCalledWith(copyQuizId);
    expect(uploadQuizMutationMock).toHaveBeenCalled();
    expect(createSessionMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        quizId: '11111111-1111-4111-8111-111111111111',
        type: 'QUIZ',
      }),
    );
    expect(navigateByUrl).toHaveBeenCalledWith(
      expect.stringContaining('/session/NEW123/host?tab=quiz'),
    );
  });

  it('löscht eine lokale Quizkarte auch dann, wenn ihre Session weiterläuft', async () => {
    const { of } = await import('rxjs');
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const serverQuizId = '11111111-1111-4111-8111-111111111111';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: serverQuizId,
        lastServerQuizAccessProof: localQuizId,
      },
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.componentInstance.activeLiveQuizParticipants.set(new Map([[serverQuizId, 2]]));
    const dialogOpenSpy = vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);

    fixture.componentInstance.deleteQuiz(localQuizId, 'Datenbanken');
    await Promise.resolve();

    expect(dialogOpenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining('laufende Session bleibt geöffnet'),
          consequences: expect.arrayContaining([
            expect.stringContaining('nicht moderieren oder beenden'),
          ]),
        }),
      }),
    );
    expect(mockStore.deleteQuiz).toHaveBeenCalledWith(localQuizId);
  });

  it('setzt die ältere Sitzung fort, für die dieser Browser eine Fähigkeit hat', async () => {
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const serverQuizId = '11111111-1111-4111-8111-111111111111';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: serverQuizId,
        lastServerQuizAccessProof: localQuizId,
      },
    ]);
    storeHostBrowserCapability('OLD001', 'browser-capability');
    getActiveQuizIdsQueryMock.mockResolvedValue([
      {
        quizId: serverQuizId,
        participantCountIncludingHost: 3,
        sessionCodes: ['LIVE01', 'OLD001'],
      },
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.openLiveStartDialog(localQuizId, 'Datenbanken', 2);

    expect(navigateByUrl).toHaveBeenCalledWith(
      expect.stringContaining('/session/OLD001/host?tab=quiz'),
    );
    expect(mockStore.getUploadPayload).not.toHaveBeenCalled();
    clearHostBrowserCapability('OLD001');
  });

  it('setzt eine Sitzung mit vorhandenem Host-Token fort', async () => {
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const serverQuizId = '11111111-1111-4111-8111-111111111111';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: serverQuizId,
        lastServerQuizAccessProof: localQuizId,
      },
    ]);
    setHostToken('LIVE01', 'host-token');
    getActiveQuizIdsQueryMock.mockResolvedValue([
      {
        quizId: serverQuizId,
        participantCountIncludingHost: 2,
        sessionCodes: ['LIVE01'],
      },
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.openLiveStartDialog(localQuizId, 'Datenbanken', 2);

    expect(navigateByUrl).toHaveBeenCalledWith(
      expect.stringContaining('/session/LIVE01/host?tab=quiz'),
    );
    expect(mockStore.getUploadPayload).not.toHaveBeenCalled();
    clearHostToken('LIVE01');
  });

  it('startet bei fehlgeschlagener Live-Abfrage keine zweite Sitzung', async () => {
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: '11111111-1111-4111-8111-111111111111',
        lastServerQuizAccessProof: localQuizId,
      },
    ]);
    getActiveQuizIdsQueryMock.mockRejectedValue(new Error('lookup failed'));
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.componentInstance['liveLookupFailed'].set(true);

    await fixture.componentInstance.openLiveStartDialog(localQuizId, 'Datenbanken', 2);

    expect(fixture.componentInstance.actionError()).toContain('keine neue Sitzung');
    expect(mockStore.getUploadPayload).not.toHaveBeenCalled();
  });

  it('startet keine Sitzung, wenn der Zugangsnachweis der Quizkopie fehlt', async () => {
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const serverQuizId = '11111111-1111-4111-8111-111111111111';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: serverQuizId,
        lastServerQuizAccessProof: 'legacy-content-hash',
      },
    ]);
    bindQuizHistoryScopeMutationMock.mockRejectedValue(new Error('bind failed'));
    getActiveQuizIdsQueryMock.mockResolvedValue([]);
    const fixture = TestBed.createComponent(QuizListComponent);

    await fixture.componentInstance.openLiveStartDialog(localQuizId, 'Datenbanken', 2);

    expect(getActiveQuizIdsQueryMock).toHaveBeenCalledWith([]);
    expect(fixture.componentInstance.actionError()).toContain('keine neue Sitzung');
    expect(mockStore.getUploadPayload).not.toHaveBeenCalled();
  });

  it('prüft den Live-Status unmittelbar vor dem Start erneut', async () => {
    const localQuizId = 'e31fef3f-f7b1-4705-a739-28c8ec4486bf';
    const serverQuizId = '11111111-1111-4111-8111-111111111111';
    quizzesSignal.set([
      {
        id: localQuizId,
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
        teamMode: false,
        hasBonus: false,
        lastServerQuizId: serverQuizId,
        lastServerQuizAccessProof: localQuizId,
      },
    ]);
    storeHostBrowserCapability('LIVE01', 'browser-capability');
    getActiveQuizIdsQueryMock.mockResolvedValueOnce([]);
    const fixture = TestBed.createComponent(QuizListComponent);
    await fixture.componentInstance.ngOnInit();
    getActiveQuizIdsQueryMock.mockResolvedValueOnce([
      {
        quizId: serverQuizId,
        participantCountIncludingHost: 2,
        sessionCodes: ['LIVE01'],
      },
    ]);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.openLiveStartDialog(localQuizId, 'Datenbanken', 2);

    expect(navigateByUrl).toHaveBeenCalledWith(
      expect.stringContaining('/session/LIVE01/host?tab=quiz'),
    );
    expect(mockStore.getUploadPayload).not.toHaveBeenCalled();
    clearHostBrowserCapability('LIVE01');
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

  it('reserviert den Druck-Tab vor dem PDF-Job und schließt ihn nur beim endgültigen Fehler', async () => {
    const quiz = {
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
    };
    quizzesSignal.set([quiz]);
    getQuizCollectionHistoryAvailabilityQueryMock.mockResolvedValue([
      {
        quizId: quiz.lastServerQuizId,
        hasBonusTokens: true,
        hasLastSessionAnalysis: true,
      },
    ]);
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.componentInstance.quizHistoryAvailability.set(
      new Map([[quiz.id, { hasBonusTokens: true, hasLastSessionAnalysis: true }]]),
    );
    fixture.detectChanges();
    await flushAsyncEffects();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const pdfButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Nachbesprechungsplan'),
    );
    if (!pdfButton) {
      throw new Error('Nachbesprechungsplan-Button fehlt');
    }
    const service = TestBed.inject(SessionResultsExportService);
    const placeholder = { closed: false, close: vi.fn() } as unknown as Window;
    vi.spyOn(service, 'openViewPlaceholder').mockReturnValue(placeholder);
    const closePlaceholder = vi.spyOn(service, 'closeViewPlaceholder');
    let releaseExport!: (result: 'print-fallback') => void;
    const exportPdf = vi.spyOn(service, 'exportPdfFromQuizHistory').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseExport = resolve;
        }),
    );

    pdfButton.focus();
    const pending = fixture.componentInstance.exportLastSessionPdf(quiz, 'visual');
    fixture.detectChanges();

    expect(service.openViewPlaceholder).toHaveBeenCalledOnce();
    expect(exportPdf).not.toHaveBeenCalled();
    expect(pdfButton.disabled).toBe(true);
    expect(pdfButton.isConnected).toBe(true);
    expect(document.activeElement).toBe(pdfButton);

    await vi.waitUntil(() => exportPdf.mock.calls.length === 1);
    expect(exportPdf).toHaveBeenCalledWith(
      quiz.lastServerQuizId,
      quiz.lastServerQuizAccessProof,
      expect.objectContaining({ profile: 'visual', viewPlaceholder: placeholder }),
    );
    releaseExport('print-fallback');
    await pending;
    fixture.detectChanges();

    expect(closePlaceholder).not.toHaveBeenCalled();
    expect(pdfButton.disabled).toBe(false);
    expect(pdfButton.isConnected).toBe(true);
    expect(document.activeElement).toBe(pdfButton);
    expect(snackBarOpenMock).toHaveBeenCalledWith(
      'Ergebnis-PDF zum Speichern geöffnet.',
      '',
      expect.objectContaining({ duration: 5000 }),
    );

    exportPdf.mockRejectedValueOnce(new Error('pdf worker down'));
    await fixture.componentInstance.exportLastSessionPdf(quiz, 'visual');
    fixture.detectChanges();

    expect(closePlaceholder).toHaveBeenCalledWith(placeholder);
    expect(pdfButton.disabled).toBe(false);
    expect(pdfButton.isConnected).toBe(true);
    expect(snackBarOpenMock).toHaveBeenCalledWith(
      'Ergebnis-PDF konnte nicht erstellt werden.',
      '',
      expect.objectContaining({ duration: 7000 }),
    );
    fixture.destroy();
  });

  it('behält die Nachbesprechung, wenn die Verfügbarkeitsabfrage später scheitert', async () => {
    const quiz = {
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
    };
    quizzesSignal.set([quiz]);
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
    fixture.detectChanges();

    expect(
      fixture.componentInstance
        .quizHistoryAvailability()
        .get('e31fef3f-f7b1-4705-a739-28c8ec4486bf'),
    ).toEqual({
      hasBonusTokens: true,
      hasLastSessionAnalysis: true,
    });

    getQuizCollectionHistoryAvailabilityQueryMock.mockRejectedValueOnce(new Error('network'));
    quizzesSignal.set([{ ...quiz, updatedAt: '2026-03-08T12:00:00.000Z' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushAsyncEffects();
    fixture.detectChanges();

    expect(
      fixture.componentInstance
        .quizHistoryAvailability()
        .get('e31fef3f-f7b1-4705-a739-28c8ec4486bf'),
    ).toEqual({
      hasBonusTokens: true,
      hasLastSessionAnalysis: true,
    });
    const pdfButton = Array.from(
      fixture.nativeElement.querySelectorAll('.quiz-list-item__actions button'),
    ).find((button) => (button as HTMLButtonElement).textContent?.includes('Nachbesprechungsplan'));
    expect((pdfButton as HTMLButtonElement | undefined)?.disabled).toBe(false);
  });

  it('migriert Legacy-Scopes und gibt bei fehlgeschlagenem Bind keinen Legacy-Proof weiter', async () => {
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
    bindQuizHistoryScopeMutationMock.mockRejectedValue(new Error('UNAUTHORIZED'));

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushAsyncEffects();
    await vi.waitFor(() => {
      expect(bindQuizHistoryScopeMutationMock).toHaveBeenCalled();
    });

    expect(getQuizCollectionHistoryAvailabilityQueryMock).not.toHaveBeenCalled();
    expect(
      fixture.componentInstance
        .quizHistoryAvailability()
        .get('e31fef3f-f7b1-4705-a739-28c8ec4486bf'),
    ).toBeUndefined();
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
    const component = fixture.componentInstance as unknown as SpecAccess<
      QuizListComponent,
      {
        scrollAiImportPanelIntoViewAfterRender: () => void;
      }
    >;
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
    const component = fixture.componentInstance as unknown as SpecAccess<
      QuizListComponent,
      {
        scrollAiImportPanelIntoView: () => boolean;
      }
    >;
    const scrollRoot = document.createElement('main');
    scrollRoot.className = 'app-main';
    scrollRoot.style.paddingTop = '64px';
    scrollRoot.scrollTop = 240;
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, bottom: 600, left: 0, right: 360, width: 360, height: 600 }) as DOMRect;
    const scrollTo = vi.fn((options?: ScrollToOptions) => {
      scrollRoot.scrollTop = Number(options?.top ?? 0);
    });
    scrollRoot.scrollTo = scrollTo as typeof scrollRoot.scrollTo;
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

    await component.onImportFileSelected({ target: input } as unknown as Event);
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

    await component.onImportFileSelected({ target: input } as unknown as Event);
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

  it('lehnt zu große Import-Dateien ab, bevor der Inhalt gelesen wird', async () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    const component = fixture.componentInstance;
    const textMock = vi.fn();
    const file = {
      size: QUIZ_UPLOAD_MAX_PAYLOAD_BYTES + 1,
      text: textMock,
    } as unknown as File;
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    await component.onImportFileSelected({ target: input } as unknown as Event);

    expect(textMock).not.toHaveBeenCalled();
    expect(mockStore.importQuiz).not.toHaveBeenCalled();
    expect(component.actionError()).toContain(String(QUIZ_UPLOAD_MAX_PAYLOAD_BYTES));
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
      .spyOn(fixture.componentInstance, 'openLiveStartDialog')
      .mockResolvedValue(undefined);

    await (
      fixture.componentInstance as unknown as SpecAccess<
        QuizListComponent,
        {
          activateLiveStartShortcutIfRequested: () => Promise<void>;
        }
      >
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

  it('gibt Quiz-Karten im spielerischen Preset eine Hover-Elevation trotz Mixin-Ruheschatten', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(dir, 'quiz-list.component.scss'), 'utf8');
    const html = readFileSync(join(dir, 'quiz-list.component.html'), 'utf8');
    const playful = readFileSync(join(dir, '../../../../styles/playful-inner-chrome.scss'), 'utf8');
    const styles = readFileSync(join(dir, '../../../../styles.scss'), 'utf8');

    expect(scss).toMatch(
      /:host-context\(html:not\(\.preset-playful\)\) \.quiz-list-item:hover\s*\{/,
    );
    expect(scss).toMatch(/border-radius:\s*var\(--mat-sys-corner-full\)/);
    expect(scss).not.toContain('999px');
    expect(scss).not.toContain('@keyframes important-error-pulse');
    expect(scss).toMatch(/\.quiz-list__ai-hint\s*\{[^}]*font:\s*var\(--mat-sys-body-medium\)/);
    expect(html).not.toMatch(/dialog-title-header__sub[^"]*quiz-list__ai-hint/);
    expect(playful).toMatch(
      /\.quiz-list-page mat-card\.quiz-list-item:hover[\s\S]*?box-shadow:\s*[\s\S]*?--app-shadow-card-playful/,
    );
    expect(playful).toMatch(
      /\.quiz-list-page mat-card\.quiz-list__ai-card\s*\{[\s\S]*?app-playful-inner-panel-muted/,
    );
    expect(playful).not.toMatch(/quiz-list__ai-card:hover/);
    expect(playful).toMatch(/\.quiz-list-page \.quiz-list__sync-callout/);
    expect(playful).toMatch(/\.quiz-list-page \.quiz-list__lead-demo/);
    expect(scss).toMatch(
      /\.quiz-list-item__actions\s*\{[^}]*border-top:\s*1px solid var\(--mat-sys-outline\)/,
    );
    expect(scss).toMatch(/\.quiz-list-item__actions\s*\{[^}]*cursor:\s*default/);
    const aiMarkdown = styles.slice(styles.indexOf('.quiz-list__ai-prompt-markdown'));
    expect(aiMarkdown).toMatch(
      /\.quiz-list__ai-prompt-markdown pre\s*\{[\s\S]*?font-size:\s*0\.8125em/,
    );
    expect(aiMarkdown).not.toContain('0.625rem');
  });
});
