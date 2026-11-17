import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import type { SessionInfoDTO, SessionLiveChannel } from '@arsnova/shared-types';
import { SoundService } from '../../core/sound.service';
import { ThemePresetService } from '../../core/theme-preset.service';
import { normalizeHostSessionCode } from '../../core/host-session-token';
import { remainingCountdownSeconds, stableCountdownDeadlineMs } from './session-countdown.util';

export type HostMusicTrack =
  | 'LOBBY_0'
  | 'LOBBY_1'
  | 'LOBBY_2'
  | 'LOBBY_3'
  | 'READING_0'
  | 'COUNTDOWN_0'
  | 'COUNTDOWN_1'
  | 'COUNTDOWN_2';

export type MusicPhase = 'lobby' | 'reading' | 'countdown' | 'personalTime';

const PHASE_TRACK_DEFAULTS: Record<MusicPhase, HostMusicTrack> = {
  lobby: 'LOBBY_2',
  reading: 'READING_0',
  countdown: 'COUNTDOWN_1',
  personalTime: 'COUNTDOWN_0',
};

const MUSIC_PHASE_STORAGE_KEY = 'arsnova-host-phase-tracks';
const MUSIC_PHASE_IDS = ['lobby', 'reading', 'countdown', 'personalTime'] as const;

const LEGACY_HOST_MUSIC_TRACKS: Record<string, HostMusicTrack> = {
  CONNECTING_0: 'READING_0',
  COUNTDOWN_RUNNING_0: 'COUNTDOWN_0',
  COUNTDOWN_RUNNING_1: 'COUNTDOWN_1',
  COUNTDOWN_RUNNING_2: 'COUNTDOWN_2',
};

function normalizeStoredHostMusicTrack(value: unknown): HostMusicTrack | null {
  if (typeof value !== 'string') {
    return null;
  }

  const migrated = LEGACY_HOST_MUSIC_TRACKS[value] ?? value;
  return isValidTrack(migrated) ? migrated : null;
}

function isMusicPhaseId(value: unknown): value is MusicPhase {
  return (
    value === 'lobby' || value === 'reading' || value === 'countdown' || value === 'personalTime'
  );
}

