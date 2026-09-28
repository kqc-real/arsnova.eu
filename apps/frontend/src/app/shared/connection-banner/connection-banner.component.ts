/**
 * Banner bei WebSocket-Verbindungsabbruch (Story 4.3).
 * Zeigt Hinweis + automatischer Reconnect-Status.
 */
import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { WsConnectionService } from '../../core/ws-connection.service';

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  imports: [MatIcon, MatButton],
  template: `
    @if (ws.disconnected()) {
      <div class="connection-banner" role="alert" aria-live="assertive">
        <mat-icon>wifi_off</mat-icon>
        <div class="connection-banner__copy">
          <span>{{ bannerStatusText() }}</span>
          @if (ws.manualReconnectOffered()) {
            <button
              mat-button
              type="button"
              class="connection-banner__action"
              [disabled]="ws.manualReconnectPending()"
              [attr.aria-busy]="ws.manualReconnectPending()"
              (click)="reconnectNow()"
            >
              @if (ws.manualReconnectPending()) {
                <span i18n="@@connectionBanner.reconnectingNow">Verbindung wird hergestellt …</span>
              } @else {
                <span i18n="@@connectionBanner.reconnectNow">Jetzt neu verbinden</span>
              }
            </button>
            @if (ws.manualReconnectFailed()) {
              <span class="connection-banner__hint" i18n="@@connectionBanner.reconnectFailed">
                Verbindung konnte noch nicht hergestellt werden.
              </span>
            }
          } @else {
            <span class="connection-banner__hint">{{ bannerReloadHint() }}</span>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .connection-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      padding-top: max(0.5rem, env(safe-area-inset-top));
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      font: var(--mat-sys-label-large);
      text-align: center;
      z-index: 1100;
      box-shadow: var(--mat-sys-level2);

      @media (prefers-reduced-motion: no-preference) {
        animation: connection-banner-enter 300ms cubic-bezier(0.4, 0, 0.2, 1);
      }
    }
    .connection-banner__copy {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
    }
    .connection-banner__hint {
      font: var(--mat-sys-body-small);
      opacity: 0.9;
    }
    .connection-banner__action {
      min-height: 2.5rem;
      color: inherit;
    }
    @keyframes connection-banner-enter {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,
})
export class ConnectionBannerComponent {
  protected readonly ws = inject(WsConnectionService);

  protected bannerStatusText(): string {
    if (this.ws.state() === 'reconnecting') {
      return $localize`:@@connectionBanner.reconnecting:Verbindung unterbrochen. Reconnect läuft…`;
    }
    return $localize`:@@connectionBanner.disconnected:Keine Verbindung zum Server.`;
  }

  protected bannerReloadHint(): string {
    return $localize`:@@connectionBanner.reloadHint:Wenn das bleibt: Seite neu laden.`;
  }

  protected reconnectNow(): void {
    void this.ws.runManualReconnect();
  }
}
