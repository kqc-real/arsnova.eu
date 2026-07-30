/**
 * Unit-Tests für PresetSnackbarFocusService (nur registriertes Input bluren).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PresetSnackbarFocusService } from './preset-snackbar-focus.service';

describe('PresetSnackbarFocusService', () => {
  let service: PresetSnackbarFocusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PresetSnackbarFocusService);
  });

  afterEach(() => {
    service.registerInput(undefined);
    document.body.replaceChildren();
  });

  it('blurt nur das registrierte Eingabefeld', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    service.registerInput({ nativeElement: input });
    service.blurInput();

    expect(document.activeElement).not.toBe(input);
  });

  it('lässt nicht registrierte Fokusziel (z. B. Preset-Toggle) unberührt', () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Seriös';
    document.body.append(button);
    button.focus();
    expect(document.activeElement).toBe(button);

    service.registerInput(undefined);
    service.blurInput();

    expect(document.activeElement).toBe(button);
  });

  it('refokusiert nicht die Code-Eingabe solange der Fokus in der Toolbar liegt', () => {
    vi.useFakeTimers();
    const toolbar = document.createElement('app-top-toolbar');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Seriös';
    toolbar.append(toggle);
    const input = document.createElement('input');
    document.body.append(toolbar, input);
    const focusSpy = vi.spyOn(input, 'focus');
    service.registerInput({ nativeElement: input });
    toggle.focus();

    service.refocusInput();
    vi.runAllTimers();

    expect(document.activeElement).toBe(toggle);
    expect(focusSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('refokusiert nicht die Code-Eingabe solange der Fokus im MOTD-Dialog liegt', () => {
    vi.useFakeTimers();
    const layer = document.createElement('div');
    layer.className = 'home-motd-layer';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Schließen';
    layer.append(closeBtn);
    const input = document.createElement('input');
    document.body.append(layer, input);
    const focusSpy = vi.spyOn(input, 'focus');
    service.registerInput({ nativeElement: input });
    closeBtn.focus();

    service.refocusInput();
    vi.runAllTimers();

    expect(document.activeElement).toBe(closeBtn);
    expect(focusSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('refokusiert nicht die Code-Eingabe solange der Fokus in einem CDK-Overlay liegt', () => {
    vi.useFakeTimers();
    const overlay = document.createElement('div');
    overlay.className = 'cdk-overlay-pane';
    const menuItem = document.createElement('button');
    menuItem.type = 'button';
    menuItem.textContent = 'Deutsch';
    overlay.append(menuItem);
    const input = document.createElement('input');
    document.body.append(overlay, input);
    const focusSpy = vi.spyOn(input, 'focus');
    service.registerInput({ nativeElement: input });
    menuItem.focus();

    service.refocusInput();
    vi.runAllTimers();

    expect(document.activeElement).toBe(menuItem);
    expect(focusSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
