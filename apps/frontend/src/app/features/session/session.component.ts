import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import type { SessionInfoDTO } from '@arsnova/shared-types';

/**
 * Session-Seite (Epic 2 + 3).
 * Platzhalter – zeigt Session-Info per Code an.
 * Wird mit Story 2.2 (Lobby), 2.3 (Steuerung), 3.1 (Beitreten) erweitert.
 */
@Component({
  selector: 'app-session',
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle, MatIcon],
  template: `
    <div class="l-page l-section">
      <a matButton routerLink="/" aria-label="Zurück zur Startseite">
        <mat-icon>arrow_back</mat-icon>
        Startseite
      </a>

      @if (loading()) {
        <div class="session-page__state">
          <p class="session-page__muted-text">Wird geladen…</p>
        </div>
      } @else if (error()) {
        <mat-card class="session-page__error-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon class="session-page__error-icon">error</mat-icon>
              Fehler
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="session-page__error-text" role="alert">{{ error() }}</p>
          </mat-card-content>
        </mat-card>
      } @else {
        @if (session(); as s) {
          <mat-card appearance="outlined" class="session-card">
            <mat-card-header class="session-card__header">
              <mat-card-subtitle>Code</mat-card-subtitle>
              <mat-card-title class="session-card__code">{{ s.code }}</mat-card-title>
            </mat-card-header>

            <mat-card-content>
              <div class="session-card__meta l-stack l-stack--sm">
                <p><span class="session-card__label">Status:</span> {{ s.status }}</p>
                <p><span class="session-card__label">Typ:</span> {{ s.type }}</p>
                @if (s.quizName) {
                  <p><span class="session-card__label">Quiz:</span> {{ s.quizName }}</p>
                }
                <p><span class="session-card__label">Teilnehmer:</span> {{ s.participantCount }}</p>
              </div>
              <p class="session-card__hint">
                Lobby und Steuerung werden hier angezeigt.
              </p>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .session-page__state {
      margin-top: 2rem;
      text-align: center;
    }

    .session-page__muted-text {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }

    .session-page__error-card {
      margin-top: 2rem;
      border: 1px solid var(--mat-sys-error);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .session-page__error-icon {
      vertical-align: middle;
      margin-right: 0.25rem;
      color: var(--mat-sys-error);
    }

    .session-page__error-text {
      margin: 0;
      font: var(--mat-sys-body-small);
    }

    .session-card {
      margin-top: 2rem;
    }

    .session-card__header {
      text-align: center;
    }

    .session-card__code {
      color: var(--mat-sys-primary);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: clamp(1.75rem, 5vw, 2.25rem);
      font-weight: 700;
      letter-spacing: 0.18em;
    }

    .session-card__meta {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface);
    }

    .session-card__label {
      font-weight: 600;
    }

    .session-card__hint {
      margin: 1.5rem 0 0;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `],
})
export class SessionComponent implements OnInit {
  session = signal<SessionInfoDTO | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private route: ActivatedRoute) {}

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    if (code.length !== 6) {
      this.error.set('Ungültiger Code.');
      this.loading.set(false);
      return;
    }
    try {
      const info = await trpc.health.check.query();
      if (info.status !== 'ok') throw new Error('Backend nicht erreichbar');
      const session = await trpc.session.getInfo.query({ code: code.toUpperCase() });
      this.session.set(session);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Nicht gefunden. Code prüfen oder neu eingeben.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
