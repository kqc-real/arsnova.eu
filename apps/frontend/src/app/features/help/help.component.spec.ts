import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, withInMemoryScrolling } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocaleFromPath } from '../../core/locale-from-path';
import { HelpComponent } from './help.component';

vi.mock('../../core/locale-from-path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/locale-from-path')>();
  return {
    ...actual,
    getLocaleFromPath: vi.fn(actual.getLocaleFromPath),
  };
});

@Component({
  selector: 'app-help-router-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class HelpRouterHostComponent {}

describe('HelpComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [provideRouter([]), { provide: MatDialog, useValue: { openDialogs: [] } }],
    });
  });

  afterEach(() => {
    document.querySelectorAll('base').forEach((el) => el.remove());
    document.querySelectorAll('app-help-router-host').forEach((el) => el.remove());
    window.history.replaceState(window.history.state, '', '/');
    vi.clearAllMocks();
  });

  async function createFixture() {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('ruft bei Klick auf den Backdrop location.back auf', async () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
    const fixture = await createFixture();
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    const backdrop = (fixture.nativeElement as HTMLElement).querySelector(
      '.content-page-backdrop-sheet',
    );
    expect(backdrop).toBeTruthy();
    backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('schließt per Escape und hält den Fokus im Panel', async () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
    const fixture = await createFixture();
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');

    const panel = fixture.nativeElement.querySelector('.content-page-panel') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('schließt die Seite nicht per Escape solange ein MatDialog offen ist', async () => {
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
    await createFixture();
    const location = TestBed.inject(Location);
    const dialog = TestBed.inject(MatDialog);
    const spy = vi.spyOn(location, 'back');
    Object.defineProperty(dialog, 'openDialogs', { configurable: true, get: () => [{}] });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('benennt Navigations-Landmarks lokalisierbar', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('nav.content-back')?.getAttribute('aria-label')).toBe('Navigation');
    expect(root.querySelector('nav.help-role-nav')?.getAttribute('aria-label')).toBe('Rollenwahl');
  });

  it('rendert beide Rollenkarten mit locale-sicheren Ankerzielen', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const hostCard = root.querySelector<HTMLAnchorElement>('a.help-role-card[href$="#help-host"]');
    const participantCard = root.querySelector<HTMLAnchorElement>(
      'a.help-role-card[href$="#help-participant"]',
    );
    expect(hostCard?.getAttribute('href')).toMatch(/\/help#help-host$/);
    expect(participantCard?.getAttribute('href')).toMatch(/\/help#help-participant$/);
    expect(hostCard?.textContent).toContain('Ich leite eine Veranstaltung');
    expect(participantCard?.textContent).toContain('Ich nehme an einer Veranstaltung teil');
    expect(root.querySelector('#help-host')).toBeTruthy();
    expect(root.querySelector('#help-participant')).toBeTruthy();
  });

  it('baut Rollenkarten-hrefs unter Production-base href mit Locale', async () => {
    const base = document.createElement('base');
    base.setAttribute('href', '/de/');
    document.head.prepend(base);
    vi.mocked(getLocaleFromPath).mockReturnValue('de');

    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const hostCard = root.querySelector<HTMLAnchorElement>('a.help-role-card[href$="#help-host"]');
    const participantCard = root.querySelector<HTMLAnchorElement>(
      'a.help-role-card[href$="#help-participant"]',
    );
    expect(hostCard?.getAttribute('href')).toBe('/de/help#help-host');
    expect(participantCard?.getAttribute('href')).toBe('/de/help#help-participant');
  });

  it('wiederholt die Rollenicons in den Abschnittsüberschriften und zeigt eines für Für alle', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    expect(
      root.querySelector('#help-host-title .help-section__title-icon')?.textContent?.trim(),
    ).toBe('school');
    expect(
      root.querySelector('#help-participant-title .help-section__title-icon')?.textContent?.trim(),
    ).toBe('groups');
    expect(
      root.querySelector('#help-common-title .help-section__title-icon')?.textContent?.trim(),
    ).toBe('info');
  });

  it('landet bei initialem Fragmentaufruf am Rollenabschnitt ohne History-Push', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HelpRouterHostComponent, HelpComponent],
      providers: [
        provideRouter(
          [
            { path: 'de/help', component: HelpComponent },
            { path: 'help', component: HelpComponent },
          ],
          withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
        ),
        { provide: MatDialog, useValue: { openDialogs: [] } },
      ],
    });

    const hostFixture = TestBed.createComponent(HelpRouterHostComponent);
    document.body.appendChild(hostFixture.nativeElement);
    hostFixture.detectChanges();

    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewSpy,
    });
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const router = TestBed.inject(Router);
    // Browser-URL inkl. Hash vor Aktivierung setzen (neuer Tab / Fragmentaufruf).
    window.history.replaceState(window.history.state, '', '/de/help#help-participant');
    const navigated = await router.navigateByUrl('/de/help#help-participant');
    expect(navigated).toBe(true);
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    hostFixture.detectChanges();

    // afterNextRender / ngAfterViewInit + setTimeout(0)
    await new Promise((resolve) => setTimeout(resolve, 0));
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    const title = document.querySelector('#help-participant-title') as HTMLElement | null;
    const section = document.querySelector('#help-participant');
    expect(router.url).toContain('/de/help');
    expect(window.location.hash).toBe('#help-participant');
    expect(title).toBeTruthy();
    expect(section).toBeTruthy();
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(scrollIntoViewSpy.mock.instances.some((instance) => instance === section)).toBe(true);
    expect(document.activeElement).toBe(title);
    expect(pushStateSpy).not.toHaveBeenCalled();
    pushStateSpy.mockRestore();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('setzt bei Rollenkarten-Klick Fragment per replaceState, scrollt und fokussiert den Abschnitt', async () => {
    const fixture = await createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const hostSection = (fixture.nativeElement as HTMLElement).querySelector(
      '#help-host',
    ) as HTMLElement;
    const hostTitle = (fixture.nativeElement as HTMLElement).querySelector(
      '#help-host-title',
    ) as HTMLElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(hostSection, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const focusSpy = vi.spyOn(hostTitle, 'focus');
    const hostCard = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      'a.help-role-card[href$="#help-host"]',
    );
    expect(hostCard).toBeTruthy();
    expect(hostTitle.getAttribute('tabindex')).toBe('-1');

    hostCard!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    fixture.detectChanges();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceStateSpy.mock.calls[0]?.[2] ?? '')).toContain('#help-host');
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    replaceStateSpy.mockRestore();
    pushStateSpy.mockRestore();
  });

  it('nutzt bei prefers-reduced-motion sofortiges Scrollen ohne Router-Navigation', async () => {
    const previousMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(
        (query: string) =>
          ({
            matches: query.includes('prefers-reduced-motion: reduce'),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as MediaQueryList,
      ),
    });
    const fixture = await createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const hostSection = (fixture.nativeElement as HTMLElement).querySelector(
      '#help-host',
    ) as HTMLElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(hostSection, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const hostCard = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      'a.help-role-card[href$="#help-host"]',
    );

    hostCard!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(navigateSpy).not.toHaveBeenCalled();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: previousMatchMedia,
    });
  });

  it('rendert beide Rollen und beide Erfahrungsgruppen', async () => {
    const fixture = await createFixture();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Ich leite eine Veranstaltung');
    expect(text).toContain('Ich nehme an einer Veranstaltung teil');
    expect(text).toContain('Für alle');
    expect(text.match(/Neu bei arsnova\.eu/g)?.length).toBeGreaterThanOrEqual(2);
    expect(text.match(/Schon vertraut mit arsnova\.eu/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('hält die Überschriftenreihenfolge für die Info-Landing-Aside ein', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const headings = Array.from(root.querySelectorAll('h1, h2, h3')).map((el) => ({
      level: Number(el.tagName.slice(1)),
      id: el.id || null,
    }));

    expect(headings[0]).toEqual({ level: 1, id: 'help-page-title' });
    expect(headings[1]).toEqual({ level: 2, id: 'help-info-landing-title' });
    expect(root.querySelector('aside.help-info-landing app-info-landing-link')).toBeTruthy();

    let previous = headings[0]!.level;
    for (const heading of headings.slice(1)) {
      expect(heading.level).toBeLessThanOrEqual(previous + 1);
      previous = heading.level;
    }
  });

  it('rendert die erwarteten Akkordeonpanels ohne Verschachtelung', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const panels = root.querySelectorAll('mat-expansion-panel.help-panel');
    expect(panels.length).toBe(17);
    expect(root.querySelectorAll('mat-expansion-panel mat-expansion-panel').length).toBe(0);
    expect(root.querySelectorAll('mat-accordion').length).toBe(5);
  });

  it('öffnet das erste Anfängerpanel pro Rolle und hält Referenzpanels geschlossen', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const hostPanels = root.querySelectorAll('#help-host mat-expansion-panel.help-panel');
    const participantPanels = root.querySelectorAll(
      '#help-participant mat-expansion-panel.help-panel',
    );
    const commonPanels = root.querySelectorAll('#help-common mat-expansion-panel.help-panel');

    expect(hostPanels[0]?.classList.contains('mat-expanded')).toBe(true);
    for (let i = 1; i < hostPanels.length; i++) {
      expect(hostPanels[i]?.classList.contains('mat-expanded')).toBe(false);
    }

    expect(participantPanels[0]?.classList.contains('mat-expanded')).toBe(true);
    for (let i = 1; i < participantPanels.length; i++) {
      expect(participantPanels[i]?.classList.contains('mat-expanded')).toBe(false);
    }

    for (const panel of Array.from(commonPanels)) {
      expect(panel.classList.contains('mat-expanded')).toBe(false);
    }
  });

  it('lässt Panels öffnen und schließen und aktualisiert aria-expanded', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const hostPanels = root.querySelectorAll('#help-host mat-expansion-panel.help-panel');
    const firstHeader = hostPanels[0]?.querySelector<HTMLElement>('.mat-expansion-panel-header');
    const secondHeader = hostPanels[1]?.querySelector<HTMLElement>('.mat-expansion-panel-header');
    expect(firstHeader?.getAttribute('aria-expanded')).toBe('true');
    expect(secondHeader?.getAttribute('aria-expanded')).toBe('false');

    secondHeader!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(secondHeader?.getAttribute('aria-expanded')).toBe('true');
    expect(firstHeader?.getAttribute('aria-expanded')).toBe('true');

    firstHeader!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(firstHeader?.getAttribute('aria-expanded')).toBe('false');
  });

  it('setzt inert auf geschlossenen Panelinhalt mit Link', async () => {
    const fixture = await createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const privacyPanel = Array.from(
      root.querySelectorAll('#help-common mat-expansion-panel.help-panel'),
    ).find((panel) => panel.textContent?.includes('Wie werden Daten und Inhalte behandelt?'));
    expect(privacyPanel).toBeTruthy();

    const body = privacyPanel!.querySelector('.help-panel__body');
    expect(body?.hasAttribute('inert')).toBe(true);
    expect(privacyPanel!.querySelector('a[href*="/legal/privacy"]')).toBeTruthy();

    const header = privacyPanel!.querySelector<HTMLElement>('.mat-expansion-panel-header');
    header!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(body?.hasAttribute('inert')).toBe(false);
  });

  it('bewahrt zentrale Produktinhalte und entfernt Roadmap-Texte', async () => {
    const fixture = await createFixture();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Single Choice');
    expect(text).toContain('Selbsteinschätzung');
    expect(text).toContain('Peer Instruction');
    expect(text).toContain('Q&A');
    expect(text).toContain('Blitzlicht');
    expect(text).toContain('Tempo-Feedback');
    expect(text).toContain('Nachbesprechungsplan');
    expect(text).toContain('Sync-Link');
    expect(text).toContain('sechsstelligen Code');
    expect(text).toContain('Demo-Quiz');
    expect(text).not.toContain('Moderationskompass');
    expect(text).not.toContain('asynchrone Q&A-NLP-Signale');
    expect(text).not.toMatch(/Rekordteilnahme/i);
  });
});
