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
    expect(text).toContain('Kurzcode');
    expect(text).toContain('SYNCROOM');
  });
});
