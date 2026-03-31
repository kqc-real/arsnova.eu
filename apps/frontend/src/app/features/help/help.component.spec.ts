import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpComponent } from './help.component';

const { statsQuery } = vi.hoisted(() => ({
  statsQuery: vi.fn(),
}));

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    health: {
      stats: { query: statsQuery },
    },
  },
}));

describe('HelpComponent', () => {
  beforeEach(() => {
    statsQuery.mockResolvedValue({
      activeSessions: 0,
      totalParticipants: 0,
      completedSessions: 0,
      activeBlitzRounds: 0,
      maxParticipantsSingleSession: 42,
      maxParticipantsStatisticUpdatedAt: '2026-01-15T12:00:00.000Z',
      serverStatus: 'healthy' as const,
    });
    TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'browser' }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('blendet die Statistik-Karte ein und zeigt maxParticipantsSingleSession', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('42');
    expect(root.textContent).toMatch(/Rekordteilnahme/i);
  });
});
