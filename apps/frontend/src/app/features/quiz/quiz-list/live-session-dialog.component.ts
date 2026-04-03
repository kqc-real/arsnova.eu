import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { tryRequestDocumentFullscreen } from '../../../core/document-fullscreen.util';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

export interface LiveSessionDialogData {
  quizName: string;
  quizCanStart: boolean;
}

export interface LiveSessionDialogResult {
  startChannel: 'quiz' | 'qa' | 'quickFeedback';
  enableQuiz: boolean;
  enableQa: boolean;
  enableQuickFeedback: boolean;
  title?: string;
}

@Component({
  selector: 'app-live-session-dialog',
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIcon],
  styleUrls: ['../../../shared/styles/dialog-title-header.scss'],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon" aria-hidden="true">
        <mat-icon>play_circle</mat-icon>
      </span>
      <span class="dialog-title-header__copy">
        <span class="dialog-title-header__heading" i18n="@@quizList.liveDialog.title"
          >Live vorbereiten</span
        >
        <span
          class="dialog-title-header__sub live-session-dialog__subtitle"
          i18n="@@quizList.liveDialog.subtitle"
        >
          Auftakt und Formate festlegen (Quiz, Q&amp;A, Blitzlicht)
        </span>
      </span>
    </h2>

    <mat-dialog-content>
      <div class="live-session-dialog__content">
        <div
          class="live-session-dialog__channel-grid"
          role="group"
          [attr.aria-label]="channelGroupAriaLabel()"
        >
          <button
            type="button"
            class="live-session-dialog__channel-card"
            [class.live-session-dialog__channel-card--selected]="enableQuiz()"
            [disabled]="!data.quizCanStart"
            [attr.aria-pressed]="enableQuiz()"
            (click)="handleChannelCardClick('quiz')"
          >
            <mat-icon class="live-session-dialog__channel-icon" aria-hidden="true">quiz</mat-icon>
            <span class="live-session-dialog__channel-copy">
              <span
                class="live-session-dialog__channel-label"
                i18n="@@quizList.liveDialog.channelQuiz"
                >Quiz</span
              >
              <span
                class="live-session-dialog__channel-hint"
                i18n="@@quizList.liveDialog.channelQuizHint"
              >
                Startet mit „{{ data.quizName }}“.
              </span>
            </span>
            @if (channelStateLabel('quiz'); as stateLabel) {
              <span class="live-session-dialog__channel-state">{{ stateLabel }}</span>
            }
            <span
              class="live-session-dialog__channel-toggle"
              [class.live-session-dialog__channel-toggle--selected]="enableQuiz()"
              aria-hidden="true"
            >
              <span class="live-session-dialog__channel-toggle-thumb"></span>
            </span>
          </button>

          <button
            type="button"
            class="live-session-dialog__channel-card"
            [class.live-session-dialog__channel-card--selected]="enableQa()"
            [attr.aria-pressed]="enableQa()"
            (click)="handleChannelCardClick('qa')"
          >
            <mat-icon class="live-session-dialog__channel-icon" aria-hidden="true">forum</mat-icon>
            <span class="live-session-dialog__channel-copy">
              <span
                class="live-session-dialog__channel-label"
                i18n="@@quizList.liveDialog.channelQa"
                >Q&amp;A</span
              >
              <span
                class="live-session-dialog__channel-hint"
                i18n="@@quizList.liveDialog.channelQaHint"
              >
                Fragen aus dem Raum
              </span>
            </span>
            @if (channelStateLabel('qa'); as stateLabel) {
              <span class="live-session-dialog__channel-state">{{ stateLabel }}</span>
            }
            <span
              class="live-session-dialog__channel-toggle"
              [class.live-session-dialog__channel-toggle--selected]="enableQa()"
              aria-hidden="true"
            >
              <span class="live-session-dialog__channel-toggle-thumb"></span>
            </span>
          </button>

          <button
            type="button"
            class="live-session-dialog__channel-card"
            [class.live-session-dialog__channel-card--selected]="enableQuickFeedback()"
            [attr.aria-pressed]="enableQuickFeedback()"
            (click)="handleChannelCardClick('quickFeedback')"
          >
            <mat-icon class="live-session-dialog__channel-icon" aria-hidden="true">bolt</mat-icon>
            <span class="live-session-dialog__channel-copy">
              <span
                class="live-session-dialog__channel-label"
                i18n="@@quizList.liveDialog.channelQuickFeedback"
                >Blitzlicht</span
              >
              <span
                class="live-session-dialog__channel-hint"
                i18n="@@quizList.liveDialog.channelQuickFeedbackHint"
              >
                Kurze Stimmungsbilder
              </span>
            </span>
            @if (channelStateLabel('quickFeedback'); as stateLabel) {
              <span class="live-session-dialog__channel-state">{{ stateLabel }}</span>
            }
            <span
              class="live-session-dialog__channel-toggle"
              [class.live-session-dialog__channel-toggle--selected]="enableQuickFeedback()"
              aria-hidden="true"
            >
              <span class="live-session-dialog__channel-toggle-thumb"></span>
            </span>
          </button>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" i18n="@@quizList.liveDialog.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="!canStart()"
        (click)="start()"
      >
        <span i18n="@@quizList.liveDialog.confirm">Veranstaltung starten</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        --live-session-dialog-leading-width: 1.35rem;
        --live-session-dialog-control-width: 2.65rem;
      }

      .live-session-dialog__subtitle {
        max-width: none;
      }

      .live-session-dialog__content {
        display: grid;
        gap: 1rem;
        min-width: min(32rem, 100%);
      }

      .live-session-dialog__channel-grid {
        display: grid;
        gap: 0.65rem;
      }

      .live-session-dialog__channel-card {
        appearance: none;
        width: 100%;
        display: grid;
        grid-template-columns:
          var(--live-session-dialog-leading-width)
          minmax(0, 1fr)
          auto
          var(--live-session-dialog-control-width);
        align-items: center;
        gap: 0.8rem;
        padding: 0.9rem 0.95rem;
        border-radius: calc(var(--mat-sys-corner-large) - 0.05rem);
        border: 1px solid color-mix(in srgb, var(--mat-sys-outline-variant) 72%, transparent);
        background: color-mix(
          in srgb,
          var(--mat-sys-surface) 94%,
          var(--mat-sys-surface-container-low)
        );
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .live-session-dialog__channel-card--selected {
        border-color: color-mix(
          in srgb,
          var(--mat-sys-primary) 60%,
          var(--mat-sys-outline-variant)
        );
        background: color-mix(in srgb, var(--mat-sys-primary) 7%, var(--mat-sys-surface));
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--mat-sys-primary) 14%, transparent),
          0 8px 18px color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
      }

      .live-session-dialog__channel-card:disabled {
        cursor: default;
        opacity: 0.7;
      }

      @media (prefers-reduced-motion: no-preference) {
        .live-session-dialog__channel-card {
          transition:
            border-color 160ms ease,
            background-color 160ms ease,
            box-shadow 160ms ease,
            transform 160ms ease;
        }

        .live-session-dialog__channel-card:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px color-mix(in srgb, var(--mat-sys-shadow) 10%, transparent);
        }
      }

      .live-session-dialog__channel-card:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }

      .live-session-dialog__channel-icon {
        width: var(--live-session-dialog-leading-width);
        min-width: var(--live-session-dialog-leading-width);
        height: var(--live-session-dialog-leading-width);
        color: var(--mat-sys-primary);
        font-size: 1.35rem;
        line-height: 1;
      }

      .live-session-dialog__channel-copy {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
      }

      .live-session-dialog__channel-label {
        display: block;
        font: var(--mat-sys-title-small);
        font-weight: 600;
        color: var(--mat-sys-on-surface);
        line-height: 1.25;
      }

      .live-session-dialog__channel-hint {
        display: block;
        font: var(--mat-sys-body-small);
        line-height: 1.5;
        color: var(--mat-sys-on-surface-variant);
        white-space: normal;
      }

      .live-session-dialog__channel-state {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 3.3rem;
        padding: 0.28rem 0.65rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
        color: var(--mat-sys-primary);
        font: var(--mat-sys-label-medium);
        font-weight: 700;
        white-space: nowrap;
      }

      .live-session-dialog__channel-toggle {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: var(--live-session-dialog-control-width);
        height: 1.55rem;
        padding: 0.14rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--mat-sys-outline-variant) 90%, var(--mat-sys-surface));
        border: 1px solid color-mix(in srgb, var(--mat-sys-outline) 72%, transparent);
        box-sizing: border-box;
        justify-self: end;
        flex-shrink: 0;
      }

      .live-session-dialog__channel-toggle--selected {
        background: color-mix(in srgb, var(--mat-sys-primary) 82%, var(--mat-sys-surface));
        border-color: color-mix(in srgb, var(--mat-sys-primary) 78%, transparent);
      }

      .live-session-dialog__channel-toggle-thumb {
        display: block;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        background: var(--mat-sys-surface);
        box-shadow: 0 1px 3px color-mix(in srgb, var(--mat-sys-shadow) 18%, transparent);
        transform: translateX(0);
      }

      .live-session-dialog__channel-toggle--selected .live-session-dialog__channel-toggle-thumb {
        transform: translateX(1.02rem);
      }

      mat-dialog-actions {
        margin-top: 0.25rem;
        border-top: 1px solid color-mix(in srgb, var(--mat-sys-outline-variant) 28%, transparent);
      }

      @media (max-width: 599px) {
        .live-session-dialog__content {
          min-width: 0;
          gap: 1rem;
        }

        mat-dialog-actions {
          margin-top: 0.15rem;
        }

        .live-session-dialog__channel-hint {
          font-size: 0.84rem;
          line-height: 1.42;
        }

        .live-session-dialog__channel-label {
          font-size: 1rem;
          line-height: 1.28;
        }

        .live-session-dialog__channel-hint {
          font-size: 0.83rem;
        }

        .live-session-dialog__channel-card {
          grid-template-columns:
            var(--live-session-dialog-leading-width)
            minmax(0, 1fr)
            var(--live-session-dialog-control-width);
          align-items: start;
          padding: 0.85rem;
        }

        .live-session-dialog__channel-state {
          grid-column: 2;
          justify-self: start;
          min-width: 0;
        }

        .live-session-dialog__channel-toggle {
          grid-column: 3;
          grid-row: 1;
        }
      }
    `,
  ],
})
export class LiveSessionDialogComponent {
  readonly data = inject<LiveSessionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<LiveSessionDialogComponent, LiveSessionDialogResult | undefined>,
  );
  private readonly document = inject(DOCUMENT);

  readonly enableQuiz = signal(this.data.quizCanStart);
  readonly enableQa = signal(true);
  readonly enableQuickFeedback = signal(true);
  readonly startChannel = signal<'quiz' | 'qa' | 'quickFeedback'>(
    this.data.quizCanStart ? 'quiz' : 'qa',
  );
  readonly canStart = computed(
    () => this.enableQuiz() || this.enableQa() || this.enableQuickFeedback(),
  );

  channelGroupAriaLabel(): string {
    return $localize`:@@quizList.liveDialog.channelGroup:Live-Bereiche wählen`;
  }

  toggleQuiz(checked: boolean): void {
    if (!checked && !this.enableQa() && !this.enableQuickFeedback()) {
      return;
    }
    this.enableQuiz.set(checked);
    if (!checked && this.startChannel() === 'quiz') {
      this.startChannel.set(this.nextAvailableStartChannel('quiz'));
    }
  }

  toggleQa(checked: boolean): void {
    if (!checked && !this.enableQuiz() && !this.enableQuickFeedback()) {
      return;
    }
    this.enableQa.set(checked);
    if (!checked && this.startChannel() === 'qa') {
      this.startChannel.set(this.nextAvailableStartChannel('qa'));
    }
  }

  toggleQuickFeedbackCard(): void {
    if (!this.enableQuickFeedback() && !this.enableQuiz() && !this.enableQa()) {
      this.enableQuickFeedback.set(true);
      this.startChannel.set('quickFeedback');
      return;
    }

    if (!this.enableQuickFeedback()) {
      this.enableQuickFeedback.set(true);
      this.startChannel.set('quickFeedback');
      return;
    }

    if (this.startChannel() === 'quickFeedback') {
      if (!this.enableQuiz() && !this.enableQa()) {
        return;
      }
      this.enableQuickFeedback.set(false);
      this.startChannel.set(this.nextAvailableStartChannel('quickFeedback'));
      return;
    }

    this.startChannel.set('quickFeedback');
  }

  handleChannelCardClick(channel: 'quiz' | 'qa' | 'quickFeedback'): void {
    if (channel === 'quiz') {
      if (!this.data.quizCanStart) {
        return;
      }
      if (!this.enableQuiz()) {
        this.enableQuiz.set(true);
        this.startChannel.set('quiz');
        return;
      }
      if (this.startChannel() === 'quiz') {
        this.toggleQuiz(false);
        return;
      }
      this.startChannel.set('quiz');
      return;
    }

    if (channel === 'qa') {
      if (!this.enableQa()) {
        this.enableQa.set(true);
        this.startChannel.set('qa');
        return;
      }
      if (this.startChannel() === 'qa') {
        this.toggleQa(false);
        return;
      }
      this.startChannel.set('qa');
      return;
    }

    this.toggleQuickFeedbackCard();
  }

  channelStateLabel(channel: 'quiz' | 'qa' | 'quickFeedback'): string | null {
    if (channel === 'quiz') {
      if (this.enableQuiz() && this.startChannel() === 'quiz') {
        return $localize`:@@quizList.liveDialog.channelStateStart:Start`;
      }
      return this.enableQuiz()
        ? $localize`:@@quizList.liveDialog.channelStateOn:An`
        : $localize`:@@quizList.liveDialog.channelStateOff:Aus`;
    }

    if (channel === 'qa') {
      if (this.enableQa() && this.startChannel() === 'qa') {
        return $localize`:@@quizList.liveDialog.channelStateStart:Start`;
      }
      return this.enableQa()
        ? $localize`:@@quizList.liveDialog.channelStateOn:An`
        : $localize`:@@quizList.liveDialog.channelStateOff:Aus`;
    }

    if (this.enableQuickFeedback() && this.startChannel() === 'quickFeedback') {
      return $localize`:@@quizList.liveDialog.channelStateStart:Start`;
    }

    return this.enableQuickFeedback()
      ? $localize`:@@quizList.liveDialog.channelStateOn:An`
      : $localize`:@@quizList.liveDialog.channelStateOff:Aus`;
  }

  start(): void {
    if (!this.canStart()) {
      return;
    }

    // Direkt an dieselbe User-Geste wie dieser Klick gekoppelt (nicht erst nach Navigation).
    tryRequestDocumentFullscreen(this.document);

    this.dialogRef.close({
      startChannel: this.startChannel(),
      enableQuiz: this.enableQuiz(),
      enableQa: this.enableQa(),
      enableQuickFeedback: this.enableQuickFeedback(),
    });
  }

  private nextAvailableStartChannel(
    excluded: 'quiz' | 'qa' | 'quickFeedback',
  ): 'quiz' | 'qa' | 'quickFeedback' {
    const order: Array<'quiz' | 'qa' | 'quickFeedback'> = ['quiz', 'qa', 'quickFeedback'];
    const available = order.filter(
      (channel) => channel !== excluded && this.isChannelEnabled(channel),
    );
    return available[0] ?? excluded;
  }

  private isChannelEnabled(channel: 'quiz' | 'qa' | 'quickFeedback'): boolean {
    if (channel === 'quiz') return this.enableQuiz();
    if (channel === 'qa') return this.enableQa();
    return this.enableQuickFeedback();
  }
}
