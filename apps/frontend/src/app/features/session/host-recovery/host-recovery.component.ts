import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { localizeCommands } from '../../../core/locale-router';
import {
  clearPendingHostCredentialActivation,
  clearRecoveryExchangeId,
  getPendingHostCredentialActivation,
  getOrCreateRecoveryExchangeId,
  persistInitialHostRecovery,
  stagePendingHostCredentialActivation,
} from '../../../core/host-recovery-access';
import { setHostToken, trpc } from '../../../core/trpc.client';

type RecoverySourceKind = 'RECOVERY' | 'ADMIN_HANDOFF';

@Component({
  selector: 'app-host-recovery',
  standalone: true,
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../../../shared/styles/dialog-title-header.scss'],
  template: `
    <main class="host-recovery-page">
      <mat-card class="host-recovery-page__card">
        <div class="dialog-title-header dialog-title-header--page">
          <span class="dialog-title-header__icon" aria-hidden="true">
            <mat-icon>admin_panel_settings</mat-icon>
          </span>
          <span class="dialog-title-header__copy">
            <h1 class="dialog-title-header__heading" i18n="@@hostRecovery.title">
              Host-Zugang wiederherstellen
            </h1>
            <span class="dialog-title-header__sub" i18n="@@hostRecovery.intro">
              Gib die Session-Kennung und den Recovery-Code deiner Notfallkarte ein.
            </span>
          </span>
        </div>
        <mat-card-content class="host-recovery-page__content">
          <form class="host-recovery-page__form" autocomplete="off" (submit)="onSubmit($event)">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label i18n="@@hostRecovery.supportIdLabel">Session-Kennung</mat-label>
              <input
                matInput
                name="arsnova-host-support-id"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                [value]="supportId()"
                (input)="supportId.set(asInputValue($event).toUpperCase())"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              @if (sourceKind() === 'RECOVERY') {
                <mat-label i18n="@@hostRecovery.recoveryCodeLabel">Recovery-Code</mat-label>
              } @else {
                <mat-label i18n="@@hostRecovery.handoffCodeLabel"
                  >Übergabecode vom Support</mat-label
                >
              }
              <input
                matInput
                type="text"
                name="arsnova-host-recovery-secret"
                autocomplete="off"
                spellcheck="false"
                [value]="secret()"
                (input)="secret.set(asInputValue($event))"
              />
              <mat-hint i18n="@@hostRecovery.secretHint">
                Wird nur an den Server gesendet, nie in der Adresszeile.
              </mat-hint>
            </mat-form-field>

            @if (error()) {
              <p class="host-recovery-page__error" role="alert">{{ error() }}</p>
            }

            <div class="host-recovery-page__actions">
              <a matButton="text" [routerLink]="homeCommands()" i18n="@@common.cancel">Abbrechen</a>
              <button matButton="filled" type="submit" [disabled]="pending() || !canSubmit()">
                <mat-icon aria-hidden="true">login</mat-icon>
                <span i18n="@@hostRecovery.submit">Zugang wiederherstellen</span>
              </button>
            </div>
          </form>

          @if (sourceKind() === 'RECOVERY') {
            <button
              matButton="text"
              type="button"
              class="host-recovery-page__switch"
              (click)="sourceKind.set('ADMIN_HANDOFF')"
              i18n="@@hostRecovery.useHandoff"
            >
              Ich habe einen Code vom Support
            </button>
          } @else {
            <button
              matButton="text"
              type="button"
              class="host-recovery-page__switch"
              (click)="sourceKind.set('RECOVERY')"
              i18n="@@hostRecovery.useRecoveryCard"
            >
              Ich habe eine Notfallkarte
            </button>
          }

          <p class="host-recovery-page__boundary" i18n="@@hostRecovery.boundary">
            Damit verlängerst du die Session nicht. Fehlt die Notfallkarte, kann nur noch der
            Support helfen. Den Kontakt findest du im »Impressum«.
          </p>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .host-recovery-page {
        display: grid;
        min-height: calc(100dvh - 4rem);
        place-items: center;
        padding: 1.5rem 1rem;
      }
      .host-recovery-page__card {
        --mdc-elevated-card-container-color: var(--mat-sys-surface-container-high);
        --mat-card-elevated-container-color: var(--mat-sys-surface-container-high);
        width: min(100%, 38rem);
        padding: 1.25rem 1.25rem 1.5rem;
        box-sizing: border-box;
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface);
        outline: 1px solid var(--mat-sys-outline);
        box-shadow: var(--mat-sys-level3);
        border-radius: var(--mat-sys-corner-extra-large);
      }
      .host-recovery-page__content,
      .host-recovery-page__form {
        display: grid;
        gap: 1rem;
      }
      mat-form-field {
        width: 100%;
      }
      .host-recovery-page__switch {
        justify-self: start;
      }
      .host-recovery-page__actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.65rem;
      }
      .host-recovery-page__error {
        margin: 0;
        color: var(--mat-sys-error);
        font: var(--mat-sys-body-medium);
        line-height: 1.4;
      }
      .host-recovery-page__boundary {
        margin: 0;
        padding: 0.8rem 0.9rem;
        border-radius: var(--mat-sys-corner-medium);
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
        font: var(--mat-sys-body-medium);
        line-height: 1.5;
      }
      @media (max-width: 359px) {
        .host-recovery-page__actions a,
        .host-recovery-page__actions button {
          width: 100%;
        }
      }
    `,
  ],
})
export class HostRecoveryComponent {
  private readonly router = inject(Router);
  readonly sourceKind = signal<RecoverySourceKind>('RECOVERY');
  readonly supportId = signal('');
  readonly secret = signal('');
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);

  homeCommands() {
    return localizeCommands(['']);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    void this.recover();
  }

  canSubmit(): boolean {
    return (
      /^ARS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/u.test(this.supportId().trim()) &&
      this.secret().trim().length >= 22
    );
  }

  asInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async recover(): Promise<void> {
    if (this.pending() || !this.canSubmit()) return;
    this.pending.set(true);
    this.error.set(null);
    const supportId = this.supportId().trim().toUpperCase();
    const source =
      this.sourceKind() === 'RECOVERY'
        ? ({ kind: 'RECOVERY', recoveryCode: this.secret().trim() } as const)
        : ({ kind: 'ADMIN_HANDOFF', handoffCapability: this.secret().trim() } as const);
    try {
      const pendingActivation = getPendingHostCredentialActivation(supportId);
      let prepared = pendingActivation;
      if (!prepared) {
        const newlyPrepared = await trpc.session.prepareHostCredentialExchange.mutate({
          supportId,
          recoveryExchangeId: getOrCreateRecoveryExchangeId(supportId),
          source,
        });
        persistInitialHostRecovery({
          code: newlyPrepared.code,
          browserCapability: newlyPrepared.browserCapability,
          recoveryCard: newlyPrepared.recoveryCard,
        });
        stagePendingHostCredentialActivation(
          supportId,
          newlyPrepared.code,
          newlyPrepared.pendingExpiresAt,
        );
        prepared = newlyPrepared;
      }
      const activated = await trpc.session.activateHostCredential.mutate({
        supportId: prepared.recoveryCard.supportId,
        browserCapability: prepared.browserCapability,
      });
      setHostToken(prepared.code, activated.hostToken);
      clearPendingHostCredentialActivation(supportId);
      clearRecoveryExchangeId(supportId);
      this.secret.set('');
      await this.router.navigate(localizeCommands(['session', prepared.code, 'host']));
    } catch {
      this.error.set(
        $localize`:@@hostRecovery.genericError:Wiederherstellung nicht möglich oder abgelaufen.`,
      );
    } finally {
      this.pending.set(false);
    }
  }
}
