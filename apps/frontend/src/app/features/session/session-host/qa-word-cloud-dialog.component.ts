import { computed, Component, inject, signal, ViewChild } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import type {
  QaQuestionSortMode,
  WordCloudAnalysisEntryDTO,
  WordCloudAnalysisVariant,
} from '@arsnova/shared-types';
import { WordCloudComponent } from '../session-present/word-cloud.component';
import type { WordCloudTerm } from '../session-present/word-cloud-term.service';
import {
  wordCloudExportViewLabel,
  wordCloudTopicProgressLabel,
  type WeightedWordSource,
} from '../session-present/word-cloud.util';

export type QaWordCloudSmoothingStatus = 'idle' | 'pending' | 'active' | 'stale';

export type QaWordCloudDialogResult = readonly string[] | { readonly action: 'return-to-compass' };

export type QaWordCloudDialogData = {
  projected: () => boolean;
  ownsProjection: () => boolean;
  setProjected: (projected: boolean) => Promise<void>;
  responses: () => string[];
  responseTextsBySourceId: () => Readonly<Record<string, string>>;
  weightedResponses: () => WeightedWordSource[];
  terms: () => WordCloudTerm[] | null;
  analysisEntries: () => WordCloudAnalysisEntryDTO[] | null;
  title: () => string;
  eyebrow: string | null;
  description: () => string | null;
  wordLabelSingular: () => string;
  wordLabelPlural: () => string;
  weightingHint: () => string | null;
  tooltipMetricLabel: () => string | null;
  analyzedQuestionCount: () => number;
  eligibleQuestionCount: () => number;
  analysisModelVersion?: () => string | null;
  labelModelId?: () => string | null;
  labelModelVersion?: () => string | null;
  analysisVariant: () => WordCloudAnalysisVariant;
  displayMode?: () => WordCloudAnalysisVariant;
  analysisLanguage?: () => string;
  languageLocked?: () => boolean;
  setAnalysisLanguage?: (locale: string) => void | Promise<void>;
  showThemeRefresh?: () => boolean;
  setAnalysisVariant: (variant: WordCloudAnalysisVariant) => void | Promise<void>;
  themeModeAvailable: () => boolean;
  themeFallbackHint: () => string | null;
  themeWaitHint?: () => string | null;
  hasPreparedThemes?: () => boolean;
  sortMode: () => QaQuestionSortMode;
  setSortMode: (mode: QaQuestionSortMode) => void | Promise<void>;
  frozen: () => boolean;
  freezeLabel: () => string;
  toggleFreeze: () => void | Promise<void>;
  smoothingStatus: () => QaWordCloudSmoothingStatus;
  smoothingLabel: () => string;
  smoothingHint: () => string | null;
  smoothingDisabled: () => boolean;
  toggleSmoothing: () => void | Promise<void>;
  itemLabelSingular: string;
  itemLabelPlural: string;
  focusedTermLabel?: () => string | null;
  returnToCompassVisible?: () => boolean;
};

