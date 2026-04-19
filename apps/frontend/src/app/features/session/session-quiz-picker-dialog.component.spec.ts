import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
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
              nicknameTheme: 'KINDERGARTEN',
              allowCustomNicknames: false,
              anonymousMode: false,
              teamMode: false,
              teamCount: null,
              teamAssignment: 'AUTO',
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
    expect(host.textContent).toContain(
      'Wähle ein Quiz, das zum aktuellen Onboarding-Profil deiner Teilnehmenden passt:',
    );
    expect(host.textContent).toContain('Aktuelles Onboarding-Profil der Teilnehmenden');
    expect(host.textContent).toContain('Feste Tier-Emojis als Pseudonyme.');
    expect(host.textContent).toContain('Teams sind nicht möglich.');
  });

  it('sorts quizzes by updatedAt descending and closes with the selected id', () => {
    const { fixture, close } = setup();
    const host = fixture.nativeElement as HTMLElement;
    const items = Array.from(host.querySelectorAll('.session-quiz-picker__item-name')).map((node) =>
      node.textContent?.trim(),
    );

    expect(items).toEqual(['Neues Quiz', 'Altes Quiz']);

    (host.querySelectorAll('.session-quiz-picker__item')[0] as HTMLButtonElement).click();

    expect(close).toHaveBeenCalledWith('newer');
  });

  it('shows the blocker state when no compatible quizzes are available', () => {
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
    expect(host.textContent).toContain(
      'Zum aktuellen Onboarding-Profil deiner Teilnehmenden passt aktuell kein Quiz aus deiner Sammlung.',
    );
  });
});
