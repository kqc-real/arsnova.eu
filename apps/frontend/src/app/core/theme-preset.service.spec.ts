import { TestBed } from '@angular/core/testing';
import { ThemePresetService } from './theme-preset.service';

describe('ThemePresetService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light', 'preset-playful');
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light', 'preset-playful');
  });

  it('nutzt Dark als Default und setzt html.dark ohne gespeicherten Wert', () => {
    const service = TestBed.inject(ThemePresetService);

    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('home-theme')).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('respektiert gespeichertes System-Theme ohne html.dark oder html.light', () => {
    localStorage.setItem('home-theme', 'system');
    const service = TestBed.inject(ThemePresetService);

    expect(service.theme()).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('schreibt das Theme bei unverändertem Wert nicht erneut ins DOM', () => {
    const service = TestBed.inject(ThemePresetService);
    let domEvents = 0;
    const listener = (): void => {
      domEvents += 1;
    };
    globalThis.addEventListener('arsnova:preset-updated', listener);

    try {
      service.setTheme('light');
      expect(domEvents).toBe(1);
      expect(document.documentElement.classList.contains('light')).toBe(true);

      domEvents = 0;
      service.setTheme('light');

      expect(domEvents).toBe(0);
      expect(document.documentElement.classList.contains('light')).toBe(true);
    } finally {
      globalThis.removeEventListener('arsnova:preset-updated', listener);
    }
  });

  it('feuert bei unverändertem Preset weder DOM-Event noch Preset-Stream', () => {
    const service = TestBed.inject(ThemePresetService);
    let domEvents = 0;
    let presetEvents = 0;
    const listener = (): void => {
      domEvents += 1;
    };
    const sub = service.presetChanged$.subscribe(() => {
      presetEvents += 1;
    });
    globalThis.addEventListener('arsnova:preset-updated', listener);

    try {
      service.setPreset('serious');
      expect(domEvents).toBe(1);
      expect(presetEvents).toBe(1);
      expect(document.documentElement.classList.contains('preset-playful')).toBe(false);

      domEvents = 0;
      presetEvents = 0;
      service.setPreset('serious');

      expect(domEvents).toBe(0);
      expect(presetEvents).toBe(0);
      expect(document.documentElement.classList.contains('preset-playful')).toBe(false);
    } finally {
      sub.unsubscribe();
      globalThis.removeEventListener('arsnova:preset-updated', listener);
    }
  });
});
