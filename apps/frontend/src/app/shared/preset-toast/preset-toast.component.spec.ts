/**
 * Unit-Tests für PresetToastComponent (Preset-Optionen, localStorage, UI-State).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PresetToastComponent } from './preset-toast.component';
import type { NicknameTheme } from '@arsnova/shared-types';

describe('PresetToastComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PresetToastComponent],
    });
  });

  afterEach(() => localStorage.clear());

  function createToast(): PresetToastComponent {
    const fixture = TestBed.createComponent(PresetToastComponent);
    return fixture.componentInstance;
  }

  describe('resetOptions (Preset-Defaults)', () => {
    it('setzt "seriös"-Defaults: readingPhaseEnabled an, Rest aus', () => {
      const comp = createToast();
      comp.themePreset.setPreset('serious');
      comp.resetOptions();

      const state = comp.optionState();
      expect(state['readingPhaseEnabled']).toBe(true);
      expect(state['showLeaderboard']).toBe(false);
      expect(state['enableSoundEffects']).toBe(false);
      expect(state['defaultTimer']).toBe(false);
    });

    it('setzt "spielerisch"-Defaults: Leaderboard, Timer, Sound, Effekte an', () => {
      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.resetOptions();

      const state = comp.optionState();
      expect(state['showLeaderboard']).toBe(true);
      expect(state['defaultTimer']).toBe(true);
      expect(state['enableSoundEffects']).toBe(true);
      expect(state['enableRewardEffects']).toBe(true);
      expect(state['enableMotivationMessages']).toBe(true);
      expect(state['enableEmojiReactions']).toBe(true);
      expect(state['readingPhaseEnabled']).toBe(false);
    });

    it('setzt nameMode auf "anonymousMode" für seriös', () => {
      const comp = createToast();
      comp.themePreset.setPreset('serious');
      comp.resetOptions();
      expect(comp.nameMode()).toBe('anonymousMode');
    });

    it('setzt nameMode auf "nicknameTheme" für spielerisch', () => {
      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.resetOptions();
      expect(comp.nameMode()).toBe('nicknameTheme');
    });

    it('setzt nicknameTheme auf NOBEL_LAUREATES zurück', () => {
      const comp = createToast();
      comp.nicknameThemeValue.set('KINDERGARTEN');
      comp.resetOptions();
      expect(comp.nicknameThemeValue()).toBe('NOBEL_LAUREATES');
    });

    it('setzt teamCount auf 2 zurück', () => {
      const comp = createToast();
      comp.teamCountValue.set(5);
      comp.resetOptions();
      expect(comp.teamCountValue()).toBe(2);
    });
  });

  describe('toggleOption', () => {
    it('schaltet eine Option von aus auf an', () => {
      const comp = createToast();
      comp.themePreset.setPreset('serious');
      comp.resetOptions();
      expect(comp.optionState()['showLeaderboard']).toBe(false);

      comp.toggleOption('showLeaderboard');
      expect(comp.optionState()['showLeaderboard']).toBe(true);
    });

    it('schaltet eine Option von an auf aus', () => {
      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.resetOptions();
      expect(comp.optionState()['showLeaderboard']).toBe(true);

      comp.toggleOption('showLeaderboard');
      expect(comp.optionState()['showLeaderboard']).toBe(false);
    });

    it('deaktiviert teamAssignment automatisch wenn teamMode ausgeschaltet wird', () => {
      const comp = createToast();
      comp.resetOptions();
      comp.toggleOption('teamMode');
      comp.toggleOption('teamAssignment');
      expect(comp.optionState()['teamMode']).toBe(true);
      expect(comp.optionState()['teamAssignment']).toBe(true);

      comp.toggleOption('teamMode');
      expect(comp.optionState()['teamMode']).toBe(false);
      expect(comp.optionState()['teamAssignment']).toBe(false);
    });

    it('ignoriert toggle bei deaktivierter abhängiger Option', () => {
      const comp = createToast();
      comp.resetOptions();
      expect(comp.optionState()['teamMode']).toBe(false);

      comp.toggleOption('teamAssignment');
      expect(comp.optionState()['teamAssignment']).toBe(false);
    });
  });

  describe('isOptionDisabled / optionEffective', () => {
    it('teamAssignment ist disabled wenn teamMode aus ist', () => {
      const comp = createToast();
      comp.resetOptions();
      expect(comp.isOptionDisabled('teamAssignment')).toBe(true);
    });

    it('teamAssignment ist nicht disabled wenn teamMode an ist', () => {
      const comp = createToast();
      comp.resetOptions();
      comp.toggleOption('teamMode');
      expect(comp.isOptionDisabled('teamAssignment')).toBe(false);
    });

    it('unabhängige Optionen sind nie disabled', () => {
      const comp = createToast();
      comp.resetOptions();
      expect(comp.isOptionDisabled('showLeaderboard')).toBe(false);
      expect(comp.isOptionDisabled('enableSoundEffects')).toBe(false);
    });

    it('gibt false zurück für deaktivierte abhängige Option', () => {
      const comp = createToast();
      comp.resetOptions();
      const state = { ...comp.optionState(), teamAssignment: true };
      comp.optionState.set(state);
      expect(comp.optionEffective('teamAssignment')).toBe(false);
    });

    it('gibt true zurück für aktive, nicht-disabled Option', () => {
      const comp = createToast();
      comp.resetOptions();
      comp.toggleOption('teamMode');
      comp.toggleOption('teamAssignment');
      expect(comp.optionEffective('teamAssignment')).toBe(true);
    });
  });

  describe('setNameMode', () => {
    it('setzt den Namensmodus auf allowCustomNicknames', () => {
      const comp = createToast();
      comp.setNameMode('allowCustomNicknames');
      expect(comp.nameMode()).toBe('allowCustomNicknames');
    });

    it('setzt den Namensmodus auf anonymousMode', () => {
      const comp = createToast();
      comp.setNameMode('anonymousMode');
      expect(comp.nameMode()).toBe('anonymousMode');
    });

    it('setzt den Namensmodus auf nicknameTheme', () => {
      const comp = createToast();
      comp.setNameMode('nicknameTheme');
      expect(comp.nameMode()).toBe('nicknameTheme');
    });
  });

  describe('nicknameThemeSelectValue', () => {
    it('getter liefert aktuellen Signalwert', () => {
      const comp = createToast();
      comp.nicknameThemeValue.set('KINDERGARTEN');
      expect(comp.nicknameThemeSelectValue).toBe('KINDERGARTEN');
    });

    it('setter aktualisiert Signal bei gültigem Wert', () => {
      const comp = createToast();
      comp.nicknameThemeSelectValue = 'HIGH_SCHOOL';
      expect(comp.nicknameThemeValue()).toBe('HIGH_SCHOOL');
    });

    it('setter ignoriert ungültigen Wert', () => {
      const comp = createToast();
      comp.nicknameThemeValue.set('NOBEL_LAUREATES');
      comp.nicknameThemeSelectValue = 'INVALID' as unknown as NicknameTheme;
      expect(comp.nicknameThemeValue()).toBe('NOBEL_LAUREATES');
    });
  });

  describe('teamCountSelectValue', () => {
    it('getter liefert aktuellen Signalwert', () => {
      const comp = createToast();
      comp.teamCountValue.set(4);
      expect(comp.teamCountSelectValue).toBe(4);
    });

    it('setter aktualisiert Signal bei gültigem Wert (2–8)', () => {
      const comp = createToast();
      comp.teamCountSelectValue = 7;
      expect(comp.teamCountValue()).toBe(7);
    });

    it('setter ignoriert Wert < 2', () => {
      const comp = createToast();
      comp.teamCountValue.set(3);
      comp.teamCountSelectValue = 1;
      expect(comp.teamCountValue()).toBe(3);
    });

    it('setter ignoriert Wert > 8', () => {
      const comp = createToast();
      comp.teamCountValue.set(3);
      comp.teamCountSelectValue = 10;
      expect(comp.teamCountValue()).toBe(3);
    });
  });

  describe('selectedNicknameTheme / selectedTeamCount (computed)', () => {
    it('liefert passendes Icon und Label für aktuellen Wert', () => {
      const comp = createToast();
      comp.nicknameThemeValue.set('PRIMARY_SCHOOL');
      const opt = comp.selectedNicknameTheme();
      expect(opt.label).toBe('Grundschule');
      expect(opt.icon).toBe('abc');
    });

    it('fallback auf erstes Element bei unbekanntem Wert', () => {
      const comp = createToast();
      (comp.nicknameThemeValue as unknown as { set(v: string): void }).set('UNKNOWN');
      const opt = comp.selectedNicknameTheme();
      expect(opt.value).toBe('NOBEL_LAUREATES');
    });

    it('liefert passendes Label für aktuellen Team-Wert', () => {
      const comp = createToast();
      comp.teamCountValue.set(5);
      const opt = comp.selectedTeamCount();
      expect(opt.label).toBe('5 Teams');
    });
  });

  describe('optionsByCategory (computed)', () => {
    it('enthält alle definierten Kategorien mit Optionen', () => {
      const comp = createToast();
      comp.resetOptions();
      const cats = comp.optionsByCategory();
      expect(cats.length).toBeGreaterThanOrEqual(4);
      const catIds = cats.map((c) => c.categoryId);
      expect(catIds).toContain('gamification');
      expect(catIds).toContain('participation');
      expect(catIds).toContain('flow');
      expect(catIds).toContain('team');
    });

    it('enthält "participation"-Kategorie auch wenn sie keine Chips hat', () => {
      const comp = createToast();
      comp.resetOptions();
      const cats = comp.optionsByCategory();
      const participation = cats.find((c) => c.categoryId === 'participation');
      expect(participation).toBeDefined();
    });
  });

  describe('saveAndClose / loadPreset (localStorage)', () => {
    it('speichert Optionen pro Preset in localStorage', () => {
      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.resetOptions();
      comp.toggleOption('showLeaderboard');

      comp.saveAndClose();

      const raw = localStorage.getItem('home-preset-options-spielerisch');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.options).toBeDefined();
      expect(parsed.nameMode).toBeDefined();
      expect(parsed.nicknameThemeValue).toBeDefined();
      expect(parsed.teamCountValue).toBeDefined();
    });

    it('speichert seriös und spielerisch getrennt', () => {
      const comp = createToast();

      comp.themePreset.setPreset('serious');
      comp.resetOptions();
      comp.nicknameThemeValue.set('KINDERGARTEN');
      comp.saveAndClose();

      comp.themePreset.setPreset('spielerisch');
      comp.resetOptions();
      comp.nicknameThemeValue.set('HIGH_SCHOOL');
      comp.saveAndClose();

      const serious = JSON.parse(localStorage.getItem('home-preset-options-serious')!);
      const playful = JSON.parse(localStorage.getItem('home-preset-options-spielerisch')!);
      expect(serious.nicknameThemeValue).toBe('KINDERGARTEN');
      expect(playful.nicknameThemeValue).toBe('HIGH_SCHOOL');
    });

    it('lädt gespeicherte Optionen beim Init (ngOnInit)', () => {
      localStorage.setItem(
        'home-preset-options-spielerisch',
        JSON.stringify({
          options: { showLeaderboard: false, defaultTimer: true },
          nameMode: 'allowCustomNicknames',
          nicknameThemeValue: 'MIDDLE_SCHOOL',
          teamCountValue: 4,
        }),
      );

      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.ngOnInit();

      expect(comp.nameMode()).toBe('allowCustomNicknames');
      expect(comp.nicknameThemeValue()).toBe('MIDDLE_SCHOOL');
      expect(comp.teamCountValue()).toBe(4);
    });

    it('verwendet Defaults bei ungültigem localStorage-Inhalt', () => {
      localStorage.setItem('home-preset-options-spielerisch', 'INVALID JSON{{{');

      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.ngOnInit();

      expect(comp.nameMode()).toBe('nicknameTheme');
      expect(comp.nicknameThemeValue()).toBe('NOBEL_LAUREATES');
    });

    it('validiert nicknameTheme beim Laden aus localStorage', () => {
      localStorage.setItem(
        'home-preset-options-spielerisch',
        JSON.stringify({
          options: {},
          nameMode: 'nicknameTheme',
          nicknameThemeValue: 'TOTALLY_INVALID',
          teamCountValue: 2,
        }),
      );

      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.ngOnInit();

      expect(comp.nicknameThemeValue()).toBe('NOBEL_LAUREATES');
    });

    it('validiert teamCountValue beim Laden (Bereich 2–8)', () => {
      localStorage.setItem(
        'home-preset-options-spielerisch',
        JSON.stringify({
          options: {},
          nameMode: 'nicknameTheme',
          nicknameThemeValue: 'NOBEL_LAUREATES',
          teamCountValue: 99,
        }),
      );

      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.ngOnInit();

      expect(comp.teamCountValue()).toBe(2);
    });

    it('erzwingt teamAssignment=false wenn teamMode=false beim Laden', () => {
      localStorage.setItem(
        'home-preset-options-spielerisch',
        JSON.stringify({
          options: { teamMode: false, teamAssignment: true },
          nameMode: 'nicknameTheme',
          nicknameThemeValue: 'NOBEL_LAUREATES',
          teamCountValue: 2,
        }),
      );

      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.ngOnInit();

      expect(comp.optionState()['teamAssignment']).toBe(false);
    });
  });

  describe('Toast UI-State', () => {
    it('setzt Titel und Icon für seriös', () => {
      const comp = createToast();
      comp.themePreset.setPreset('serious');
      comp.ngOnInit();

      expect(comp.toastTitle()).toBe('Seriös');
      expect(comp.toastIcon()).toBe('work');
    });

    it('setzt Titel und Icon für spielerisch', () => {
      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.ngOnInit();

      expect(comp.toastTitle()).toBe('Spielerisch');
      expect(comp.toastIcon()).toBe('celebration');
    });
  });

  describe('switchPreset', () => {
    it('wechselt von serious zu spielerisch', () => {
      const comp = createToast();
      comp.themePreset.setPreset('serious');
      comp.ngOnInit();

      comp.switchPreset();

      expect(comp.themePreset.preset()).toBe('spielerisch');
      expect(comp.toastTitle()).toBe('Spielerisch');
    });

    it('wechselt von spielerisch zu serious', () => {
      const comp = createToast();
      comp.themePreset.setPreset('spielerisch');
      comp.ngOnInit();

      comp.switchPreset();

      expect(comp.themePreset.preset()).toBe('serious');
      expect(comp.toastTitle()).toBe('Seriös');
    });
  });

  describe('Konstanten', () => {
    it('presetOptionList enthält erwartete Option-IDs', () => {
      const comp = createToast();
      const ids = comp.optionList.map((o) => o.id);
      expect(ids).toContain('showLeaderboard');
      expect(ids).toContain('teamMode');
      expect(ids).toContain('teamAssignment');
      expect(ids).toContain('enableSoundEffects');
      expect(ids).toContain('readingPhaseEnabled');
    });

    it('nicknameThemeOptions enthält alle Altersgruppen', () => {
      const comp = createToast();
      const values = comp.nicknameThemeOptions.map((o) => o.value);
      expect(values).toEqual([
        'NOBEL_LAUREATES',
        'KINDERGARTEN',
        'PRIMARY_SCHOOL',
        'MIDDLE_SCHOOL',
        'HIGH_SCHOOL',
      ]);
    });

    it('teamCountOptions enthält 2 bis 8', () => {
      const comp = createToast();
      const values = comp.teamCountOptions.map((o) => o.value);
      expect(values).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('nameModeOptions enthält alle drei Modi', () => {
      const comp = createToast();
      const values = comp.nameModeOptions.map((o) => o.value);
      expect(values).toEqual(['nicknameTheme', 'allowCustomNicknames', 'anonymousMode']);
    });

    it('jede Option hat ein Icon', () => {
      const comp = createToast();
      for (const opt of comp.optionList) expect(opt.icon).toBeTruthy();
      for (const opt of comp.nicknameThemeOptions) expect(opt.icon).toBeTruthy();
      for (const opt of comp.nameModeOptions) expect(opt.icon).toBeTruthy();
    });
  });
});
