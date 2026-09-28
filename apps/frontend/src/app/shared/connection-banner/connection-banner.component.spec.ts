import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { WsConnectionService } from '../../core/ws-connection.service';
import { ConnectionBannerComponent } from './connection-banner.component';

describe('ConnectionBannerComponent', () => {
  it('zeigt und sperrt die manuelle Reconnect-Aktion während des Versuchs', async () => {
    const reconnect = vi.fn(async () => undefined);
    const ws = {
      disconnected: signal(true),
      state: signal<'reconnecting'>('reconnecting'),
      manualReconnectOffered: signal(true),
      manualReconnectPending: signal(false),
      manualReconnectFailed: signal(false),
      runManualReconnect: reconnect,
    };
    await TestBed.configureTestingModule({
      imports: [ConnectionBannerComponent],
      providers: [{ provide: WsConnectionService, useValue: ws }],
    }).compileComponents();
    const fixture: ComponentFixture<ConnectionBannerComponent> =
      TestBed.createComponent(ConnectionBannerComponent);
    fixture.detectChanges();

    const action = fixture.nativeElement.querySelector(
      '.connection-banner__action',
    ) as HTMLButtonElement;
    expect(action.textContent).toContain('Jetzt neu verbinden');
    action.click();
    expect(reconnect).toHaveBeenCalledTimes(1);

    ws.manualReconnectPending.set(true);
    fixture.detectChanges();
    expect(action.disabled).toBe(true);
    expect(action.getAttribute('aria-busy')).toBe('true');
    expect(action.textContent).toContain('Verbindung wird hergestellt');
  });

  it('meldet einen fehlgeschlagenen Versuch und lässt die Aktion wieder zu', async () => {
    const ws = {
      disconnected: signal(true),
      state: signal<'disconnected'>('disconnected'),
      manualReconnectOffered: signal(true),
      manualReconnectPending: signal(false),
      manualReconnectFailed: signal(true),
      runManualReconnect: vi.fn(async () => undefined),
    };
    await TestBed.configureTestingModule({
      imports: [ConnectionBannerComponent],
      providers: [{ provide: WsConnectionService, useValue: ws }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConnectionBannerComponent);
    fixture.detectChanges();

    const action = fixture.nativeElement.querySelector(
      '.connection-banner__action',
    ) as HTMLButtonElement;
    expect(action.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Verbindung konnte noch nicht hergestellt werden.',
    );
  });
});
