import { DatePipe } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { QuizStoreService } from '../data/quiz-store.service';
import { trpc } from '../../../core/trpc.client';

/**
 * Quiz-Liste (Epic 1).
 * Story 1.1 (Quiz erstellen), 1.8 (Export), 1.9 (Import), 1.10 (Bearbeiten, Löschen).
 */
@Component({
  selector: 'app-quiz-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatButton,
    MatIconButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
  ],
  templateUrl: './quiz-list.component.html',
  styleUrl: './quiz-list.component.scss',
})
export class QuizListComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly quizStore = inject(QuizStoreService);
  readonly quizzes = this.quizStore.quizzes;
  readonly actionInfo = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly activeLiveQuizIds = signal<Set<string>>(new Set());
  readonly showAiImport = signal(false);
  readonly aiJsonInput = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const activeQuizIds = await trpc.session.getActiveQuizIds.query();
      this.activeLiveQuizIds.set(new Set(activeQuizIds));
    } catch {
      this.activeLiveQuizIds.set(new Set());
    }
  }

  toggleAiImport(): void {
    this.showAiImport.update((visible) => !visible);
    this.actionError.set(null);
    this.actionInfo.set(null);
  }

  updateAiJsonInput(value: string): void {
    this.aiJsonInput.set(value);
  }

  duplicateQuiz(quizId: string): void {
    this.actionError.set(null);
    try {
      const duplicate = this.quizStore.duplicateQuiz(quizId);
      this.actionInfo.set(`„${duplicate.name}“ wurde dupliziert.`);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Duplizieren fehlgeschlagen.');
    }
  }

  deleteQuiz(quizId: string, quizName: string): void {
    this.actionError.set(null);
    if (this.isQuizLive(quizId)) {
      this.actionInfo.set(`„${quizName}“ ist gerade live und kann nicht gelöscht werden.`);
      return;
    }
    const confirmed = globalThis.confirm(
      `„${quizName}“ wirklich löschen? Das lässt sich nicht rückgängig machen.`,
    );
    if (!confirmed) return;

    try {
      this.quizStore.deleteQuiz(quizId);
      this.actionInfo.set(`„${quizName}“ wurde gelöscht.`);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.');
    }
  }

  exportQuiz(quizId: string): void {
    this.actionError.set(null);
    try {
      const quiz = this.quizStore.exportQuiz(quizId);
      const filename = this.buildExportFilename(quiz.quiz.name);
      const payload = JSON.stringify(quiz, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      this.actionInfo.set(`„${quiz.quiz.name}“ wurde exportiert.`);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Export fehlgeschlagen.');
    }
  }

  async onImportFileSelected(event: Event): Promise<void> {
    this.actionError.set(null);
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const imported = this.quizStore.importQuiz(parsed);
      this.actionInfo.set(`„${imported.name}“ wurde importiert.`);
      target.value = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import fehlgeschlagen.';
      this.actionError.set(message);
      target.value = '';
    }
  }

  importAiJson(): void {
    this.actionError.set(null);
    this.actionInfo.set(null);

    const raw = this.aiJsonInput().trim();
    if (!raw) {
      this.actionError.set('Füge zuerst das KI-JSON ein.');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const imported = this.quizStore.importQuiz(parsed);
      this.actionInfo.set(`KI-„${imported.name}“ wurde importiert.`);
      this.aiJsonInput.set('');
      this.showAiImport.set(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KI-Import fehlgeschlagen.';
      this.actionError.set(message);
    }
  }

  isQuizLive(quizId: string): boolean {
    return this.activeLiveQuizIds().has(quizId);
  }

  private buildExportFilename(quizName: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const safeName = quizName
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'quiz';
    return `${safeName}_${date}.json`;
  }
}