function readStoredPhaseMusicRaw(): Record<string, unknown> | null {
  try {
    const raw =
      globalThis.localStorage === undefined
        ? null
        : globalThis.localStorage.getItem(MUSIC_PHASE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function loadPhaseTracksFromStorage(): Record<MusicPhase, HostMusicTrack> {
  const parsed = readStoredPhaseMusicRaw();
  if (!parsed) return { ...PHASE_TRACK_DEFAULTS };
  return {
    lobby: normalizeStoredHostMusicTrack(parsed['lobby']) ?? PHASE_TRACK_DEFAULTS.lobby,
    reading:
      normalizeStoredHostMusicTrack(parsed['reading'] ?? parsed['connecting']) ??
      PHASE_TRACK_DEFAULTS.reading,
    countdown:
      normalizeStoredHostMusicTrack(parsed['countdown'] ?? parsed['running']) ??
      PHASE_TRACK_DEFAULTS.countdown,
    personalTime:
      normalizeStoredHostMusicTrack(parsed['personalTime']) ?? PHASE_TRACK_DEFAULTS.personalTime,
  };
}

function loadMutedMusicPhasesFromStorage(): ReadonlySet<MusicPhase> {
  const raw = readStoredPhaseMusicRaw()?.['mutedPhases'];
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter(isMusicPhaseId));
}

function persistPhaseMusicSettings(
  tracks: Record<MusicPhase, HostMusicTrack>,
  mutedPhases: ReadonlySet<MusicPhase>,
): void {
  try {
    localStorage.setItem(
      MUSIC_PHASE_STORAGE_KEY,
      JSON.stringify({
        ...tracks,
        mutedPhases: MUSIC_PHASE_IDS.filter((phase) => mutedPhases.has(phase)),
      }),
    );
  } catch {
    /* quota */
  }
}

const MUSIC_TRACKS = new Set<string>([
  'LOBBY_0',
  'LOBBY_1',
  'LOBBY_2',
  'LOBBY_3',
  'READING_0',
  'COUNTDOWN_0',
  'COUNTDOWN_1',
  'COUNTDOWN_2',
]);

function isValidTrack(value: string): value is HostMusicTrack {
  return MUSIC_TRACKS.has(value);
}

export function musicPhaseForStatus(
  status: SessionInfoDTO['status'] | null,
  personalTime: boolean,
): MusicPhase | null {
  if (status === 'LOBBY') return 'lobby';
  if (status === 'QUESTION_OPEN') return 'reading';
  if (status === 'ACTIVE') return personalTime ? 'personalTime' : 'countdown';
  return null;
}

/** Die Session-Shell besitzt die Wiedergabe, Host und Presenter liefern den Live-Stand. */
@Injectable()
export class SessionMusicService implements OnDestroy {
  private readonly sound = inject(SoundService);
  private readonly themePreset = inject(ThemePresetService);
  private code: string | null = null;
  private countdown: {
    key: string;
    deadlineMs: number;
    confirmed: boolean;
    gongPlayed: boolean;
    whistlePlayed: boolean;
    cuesPreloaded: boolean;
  } | null = null;
  private fadedCountdownDeadlineMs: number | null = null;
  readonly phaseTracks = signal(loadPhaseTracksFromStorage());
  readonly mutedMusicPhases = signal(loadMutedMusicPhasesFromStorage());
  readonly musicMuted = signal(false);
  readonly quickFeedbackMusicEnabled = signal(false);

  constructor() {
    effect(() => this.musicMuted.set(this.themePreset.preset() === 'serious'));
  }

  /** `true`, wenn eine Ansicht die bereits laufende Session übernimmt. */
  enter(code: string): boolean {
    code = normalizeHostSessionCode(code);
    if (code.length !== 6) return false;
    if (this.code === code) return true;
    this.leave();
    this.code = code;
    this.musicMuted.set(this.themePreset.preset() === 'serious');
    this.quickFeedbackMusicEnabled.set(false);
    return false;
  }

  keepOnly(code: string | null): void {
    if (code === null || this.code !== normalizeHostSessionCode(code)) this.leave();
  }

  ngOnDestroy(): void {
    this.leave();
  }

  isMuted(channel: SessionLiveChannel): boolean {
    return channel === 'quickFeedback' ? !this.quickFeedbackMusicEnabled() : this.musicMuted();
  }

  trackFor(phase: MusicPhase | null, channel: SessionLiveChannel): HostMusicTrack | null {
    if (!phase || channel === 'qa' || this.isMuted(channel) || this.mutedMusicPhases().has(phase)) {
      return null;
    }
    return this.phaseTracks()[phase];
  }

  savePhaseSettings(): void {
    persistPhaseMusicSettings(this.phaseTracks(), this.mutedMusicPhases());
  }

  sync(code: string, status: SessionInfoDTO['status'], track: HostMusicTrack | null): void {
    if (normalizeHostSessionCode(code) !== this.code) return;
    if (status !== 'ACTIVE') this.clearCountdown();
    if (status === 'FINISHED') {
      this.stop(code);
    } else if (!this.sound.musicPreviewing()) {
      if (track) {
        void this.sound.playMusic(track);
      } else {
        this.sound.stopMusic();
      }
    }
  }

  stop(code: string): void {
    if (normalizeHostSessionCode(code) !== this.code) return;
    this.clearCountdown();
    if (this.sound.musicPreviewing()) this.sound.stopPreview();
    this.sound.stopMusic();
  }

  resolveCountdownDeadline(
    code: string,
    options: Parameters<typeof stableCountdownDeadlineMs>[0],
  ): number {
    if (normalizeHostSessionCode(code) !== this.code) return stableCountdownDeadlineMs(options);
    const saved = this.countdown?.key === options.nextKey ? this.countdown : null;
    const deadlineMs = stableCountdownDeadlineMs(
      saved ? { ...options, currentDeadlineMs: saved.deadlineMs, currentKey: saved.key } : options,
    );
    const confirmed =
      saved?.confirmed === true || Number.isFinite(Date.parse(options.activeAt ?? ''));
    if (saved && saved.confirmed === confirmed) {
      saved.deadlineMs = deadlineMs;
    } else {
      if (!saved) this.clearCountdown();
      const remaining = remainingCountdownSeconds(deadlineMs, options.nowMs);
      this.countdown = {
        key: options.nextKey,
        deadlineMs,
        confirmed,
        // Bei einem Reload mitten in der Fingerphase den Gong nicht erneut spielen.
        gongPlayed: remaining <= 7 && remaining < options.timerSeconds - 1,
        whistlePlayed: remaining <= 0,
        cuesPreloaded: false,
      };
    }
    return deadlineMs;
  }

  hasCountdown(code: string, key: string): boolean {
    return normalizeHostSessionCode(code) === this.code && this.countdown?.key === key;
  }

  tickCountdown(code: string, deadlineMs: number, remaining: number, soundEffects: boolean): void {
    const countdown = this.countdown;
    if (normalizeHostSessionCode(code) !== this.code || countdown?.deadlineMs !== deadlineMs) {
      return;
    }
    this.fadeCountdownMusic(deadlineMs, remaining);
    // Ohne bestätigte Serverfrist dient der Countdown nur als Anzeige.
    if (!countdown.confirmed || !soundEffects || this.themePreset.preset() !== 'spielerisch') {
      return;
    }

    if (!countdown.cuesPreloaded) {
      countdown.cuesPreloaded = true;
      void this.sound.preload(['countdownEnd', 'sessionEnd']);
    }
    if (remaining <= 7 && remaining > 0 && !countdown.gongPlayed) {
      countdown.gongPlayed = true;
      void this.sound.play('countdownEnd', { gain: 0.32, fadeOutSeconds: 0.55 });
    }
    if (remaining <= 1 && !countdown.whistlePlayed) {
      countdown.whistlePlayed = true;
      void this.sound.play('sessionEnd', { gain: 0.4 });
    }
  }

  private fadeCountdownMusic(deadlineMs: number, remaining: number): void {
    if (
      remaining <= 10 &&
      remaining > 7 &&
      this.fadedCountdownDeadlineMs !== deadlineMs &&
      !this.sound.musicPreviewing() &&
      this.sound.musicPlaying()
    ) {
      this.fadedCountdownDeadlineMs = deadlineMs;
      this.sound.fadeOutMusic(Math.max(0.5, remaining - 7));
    }
  }

  private clearCountdown(): void {
    if (this.countdown) this.sound.stopAllSfx();
    this.countdown = null;
    this.fadedCountdownDeadlineMs = null;
  }

  private leave(): void {
    if (!this.code) return;
    this.stop(this.code);
    this.code = null;
  }
}
