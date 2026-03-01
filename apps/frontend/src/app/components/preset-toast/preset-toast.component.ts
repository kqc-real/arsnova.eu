import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatOption } from '@angular/material/core';
import { MatFormField } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatSelect, MatSelectTrigger } from '@angular/material/select';
import { NicknameThemeEnum, type NicknameTheme } from '@arsnova/shared-types';
import { ThemePresetService } from '../../services/theme-preset.service';

const PRESET_OPTIONS_STORAGE_PREFIX = 'home-preset-options-';

const PRESET_CATEGORIES = [
  { id: 'gamification', label: 'Spiel & Auswertung', order: 0 },
  { id: 'participation', label: 'Teilnahme & Namen', order: 1 },
  { id: 'flow', label: 'Ablauf & Zeit', order: 2 },
  { id: 'team', label: 'Team', order: 3 },
  { id: 'audio', label: 'Ton & Musik', order: 4 },
] as const;

type CategoryId = (typeof PRESET_CATEGORIES)[number]['id'];

export const PRESET_OPTION_IDS = [
  { id: 'showLeaderboard', label: 'Rangliste mit Punkten und Plätzen', icon: 'leaderboard', categoryId: 'gamification' as CategoryId },
  { id: 'enableRewardEffects', label: 'Effekte bei richtiger Antwort', icon: 'auto_awesome', categoryId: 'gamification' as CategoryId },
  { id: 'enableMotivationMessages', label: 'Anfeuerung nach jeder Antwort', icon: 'campaign', categoryId: 'gamification' as CategoryId },
  { id: 'enableEmojiReactions', label: 'Emoji-Reaktionen', icon: 'emoji_emotions', categoryId: 'gamification' as CategoryId },
  { id: 'bonusTokenCount', label: 'Bonus-Token für Top-Plätze', icon: 'emoji_events', categoryId: 'gamification' as CategoryId },
  { id: 'defaultTimer', label: 'Zeitlimit pro Frage', icon: 'timer', categoryId: 'flow' as CategoryId },
  { id: 'readingPhaseEnabled', label: 'Zuerst lesen, dann antworten', icon: 'menu_book', categoryId: 'flow' as CategoryId },
  { id: 'teamMode', label: 'In Teams spielen', icon: 'groups', categoryId: 'team' as CategoryId },
  { id: 'teamAssignment', label: 'Teams automatisch oder manuell zuweisen', icon: 'shuffle', categoryId: 'team' as CategoryId },
  { id: 'enableSoundEffects', label: 'Sounds bei Aktionen', icon: 'volume_up', categoryId: 'audio' as CategoryId },
  { id: 'backgroundMusic', label: 'Hintergrundmusik in der Lobby', icon: 'music_note', categoryId: 'audio' as CategoryId },
] as const;

export const NICKNAME_THEME_OPTIONS: { value: NicknameTheme; label: string; icon: string }[] = [
  { value: 'NOBEL_LAUREATES', label: 'Nobelpreisträger', icon: 'military_tech' },
  { value: 'KINDERGARTEN', label: 'Kindergarten', icon: 'child_care' },
  { value: 'PRIMARY_SCHOOL', label: 'Grundschule', icon: 'abc' },
  { value: 'MIDDLE_SCHOOL', label: 'Mittelstufe', icon: 'calculate' },
  { value: 'HIGH_SCHOOL', label: 'Oberstufe', icon: 'school' },
];

export const TEAM_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: `${n} Teams` }));

export type NameMode = 'nicknameTheme' | 'allowCustomNicknames' | 'anonymousMode';

export const NAME_MODE_OPTIONS: { value: NameMode; label: string; icon: string }[] = [
  { value: 'nicknameTheme', label: 'Nicks', icon: 'theater_comedy' },
  { value: 'allowCustomNicknames', label: 'Eigen', icon: 'edit' },
  { value: 'anonymousMode', label: 'Anonym', icon: 'visibility_off' },
];

export type PresetOptionState = Record<string, boolean>;

export function getPresetDefaults(preset: 'serious' | 'spielerisch'): PresetOptionState {
  const base: PresetOptionState = {};
  for (const o of PRESET_OPTION_IDS) {
    base[o.id] = false;
  }
  if (preset === 'serious') {
    base['readingPhaseEnabled'] = true;
    base['defaultTimer'] = false;
  } else {
    base['showLeaderboard'] = true;
    base['defaultTimer'] = true;
    base['enableSoundEffects'] = true;
    base['enableRewardEffects'] = true;
    base['enableMotivationMessages'] = true;
    base['enableEmojiReactions'] = true;
    base['readingPhaseEnabled'] = false;
  }
  return base;
}

