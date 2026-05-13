import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WordCloudComponent } from './word-cloud.component';

describe('WordCloudComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WordCloudComponent],
    });
    TestBed.overrideProvider(LOCALE_ID, { useValue: 'de' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt aggregierte Wörter und filtert Antworten per Klick', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Motivation durch Teamarbeit',
      'Teamarbeit macht Spaß',
      'Motivation hilft beim Lernen',
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text.toLowerCase()).toContain('motivation');
    expect(text.toLowerCase()).toContain('teamarbeit');

    const component = fixture.componentInstance;
    component.toggleWord('motivation');
    fixture.detectChanges();

    expect(component.filteredResponses().length).toBe(2);
  });

  it('zaehlt Wiederholungen innerhalb derselben Antwort nur einmal pro Wortgruppe', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Motivation Motivation Motivation',
      'Motivation durch Teamarbeit',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words().find((entry) => entry.word === 'motivation')?.count).toBe(2);
  });

  it('nutzt Singularformen fuer genau einen Begriff und eine sichtbare Antwort', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['Motivation']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1 Wort');
    expect(text).toContain('1 Antwort');
    expect(text).toContain('Antwort anzeigen (1)');
  });

  it('filtert Stopwörter in der Standardansicht dauerhaft aus', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('responses', [
      'Motivation und Teamarbeit',
      'Teamarbeit und Fokus',
    ]);
    fixture.detectChanges();

    expect(component.words().some((entry) => entry.word === 'und')).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Stopwörter');
  });

  it('waehlt die Stopliste anhand der aktiven Locale', () => {
    TestBed.overrideProvider(LOCALE_ID, { useValue: 'en' });

    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'What does the formula mean?',
      'How does the formula work?',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words().some((entry) => entry.word === 'what')).toBe(false);
    expect(component.words().some((entry) => entry.word === 'how')).toBe(false);
    expect(component.words().some((entry) => entry.word === 'formula')).toBe(true);
  });

  it('gewichtet Wörter getrennt von der Fragenliste', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('title', 'Q&A-Word-Cloud');
    fixture.componentRef.setInput('itemLabelSingular', 'Frage');
    fixture.componentRef.setInput('itemLabelPlural', 'Fragen');
    fixture.componentRef.setInput('showResponsesPanel', false);
    fixture.componentRef.setInput('showReleaseNote', false);
    fixture.componentRef.setInput('responses', [
      'Kommt die Klausur vor?',
      'Bitte das Beispiel erklären',
    ]);
    fixture.componentRef.setInput('weightedResponses', [
      { text: 'Kommt die Klausur vor?', weight: 5 },
      { text: 'Bitte das Beispiel erklären', weight: 1 },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words().find((entry) => entry.word === 'klausur')?.count).toBe(5);
    expect(component.responseSummary().total).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('2 Fragen');
  });

  it('blendet Antworten standardmäßig eingeklappt ein und kann sie umschalten', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Motivation durch Teamarbeit',
      'Teamarbeit schafft Fokus',
    ]);
    fixture.componentRef.setInput('showReleaseNote', true);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.showResponses()).toBe(false);

    component.toggleResponses();
    fixture.detectChanges();

    expect(component.showResponses()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Word Cloud 2.1');
    expect(fixture.nativeElement.textContent).toContain('Wortfamilien');
    expect(fixture.nativeElement.textContent).toContain('Natural Language Processing');
    expect(fixture.nativeElement.textContent).toContain('Themenclustern');
  });

  it('zeigt standardmäßig Erklärtext und Gewichtungshinweis für bessere Orientierung', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['Motivation', 'Teamarbeit']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Antworten verdichten sich live zu einem schnellen Themenbild.');
    expect(text).toContain('Größere Begriffe stehen für häufigere Nennungen.');
  });

  it('kann öffentliche Presenter-Ansichten im Output-only-Modus ohne Bedien-UI rendern', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['Motivation', 'Teamarbeit']);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('outputOnly', true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Maximieren');
    expect(text).not.toContain('CSV exportieren');
    expect(text).not.toContain('PNG exportieren');
    expect(text).not.toContain('Antwort anzeigen');
    expect(fixture.nativeElement.querySelector('.word-cloud__supporting')).toBeNull();
  });

  it('nutzt im Q&A-Profil leichte Themenphrasen fuer Fragenwolken', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('title', 'Q&A-Word-Cloud');
    fixture.componentRef.setInput('itemLabelSingular', 'Frage');
    fixture.componentRef.setInput('itemLabelPlural', 'Fragen');
    fixture.componentRef.setInput('responses', [
      'Wie funktioniert lineare Regression im Praxisprojekt?',
      'Wann nutzen wir lineare Regression fuer Prognosen?',
      'Kommt Kapitel 4 in der Klausur vor?',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(
      component.words().find((entry) => entry.groupKey === 'lineare regression'),
    ).toMatchObject({
      word: 'lineare regression',
      count: 2,
      groupKey: 'lineare regression',
    });
    expect(component.words().find((entry) => entry.groupKey === 'kapitel 4')).toMatchObject({
      word: 'kapitel 4',
      count: 1,
      groupKey: 'kapitel 4',
    });
  });

  it('zeigt sinnvolle Zwei-Zeichen-Begriffe in der Wolke an', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['pi', 'KI', 'a']);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words().map((entry) => entry.word)).toEqual(['ki', 'pi']);
  });

  it('zeigt numerische Freitextwerte unverstueckelt an', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['3.14', '3,14', '7']);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words().map((entry) => entry.word)).toEqual(['3.14', '7']);
    expect(component.words().find((entry) => entry.word === '3.14')?.count).toBe(2);
  });

  it('zeigt gefilterte numerische Antworten in normalisierter Punktnotation', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['3, 14529', '3.14529', '13.14529']);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.toggleWord('3.14529');
    fixture.detectChanges();

    expect(component.filteredResponses()).toEqual(['3.14529', '3.14529']);
  });

  it('fasst Wortfamilien zusammen und filtert Antworten ueber den groupKey', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Die Validierung fehlt noch',
      'Das ist schon validiert',
      'Wir validieren morgen gemeinsam',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words().find((entry) => entry.groupKey === 'validieren')).toMatchObject({
      word: 'validieren',
      count: 3,
      groupKey: 'validieren',
    });

    component.toggleWord('validieren');
    fixture.detectChanges();

    expect(component.selectedWordLabel()).toBe('validieren');
    expect(component.filteredResponses()).toEqual([
      'Die Validierung fehlt noch',
      'Das ist schon validiert',
      'Wir validieren morgen gemeinsam',
    ]);
  });

  it('setzt den aktiven Filter zurueck, wenn die Frage-Scope wechselt', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('selectionScopeKey', 'question-a');
    fixture.componentRef.setInput('responses', [
      'Motivation durch Teamarbeit',
      'Teamarbeit schafft Fokus',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.toggleWord('motivation');
    fixture.detectChanges();

    expect(component.selectedWordLabel()).toBe('motivation');

    fixture.componentRef.setInput('selectionScopeKey', 'question-b');
    fixture.componentRef.setInput('responses', ['Neue Frage mit Struktur']);
    fixture.detectChanges();

    expect(component.selectedGroupKey()).toBe(null);
    expect(component.showResponses()).toBe(false);
  });

  it('setzt den aktiven Filter zurueck, wenn das Wort in neuen Daten nicht mehr vorkommt', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Motivation durch Teamarbeit',
      'Teamarbeit schafft Fokus',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.toggleWord('motivation');
    fixture.detectChanges();

    fixture.componentRef.setInput('responses', ['Nur Struktur bleibt sichtbar']);
    fixture.detectChanges();

    expect(component.selectedGroupKey()).toBe(null);
    expect(component.filteredResponses()).toEqual(['Nur Struktur bleibt sichtbar']);
  });

  it('laedt Antworten im Panel schrittweise nach', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput(
      'responses',
      Array.from({ length: 65 }, (_, index) => `Antwort ${index + 1}`),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.toggleResponses();
    fixture.detectChanges();

    expect(component.visibleResponses().length).toBe(50);
    expect(component.hasMoreResponses()).toBe(true);

    component.showMoreResponses();
    fixture.detectChanges();

    expect(component.visibleResponses().length).toBe(65);
    expect(component.hasMoreResponses()).toBe(false);
  });

  it('zeigt Varianten im Wort-Tooltip fuer transparentere Gruppenbildung', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Validierung fehlt noch',
      'Das ist schon validiert',
      'Wir validieren morgen gemeinsam',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const entry = component.words().find((item) => item.groupKey === 'validieren');

    expect(entry).toBeTruthy();
    expect(component.wordTooltip(entry!)).toContain('Formen:');
    expect(component.wordTooltip(entry!)).toContain('validierung');
    expect(component.wordTooltip(entry!)).toContain('validiert');
    expect(component.wordTooltip(entry!)).toContain('validieren');
  });

  it('exportiert CSV mit Variantenliste und setzt eine Statusmeldung', async () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Validierung fehlt noch',
      'Validierung bleibt wichtig',
      'Das ist schon validiert',
      'Wir validieren morgen gemeinsam',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const downloadSpy = vi
      .spyOn(component as never, 'downloadBlob')
      .mockImplementation(() => undefined);

    component.exportCsv();

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [csv, filename, mimeType] = downloadSpy.mock.calls[0] as [string, string, string];
    expect(csv).toContain('word,count,variants');
    expect(csv).toContain('"validieren",4,"validierung | validiert | validieren"');
    expect(filename).toMatch(/^wordcloud_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mimeType).toBe('text/csv;charset=utf-8');
    expect(component.statusMessage()).toBe('CSV exportiert.');
  });

  it('exportiert PNG mit erfolgreichem Status statt schwarzem Leerbild', async () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Motivation durch Teamarbeit',
      'Teamarbeit schafft Fokus',
      'Motivation hilft beim Lernen',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const documentRef = TestBed.inject(DOCUMENT);
    const originalCreateElement = documentRef.createElement.bind(documentRef);
    const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
    const anchor = originalCreateElement('a') as HTMLAnchorElement;
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const context = {
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 11 })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
    } satisfies Partial<CanvasRenderingContext2D>;

    vi.spyOn(canvas, 'getContext').mockReturnValue(context as CanvasRenderingContext2D);
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback: BlobCallback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:word-cloud');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(documentRef, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return canvas;
      }
      if (tagName === 'a') {
        return anchor;
      }
      return originalCreateElement(tagName);
    }) as typeof documentRef.createElement);

    await component.exportPng();

    expect(context.fillText).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(component.statusMessage()).toBe('PNG exportiert.');
    expect(fixture.nativeElement.textContent).toContain('PNG exportieren (geordnet)');
  });

  it('oeffnet die Wortwolke als maximalen Dialog', async () => {
    const openSpy = vi.fn();
    TestBed.overrideProvider(MatDialog, { useValue: { open: openSpy } });

    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Motivation durch Teamarbeit',
      'Teamarbeit schafft Fokus',
    ]);
    fixture.detectChanges();

    await fixture.componentInstance.openInDialog();

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [, config] = openSpy.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(config['panelClass']).toBe('word-cloud-dialog-panel');
    expect(config['width']).toBe('100vw');
    expect(config['height']).toBe('100dvh');
    expect(config['data']).toMatchObject({
      responses: ['Motivation durch Teamarbeit', 'Teamarbeit schafft Fokus'],
      title: 'Word-Cloud (Freitext)',
    });
  });
});
