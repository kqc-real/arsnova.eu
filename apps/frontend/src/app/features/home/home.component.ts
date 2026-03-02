import {
  AfterViewInit,
  Component,
  ComponentRef,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import { ServerStatusWidgetComponent } from '../../shared/server-status-widget/server-status-widget.component';
import { ThemePresetService } from '../../core/theme-preset.service';

/** Host-Anchor für dynamisch geladenes PresetToast (eigener Chunk, bessere Mobile-Performance). */
@Directive({ selector: '[presetToastHost]', standalone: true })
class PresetToastHostDirective {
  constructor(public vcRef: ViewContainerRef) {}
}

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatButton,
    MatIconButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatIcon,
    ServerStatusWidgetComponent,
    PresetToastHostDirective,
  ],
  template: `
    <div class="l-page">
      <ng-container presetToastHost></ng-container>

      @if (presetSnackbarVisible()) {
        <div class="home-snackbar" role="status">
          <span class="home-snackbar__icon-wrap">
            <mat-icon class="home-snackbar__icon">{{ presetSnackbarIcon() }}</mat-icon>
          </span>
          <span class="home-snackbar__text">{{ presetSnackbarLabel() }}</span>
          <button type="button" class="home-snackbar__action" (click)="openPresetCustomize()">Anpassen</button>
          <button type="button" class="home-snackbar__close" (click)="dismissSnackbar()" aria-label="Schließen">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      <header #homeHeader class="home-header" role="banner">
        <div class="home-header__row">
          <div class="home-brand">
            <svg
              class="home-brand__icon"
              viewBox="0 0 32 32"
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="brand-eu-bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="var(--app-eu-blue)" />
                  <stop offset="100%" stop-color="var(--app-eu-blue-dark)" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="6" fill="url(#brand-eu-bg)" />
              <rect x="2" y="2" width="28" height="28" rx="5" fill="var(--app-eu-blue)" />
              <!-- EU-Stern (arsnova-stern-eu): sauber in der Ecke, etwas größer, 1 Spitze oben -->
              <path
                class="home-brand__star"
                d="M23 18 L24.12 21.46 L27.76 21.45 L24.82 23.59 L25.94 27.05 L23 24.91 L20.06 27.05 L21.18 23.59 L18.24 21.45 L21.88 21.46 Z"
                fill="var(--app-eu-yellow)"
              />
            </svg>
            <h1 class="home-brand__title">arsnova<svg class="home-brand__title-star" viewBox="18 18 11 9.05" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="var(--app-eu-yellow)" d="M23 18 L24.12 21.46 L27.76 21.45 L24.82 23.59 L25.94 27.05 L23 24.91 L20.06 27.05 L21.18 23.59 L18.24 21.45 L21.88 21.46 Z"/></svg>eu</h1>
          </div>

          <button
            #controlsToggleBtn
            matIconButton
            class="mobile-only"
            [attr.aria-expanded]="controlsMenuOpen() ? 'true' : 'false'"
            aria-controls="home-controls-mobile"
            aria-label="Einstellungen öffnen"
            (click)="toggleControlsMenu()"
          >
            <mat-icon>menu</mat-icon>
          </button>

          <div class="home-controls desktop-only">
            <mat-button-toggle-group
              [value]="themePreset.preset()"
              appearance="standard"
              aria-label="Preset auswählen"
              class="home-icon-toggles"
            >
              <mat-button-toggle value="serious" (click)="setPreset('serious')">
                <mat-icon>school</mat-icon> Seriös
              </mat-button-toggle>
              <mat-button-toggle value="spielerisch" (click)="setPreset('spielerisch')">
                <mat-icon class="home-preset-icon--playful">celebration</mat-icon> Spielerisch
              </mat-button-toggle>
            </mat-button-toggle-group>

            <mat-button-toggle-group
              [value]="themePreset.theme()"
              (change)="onThemeChange($event.value)"
              appearance="standard"
              aria-label="Theme"
              class="home-icon-toggles"
            >
              <mat-button-toggle value="system" aria-label="System">
                <mat-icon>contrast</mat-icon>
              </mat-button-toggle>
              <mat-button-toggle value="dark" aria-label="Dark">
                <mat-icon>dark_mode</mat-icon>
              </mat-button-toggle>
              <mat-button-toggle value="light" aria-label="Light">
                <mat-icon>light_mode</mat-icon>
              </mat-button-toggle>
            </mat-button-toggle-group>

            <button matIconButton [matMenuTriggerFor]="langMenu" aria-label="Sprache" class="home-icon-btn">
              <mat-icon>language</mat-icon>
            </button>
            <mat-menu #langMenu="matMenu">
              @for (lang of supportedLanguages; track lang.code) {
                <button mat-menu-item (click)="setLanguage(lang.code)">
                  <mat-icon matMenuItemIcon>language</mat-icon>
                  {{ lang.label }}
                </button>
              }
            </mat-menu>
          </div>
        </div>

        @if (controlsMenuOpen()) {
          <div id="home-controls-mobile" class="home-controls-mobile l-stack l-stack--sm">
            <mat-button-toggle-group
              [value]="themePreset.preset()"
              appearance="standard"
              aria-label="Preset auswählen"
              class="home-icon-toggles home-preset-toggle--full"
            >
              <mat-button-toggle value="serious" (click)="setPreset('serious', true)">
                <mat-icon>school</mat-icon> Seriös
              </mat-button-toggle>
              <mat-button-toggle value="spielerisch" (click)="setPreset('spielerisch', true)">
                <mat-icon class="home-preset-icon--playful">celebration</mat-icon> Spielerisch
              </mat-button-toggle>
            </mat-button-toggle-group>

            <mat-button-toggle-group
              [value]="themePreset.theme()"
              (change)="onThemeChange($event.value)"
              appearance="standard"
              aria-label="Theme"
              class="home-icon-toggles home-icon-toggles--full"
            >
              <mat-button-toggle value="system" aria-label="System">
                <mat-icon>contrast</mat-icon>
              </mat-button-toggle>
              <mat-button-toggle value="dark" aria-label="Dark">
                <mat-icon>dark_mode</mat-icon>
              </mat-button-toggle>
              <mat-button-toggle value="light" aria-label="Light">
                <mat-icon>light_mode</mat-icon>
              </mat-button-toggle>
            </mat-button-toggle-group>

            <div class="home-controls-mobile__lang-row">
              <button matIconButton [matMenuTriggerFor]="langMenuMobile" aria-label="Sprache" class="home-icon-btn">
                <mat-icon>language</mat-icon>
              </button>
            </div>
            <mat-menu #langMenuMobile="matMenu">
              @for (lang of supportedLanguages; track lang.code) {
                <button mat-menu-item (click)="setLanguage(lang.code); closeControlsMenu()">
                  <mat-icon matMenuItemIcon>language</mat-icon>
                  {{ lang.label }}
                </button>
              }
            </mat-menu>
          </div>
        }
      </header>

      <main class="home-main">
        <p class="home-hero">Quizzen, abstimmen – gemeinsam und live</p>
        <p class="home-hero-usp">Von Kita bis Uni – seriös oder spielerisch</p>
        @if (themePreset.preset() === 'spielerisch') {
          <p class="home-hero-usp home-hero-usp--secondary">Bonus für die Besten</p>
        }

        <div class="home-hero-preset-mobile" aria-label="Stil wählen">
          <mat-button-toggle-group
            [value]="themePreset.preset()"
            appearance="standard"
            aria-label="Stil auswählen"
            class="home-hero-preset-toggle"
          >
            <mat-button-toggle value="serious" (click)="setPreset('serious')">
              <mat-icon>school</mat-icon>
              Seriös
            </mat-button-toggle>
            <mat-button-toggle value="spielerisch" (click)="setPreset('spielerisch')">
              <mat-icon class="home-preset-icon--playful">celebration</mat-icon>
              Spielerisch
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <div class="home-hero-icons" aria-hidden="true">
          <div class="home-hero-icon"><mat-icon>quiz</mat-icon></div>
          <span class="home-hero-icon-dot"></span>
          <div class="home-hero-icon"><mat-icon>forum</mat-icon></div>
          <span class="home-hero-icon-dot"></span>
          <div class="home-hero-icon"><mat-icon>how_to_vote</mat-icon></div>
        </div>

        <p class="home-trust-badges">Kostenlos · DSGVO-konform · Open Source</p>

        <mat-card appearance="raised" id="participant-entry" class="home-card">
          <mat-card-header>
            <mat-card-subtitle>
              <mat-icon class="home-card__icon">group</mat-icon>
              Mitmachen
            </mat-card-subtitle>
            <mat-card-title class="home-card__title">Dabei sein</mat-card-title>
          </mat-card-header>

          <mat-card-content class="l-stack l-stack--sm">
            @if (recentSessionCodes().length > 0) {
              <p class="home-recent-label">Letzte Sessions</p>
              <div class="home-recent-codes">
                @for (code of recentSessionCodes(); track code) {
                  <button matButton="outlined" class="home-recent-code" (click)="joinSessionByCode(code)">
                    {{ code }}
                  </button>
                }
              </div>
            }

            <div
              class="home-code-segments"
              [class.home-code-segments--focused]="codeInputFocused()"
              [class.home-code-segments--valid]="isValidSessionCode()"
              [class.home-code-segments--shake]="codeShaking()"
              (click)="focusCodeInput()"
            >
              @for (slot of codeSlots; track slot) {
                <span
                  class="home-code-segment"
                  [class.home-code-segment--active]="codeInputFocused() && sessionCode().length === slot"
                  [class.home-code-segment--filled]="sessionCode().length > slot"
                >{{ sessionCode()[slot] }}</span>
              }
              <input
                #sessionCodeInput
                class="home-code-segments__input"
                type="text"
                maxlength="6"
                [value]="sessionCode()"
                (input)="onSessionCodeInput($event)"
                (keydown.enter)="joinSession()"
                (focus)="codeInputFocused.set(true)"
                (blur)="codeInputFocused.set(false)"
                autocapitalize="characters"
                autocomplete="off"
                spellcheck="false"
                aria-label="Session-Code, 6 Zeichen"
              />
            </div>
            <div class="home-code-meta">
              @if (sessionCode().length > 0) {
                <span class="home-code-counter">{{ sessionCode().length }}/6</span>
              }
              <span class="home-code-help">6 Zeichen, z.B. ABC123</span>
            </div>
          </mat-card-content>

          <mat-card-actions class="l-stack l-stack--sm">
            @if (isJoining()) {
              <button matButton="filled" class="home-cta" disabled aria-label="Session beitreten">
                <mat-icon class="home-cta__icon home-spin">sync</mat-icon>
                Verbinde…
              </button>
            } @else {
              <button
                matButton="filled"
                class="home-cta"
                [class.home-cta--ready]="ctaReady()"
                (click)="joinSession()"
                [disabled]="!isValidSessionCode()"
                aria-label="Teilnehmen"
              >
                <mat-icon class="home-cta__icon">login</mat-icon>
                Los geht's
              </button>
            }
            @if (joinError()) {
              <p class="home-error" role="alert">{{ joinError() }}</p>
            }
          </mat-card-actions>
        </mat-card>

        <mat-card appearance="raised" class="home-card home-card--create">
          <mat-card-header>
            <mat-card-subtitle>
              <mat-icon class="home-card__icon">school</mat-icon>
              Veranstalten
            </mat-card-subtitle>
            <mat-card-title class="home-card__title">Quiz starten</mat-card-title>
          </mat-card-header>

          <mat-card-content>
            <div class="home-card__meta">
              <p class="home-card__copy">Quiz, Q&amp;A oder Umfrage in Sekunden</p>
              <a
                matButton
                routerLink="/help"
                class="home-help-btn"
                aria-label="Hilfe öffnen"
              >
                <mat-icon>help</mat-icon>
                Hilfe
              </a>
            </div>
          </mat-card-content>

          <mat-card-actions class="l-stack l-stack--sm">
            <a matButton="filled" routerLink="/quiz" class="home-cta" (mouseenter)="preloadQuiz()">
              <mat-icon class="home-cta__icon">add_circle</mat-icon>
              Neues Quiz starten
            </a>
            <div class="home-cta-row">
              <a matButton="tonal" routerLink="/quiz" class="home-cta home-cta--secondary" (mouseenter)="preloadQuiz()">
                <mat-icon class="home-cta__icon">quiz</mat-icon>
                Aus Bibliothek
              </a>
              <a matButton="tonal" routerLink="/quiz" class="home-cta home-cta--secondary" (mouseenter)="preloadQuiz()">
                <mat-icon class="home-cta__icon">question_answer</mat-icon>
                Fragerunde
              </a>
            </div>
          </mat-card-actions>
        </mat-card>
      </main>

      <section class="home-grid">
        <mat-card appearance="raised">
          <mat-card-header>
            <mat-card-title>
              <mat-icon class="home-card__icon">library_books</mat-icon>
              Quiz-Bibliothek
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="home-subcard__links l-stack l-stack--sm">
              <a matButton routerLink="/quiz" class="home-subcard__link" (mouseenter)="preloadQuiz()">
                <mat-icon class="home-subcard__link-icon">menu_book</mat-icon>
                Quizzes entdecken
              </a>
              <div class="home-subcard__demo-row">
                <a matButton routerLink="/quiz" class="home-subcard__demo-btn" (mouseenter)="preloadQuiz()">
                  <mat-icon class="home-subcard__link-icon">play_circle</mat-icon>
                  Demo starten
                </a>
                <span class="home-subcard__demo-sep">oder</span>
                <a matButton [routerLink]="['/session', demoSessionCode]" class="home-subcard__demo-btn">
                  <mat-icon class="home-subcard__link-icon">group_add</mat-icon>
                  Demo beitreten
                </a>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="raised" class="home-subcard--status">
          <mat-card-header>
            <mat-card-title>
              <mat-icon class="home-card__icon">sensors</mat-icon>
              Status
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (apiStatus()) {
              <p class="home-subcard__body">Verbunden</p>
            } @else {
              <p class="home-subcard__body">Keine Verbindung</p>
              <button matButton="outlined" class="home-retry-btn" (click)="retryConnection()" [disabled]="apiRetrying()">
                {{ apiRetrying() ? 'Verbinde…' : 'Nochmal versuchen' }}
              </button>
            }
            @defer (on viewport) {
              <app-server-status-widget />
            } @placeholder {
              <div class="home-status-placeholder" aria-hidden="true"><span></span></div>
            }
          </mat-card-content>
        </mat-card>
      </section>
    </div>
  `,
  styles: [`
    .home-header {
      position: sticky;
      top: 0;
      z-index: 10;
      margin-bottom: 1.25rem;
      border-radius: var(--mat-sys-corner-extra-large);
      background: var(--mat-sys-surface-container);
      padding: 1rem;
      box-shadow: var(--mat-sys-level1);
      font-size: 0.875rem;
    }

    .home-header__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    @media (min-width: 600px) {
      .home-header__row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 1rem;
      }
      .home-brand { justify-self: start; }
      .home-controls {
        grid-column: 2 / -1;
        display: flex;
        justify-content: space-evenly;
        justify-self: stretch;
      }
    }

    .home-brand {
      --app-eu-blue: #002395;
      --app-eu-blue-dark: #001a75;
      --app-eu-yellow: #ffcc00;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .home-brand__star {
      /* Einziger Stern (Anlehnung EU), kein offizielles Emblem */
    }

    /* Light-Theme: Stern im Titel dunkleres Gold für Lesbarkeit auf hellem Grund; Logo-Stern unverändert */
    :host-context(html.light) .home-brand__title-star path {
      fill: #b38600;
    }

    .home-brand__icon {
      width: 1.75rem;
      height: 1.75rem;
      flex-shrink: 0;
      border-radius: var(--mat-sys-corner-small);
    }

    .home-brand__title {
      margin: 0;
      font-size: 1.375rem;
      line-height: 1.25;
      font-weight: 500;
      font-family: inherit;
    }

    .home-brand__title-star {
      display: inline-block;
      height: 0.52em;
      width: auto;
      vertical-align: baseline;
      margin-inline: 0.05em;
    }

    .mobile-only { display: inline-flex; }
    .desktop-only { display: none; }
    @media (max-width: 599px) { .desktop-only { display: none !important; } }
    @media (min-width: 600px) {
      .mobile-only { display: none; }
      .desktop-only { display: inline-flex; }
    }

    .home-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .home-icon-toggles { border: none; background: transparent; }
    .home-icon-toggles .mat-button-toggle { border: none !important; background: transparent; }
    .home-icon-toggles .mat-button-toggle-checked {
      border: none !important;
      background: color-mix(in srgb, var(--mat-sys-on-surface) 8%, transparent);
    }
    .home-icon-toggles .mat-button-toggle-checked .mat-icon { color: var(--mat-sys-primary); }
    .home-icon-toggles--full { width: 100%; }
    .home-icon-toggles--full .mat-button-toggle { flex: 1; }

    .home-controls-mobile {
      margin-top: 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      padding-top: 1rem;
      align-items: flex-end;
    }

    .home-controls-mobile__lang-row {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .home-preset-toggle--full { width: 100%; }
    .home-preset-toggle--full mat-button-toggle { flex: 1; }

    .home-hero {
      margin: 0 0 0.25rem;
      font: var(--mat-sys-headline-medium);
      color: var(--mat-sys-on-surface);
      text-align: center;
    }

    .home-hero-usp {
      margin: 0 0 0.25rem;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-primary);
      text-align: center;
      font-weight: 500;
      max-width: 28rem;
      margin-inline: auto;
    }

    .home-hero-usp--secondary {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
      margin-bottom: 0.75rem;
      max-width: 26rem;
    }

    @media (min-width: 600px) {
      .home-hero-usp--secondary {
        max-width: 38rem;
      }
    }

    .home-hero-preset-mobile {
      display: none;
      justify-content: center;
      margin: 0 0 0.75rem;
    }

    @media (max-width: 599px) {
      .home-hero-preset-mobile {
        display: flex;
      }
    }

    .home-hero-preset-toggle {
      width: 100%;
      max-width: 20rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      overflow: hidden;
    }

    .home-hero-preset-toggle .mat-button-toggle {
      flex: 1;
      border: none;
    }

    .home-hero-preset-toggle .mat-button-toggle + .mat-button-toggle {
      border-left: 1px solid var(--mat-sys-outline-variant);
    }

    .home-hero-preset-toggle .mat-button-toggle-checked {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    .home-hero-preset-toggle .mat-button-toggle-checked .mat-icon {
      color: var(--mat-sys-primary);
    }

    .home-hero-preset-toggle .mat-button-toggle-group {
      border: none;
      display: flex;
    }

    .home-hero-icons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin: 0.25rem 0;
    }

    .home-hero-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--mat-sys-corner-full);
      background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
      color: var(--mat-sys-primary);
    }

    .home-hero-icon mat-icon {
      font-size: 1.375rem;
      width: 1.375rem;
      height: 1.375rem;
    }

    .home-hero-icon-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 50%;
      background: var(--mat-sys-outline-variant);
    }

    .home-trust-badges {
      margin: 0 0 1.5rem;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }

    .home-snackbar {
      position: fixed;
      bottom: max(1.5rem, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      z-index: 60;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      padding: 0.5rem 0.75rem 0.5rem 0.5rem;
      box-shadow: var(--mat-sys-level3), 0 4px 20px color-mix(in srgb, var(--mat-sys-on-surface) 18%, transparent);
      font: var(--mat-sys-body-medium);
      white-space: nowrap;
      border: 1px solid color-mix(in srgb, var(--mat-sys-inverse-on-surface) 15%, transparent);
    }

    @media (prefers-reduced-motion: no-preference) {
      .home-snackbar {
        animation: home-snackbar-in 0.25s cubic-bezier(0.2, 0, 0, 1);
      }
    }

    .home-snackbar__icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: var(--mat-sys-corner-full);
      background: color-mix(in srgb, var(--mat-sys-inverse-on-surface) 22%, transparent);
    }

    .home-snackbar__icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .home-snackbar__action {
      color: var(--mat-sys-inverse-primary);
      border: none;
      background: none;
      font: var(--mat-sys-label-large);
      cursor: pointer;
      padding: 0.25rem 0.75rem;
      border-radius: var(--mat-sys-corner-small);
    }

    .home-snackbar__action:hover {
      background: color-mix(in srgb, var(--mat-sys-inverse-primary) 12%, transparent);
    }

    .home-snackbar__close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: none;
      color: var(--mat-sys-inverse-on-surface);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: var(--mat-sys-corner-small);
    }

    .home-snackbar__close:hover {
      background: color-mix(in srgb, var(--mat-sys-inverse-on-surface) 12%, transparent);
    }

    .home-snackbar__close mat-icon {
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
    }

    @keyframes home-snackbar-in {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(0.75rem) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
    }

    .home-main { display: grid; gap: 1rem; }

    @media (min-width: 600px) {
      .home-main { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .home-hero, .home-hero-usp, .home-hero-usp--secondary, .home-hero-preset-mobile, .home-hero-icons, .home-trust-badges { grid-column: 1 / -1; }
    }

    .home-card { padding: 0.25rem; box-shadow: var(--mat-sys-level2); }

    @media (max-width: 599px) {
      .home-card#participant-entry {
        border-top: 3px solid var(--mat-sys-primary);
      }
    }
    .home-card--create mat-card-content { padding-top: 0; padding-bottom: 0.5rem; }
    .home-card--create .home-card__meta { gap: 0.5rem; }
    .home-card--create .home-card__copy { margin: 0; }
    .home-card--create mat-card-actions { padding-top: 0.5rem; }

    .home-card__icon {
      vertical-align: middle;
      margin-right: 0.25rem;
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
    }

    .home-card__title { font: var(--mat-sys-display-small); }

    .home-card__meta {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .home-card__meta a { flex-shrink: 0; }
    .home-help-btn { border: none; }

    .home-card__copy {
      margin: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    mat-card-actions.l-stack { display: flex; flex-direction: column; gap: 0.5rem; }
    .home-cta { width: 100%; }

    .home-cta-row {
      display: flex;
      gap: 0.5rem;
      width: 100%;
      min-width: 0;
      margin-top: 1rem;
    }

    .home-cta-row .home-cta--secondary { flex: 1 1 0; min-width: 0; width: auto; }

    @media (min-width: 600px) {
      mat-card-actions.l-stack { flex-direction: row; flex-wrap: wrap; }
      .home-cta { width: auto; flex: 1 1 0; }
      .home-card--create mat-card-actions { flex-direction: column; }
      .home-card--create mat-card-actions > .home-cta { width: 100%; flex: none; }
      .home-card--create .home-cta-row .home-cta--secondary { flex: 1 1 0; width: auto; }
    }

    .home-recent-label {
      margin: 0;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .home-recent-codes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.25rem; }

    .home-recent-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      letter-spacing: 0.1em;
      border: none;
    }

    .home-code-segments {
      position: relative;
      display: flex;
      gap: 0.375rem;
      justify-content: center;
      cursor: text;
      margin-top: 0.5rem;
    }

    .home-code-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 3rem;
      border-radius: var(--mat-sys-corner-medium);
      border: 2px solid var(--mat-sys-outline-variant);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 1.35rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--mat-sys-on-surface);
      background: var(--mat-sys-surface);
      transition: border-color 0.15s, background 0.15s;
    }

    .home-code-segment--active {
      border-color: var(--mat-sys-primary);
      animation: home-segment-pulse 1s ease-in-out infinite;
    }

    .home-code-segment--filled {
      border-color: var(--mat-sys-primary);
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .home-code-segments--focused .home-code-segment {
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
    }

    .home-code-segments--valid .home-code-segment--filled {
      border-color: var(--app-color-success-fg, #4caf50);
      background: color-mix(in srgb, var(--app-color-success-fg, #4caf50) 8%, transparent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--app-color-success-fg, #4caf50) 20%, transparent);
    }

    .home-code-segments--shake {
      animation: home-shake 0.4s ease;
    }

    .home-code-segments--shake .home-code-segment {
      border-color: var(--mat-sys-error);
    }

    .home-code-segments__input {
      position: absolute;
      inset: 0;
      opacity: 0;
      width: 100%;
      height: 100%;
      font-size: 1rem;
      cursor: text;
    }

    @keyframes home-segment-pulse {
      0%, 100% { border-color: var(--mat-sys-primary); }
      50% { border-color: color-mix(in srgb, var(--mat-sys-primary) 40%, transparent); }
    }

    .home-code-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.25rem;
    }

    .home-code-counter {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .home-code-help {
      margin: 0;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
      margin-left: auto;
    }

    @media (min-width: 600px) {
      .home-code-segments { gap: 0.5rem; }
      .home-code-segment { width: 3rem; height: 3.5rem; font-size: 1.5rem; }
    }

    .home-error { margin: 0; color: var(--mat-sys-error); font: var(--mat-sys-body-small); }

    .home-cta--ready {
      animation: home-cta-pulse 0.35s ease;
    }

    .home-spin { animation: home-spin 1s linear infinite; }
    @keyframes home-spin { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: no-preference) {
      @keyframes home-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(2px); }
      }

      @keyframes home-cta-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.04); }
        100% { transform: scale(1); }
      }
    }

    .home-grid mat-card { box-shadow: var(--mat-sys-level2); }
    .home-grid { margin-top: 1rem; display: grid; gap: 0.75rem; }
    @media (min-width: 600px) { .home-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (min-width: 900px) {
      .home-grid {
        max-width: 42rem;
        margin-inline: auto;
      }
    }

    .home-retry-btn { margin-top: 0.5rem; }
    .home-subcard__body { margin: 0; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .home-subcard__links { margin-top: 0.5rem; }
    .home-subcard__demo-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .home-subcard__demo-sep {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .home-subcard__demo-btn {
      justify-content: flex-start;
      white-space: nowrap;
    }

    @media (min-width: 600px) {
      .home-subcard__demo-row { flex-wrap: nowrap; }
    }
    .home-subcard__link { justify-content: flex-start; }
    .home-subcard__link-icon { margin-right: 0.35rem; }
    .home-subcard--status mat-card-content { margin-top: 0.75rem; }
    .home-subcard--status .home-subcard__body { margin-bottom: 0.5rem; }
    .home-status-placeholder { min-height: 2.5rem; display: block; }

    :host-context(html.preset-playful) {
      .home-header {
        background: linear-gradient(135deg, var(--mat-sys-surface-container), var(--mat-sys-tertiary-container));
        border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 40%, transparent);
        box-shadow: var(--app-shadow-accent);
      }
      .home-brand__icon { border-radius: 0.5rem; overflow: visible; }
      @media (prefers-reduced-motion: no-preference) {
        .home-brand__icon {
          transform-origin: center center;
          animation: home-playful-brand-pulse 2s ease-in-out infinite;
        }
        .home-hero-icon {
          transform-origin: center center;
          animation: home-playful-hero-twinkle 2s ease-in-out infinite;
        }
        .home-hero-icon:nth-child(1) { animation-delay: 0s; }
        .home-hero-icon:nth-child(3) { animation-delay: 0.35s; }
        .home-hero-icon:nth-child(5) { animation-delay: 0.7s; }
      }
      .home-card__icon, .home-preset-icon--playful, .home-subcard__link-icon { color: var(--mat-sys-primary); }
      a[matButton="outlined"] .home-cta__icon { color: var(--mat-sys-primary); }
      .home-preset-icon--playful { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; }
      .home-card__icon { transform: scale(1.15); }
      .home-hero-icon {
        background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
      }
      .home-code-segment {
        border-color: color-mix(in srgb, var(--mat-sys-primary) 30%, transparent);
      }
      .home-card--create mat-card-actions .home-cta:first-child { box-shadow: var(--mat-sys-level1), var(--app-shadow-cta-glow); }
      .home-card--create mat-card-actions .home-cta:first-child:hover { box-shadow: var(--mat-sys-level2), var(--app-shadow-cta-glow); }
      .home-grid mat-card, .home-card { box-shadow: var(--mat-sys-level2), var(--app-shadow-card-playful); }
      @media (prefers-reduced-motion: no-preference) {
        .home-main { perspective: 1200px; }
        .home-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          transform-origin: center center;
        }
        .home-card:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: var(--mat-sys-level3), var(--app-shadow-card-playful), 0 0 0 2px color-mix(in srgb, var(--mat-sys-primary) 28%, transparent);
        }
      }
    }
  `],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  @ViewChild('homeHeader') private readonly homeHeader?: ElementRef<HTMLElement>;
  @ViewChild('controlsToggleBtn') private readonly controlsToggleBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('sessionCodeInput') private readonly sessionCodeInput?: ElementRef<HTMLInputElement>;
  @ViewChild(PresetToastHostDirective) private presetToastHost?: PresetToastHostDirective;

  private presetToastRef: ComponentRef<unknown> | null = null;

  apiStatus = signal<string | null>(null);
  apiRetrying = signal(false);
  redisStatus = signal<string | null>(null);
  sessionCode = signal('');
  codeInputFocused = signal(false);
  codeShaking = signal(false);
  ctaReady = signal(false);
  recentSessionCodes = signal<string[]>([]);
  joinError = signal<string | null>(null);
  isJoining = signal(false);

  readonly themePreset = inject(ThemePresetService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly supportedLanguages = [
    { code: 'de' as const, label: 'Deutsch' },
    { code: 'en' as const, label: 'English' },
    { code: 'fr' as const, label: 'Français' },
    { code: 'it' as const, label: 'Italiano' },
    { code: 'es' as const, label: 'Español' },
  ];
  language = signal<'de' | 'en' | 'fr' | 'it' | 'es'>('de');
  controlsMenuOpen = signal(false);
  presetToastVisible = signal(false);
  presetSnackbarVisible = signal(false);
  /** Einmalig beim ersten Wechsel auf Spielerisch: Snackbar-Text „Jetzt mit mehr Schwung!“ */
  firstTimePlayfulMessage = signal(false);

  presetSnackbarIcon = computed(() => this.themePreset.preset() === 'serious' ? 'school' : 'celebration');
  presetSnackbarLabel = computed(() => {
    if (this.firstTimePlayfulMessage() && this.themePreset.preset() === 'spielerisch') {
      return 'Jetzt mit mehr Schwung!';
    }
    return this.themePreset.preset() === 'serious' ? 'Preset: Seriös' : 'Preset: Spielerisch';
  });
  isValidSessionCode = computed(() => /^[A-Z0-9]{6}$/.test(this.sessionCode()));
  readonly demoSessionCode = 'DEMO01';
  readonly codeSlots = [0, 1, 2, 3, 4, 5];

  private snackbarTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    setTimeout(() => this.sessionCodeInput?.nativeElement.focus(), 100);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedLang = localStorage.getItem('home-language');
      if (storedLang && ['de', 'en', 'fr', 'it', 'es'].includes(storedLang)) {
        this.language.set(storedLang as 'de' | 'en' | 'fr' | 'it' | 'es');
      }
      this.loadRecentSessionCodes();
    }
    // Health-Check nach First Paint, damit API-Anfrage den kritischen Lade-Pfad nicht blockiert
    if (isPlatformBrowser(this.platformId)) {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => this.checkApiConnection(), { timeout: 2000 });
      } else {
        setTimeout(() => this.checkApiConnection(), 0);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    if (this.presetToastRef) {
      this.presetToastRef.destroy();
      this.presetToastRef = null;
    }
  }

  async checkApiConnection(): Promise<void> {
    try {
      const health = await trpc.health.check.query();
      this.apiStatus.set(health.status);
      this.redisStatus.set(health.redis ?? null);
    } catch {
      this.apiStatus.set(null);
    }
  }

  async retryConnection(): Promise<void> {
    this.apiRetrying.set(true);
    await this.checkApiConnection();
    this.apiRetrying.set(false);
  }

  private loadRecentSessionCodes(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem('home-recent-sessions');
      const codes = raw ? (JSON.parse(raw) as string[]) : [];
      const valid = Array.isArray(codes)
        ? codes.filter((c) => typeof c === 'string' && /^[A-Z0-9]{6}$/.test(c.trim().toUpperCase())).slice(0, 3)
        : [];
      this.recentSessionCodes.set(valid);
    } catch {
      this.recentSessionCodes.set([]);
    }
  }

  private addToRecentSessionCodes(code: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) return;
    const current = this.recentSessionCodes();
    const filtered = current.filter((c) => c !== normalized);
    const updated = [normalized, ...filtered].slice(0, 3);
    this.recentSessionCodes.set(updated);
    localStorage.setItem('home-recent-sessions', JSON.stringify(updated));
  }

  async joinSessionByCode(code: string): Promise<void> {
    this.sessionCode.set(code);
    await this.joinSession();
  }

  setLanguage(code: 'de' | 'en' | 'fr' | 'it' | 'es'): void {
    this.language.set(code);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('home-language', code);
    }
    setTimeout(() => this.sessionCodeInput?.nativeElement.focus(), 0);
  }

  onThemeChange(value: 'system' | 'dark' | 'light'): void {
    this.themePreset.setTheme(value);
    this.closeControlsMenu();
    setTimeout(() => this.sessionCodeInput?.nativeElement.focus(), 0);
  }

  setPreset(value: string | null, closeMenu = false): void {
    const nextPreset = value === 'serious' || value === 'spielerisch' ? value : null;
    if (nextPreset) {
      if (this.themePreset.preset() !== nextPreset) {
        this.themePreset.setPreset(nextPreset);
      }
      this.showPresetSnackbar();
      // Fokus zurück auf die Mitmach-Karte (Code-Eingabe), damit der Fokus nach Umschaltung nicht verloren geht
      setTimeout(() => this.sessionCodeInput?.nativeElement.focus(), 0);
    }
    if (closeMenu) this.closeControlsMenu();
  }

  private static readonly STORAGE_PLAYFUL_WELCOMED = 'home-playful-welcomed';

  private showPresetSnackbar(): void {
    const isPlayful = this.themePreset.preset() === 'spielerisch';
    const firstTime = isPlatformBrowser(this.platformId) && isPlayful && !localStorage.getItem(HomeComponent.STORAGE_PLAYFUL_WELCOMED);
    this.firstTimePlayfulMessage.set(firstTime);
    if (firstTime && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(HomeComponent.STORAGE_PLAYFUL_WELCOMED, '1');
    }
    this.presetSnackbarVisible.set(true);
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    const duration = firstTime ? 6000 : 5000;
    this.snackbarTimer = setTimeout(() => {
      this.presetSnackbarVisible.set(false);
      this.firstTimePlayfulMessage.set(false);
    }, duration);
  }

  dismissSnackbar(): void {
    this.presetSnackbarVisible.set(false);
    this.firstTimePlayfulMessage.set(false);
    if (this.snackbarTimer) { clearTimeout(this.snackbarTimer); this.snackbarTimer = null; }
  }

  openPresetCustomize(): void {
    this.dismissSnackbar();
    this.presetToastVisible.set(true);
    setTimeout(() => this.loadPresetToast(), 0);
  }

  closePresetToast(): void {
    if (this.presetToastRef) {
      this.presetToastRef.destroy();
      this.presetToastRef = null;
    }
    this.presetToastVisible.set(false);
    setTimeout(() => this.sessionCodeInput?.nativeElement.focus(), 0);
  }

  private loadPresetToast(): void {
    if (this.presetToastRef || !this.presetToastHost) return;
    import('../../shared/preset-toast/preset-toast.component').then((m) => {
      if (!this.presetToastHost || this.presetToastRef) return;
      const ref = this.presetToastHost.vcRef.createComponent(m.PresetToastComponent);
      (ref.instance as { closed: { subscribe: (fn: () => void) => void } }).closed.subscribe(() =>
        this.closePresetToast(),
      );
      this.presetToastRef = ref;
    });
  }

  focusCodeInput(): void {
    this.sessionCodeInput?.nativeElement.focus();
  }

  private triggerShake(): void {
    this.codeShaking.set(true);
    setTimeout(() => this.codeShaking.set(false), 400);
  }

  private triggerCtaPulse(): void {
    this.ctaReady.set(false);
    requestAnimationFrame(() => this.ctaReady.set(true));
    setTimeout(() => this.ctaReady.set(false), 350);
  }

  toggleControlsMenu(): void {
    this.controlsMenuOpen.set(!this.controlsMenuOpen());
  }

  preloadQuiz(): void {
    import('../quiz/quiz.component').then(() => {});
  }

  closeControlsMenu(restoreFocus = false): void {
    this.controlsMenuOpen.set(false);
    if (restoreFocus) {
      setTimeout(() => this.controlsToggleBtn?.nativeElement.focus(), 0);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.presetToastVisible()) {
      this.closePresetToast();
      return;
    }
    if (this.controlsMenuOpen()) {
      this.closeControlsMenu(true);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (this.isValidSessionCode()) this.joinSession();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.controlsMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    const insideHeader = this.homeHeader?.nativeElement.contains(target) ?? false;
    if (!insideHeader) {
      this.closeControlsMenu();
    }
  }

  onSessionCodeInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const prev = this.sessionCode();
    const normalized = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    this.sessionCode.set(normalized);
    this.joinError.set(null);
    if (normalized.length === 6 && prev.length < 6) {
      this.triggerCtaPulse();
    }
  }

  async joinSession(): Promise<void> {
    if (this.isJoining()) return;
    const code = this.sessionCode().trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      this.joinError.set('Bitte den 6-stelligen Code eingeben.');
      this.triggerShake();
      this.sessionCodeInput?.nativeElement.focus();
      return;
    }
    this.joinError.set(null);
    this.isJoining.set(true);
    this.addToRecentSessionCodes(code);
    try {
      await this.router.navigate(['/session', code]);
    } finally {
      this.isJoining.set(false);
    }
  }
}