@Component({
  selector: 'app-preset-toast',
  imports: [
    FormsModule,
    MatButton,
    MatIconButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatChip,
    MatChipSet,
    MatFormField,
    MatIcon,
    MatOption,
    MatSelect,
    MatSelectTrigger,
  ],
  template: `
    <div class="preset-toast-backdrop" (click)="closed.emit()">
      <div class="preset-toast" [class.preset-toast--playful]="themePreset.preset() === 'spielerisch'" (click)="$event.stopPropagation()">
      <div class="preset-toast__scroll">
        <div class="preset-toast__head">
          <div class="preset-toast__head-accent"></div>
          <div class="preset-toast__head-text">
            <p class="preset-toast__title">
              <span class="preset-toast__title-icon-wrap">
                <mat-icon class="preset-toast__title-icon">{{ toastIcon() }}</mat-icon>
              </span>
              {{ toastTitle() }}
            </p>
            <p class="preset-toast__preset-hint">{{ toastHint() }}</p>
            <button type="button" class="preset-toast__switch-preset" (click)="switchPreset()">
              <mat-icon class="preset-toast__switch-icon">swap_horiz</mat-icon>
              Zu {{ themePreset.preset() === 'serious' ? 'Spielerisch' : 'Seriös' }} wechseln
            </button>
          </div>
          <button matIconButton type="button" class="preset-toast__close" aria-label="Einstellungen schließen" (click)="closed.emit()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <p class="preset-toast__subtitle">Tippen zum An- oder Ausschalten. Mit „Speichern“ übernehmen.</p>
        <div class="preset-toast__categories">
          @for (group of optionsByCategory(); track group.categoryId) {
            <div class="preset-toast__category">
              <p class="preset-toast__category-label">{{ group.categoryLabel }}</p>
              @if (group.categoryId === 'participation') {
                <mat-button-toggle-group
                  [value]="nameMode()"
                  (change)="setNameMode($event.value)"
                  class="preset-toast__name-mode"
                  aria-label="Namensmodus wählen"
                >
                  @for (mode of nameModeOptions; track mode.value) {
                    <mat-button-toggle [value]="mode.value">
                      <mat-icon class="preset-toast__chip-icon">{{ mode.icon }}</mat-icon>
                      {{ mode.label }}
                    </mat-button-toggle>
                  }
                </mat-button-toggle-group>
              }
              <mat-chip-set class="preset-toast__chips">
                @for (opt of group.options; track opt.id) {
                  @if (isOptionVisible(opt.id)) {
                  <mat-chip
                    [highlighted]="optionEffective(opt.id)"
                    (click)="toggleOption(opt.id)"
                    [class.preset-toast__chip--disabled]="isOptionDisabled(opt.id)"
                    role="button"
                    [attr.tabindex]="isOptionDisabled(opt.id) ? -1 : 0"
                    [attr.aria-pressed]="optionEffective(opt.id)"
                    [attr.aria-disabled]="isOptionDisabled(opt.id)"
                    [attr.aria-label]="opt.label + (optionEffective(opt.id) ? ' an' : ' aus') + (isOptionDisabled(opt.id) ? ', deaktiviert' : '')"
                    class="preset-toast__chip"
                  >
                    <mat-icon class="preset-toast__chip-icon">{{ opt.icon }}</mat-icon>
                    {{ opt.label }} {{ optionEffective(opt.id) ? 'an' : 'aus' }}
                  </mat-chip>
                  }
                }
              </mat-chip-set>
              @if (group.categoryId === 'participation' && nameMode() === 'nicknameTheme') {
                <div class="preset-toast__nickname-theme">
                  <span class="preset-toast__nickname-theme-label">Altersgruppe:</span>
                  <mat-form-field appearance="outline" class="preset-toast__nickname-theme-select">
                    <mat-select
                      [(ngModel)]="nicknameThemeSelectValue"
                      aria-label="Altersgruppe wählen"
                    >
                      <mat-select-trigger>
                        <mat-icon class="preset-toast__option-icon">{{ selectedNicknameTheme().icon }}</mat-icon>
                        {{ selectedNicknameTheme().label }}
                      </mat-select-trigger>
                      @for (item of nicknameThemeOptions; track item.value) {
                        <mat-option [value]="item.value">
                          <mat-icon class="preset-toast__option-icon">{{ item.icon }}</mat-icon>
                          {{ item.label }}
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              }
              @if (group.categoryId === 'team' && optionEffective('teamMode')) {
                <div class="preset-toast__nickname-theme">
                  <span class="preset-toast__nickname-theme-label">Anzahl Teams:</span>
                  <mat-form-field appearance="outline" class="preset-toast__nickname-theme-select">
                    <mat-select
                      [(ngModel)]="teamCountSelectValue"
                      aria-label="Anzahl Teams wählen"
                    >
                      <mat-select-trigger>
                        <mat-icon class="preset-toast__option-icon">groups</mat-icon>
                        {{ selectedTeamCount().label }}
                      </mat-select-trigger>
                      @for (item of teamCountOptions; track item.value) {
                        <mat-option [value]="item.value">
                          <mat-icon class="preset-toast__option-icon">groups</mat-icon>
                          {{ item.label }}
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              }
            </div>
          }
        </div>
      </div>
      <div class="preset-toast__actions">
        <button mat-button type="button" (click)="resetOptions()">Zurücksetzen</button>
        <button mat-flat-button type="button" color="primary" (click)="saveAndClose()">
          <mat-icon>save</mat-icon>
          Speichern
        </button>
      </div>
      </div>
    </div>
  `,
  styles: [`
    .preset-toast-backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      background: color-mix(in srgb, var(--mat-sys-on-surface) 32%, transparent);
      backdrop-filter: blur(4px);
    }

    @media (prefers-reduced-motion: no-preference) {
      .preset-toast-backdrop {
        animation: preset-toast-backdrop-in 0.2s ease-out;
      }
      .preset-toast {
        animation: preset-toast-in 0.25s cubic-bezier(0.2, 0, 0, 1);
      }
    }

    @keyframes preset-toast-backdrop-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes preset-toast-in {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .preset-toast {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      user-select: none;
      z-index: 71;
      width: min(96vw, 42rem);
      max-height: min(90vh, 40rem);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: var(--mat-sys-corner-large);
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      padding: 0;
      box-shadow: var(--mat-sys-level3);
    }

    .preset-toast__scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      padding: 0 1rem 1rem;
    }

    .preset-toast__head {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 1rem 1rem 0.75rem;
      margin: 0 -1rem 0;
      padding-left: 1rem;
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .preset-toast__head-accent {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: var(--mat-sys-outline-variant);
      border-radius: 0 2px 2px 0;
    }

    .preset-toast--playful .preset-toast__head-accent {
      background: var(--mat-sys-primary);
    }

    .preset-toast__head-text {
      flex: 1;
      min-width: 0;
    }

    .preset-toast__title {
      margin: 0;
      font: var(--mat-sys-title-large);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .preset-toast__title-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-high);
    }

    .preset-toast--playful .preset-toast__title-icon-wrap {
      background: color-mix(in srgb, var(--mat-sys-primary) 18%, transparent);
      color: var(--mat-sys-primary);
    }

    .preset-toast__title-icon {
      flex-shrink: 0;
      width: 1.5rem;
      height: 1.5rem;
      font-size: 1.5rem;
    }

    .preset-toast__preset-hint {
      margin: 0.35rem 0 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .preset-toast__switch-preset {
      margin-top: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-surface-container-low);
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .preset-toast__switch-preset:hover {
      background: var(--mat-sys-surface-container);
      border-color: var(--mat-sys-primary);
      color: var(--mat-sys-primary);
    }

    .preset-toast__switch-icon {
      width: 1.125rem;
      height: 1.125rem;
      font-size: 1.125rem;
    }

    .preset-toast__close {
      flex-shrink: 0;
      margin: -0.25rem -0.25rem 0 0;
    }

    .preset-toast__subtitle,
    .preset-toast__hint {
      margin: 1rem 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .preset-toast__categories {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .preset-toast__category {
      padding: 0.75rem 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
      text-align: center;
    }

    .preset-toast__category-label {
      margin: 0 0 0.5rem 0;
      font: var(--mat-sys-title-small);
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      letter-spacing: 0.02em;
    }

    .preset-toast__name-mode {
      margin-top: 0.25rem;
      margin-bottom: 0.5rem;
      width: auto;
      display: inline-flex;
    }

    .preset-toast__name-mode mat-button-toggle {
      white-space: nowrap;
    }

    .preset-toast__chips {
      margin-top: 0.25rem;
    }

    :host ::ng-deep .preset-toast__chips .mdc-evolution-chip-set__chips {
      justify-content: center;
    }

    .preset-toast__chips mat-chip {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    @media (prefers-reduced-motion: no-preference) {
      .preset-toast__chips mat-chip:active {
        transform: scale(0.98);
      }
    }

    .preset-toast__nickname-theme {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .preset-toast__nickname-theme-label {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .preset-toast__nickname-theme-select {
      flex: 1;
      max-width: 13.5rem;
    }

    .preset-toast__nickname-theme-select .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .preset-toast__nickname-theme-select .mat-mdc-select-trigger {
      display: flex;
      align-items: center;
    }

    .preset-toast__nickname-theme-select .mat-mdc-select-value {
      overflow: visible;
      text-overflow: unset;
    }

    .preset-toast__option-icon {
      width: 1.25rem;
      height: 1.25rem;
      margin-right: 0.5rem;
      font-size: 1.25rem;
      vertical-align: middle;
    }

    .preset-toast__chip-icon {
      width: 1.125rem;
      height: 1.125rem;
      margin-right: 0.35rem;
      font-size: 1.125rem;
      vertical-align: middle;
    }

    .preset-toast__chips mat-chip.preset-toast__chip--disabled {
      cursor: default;
      opacity: 0.6;
    }

    .preset-toast__actions {
      flex-shrink: 0;
      padding: 1rem 1rem 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.75rem;
    }

    :host-context(html.preset-playful) {
      .preset-toast {
        border-radius: var(--app-corner-playful, 1.5rem);
        border-color: color-mix(in srgb, var(--mat-sys-primary) 45%, transparent);
        box-shadow: var(--mat-sys-level3), 0 0 0 1px color-mix(in srgb, var(--mat-sys-primary) 20%, transparent);
      }
    }
  `],
})
export class PresetToastComponent implements OnInit {
  readonly themePreset = inject(ThemePresetService);
  readonly closed = output<void>();

