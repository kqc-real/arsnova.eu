import type { QuizPreset } from '@arsnova/shared-types';

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
