import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpComponent } from './help.component';

describe('HelpComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [provideRouter([]), { provide: MatDialog, useValue: { openDialogs: [] } }],
    });
  });

  afterEach(() => {
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
    expect(hostCard?.getAttribute('href')).toBe('/help#help-host');
    expect(participantCard?.getAttribute('href')).toBe('/help#help-participant');
    expect(hostCard?.textContent).toContain('Ich leite eine Veranstaltung');
    expect(participantCard?.textContent).toContain('Ich nehme an einer Veranstaltung teil');
    expect(root.querySelector('#help-host')).toBeTruthy();
    expect(root.querySelector('#help-participant')).toBeTruthy();
  });

  it('hält bei Rollenkarten-Klick die Hilfeseite und setzt den Fragment-Pfad', async () => {
    const fixture = await createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const hostSection = (fixture.nativeElement as HTMLElement).querySelector(
      '#help-host',
    ) as HTMLElement;
    Object.defineProperty(hostSection, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    const hostCard = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      'a.help-role-card[href$="#help-host"]',
    );
    expect(hostCard).toBeTruthy();

    hostCard!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    fixture.detectChanges();

    expect(hostSection.scrollIntoView).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/help#help-host', { replaceUrl: true });
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