  readonly optionList = PRESET_OPTION_IDS;
  readonly nameModeOptions = NAME_MODE_OPTIONS;
  readonly nicknameThemeOptions = NICKNAME_THEME_OPTIONS;
  readonly teamCountOptions = TEAM_COUNT_OPTIONS;

  optionState = signal<PresetOptionState>({});
  nameMode = signal<NameMode>('nicknameTheme');
  nicknameThemeValue = signal<NicknameTheme>('NOBEL_LAUREATES');
  teamCountValue = signal<number>(2);

  toastTitle = signal('');
  toastIcon = signal('school');
  toastHint = signal('');

  selectedNicknameTheme = computed(() => {
    const val = this.nicknameThemeValue();
    return NICKNAME_THEME_OPTIONS.find((o) => o.value === val) ?? NICKNAME_THEME_OPTIONS[0];
  });

  selectedTeamCount = computed(() => {
    const val = this.teamCountValue();
    return TEAM_COUNT_OPTIONS.find((o) => o.value === val) ?? TEAM_COUNT_OPTIONS[0];
  });

  optionsByCategory = computed(() => {
    this.optionState();
    const byCat = new Map<CategoryId, typeof PRESET_OPTION_IDS[number][]>();
    for (const opt of this.optionList) {
      const list = byCat.get(opt.categoryId) ?? [];
      list.push(opt);
      byCat.set(opt.categoryId, list);
    }
    return PRESET_CATEGORIES.map((cat) => {
      const options = byCat.get(cat.id) ?? [];
      return { categoryId: cat.id, categoryLabel: cat.label, options };
    }).filter((g) => g.options.length > 0 || g.categoryId === 'participation');
  });

