import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { QuizSyncComponent } from './quiz-sync.component';
import { QuizStoreService } from '../data/quiz-store.service';

describe('QuizSyncComponent', () => {
  const ensureBaseHref = (href: string): void => {
    let base = document.querySelector('base');
    if (!base) {
      base = document.createElement('base');
      document.head.appendChild(base);
    }
    base.setAttribute('href', href);
  };

  const mockStore = {
    activateSyncRoom: vi.fn(),
    buildSyncShareLink: vi.fn((roomId: string) => `${window.location.origin}/quiz/sync/${roomId}`),
    invalidateSyncShareLink: vi.fn(),
    createSecuredSyncShareLink: vi.fn(),
    syncConnectionState: signal<'connected' | 'connecting' | 'disconnected'>('connected'),
    syncPeerInfos: signal<Array<{ deviceId: string; deviceLabel: string; browserLabel: string }>>(
      [],
    ),
    syncRoomId: signal('sync-room-12345678'),
    librarySharingMode: signal<'local' | 'shared'>('local'),
    canInvalidateSyncLink: signal(false),
    syncShareToken: signal<string | null>(null),
    syncShareStatus: signal<'idle' | 'pending' | 'ready' | 'error' | 'legacy'>('idle'),
    syncShareError: signal<string | null>(null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.syncConnectionState.set('connected');
    mockStore.syncPeerInfos.set([]);
    mockStore.canInvalidateSyncLink.set(false);
    mockStore.syncShareToken.set(null);
    mockStore.syncShareStatus.set('idle');
    mockStore.syncShareError.set(null);
    mockStore.librarySharingMode.set('local');
    mockStore.syncRoomId.set('sync-room-12345678');
    mockStore.buildSyncShareLink.mockImplementation(
      (roomId: string) => `${window.location.origin}/quiz/sync/${roomId}`,
    );
    window.history.replaceState({}, '', '/');
    ensureBaseHref('/');
    TestBed.configureTestingModule({
      imports: [QuizSyncComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ docId: 'sync-room-12345678' }),
              queryParamMap: convertToParamMap({}),
              fragment: null,
            },
          },
        },
        { provide: QuizStoreService, useValue: mockStore },
      ],
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    ensureBaseHref('/');
  });

  it('sichert die eigene lokale Bibliothek als Origin ab', () => {
    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();

    expect(mockStore.activateSyncRoom).toHaveBeenCalledWith('sync-room-12345678', {
      markShared: true,
      secureAsOrigin: true,
      shareToken: null,
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quiz-Sammlung teilen');
    expect(text).toContain('Sync-Link kopieren');
    expect(text).toContain('Status:');
    expect(text).toContain('Bereit');
  });

  it('beansprucht bei fremdem UUID-Link ohne Token keine Origin-Rechte', () => {
    mockStore.syncRoomId.set('other-local-room');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [QuizSyncComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ docId: '6a8edced-5f8f-4cfa-9176-454fac9570ad' }),
              queryParamMap: convertToParamMap({}),
              fragment: null,
            },
          },
        },
        { provide: QuizStoreService, useValue: mockStore },
      ],
    });

    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();

    expect(mockStore.activateSyncRoom).toHaveBeenCalledWith(
      '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      {
        markShared: true,
        secureAsOrigin: false,
        shareToken: null,
      },
    );
  });

  it('importiert Share-Token aus dem Fragment und entfernt s aus der URL', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [QuizSyncComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ docId: '6a8edced-5f8f-4cfa-9176-454fac9570ad' }),
              queryParamMap: convertToParamMap({}),
              fragment: 's=v1.token',
            },
          },
        },
        { provide: QuizStoreService, useValue: mockStore },
      ],
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();

    expect(mockStore.activateSyncRoom).toHaveBeenCalledWith(
      '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      {
        markShared: true,
        secureAsOrigin: false,
        shareToken: 'v1.token',
      },
    );
    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { s: null },
        fragment: '',
        replaceUrl: true,
      }),
    );
  });

  it('zeigt erst "Verbunden", wenn ein weiteres Gerät aktiv ist', () => {
    mockStore.syncConnectionState.set('connected');
    mockStore.syncPeerInfos.set([
      { deviceId: 'peer-1', deviceLabel: 'iPhone', browserLabel: 'Safari' },
    ]);

    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Verbunden');
  });

  it('erzeugt einen locale-sensitiven Sync-Link fuer externe Geraete', () => {
    window.history.replaceState({}, '', '/en/quiz/sync/sync-room-12345678');
    mockStore.buildSyncShareLink.mockReturnValue(
      `${window.location.origin}/en/quiz/sync/sync-room-12345678`,
    );

    const fixture = TestBed.createComponent(QuizSyncComponent);
    const component = fixture.componentInstance;

    expect(component.syncLink()).toBe(`${window.location.origin}/en/quiz/sync/sync-room-12345678`);
  });

  it('navigiert nach Rekey unter lokalisiertem Base-Href mit internem Router-Pfad', () => {
    ensureBaseHref('/de/');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();
    const newRoomId = '00000000-0000-4000-8000-000000000999';

    mockStore.syncRoomId.set(newRoomId);
    mockStore.syncShareToken.set(`v1.${newRoomId}.1.${'a'.repeat(43)}`);
    mockStore.syncShareStatus.set('ready');
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(`/quiz/sync/${newRoomId}`, {
      replaceUrl: true,
    });
    expect(navigateSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/de/de/'),
      expect.anything(),
    );
  });

  it('zeigt Ungueltig-machen nur mit Rotations-Capability', () => {
    mockStore.canInvalidateSyncLink.set(true);
    mockStore.syncShareToken.set('v1.token');
    mockStore.syncShareStatus.set('ready');
    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sync-Link ungültig machen');
  });

  it('deaktiviert Kopieren ohne Share-Token', () => {
    mockStore.syncShareToken.set(null);
    mockStore.syncShareStatus.set('pending');
    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button.quiz-sync__link-copy',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('bietet bestehenden Legacy-Origins einen expliziten abgesicherten neuen Link an', async () => {
    mockStore.librarySharingMode.set('shared');
    mockStore.syncShareStatus.set('legacy');
    mockStore.createSecuredSyncShareLink.mockResolvedValue(
      `${window.location.origin}/quiz/sync/00000000-0000-4000-8000-000000000999#s=v1.token`,
    );
    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button.quiz-sync__secure',
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Neuen abgesicherten Sync-Link erstellen');
    button.click();
    await fixture.whenStable();

    expect(mockStore.createSecuredSyncShareLink).toHaveBeenCalledOnce();
  });
});
