import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpComponent } from './help.component';

describe('HelpComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ruft bei Klick auf den Backdrop location.back auf', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const backdrop = (fixture.nativeElement as HTMLElement).querySelector(
      '.content-page-backdrop-sheet',
    );
    expect(backdrop).toBeTruthy();
    backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('zeigt keine Rekordteilnahme mehr auf der Hilfeseite', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toMatch(/Rekordteilnahme/i);
  });

  it('beschreibt das Tempo-Feedback im Blitzlicht-Abschnitt', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Tempo-Feedback');
    expect(text).toContain('aggregierte Tendenz');
  });

  it('differenziert die verfügbaren Quiz-Frageformate', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Single Choice');
    expect(text).toContain('Multiple Choice');
    expect(text).toContain('Kurzantwort');
    expect(text).toContain('Freitext');
    expect(text).toContain('Umfrage');
    expect(text).toContain('Bewertungsskala');
    expect(text).toContain('Numerische Schätzfrage');
    expect(text).toContain('Musterlösungen');
    expect(text).toContain('Keine automatische Bewertung');
    expect(text).toContain('Referenzwert');
  });

  it('beschreibt die Q&A-Fragenwand didaktisch', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Fragenwand im Live-Kanal Q&A');
    expect(text).toContain('Kollektives Hoch- und Runtervoting');
    expect(text).toContain('Q&A-Wortwolke auf Themenebene');
    expect(text).toContain('Moderationskompass');
    expect(text).toContain('asynchrone Q&A-NLP-Signale');
  });

  it('beschreibt die Selbsteinschätzung didaktisch', async () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Selbsteinschätzung bei bewertbaren Fragen');
    expect(text).toContain('selbstsicher falsch');
    expect(text).toContain('Nachbesprechungsplan');
    expect(text).toContain('Progressive Disclosure');
  });
});
