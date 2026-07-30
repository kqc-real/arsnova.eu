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
});
