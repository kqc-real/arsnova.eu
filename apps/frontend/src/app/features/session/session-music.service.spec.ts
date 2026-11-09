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
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        SessionMusicService,
        { provide: SoundService, useValue: sound },
        { provide: ThemePresetService, useValue: { preset: () => 'serious' } },
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
