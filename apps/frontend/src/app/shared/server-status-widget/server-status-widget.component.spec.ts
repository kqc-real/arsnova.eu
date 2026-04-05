import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ServerStatusWidgetComponent } from './server-status-widget.component';

describe('ServerStatusWidgetComponent', () => {
  it('emits openRequested when the footer status button is clicked', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusWidgetComponent],
    });
    const fixture = TestBed.createComponent(ServerStatusWidgetComponent);
    const emitSpy = vi.spyOn(fixture.componentInstance.openRequested, 'emit');

    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(emitSpy).toHaveBeenCalledOnce();
  });

  it('renders a green status icon for healthy live stats', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusWidgetComponent],
    });
    const fixture = TestBed.createComponent(ServerStatusWidgetComponent);
    fixture.componentInstance.connectionOk = true;
    fixture.componentInstance.loading = false;
    fixture.componentInstance.stats = {
      activeSessions: 4,
      totalParticipants: 32,
      completedSessions: 18,
      activeBlitzRounds: 1,
      maxParticipantsSingleSession: 120,
      maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
      serverStatus: 'healthy',
    };

    fixture.detectChanges();

    const icon = (fixture.nativeElement as HTMLElement).querySelector('.server-status__icon');
    expect(icon?.classList.contains('server-status__icon--healthy')).toBe(true);
  });

  it('falls back to gray while loading or offline', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusWidgetComponent],
    });
    const fixture = TestBed.createComponent(ServerStatusWidgetComponent);
    fixture.componentInstance.connectionOk = false;
    fixture.componentInstance.loading = true;

    fixture.detectChanges();

    const icon = (fixture.nativeElement as HTMLElement).querySelector('.server-status__icon');
    expect(icon?.classList.contains('server-status__icon--unknown')).toBe(true);
  });
});