@Component({
  selector: 'app-qa-word-cloud-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatProgressBar,
    WordCloudComponent,
  ],
  templateUrl: './qa-word-cloud-dialog.component.html',
  styleUrl: './qa-word-cloud-dialog.component.scss',
  host: { '(keydown.escape)': 'close($event)' },
})
export class QaWordCloudDialogComponent {
  readonly data = inject<QaWordCloudDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<QaWordCloudDialogComponent, QaWordCloudDialogResult>,
  );
  readonly projected = computed(() => this.data.projected());
  readonly ownsProjection = computed(() => this.data.ownsProjection());
  readonly projectionPending = signal(false);
  readonly projectionError = signal('');
  @ViewChild(WordCloudComponent) private wordCloud?: WordCloudComponent;

  readonly responses = computed(() => this.data.responses());
  readonly responseTextsBySourceId = computed(() => this.data.responseTextsBySourceId());
  readonly weightedResponses = computed(() => this.data.weightedResponses());
  readonly terms = computed(() => this.data.terms());
  readonly analysisEntries = computed(() => this.data.analysisEntries());
  readonly title = computed(() => this.data.title());
  readonly description = computed(() => this.data.description());
  readonly wordLabelSingular = computed(() => this.data.wordLabelSingular());
  readonly wordLabelPlural = computed(() => this.data.wordLabelPlural());
  readonly tooltipMetricLabel = computed(() => this.data.tooltipMetricLabel());
  readonly analyzedQuestionCount = computed(() => this.data.analyzedQuestionCount());
  readonly analysisModelVersion = computed(() => this.data.analysisModelVersion?.() ?? null);
  readonly labelModelId = computed(() => this.data.labelModelId?.() ?? null);
  readonly labelModelVersion = computed(() => this.data.labelModelVersion?.() ?? null);
  readonly displayMode = computed(() => this.data.displayMode?.() ?? 'LEXICAL');
  readonly eligibleQuestionCount = computed(() => this.data.eligibleQuestionCount());
  readonly analysisVariant = computed(() => this.data.analysisVariant());
  readonly themeModeAvailable = computed(() => this.data.themeModeAvailable());
  readonly themeFallbackHint = computed(() => this.data.themeFallbackHint());
  readonly themeWaitHint = computed(() => this.data.themeWaitHint?.() ?? null);
  readonly themeProgressAria = computed(() => {
    const wait = this.themeWaitHint();
    const base = this.themeFallbackHint() ?? this.themeProgressLabel;
    return wait ? `${base} ${wait}` : base;
  });
  readonly sortMode = computed(() => this.data.sortMode());
  readonly frozen = computed(() => this.data.frozen());
  readonly freezeLabel = computed(() => this.data.freezeLabel());
  readonly smoothingStatus = computed(() => this.data.smoothingStatus());
  readonly smoothingLabel = computed(() => this.data.smoothingLabel());
  readonly smoothingHint = computed(() => this.data.smoothingHint());
  readonly smoothingDisabled = computed(() => this.data.smoothingDisabled());
  readonly smoothingBusy = computed(() => this.smoothingStatus() === 'pending');
  readonly smoothingPressed = computed(() => {
    const status = this.smoothingStatus();
    return status === 'active' || status === 'stale';
  });
  readonly smoothingIcon = computed(() => {
    switch (this.smoothingStatus()) {
      case 'pending':
        return 'hourglass_top';
      case 'active':
        return 'check';
      case 'stale':
        return 'refresh';
      default:
        return 'wand_stars';
    }
  });
  readonly focusedTermLabel = computed(() => this.data.focusedTermLabel?.() ?? null);
  readonly returnToCompassVisible = computed(() => this.data.returnToCompassVisible?.() ?? false);
  readonly showSmoothingControls = computed(
    () => this.analysisVariant() === 'LEXICAL' || this.analysisVariant() === 'THEME',
  );
  readonly showThemeRefresh = computed(
    () =>
      this.analysisVariant() === 'SEMANTIC' &&
      (this.smoothingBusy() ||
        (this.data.showThemeRefresh?.() ?? this.smoothingStatus() === 'stale')),
  );
  readonly hasPreparedThemes = computed(
    () => this.data.hasPreparedThemes?.() ?? (this.analysisEntries()?.length ?? 0) > 0,
  );
  readonly themesPending = computed(
    () =>
      this.analysisVariant() === 'SEMANTIC' &&
      this.smoothingStatus() === 'pending' &&
      !this.hasPreparedThemes(),
  );
  readonly themesRefreshing = computed(
    () =>
      this.analysisVariant() === 'SEMANTIC' &&
      this.smoothingStatus() === 'pending' &&
      this.hasPreparedThemes(),
  );
  readonly themeProgressLabel = $localize`:@@sessionQa.wordCloudSemanticPendingLabel:Themen werden vorbereitet.`;
  readonly previousTopicsLabel = wordCloudTopicProgressLabel(true);
  readonly exportViewLabel = computed(() =>
    wordCloudExportViewLabel(this.analysisVariant(), this.displayMode()),
  );
  readonly themeRefreshLabel = $localize`:@@sessionQa.wordCloudRefreshThemes:Themen aktualisieren`;

  async toggleProjection(): Promise<void> {
    if (this.projectionPending()) return;
    await this.changeProjection(!this.projected());
  }

  async close(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.projectionPending()) return;
    if (this.projected() && this.ownsProjection()) {
      if (!(await this.changeProjection(false))) return;
    }
    this.dialogRef.close();
  }

  async returnToCompass(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.projectionPending() || !this.returnToCompassVisible()) return;
    if (this.projected() && this.ownsProjection()) {
      if (!(await this.changeProjection(false))) return;
    }
    this.dialogRef.close({ action: 'return-to-compass' });
  }

  private async changeProjection(projected: boolean): Promise<boolean> {
    this.projectionPending.set(true);
    this.projectionError.set('');
    try {
      await this.data.setProjected(projected);
      return true;
    } catch {
      this.projectionError.set(
        $localize`:@@sessionQa.wordCloudProjectionFailed:Die Präsentation konnte nicht geändert werden. Versuche es erneut.`,
      );
      return false;
    } finally {
      this.projectionPending.set(false);
    }
  }

  selectedSourceIds(): readonly string[] {
    return this.wordCloud?.selectedSourceIds() ?? [];
  }

  onSizeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    if (value === 'TOP' || value === 'BEST' || value === 'CONTROVERSIAL' || value === 'TIME') {
      this.setSortMode(value);
    }
  }

  setSortMode(mode: QaQuestionSortMode): void {
    if (this.projectionPending() || this.frozen() || mode === this.sortMode()) {
      return;
    }

    void this.data.setSortMode(mode);
  }

  setAnalysisVariant(variant: WordCloudAnalysisVariant): void {
    if (this.projectionPending() || this.frozen() || variant === this.analysisVariant()) {
      return;
    }

    void this.data.setAnalysisVariant(variant);
  }

  toggleFreeze(): void {
    if (this.projectionPending()) return;
    void this.data.toggleFreeze();
  }

  toggleSmoothing(): void {
    if (this.projectionPending() || this.frozen() || this.smoothingDisabled()) {
      return;
    }

    void this.data.toggleSmoothing();
  }
}