  private static readonly OPTION_REQUIRES_PARENT_ON: Record<string, string> = {
    teamAssignment: 'teamMode',
  };

  get nicknameThemeSelectValue(): NicknameTheme {
    return this.nicknameThemeValue();
  }
  set nicknameThemeSelectValue(value: NicknameTheme) {
    if (NicknameThemeEnum.safeParse(value).success) {
      this.nicknameThemeValue.set(value);
    }
  }

  get teamCountSelectValue(): number {
    return this.teamCountValue();
  }
  set teamCountSelectValue(value: number) {
    const n = Number(value);
    if (n >= 2 && n <= 8) this.teamCountValue.set(n);
  }

  ngOnInit(): void {
    this.loadPreset(this.themePreset.preset());
  }

  isOptionVisible(id: string): boolean {
    const parent = PresetToastComponent.OPTION_REQUIRES_PARENT_ON[id];
    return parent ? !!this.optionState()[parent] : true;
  }

  isOptionDisabled(id: string): boolean {
    const parent = PresetToastComponent.OPTION_REQUIRES_PARENT_ON[id];
    return parent ? !this.optionState()[parent] : false;
  }

  optionEffective(id: string): boolean {
    if (this.isOptionDisabled(id)) return false;
    return !!this.optionState()[id];
  }

