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

  it('nutzt Singularformen fuer genau ein Wort und eine sichtbare Antwort', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['Motivation']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1 Wort');
    expect(text).toContain('1 Antwort');
    expect(text).toContain('Antwort anzeigen (1)');
  });

  it('stellt Rang und Häufigkeit zusätzlich als Textliste bereit', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', [
      'Motivation Teamarbeit',
      'Motivation Feedback',
      'Motivation',
    ]);
    fixture.detectChanges();

    const ranking = fixture.nativeElement.querySelector(
      'ol.sr-only[aria-label="Wortwolke"]',
    ) as HTMLOListElement | null;
    const entries = Array.from(ranking?.querySelectorAll('li') ?? []).map((entry) =>
      entry.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(ranking).not.toBeNull();
    expect(entries[0]).toContain('motivation: Nennungen: 3');
    expect(entries).toHaveLength(fixture.componentInstance.words().length);
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

  it('rendert vorgewichtete Terme ohne Rohtexte erneut zu analysieren', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('responses', ['rohtext soll nicht als wolkenwort erscheinen']);
    fixture.componentRef.setInput('terms', [
      {
        key: 'docker compose',
        label: 'docker compose',
        score: 12.5,
        documentFrequency: 2,
        sourceCount: 2,
        variants: ['docker compose'],
        kind: 'protected',
        basisLabel: 'docker compose',
        confidence: null,
        members: [
          { sourceId: 'q1', text: 'docker compose startet nicht', weight: 4 },
          { sourceId: 'q2', text: 'docker compose zeigt HTTP 404', weight: 2 },
        ],
      },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words()).toMatchObject([
      {
        word: 'docker compose',
        count: 13,
        sourceCount: 2,
        groupKey: 'docker compose',
      },
    ]);
    expect(component.words().some((entry) => entry.word === 'rohtext')).toBe(false);

    component.toggleWord('docker compose');
    expect(component.filteredResponses()).toEqual([
      'docker compose startet nicht',
      'docker compose zeigt HTTP 404',
    ]);
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
    expect(text).toContain('Häufig genannte Wörter erscheinen größer.');
    expect(text).toContain('Je größer ein Wort, desto öfter wurde es genannt.');
  });

  it('kann öffentliche Presenter-Ansichten im Output-only-Modus ohne Bedien-UI rendern', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('responses', ['Motivation', 'Teamarbeit']);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('outputOnly', true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Maximieren');
    expect(text).not.toContain('CSV speichern');
    expect(text).not.toContain('PNG speichern');
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

  it('ordnet im maximierten Wrapped-Modus die groessten Begriffe zur Wolkenmitte hin an', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('disableCloudLayout', true);
    fixture.componentRef.setInput('responses', [
      'alpha alpha alpha alpha alpha',
      'alpha',
      'beta beta beta beta',
      'beta',
      'gamma gamma gamma',
      'delta delta',
      'epsilon',
    ]);
    fixture.detectChanges();

    const words = fixture.componentInstance.displayWords();
    expect(words).toHaveLength(5);
    expect(words[2]?.rank).toBe(0);
    expect(words[3]?.rank).toBe(1);
    expect(words[0]?.rank).toBeGreaterThan(words[2]!.rank);
    expect(words[4]?.rank).toBeGreaterThan(words[3]!.rank);
  });

  it('begrenzt die D3-Buehnenhoehe im mobilen Vollbild ohne gemessene Rahmenhoehe', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('responses', [
      'lineare Regression',
      'Konfidenzintervall',
      'Standardabweichung',
      'p-Wert',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      stageWidth: { set(value: number): void };
      availableVisualFrameHeight: { set(value: number): void };
      cloudStageHeightPx: () => number;
    };

    component.stageWidth.set(320);
    component.availableVisualFrameHeight.set(0);

    expect(component.cloudStageHeightPx()).toBe(384);
  });

  it('laesst die D3-Buehnenhoehe im Vollbild oberhalb des Mobile-Breakpoints mit der Breite wachsen', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('responses', [
      'lineare Regression',
      'Konfidenzintervall',
      'Standardabweichung',
      'p-Wert',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      stageWidth: { set(value: number): void };
      availableVisualFrameHeight: { set(value: number): void };
      cloudStageHeightPx: () => number;
      stageMinHeight: () => string;
    };

    component.availableVisualFrameHeight.set(0);
    component.stageWidth.set(640);
    const mediumHeight = component.cloudStageHeightPx();
    const mediumMinHeight = component.stageMinHeight();

    component.stageWidth.set(960);
    const wideHeight = component.cloudStageHeightPx();
    const wideMinHeight = component.stageMinHeight();

    expect(mediumHeight).toBeLessThan(wideHeight);
    expect(Number.parseInt(mediumMinHeight, 10)).toBeLessThan(Number.parseInt(wideMinHeight, 10));
  });

  it('haelt die D3-Vollbildbuehne in knappen Landscape-Hoehen sichtbar zentriert', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('responses', [
      'lineare Regression',
      'Konfidenzintervall',
      'Standardabweichung',
      'p-Wert',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      stageWidth: { set(value: number): void };
      availableVisualFrameHeight: { set(value: number): void };
      cloudStageHeightPx: () => number;
    };

    component.stageWidth.set(812);
    component.availableVisualFrameHeight.set(150);
    fixture.detectChanges();

    const visualFrame = fixture.nativeElement.querySelector(
      '.word-cloud__visual-frame',
    ) as HTMLElement;

    expect(visualFrame.classList.contains('word-cloud__visual-frame--scrollable')).toBe(true);
    expect(component.cloudStageHeightPx()).toBe(180);
  });

  it('nutzt knapp ausreichende Landscape-Hoehen ohne unnoetigen Scrollrahmen aus', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('responses', [
      'lineare Regression',
      'Konfidenzintervall',
      'Standardabweichung',
      'p-Wert',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      stageWidth: { set(value: number): void };
      availableVisualFrameHeight: { set(value: number): void };
      cloudStageHeightPx: () => number;
    };

    component.stageWidth.set(812);
    component.availableVisualFrameHeight.set(220);
    fixture.detectChanges();

    const visualFrame = fixture.nativeElement.querySelector(
      '.word-cloud__visual-frame',
    ) as HTMLElement;

    expect(visualFrame.classList.contains('word-cloud__visual-frame--scrollable')).toBe(false);
    expect(component.cloudStageHeightPx()).toBe(220);
  });

  it('haelt die Desktop-D3-Buehne im Vollbild innerhalb der verfuegbaren Rahmenhoehe', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('responses', [
      'lineare Regression',
      'Konfidenzintervall',
      'Standardabweichung',
      'p-Wert',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      stageWidth: { set(value: number): void };
      availableVisualFrameHeight: { set(value: number): void };
      cloudStageHeightPx: () => number;
    };

    component.stageWidth.set(1280);
    component.availableVisualFrameHeight.set(540);
    fixture.detectChanges();

    const visualFrame = fixture.nativeElement.querySelector(
      '.word-cloud__visual-frame',
    ) as HTMLElement;

    expect(visualFrame.classList.contains('word-cloud__visual-frame--scrollable')).toBe(false);
    expect(component.cloudStageHeightPx()).toBe(540);
  });

  it('verkleinert die D3-Begriffe im mobilen Vollbild gegenueber Desktop-Praesentation', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('responses', [
      'lineare Regression',
      'lineare Regression',
      'Standardabweichung',
      'p-Wert',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      stageWidth: { set(value: number): void };
      words: () => Array<{ size: number; word: string }>;
    };

    component.stageWidth.set(320);
    const mobileTopSize = component.words()[0]?.size;

    component.stageWidth.set(960);
    const desktopTopSize = component.words()[0]?.size;

    expect(mobileTopSize).toBeDefined();
    expect(desktopTopSize).toBeDefined();
    expect(mobileTopSize!).toBeLessThan(desktopTopSize!);
    expect(mobileTopSize!).toBeLessThanOrEqual(24);
  });

  it('skaliert die D3-Begriffe im mobilen Vollbild auch zwischen schmalen Breiten weiter herunter', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('presentationMode', true);
    fixture.componentRef.setInput('responses', [
      'lineare Regression',
      'lineare Regression',
      'lineare Regression',
      'Standardabweichung',
      'Konfidenzintervall',
      'p-Wert',
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      stageWidth: { set(value: number): void };
      words: () => Array<{ size: number; word: string }>;
    };

    component.stageWidth.set(520);
    const mediumMobileTopSize = component.words()[0]?.size;

    component.stageWidth.set(360);
    const narrowMobileTopSize = component.words()[0]?.size;

    expect(mediumMobileTopSize).toBeDefined();
    expect(narrowMobileTopSize).toBeDefined();
    expect(narrowMobileTopSize!).toBeLessThan(mediumMobileTopSize!);
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
    expect(component.wordTooltip(entry!)).toContain('Nennungen: 3');
    expect(component.wordTooltip(entry!)).toContain('Auch gezählt:');
    expect(component.wordTooltip(entry!)).toContain('validierung');
    expect(component.wordTooltip(entry!)).toContain('validiert');
    expect(component.wordTooltip(entry!)).toContain('validieren');
  });

  it('zeigt im Q&A-Tooltip den gewichteten Wert, die Metrikbasis und zugehörige Fragen', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('itemLabelSingular', 'Frage');
    fixture.componentRef.setInput('itemLabelPlural', 'Fragen');
    fixture.componentRef.setInput('tooltipMetricLabel', 'belastbare Zustimmung');
    fixture.componentRef.setInput('responses', [
      'Sollten wir zuerst Python oder zuerst die Formel herleiten?',
      'Brauchen wir noch ein Rechenbeispiel zur Standardabweichung?',
      'Sollten wir Python Beispiele als Hausaufgabe vorbereiten?',
    ]);
    fixture.componentRef.setInput('weightedResponses', [
      { text: 'Sollten wir zuerst Python oder zuerst die Formel herleiten?', weight: 21 },
      { text: 'Brauchen wir noch ein Rechenbeispiel zur Standardabweichung?', weight: 8 },
      { text: 'Sollten wir Python Beispiele als Hausaufgabe vorbereiten?', weight: 5 },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const entry = component.words().find((item) => item.groupKey === 'python');

    expect(entry).toBeTruthy();
    const tooltip = component.wordTooltipDisplay(entry!);
    expect(tooltip).toContain('Größenwert: 23');
    expect(tooltip).toContain('In 2 Fragen gefunden');
    expect(tooltip).toContain('Gewichtung: belastbare Zustimmung');
    expect(tooltip).toContain('Fragen:');
    expect(tooltip).toContain('• Sollten wir zuerst Python oder zuerst');
    expect(tooltip).toContain('   Formel herleiten?');
    expect(tooltip).toContain('• Sollten wir Python Beispiele als');
    expect(tooltip).toContain('   Hausaufgabe vorbereiten?');
  });

  it('nutzt gelieferte Analyse-Entries fuer Themenlabels und Mitgliederfilter', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('responses', [
      'Kapitel 4 klausurrelevant?',
      'Kapitel 4 pruefungsstoff?',
    ]);
    fixture.componentRef.setInput('analysisEntries', [
      {
        key: 'pruefungsstoff-kapitel-4',
        label: 'Pruefungsstoff Kapitel 4',
        count: 2,
        basisLabel: 'Kapitel 4',
        members: [
          {
            sourceId: 'question-1',
            text: 'Kapitel 4 klausurrelevant?',
            weight: 1,
          },
          {
            sourceId: 'question-2',
            text: 'Kapitel 4 pruefungsstoff?',
            weight: 1,
          },
        ],
        variants: ['Pruefungsstoff Kapitel 4'],
        confidence: 0.92,
      },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.words()).toMatchObject([
      {
        word: 'Pruefungsstoff Kapitel 4',
        groupKey: 'pruefungsstoff-kapitel-4',
        count: 2,
      },
    ]);

    const initialText = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(initialText).toContain('Im Fokus: Pruefungsstoff Kapitel 4');

    component.toggleWord('pruefungsstoff-kapitel-4');
    fixture.detectChanges();

    expect(component.filteredResponses()).toEqual([
      'Kapitel 4 klausurrelevant?',
      'Kapitel 4 pruefungsstoff?',
    ]);
    const tooltip = component.wordTooltipDisplay(component.words()[0]!);
    expect(tooltip).toContain('Zusammengefasst als: Kapitel 4');
    expect(tooltip).toMatch(/Erkennung:\s*sicher\s*\(92\s*%\)/);
    expect(tooltip).toContain('Kapitel 4 klausurrelevant?');

    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('Pruefungsstoff Kapitel 4');
    expect(text).toContain('Zusammengefasst als: Kapitel 4');
    expect(text).toMatch(/Erkennung:\s*sicher\s*\(92\s*%\)/);
    expect(text).toContain('Ausgewählt: Pruefungsstoff Kapitel 4');

    const highBadge = fixture.nativeElement.querySelector('.word-cloud__meta-pill--detail-high');
    expect(highBadge?.textContent?.replace(/\s+/g, ' ')).toMatch(
      /Erkennung:\s*sicher\s*\(92\s*%\)/,
    );
  });

  it('stuft Analyse-Confidence semantisch in mittel und niedrig ein', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('responses', ['Frage A', 'Frage B']);
    fixture.componentRef.setInput('analysisEntries', [
      {
        key: 'mittel-cluster',
        label: 'Lineare Regression',
        count: 4,
        basisLabel: 'lineare Regression',
        members: [
          {
            sourceId: 'question-1',
            text: 'Frage A',
            weight: 2,
          },
        ],
        variants: ['lineare Regression'],
        confidence: 0.72,
      },
      {
        key: 'vorsichtig-cluster',
        label: 'Klausurthema',
        count: 2,
        basisLabel: 'Klausurthema',
        members: [
          {
            sourceId: 'question-2',
            text: 'Frage B',
            weight: 1,
          },
        ],
        variants: ['Klausurthema'],
        confidence: 0.54,
      },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.confidenceFilter()).toBe('all');

    expect(component.wordTooltipDisplay(component.words()[0]!)).toMatch(
      /Erkennung:\s*mittel\s*\(72\s*%\)/,
    );
    expect(component.wordTooltipDisplay(component.words()[1]!)).toMatch(
      /Erkennung:\s*unsicher\s*\(54\s*%\)/,
    );

    component.setConfidenceFilter('low');
    fixture.detectChanges();

    expect(component.wordTooltipDisplay(component.words()[0]!)).toMatch(
      /Erkennung:\s*unsicher\s*\(54\s*%\)/,
    );

    component.setConfidenceFilter('medium');
    fixture.detectChanges();

    component.toggleWord('mittel-cluster');
    fixture.detectChanges();

    const mediumBadge = fixture.nativeElement.querySelector(
      '.word-cloud__meta-pill--detail-medium',
    );
    expect(mediumBadge?.textContent?.replace(/\s+/g, ' ')).toMatch(
      /Erkennung:\s*mittel\s*\(72\s*%\)/,
    );

    component.setConfidenceFilter('low');
    fixture.detectChanges();

    component.toggleWord('vorsichtig-cluster');
    fixture.detectChanges();

    const cautiousBadge = fixture.nativeElement.querySelector(
      '.word-cloud__meta-pill--detail-cautious',
    );
    expect(cautiousBadge?.textContent?.replace(/\s+/g, ' ')).toMatch(
      /Erkennung:\s*unsicher\s*\(54\s*%\)/,
    );
  });

  it('filtert Themen-Entries ueber den Erkennungs-Toggle nach sicher, mittel und unsicher', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('responses', ['Frage A', 'Frage B', 'Frage C']);
    fixture.componentRef.setInput('analysisEntries', [
      {
        key: 'hoch-cluster',
        label: 'Kapitel 4',
        count: 6,
        basisLabel: 'Kapitel 4',
        members: [
          {
            sourceId: 'question-1',
            text: 'Frage A',
            weight: 2,
          },
        ],
        variants: ['Kapitel 4'],
        confidence: 0.91,
      },
      {
        key: 'mittel-cluster',
        label: 'lineare Regression',
        count: 4,
        basisLabel: 'lineare Regression',
        members: [
          {
            sourceId: 'question-2',
            text: 'Frage B',
            weight: 2,
          },
        ],
        variants: ['lineare Regression'],
        confidence: 0.72,
      },
      {
        key: 'niedrig-cluster',
        label: 'Klausurthema',
        count: 2,
        basisLabel: 'Klausurthema',
        members: [
          {
            sourceId: 'question-3',
            text: 'Frage C',
            weight: 1,
          },
        ],
        variants: ['Klausurthema'],
        confidence: 0.54,
      },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(text).toContain('Erkannte Themen');
    expect(text).toContain('sicher');
    expect(text).toContain('mittel');
    expect(text).toContain('unsicher');
    expect(component.confidenceFilter()).toBe('high');
    expect(component.words().map((entry) => entry.groupKey)).toEqual(['hoch-cluster']);
    expect(component.filteredResponses()).toEqual(['Frage A']);

    component.setConfidenceFilter('all');
    fixture.detectChanges();
    expect(component.words()).toHaveLength(3);
    expect(component.filteredResponses()).toEqual(['Frage A', 'Frage B', 'Frage C']);

    component.setConfidenceFilter('medium');
    fixture.detectChanges();
    expect(component.words().map((entry) => entry.groupKey)).toEqual(['mittel-cluster']);
    expect(component.filteredResponses()).toEqual(['Frage B']);

    component.setConfidenceFilter('low');
    fixture.detectChanges();
    expect(component.words().map((entry) => entry.groupKey)).toEqual(['niedrig-cluster']);
    expect(component.filteredResponses()).toEqual(['Frage C']);

    component.setConfidenceFilter('all');
    fixture.detectChanges();
    expect(component.words()).toHaveLength(3);
  });

  it('zeigt Analyse-Fallbacks ohne Treffsicherheit trotz hohem Defaultfilter', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('responses', ['Welche Frage gewinnt?']);
    fixture.componentRef.setInput('analysisEntries', [
      {
        key: 'gewinnt',
        label: 'gewinnt',
        count: 4,
        basisLabel: null,
        members: [
          {
            sourceId: 'question-1',
            text: 'Welche Frage gewinnt?',
            weight: 4,
          },
        ],
        variants: ['gewinnt'],
        confidence: null,
      },
      {
        key: 'offen',
        label: 'offen',
        count: 1,
        basisLabel: null,
        members: [
          {
            sourceId: 'question-2',
            text: 'Welche Frage bleibt offen?',
            weight: 1,
          },
        ],
        variants: ['offen'],
        confidence: null,
      },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.confidenceFilter()).toBe('high');
    expect(component.showConfidenceFilterToggle()).toBe(false);
    expect(component.words().map((entry) => entry.groupKey)).toEqual(['gewinnt', 'offen']);
    expect(component.filteredResponses()).toEqual([
      'Welche Frage gewinnt?',
      'Welche Frage bleibt offen?',
    ]);
  });

  it('haelt beim asynchronen Eintreffen von Theme-Entries den Default auf hoch', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('responses', ['Frage A', 'Frage B']);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.confidenceFilter()).toBe('high');

    fixture.componentRef.setInput('analysisEntries', [
      {
        key: 'hoch-cluster',
        label: 'Kapitel 4',
        count: 6,
        basisLabel: 'Kapitel 4',
        members: [
          {
            sourceId: 'question-1',
            text: 'Frage A',
            weight: 2,
          },
        ],
        variants: ['Kapitel 4'],
        confidence: 0.91,
      },
      {
        key: 'mittel-cluster',
        label: 'Regression',
        count: 4,
        basisLabel: 'Regression',
        members: [
          {
            sourceId: 'question-2',
            text: 'Frage B',
            weight: 1,
          },
        ],
        variants: ['Regression'],
        confidence: 0.71,
      },
    ]);
    fixture.detectChanges();

    expect(component.confidenceFilter()).toBe('high');
    expect(component.words().map((entry) => entry.groupKey)).toEqual(['hoch-cluster']);
    expect(component.filteredResponses()).toEqual(['Frage A']);
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

  it('exportiert Analyse-Entries im CSV mit Basis und Mitgliedern', () => {
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('analysisMode', 'qa');
    fixture.componentRef.setInput('responses', [
      'Kapitel 4 klausurrelevant?',
      'Kapitel 4 pruefungsstoff?',
    ]);
    fixture.componentRef.setInput('analysisEntries', [
      {
        key: 'pruefungsstoff-kapitel-4',
        label: 'Pruefungsstoff Kapitel 4',
        count: 2,
        basisLabel: 'Kapitel 4',
        members: [
          {
            sourceId: 'question-1',
            text: 'Kapitel 4 klausurrelevant?',
            weight: 1,
          },
          {
            sourceId: 'question-2',
            text: 'Kapitel 4 pruefungsstoff?',
            weight: 1,
          },
        ],
        variants: ['Pruefungsstoff Kapitel 4'],
        confidence: 0.92,
      },
    ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const downloadSpy = vi
      .spyOn(component as never, 'downloadBlob')
      .mockImplementation(() => undefined);

    component.exportCsv();

    const [csv] = downloadSpy.mock.calls[0] as [string, string, string];
    expect(csv).toContain('label,count,variants,basis,members');
    expect(csv).toContain(
      '"Pruefungsstoff Kapitel 4",2,"Pruefungsstoff Kapitel 4","Kapitel 4","Kapitel 4 klausurrelevant? | Kapitel 4 pruefungsstoff?"',
    );
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
    expect(fixture.nativeElement.textContent).toContain('PNG speichern');
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
      disableCloudLayout: false,
      responses: ['Motivation durch Teamarbeit', 'Teamarbeit schafft Fokus'],
      title: 'Wortwolke',
    });
  });

  it('fordert beim Maximieren echtes Browser-Vollbild an', async () => {
    const openSpy = vi.fn();
    const requestFullscreenSpy = vi.fn(() => Promise.resolve());
    TestBed.overrideProvider(MatDialog, { useValue: { open: openSpy } });

    const documentRef = TestBed.inject(DOCUMENT);
    const previousDescriptor = Object.getOwnPropertyDescriptor(
      documentRef.documentElement,
      'requestFullscreen',
    );
    Object.defineProperty(documentRef.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreenSpy,
    });

    try {
      const fixture = TestBed.createComponent(WordCloudComponent);
      fixture.componentRef.setInput('responses', [
        'Motivation durch Teamarbeit',
        'Teamarbeit schafft Fokus',
      ]);
      fixture.detectChanges();

      fixture.componentInstance.handleMaximize();

      expect(requestFullscreenSpy).toHaveBeenCalledWith({ navigationUI: 'hide' });
      await vi.waitUntil(() => openSpy.mock.calls.length === 1, {
        timeout: 1000,
        interval: 10,
      });
    } finally {
      if (previousDescriptor) {
        Object.defineProperty(documentRef.documentElement, 'requestFullscreen', previousDescriptor);
      } else {
        delete (documentRef.documentElement as Partial<HTMLElement>).requestFullscreen;
      }
    }
  });

  it('nutzt optional einen benutzerdefinierten Maximieren-Handler', () => {
    const maximizeSpy = vi.fn();
    const fixture = TestBed.createComponent(WordCloudComponent);
    fixture.componentRef.setInput('maximizeActionHandler', maximizeSpy);
    fixture.componentRef.setInput('responses', ['Motivation durch Teamarbeit']);
    fixture.detectChanges();

    fixture.componentInstance.handleMaximize();

    expect(maximizeSpy).toHaveBeenCalledTimes(1);
  });
});
