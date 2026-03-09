import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizListComponent } from './quiz-list.component';
import { QuizStoreService, type QuizSummary } from '../data/quiz-store.service';

const { getActiveQuizIdsQueryMock } = vi.hoisted(() => ({
  getActiveQuizIdsQueryMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', () => ({
  trpc: {
    session: {
      getActiveQuizIds: {
        query: getActiveQuizIdsQueryMock,
      },
    },
  },
}));

describe('QuizListComponent', () => {
  const quizzesSignal = signal<QuizSummary[]>([]);
  const mockStore = {
    quizzes: quizzesSignal.asReadonly(),
    duplicateQuiz: vi.fn(),
    deleteQuiz: vi.fn(),
    exportQuiz: vi.fn(),
    importQuiz: vi.fn(),
  };

  beforeEach(() => {
    quizzesSignal.set([]);
    getActiveQuizIdsQueryMock.mockResolvedValue([]);
    TestBed.configureTestingModule({
      imports: [QuizListComponent],
      providers: [
        provideRouter([]),
        { provide: QuizStoreService, useValue: mockStore },
      ],
    });
  });

  it('zeigt den Empty-State ohne Quizzes', () => {
    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Deine Quiz-Bibliothek ist noch leer.');
    expect(fixture.nativeElement.textContent).toContain('Erstes Quiz erstellen');
  });

  it('zeigt gespeicherte Quizzes in der Liste', () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: 'SQL Grundlagen',
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
      },
    ]);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Datenbanken');
    expect(text).toContain('SQL Grundlagen');
    const link = fixture.nativeElement.querySelector('.quiz-list-item__link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('aria-label')).toContain('Datenbanken');
  });

  it('markiert Quizzes mit aktiver Session als live', async () => {
    quizzesSignal.set([
      {
        id: 'e31fef3f-f7b1-4705-a739-28c8ec4486bf',
        name: 'Datenbanken',
        description: null,
        createdAt: '2026-03-08T10:00:00.000Z',
        updatedAt: '2026-03-08T11:30:00.000Z',
        questionCount: 2,
      },
    ]);
    getActiveQuizIdsQueryMock.mockResolvedValue(['e31fef3f-f7b1-4705-a739-28c8ec4486bf']);

    const fixture = TestBed.createComponent(QuizListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.isQuizLive('e31fef3f-f7b1-4705-a739-28c8ec4486bf')).toBe(true);
  });
});
