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
  styleUrls: ['../styles/dialog-title-header.scss', './server-status-help-dialog.component.scss'],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon" aria-hidden="true">
        <mat-icon>router</mat-icon>
      </span>
      <span class="dialog-title-header__copy">
        <span class="dialog-title-header__heading" i18n="@@app.footer.statusHelpTitle"
          >Server-Status</span
        >
      </span>
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
})
export class ServerStatusHelpDialogComponent {}
