/**
 * Banner bei WebSocket-Verbindungsabbruch (Story 4.3).
 * Zeigt Hinweis + automatischer Reconnect-Status.
 */
import { Component, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { WsConnectionService } from '../../core/ws-connection.service';

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  imports: [MatIcon],
  template: `
    @if (ws.disconnected()) {
      <div class="connection-banner" role="alert" aria-live="assertive">
        <mat-icon>wifi_off</mat-icon>
        <span>
          @if (ws.state() === 'reconnecting') {
            Verbindung unterbrochen – Reconnect läuft…
          } @else {
            Keine Verbindung zum Server
          }
        </span>
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
    @keyframes connection-banner-enter {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `,
})
export class ConnectionBannerComponent {
  protected readonly ws = inject(WsConnectionService);
}
