import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WordCloudComponent } from './word-cloud.component';

describe('WordCloudComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WordCloudComponent],
    });
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

  it('nutzt Singularformen fuer genau einen Begriff und eine sichtbare Antwort', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['Motivation']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1 Wort');
    expect(text).toContain('1 Antwort');
    expect(text).toContain('Antwort anzeigen (1)');
  });

  it('kann Stopwörter optional einblenden', () => {
    TestBed.overrideProvider(LOCALE_ID, { useValue: 'de' });

    const fixture = TestBed.createComponent(WordCloudComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('responses', [
      'Motivation und Teamarbeit',
      'Teamarbeit und Fokus',
    ]);
    fixture.detectChanges();

    expect(component.words().some((entry) => entry.word === 'und')).toBe(false);
    component.toggleStopwords();
    fixture.detectChanges();
    expect(component.words().some((entry) => entry.word === 'und')).toBe(true);
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
    expect(fixture.nativeElement.textContent).toContain('Word Cloud 2.0');
    expect(fixture.nativeElement.textContent).toContain('intelligente Moderationshilfe');
    expect(fixture.nativeElement.textContent).toContain('Natural Language Processing');
    expect(fixture.nativeElement.textContent).toContain('gemeinsamen Themen');
  });

  it('zeigt standardmäßig Erklärtext und Gewichtungshinweis für bessere Orientierung', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['Motivation', 'Teamarbeit']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Antworten verdichten sich live zu einem schnellen Themenbild.');
    expect(text).toContain('Größere Begriffe stehen für häufigere Nennungen.');
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

  it('exportiert CSV und setzt eine Statusmeldung', () => {
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
    const anchor = originalCreateElement('a') as HTMLAnchorElement;
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const blobSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:word-cloud-csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(documentRef, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a') {
        return anchor;
      }
      return originalCreateElement(tagName);
    }) as typeof documentRef.createElement);

    component.exportCsv();

    expect(blobSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
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
  });
});
