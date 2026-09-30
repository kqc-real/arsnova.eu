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
    expect(button?.getAttribute('aria-label')).toContain('Betrieb und Nutzung öffnen');
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
      serviceStatus: 'stable',
      measurementAvailable: true,
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
      serviceStatus: 'limited',
      measurementAvailable: true,
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
      serviceStatus: 'critical',
      measurementAvailable: true,
      loadStatus: 'overloaded',
    };

    fixture.detectChanges();

    const icon = (fixture.nativeElement as HTMLElement).querySelector('.server-status__icon');
    expect(icon?.classList.contains('server-status__icon--overloaded')).toBe(true);
  });
});
