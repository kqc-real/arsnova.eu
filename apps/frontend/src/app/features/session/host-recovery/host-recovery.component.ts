import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { localizeCommands } from '../../../core/locale-router';
import {
  clearRecoveryExchangeId,
  getOrCreateRecoveryExchangeId,
  persistInitialHostRecovery,
} from '../../../core/host-recovery-access';
import { setHostToken, trpc } from '../../../core/trpc.client';

type RecoverySourceKind = 'RECOVERY' | 'ADMIN_HANDOFF';

@Component({
  selector: 'app-host-recovery',
  standalone: true,
  imports: [
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <mat-card>
        <mat-card-header>
          <mat-icon aria-hidden="true">admin_panel_settings</mat-icon>
          <mat-card-title i18n="@@hostRecovery.title">Host-Zugang wiederherstellen</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p i18n="@@hostRecovery.intro">
            Verwende die Support-ID und den geheimen Code deiner Host-Notfallkarte. Sessioncode oder
            Support-ID allein reichen nicht aus.
          </p>

          <mat-button-toggle-group
            [value]="sourceKind()"
            (change)="sourceKind.set($event.value)"
            aria-label="Art des Wiederherstellungscodes"
            i18n-aria-label="@@hostRecovery.sourceKindLabel"
          >
            <mat-button-toggle value="RECOVERY" i18n="@@hostRecovery.recoveryCardOption">
              Notfallkarte
            </mat-button-toggle>
            <mat-button-toggle value="ADMIN_HANDOFF" i18n="@@hostRecovery.adminHandoffOption">
              Support-Übergabe
            </mat-button-toggle>
          </mat-button-toggle-group>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@hostRecovery.supportIdLabel">Support-ID</mat-label>
            <input
              matInput
              autocomplete="off"
              spellcheck="false"
              [value]="supportId()"
              (input)="supportId.set(asInputValue($event).toUpperCase())"
              placeholder="ARS-XXXX-XXXX"
            />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@hostRecovery.secretLabel">Geheimer Code</mat-label>
            <input
              matInput
              type="password"
              autocomplete="off"
              spellcheck="false"
              [value]="secret()"
              (input)="secret.set(asInputValue($event))"
              (keydown.enter)="recover()"
            />
            <mat-hint i18n="@@hostRecovery.secretHint">
              Der Code wird nur im Request übertragen, nie in der URL.
            </mat-hint>
          </mat-form-field>

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <div class="actions">
            <a mat-button [routerLink]="homeCommands()" i18n="@@common.cancel">Abbrechen</a>
            <button
              mat-flat-button
              type="button"
              [disabled]="pending() || !canSubmit()"
              (click)="recover()"
            >
              <mat-icon aria-hidden="true">login</mat-icon>
              <span i18n="@@hostRecovery.submit">Zugang wiederherstellen</span>
            </button>
          </div>

          <p class="boundary" i18n="@@hostRecovery.boundary">
            Die Wiederherstellung verlängert weder die Session noch die Nachbereitungsfrist. Wenn
            Browserdaten und Notfallkarte verloren sind, kann der Support nur nach unabhängiger
            Prüfung des konkreten Sessionbezugs helfen.
          </p>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: [
    `
      main {
        display: grid;
        min-height: calc(100dvh - 4rem);
        place-items: center;
        padding: 1rem;
      }
      mat-card {
        width: min(100%, 38rem);
      }
      mat-card-content {
        display: grid;
        gap: 1rem;
        padding-top: 1rem;
      }
      mat-button-toggle-group,
      mat-form-field {
        width: 100%;
      }
      mat-button-toggle {
        flex: 1;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .error {
        color: var(--mat-sys-error);
      }
      .boundary {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
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
      const prepared = await trpc.session.prepareHostCredentialExchange.mutate({
        supportId,
        recoveryExchangeId: getOrCreateRecoveryExchangeId(supportId),
        source,
      });
      persistInitialHostRecovery({
        code: prepared.code,
        browserCapability: prepared.browserCapability,
        recoveryCard: prepared.recoveryCard,
      });
      const activated = await trpc.session.activateHostCredential.mutate({
        supportId: prepared.recoveryCard.supportId,
        browserCapability: prepared.browserCapability,
      });
      setHostToken(prepared.code, activated.hostToken);
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
