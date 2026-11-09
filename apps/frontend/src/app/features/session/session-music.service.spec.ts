import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundService } from '../../core/sound.service';
import { ThemePresetService } from '../../core/theme-preset.service';
import { SessionMusicService } from './session-music.service';

describe('SessionMusicService', () => {
  const sound = {
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    musicPreviewing: vi.fn(() => false),
    stopPreview: vi.fn(),
    stopAllSfx: vi.fn(),
    preload: vi.fn(),
    play: vi.fn(),
    musicPlaying: vi.fn(() => false),
  };

  let preset: 'serious' | 'spielerisch';

  beforeEach(() => {
    preset = 'serious';
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        SessionMusicService,
        { provide: SoundService, useValue: sound },
        { provide: ThemePresetService, useValue: { preset: () => preset } },
      ],
    });
  });

  it('behält Track und Ton-Einstellungen beim Eintritt in dieselbe Session', () => {
    const music = TestBed.inject(SessionMusicService);
    music.enter('ABC123');
    music.musicMuted.set(false);
    music.quickFeedbackMusicEnabled.set(true);
    music.sync('ABC123', 'LOBBY', music.trackFor('lobby', 'quiz'));

    music.enter('abc123');

    expect(music.trackFor('lobby', 'quiz')).toBe('LOBBY_2');
    expect(music.trackFor('lobby', 'quickFeedback')).toBe('LOBBY_2');
    expect(sound.playMusic).toHaveBeenCalledWith('LOBBY_2');
    expect(sound.stopMusic).not.toHaveBeenCalled();
  });

  it('übernimmt die laufende Countdown-Deadline und verwirft sie beim Phasenende', () => {
    const music = TestBed.inject(SessionMusicService);
    music.enter('ABC123');
    const nextRun = {
      timerSeconds: 30,
      currentDeadlineMs: null,
      currentKey: null,
      nextKey: 'question:1:30',
    };

    expect(music.resolveCountdownDeadline('ABC123', { ...nextRun, nowMs: 1_000 })).toBe(31_000);
    expect(music.resolveCountdownDeadline('ABC123', { ...nextRun, nowMs: 8_000 })).toBe(31_000);
    music.sync('ABC123', 'PAUSED', null);
    expect(music.resolveCountdownDeadline('ABC123', { ...nextRun, nowMs: 10_000 })).toBe(40_000);
  });

  it.each(['serious', 'spielerisch'] as const)(
    'behält den Gong- und Pfiff-Zustand bei einem Ansichtswechsel im Preset %s',
    (mode) => {
      preset = mode;
      const music = TestBed.inject(SessionMusicService);
      music.enter('ABC123');
      const options = {
        timerSeconds: 30,
        currentDeadlineMs: null,
        currentKey: null,
        nextKey: '0:1:30',
      };
      const deadline = music.resolveCountdownDeadline('ABC123', {
        ...options,
        activeAt: new Date(1_000).toISOString(),
        nowMs: 1_000,
      });
      music.tickCountdown('ABC123', deadline, 8, true);
      music.tickCountdown('ABC123', deadline, 7, true);

      music.enter('ABC123');
      expect(music.resolveCountdownDeadline('ABC123', { ...options, nowMs: 25_000 })).toBe(
        deadline,
      );
      music.tickCountdown('ABC123', deadline, 6, true);
      music.tickCountdown('ABC123', deadline, 1, true);
      music.tickCountdown('ABC123', deadline, 0, true);

      const cues = sound.play.mock.calls.map(([key]) => key);
      expect(cues).toEqual(mode === 'spielerisch' ? ['countdownEnd', 'sessionEnd'] : []);
      expect(sound.stopAllSfx).not.toHaveBeenCalled();
    },
  );

  it('spielt erst nach Bestätigung der Frist für die aktuelle Frage und Runde', () => {
    preset = 'spielerisch';
    const music = TestBed.inject(SessionMusicService);
    music.enter('ABC123');
    const options = {
      timerSeconds: 5,
      currentDeadlineMs: null,
      currentKey: null,
      nextKey: '0:1:5',
      nowMs: 1_000,
    };
    const estimated = music.resolveCountdownDeadline('ABC123', options);
    music.tickCountdown('ABC123', estimated, 5, true);
    expect(sound.play).not.toHaveBeenCalled();

    const confirmed = music.resolveCountdownDeadline('ABC123', {
      ...options,
      activeAt: new Date(1_000).toISOString(),
    });
    music.tickCountdown('ABC123', confirmed, 5, true);
    expect(sound.play).toHaveBeenCalledExactlyOnceWith('countdownEnd', {
      gain: 0.32,
      fadeOutSeconds: 0.55,
    });

    const otherRound = music.resolveCountdownDeadline('ABC123', { ...options, nextKey: '0:2:5' });
    music.tickCountdown('ABC123', otherRound, 1, true);
    expect(sound.play).toHaveBeenCalledOnce();
  });

  it('spielt bei deaktivierten Soundeffekten keine Countdown-Signale', () => {
    preset = 'spielerisch';
    const music = TestBed.inject(SessionMusicService);
    music.enter('ABC123');
    const deadline = music.resolveCountdownDeadline('ABC123', {
      timerSeconds: 5,
      currentDeadlineMs: null,
      currentKey: null,
      nextKey: '0:1:5',
      activeAt: new Date(1_000).toISOString(),
      nowMs: 1_000,
    });
    music.tickCountdown('ABC123', deadline, 5, false);
    music.tickCountdown('ABC123', deadline, 0, false);
    expect(sound.play).not.toHaveBeenCalled();
  });

  it('stoppt auch eine laufende Vorschau beim Session-Ende und stoppt beim Verlassen', () => {
    const music = TestBed.inject(SessionMusicService);
    music.enter('ABC123');
    sound.musicPreviewing.mockReturnValue(true);
    music.sync('ABC123', 'FINISHED', null);
    expect(sound.stopPreview).toHaveBeenCalledOnce();
    expect(sound.stopMusic).toHaveBeenCalledOnce();

    sound.musicPreviewing.mockReturnValue(false);
    music.keepOnly(null);
    music.sync('ABC123', 'LOBBY', 'LOBBY_2');
    expect(sound.stopMusic).toHaveBeenCalledTimes(2);
    expect(sound.playMusic).not.toHaveBeenCalled();
  });
});
