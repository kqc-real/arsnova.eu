import { describe, expect, it } from 'vitest';
import {
  HOME_PRESET_OPTIONS_STORAGE_PREFIX,
  createDefaultLiveSessionOnboardingProfile,
  homePresetOptionsKeyForQuizPreset,
  homePresetOptionsStorageKey,
} from './home-preset-storage';

describe('home-preset-storage', () => {
  it('baut Toolbar-Schlüssel wie bisher', () => {
    expect(homePresetOptionsStorageKey('serious')).toBe(
      `${HOME_PRESET_OPTIONS_STORAGE_PREFIX}serious`,
    );
    expect(homePresetOptionsStorageKey('spielerisch')).toBe(
      `${HOME_PRESET_OPTIONS_STORAGE_PREFIX}spielerisch`,
    );
  });

  it('mappt Quiz-Preset auf denselben Bucket wie Snackbar', () => {
    expect(homePresetOptionsKeyForQuizPreset('SERIOUS')).toBe(
      homePresetOptionsStorageKey('serious'),
    );
    expect(homePresetOptionsKeyForQuizPreset('PLAYFUL')).toBe(
      homePresetOptionsStorageKey('spielerisch'),
    );
    expect(homePresetOptionsKeyForQuizPreset(undefined)).toBe(
      homePresetOptionsStorageKey('spielerisch'),
    );
  });

  it('liefert im spielerischen Preset feste Tier-Pseudonyme ohne Teammodus', () => {
    expect(createDefaultLiveSessionOnboardingProfile('spielerisch')).toEqual({
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
  });

  it('liefert im seriösen Preset Oberstufen-Pseudonyme ohne Teammodus', () => {
    expect(createDefaultLiveSessionOnboardingProfile('serious')).toEqual({
      nicknameTheme: 'HIGH_SCHOOL',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
  });
});
