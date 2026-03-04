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
import { ThemePresetService } from '../../core/theme-preset.service';

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
  { id: 'bonusTokenCount', label: 'Bonus-Code für Top-Plätze', icon: 'emoji_events', categoryId: 'gamification' as CategoryId },
  { id: 'defaultTimer', label: 'Zeitlimit pro Frage', icon: 'timer', categoryId: 'flow' as CategoryId },
  { id: 'readingPhaseEnabled', label: 'Zuerst lesen, dann antworten', icon: 'menu_book', categoryId: 'flow' as CategoryId },
  { id: 'teamMode', label: 'In Teams spielen', icon: 'groups', categoryId: 'team' as CategoryId },
  { id: 'teamAssignment', label: 'Teams automatisch oder manuell zuweisen', icon: 'shuffle', categoryId: 'team' as CategoryId },
  { id: 'enableSoundEffects', label: 'Sounds bei Aktionen', icon: 'volume_up', categoryId: 'audio' as CategoryId },
  { id: 'backgroundMusic', label: 'Hintergrundmusik in der Lobby', icon: 'music_note', categoryId: 'audio' as CategoryId },
] as const;

export const NICKNAME_THEME_OPTIONS: { value: NicknameTheme; label: string; icon: string }[] = [
  { value: 'NOBEL_LAUREATES', label: 'Nobelpreisträger', icon: 'military_tech' },
  { value: 'KINDERGARTEN', label: 'Kita', icon: 'child_care' },
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
  templateUrl: './preset-toast.component.html',
  styleUrls: ['./preset-toast.component.scss'],
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
        ? 'Anonym, ohne Wettbewerb, Fokus auf Inhalte.'
        : 'Mit Rangliste, Sounds, Anfeuerung und Countdown auf allen Handys – für mehr Motivation.'
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
