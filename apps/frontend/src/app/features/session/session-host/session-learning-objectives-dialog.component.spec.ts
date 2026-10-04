import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionLearningObjectivesSnapshot } from '@arsnova/shared-types';
import {
  SessionLearningObjectivesDialogComponent,
  type SessionLearningObjectivesDialogData,
} from './session-learning-objectives-dialog.component';

const { getLearningObjectivesMock, saveLearningObjectivesMock } = vi.hoisted(() => ({
  getLearningObjectivesMock: vi.fn(),
  saveLearningObjectivesMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/trpc.client')>();
  return {
    ...actual,
    trpc: new Proxy(actual.trpc, {
      get(target, property, receiver) {
        if (property === 'session') {
          return {
            ...Reflect.get(target, property, receiver),
            getLearningObjectives: { query: getLearningObjectivesMock },
            saveLearningObjectives: { mutate: saveLearningObjectivesMock },
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

const SESSION_ID = '818f0501-506f-4fda-9421-bcaaeaf936d1';
const OBJECTIVE_ID = 'e22e814a-15bc-477d-9424-61e8055e13c8';
const QA_QUESTION_ID = '99d342a9-80af-479f-ae09-21db068e65ea';

function snapshot(
  overrides: Partial<SessionLearningObjectivesSnapshot> = {},
): SessionLearningObjectivesSnapshot {
  return {
    schemaVersion: 1,
    sessionId: SESSION_ID,
    learningContextRevision: 2,
    configured: true,
    access: { state: 'writable' },
    availableQuizTasks: [],
    availableQaTasks: [
      {
        kind: 'qa-question',
        questionId: QA_QUESTION_ID,
        text: 'Wie hängt das zusammen?',
      },
    ],
    availableQaTasksTruncated: false,
    objectives: [],
    ...overrides,
  };
}

function existingObjective(text = 'Servertext') {
  return {
    id: OBJECTIVE_ID,
    revision: 3,
    text,
    scope: { kind: 'session' as const },
    origin: { kind: 'manual' as const },
    confirmation: { state: 'draft' as const },
    projection: 'session-manual' as const,
    createdAt: '2026-10-04T10:00:00.000Z',
    updatedAt: '2026-10-04T10:00:00.000Z',
  };
}

describe('SessionLearningObjectivesDialogComponent', () => {
  const dialogRef = { close: vi.fn(), disableClose: false };
  const hasQuizMock = vi.fn(() => true);
  const data: SessionLearningObjectivesDialogData = {
    code: 'ABC123',
    hasQuiz: hasQuizMock,
  };

  beforeEach(() => {
    getLearningObjectivesMock.mockReset();
    saveLearningObjectivesMock.mockReset();
    hasQuizMock.mockReset();
    hasQuizMock.mockReturnValue(true);
    dialogRef.close.mockReset();
    dialogRef.disableClose = false;
    getLearningObjectivesMock.mockResolvedValue(snapshot());
    TestBed.configureTestingModule({
      imports: [SessionLearningObjectivesDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(SessionLearningObjectivesDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('speichert ein Q&A-bezogenes manuelles Ziel mit globaler und Zeilen-CAS', async () => {
    const saved = snapshot({
      learningContextRevision: 3,
      objectives: [existingObjective('Zusammenhang erklären')],
    });
    saveLearningObjectivesMock.mockResolvedValue(saved);
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Zusammenhang erklären');
    component.setScopeKind('question-set');
    component.toggleTask({ kind: 'qa-question', questionId: QA_QUESTION_ID }, true);
    component.setConfirmationState('confirmed');

    await component.save();

    expect(saveLearningObjectivesMock).toHaveBeenCalledWith({
      code: 'ABC123',
      expectedLearningContextRevision: 2,
      mutations: [
        expect.objectContaining({
          action: 'upsert',
          expectedRevision: null,
          text: 'Zusammenhang erklären',
          scope: {
            kind: 'question-set',
            taskReferences: [{ kind: 'qa-question', questionId: QA_QUESTION_ID }],
          },
          confirmationState: 'confirmed',
        }),
      ],
    });
    expect(component.snapshot()).toEqual(saved);
    expect(dialogRef.disableClose).toBe(false);
  });

  it('legt in einer reinen Q&A-Session ein manuelles Ziel ohne erfundenen Quizbereich an', async () => {
    hasQuizMock.mockReturnValue(false);
    saveLearningObjectivesMock.mockResolvedValue(
      snapshot({ learningContextRevision: 3, objectives: [existingObjective('Q&A-Ziel')] }),
    );
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Q&A-Ziel');
    component.setConfirmationState('confirmed');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Gesamtes Quiz');
    await component.save();

    expect(saveLearningObjectivesMock).toHaveBeenCalledWith({
      code: 'ABC123',
      expectedLearningContextRevision: 2,
      mutations: [
        expect.objectContaining({
          action: 'upsert',
          scope: { kind: 'session' },
          confirmationState: 'confirmed',
        }),
      ],
    });
  });

  it('lädt bei CONFLICT die autoritative Fassung und verhindert einen blinden zweiten Save', async () => {
    const initial = snapshot({ objectives: [existingObjective('Erster Stand')] });
    const latest = snapshot({
      learningContextRevision: 4,
      objectives: [{ ...existingObjective('Neuer anderer Host-Stand'), revision: 4 }],
    });
    getLearningObjectivesMock.mockResolvedValueOnce(initial).mockResolvedValueOnce(latest);
    saveLearningObjectivesMock.mockRejectedValueOnce({ data: { code: 'CONFLICT' } });
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginEdit(initial.objectives[0]!);
    component.setText('Mein staler Entwurf');

    await component.save();
    await component.save();

    expect(saveLearningObjectivesMock).toHaveBeenCalledTimes(1);
    expect(component.formOpen()).toBe(false);
    expect(component.snapshot()?.objectives[0]?.text).toBe('Neuer anderer Host-Stand');
    expect(component.conflictMessage()).toContain('Serverfassung');
  });

  it('sperrt weitere Schreibversuche, wenn der autoritative Refetch nach CONFLICT fehlschlägt', async () => {
    const initial = snapshot({ objectives: [existingObjective()] });
    getLearningObjectivesMock
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('offline'));
    saveLearningObjectivesMock.mockRejectedValueOnce({ data: { code: 'CONFLICT' } });
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginEdit(initial.objectives[0]!);
    component.setText('Nicht überschreiben');

    await component.save();
    await component.save();

    expect(component.authoritativeReloadRequired()).toBe(true);
    expect(component.conflictMessage()).toContain('gesperrt');
    expect(saveLearningObjectivesMock).toHaveBeenCalledTimes(1);
  });

  it('verhindert Escape-/Backdrop-Schließen während einer laufenden Mutation', async () => {
    let resolveSave!: (value: SessionLearningObjectivesSnapshot) => void;
    saveLearningObjectivesMock.mockImplementation(
      () =>
        new Promise<SessionLearningObjectivesSnapshot>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Asynchrones Ziel');

    const savePromise = component.save();
    expect(dialogRef.disableClose).toBe(true);
    component.close();
    expect(dialogRef.close).not.toHaveBeenCalled();
    resolveSave(snapshot({ learningContextRevision: 3 }));
    await savePromise;

    expect(dialogRef.disableClose).toBe(false);
  });

  it('fokussiert bei leerer Aufgabenauswahl eine sichtbare Q&A-Auswahl', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Ziel');
    component.setScopeKind('question-set');
    fixture.detectChanges();

    await component.save();
    fixture.detectChanges();
    await fixture.whenStable();

    const taskOption = document.getElementById(
      `session-learning-objective-task-qa-question:${QA_QUESTION_ID}`,
    );
    expect(taskOption?.contains(document.activeElement)).toBe(true);
  });

  it('stellt nach Abbruch den Fokus auf die erneut sichtbare Hinzufügen-Aktion', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    fixture.detectChanges();

    component.cancelEdit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe('session-learning-objective-add');
  });

  it('verhindert die 101. Live-Aufgabenreferenz', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();

    for (let index = 0; index < 101; index += 1) {
      component.toggleTask(
        {
          kind: 'qa-question',
          questionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        },
        true,
      );
    }

    expect(component.selectedTaskKeys().size).toBe(100);
    expect(component.errorMessage()).toContain('Höchstens 100');
  });

  it('rendert Markdown in auswählbaren Live-Aufgaben ohne verschachtelte Interaktionen', async () => {
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            questionId: 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3',
            order: 0,
            text: '### **Ableitung** mit [Quelle](https://example.org)',
          },
        ],
      }),
    );
    const fixture = await createComponent();
    fixture.componentInstance.beginAdd();
    fixture.componentInstance.setScopeKind('question-set');
    fixture.detectChanges();

    const preview = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.session-objectives__task-text',
      ) as NodeListOf<HTMLElement>,
    ).find((element) => element.textContent?.includes('Quizaufgabe 1'))!;
    expect(preview.querySelector('strong')?.textContent).toBe('Ableitung');
    expect(preview.textContent).toContain('Quizaufgabe 1');
    expect(preview.textContent).not.toContain('###');
    expect(preview.querySelector('a, img, button')).toBeNull();
  });

  it('erklärt manuelle und automatisch aus Aufgaben formulierte Lernziele', async () => {
    const fixture = await createComponent();

    const intro = fixture.nativeElement.querySelector(
      '.session-objectives__origin-intro',
    ) as HTMLElement;
    expect(intro.textContent).toContain('Manuelle Lernziele formulierst du selbst');
    expect(intro.textContent).toContain('Automatisch aus Aufgaben formulierte Lernziele');
    expect(intro.textContent).toContain('fachlich geprüft');
  });

  it('erklärt Entwurf und Bestätigt direkt an den Statusoptionen', async () => {
    const fixture = await createComponent();
    fixture.componentInstance.beginAdd();
    fixture.detectChanges();

    const statusGroup = fixture.nativeElement.querySelector(
      '[aria-label="Status des Lernziels"]',
    ) as HTMLElement;
    expect(statusGroup.textContent).toContain('Noch nicht fachlich geprüft');
    expect(statusGroup.textContent).toContain('Relevante Quellenänderungen');
  });
});
