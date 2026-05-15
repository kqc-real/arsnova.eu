import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { WordCloudAnalysisEntryDTO } from '@arsnova/shared-types';
import { WordCloudComponent } from './word-cloud.component';
import type { WordCloudTerm } from './word-cloud-term.service';
import type { WeightedWordSource, WordCloudAnalysisMode } from './word-cloud.util';

export type WordCloudDialogData = {
  responses: string[];
  weightedResponses: WeightedWordSource[] | null;
  terms: WordCloudTerm[] | null;
  analysisEntries: WordCloudAnalysisEntryDTO[] | null;
  analysisMode: WordCloudAnalysisMode;
  disableCloudLayout: boolean;
  title: string;
  eyebrow: string | null;
  description: string | null;
  emptyMessage: string;
  itemLabelSingular: string;
  itemLabelPlural: string;
  wordLabelSingular: string;
  wordLabelPlural: string;
  showResponsesSingularLabel: string;
  showResponsesPluralLabel: string;
  showResponsesPanel: boolean;
  weightingHint: string | null;
  tooltipMetricLabel: string | null;
};

@Component({
  selector: 'app-word-cloud-dialog',
  standalone: true,
  imports: [MatIconButton, MatDialogClose, MatIcon, WordCloudComponent],
  templateUrl: './word-cloud-dialog.component.html',
  styleUrl: './word-cloud-dialog.component.scss',
})
export class WordCloudDialogComponent {
  readonly data = inject<WordCloudDialogData>(MAT_DIALOG_DATA);
}
