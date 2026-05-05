import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LastSessionFeedbackDialogComponent } from './last-session-feedback-dialog.component';

const { getLastSessionFeedbackQueryMock } = vi.hoisted(() => ({
  getLastSessionFeedbackQueryMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getLastSessionFeedbackForQuiz: {
        query: getLastSessionFeedbackQueryMock,
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
    getLastSessionFeedbackQueryMock.mockResolvedValue(null);

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

  it('laedt das letzte Session-Feedback beim Start', async () => {
    getLastSessionFeedbackQueryMock.mockResolvedValue({
      endedAt: '2026-04-15T11:00:00.000Z',
      summary: {
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

    expect(getLastSessionFeedbackQueryMock).toHaveBeenCalledWith({
      quizId: '11111111-1111-4111-8111-111111111111',
      accessProof: 'proof',
    });
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.payload()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Gesamtbewertung');
    expect(fixture.nativeElement.textContent).toContain('Feedback der Teilnehmenden');
    expect(fixture.nativeElement.textContent).toContain('Zusammenfassung aus freiwilligen Angaben');
  });

  it('zeigt den Empty-State wenn kein Feedback vorhanden ist', async () => {
    getLastSessionFeedbackQueryMock.mockResolvedValue(null);
    const fixture = TestBed.createComponent(LastSessionFeedbackDialogComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.payload()).toBeNull();
    expect(text).toContain('Noch kein Feedback');
    expect(text).not.toContain('Zusammenfassung aus freiwilligen Angaben');
  });

  it('zeigt bei Ladefehler ebenfalls den Empty-State ohne technische Fehlermeldung', async () => {
    getLastSessionFeedbackQueryMock.mockRejectedValue(new Error('boom'));
    const fixture = TestBed.createComponent(LastSessionFeedbackDialogComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.loadError()).toBe(true);
    expect(fixture.componentInstance.payload()).toBeNull();
    expect(text).toContain('Das Feedback konnte nicht geladen werden');
    expect(text).not.toContain('Noch kein Feedback');
  });

  it('schliesst den Dialog', () => {
    const fixture = TestBed.createComponent(LastSessionFeedbackDialogComponent);

    fixture.componentInstance.close();

    expect(matDialogRefMock.close).toHaveBeenCalledTimes(1);
  });
});
