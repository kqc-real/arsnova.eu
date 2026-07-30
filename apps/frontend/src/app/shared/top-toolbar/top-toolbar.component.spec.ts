/**
 * Unit-Tests für TopToolbarComponent (Preset-/Theme-Wechsel inkl. Tastatur/Tab).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TopToolbarComponent } from './top-toolbar.component';
import { ThemePresetService } from '../../core/theme-preset.service';

describe('TopToolbarComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('preset-playful', 'dark', 'light');
    TestBed.configureTestingModule({
      imports: [TopToolbarComponent],
      providers: [provideRouter([]), { provide: MatDialog, useValue: { open: vi.fn() } }],
    });
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('preset-playful', 'dark', 'light');
  });

  function createToolbar() {
    const fixture = TestBed.createComponent(TopToolbarComponent);
    fixture.detectChanges();
    return fixture;
  }

  function desktopPresetButtons(fixture: ReturnType<typeof createToolbar>) {
    const group = fixture.nativeElement.querySelector(
      '.top-toolbar__controls .top-toolbar__toggles--preset',
    ) as HTMLElement;
    const buttons = Array.from(
      group.querySelectorAll('button.top-toolbar__toggle'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    return { group, buttons };
  }

  function desktopThemeButtons(fixture: ReturnType<typeof createToolbar>) {
    const groups = fixture.nativeElement.querySelectorAll(
      '.top-toolbar__controls .top-toolbar__toggles',
    ) as NodeListOf<HTMLElement>;
    const themeGroup = Array.from(groups).find(
      (g) => !g.classList.contains('top-toolbar__toggles--preset'),
    )!;
    const buttons = Array.from(
      themeGroup.querySelectorAll('button.top-toolbar__toggle'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(3);
    return { group: themeGroup, buttons };
  }

  it('wendet Preset-Wechsel per Klick an (wie Tastatur Enter/Leertaste)', () => {
    const fixture = createToolbar();
    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setPreset('spielerisch', { silent: true });
    fixture.detectChanges();

    const { buttons } = desktopPresetButtons(fixture);
    buttons[1].click();
    fixture.detectChanges();

    expect(themePreset.preset()).toBe('serious');
    expect(document.documentElement.classList.contains('preset-playful')).toBe(false);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');

    buttons[0].click();
    fixture.detectChanges();

    expect(themePreset.preset()).toBe('spielerisch');
    expect(document.documentElement.classList.contains('preset-playful')).toBe(true);
    fixture.destroy();
  });

  it('macht beide Preset-Optionen per Tab erreichbar', () => {
    const fixture = createToolbar();
    const { buttons } = desktopPresetButtons(fixture);

    for (const button of buttons) {
      expect(button.tabIndex).toBeGreaterThanOrEqual(0);
      expect(button.getAttribute('tabindex')).not.toBe('-1');
      expect(button.disabled).toBe(false);
    }
    fixture.destroy();
  });

  it('wechselt Theme per Tastatur-Aktivierung (click nach Fokus)', () => {
    const fixture = createToolbar();
    const themePreset = TestBed.inject(ThemePresetService);
    const { buttons } = desktopThemeButtons(fixture);
    const darkButton = buttons.find((b) => b.getAttribute('aria-label') === 'Dark')!;

    darkButton.focus();
    expect(document.activeElement).toBe(darkButton);
    darkButton.click();
    fixture.detectChanges();

    expect(themePreset.theme()).toBe('dark');
    expect(darkButton.getAttribute('aria-pressed')).toBe('true');
    fixture.destroy();
  });

  it('schließt das mobile Menü nach Preset-Wechsel und gibt Fokus zurück', async () => {
    const fixture = createToolbar();
    const toolbar = fixture.componentInstance;
    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setPreset('spielerisch', { silent: true });
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;
    const triggerFocusSpy = vi.spyOn(trigger, 'focus');

    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toolbar.controlsMenuOpen()).toBe(true);

    toolbar.onPresetChange('serious');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(themePreset.preset()).toBe('serious');
    expect(toolbar.controlsMenuOpen()).toBe(false);
    expect(triggerFocusSpy).toHaveBeenCalledWith({ preventScroll: true });
    fixture.destroy();
  });

  it('stilisiert Fokus direkt am Toggle-Button', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'top-toolbar.component.scss');
    const scss = readFileSync(scssPath, 'utf8');
    expect(scss).toContain('.top-toolbar__toggle');
    expect(scss).toMatch(/&:focus-visible\s*\{/);
    expect(scss).not.toContain('mat-button-toggle-button:focus-visible');
    expect(scss).not.toContain('mat-button-toggle:focus-within');
  });
});
