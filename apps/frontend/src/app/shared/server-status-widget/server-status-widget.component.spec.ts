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

  it('exposes an accessibility label for status and load help', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusWidgetComponent],
    });
    const fixture = TestBed.createComponent(ServerStatusWidgetComponent);

    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('Betriebsstatus öffnen');
    expect(button?.getAttribute('aria-label')).toContain('Statusanzeige');
  });

  it('renders a green status icon for healthy live stats', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusWidgetComponent],
    });
    const fixture = TestBed.createComponent(ServerStatusWidgetComponent);
    fixture.componentInstance.connectionOk = true;
    fixture.componentInstance.loading = false;
    fixture.componentInstance.stats = {
      openSessions: 6,
      activeSessions: 4,
      totalParticipants: 32,
      votesLastMinute: 12,
      sessionTransitionsLastMinute: 3,
      activeCountdownSessions: 2,
      completedSessions: 18,
      activeBlitzRounds: 1,
      maxParticipantsSingleSession: 120,
      maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
      serviceStatus: 'stable',
      loadStatus: 'healthy',
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

  it('renders a yellow status icon for busy live stats', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusWidgetComponent],
    });
    const fixture = TestBed.createComponent(ServerStatusWidgetComponent);
    fixture.componentInstance.connectionOk = true;
    fixture.componentInstance.loading = false;
    fixture.componentInstance.stats = {
      openSessions: 121,
      activeSessions: 120,
      totalParticipants: 870,
      votesLastMinute: 260,
      sessionTransitionsLastMinute: 44,
      activeCountdownSessions: 28,
      completedSessions: 18,
      activeBlitzRounds: 3,
      maxParticipantsSingleSession: 120,
      maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
      serviceStatus: 'limited',
      loadStatus: 'busy',
    };

    fixture.detectChanges();

    const icon = (fixture.nativeElement as HTMLElement).querySelector('.server-status__icon');
    expect(icon?.classList.contains('server-status__icon--busy')).toBe(true);
  });

  it('renders a red status icon for overloaded live stats', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusWidgetComponent],
    });
    const fixture = TestBed.createComponent(ServerStatusWidgetComponent);
    fixture.componentInstance.connectionOk = true;
    fixture.componentInstance.loading = false;
    fixture.componentInstance.stats = {
      openSessions: 255,
      activeSessions: 250,
      totalParticipants: 1600,
      votesLastMinute: 720,
      sessionTransitionsLastMinute: 91,
      activeCountdownSessions: 64,
      completedSessions: 18,
      activeBlitzRounds: 4,
      maxParticipantsSingleSession: 120,
      maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
      serviceStatus: 'critical',
      loadStatus: 'overloaded',
    };

    fixture.detectChanges();

    const icon = (fixture.nativeElement as HTMLElement).querySelector('.server-status__icon');
    expect(icon?.classList.contains('server-status__icon--overloaded')).toBe(true);
  });
});
