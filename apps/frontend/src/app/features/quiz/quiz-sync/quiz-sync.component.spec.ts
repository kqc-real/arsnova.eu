import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { QuizSyncComponent } from './quiz-sync.component';
import { QuizStoreService } from '../data/quiz-store.service';

describe('QuizSyncComponent', () => {
  const mockStore = {
    activateSyncRoom: vi.fn(),
    syncConnectionState: signal<'connected' | 'connecting' | 'disconnected'>('connected'),
    syncRoomId: signal('sync-room-12345678'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('aktiviert den gewünschten Sync-Raum und erklaert Link und Kurzcode', () => {
    const fixture = TestBed.createComponent(QuizSyncComponent);
    fixture.detectChanges();

    expect(mockStore.activateSyncRoom).toHaveBeenCalledWith('sync-room-12345678', {
      markShared: true,
      registerOrigin: true,
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quiz-Sammlung weitergeben');
    expect(text).toContain('Der Sync-Link ist der eigentliche Zugriffsschlüssel.');
    expect(text).toContain('Dein Sync-Kurzcode');
    expect(text).toContain('Vollständige Sync-ID:');
    expect(text).toContain('Sync-Link (Zugriffsschlüssel):');
    expect(text).toContain('SYNCROOM');
  });
});
