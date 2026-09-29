import { firstValueFrom } from 'rxjs';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatListOption, MatSelectionList, MatSelectionListChange } from '@angular/material/list';
import type { QaQuestionDTO, QaRedactionRange } from '@arsnova/shared-types';
import {
  QA_REDACTION_MAX_RANGE_CODE_POINTS,
  QA_REDACTION_MAX_RANGES,
  QA_REDACTION_PLACEHOLDER,
  findQaRedactionSearchOccurrences,
  previewQaPassageRedaction,
  qaTextCodePoints,
} from '@arsnova/shared-types';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';

export type QaRedactPassagesApplyOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: 'conflict';
      question: Pick<QaQuestionDTO, 'id' | 'text' | 'updatedAt' | 'passagesRedacted'>;
    }
  | { ok: false; reason: 'error' };

export interface QaRedactPassagesDialogData {
  question: Pick<QaQuestionDTO, 'id' | 'text' | 'updatedAt' | 'passagesRedacted'>;
  /** Speichert die Schwärzung; Dialog bleibt bis zum Ergebnis offen. Text = angezeigter Dialogtext. */
  applyRedaction: (
    ranges: QaRedactionRange[],
    sourceText: string,
  ) => Promise<QaRedactPassagesApplyOutcome>;
}

export interface QaRedactPassagesDialogResult {
  applied: true;
}

type PendingRange = QaRedactionRange & { id: string; excerpt: string };

