import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LastSessionFeedbackDialogComponent } from './last-session-feedback-dialog.component';

const { getLastSessionAnalysisQueryMock } = vi.hoisted(() => ({
  getLastSessionAnalysisQueryMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getLastSessionAnalysisForQuiz: {
        query: getLastSessionAnalysisQueryMock,
      },
    },
  },
}));

describe('LastSessionFeedbackDialogComponent', () => {
  const matDialogRefMock = {
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getLastSessionAnalysisQueryMock.mockResolvedValue(null);

    TestBed.configureTestingModule({
      imports: [LastSessionFeedbackDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            serverQuizId: '11111111-1111-4111-8111-111111111111',
            accessProof: 'proof',
            quizName: 'Chemie 101',
          },
        },
        {
          provide: MatDialogRef,
          useValue: matDialogRefMock,
        },
      ],
    });
  });

  it('laedt die letzte Session-Auswertung beim Start', async () => {
    getLastSessionAnalysisQueryMock.mockResolvedValue({
      endedAt: '2026-04-15T11:00:00.000Z',
      participantCount: 5,
      confidenceSummary: {
        responseCount: 5,
        includedQuestionCount: 1,
        suppressedQuestionCount: 0,
        priorityQuestionCount: 1,
        distribution: { '1': 0, '2': 1, '3': 0, '4': 2, '5': 2 },
        crossTab: {
          correctHigh: 2,
          correctMid: 0,
          correctLow: 1,
          incorrectHigh: 2,
          incorrectMid: 0,
          incorrectLow: 0,
        },
        highConfidenceWrongCount: 2,
        questions: [
          {
            questionOrder: 0,
            questionTextShort: '### Was ist Wasser?\n\n> **Hinweis:** Denke an die Summenformel.',
            questionType: 'SINGLE_CHOICE',
            responseCount: 5,
            result: {
              distribution: { '1': 0, '2': 1, '3': 0, '4': 2, '5': 2 },
              crossTab: {
                correctHigh: 2,
                correctMid: 0,
                correctLow: 1,
                incorrectHigh: 2,
                incorrectMid: 0,
                incorrectLow: 0,
              },
              highConfidenceWrongCount: 2,
            },
          },
        ],
      },
      feedbackSummary: {
        totalResponses: 2,
        overallAverage: 4,
        overallDistribution: { '3': 1, '5': 1 },
        questionQualityAverage: 4,
        questionQualityDistribution: { '4': 1 },
        wouldRepeatYes: 1,
        wouldRepeatNo: 1,
      },
    });
    const fixture = TestBed.createComponent(LastSessionFeedbackDialogComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getLastSessionAnalysisQueryMock).toHaveBeenCalledWith({
      quizId: '11111111-1111-4111-8111-111111111111',
      accessProof: 'proof',
    });
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.payload()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Gesamtbewertung');
    expect(fixture.nativeElement.textContent).toContain('Feedback der Teilnehmenden');
    expect(fixture.nativeElement.textContent).toContain('Lernstand und Sicherheit');
    expect(
      fixture.nativeElement.querySelector(
        '.last-session-feedback-dialog__confidence-question-markdown h3',
      )?.textContent,
    ).toContain('Was ist Wasser?');
    expect(
      fixture.nativeElement.querySelector(
        '.last-session-feedback-dialog__confidence-question-markdown blockquote strong',
      )?.textContent,
    ).toContain('Hinweis:');
  });

  it('zeigt den Empty-State wenn kein Feedback vorhanden ist', async () => {
    getLastSessionAnalysisQueryMock.mockResolvedValue(null);
    const fixture = TestBed.createComponent(LastSessionFeedbackDialogComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.payload()).toBeNull();
    expect(text).toContain('Noch keine Auswertung');
    expect(text).not.toContain('Aggregierte Auswertung des zuletzt beendeten');
  });

  it('zeigt bei Ladefehler ebenfalls den Empty-State ohne technische Fehlermeldung', async () => {
    getLastSessionAnalysisQueryMock.mockRejectedValue(new Error('boom'));
    const fixture = TestBed.createComponent(LastSessionFeedbackDialogComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.loadError()).toBe(true);
    expect(fixture.componentInstance.payload()).toBeNull();
    expect(text).toContain('Die Auswertung konnte nicht geladen werden');
    expect(text).not.toContain('Noch keine Auswertung');
  });

  it('schliesst den Dialog', () => {
    const fixture = TestBed.createComponent(LastSessionFeedbackDialogComponent);

    fixture.componentInstance.close();

    expect(matDialogRefMock.close).toHaveBeenCalledTimes(1);
  });
});
