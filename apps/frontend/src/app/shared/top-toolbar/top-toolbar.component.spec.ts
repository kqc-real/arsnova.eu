/**
 * Unit-Tests für TopToolbarComponent (Preset-/Theme-Wechsel inkl. Tastatur/Tab).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TopToolbarComponent } from './top-toolbar.component';
import { MotdHeaderStateService } from '../../core/motd-header-state.service';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresetSnackbarFocusService } from '../../core/preset-snackbar-focus.service';

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
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(false);
    motdHeader.archiveUnreadCount.set(0);
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

  it('lässt nach Theme-Wechsel den Fokus in der Toolbar (Sprache erreichbar)', async () => {
    const fixture = createToolbar();
    const focusService = TestBed.inject(PresetSnackbarFocusService);
    const refocusSpy = vi.spyOn(focusService, 'refocusInput');
    const { buttons } = desktopThemeButtons(fixture);
    const lightButton = buttons.find((b) => b.getAttribute('aria-label') === 'Light')!;
    const langButton = fixture.nativeElement.querySelector(
      '.top-toolbar__controls .top-toolbar__lang-btn',
    ) as HTMLButtonElement;

    lightButton.focus();
    lightButton.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(refocusSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(lightButton);
    expect(langButton).toBeTruthy();
    expect(langButton.getAttribute('tabindex')).not.toBe('-1');
    expect(langButton.getAttribute('aria-label')).toBe('Sprache');
    fixture.destroy();
  });

  it('zeigt im mobilen Menü nur Theme und Sprache, keine Presets', async () => {
    const fixture = createToolbar();
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const mobile = fixture.nativeElement.querySelector('#top-toolbar-mobile') as HTMLElement;
    expect(mobile.classList.contains('l-stack')).toBe(false);
    expect(mobile.querySelector('.top-toolbar__toggles--preset')).toBeNull();
    expect(mobile.querySelector('[aria-label="Theme"]')).toBeTruthy();
    expect(mobile.querySelector('.top-toolbar__lang-btn')?.getAttribute('aria-label')).toBe(
      'Sprache',
    );
    expect(mobile.textContent).not.toContain('Spielerisch');
    expect(mobile.textContent).not.toContain('Seriös');
    fixture.destroy();
  });

  it('schließt das mobile Menü nach Theme-Wechsel und gibt Fokus zurück', async () => {
    const fixture = createToolbar();
    const toolbar = fixture.componentInstance;
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;
    const triggerFocusSpy = vi.spyOn(trigger, 'focus');

    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toolbar.controlsMenuOpen()).toBe(true);

    toolbar.onThemeChange('dark');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toolbar.controlsMenuOpen()).toBe(false);
    expect(triggerFocusSpy).toHaveBeenCalledWith({ preventScroll: true });
    fixture.destroy();
  });

  it('bietet die Startseite nur über Logo und Produktname an', () => {
    const fixture = createToolbar();
    const brand = fixture.nativeElement.querySelector('.top-toolbar__brand') as HTMLAnchorElement;
    expect(brand).not.toBeNull();
    expect(brand.getAttribute('aria-label')).toBe('arsnova.eu Startseite');
    expect(fixture.nativeElement.querySelector('.top-toolbar__home-link')).toBeNull();
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('.top-toolbar__start mat-icon')).every(
        (icon) => (icon as HTMLElement).textContent?.trim() !== 'home',
      ),
    ).toBe(true);
    fixture.destroy();
  });

  it('hält Logo, App-Namen und Toolbar-Zeile auf einer vertikalen Mitte', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'top-toolbar.component.scss');
    const scss = readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.top-toolbar__brand\s*\{[^}]*align-items:\s*center/);
    expect(scss).toMatch(/\.top-toolbar__start\s*\{[^}]*align-items:\s*center/);
    expect(scss).toMatch(/\.top-toolbar__brand-icon\s*\{[^}]*display:\s*block/);
    expect(scss).toMatch(/\.top-toolbar__brand-icon\s*\{[^}]*width:\s*2\.25rem/);
    expect(scss).toMatch(/\.top-toolbar__brand-icon\s*\{[^}]*height:\s*2\.25rem/);
    expect(scss).toMatch(/\.top-toolbar__brand-title\s*\{[^}]*line-height:\s*1/);
    expect(scss).not.toMatch(/\.top-toolbar__brand-title\s*\{[^}]*translate:/);
    expect(scss).not.toMatch(/\.top-toolbar__brand-title\s*\{[^}]*height:\s*1\.75rem/);
    const playful = scss.slice(scss.indexOf(':host-context(html.preset-playful)'));
    expect(playful).toMatch(
      /\.top-toolbar__brand-icon\s*\{[^}]*animation:\s*home-playful-brand-pulse/,
    );
  });

  it('blendet den MOTD-Zähler vollständig aus, wenn keine ungelesenen Meldungen da sind', () => {
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(true);
    motdHeader.archiveUnreadCount.set(0);
    const fixture = createToolbar();
    const btn = fixture.nativeElement.querySelector('.top-toolbar__motd-btn') as HTMLElement;

    expect(btn).not.toBeNull();
    expect(fixture.componentInstance.motdArchiveBadgeText()).toBe('');
    expect(btn.classList.contains('mat-badge-hidden')).toBe(true);
    fixture.destroy();
  });

  it('zeigt den MOTD-Zähler nur bei ungelesenen Meldungen', () => {
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(true);
    motdHeader.archiveUnreadCount.set(2);
    const fixture = createToolbar();
    const btn = fixture.nativeElement.querySelector('.top-toolbar__motd-btn') as HTMLElement;

    expect(btn.classList.contains('mat-badge-hidden')).toBe(false);
    expect(fixture.componentInstance.motdArchiveBadgeText()).toBe('2');
    expect(btn.querySelector('.mat-badge-content')?.textContent?.trim()).toBe('2');
    fixture.destroy();
  });

  it('erzwingt display:none für versteckte MOTD-Badges gegen den Zentrier-Override', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const stylesPath = join(dirname(fileURLToPath(import.meta.url)), '../../../styles.scss');
    const styles = readFileSync(stylesPath, 'utf8');
    expect(styles).toMatch(
      /\.top-toolbar__motd-btn\.mat-badge:not\(\.mat-badge-hidden\) \.mat-badge-content/,
    );
    expect(styles).toMatch(
      /\.top-toolbar__motd-btn\.mat-badge-hidden \.mat-badge-content\s*\{[^}]*display:\s*none\s*!important/,
    );
    expect(styles).not.toMatch(
      /\.top-toolbar__motd-btn\.mat-badge \.mat-badge-content\s*\{[^}]*display:\s*inline-flex\s*!important/,
    );
  });

  it('färbt Seriös-Primary nach Europa-Blau in Light und Dark', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const stylesPath = join(dirname(fileURLToPath(import.meta.url)), '../../../styles.scss');
    const styles = readFileSync(stylesPath, 'utf8');
    expect(styles).toMatch(/--app-eu-blue:\s*#002395/);
    expect(styles).toMatch(/--app-eu-on-primary:\s*#ffffff/);
    expect(styles).toMatch(/--app-eu-blue-on-dark:\s*#b4c4ff/);
    expect(styles).toMatch(
      /html\.light:not\(\.preset-playful\)\s*\{[\s\S]*?_serious-light-eu-primary/,
    );
    expect(styles).toMatch(/primary:\s*var\(--app-eu-blue\)/);
    expect(styles).toMatch(/on-primary:\s*var\(--app-eu-on-primary\)/);
    expect(styles).toMatch(
      /html\.dark:not\(\.preset-playful\)\s*\{[\s\S]*?_serious-dark-eu-primary/,
    );
    expect(styles).toMatch(/primary-container:\s*var\(--app-eu-blue\)/);
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
    expect(scss).toMatch(/\.top-toolbar__mobile\s*\{[^}]*flex-direction:\s*row/);
    expect(scss).toMatch(/\.top-toolbar__mobile\s*\{[^}]*justify-content:\s*space-evenly/);
  });

  it('stapelt die Toolbar über dem scrollenden Main-Inhalt, damit das mobile Menü nicht überdeckt wird', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const scssPath = join(dirname(fileURLToPath(import.meta.url)), 'top-toolbar.component.scss');
    const scss = readFileSync(scssPath, 'utf8');
    expect(scss).toMatch(/:host\s*\{[^}]*z-index:\s*20/);
  });
});
