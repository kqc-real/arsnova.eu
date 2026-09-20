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
    sessionStorage.clear();
    document.documentElement.classList.remove('preset-playful', 'dark', 'light');
    TestBed.configureTestingModule({
      imports: [TopToolbarComponent],
      providers: [provideRouter([]), { provide: MatDialog, useValue: { open: vi.fn() } }],
    });
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.classList.remove('preset-playful', 'dark', 'light');
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(false);
    motdHeader.hasActiveOverlay.set(false);
    motdHeader.activeOverlayRef.set(null);
    motdHeader.seenOverlayRef.set(null);
    motdHeader.unseenCurrentMotdAcked.set(false);
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

  it('trennt Mobile-Cluster und Desktop-Steuerung per Breakpoint-Klassen', () => {
    const fixture = createToolbar();
    const mobileEnd = fixture.nativeElement.querySelector('.top-toolbar__end') as HTMLElement;
    const desktopControls = fixture.nativeElement.querySelector(
      '.top-toolbar__controls',
    ) as HTMLElement;

    expect(mobileEnd.classList.contains('mobile-only')).toBe(true);
    expect(desktopControls.classList.contains('desktop-only')).toBe(true);
    expect(
      mobileEnd.contains(fixture.nativeElement.querySelector('.top-toolbar__preset-chip')),
    ).toBe(true);
    expect(mobileEnd.contains(fixture.nativeElement.querySelector('.top-toolbar__menu-btn'))).toBe(
      true,
    );
    fixture.destroy();
  });

  it('zeigt das aktuelle Preset mobil als Chip und öffnet dasselbe Menü', async () => {
    const fixture = createToolbar();
    TestBed.inject(ThemePresetService).setPreset('spielerisch', { silent: true });
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector(
      '.top-toolbar__preset-chip',
    ) as HTMLButtonElement;

    expect(chip).toBeTruthy();
    expect(chip.querySelector('mat-icon')?.textContent?.trim()).toBe('celebration');
    expect(chip.textContent?.replace(/\s+/g, ' ').trim()).not.toContain('Spielerisch');
    expect(chip.getAttribute('aria-label')).toBe('Spielerisch, Einstellungen öffnen');
    expect(chip.getAttribute('aria-controls')).toBe('top-toolbar-mobile');

    chip.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fixture.componentInstance.controlsMenuOpen()).toBe(true);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#top-toolbar-mobile')).toBeTruthy();
    fixture.destroy();
  });

  it('bietet Preset, Theme und Sprache im mobilen Menü an', async () => {
    const fixture = createToolbar();
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const mobile = fixture.nativeElement.querySelector('#top-toolbar-mobile') as HTMLElement;
    expect(mobile.classList.contains('l-stack')).toBe(false);
    const presetGroup = mobile.querySelector('.top-toolbar__toggles--preset-mobile') as HTMLElement;
    const presetButtons = Array.from(
      presetGroup.querySelectorAll('button.top-toolbar__toggle'),
    ) as HTMLButtonElement[];
    expect(presetButtons).toHaveLength(2);
    expect(
      presetButtons.map((button) =>
        button.querySelector('.top-toolbar__preset-option > span:last-child')?.textContent?.trim(),
      ),
    ).toEqual(['Spielerisch', 'Seriös']);
    expect(mobile.querySelector('[aria-label="Theme"]')).toBeTruthy();
    expect(mobile.querySelector('.top-toolbar__lang-btn')?.getAttribute('aria-label')).toBe(
      'Sprache',
    );
    fixture.destroy();
  });

  it('schließt das mobile Menü nach Preset-Wechsel und gibt Fokus zurück', async () => {
    const fixture = createToolbar();
    const toolbar = fixture.componentInstance;
    const trigger = fixture.nativeElement.querySelector(
      '.top-toolbar__menu-btn',
    ) as HTMLButtonElement;
    const triggerFocusSpy = vi.spyOn(trigger, 'focus');

    trigger.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    toolbar.onPresetChange('serious');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toolbar.themePreset.preset()).toBe('serious');
    expect(toolbar.controlsMenuOpen()).toBe(false);
    expect(triggerFocusSpy).toHaveBeenCalledWith({ preventScroll: true });
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
    // Kein Brand-Pulse: transform-Animation auf dem SVG verfälscht in Firefox die Logo-Farbe.
    expect(playful).not.toMatch(/home-playful-brand-pulse/);
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

  it('hebt das Megafon hervor, wenn eine aktuelle MOTD noch nicht angezeigt wurde', () => {
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(true);
    motdHeader.hasActiveOverlay.set(true);
    const fixture = createToolbar();
    const btn = fixture.nativeElement.querySelector('.top-toolbar__motd-btn') as HTMLElement;

    expect(btn.classList.contains('top-toolbar__motd-btn--attention')).toBe(true);
    fixture.destroy();
  });

  it('nimmt die Megafon-Hervorhebung zurück, sobald das Archiv geöffnet wird', () => {
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(true);
    motdHeader.hasActiveOverlay.set(true);
    const dialog = TestBed.inject(MatDialog);
    vi.mocked(dialog.open).mockReturnValue({
      afterClosed: () => ({ subscribe: vi.fn() }),
    } as never);
    const fixture = createToolbar();
    const btn = fixture.nativeElement.querySelector('.top-toolbar__motd-btn') as HTMLButtonElement;

    btn.click();
    fixture.detectChanges();

    expect(motdHeader.motdToolbarAttention()).toBe(false);
    expect(btn.classList.contains('top-toolbar__motd-btn--attention')).toBe(false);
    fixture.destroy();
  });

  it('hebt das Megafon wieder hervor, wenn eine andere Overlay-MOTD aktuell wird', () => {
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(true);
    motdHeader.hasActiveOverlay.set(true);
    motdHeader.activeOverlayRef.set({
      motdId: '00000000-0000-4000-8000-000000000001',
      contentVersion: 1,
    });
    motdHeader.acknowledgeUnseenCurrentMotd();
    expect(motdHeader.motdToolbarAttention()).toBe(false);

    motdHeader.activeOverlayRef.set({
      motdId: '00000000-0000-4000-8000-000000000002',
      contentVersion: 1,
    });
    expect(motdHeader.motdToolbarAttention()).toBe(true);
  });

  it('hält die Megafon-Hervorhebung nach Reload für dieselbe bereits gezeigte MOTD zurück', () => {
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(true);
    motdHeader.hasActiveOverlay.set(true);
    motdHeader.activeOverlayRef.set({
      motdId: '00000000-0000-4000-8000-000000000001',
      contentVersion: 2,
    });
    motdHeader.acknowledgeUnseenCurrentMotd();
    motdHeader.unseenCurrentMotdAcked.set(false);
    motdHeader.seenOverlayRef.set(null);
    motdHeader.restoreSeenOverlayFromSession();

    expect(motdHeader.motdToolbarAttention()).toBe(false);
  });

  it('hebt das Megafon nicht hervor, wenn keine aktuelle Overlay-MOTD offen ist', () => {
    const motdHeader = TestBed.inject(MotdHeaderStateService);
    motdHeader.motdToolbarIcon.set(true);
    motdHeader.hasActiveOverlay.set(false);
    motdHeader.archiveUnreadCount.set(2);
    const fixture = createToolbar();
    const btn = fixture.nativeElement.querySelector('.top-toolbar__motd-btn') as HTMLElement;

    expect(btn.classList.contains('top-toolbar__motd-btn--attention')).toBe(false);
    fixture.destroy();
  });

  it('stilisiert die Megafon-Hervorhebung tokenbasiert und ohne Bewegung bei reduced-motion', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const scssPath = join(dirname(fileURLToPath(import.meta.url)), './top-toolbar.component.scss');
    const scss = readFileSync(scssPath, 'utf8');
    expect(scss).toMatch(/\.top-toolbar__motd-btn--attention/);
    expect(scss).toMatch(/--mat-sys-primary/);
    expect(scss).toMatch(/prefers-reduced-motion:\s*no-preference/);
    expect(scss).toMatch(/top-toolbar-motd-attention/);
    const playful = scss.slice(scss.indexOf(':host-context(html.preset-playful)'));
    expect(playful).toMatch(/\.top-toolbar__motd-btn--attention/);
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
    expect(scss).toMatch(
      /\.top-toolbar__mobile\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/,
    );
    expect(scss).toMatch(
      /\.top-toolbar__mobile \.top-toolbar__toggles--preset-mobile\s*\{[^}]*grid-column:\s*1 \/ -1/,
    );
    expect(scss).toMatch(
      /\.top-toolbar__mobile \.top-toolbar__toggle\s*\{[^}]*min-height:\s*2\.75rem/,
    );
    expect(scss).toMatch(
      /\.top-toolbar__toggles--theme\s*\{[^}]*border:\s*1px solid var\(--mat-sys-outline-variant\)/,
    );
    expect(scss).toMatch(
      /\.top-toolbar__toggles--theme\s*\{[\s\S]*?\.top-toolbar__toggle\s*\{[^}]*min-width:\s*3rem[^}]*min-height:\s*3rem/,
    );
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