  setNameMode(value: NameMode): void {
    this.nameMode.set(value);
  }

  toggleOption(id: string): void {
    if (this.isOptionDisabled(id)) return;
    const state = { ...this.optionState() };
    state[id] = !state[id];
    if (id === 'teamMode' && !state[id]) {
      state['teamAssignment'] = false;
    }
    this.optionState.set(state);
  }

  resetOptions(): void {
    const preset = this.themePreset.preset();
    this.optionState.set(getPresetDefaults(preset));
    this.nameMode.set(preset === 'serious' ? 'anonymousMode' : 'nicknameTheme');
    this.nicknameThemeValue.set('NOBEL_LAUREATES');
    this.teamCountValue.set(2);
  }

  saveAndClose(): void {
    try {
      const payload = {
        options: this.optionState(),
        nameMode: this.nameMode(),
        nicknameThemeValue: this.nicknameThemeValue(),
        teamCountValue: this.teamCountValue(),
      };
      const key = PRESET_OPTIONS_STORAGE_PREFIX + this.themePreset.preset();
      localStorage.setItem(key, JSON.stringify(payload));
    } catch { /* quota or unavailable */ }
    this.themePreset.setPreset(this.themePreset.preset());
    this.closed.emit();
  }

  switchPreset(): void {
    const other = this.themePreset.preset() === 'serious' ? 'spielerisch' : 'serious';
    this.themePreset.setPreset(other);
    this.loadPreset(other);
  }

  private loadPreset(preset: 'serious' | 'spielerisch'): void {
    this.toastTitle.set(preset === 'serious' ? 'Seriös' : 'Spielerisch');
    this.toastIcon.set(preset === 'serious' ? 'school' : 'celebration');
    this.toastHint.set(
      preset === 'serious'
        ? 'Anonym, ohne Wettbewerb – Fokus auf Inhalte.'
        : 'Mit Rangliste, Sounds und Anfeuerung – für mehr Motivation.'
    );

    let state: PresetOptionState;
    let nm: NameMode = preset === 'serious' ? 'anonymousMode' : 'nicknameTheme';
    let themeVal: NicknameTheme = 'NOBEL_LAUREATES';
    let teamCount = 2;

    try {
      const key = PRESET_OPTIONS_STORAGE_PREFIX + preset;
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as { options?: PresetOptionState; nameMode?: string; nicknameThemeValue?: string; teamCountValue?: number }) : null;
      if (parsed && typeof parsed === 'object' && parsed.options && typeof parsed.options === 'object') {
        const defaults = getPresetDefaults(preset);
        state = { ...defaults };
        for (const o of PRESET_OPTION_IDS) {
          if (o.id in parsed.options && typeof (parsed.options as Record<string, unknown>)[o.id] === 'boolean') {
            state[o.id] = (parsed.options as Record<string, boolean>)[o.id];
          }
        }
        if (parsed.nameMode && ['anonymousMode', 'allowCustomNicknames', 'nicknameTheme'].includes(parsed.nameMode)) {
          nm = parsed.nameMode as NameMode;
        }
        if (parsed.nicknameThemeValue && NicknameThemeEnum.safeParse(parsed.nicknameThemeValue).success) {
          themeVal = parsed.nicknameThemeValue as NicknameTheme;
        }
        if (typeof parsed.teamCountValue === 'number' && parsed.teamCountValue >= 2 && parsed.teamCountValue <= 8) {
          teamCount = parsed.teamCountValue;
        }
      } else {
        state = getPresetDefaults(preset);
      }
    } catch {
      state = getPresetDefaults(preset);
    }

    if (state['teamMode'] === false) {
      state['teamAssignment'] = false;
    }

    this.optionState.set(state);
    this.nameMode.set(nm);
    this.nicknameThemeValue.set(themeVal);
    this.teamCountValue.set(teamCount);
  }
}
