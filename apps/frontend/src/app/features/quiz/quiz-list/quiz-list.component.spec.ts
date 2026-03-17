import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizListComponent } from './quiz-list.component';
import { QuizStoreService, type QuizSummary } from '../data/quiz-store.service';

const { getActiveQuizIdsQueryMock, snackBarOpenMock } = vi.hoisted(() => ({
  getActiveQuizIdsQueryMock: vi.fn(),
  snackBarOpenMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getActiveQuizIds: {
        query: getActiveQuizIdsQueryMock,
      },
    },
  },
}));

describe('QuizListComponent', () => {
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
    syncPeerInfos: signal<Array<{ deviceId: string; deviceLabel: string; browserLabel: string }>>([]),
    duplicateQuiz: vi.fn(),
    deleteQuiz: vi.fn(),
    exportQuiz: vi.fn(),
    importQuiz: vi.fn(),
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
    getActiveQuizIdsQueryMock.mockResolvedValue([]);
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

    expect(fixture.nativeElement.textContent).toContain('Deine Quiz-Bibliothek ist noch leer.');
    expect(fixture.nativeElement.textContent).toContain('Erstes Quiz erstellen');
  });

  it('zeigt den Sync-Button mit Hilfetext in der Bibliothek', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sync-ID und -Link erzeugen');
    expect(text).toContain('Sichere deine Quiz-Bibliothek auf ein anderes Gerät');
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
    expect(text).toContain('Geteilte Quiz-Bibliothek');
    expect(text).toContain('Hier siehst du, ob deine Quiz-Bibliothek auf dem neuesten Stand ist');
    expect(text).toContain('Verbunden');
    expect(text).toContain('Sync-ID: SYNCROOM');
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

  it('zeigt nach einem Sync-Import einen Snackbar-Hinweis', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
      },
    ]);
    mockRoute.snapshot.queryParamMap = convertToParamMap({ syncImported: '1' });

    const fixture = TestBed.createComponent(QuizListComponent);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await (fixture.componentInstance as QuizListComponent & {
      handleSyncImportNoticeIfRequested: () => Promise<void>;
    }).handleSyncImportNoticeIfRequested();

    expect(snackBarOpenMock).toHaveBeenCalledTimes(1);
    expect(snackBarOpenMock.mock.calls[0]?.[0]).toContain('Quiz-Bibliothek erfolgreich synchronisiert.');
    expect(snackBarOpenMock.mock.calls[0]?.[0]).toContain('Neuester Stand vom');
    expect(snackBarOpenMock).toHaveBeenCalledWith(
      expect.any(String),
      '',
      {
        duration: 9000,
        verticalPosition: 'top',
        horizontalPosition: 'center',
      },
    );
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

  it('rendert Markdown in der Quiz-Beschreibung', () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Deep Learning Quiz',
        description: 'Teste dein Wissen über **Deep Learning**.',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const description = fixture.nativeElement.querySelector('.quiz-list-item__description') as HTMLElement;
    expect(description.innerHTML).toContain('<strong>Deep Learning</strong>');
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
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.quiz-list-item__menu-trigger') as HTMLButtonElement;
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
      },
    ]);
    getActiveQuizIdsQueryMock.mockResolvedValue(['e31fef3f-f7b1-4705-a739-28c8ec4486bf']);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.isQuizLive('e31fef3f-f7b1-4705-a739-28c8ec4486bf')).toBe(true);
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
      id: 'caece014-f7cd-4d26-a101-bd494379f95f',
      name: 'KI Import',
    });

    component.updateAiJsonInput(`Hier ist dein Quiz:

\`\`\`json
{"quiz":{"name":"KI Import"}}
\`\`\`

Viel Erfolg beim Import.`);

    component.importAiJson();

    expect(mockStore.importQuiz).toHaveBeenCalledWith({ quiz: { name: 'KI Import' } });
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
      },
      {
        id: 'bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a',
        name: 'Netzwerke',
        description: 'OSI-Modell',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 3,
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

  it('oeffnet den Startdialog direkt fuer das angeforderte Quiz', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
      },
      {
        id: 'bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a',
        name: 'Netzwerke',
        description: 'OSI-Modell',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:31:00.000Z',
        questionCount: 3,
      },
    ]);
    mockRoute.snapshot.queryParamMap = convertToParamMap({
      startLiveQuiz: 'bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a',
    });

    const fixture = TestBed.createComponent(QuizListComponent);
    const openSpy = vi
      .spyOn(fixture.componentInstance, 'openLiveStartDialog' as keyof QuizListComponent)
      .mockResolvedValue(undefined);

    await (fixture.componentInstance as QuizListComponent & {
      activateLiveStartShortcutIfRequested: () => Promise<void>;
    }).activateLiveStartShortcutIfRequested();

    expect(openSpy).toHaveBeenCalledWith(
      'bb0cd69b-a0d2-4373-b83e-c1abb0a8b58a',
      'Netzwerke',
      3,
    );
  });
});
