import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-server-status-help-dialog',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, MatDialogClose, MatIcon],
  template: `
    <h2 mat-dialog-title class="status-help-dialog__title" i18n="@@app.footer.statusHelpTitle">
      Server-Status erklärt
    </h2>
    <mat-dialog-content class="status-help-dialog__content">
      <p class="status-help-dialog__copy" i18n="@@app.footer.statusHelpDot">
        Der Status wird über farbige Punkte angezeigt.
      </p>
      <ul class="status-help-dialog__legend" role="list">
        <li>
          <span
            class="status-help-dialog__dot status-help-dialog__dot--healthy"
            aria-hidden="true"
          ></span>
          <span i18n="@@app.footer.statusLegendHealthy">Gesund</span>
        </li>
        <li>
          <span
            class="status-help-dialog__dot status-help-dialog__dot--busy"
            aria-hidden="true"
          ></span>
          <span i18n="@@app.footer.statusLegendBusy">Ausgelastet</span>
        </li>
        <li>
          <span
            class="status-help-dialog__dot status-help-dialog__dot--overloaded"
            aria-hidden="true"
          ></span>
          <span i18n="@@app.footer.statusLegendOverloaded">Überlastet</span>
        </li>
        <li>
          <span
            class="status-help-dialog__dot status-help-dialog__dot--unknown"
            aria-hidden="true"
          ></span>
          <span i18n="@@app.footer.statusLegendUnknown">Keine Live-Daten</span>
        </li>
      </ul>
      <ul class="status-help-dialog__list" role="list">
        <li>
          <mat-icon aria-hidden="true">play_circle</mat-icon>
          <span i18n="@@app.footer.statusHelpLiveSessions"
            >Live-Sessions (aktuell aktive Veranstaltungen)</span
          >
        </li>
        <li>
          <mat-icon aria-hidden="true">bolt</mat-icon>
          <span i18n="@@app.footer.statusHelpBlitz"
            >Blitz-Runden (laufende Quick-Feedback-Runden)</span
          >
        </li>
        <li>
          <mat-icon aria-hidden="true">group</mat-icon>
          <span i18n="@@app.footer.statusHelpParticipants">Teilnehmende (derzeit verbunden)</span>
        </li>
        <li>
          <mat-icon aria-hidden="true">check_circle</mat-icon>
          <span i18n="@@app.footer.statusHelpCompleted">Abgeschlossene Sessions (gesamt)</span>
        </li>
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close i18n="@@app.footer.statusHelpClose">
        Schließen
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .status-help-dialog__title {
      margin: 0;
      padding: 1rem 1rem 0.35rem;
      font: var(--mat-sys-title-medium);
      letter-spacing: 0.01em;
      color: var(--mat-sys-on-surface);
    }

    .status-help-dialog__content {
      margin: 0;
      padding: 0 1rem 0.5rem !important;
      display: grid;
      gap: 0.7rem;
      overflow: visible;
      max-height: none;
    }

    mat-dialog-actions {
      padding: 0 1rem 1rem;
      margin: 0;
    }

    .status-help-dialog__copy {
      margin: 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.45;
    }

    .status-help-dialog__list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.5rem;
    }

    .status-help-dialog__legend {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.35rem 0.75rem;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .status-help-dialog__legend li {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    .status-help-dialog__dot {
      width: 0.8rem;
      height: 0.8rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-outline-variant);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
    }

    .status-help-dialog__dot--healthy {
      background: var(--app-status-healthy);
    }

    .status-help-dialog__dot--busy {
      background: var(--app-status-busy);
    }

    .status-help-dialog__dot--overloaded {
      background: var(--mat-sys-error);
    }

    .status-help-dialog__dot--unknown {
      background: var(--mat-sys-outline-variant);
    }

    .status-help-dialog__list li {
      display: grid;
      grid-template-columns: 1.5rem 1fr;
      align-items: center;
      gap: 0.65rem;
      padding: 0.55rem 0.65rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-low);
      border: 1px solid color-mix(in srgb, var(--mat-sys-outline-variant) 78%, transparent);
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface);
      line-height: 1.35;
    }

    .status-help-dialog__list mat-icon {
      margin-top: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      color: var(--mat-sys-primary);
    }

    @media (min-width: 760px) {
      .status-help-dialog__list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class ServerStatusHelpDialogComponent {}
