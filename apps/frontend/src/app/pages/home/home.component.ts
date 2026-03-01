import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../trpc.client';
import { ServerStatusWidgetComponent } from '../../components/server-status-widget/server-status-widget.component';
import { PresetToastComponent } from '../../components/preset-toast/preset-toast.component';
import { ThemePresetService } from '../../services/theme-preset.service';

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
    MatFormField,
    MatLabel,
    MatInput,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatIcon,
    ServerStatusWidgetComponent,
    PresetToastComponent,
  ],
  template: `
    <div class="l-page">
      @if (presetToastVisible()) {
        <app-preset-toast (closed)="presetToastVisible.set(false)" />
      }

      @if (presetSnackbarVisible()) {
        <div class="home-snackbar" role="status">
          <mat-icon class="home-snackbar__icon">{{ presetSnackbarIcon() }}</mat-icon>
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
            <svg class="home-brand__icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <linearGradient id="brand-fg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="var(--mat-sys-primary)" />
                  <stop offset="100%" stop-color="var(--mat-sys-tertiary)" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="6" fill="url(#brand-fg)" />
              <rect x="2" y="2" width="28" height="28" rx="5" fill="var(--mat-sys-surface)" />
              <circle cx="24" cy="22" r="4" fill="var(--mat-sys-primary)" />
            </svg>
            <h1 class="home-brand__title">arsnova.click</h1>
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

            <button matIconButton [matMenuTriggerFor]="langMenuMobile" aria-label="Sprache" class="home-icon-btn">
              <mat-icon>language</mat-icon>
            </button>
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
        <p class="home-hero">Live-Quiz, Q&A und Abstimmung – mit wenigen Klicks</p>

        <div class="home-hero-icons" aria-hidden="true">
          <div class="home-hero-icon"><mat-icon>quiz</mat-icon></div>
          <span class="home-hero-icon-dot"></span>
          <div class="home-hero-icon"><mat-icon>forum</mat-icon></div>
          <span class="home-hero-icon-dot"></span>
          <div class="home-hero-icon"><mat-icon>how_to_vote</mat-icon></div>
        </div>

        <p class="home-trust-badges">100 % DSGVO-konform · Open Source · kostenlos</p>

        @if (showOnboarding()) {
          <div class="home-onboarding">
            <div class="home-onboarding__step">
              <div class="home-onboarding__icon"><mat-icon>add_circle</mat-icon></div>
              <span class="home-onboarding__label">Quiz erstellen</span>
            </div>
            <mat-icon class="home-onboarding__arrow">chevron_right</mat-icon>
            <div class="home-onboarding__step">
              <div class="home-onboarding__icon"><mat-icon>share</mat-icon></div>
              <span class="home-onboarding__label">Code teilen</span>
            </div>
            <mat-icon class="home-onboarding__arrow">chevron_right</mat-icon>
            <div class="home-onboarding__step">
              <div class="home-onboarding__icon"><mat-icon>play_circle</mat-icon></div>
              <span class="home-onboarding__label">Live spielen</span>
            </div>
            <button matIconButton class="home-onboarding__close" (click)="dismissOnboarding()" aria-label="Hinweis schließen">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        <mat-card appearance="raised" id="participant-entry" class="home-card">
          <mat-card-header>
            <mat-card-subtitle>
              <mat-icon class="home-card__icon">group</mat-icon>
              Teilnehmer/in
            </mat-card-subtitle>
            <mat-card-title class="home-card__title">Beitreten</mat-card-title>
          </mat-card-header>

          <mat-card-content class="l-stack l-stack--sm">
            @if (recentSessionCodes().length > 0) {
              <p class="home-recent-label">Zuletzt beigetreten</p>
              <div class="home-recent-codes">
                @for (code of recentSessionCodes(); track code) {
                  <button matButton="outlined" class="home-recent-code" (click)="joinSessionByCode(code)">
                    {{ code }}
                  </button>
                }
              </div>
            }
            <p class="home-code-help">Großbuchstaben und Zahlen, 6 Zeichen</p>

            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="home-code-field">
              <mat-label>Session-Code</mat-label>
              <input
                #sessionCodeInput
                matInput
                maxlength="6"
                [value]="sessionCode()"
                (input)="onSessionCodeInput($event)"
                (keydown.enter)="joinSession()"
                autocapitalize="characters"
                autocomplete="off"
                spellcheck="false"
              />
            </mat-form-field>
          </mat-card-content>

          <mat-card-actions class="l-stack l-stack--sm">
            @if (isJoining()) {
              <button matButton="filled" class="home-cta" disabled aria-label="Session beitreten">
                <mat-icon class="home-cta__icon home-spin">sync</mat-icon>
                Beitreten…
              </button>
            } @else {
              <button
                matButton="filled"
                class="home-cta"
                (click)="joinSession()"
                [disabled]="!isValidSessionCode()"
                aria-label="Session beitreten"
              >
                <mat-icon class="home-cta__icon">login</mat-icon>
                Beitreten
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
              Lehrperson
            </mat-card-subtitle>
            <mat-card-title class="home-card__title">Erstellen</mat-card-title>
          </mat-card-header>

          <mat-card-content>
            <div class="home-card__meta">
              <p class="home-card__copy">Starten Sie eine Quiz-Session oder Q&amp;A-Runde.</p>
              <a
                matButton
                class="home-help-btn"
                href="https://github.com/arsnova-dev/arsnova-click-v3/blob/main/docs/onboarding.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                <mat-icon>help</mat-icon>
                Hilfe
              </a>
            </div>
          </mat-card-content>

          <mat-card-actions class="l-stack l-stack--sm">
            <a matButton="filled" routerLink="/quiz" class="home-cta" (mouseenter)="preloadQuiz()">
              <mat-icon class="home-cta__icon">add_circle</mat-icon>
              Session erstellen
            </a>
            <a matButton routerLink="/quiz" class="home-cta" (mouseenter)="preloadQuiz()">
              <mat-icon class="home-cta__icon">quiz</mat-icon>
              Quiz auswählen
            </a>
            <a matButton routerLink="/quiz" class="home-cta" (mouseenter)="preloadQuiz()">
              <mat-icon class="home-cta__icon">question_answer</mat-icon>
              Q&amp;A
            </a>
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
                Bibliothek öffnen
              </a>
              <a matButton routerLink="/quiz" class="home-subcard__link" (mouseenter)="preloadQuiz()">
                <mat-icon class="home-subcard__link-icon">content_copy</mat-icon>
                Neues Quiz aus Vorlage
              </a>
              <div class="home-subcard__demo l-stack l-stack--sm">
                <a matButton routerLink="/quiz" class="home-subcard__demo-btn" (mouseenter)="preloadQuiz()">
                  <mat-icon class="home-subcard__link-icon">play_circle</mat-icon>
                  Demo starten
                </a>
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
              <p class="home-subcard__body">Server erreichbar</p>
            } @else {
              <p class="home-subcard__body">Server nicht erreichbar</p>
              <button matButton="outlined" class="home-retry-btn" (click)="retryConnection()" [disabled]="apiRetrying()">
                {{ apiRetrying() ? 'Verbinde…' : 'Erneut verbinden' }}
              </button>
            }
            <app-server-status-widget />
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
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .home-brand__icon {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: var(--mat-sys-corner-small);
    }

    .home-brand__title {
      margin: 0;
      font-size: 1.375rem;
      line-height: 1.25;
      font-weight: 500;
      font-family: inherit;
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

    .home-preset-toggle--full { width: 100%; }
    .home-preset-toggle--full mat-button-toggle { flex: 1; }

    .home-hero {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-headline-medium);
      color: var(--mat-sys-on-surface);
      text-align: center;
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

    .home-onboarding {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1rem 2.5rem 1rem 1rem;
      border-radius: var(--mat-sys-corner-large);
      background: color-mix(in srgb, var(--mat-sys-primary) 6%, var(--mat-sys-surface));
      border: 1px solid var(--mat-sys-outline-variant);
    }

    .home-onboarding__step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      text-align: center;
    }

    .home-onboarding__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .home-onboarding__icon mat-icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .home-onboarding__label {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface);
    }

    .home-onboarding__arrow {
      color: var(--mat-sys-outline);
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .home-onboarding__close {
      position: absolute;
      top: 0.25rem;
      right: 0.25rem;
    }

    @media (max-width: 599px) {
      .home-onboarding { gap: 0.5rem; padding: 0.75rem 2rem 0.75rem 0.75rem; }
      .home-onboarding__icon { width: 2rem; height: 2rem; }
      .home-onboarding__icon mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
      .home-onboarding__label { font: var(--mat-sys-label-small); }
    }

    .home-snackbar {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 60;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      padding: 0.5rem 0.5rem 0.5rem 1rem;
      box-shadow: var(--mat-sys-level3);
      font: var(--mat-sys-body-medium);
      white-space: nowrap;
      animation: home-snackbar-in 0.2s ease-out;
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
      from { opacity: 0; transform: translateX(-50%) translateY(0.5rem); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .home-main { display: grid; gap: 1rem; }

    @media (min-width: 600px) {
      .home-main { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .home-hero, .home-hero-icons, .home-trust-badges, .home-onboarding { grid-column: 1 / -1; }
    }

    .home-card { padding: 0.25rem; box-shadow: var(--mat-sys-level2); }
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

    @media (min-width: 600px) {
      mat-card-actions.l-stack { flex-direction: row; flex-wrap: wrap; }
      .home-cta { width: auto; flex: 1 1 0; }
      .home-card--create mat-card-actions { flex-direction: column; }
      .home-card--create mat-card-actions .home-cta { width: 100%; flex: none; }
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

    .home-code-help { margin: 0; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .home-code-field { width: 100%; margin-top: 0.75rem; }

    .home-code-field input {
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.25em;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      font-size: 1.1rem;
      caret-color: var(--mat-sys-primary);
    }

    .home-code-field input::placeholder {
      text-transform: none;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      letter-spacing: normal;
      font-weight: normal;
    }

    @media (min-width: 600px) {
      .home-code-field input { font-size: 1.2rem; letter-spacing: 0.35em; }
    }

    .home-error { margin: 0; color: var(--mat-sys-error); font: var(--mat-sys-body-small); }

    .home-spin { animation: home-spin 1s linear infinite; }
    @keyframes home-spin { to { transform: rotate(360deg); } }

    .home-grid mat-card { box-shadow: var(--mat-sys-level2); }
    .home-grid { margin-top: 1rem; display: grid; gap: 0.75rem; }
    @media (min-width: 600px) { .home-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (min-width: 1200px) { .home-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

    .home-retry-btn { margin-top: 0.5rem; }
    .home-subcard__body { margin: 0; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .home-subcard__links { margin-top: 0.5rem; }
    .home-subcard__demo { margin-top: 0; padding-top: 0; }
    .home-subcard__demo-btn { justify-content: flex-start; }
    .home-subcard__link { justify-content: flex-start; }
    .home-subcard__link-icon { margin-right: 0.35rem; }
    .home-subcard--status mat-card-content { margin-top: 0.75rem; }
    .home-subcard--status .home-subcard__body { margin-bottom: 0.5rem; }

    :host-context(html.preset-playful) {
      .home-header {
        background: linear-gradient(135deg, var(--mat-sys-surface-container), var(--mat-sys-tertiary-container));
        border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 40%, transparent);
        box-shadow: var(--app-shadow-accent);
      }
      .home-brand__icon { border-radius: 0.5rem; overflow: visible; }
      .home-card__icon, .home-preset-icon--playful, .home-subcard__link-icon { color: var(--mat-sys-primary); }
      a[matButton="outlined"] .home-cta__icon { color: var(--mat-sys-primary); }
      .home-preset-icon--playful { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; }
      .home-card__icon { transform: scale(1.15); }
      .home-hero-icon {
        background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
      }
      .home-onboarding {
        background: color-mix(in srgb, var(--mat-sys-tertiary-container) 30%, var(--mat-sys-surface));
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
          box-shadow: var(--mat-sys-level3), var(--app-shadow-card-playful);
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

  apiStatus = signal<string | null>(null);
  apiRetrying = signal(false);
  redisStatus = signal<string | null>(null);
  sessionCode = signal('');
  recentSessionCodes = signal<string[]>([]);
  joinError = signal<string | null>(null);
  isJoining = signal(false);

  readonly themePreset = inject(ThemePresetService);
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
  showOnboarding = signal(false);

  presetSnackbarIcon = computed(() => this.themePreset.preset() === 'serious' ? 'school' : 'celebration');
  presetSnackbarLabel = computed(() => this.themePreset.preset() === 'serious' ? 'Preset: Seriös' : 'Preset: Spielerisch');
  isValidSessionCode = computed(() => /^[A-Z0-9]{6}$/.test(this.sessionCode()));
  readonly demoSessionCode = 'DEMO01';

  private snackbarTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    setTimeout(() => this.sessionCodeInput?.nativeElement.focus(), 100);
  }

  async ngOnInit(): Promise<void> {
    const storedLang = localStorage.getItem('home-language');
    if (storedLang && ['de', 'en', 'fr', 'it', 'es'].includes(storedLang)) {
      this.language.set(storedLang as 'de' | 'en' | 'fr' | 'it' | 'es');
    }
    if (!localStorage.getItem('home-visited')) {
      this.showOnboarding.set(true);
    }
    this.loadRecentSessionCodes();
    await this.checkApiConnection();
  }

  ngOnDestroy(): void {
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
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
    localStorage.setItem('home-language', code);
  }

  onThemeChange(value: 'system' | 'dark' | 'light'): void {
    this.themePreset.setTheme(value);
    this.closeControlsMenu();
  }

  setPreset(value: string | null, closeMenu = false): void {
    const nextPreset = value === 'serious' || value === 'spielerisch' ? value : null;
    if (nextPreset) {
      if (this.themePreset.preset() !== nextPreset) {
        this.themePreset.setPreset(nextPreset);
      }
      this.showPresetSnackbar();
    }
    if (closeMenu) this.closeControlsMenu();
  }

  private showPresetSnackbar(): void {
    this.presetSnackbarVisible.set(true);
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    this.snackbarTimer = setTimeout(() => this.presetSnackbarVisible.set(false), 5000);
  }

  dismissSnackbar(): void {
    this.presetSnackbarVisible.set(false);
    if (this.snackbarTimer) { clearTimeout(this.snackbarTimer); this.snackbarTimer = null; }
  }

  openPresetCustomize(): void {
    this.dismissSnackbar();
    this.presetToastVisible.set(true);
  }

  dismissOnboarding(): void {
    this.showOnboarding.set(false);
    localStorage.setItem('home-visited', '1');
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
    const normalized = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    this.sessionCode.set(normalized);
    this.joinError.set(null);
  }

  async joinSession(): Promise<void> {
    if (this.isJoining()) return;
    const code = this.sessionCode().trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      this.joinError.set('Bitte einen gültigen 6-stelligen Code eingeben.');
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
