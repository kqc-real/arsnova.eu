import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, type Signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { textAnalysisCopy as copy } from './text-analysis-copy';

interface TextAnalysisHelpContext {
  description: string;
  details: readonly string[];
}

@Component({
  selector: 'app-text-analysis-help-dialog',
  imports: [
    NgTemplateOutlet,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
  ],
  styleUrls: ['../styles/dialog-title-header.scss'],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon" aria-hidden="true"><mat-icon>info</mat-icon></span>
      <span class="dialog-title-header__copy">
        <span class="dialog-title-header__heading">{{
          context() ? copy.infoButton : copy.helpTitle
        }}</span>
      </span>
    </h2>
    <mat-dialog-content>
      @if (context(); as current) {
        <p>{{ current.description }}</p>
        @if (current.details.length) {
          <ul>
            @for (detail of current.details; track $index) {
              <li>{{ detail }}</li>
            }
          </ul>
        }
        <details>
          <summary>{{ copy.helpTitle }}</summary>
          <ng-container *ngTemplateOutlet="overview" />
        </details>
      } @else {
        <ng-container *ngTemplateOutlet="overview" />
      }
      <ng-template #overview>
        <p>{{ copy.helpIntro }}</p>
        <dl>
          @for (path of paths; track path.title) {
            <dt>{{ path.title }}</dt>
            @for (description of path.descriptions; track $index) {
              <dd>{{ description }}</dd>
            }
          }
        </dl>
        <h3>{{ copy.statusHeading }}</h3>
        <dl>
          @for (state of statusLegend; track state.label) {
            <dt>{{ state.label }}</dt>
            <dd>{{ state.description }}</dd>
          }
        </dl>
      </ng-template>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">{{ copy.close }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    p,
    dd,
    li {
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    dt {
      font-weight: 600;
      margin-block-start: 0.75rem;
    }
    dd {
      margin-inline-start: 0;
      margin-block-start: 0.25rem;
    }
    summary {
      cursor: pointer;
      min-block-size: 2.75rem;
      align-content: center;
    }
  `,
})
export class TextAnalysisHelpDialogComponent {
  protected readonly context =
    inject<Signal<TextAnalysisHelpContext | null> | null>(MAT_DIALOG_DATA) ?? (() => null);
  protected readonly copy = copy;
  protected readonly paths = [
    { title: copy.lexicon, descriptions: [copy.lexiconInfo, 'spaCy · ' + copy.spacy] },
    { title: copy.topics, descriptions: [copy.topicPath, 'E5 · ' + copy.e5] },
    {
      title: copy.classification,
      descriptions: [
        copy.classificationInfo,
        'Naive Bayes · ' + copy.naiveBayes,
        copy.neighborsInfo,
        'k-NN · ' + copy.neighbors,
      ],
    },
    { title: copy.rules, descriptions: [copy.rulesInfo, copy.summaryPath] },
    {
      title: copy.objectivesAction,
      descriptions: [copy.objectivesInfo, 'Qwen3-4B · ' + copy.qwen],
    },
  ];

  protected readonly statusLegend = [
    { label: copy.statusEnabled, description: copy.statusEnabledInfo },
    { label: copy.statusReachable, description: copy.statusReachableInfo },
    { label: copy.statusBusy, description: copy.statusBusyInfo },
    { label: copy.statusUnknown, description: copy.statusUnknownInfo },
    { label: copy.statusUsed, description: copy.statusUsedInfo },
  ];

  static open(
    dialog: MatDialog,
    context: Signal<TextAnalysisHelpContext | null> | null = null,
  ): void {
    dialog.open(TextAnalysisHelpDialogComponent, {
      data: context,
      ariaLabel: context ? copy.infoButton : copy.helpTitle,
      width: '36rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-heading',
      restoreFocus: true,
    });
  }
}
