import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_QUIZ_ID } from '../quiz/data/quiz-store.service';
import { SessionQuizPickerDialogComponent } from './session-quiz-picker-dialog.component';

describe('SessionQuizPickerDialogComponent', () => {
  function setup() {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [SessionQuizPickerDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            sessionProfile: {
              teamMode: false,
            },
            quizzes: [
              {
                id: 'older',
                name: 'Altes Quiz',
                description: 'Kurzbeschreibung eins.',
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-02T10:00:00.000Z',
                questionCount: 3,
                teamMode: false,
                hasBonus: false,
                lastServerQuizId: null,
                lastServerQuizAccessProof: null,
              },
              {
                id: 'newer',
                name: 'Neues Quiz',
                description: 'Kurzbeschreibung zwei.',
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-03T10:00:00.000Z',
                questionCount: 5,
                teamMode: true,
                hasBonus: false,
                lastServerQuizId: null,
                lastServerQuizAccessProof: null,
              },
            ],
          },
        },
        {
          provide: MatDialogRef,
          useValue: { close },
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionQuizPickerDialogComponent);
    fixture.detectChanges();

    return { fixture, close };
  }

  it('renders the shared dialog header and the onboarding profile summary', () => {
    const { fixture } = setup();
    const host = fixture.nativeElement as HTMLElement;
    const title = host.querySelector('.dialog-title-header');

    expect(title).toBeTruthy();
    expect(host.textContent).toContain('Quiz auswählen');
    expect(host.textContent).toContain('Wähle ein Quiz aus deiner Sammlung.');
    expect(host.textContent).toContain('Aktuelle Teambindung');
    expect(host.textContent).toContain(
      'Keine aktiven Teams. Einzelspieler-Quizze startest du direkt. Bei einem Team-Quiz kannst du alle im Raum den Teams des Quiz zuordnen.',
    );
  });

  it('bietet inkompatible Quizze mit Neu-Zuordnung an', () => {
    const { fixture, close } = setup();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain(
      'Teambindung passt nicht. Du kannst alle im Raum den Teams dieses Quiz zuordnen.',
    );
    expect(host.textContent).toContain('Teams neu zuordnen');

    const adopt = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Teams neu zuordnen'),
    ) as HTMLButtonElement;
    expect(adopt.classList.contains('session-quiz-picker__adopt')).toBe(true);
    adopt.click();

    expect(close).toHaveBeenCalledWith({ quizId: 'newer', adoptQuizTeams: true });
  });

  it('zeigt bei aktiver Teambindung den Team-Hinweis', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [SessionQuizPickerDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            sessionProfile: {
              teamMode: true,
            },
            quizzes: [
              {
                id: 'team-quiz',
                name: 'Team Quiz',
                description: 'Kurzbeschreibung.',
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-03T10:00:00.000Z',
                questionCount: 5,
                teamMode: true,
                hasBonus: false,
                lastServerQuizId: null,
                lastServerQuizAccessProof: null,
              },
              {
                id: 'solo-quiz',
                name: 'Solo Quiz',
                description: 'Kurzbeschreibung.',
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-04T10:00:00.000Z',
                questionCount: 2,
                teamMode: false,
                hasBonus: false,
                lastServerQuizId: null,
                lastServerQuizAccessProof: null,
              },
            ],
          },
        },
        {
          provide: MatDialogRef,
          useValue: { close },
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionQuizPickerDialogComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain(
      'Aktive Teams. Team-Quizze übernehmen die aktuelle Struktur. Ein Einzelspieler-Quiz kannst du trotzdem wählen – dann endet die Teambindung.',
    );
    expect(host.textContent).toContain('Ohne Teams starten');
  });

  it('startet kompatible Quizze ohne Neu-Zuordnung', () => {
    const { fixture, close } = setup();
    const host = fixture.nativeElement as HTMLElement;
    const items = Array.from(host.querySelectorAll('.session-quiz-picker__item-name')).map((node) =>
      node.textContent?.trim(),
    );

    expect(items).toEqual(['Neues Quiz', 'Altes Quiz']);

    (host.querySelectorAll('.session-quiz-picker__item')[1] as HTMLButtonElement).click();

    expect(close).toHaveBeenCalledWith({ quizId: 'older', adoptQuizTeams: false });
  });

  it('behandelt das Demo-Quiz in teamlosen Räumen als direkt startbar', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [SessionQuizPickerDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            sessionProfile: { teamMode: false },
            quizzes: [
              {
                id: DEMO_QUIZ_ID,
                name: 'Demo Quiz',
                description: 'Showcase',
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-03T10:00:00.000Z',
                questionCount: 9,
                teamMode: true,
                hasBonus: true,
                lastServerQuizId: null,
                lastServerQuizAccessProof: null,
              },
            ],
          },
        },
        {
          provide: MatDialogRef,
          useValue: { close },
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionQuizPickerDialogComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('.session-quiz-picker__item') as HTMLButtonElement).click();

    expect(close).toHaveBeenCalledWith({ quizId: DEMO_QUIZ_ID, adoptQuizTeams: false });
  });

  it('shows the blocker state when no quizzes are available', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [SessionQuizPickerDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            sessionProfile: null,
            quizzes: [],
          },
        },
        {
          provide: MatDialogRef,
          useValue: { close },
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionQuizPickerDialogComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.session-quiz-picker__empty-state')).toBeTruthy();
    expect(host.textContent).toContain('In deiner Sammlung ist noch kein Quiz.');
  });
});
