import { Injectable, signal } from '@angular/core';

export type SoundKey = 'sessionEnd' | 'questionStart' | 'countdownEnd';

const SOUND_PATHS: Record<SoundKey, string> = {
  sessionEnd: 'assets/sound/countdownEnd/Song0.mp3',
  questionStart: 'assets/sound/connecting/Song0.mp3',
  countdownEnd: 'assets/sound/countdownEnd/Song1.mp3',
};

const MUSIC_PATHS: Record<string, string> = {
  LOBBY_0: 'assets/sound/lobby/Song0.mp3',
  LOBBY_1: 'assets/sound/lobby/Song1.mp3',
  LOBBY_2: 'assets/sound/lobby/Song2.mp3',
  LOBBY_3: 'assets/sound/lobby/Song3.mp3',
  CONNECTING_0: 'assets/sound/connecting/Song0.mp3',
  COUNTDOWN_RUNNING_0: 'assets/sound/countdownRunning/Song0.mp3',
  COUNTDOWN_RUNNING_1: 'assets/sound/countdownRunning/Song1.mp3',
  COUNTDOWN_RUNNING_2: 'assets/sound/countdownRunning/Song2.mp3',
};

/**
 * Zentraler Audio-Service (Story 5.1). Nutzt die Web Audio API und
 * respektiert die Browser-Autoplay-Policy: Audio-Context wird erst
 * nach dem ersten User-Gesture (click/keydown) aktiviert.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private unlocked = false;

  /** Alle aktiven Sound-Effekt-Nodes (damit sie gestoppt werden können). */
  private readonly activeSfxNodes = new Set<AudioBufferSourceNode>();

  /** Story 5.3: Hintergrundmusik (Stopp-Logik bleibt für setMusicVolume/stopMusic) */
  private musicGain: GainNode | null = null;
  private musicGeneration = 0;
  private currentMusicTrack: string | null = null;
  private pendingMusicTrack: string | null = null;
  private readonly activeMusicNodes = new Set<AudioBufferSourceNode>();
  readonly musicPlaying = signal(false);
  readonly musicVolume = signal(80);

  /** True, solange ein Menü-Vorschau-Clip läuft (blockiert syncMusic im Host). */
  readonly musicPreviewing = signal(false);
  /** Welcher Track gerade vorgehört wird (für Play/Stop-UI), sonst null. */
  readonly musicPreviewTrackId = signal<string | null>(null);
  private previewRunId = 0;
  private previewSource: AudioBufferSourceNode | null = null;
  private previewGain: GainNode | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private async ensureContextRunning(): Promise<AudioContext | null> {
    const ctx = this.getContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return null;
      }
    }
    return ctx.state === 'running' ? ctx : null;
  }

  unlock(): void {
    if (this.unlocked) return;
    void this.ensureContextRunning();
    this.unlocked = true;
  }

  async play(key: SoundKey): Promise<void> {
    const ctx = await this.ensureContextRunning();
    if (!ctx) return;

    const path = SOUND_PATHS[key];
    if (!path) return;

    let buffer = this.buffers.get(path);
    if (!buffer) {
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(path, buffer);
      } catch {
        return;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    this.activeSfxNodes.add(source);
    source.onended = () => this.activeSfxNodes.delete(source);
  }

  /** Stoppt alle laufenden Sound-Effekte sofort. */
  stopAllSfx(): void {
    for (const node of this.activeSfxNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.activeSfxNodes.clear();
  }

  /** Startet (oder hält) loopende Hintergrundmusik für den gewünschten Track. */
  async playMusic(track: string): Promise<void> {
    const ctx = await this.ensureContextRunning();
    if (!ctx) return;
    const path = MUSIC_PATHS[track];
    if (!path) {
      this.stopMusic();
      return;
    }
    if (this.musicPlaying() && this.currentMusicTrack === track && this.activeMusicNodes.size > 0) {
      return;
    }
    if (this.pendingMusicTrack === track) {
      return;
    }

    this.stopMusic();
    const generation = this.musicGeneration;
    this.pendingMusicTrack = track;

    let buffer = this.buffers.get(path);
    if (!buffer) {
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(path, buffer);
      } catch {
        if (generation === this.musicGeneration) {
          this.pendingMusicTrack = null;
        }
        return;
      }
    }
    if (generation !== this.musicGeneration || !buffer) {
      if (generation === this.musicGeneration) {
        this.pendingMusicTrack = null;
      }
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = this.musicVolume() / 100;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);

    this.musicGain = gain;
    this.currentMusicTrack = track;
    this.activeMusicNodes.add(source);
    this.musicPlaying.set(true);
    this.pendingMusicTrack = null;
    source.onended = () => this.activeMusicNodes.delete(source);
  }

  stopMusic(): void {
    this.musicGeneration++;
    for (const node of this.activeMusicNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.activeMusicNodes.clear();
    if (this.musicGain) {
      try {
        this.musicGain.disconnect();
      } catch {
        /* noop */
      }
    }
    this.musicGain = null;
    this.currentMusicTrack = null;
    this.pendingMusicTrack = null;
    this.musicPlaying.set(false);
  }

  /** Bricht eine laufende Musik-Vorschau ab (ohne Callback). */
  stopPreview(): void {
    this.previewRunId++;
    if (this.previewSource) {
      try {
        this.previewSource.stop();
        this.previewSource.disconnect();
      } catch {
        /* already stopped */
      }
      this.previewSource = null;
    }
    if (this.previewGain) {
      try {
        this.previewGain.disconnect();
      } catch {
        /* noop */
      }
      this.previewGain = null;
    }
    this.musicPreviewing.set(false);
    this.musicPreviewTrackId.set(null);
  }

  /**
   * Spielt einen Track einmalig bis max. `maxSeconds` (kein Loop).
   * Stoppt die laufende Hintergrundmusik; `onEnd` nach Ende oder Abbruch.
   */
  previewMusic(track: string, maxSeconds = 12, onEnd?: () => void): void {
    this.stopPreview();
    this.stopMusic();
    const runId = ++this.previewRunId;
    this.musicPreviewing.set(true);
    this.musicPreviewTrackId.set(track);
    void this.runMusicPreview(track, maxSeconds, runId, onEnd);
  }

  private async runMusicPreview(
    track: string,
    maxSeconds: number,
    runId: number,
    onEnd?: () => void,
  ): Promise<void> {
    const finish = () => {
      if (runId !== this.previewRunId) return;
      this.previewSource = null;
      if (this.previewGain) {
        try {
          this.previewGain.disconnect();
        } catch {
          /* noop */
        }
        this.previewGain = null;
      }
      this.musicPreviewing.set(false);
      this.musicPreviewTrackId.set(null);
      onEnd?.();
    };

    const ctx = await this.ensureContextRunning();
    if (!ctx || runId !== this.previewRunId) {
      finish();
      return;
    }

    const path = MUSIC_PATHS[track];
    if (!path) {
      this.musicPreviewing.set(false);
      this.musicPreviewTrackId.set(null);
      onEnd?.();
      return;
    }

    let buffer = this.buffers.get(path);
    if (!buffer) {
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(path, buffer);
      } catch {
        finish();
        return;
      }
    }

    if (!buffer || runId !== this.previewRunId) {
      finish();
      return;
    }

    const slice = Math.min(buffer.duration, maxSeconds);
    if (slice <= 0) {
      finish();
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    const gain = ctx.createGain();
    gain.gain.value = this.musicVolume() / 100;
    source.connect(gain);
    gain.connect(ctx.destination);

    this.previewSource = source;
    this.previewGain = gain;

    source.onended = () => finish();

    try {
      source.start(0, 0, slice);
    } catch {
      finish();
    }
  }

  /** Stoppt ALLES – Sound-Effekte, Vorschau und Musik. */
  stopAll(): void {
    this.stopPreview();
    this.stopAllSfx();
    this.stopMusic();
  }

  setMusicVolume(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.musicVolume.set(clamped);
    if (this.musicGain) {
      this.musicGain.gain.value = clamped / 100;
    }
  }
}
