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

export type MusicTrack = 'CALM_LOFI' | 'UPBEAT' | 'EPIC' | 'CHILL';

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

  unlock(): void {
    if (this.unlocked) return;
    const ctx = this.getContext();
    if (ctx?.state === 'suspended') {
      void ctx.resume();
    }
    this.unlocked = true;
  }

  async play(key: SoundKey): Promise<void> {
    const ctx = this.getContext();
    if (!ctx || ctx.state === 'suspended') return;

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

  /**
   * Story 5.3: Hintergrundmusik – aktuell deaktiviert.
   * Verhindert, dass irgendwo Musik gestartet wird; stoppt ggf. laufende.
   */
  async playMusic(_track: MusicTrack): Promise<void> {
    this.stopMusic();
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