@Component({
  selector: 'app-qa-redact-passages-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatListOption,
    MatSelectionList,
  ],
  templateUrl: './qa-redact-passages-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './qa-redact-passages-dialog.component.scss',
  ],
})
export class QaRedactPassagesDialogComponent {
  readonly data = inject<QaRedactPassagesDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<QaRedactPassagesDialogComponent, QaRedactPassagesDialogResult | null>,
  );

  private readonly sourceTextArea = viewChild<HTMLTextAreaElement>('sourceTextArea');

  readonly placeholder = QA_REDACTION_PLACEHOLDER;
  readonly maxRanges = QA_REDACTION_MAX_RANGES;
  readonly maxRangeLength = QA_REDACTION_MAX_RANGE_CODE_POINTS;

  readonly sourceText = signal(this.data.question.text);
  readonly pendingRanges = signal<PendingRange[]>([]);
  readonly searchNeedle = signal('');
  readonly searchOccurrences = signal<QaRedactionRange[]>([]);
  readonly selectedOccurrenceIndexes = signal<number[]>([]);
  readonly statusMessage = signal<string | null>(null);
  readonly statusTone = signal<'info' | 'error'>('info');
  readonly applying = signal(false);

  private nextRangeId = 1;
  private sourceSelectionStart = 0;
  private sourceSelectionEnd = 0;

  readonly previewText = computed(() => {
    const ranges = this.pendingRanges();
    if (ranges.length === 0) {
      return this.sourceText();
    }
    return previewQaPassageRedaction(this.sourceText(), ranges) ?? this.sourceText();
  });

  readonly canAddMore = computed(() => this.pendingRanges().length < this.maxRanges);

  captureSourceSelection(event: Event): void {
    const area = event.target as HTMLTextAreaElement | null;
    if (!area) {
      return;
    }
    this.sourceSelectionStart = area.selectionStart ?? 0;
    this.sourceSelectionEnd = area.selectionEnd ?? 0;
  }

  markCurrentSelection(): void {
    const area = this.sourceTextArea();
    const liveStart = area?.selectionStart ?? 0;
    const liveEnd = area?.selectionEnd ?? 0;
    const startUnit = liveEnd > liveStart ? liveStart : this.sourceSelectionStart;
    const endUnit = liveEnd > liveStart ? liveEnd : this.sourceSelectionEnd;
    if (endUnit <= startUnit) {
      this.announce(
        $localize`:@@sessionQa.redactSelectHint:Markiere zuerst eine Passage im Klartext.`,
        'error',
      );
      return;
    }
    const range = this.utf16OffsetsToCodePointRange(this.sourceText(), startUnit, endUnit);
    this.tryAddRange(range);
  }

  runSearch(): void {
    const needle = this.searchNeedle().trim();
    if (!needle) {
      this.searchOccurrences.set([]);
      this.selectedOccurrenceIndexes.set([]);
      this.announce(
        $localize`:@@sessionQa.redactSearchEmpty:Gib einen Text ein, der bereits in der Frage steht.`,
        'error',
      );
      return;
    }
    if (qaTextCodePoints(needle).length > this.maxRangeLength) {
      this.announce(
        $localize`:@@sessionQa.redactSearchTooLong:Die gesuchte Passage ist zu lang.`,
        'error',
      );
      return;
    }
    const occurrences = findQaRedactionSearchOccurrences(this.sourceText(), needle);
    this.searchOccurrences.set(occurrences);
    this.selectedOccurrenceIndexes.set(occurrences.length === 1 ? [0] : []);
    if (occurrences.length === 0) {
      this.announce(
        $localize`:@@sessionQa.redactSearchNoMatch:Keine passende Stelle gefunden.`,
        'error',
      );
      return;
    }
    this.announce(
      occurrences.length === 1
        ? $localize`:@@sessionQa.redactSearchOneMatch:Eine Fundstelle gefunden.`
        : $localize`:@@sessionQa.redactSearchManyMatches:${occurrences.length}:count: Fundstellen – wähle die gewünschte aus.`,
      'info',
    );
  }

  addSelectedOccurrences(): void {
    const occurrences = this.searchOccurrences();
    const indexes = occurrences.length === 1 ? [0] : this.selectedOccurrenceIndexes();
    if (indexes.length === 0) {
      this.announce(
        $localize`:@@sessionQa.redactSearchPick:Wähle mindestens eine Fundstelle aus.`,
        'error',
      );
      return;
    }
    let added = 0;
    for (const index of indexes) {
      const range = occurrences[index];
      if (!range) continue;
      if (this.tryAddRange(range, { silent: true })) {
        added += 1;
      }
    }
    if (added === 0) {
      this.announce(
        $localize`:@@sessionQa.redactAddFailed:Die Fundstelle konnte nicht hinzugefügt werden.`,
        'error',
      );
      return;
    }
    this.announce(
      $localize`:@@sessionQa.redactAdded:${added}:count: Passage(n) zur Vorschau hinzugefügt.`,
      'info',
    );
  }

  onOccurrenceSelectionChange(event: MatSelectionListChange): void {
    this.selectedOccurrenceIndexes.set(
      event.source.selectedOptions.selected.map((option) => option.value as number),
    );
  }

  removeRange(id: string): void {
    this.pendingRanges.update((ranges) => ranges.filter((range) => range.id !== id));
    this.announce(
      $localize`:@@sessionQa.redactRangeRemoved:Markierung aus der Vorschau entfernt.`,
      'info',
    );
  }

  removeRangeAria(excerpt: string): string {
    return $localize`:@@sessionQa.redactRemoveAria:Markierung entfernen: ${excerpt}:excerpt:`;
  }

  async confirmApply(): Promise<void> {
    if (this.applying()) {
      return;
    }
    const ranges = this.pendingRanges().map(({ start, end }) => ({ start, end }));
    if (ranges.length === 0) {
      this.announce(
        $localize`:@@sessionQa.redactNeedRanges:Füge mindestens eine Passage hinzu.`,
        'error',
      );
      return;
    }
    if (!previewQaPassageRedaction(this.sourceText(), ranges)) {
      this.announce(
        $localize`:@@sessionQa.redactInvalidPreview:Die Auswahl ist ungültig. Prüfe Überlappungen und Platzhalter.`,
        'error',
      );
      return;
    }

    const confirmRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      width: 'min(28rem, calc(100vw - 2rem))',
      autoFocus: 'dialog',
      data: {
        title: $localize`:@@sessionQa.redactConfirmTitle:Schwärzungen endgültig anwenden?`,
        message: $localize`:@@sessionQa.redactConfirmMessage:Die ausgewählten Passagen werden dauerhaft unkenntlich gemacht. Eine Wiederherstellung ist nicht möglich.`,
        consequences: [
          $localize`:@@sessionQa.redactConfirmConsequence1:Der Originalwortlaut dieser Stellen wird überschrieben.`,
          $localize`:@@sessionQa.redactConfirmConsequence2:Bereits gesehene Inhalte, Screenshots und externe Exporte bleiben unverändert.`,
        ],
        confirmLabel: $localize`:@@sessionQa.redactConfirmApply:Schwärzungen endgültig anwenden`,
        cancelLabel: $localize`:@@sessionQa.redactConfirmCancel:Zurück zur Auswahl`,
      } satisfies ConfirmLeaveDialogData,
    });
    const confirmed = await firstValueFrom(confirmRef.afterClosed());
    if (confirmed !== true) {
      return;
    }

    this.applying.set(true);
    this.dialogRef.disableClose = true;
    this.announce($localize`:@@sessionQa.redactPending:Schwärzung wird gespeichert…`, 'info');
    try {
      const outcome = await this.data.applyRedaction(ranges, this.sourceText());
      if (outcome.ok) {
        this.dialogRef.close({ applied: true });
        return;
      }
      if (outcome.reason === 'conflict') {
        this.sourceText.set(outcome.question.text);
        this.pendingRanges.set([]);
        this.searchOccurrences.set([]);
        this.selectedOccurrenceIndexes.set([]);
        this.announce(
          $localize`:@@sessionQa.redactConflictReload:Die Frage wurde inzwischen geändert. Lade den aktuellen Text – bitte Passagen neu markieren.`,
          'error',
        );
        return;
      }
      this.announce(
        $localize`:@@sessionQa.redactFailedKeepSelection:Die Schwärzung konnte nicht gespeichert werden. Deine Auswahl bleibt erhalten – bitte erneut versuchen.`,
        'error',
      );
    } finally {
      this.applying.set(false);
      this.dialogRef.disableClose = false;
    }
  }

  private tryAddRange(range: QaRedactionRange, options?: { silent?: boolean }): boolean {
    if (!this.canAddMore()) {
      if (!options?.silent) {
        this.announce(
          $localize`:@@sessionQa.redactTooMany:Du kannst höchstens ${this.maxRanges}:max: Passagen auf einmal schwärzen.`,
          'error',
        );
      }
      return false;
    }
    const length = range.end - range.start;
    if (length < 1 || length > this.maxRangeLength) {
      if (!options?.silent) {
        this.announce(
          $localize`:@@sessionQa.redactRangeLength:Die Passage muss zwischen 1 und ${this.maxRangeLength}:max: Zeichen liegen.`,
          'error',
        );
      }
      return false;
    }
    const nextRanges = [...this.pendingRanges(), range];
    if (!previewQaPassageRedaction(this.sourceText(), nextRanges)) {
      if (!options?.silent) {
        this.announce(
          $localize`:@@sessionQa.redactRangeConflict:Diese Passage überlappt eine andere Markierung oder einen Platzhalter.`,
          'error',
        );
      }
      return false;
    }
    const excerpt = qaTextCodePoints(this.sourceText()).slice(range.start, range.end).join('');
    this.pendingRanges.update((ranges) => [
      ...ranges,
      {
        id: `range-${this.nextRangeId++}`,
        start: range.start,
        end: range.end,
        excerpt,
      },
    ]);
    if (!options?.silent) {
      this.announce(
        $localize`:@@sessionQa.redactRangeAdded:Markierung zur Vorschau hinzugefügt.`,
        'info',
      );
    }
    return true;
  }

  private utf16OffsetsToCodePointRange(
    text: string,
    startUnit: number,
    endUnit: number,
  ): QaRedactionRange {
    const before = text.slice(0, startUnit);
    const selected = text.slice(startUnit, endUnit);
    const start = qaTextCodePoints(before).length;
    const end = start + qaTextCodePoints(selected).length;
    return { start, end };
  }

  private announce(message: string, tone: 'info' | 'error'): void {
    this.statusTone.set(tone);
    this.statusMessage.set(message);
  }
}
