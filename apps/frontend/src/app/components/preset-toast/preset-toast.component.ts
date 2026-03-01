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
  { id: 'gamification', label: 'Gamification & Auswertung', order: 0 },
  { id: 'participation', label: 'Teilnahme & Nicknames', order: 1 },
  { id: 'flow', label: 'Ablauf & Zeit', order: 2 },
  { id: 'team', label: 'Team', order: 3 },
  { id: 'audio', label: 'Audio', order: 4 },
] as const;

type CategoryId = (typeof PRESET_CATEGORIES)[number]['id'];

export const PRESET_OPTION_IDS = [
  { id: 'showLeaderboard', label: 'Rangliste (Punkte & Platzierung)', icon: 'leaderboard', categoryId: 'gamification' as CategoryId },
  { id: 'enableRewardEffects', label: 'Effekte bei richtiger Antwort', icon: 'auto_awesome', categoryId: 'gamification' as CategoryId },
  { id: 'enableMotivationMessages', label: 'Anfeuerungstexte nach Antwort', icon: 'campaign', categoryId: 'gamification' as CategoryId },
  { id: 'enableEmojiReactions', label: 'Emoji-Reaktionen zulassen', icon: 'emoji_emotions', categoryId: 'gamification' as CategoryId },
  { id: 'bonusTokenCount', label: 'Bonus-Token für Top-Plätze', icon: 'emoji_events', categoryId: 'gamification' as CategoryId },
  { id: 'defaultTimer', label: 'Zeitlimit pro Frage (Countdown)', icon: 'timer', categoryId: 'flow' as CategoryId },
  { id: 'readingPhaseEnabled', label: 'Zuerst lesen, dann antworten', icon: 'menu_book', categoryId: 'flow' as CategoryId },
  { id: 'teamMode', label: 'In Teams spielen', icon: 'groups', categoryId: 'team' as CategoryId },
  { id: 'teamAssignment', label: 'Teams auto/manuell zuweisen', icon: 'shuffle', categoryId: 'team' as CategoryId },
  { id: 'enableSoundEffects', label: 'Sound bei Aktionen', icon: 'volume_up', categoryId: 'audio' as CategoryId },
  { id: 'backgroundMusic', label: 'Hintergrundmusik in Lobby', icon: 'music_note', categoryId: 'audio' as CategoryId },
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
      <div class="preset-toast" (click)="$event.stopPropagation()">
      <div class="preset-toast__scroll">
        <div class="preset-toast__head">
          <div class="preset-toast__head-text">
            <p class="preset-toast__title">
              <mat-icon class="preset-toast__title-icon">{{ toastIcon() }}</mat-icon>
              {{ toastTitle() }}
            </p>
            <p class="preset-toast__preset-hint">{{ toastHint() }}</p>
            <button type="button" class="preset-toast__switch-preset" (click)="switchPreset()">
              Zu {{ themePreset.preset() === 'serious' ? 'Spielerisch' : 'Seriös' }} wechseln
            </button>
          </div>
          <button matIconButton type="button" class="preset-toast__close" aria-label="Hinweis schließen" (click)="closed.emit()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <p class="preset-toast__subtitle">Jede Option: <strong>an</strong> = aktiv, <strong>aus</strong> = deaktiviert. Klick wechselt, Speichern übernimmt.</p>
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
                      aria-label="Nickname-Altersgruppe wählen"
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
      background: transparent;
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
      padding: 0.75rem;
      box-shadow: var(--mat-sys-level3);
    }

    .preset-toast__scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .preset-toast__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
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
      gap: 0.5rem;
    }

    .preset-toast__title-icon {
      flex-shrink: 0;
      width: 1.75rem;
      height: 1.75rem;
      font-size: 1.75rem;
    }

    .preset-toast__preset-hint {
      margin: 0.25rem 0 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .preset-toast__switch-preset {
      margin-top: 0.5rem;
      padding: 0;
      border: none;
      background: none;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface);
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }

    .preset-toast__switch-preset:hover {
      color: var(--mat-sys-primary);
    }

    .preset-toast__close {
      flex-shrink: 0;
      margin: -0.25rem -0.25rem 0 0;
    }

    .preset-toast__subtitle,
    .preset-toast__hint {
      margin: 1.25rem 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .preset-toast__categories {
      margin-top: 1.25rem;
    }

    .preset-toast__category {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      text-align: center;
    }

    .preset-toast__category:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }

    .preset-toast__category-label {
      margin: 0 0 0.35rem 0;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
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
      margin-top: 1rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    :host-context(html.preset-playful) {
      .preset-toast {
        border-radius: 1.5rem;
        border-color: var(--mat-sys-primary);
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
    this.toastTitle.set(preset === 'serious' ? 'Preset: Seriös' : 'Preset: Spielerisch');
    this.toastIcon.set(preset === 'serious' ? 'school' : 'celebration');
    this.toastHint.set(
      preset === 'serious'
        ? 'Druckfrei, anonym, Fokus auf Inhalt.'
        : 'Rangliste, Sound & Effekte, Motivation & Wettbewerb.'
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
