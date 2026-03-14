import { Injectable, signal } from '@angular/core';

export type SoundKey =
  | 'sessionEnd'
  | 'questionStart'
  | 'countdownTick'
  | 'countdownEnd';

const SOUND_PATHS: Record<SoundKey, string> = {
  sessionEnd: 'assets/sound/countdownEnd/Song0.mp3',
  questionStart: 'assets/sound/connecting/Song0.mp3',
  countdownTick: 'assets/sound/countdownRunning/Song0.mp3',
  countdownEnd: 'assets/sound/countdownEnd/Song1.mp3',
};

export type MusicTrack = 'CALM_LOFI' | 'UPBEAT_POP' | 'FOCUS_AMBIENT' | 'UPBEAT' | 'EPIC' | 'CHILL';
const MUSIC_PATHS: Record<string, string> = {
  LOBBY_0: 'assets/sound/lobby/Song0.mp3',
  LOBBY_1: 'assets/sound/lobby/Song1.mp3',
  LOBBY_2: 'assets/sound/lobby/Song2.mp3',
  LOBBY_3: 'assets/sound/lobby/Song3.mp3',
  CONNECTING_0: 'assets/sound/connecting/Song0.mp3',
  COUNTDOWN_RUNNING_0: 'assets/sound/countdownRunning/Song0.mp3',
  COUNTDOWN_RUNNING_1: 'assets/sound/countdownRunning/Song1.mp3',
  COUNTDOWN_RUNNING_2: 'assets/sound/countdownRunning/Song2.mp3',
  CALM_LOFI: 'assets/sound/lobby/Song0.mp3',
  UPBEAT_POP: 'assets/sound/lobby/Song1.mp3',
  FOCUS_AMBIENT: 'assets/sound/lobby/Song2.mp3',
  UPBEAT: 'assets/sound/lobby/Song1.mp3',
  CHILL: 'assets/sound/lobby/Song0.mp3',
  EPIC: 'assets/sound/lobby/Song3.mp3',
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
  private readonly activeMusicNodes = new Set<AudioBufferSourceNode>();
  readonly musicPlaying = signal(false);
  readonly musicVolume = signal(80);

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
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
      try { node.stop(); node.disconnect(); } catch { /* already stopped */ }
    }
    this.activeSfxNodes.clear();
  }

  /** Startet (oder hält) loopende Hintergrundmusik für den gewünschten Track. */
  async playMusic(track: MusicTrack | string): Promise<void> {
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

    this.stopMusic();
    const generation = this.musicGeneration;

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
    if (generation !== this.musicGeneration || !buffer) {
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
    source.onended = () => this.activeMusicNodes.delete(source);
  }

  stopMusic(): void {
    this.musicGeneration++;
    for (const node of this.activeMusicNodes) {
      try { node.stop(); node.disconnect(); } catch { /* already stopped */ }
    }
    this.activeMusicNodes.clear();
    if (this.musicGain) {
      try { this.musicGain.disconnect(); } catch { /* noop */ }
    }
    this.musicGain = null;
    this.currentMusicTrack = null;
    this.musicPlaying.set(false);
  }

  /** Stoppt ALLES – Sound-Effekte und Musik. */
  stopAll(): void {
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
