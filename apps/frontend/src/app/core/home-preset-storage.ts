import {
  PresetStorageEntrySchema,
  QUIZ_PRESETS,
  type NicknameTheme,
  type QuizPreset,
  type TeamAssignment,
} from '@arsnova/shared-types';

/** Muss mit `preset-toast` / localStorage identisch sein. */
export const HOME_PRESET_OPTIONS_STORAGE_PREFIX = 'home-preset-options-';

export type HomeToolbarPreset = 'serious' | 'spielerisch';

export function homePresetOptionsStorageKey(bucket: HomeToolbarPreset): string {
  return `${HOME_PRESET_OPTIONS_STORAGE_PREFIX}${bucket}`;
}

/** Snackbar-Preset je nach Quiz-Einstellung (PLAYFUL/SERIOUS), nicht nach globaler Toolbar. */
export function homePresetOptionsKeyForQuizPreset(quizPreset: QuizPreset | undefined): string {
  const bucket: HomeToolbarPreset = quizPreset === 'SERIOUS' ? 'serious' : 'spielerisch';
  return homePresetOptionsStorageKey(bucket);
}

export interface HomePresetOnboardingProfile {
  nicknameTheme: NicknameTheme;
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
  teamNames: string[];
}

export function createDefaultLiveSessionOnboardingProfile(): HomePresetOnboardingProfile {
  return {
    nicknameTheme: 'KINDERGARTEN',
    allowCustomNicknames: false,
    anonymousMode: false,
    teamMode: false,
    teamCount: null,
    teamAssignment: 'AUTO',
    teamNames: [],
  };
}

export function readHomePresetOnboardingProfile(
  quizPreset: QuizPreset | undefined,
): HomePresetOnboardingProfile {
  const preset: QuizPreset = quizPreset === 'SERIOUS' ? 'SERIOUS' : 'PLAYFUL';
  const presetDefaults = QUIZ_PRESETS[preset];
  const defaultProfile: HomePresetOnboardingProfile = {
    nicknameTheme: presetDefaults.nicknameTheme ?? 'HIGH_SCHOOL',
    allowCustomNicknames: false,
    anonymousMode: presetDefaults.anonymousMode ?? false,
    teamMode: false,
    teamCount: null,
    teamAssignment: 'AUTO',
    teamNames: [],
  };

  try {
    const presetKey = homePresetOptionsKeyForQuizPreset(preset);
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(presetKey) : null;
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const entry = PresetStorageEntrySchema.safeParse(parsed);
    if (!entry.success) {
      return defaultProfile;
    }

    const options = entry.data.options;
    const optionEnabled = (id: string, fallback: boolean) =>
      id in options ? options[id] === true : fallback;
    const teamMode = optionEnabled('teamMode', false);

    return {
      ...defaultProfile,
      nicknameTheme: entry.data.nicknameThemeValue,
      allowCustomNicknames: entry.data.nameMode === 'allowCustomNicknames',
      anonymousMode: entry.data.nameMode === 'anonymousMode',
      teamMode,
      teamCount: teamMode ? entry.data.teamCountValue : null,
      teamAssignment: optionEnabled('teamAssignment', false) ? 'MANUAL' : 'AUTO',
    };
  } catch {
    return defaultProfile;
  }
}
