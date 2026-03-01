import { Component, HostListener, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ThemePresetService } from './services/theme-preset.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatButton, MatIcon],
  template: `
    <div class="app-layout">
      @if (!isOnline()) {
        <div class="app-offline-banner" role="alert">
          <mat-icon class="app-offline-banner__icon">cloud_off</mat-icon>
          <span>Offline. Verbindung prüfen.</span>
          <button matButton class="app-offline-banner__retry" (click)="retryOnline()" aria-label="Verbindung erneut prüfen">
            Nochmal versuchen
          </button>
        </div>
      }
      <a href="#main-content" class="app-skip-link">Zum Inhalt springen</a>
      <main id="main-content" class="app-main" role="main">
        <router-outlet />
      </main>
      <footer class="app-footer" role="contentinfo">
        <div class="app-footer__inner">
          <div class="app-footer__row">
            <span class="app-footer__copy">© {{ year }} arsnova.click</span>
            <div class="app-footer__links">
              <a matButton routerLink="/legal/imprint">
                <mat-icon class="app-footer__icon">business</mat-icon>
                Impressum
              </a>
              <a matButton routerLink="/legal/privacy">
                <mat-icon class="app-footer__icon">privacy_tip</mat-icon>
                Datenschutz
              </a>
            </div>
          </div>
          <p class="app-footer__badges">Kostenlos · 100 % DSGVO-konform · Open Source</p>
        </div>
      </footer>
    </div>
    `,
  styles: [`
    .app-layout {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .app-main {
      flex: 1;
    }

    .app-skip-link {
      position: absolute;
      top: -100px;
      left: 0.5rem;
      z-index: 100;
      padding: 0.5rem 1rem;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font: var(--mat-sys-label-large);
      border-radius: var(--mat-sys-corner-small);
      text-decoration: none;
      transition: top 0.2s;
    }

    .app-skip-link:focus,
    .app-skip-link:focus-visible {
      top: 0.5rem;
      outline: 2px solid var(--mat-sys-on-primary);
      outline-offset: 2px;
    }

    .app-footer {
      margin-top: 2rem;
      padding: 1.25rem 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
    }

    .app-offline-banner {
      position: sticky;
      top: 0;
      z-index: 80;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      font: var(--mat-sys-label-medium);
    }

    .app-offline-banner__icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .app-offline-banner__retry {
      margin-left: 0.5rem;
      color: var(--mat-sys-on-error-container);
    }

    .app-footer__inner {
      max-width: 56rem;
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .app-footer__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.5rem 0.75rem;
    }

    .app-footer__row .app-footer__links {
      flex-shrink: 0;
    }

    .app-footer__badges {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
      margin: 0;
    }

    @media (min-width: 600px) {
      .app-footer__inner {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-between;
      }
      .app-footer__row {
        flex-wrap: nowrap;
        justify-content: flex-start;
        gap: 1rem;
      }
    }

    .app-footer__copy {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .app-footer__links {
      display: flex;
      gap: 0.5rem;
    }

    .app-footer a {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .app-footer__icon {
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
      margin-right: 0.35rem;
    }
  `],
})
export class AppComponent implements OnInit {
  readonly year = new Date().getFullYear();
  isOnline = signal(true);

  private readonly platformId = inject(PLATFORM_ID);

  constructor(private readonly themePreset: ThemePresetService) {}

  ngOnInit(): void {
    void this.themePreset; // Nur injizieren, damit Theme/Preset beim App-Start aus localStorage angewendet werden
    if (isPlatformBrowser(this.platformId)) this.isOnline.set(navigator.onLine);
  }

  @HostListener('window:online')
  onOnline(): void {
    this.isOnline.set(true);
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.isOnline.set(false);
  }

  retryOnline(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (navigator.onLine) {
      this.isOnline.set(true);
    } else {
      window.location.reload();
    }
  }
}
