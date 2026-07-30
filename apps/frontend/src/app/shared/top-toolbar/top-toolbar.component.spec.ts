/**
 * Unit-Tests für TopToolbarComponent (Preset-/Theme-Wechsel inkl. Tastaturpfad).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MatButtonToggleGroup } from '@angular/material/button-toggle';
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

  function desktopPresetGroup(fixture: ReturnType<typeof createToolbar>): MatButtonToggleGroup {
    const groups = fixture.debugElement.queryAll(By.directive(MatButtonToggleGroup));
    const preset = groups.find((g) =>
      (g.nativeElement as HTMLElement).classList.contains('top-toolbar__toggles--preset'),
    );
    expect(preset).toBeTruthy();
    return preset!.injector.get(MatButtonToggleGroup);
  }

  it('wendet Preset-Wechsel über Gruppen-change an (Maus und Tastatur)', () => {
    const fixture = createToolbar();
    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setPreset('spielerisch', { silent: true });
    fixture.detectChanges();

    const group = desktopPresetGroup(fixture);
    group.value = 'serious';
    group.change.emit({ source: null!, value: 'serious' });
    fixture.detectChanges();

    expect(themePreset.preset()).toBe('serious');
    expect(document.documentElement.classList.contains('preset-playful')).toBe(false);

    group.value = 'spielerisch';
    group.change.emit({ source: null!, value: 'spielerisch' });
    fixture.detectChanges();

    expect(themePreset.preset()).toBe('spielerisch');
    expect(document.documentElement.classList.contains('preset-playful')).toBe(true);
    fixture.destroy();
  });

  it('wechselt Preset per Tastatur-Pfeil innerhalb der Toggle-Gruppe', () => {
    const fixture = createToolbar();
    const themePreset = TestBed.inject(ThemePresetService);
    themePreset.setPreset('spielerisch', { silent: true });
    fixture.detectChanges();

    const groupEl = fixture.nativeElement.querySelector(
      '.top-toolbar__controls .top-toolbar__toggles--preset',
    ) as HTMLElement;
    const firstButton = groupEl.querySelector(
      'mat-button-toggle[value="spielerisch"] button',
    ) as HTMLButtonElement;
    firstButton.focus();
    // Angular Material Button-Toggle liest weiterhin keyCode (CDK keycodes).
    const arrowRight = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(arrowRight, 'keyCode', { get: () => 39 });
    firstButton.dispatchEvent(arrowRight);
    fixture.detectChanges();

    expect(themePreset.preset()).toBe('serious');
    expect(document.documentElement.classList.contains('preset-playful')).toBe(false);
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

  it('ändert Theme über Gruppen-change wie Preset', () => {
    const fixture = createToolbar();
    const themePreset = TestBed.inject(ThemePresetService);

    const groups = fixture.debugElement.queryAll(By.directive(MatButtonToggleGroup));
    const themeGroup = groups.find(
      (g) =>
        !(g.nativeElement as HTMLElement).classList.contains('top-toolbar__toggles--preset') &&
        (g.nativeElement as HTMLElement).closest('.top-toolbar__controls'),
    );
    expect(themeGroup).toBeTruthy();
    const group = themeGroup!.injector.get(MatButtonToggleGroup);
    group.change.emit({ source: null!, value: 'dark' });
    fixture.detectChanges();

    expect(themePreset.theme()).toBe('dark');
    fixture.destroy();
  });
});
