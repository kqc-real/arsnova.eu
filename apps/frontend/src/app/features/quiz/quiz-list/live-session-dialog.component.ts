import { Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';

export interface LiveSessionDialogData {
  quizName: string;
  quizCanStart: boolean;
}

export interface LiveSessionDialogResult {
  startMode: 'QUIZ' | 'Q_AND_A';
  enableQuiz: boolean;
  enableQa: boolean;
  enableQuickFeedback: boolean;
  title?: string;
}

@Component({
  selector: 'app-live-session-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
  ],
  template: `
    <h2 mat-dialog-title>
      <span class="live-session-dialog__title-content">
        <mat-icon aria-hidden="true">play_circle</mat-icon>
        <span i18n="@@quizList.liveDialog.title">Veranstaltung starten</span>
      </span>
    </h2>

    <mat-dialog-content>
      <div class="live-session-dialog__content">
      <section class="live-session-dialog__panel">
        <div class="live-session-dialog__section-head">
          <p class="live-session-dialog__section-label" i18n="@@quizList.liveDialog.startLabel">Start</p>
        </div>

        <div class="live-session-dialog__options" role="group" [attr.aria-label]="optionGroupAriaLabel()">
        <button
          type="button"
          class="live-session-dialog__option"
          [class.live-session-dialog__option--selected]="startMode() === 'QUIZ'"
          [attr.aria-pressed]="startMode() === 'QUIZ'"
          [disabled]="!data.quizCanStart"
          (click)="selectMode('QUIZ')"
        >
          <mat-icon class="live-session-dialog__option-icon" aria-hidden="true">quiz</mat-icon>
          <span class="live-session-dialog__option-copy">
            <span class="live-session-dialog__option-label" i18n="@@quizList.liveDialog.optionQuiz">Mit Quiz</span>
            <span class="live-session-dialog__option-hint" i18n="@@quizList.liveDialog.optionQuizHint">
              Nutzt „{{ data.quizName }}“.
            </span>
          </span>
          <span
            class="live-session-dialog__option-radio"
            [class.live-session-dialog__option-radio--selected]="startMode() === 'QUIZ'"
            aria-hidden="true"
          ></span>
        </button>

        <button
          type="button"
          class="live-session-dialog__option"
          [class.live-session-dialog__option--selected]="startMode() === 'Q_AND_A'"
          [attr.aria-pressed]="startMode() === 'Q_AND_A'"
          (click)="selectMode('Q_AND_A')"
        >
          <mat-icon class="live-session-dialog__option-icon" aria-hidden="true">forum</mat-icon>
          <span class="live-session-dialog__option-copy">
            <span class="live-session-dialog__option-label" i18n="@@quizList.liveDialog.optionQa">Mit Fragen</span>
            <span class="live-session-dialog__option-hint" i18n="@@quizList.liveDialog.optionQaHint">
              Startet mit Fragen. Quiz später dazu.
            </span>
          </span>
          <span
            class="live-session-dialog__option-radio"
            [class.live-session-dialog__option-radio--selected]="startMode() === 'Q_AND_A'"
            aria-hidden="true"
          ></span>
        </button>
        </div>
      </section>

      <section class="live-session-dialog__panel live-session-dialog__panel--soft">
        <div class="live-session-dialog__channels">
          <div class="live-session-dialog__section-head">
            <p class="live-session-dialog__section-label" i18n="@@quizList.liveDialog.channelsLabel">Zusätzlich aktivieren</p>
          </div>

          <div class="live-session-dialog__channel-grid" role="group" [attr.aria-label]="channelGroupAriaLabel()">
            <button
              type="button"
              class="live-session-dialog__channel-card"
              [class.live-session-dialog__channel-card--selected]="enableQuiz()"
              [class.live-session-dialog__channel-card--locked]="startMode() === 'QUIZ'"
              [disabled]="!data.quizCanStart"
              [attr.aria-pressed]="enableQuiz()"
              (click)="toggleQuizCard()"
            >
              <mat-icon class="live-session-dialog__channel-icon" aria-hidden="true">quiz</mat-icon>
              <span class="live-session-dialog__channel-copy">
                <span class="live-session-dialog__channel-label" i18n="@@quizList.liveDialog.channelQuiz">Quiz</span>
                <span class="live-session-dialog__channel-hint" i18n="@@quizList.liveDialog.channelQuizHint">
                  Fragen und Ergebnisse
                </span>
              </span>
              @if (channelStateLabel('quiz'); as stateLabel) {
                <span class="live-session-dialog__channel-state">{{ stateLabel }}</span>
              }
              <span
                class="live-session-dialog__channel-toggle"
                [class.live-session-dialog__channel-toggle--selected]="enableQuiz()"
                [class.live-session-dialog__channel-toggle--locked]="startMode() === 'QUIZ'"
                aria-hidden="true"
              >
                <span class="live-session-dialog__channel-toggle-thumb"></span>
              </span>
            </button>

            <button
              type="button"
              class="live-session-dialog__channel-card"
              [class.live-session-dialog__channel-card--selected]="enableQa()"
              [class.live-session-dialog__channel-card--locked]="startMode() === 'Q_AND_A'"
              [attr.aria-pressed]="enableQa()"
              (click)="toggleQaCard()"
            >
              <mat-icon class="live-session-dialog__channel-icon" aria-hidden="true">forum</mat-icon>
              <span class="live-session-dialog__channel-copy">
                <span class="live-session-dialog__channel-label" i18n="@@quizList.liveDialog.channelQa">Fragen</span>
                <span class="live-session-dialog__channel-hint" i18n="@@quizList.liveDialog.channelQaHint">
                  Fragen aus dem Raum
                </span>
              </span>
              @if (channelStateLabel('qa'); as stateLabel) {
                <span class="live-session-dialog__channel-state">{{ stateLabel }}</span>
              }
              <span
                class="live-session-dialog__channel-toggle"
                [class.live-session-dialog__channel-toggle--selected]="enableQa()"
                [class.live-session-dialog__channel-toggle--locked]="startMode() === 'Q_AND_A'"
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
              (click)="toggleQuickFeedbackCard()"
            >
              <mat-icon class="live-session-dialog__channel-icon" aria-hidden="true">bolt</mat-icon>
              <span class="live-session-dialog__channel-copy">
                <span class="live-session-dialog__channel-label" i18n="@@quizList.liveDialog.channelQuickFeedback">Blitz-Feedback</span>
                <span class="live-session-dialog__channel-hint" i18n="@@quizList.liveDialog.channelQuickFeedbackHint">
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
      </section>

      @if (startMode() === 'QUIZ' && !data.quizCanStart) {
        <p class="live-session-dialog__hint live-session-dialog__hint--error" i18n="@@quizList.liveDialog.quizDisabled">
          Für Quiz brauchst du mindestens eine Frage. Sonst starte mit Fragen.
        </p>
      }

      @if (enableQa()) {
        <div class="live-session-dialog__field-row">
          <mat-form-field appearance="outline" class="live-session-dialog__field">
            <mat-label i18n="@@quizList.liveDialog.qaTitleLabel">Fragen-Titel (optional)</mat-label>
            <input
              matInput
              type="text"
              maxlength="200"
              [value]="qaTitle()"
              (input)="qaTitle.set($any($event.target).value)"
              i18n-placeholder="@@quizList.liveDialog.qaTitlePlaceholder"
              placeholder="z. B. Vorlesung"
            />
          </mat-form-field>
        </div>
      }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="undefined" i18n="@@quizList.liveDialog.cancel">Abbrechen</button>
      <button mat-flat-button color="primary" [disabled]="!canStart()" (click)="start()">
        <span i18n="@@quizList.liveDialog.confirm">Veranstaltung starten</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      --live-session-dialog-leading-width: 1.5rem;
      --live-session-dialog-control-width: 2.65rem;
      --live-session-dialog-panel-padding: 1.05rem;
    }

    .live-session-dialog__title-content {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font: var(--mat-sys-headline-small);
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;

      mat-icon {
        color: var(--mat-sys-primary);
        transform: translateY(-0.02rem);
      }
    }

    .live-session-dialog__content {
      display: grid;
      gap: 1.2rem;
      min-width: min(32rem, 100%);
    }

    .live-session-dialog__panel {
      display: grid;
      gap: 1rem;
      padding: var(--live-session-dialog-panel-padding);
      border-radius: calc(var(--mat-sys-corner-large) + 0.25rem);
      background: color-mix(in srgb, var(--mat-sys-surface-container-low) 86%, var(--mat-sys-surface));
      box-shadow:
        0 1px 2px color-mix(in srgb, var(--mat-sys-shadow) 3%, transparent),
        0 10px 24px color-mix(in srgb, var(--mat-sys-shadow) 3%, transparent);
    }

    .live-session-dialog__panel--soft {
      background: color-mix(in srgb, var(--mat-sys-surface-container-low) 66%, var(--mat-sys-surface));
    }

    .live-session-dialog__section-head {
      display: grid;
      gap: 0.28rem;
    }

    .live-session-dialog__options {
      display: grid;
      gap: 0.75rem;
    }

    .live-session-dialog__channels {
      display: grid;
      gap: 0.65rem;
    }

    .live-session-dialog__channel-grid {
      display: grid;
      gap: 0.65rem;
    }

    .live-session-dialog__section-label {
      margin: 0;
      font: var(--mat-sys-title-small);
      font-weight: 700;
      color: var(--mat-sys-on-surface);
      letter-spacing: -0.01em;
    }

    .live-session-dialog__section-copy {
      margin: 0;
      font: var(--mat-sys-body-small);
      line-height: 1.5;
      color: var(--mat-sys-on-surface-variant);
      max-width: 32ch;
    }

    .live-session-dialog__option {
      appearance: none;
      border: 1px solid var(--mat-sys-outline-variant);
      display: grid;
      grid-template-columns:
        var(--live-session-dialog-leading-width)
        minmax(0, 1fr)
        var(--live-session-dialog-control-width);
      column-gap: 0.75rem;
      align-items: start;
      min-height: 0;
      width: 100%;
      padding: 1.02rem 1rem;
      margin: 0;
      text-align: left;
      border-radius: calc(var(--mat-sys-corner-large) + 0.15rem);
      background: color-mix(in srgb, var(--mat-sys-surface) 92%, var(--mat-sys-surface-container-low));
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .live-session-dialog__option--selected {
      border-color: var(--mat-sys-primary);
      background: color-mix(in srgb, var(--mat-sys-primary) 9%, var(--mat-sys-surface));
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--mat-sys-primary) 18%, transparent),
        0 10px 20px color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    @media (prefers-reduced-motion: no-preference) {
      .live-session-dialog__option {
        transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }

      .live-session-dialog__option:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px color-mix(in srgb, var(--mat-sys-shadow) 10%, transparent);
      }
    }

    .live-session-dialog__option:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .live-session-dialog__option:disabled {
      cursor: default;
      opacity: 0.65;
    }

    .live-session-dialog__option-icon {
      width: var(--live-session-dialog-leading-width);
      min-width: var(--live-session-dialog-leading-width);
      height: var(--live-session-dialog-leading-width);
      margin-top: 0.08rem;
      color: var(--mat-sys-primary);
      font-size: 1.35rem;
      line-height: 1;
    }

    .live-session-dialog__option-copy {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }

    .live-session-dialog__option-radio {
      align-self: start;
      justify-self: end;
      margin-top: 0.08rem;
      width: 1.35rem;
      height: 1.35rem;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, var(--mat-sys-outline) 82%, var(--mat-sys-primary));
      background: var(--mat-sys-surface);
      box-sizing: border-box;
      position: relative;
      flex-shrink: 0;
    }

    .live-session-dialog__option-radio::after {
      content: '';
      position: absolute;
      inset: 0.22rem;
      border-radius: 50%;
      background: transparent;
    }

    .live-session-dialog__option-radio--selected {
      border-color: var(--mat-sys-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
    }

    .live-session-dialog__option-radio--selected::after {
      background: var(--mat-sys-primary);
    }

    .live-session-dialog__option-label {
      display: block;
      font: var(--mat-sys-title-medium);
      font-weight: 600;
      color: var(--mat-sys-on-surface);
      line-height: 1.25;
    }

    .live-session-dialog__option-hint {
      display: block;
      font: var(--mat-sys-body-small);
      line-height: 1.5;
      color: var(--mat-sys-on-surface-variant);
      white-space: normal;
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
      background: color-mix(in srgb, var(--mat-sys-surface) 94%, var(--mat-sys-surface-container-low));
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .live-session-dialog__channel-card--selected {
      border-color: color-mix(in srgb, var(--mat-sys-primary) 60%, var(--mat-sys-outline-variant));
      background: color-mix(in srgb, var(--mat-sys-primary) 7%, var(--mat-sys-surface));
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--mat-sys-primary) 14%, transparent),
        0 8px 18px color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
    }

    .live-session-dialog__channel-card--locked {
      cursor: default;
    }

    .live-session-dialog__channel-card:disabled {
      cursor: default;
      opacity: 0.7;
    }

    @media (prefers-reduced-motion: no-preference) {
      .live-session-dialog__channel-card {
        transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }

      .live-session-dialog__channel-card:hover:not(:disabled):not(.live-session-dialog__channel-card--locked) {
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

    .live-session-dialog__channel-toggle--locked {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
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

    .live-session-dialog__field-row {
      padding-inline: var(--live-session-dialog-panel-padding);
    }

    .live-session-dialog__field {
      width: 100%;
      margin-top: 0.15rem;
    }

    mat-dialog-actions {
      margin-top: 0.25rem;
      border-top: 1px solid color-mix(in srgb, var(--mat-sys-outline-variant) 28%, transparent);
    }

    .live-session-dialog__hint {
      margin: 0;
      font: var(--mat-sys-body-small);
      line-height: 1.45;
      padding: 0.8rem 0.9rem;
      border-radius: var(--mat-sys-corner-medium);
      background: color-mix(in srgb, var(--mat-sys-error) 6%, var(--mat-sys-surface));
      border: 1px solid color-mix(in srgb, var(--mat-sys-error) 18%, transparent);
    }

    .live-session-dialog__hint--error {
      color: var(--mat-sys-error);
    }

    @media (max-width: 599px) {
      :host {
        --live-session-dialog-panel-padding: 0.9rem;
      }

      .live-session-dialog__content {
        min-width: 0;
        gap: 1rem;
      }

      mat-dialog-actions {
        margin-top: 0.15rem;
      }

      .live-session-dialog__panel {
        padding: 0.95rem var(--live-session-dialog-panel-padding);
      }

      .live-session-dialog__option {
        grid-template-columns: 1fr var(--live-session-dialog-control-width);
        padding: 0.9rem;
      }

      .live-session-dialog__option-icon {
        grid-column: 1;
        grid-row: 1;
        margin-bottom: 0.2rem;
      }

      .live-session-dialog__option-copy {
        grid-column: 1 / -1;
        grid-row: 2;
      }

      .live-session-dialog__option-radio {
        grid-column: 2;
        grid-row: 1;
      }

      .live-session-dialog__section-copy,
      .live-session-dialog__option-hint,
      .live-session-dialog__channel-hint,
      .live-session-dialog__hint {
        font-size: 0.84rem;
        line-height: 1.42;
      }

      .live-session-dialog__option-label,
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
  `],
})
export class LiveSessionDialogComponent {
  readonly data = inject<LiveSessionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<LiveSessionDialogComponent, LiveSessionDialogResult | undefined>);

  readonly startMode = signal<'QUIZ' | 'Q_AND_A'>(this.data.quizCanStart ? 'QUIZ' : 'Q_AND_A');
  readonly enableQuiz = signal(this.data.quizCanStart);
  readonly enableQa = signal(true);
  readonly enableQuickFeedback = signal(false);
  readonly qaTitle = signal('');
  readonly canStart = computed(() => this.enableQuiz() || this.enableQa() || this.enableQuickFeedback());

  optionGroupAriaLabel(): string {
    return $localize`:@@quizList.liveDialog.optionGroup:Start für Live-Session wählen`;
  }

  channelGroupAriaLabel(): string {
    return $localize`:@@quizList.liveDialog.channelGroup:Zusätzliche Live-Bereiche wählen`;
  }

  selectMode(mode: 'QUIZ' | 'Q_AND_A'): void {
    this.startMode.set(mode);
    if (mode === 'QUIZ') {
      this.enableQuiz.set(true);
    }
    if (mode === 'Q_AND_A') {
      this.enableQa.set(true);
    }
  }

  toggleQuiz(checked: boolean): void {
    this.enableQuiz.set(checked);
    if (!checked && this.startMode() === 'QUIZ') {
      this.startMode.set('Q_AND_A');
      this.enableQa.set(true);
    }
  }

  toggleQa(checked: boolean): void {
    this.enableQa.set(checked);
    if (!checked && this.startMode() === 'Q_AND_A' && this.data.quizCanStart) {
      this.startMode.set('QUIZ');
      this.enableQuiz.set(true);
    }
  }

  toggleQuizCard(): void {
    if (!this.data.quizCanStart || this.startMode() === 'QUIZ') {
      return;
    }
    this.toggleQuiz(!this.enableQuiz());
  }

  toggleQaCard(): void {
    if (this.startMode() === 'Q_AND_A') {
      return;
    }
    this.toggleQa(!this.enableQa());
  }

  toggleQuickFeedbackCard(): void {
    this.enableQuickFeedback.set(!this.enableQuickFeedback());
  }

  channelStateLabel(channel: 'quiz' | 'qa' | 'quickFeedback'): string | null {
    if (channel === 'quiz') {
      if (this.startMode() === 'QUIZ' && this.enableQuiz()) {
        return $localize`:@@quizList.liveDialog.channelStateStart:Start`;
      }
      return this.enableQuiz()
        ? $localize`:@@quizList.liveDialog.channelStateOn:An`
        : $localize`:@@quizList.liveDialog.channelStateOff:Aus`;
    }

    if (channel === 'qa') {
      if (this.startMode() === 'Q_AND_A' && this.enableQa()) {
        return $localize`:@@quizList.liveDialog.channelStateStart:Start`;
      }
      return this.enableQa()
        ? $localize`:@@quizList.liveDialog.channelStateOn:An`
        : $localize`:@@quizList.liveDialog.channelStateOff:Aus`;
    }

    return this.enableQuickFeedback()
      ? $localize`:@@quizList.liveDialog.channelStateOn:An`
      : $localize`:@@quizList.liveDialog.channelStateOff:Aus`;
  }

  start(): void {
    if (!this.canStart()) {
      return;
    }

    this.dialogRef.close({
      startMode: this.startMode(),
      enableQuiz: this.enableQuiz(),
      enableQa: this.enableQa(),
      enableQuickFeedback: this.enableQuickFeedback(),
      title: this.enableQa() ? this.qaTitle().trim() : undefined,
    });
  }
}
