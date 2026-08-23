import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import type { HostCurrentQuestionDTO } from '@arsnova/shared-types';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { SessionProjectionQuizComponent } from './session-projection-quiz.component';

function choiceQuestion(overrides: Partial<HostCurrentQuestionDTO> = {}): HostCurrentQuestionDTO {
  return {
    questionId: '11111111-1111-4111-8111-111111111111',
    order: 0,
    totalQuestions: 5,
    text: 'Was ist 2 + 2?',
    type: 'SINGLE_CHOICE',
    difficulty: 'EASY',
    showQuestionTypeIndicators: true,
    answers: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'Drei', isCorrect: false },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'Vier', isCorrect: true },
    ],
    ...overrides,
  };
}

describe('SessionProjectionQuizComponent', () => {
  let fixture: ComponentFixture<SessionProjectionQuizComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionProjectionQuizComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SessionProjectionQuizComponent);
  });

  it('zeigt in der Lesephase den Fragetext ohne Antwortoptionen', () => {
    fixture.componentRef.setInput('question', choiceQuestion());
    fixture.componentRef.setInput('status', 'QUESTION_OPEN');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Was ist 2 + 2?');
    expect(text).toContain('Lesephase');
    expect(text).toContain('menu_book');
    expect(fixture.nativeElement.querySelector('.session-projection-quiz__reading')).toBeTruthy();
    expect(text).not.toContain('Drei');
    expect(text).not.toContain('Vier');
  });

  it('zeigt während der Abstimmung die Optionen ohne Lösung', () => {
    fixture.componentRef.setInput('question', choiceQuestion());
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.componentRef.setInput('participantCount', 20);
    fixture.componentRef.setInput('voteProgress', {
      questionId: '11111111-1111-4111-8111-111111111111',
      questionOrder: 0,
      round: 1,
      totalVotes: 10,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Drei');
    expect(text).toContain('Vier');
    expect(text).toContain('50');
    expect(text).not.toContain('check_circle');
  });

  it('zeigt nach der Freigabe Verteilung und richtige Antwort', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        voteDistribution: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            text: 'Drei',
            isCorrect: false,
            voteCount: 4,
            votePercentage: 40,
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            text: 'Vier',
            isCorrect: true,
            voteCount: 6,
            votePercentage: 60,
          },
        ],
        totalVotes: 10,
      }),
    );
    fixture.componentRef.setInput('status', 'RESULTS');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('40');
    expect(text).toContain('60');
    expect(text).toContain('check_circle');
    const answers = fixture.nativeElement.querySelectorAll(
      '.session-projection-quiz__answer',
    ) as NodeListOf<HTMLElement>;
    expect(answers[0].classList.contains('session-projection-quiz__answer--wrong')).toBe(true);
    expect(answers[1].classList.contains('session-projection-quiz__answer--correct')).toBe(true);
    const fills = fixture.nativeElement.querySelectorAll(
      '.session-projection-quiz__bar-fill',
    ) as NodeListOf<HTMLElement>;
    expect(fills[0].classList.contains('session-projection-quiz__bar-fill--correct')).toBe(false);
    expect(fills[1].classList.contains('session-projection-quiz__bar-fill--correct')).toBe(true);
    expect(
      fixture.nativeElement.querySelectorAll('.session-projection-quiz__bar-track').length,
    ).toBe(2);
  });

  it('markiert die Lesephase als volle Projektionsbühne', () => {
    fixture.componentRef.setInput('question', choiceQuestion());
    fixture.componentRef.setInput('status', 'QUESTION_OPEN');
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--reading')).toBe(true);
    expect(stage.classList.contains('session-projection-quiz--results')).toBe(false);
    expect(stage.classList.contains('session-projection-quiz--split')).toBe(false);
  });

  it('legt Abstimmung und Ergebnisse in ein Zweispalten-Raster', () => {
    fixture.componentRef.setInput('question', choiceQuestion());
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--split')).toBe(true);
    expect(stage.querySelector('.session-projection-quiz__question')).toBeTruthy();
    expect(stage.querySelector('.session-projection-quiz__stage')).toBeTruthy();
  });

  it('spannt den Diskussionshinweis über beide Spalten', () => {
    fixture.componentRef.setInput('question', choiceQuestion({ type: 'NUMERIC_ESTIMATE' }));
    fixture.componentRef.setInput('status', 'DISCUSSION');
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--split')).toBe(true);
    expect(stage.classList.contains('session-projection-quiz--discussion')).toBe(true);
    expect(stage.textContent).toContain('Tauscht euch kurz aus');
  });

  it('zeigt Zuordnungsoptionen während der Abstimmung ohne Lösungspaare', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        type: 'MATCHING',
        text: 'Ordne die Hauptstädte zu',
        answers: [],
        matchingPairs: [
          { leftId: 'l1', left: 'Berlin', rightId: 'r1', right: 'Deutschland' },
          { leftId: 'l2', left: 'Paris', rightId: 'r2', right: 'Frankreich' },
        ],
      }),
    );
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Berlin');
    expect(text).toContain('Deutschland');
    expect(text).toContain('Paris');
    expect(text).toContain('Frankreich');
    expect(text).toContain('Begriffe');
    expect(text).toContain('Gegenstücke');
  });

  it('behält Datumsangaben in Matching-Chips und nummeriert sie nicht in 1. um', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        type: 'MATCHING',
        text: 'Ordne die Daten zu',
        answers: [],
        matchingPairs: [
          {
            leftId: 'l1',
            left: '9. November 1918',
            rightId: 'r1',
            right: 'Ausrufung der Republik',
          },
        ],
      }),
    );
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('9. November 1918');
    expect(text).not.toMatch(/^\s*1\.\s*November/m);
  });

  it('zeigt Reihenfolge- und Kategorie-Optionen während der Abstimmung', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        type: 'ORDERING',
        text: 'Bringe die Schritte in Reihenfolge',
        difficulty: 'HARD',
        answers: [],
        orderingItems: [
          { id: 'o1', text: 'Zuerst' },
          { id: 'o2', text: 'Danach' },
          { id: 'o3', text: 'Zuletzt' },
        ],
      }),
    );
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    let text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Zuerst');
    expect(text).toContain('Danach');
    expect(text).toContain('Zuletzt');
    expect(text).toContain('Schwer');

    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        type: 'CATEGORIZATION',
        text: 'Ordne die Elemente zu',
        answers: [],
        categories: [
          { id: 'c1', name: 'Säugetiere' },
          { id: 'c2', name: 'Vögel' },
        ],
        categorizationItems: [
          { id: 'i1', text: 'Delfin', correctCategoryId: 'c1' },
          { id: 'i2', text: 'Adler', correctCategoryId: 'c2' },
        ],
      }),
    );
    fixture.detectChanges();
    text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Säugetiere');
    expect(text).toContain('Vögel');
    expect(text).toContain('Delfin');
    expect(text).toContain('Adler');
  });

  it('zeigt Schwierigkeit und Letzte-Frage-Hinweis wie in der Abstimmung', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        order: 4,
        totalQuestions: 5,
        difficulty: 'MEDIUM',
      }),
    );
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Mittel');
    expect(text).toContain('fitness_center');
    expect(text).toContain('Letzte Frage');
    expect(text).toContain('Drei');
    expect(
      fixture.nativeElement.querySelector('.session-projection-quiz__pill--difficulty'),
    ).toBeTruthy();
  });

  it('blendet in der Lesephase auch strukturierte Optionen aus', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        type: 'MATCHING',
        text: 'Nur lesen',
        answers: [],
        matchingPairs: [{ leftId: 'l1', left: 'Berlin', rightId: 'r1', right: 'Deutschland' }],
      }),
    );
    fixture.componentRef.setInput('status', 'QUESTION_OPEN');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nur lesen');
    expect(text).toContain('Lesephase');
    expect(text).not.toContain('Berlin');
    expect(text).not.toContain('Deutschland');
  });

  it('zeigt gebündelte Demo-Bilder im Fragetext', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        text: 'Siehe ![Dach](/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png)',
      }),
    );
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
      '.session-projection-quiz__visual img',
    ) as HTMLImageElement | null;
    expect(image?.getAttribute('src')).toContain('/assets/demo/Bettgestell');
    expect(fixture.nativeElement.textContent).toContain('Siehe');
    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--with-visual')).toBe(true);
  });

  it('zeigt Matching-Ergebnisse als Paarliste statt als Matrix', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        type: 'MATCHING',
        text: '### Ordne die Daten zu\n\n_Nur links das Ereignis wählen._',
        answers: [],
        matchingPairs: [
          {
            leftId: 'l1',
            left: '9. November 1918',
            rightId: 'r1',
            right: 'Ausrufung der Republik',
          },
        ],
        matchingStats: {
          totalVotes: 8,
          fullyCorrectCount: 6,
          pairHitRates: [],
          commonConfusions: [],
          selectionCounts: [
            {
              leftId: 'l1',
              left: '9. November 1918',
              rightId: 'r1',
              right: 'Ausrufung der Republik',
              count: 6,
            },
            {
              leftId: 'l1',
              left: '9. November 1918',
              rightId: 'r2',
              right: 'Anderes Ereignis',
              count: 2,
            },
          ],
        },
      }),
    );
    fixture.componentRef.setInput('status', 'RESULTS');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ordne die Daten zu');
    expect(text).not.toContain('Nur links das Ereignis wählen');
    expect(text).toContain('9. November 1918');
    expect(text).toContain('Ausrufung der Republik');
    expect(text).toContain('75');
    expect(fixture.nativeElement.querySelector('app-presenter-distribution-matrix')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-projection-quiz__pair-list')).toBeTruthy();
  });

  it('zeigt das Fragenbild in der Abstimmung in der Visual-Spalte', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        text: '### Stimmung\n\n![Gesichter](https://example.com/faces.jpg)',
      }),
    );
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector(
      '.session-projection-quiz__visual img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe('https://example.com/faces.jpg');
    expect(
      (fixture.nativeElement.querySelector('.session-projection-quiz__title') as HTMLElement | null)
        ?.innerHTML,
    ).not.toContain('faces.jpg');
  });

  it('zeigt das Quiz-Motivbild nur bei der ersten Frage ohne eigenes Bild', () => {
    fixture.componentRef.setInput('question', choiceQuestion({ text: '### Ohne Bild' }));
    fixture.componentRef.setInput('motifImageUrl', 'https://example.com/motif.jpg');
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector(
      '.session-projection-quiz__visual img',
    ) as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe('https://example.com/motif.jpg');
  });

  it('blendet das Quiz-Motivbild ab der zweiten Frage aus', () => {
    fixture.componentRef.setInput('question', choiceQuestion({ order: 1, text: '### Ohne Bild' }));
    fixture.componentRef.setInput('motifImageUrl', 'https://example.com/motif.jpg');
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.session-projection-quiz__visual img')).toBeNull();
  });

  it('zeigt den Finger-Countdown als dritte Spalte in den letzten Sekunden', () => {
    TestBed.inject(ThemePresetService).setPreset('spielerisch', { silent: true });
    fixture.componentRef.setInput('question', choiceQuestion());
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.componentRef.setInput('countdownSeconds', 4);
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--fingers')).toBe(true);
    expect(fixture.nativeElement.querySelector('app-countdown-fingers')).toBeTruthy();
  });

  it('legt Codefragen dreispaltig an: Frage, Code, Antworten', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        text: '### Für welche Creative-Coding-Umgebung wurde dieses Sketch geschrieben?\n\n```java\nvoid setup() {\n  size(130, 130, OPENGL);\n}\n```',
        answers: [
          { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'Groovy', isCorrect: false },
          { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'Processing', isCorrect: true },
        ],
      }),
    );
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--code')).toBe(true);
    expect(stage.classList.contains('session-projection-quiz--split')).toBe(true);
    const title = stage.querySelector('.session-projection-quiz__title') as HTMLElement;
    const code = stage.querySelector('.session-projection-quiz__code') as HTMLElement;
    expect(title.textContent).toContain('Creative-Coding-Umgebung');
    expect(title.textContent).not.toContain('OPENGL');
    expect(code.textContent).toContain('size(130, 130, OPENGL)');
    expect(stage.querySelector('.session-projection-quiz__code-column')).toBeTruthy();
    expect(stage.textContent).toContain('Groovy');
    expect(stage.textContent).toContain('Processing');
  });

  it('zeigt in der Lesephase Code ohne Antwortoptionen', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        text: '### Für welche Creative-Coding-Umgebung wurde dieses Sketch geschrieben?\n\n```java\nvoid setup() {\n  size(130, 130, OPENGL);\n}\n```',
        answers: [
          { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'Groovy', isCorrect: false },
          { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'Processing', isCorrect: true },
        ],
      }),
    );
    fixture.componentRef.setInput('status', 'QUESTION_OPEN');
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--reading')).toBe(true);
    expect(stage.classList.contains('session-projection-quiz--code')).toBe(true);
    expect(stage.classList.contains('session-projection-quiz--split')).toBe(true);
    expect(stage.querySelector('.session-projection-quiz__code')?.textContent).toContain(
      'size(130, 130, OPENGL)',
    );
    expect(stage.textContent).toContain('Lesephase');
    expect(stage.textContent).not.toContain('Groovy');
    expect(stage.textContent).not.toContain('Processing');
  });

  it('blendet den Finger-Countdown außerhalb der letzten Sekunden aus', () => {
    TestBed.inject(ThemePresetService).setPreset('spielerisch', { silent: true });
    fixture.componentRef.setInput('question', choiceQuestion());
    fixture.componentRef.setInput('status', 'ACTIVE');
    fixture.componentRef.setInput('countdownSeconds', 12);
    fixture.detectChanges();

    const stage = fixture.nativeElement.querySelector(
      '[data-testid="presenter-quiz-stage"]',
    ) as HTMLElement;
    expect(stage.classList.contains('session-projection-quiz--fingers')).toBe(false);
    expect(fixture.nativeElement.querySelector('app-countdown-fingers')).toBeNull();
  });

  it('zeigt in Runde 2 Vorher/Nachher und Wechselwähler statt nur 0 %', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        currentRound: 2,
        totalVotes: 0,
        voteDistribution: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            text: 'Drei',
            isCorrect: false,
            voteCount: 0,
            votePercentage: 0,
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            text: 'Vier',
            isCorrect: true,
            voteCount: 0,
            votePercentage: 0,
          },
        ],
        roundComparison: {
          round1Total: 50,
          round2Total: 48,
          round1CorrectCount: 20,
          round2CorrectCount: 36,
          round1Distribution: [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              text: 'KI-generiertes Bild',
              isCorrect: false,
              voteCount: 30,
              votePercentage: 60,
            },
            {
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              text: 'Echtes Foto',
              isCorrect: true,
              voteCount: 20,
              votePercentage: 40,
            },
          ],
          round2Distribution: [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              text: 'KI-generiertes Bild',
              isCorrect: false,
              voteCount: 12,
              votePercentage: 25,
            },
            {
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              text: 'Echtes Foto',
              isCorrect: true,
              voteCount: 36,
              votePercentage: 75,
            },
          ],
          opinionShift: {
            bothRoundsCount: 48,
            changedCount: 18,
            changedPercentage: 38,
            wrongToCorrectCount: 16,
            correctToWrongCount: 2,
            migrations: [
              { from: 'KI-generiertes Bild', to: 'Echtes Foto', count: 16 },
              { from: 'Echtes Foto', to: 'KI-generiertes Bild', count: 2 },
            ],
          },
        },
      }),
    );
    fixture.componentRef.setInput('status', 'RESULTS');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Runde 1');
    expect(text).toContain('Runde 2');
    expect(text).toContain('60');
    expect(text).toContain('75');
    expect(text).toContain('KI-generiertes Bild');
    expect(text).toContain('änderten ihre Meinung');
    expect(text).toContain('falsch → richtig');
    expect(text).toContain('KI-generiertes Bild');
    expect(text).toContain('Echtes Foto');
    expect(
      fixture.nativeElement.querySelector('.session-projection-quiz__round-comparison'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.session-projection-quiz__opinion-shift'),
    ).toBeTruthy();
  });

  it('zeigt bei Wahlfragen die Korrektheitsauswertung', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        totalVotes: 50,
        correctVoterCount: 36,
        voteDistribution: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            text: 'Drei',
            isCorrect: false,
            voteCount: 14,
            votePercentage: 28,
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            text: 'Vier',
            isCorrect: true,
            voteCount: 36,
            votePercentage: 72,
          },
        ],
      }),
    );
    fixture.componentRef.setInput('status', 'RESULTS');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('komplett richtig');
    expect(fixture.nativeElement.textContent).toContain('36');
    expect(
      fixture.nativeElement.querySelector('.session-projection-quiz__evaluation'),
    ).toBeTruthy();
  });

  it('zeigt bei Schätzfragen Toleranzband und Interpretation', () => {
    fixture.componentRef.setInput(
      'question',
      choiceQuestion({
        type: 'NUMERIC_ESTIMATE',
        text: 'Runde π auf zwei Dezimalstellen.',
        answers: [],
        numericReferenceValue: 3.14,
        numericStats: {
          n: 50,
          mean: 3.2,
          median: 3.14,
          stdDev: 0.4,
          q1: 3.1,
          q3: 3.2,
          iqr: 0.1,
          min: 3,
          max: 4,
          inBandCount: 45,
          inBandPercent: 90,
          meanAbsoluteError: 0.08,
          meanRelativeError: 0.03,
        },
        numericHistogram: [
          { from: 3.0, to: 3.1, count: 5, inBand: false },
          { from: 3.1, to: 3.2, count: 45, inBand: true },
        ],
      }),
    );
    fixture.componentRef.setInput('status', 'RESULTS');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Median');
    expect(text).toContain('Akzeptiert');
    expect(text).toContain('Toleranzband');
    expect(text).toContain('Referenz');
    expect(fixture.nativeElement.querySelector('.session-projection-quiz__insights')).toBeTruthy();
  });
});
