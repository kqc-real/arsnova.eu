import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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
    syncConnectionState: signal<'connected' | 'connecting' | 'disconnected'>('connected'),
    syncPeerInfos: signal<Array<{ deviceId: string; deviceLabel: string; browserLabel: string }>>(
      [],
    ),
    syncRoomId: signal('sync-room-12345678'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.syncConnectionState.set('connected');
    mockStore.syncPeerInfos.set([]);
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

  it('aktiviert den gewünschten Sync-Raum und zeigt Teilen-Oberflaeche', () => {
    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();

    expect(mockStore.activateSyncRoom).toHaveBeenCalledWith('sync-room-12345678', {
      markShared: true,
      registerOrigin: true,
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quiz-Sammlung teilen');
    expect(text).toContain('Sync-Link kopieren');
    expect(text).toContain('Status:');
    expect(text).toContain('Bereit');
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

    const fixture = TestBed.createComponent(QuizSyncComponent);
    const component = fixture.componentInstance;

    expect(component.syncLink()).toBe(`${window.location.origin}/en/quiz/sync/sync-room-12345678`);
  });
});
