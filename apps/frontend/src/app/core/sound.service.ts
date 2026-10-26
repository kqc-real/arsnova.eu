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
  READING_0: 'assets/sound/connecting/Song0.mp3',
  COUNTDOWN_0: 'assets/sound/countdownRunning/Song0.mp3',
  COUNTDOWN_1: 'assets/sound/countdownRunning/Song1.mp3',
  COUNTDOWN_2: 'assets/sound/countdownRunning/Song2.mp3',
};

/**
 * Zentraler Audio-Service (Story 5.1). Nutzt die Web Audio API und
 * respektiert die Browser-Autoplay-Policy: Audio-Context wird erst
 * nach dem ersten User-Gesture (click/keydown) aktiviert.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private unlocked = false;

  /** Alle aktiven Sound-Effekt-Nodes (damit sie gestoppt werden können). */
  private readonly activeSfxNodes = new Set<AudioBufferSourceNode>();

  /**
   * Hintergrundmusik läuft über ein Media-Element, nicht über AudioBufferSourceNode.
   * Auf Chrome für Android beendet die Web-Audio-Schleife lange Tracks nach wenigen
   * Sekunden. Der Host prüft die Musik alle paar Sekunden nach und würde den Puffer
   * dann wieder bei 0 starten.
   */
  private musicEl: HTMLAudioElement | null = null;
  private musicElementPath: string | null = null;
  private musicGeneration = 0;
  private musicFadeFrame: number | null = null;
  private currentMusicTrack: string | null = null;
  private pendingMusicTrack: string | null = null;
  readonly musicPlaying = signal(false);
  readonly musicVolume = signal(80);

  /** True, solange ein Menü-Vorschau-Clip läuft (blockiert syncMusic im Host). */
  readonly musicPreviewing = signal(false);
  /** Welcher Track gerade vorgehört wird (für Play/Stop-UI), sonst null. */
  readonly musicPreviewTrackId = signal<string | null>(null);
  /** Paired Host startet stumm; Steuerdaten bleiben unverändert. */
  readonly outputEnabled = signal(true);

  setOutputEnabled(enabled: boolean): void {
    this.outputEnabled.set(enabled);
    if (!enabled) {
      this.stopAll();
    }
  }
  private previewRunId = 0;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  private getContext(): AudioContext | null {
    if (globalThis.window === undefined) return null;
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
    void this.tryUnlockContext();
  }

  private async tryUnlockContext(): Promise<void> {
    const ctx = await this.ensureContextRunning();
    if (ctx) {
      this.unlocked = true;
    }
  }

  async play(
    key: SoundKey,
    opts?: { gain?: number; fadeInSeconds?: number; fadeOutSeconds?: number },
  ): Promise<void> {
    if (!this.outputEnabled()) return;
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

    const peak =
      typeof opts?.gain === 'number' && Number.isFinite(opts.gain) ? Math.max(0, opts.gain) : 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    // Kurze Ein-/Ausblendung vermeidet Klicks an harten Sample-Rändern (z. B. Gong).
    const now = ctx.currentTime;
    const duration = Math.max(buffer.duration, 0.05);
    const fadeIn = Math.min(
      typeof opts?.fadeInSeconds === 'number' && Number.isFinite(opts.fadeInSeconds)
        ? Math.max(0, opts.fadeInSeconds)
        : 0.012,
      duration / 4,
    );
    const fadeOut = Math.min(
      typeof opts?.fadeOutSeconds === 'number' && Number.isFinite(opts.fadeOutSeconds)
        ? Math.max(0, opts.fadeOutSeconds)
        : 0.14,
      duration * 0.6,
    );
    gain.gain.setValueAtTime(0, now);
    if (fadeIn > 0) {
      gain.gain.linearRampToValueAtTime(peak, now + fadeIn);
    } else {
      gain.gain.setValueAtTime(peak, now);
    }
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(peak, Math.max(now + fadeIn, now + duration - fadeOut));
      gain.gain.linearRampToValueAtTime(0, now + duration);
    }
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);

    this.activeSfxNodes.add(source);
    source.onended = () => this.activeSfxNodes.delete(source);
  }

  /** Lädt SFX-Buffer vor, damit Countdown-Cues ohne Fetch-Verzögerung starten. */
  async preload(keys: readonly SoundKey[]): Promise<void> {
    const ctx = await this.ensureContextRunning();
    if (!ctx) return;
    await Promise.all(
      keys.map(async (key) => {
        const path = SOUND_PATHS[key];
        if (!path || this.buffers.has(path)) return;
        try {
          const response = await fetch(path);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(path, buffer);
        } catch {
          /* best effort */
        }
      }),
    );
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
    if (!this.outputEnabled()) return;
    const path = MUSIC_PATHS[track];
    if (!path) {
      this.stopMusic();
      return;
    }
    const el = this.ensureMusicElement();
    if (!el) return;

    if (this.currentMusicTrack === track && this.musicElementPath === path) {
      if (!el.paused && !el.ended) {
        return;
      }
      // Chrome auf Android pausiert oder beendet das Element, lässt currentTime aber stehen.
      // play() bei ended springt sonst an den Anfang, auch mitten im Track.
      if (el.currentTime > 0) {
        const position = el.currentTime;
        if (el.ended) {
          try {
            el.currentTime = position;
          } catch {
            /* Metadaten noch nicht da */
          }
        }
        try {
          await el.play();
          this.musicPlaying.set(true);
        } catch {
          /* Autoplay oder Unterbrechung */
        }
        return;
      }
    }
    if (this.pendingMusicTrack === track) {
      return;
    }

    this.stopMusic();
    const generation = this.musicGeneration;
    this.pendingMusicTrack = track;
    this.prepareMusicElement(el, path, true);
    try {
      await el.play();
    } catch {
      if (generation === this.musicGeneration) {
        this.pendingMusicTrack = null;
      }
      return;
    }
    if (generation !== this.musicGeneration) {
      el.pause();
      return;
    }
    this.currentMusicTrack = track;
    this.musicPlaying.set(true);
    this.pendingMusicTrack = null;
  }

  stopMusic(): void {
    this.musicGeneration++;
    this.cancelMusicFade();
    const el = this.musicEl;
    if (el) {
      el.onended = null;
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* Metadaten noch nicht da */
      }
    }
    this.currentMusicTrack = null;
    this.pendingMusicTrack = null;
    this.musicPlaying.set(false);
  }

  /**
   * Blendet laufende Hintergrundmusik über `durationSeconds` auf 0 aus.
   * Stoppt das Element nicht – der Host setzt danach die SFX-Phase oder stopMusic.
   */
  fadeOutMusic(durationSeconds: number): void {
    const el = this.musicEl;
    if (!el || !this.musicPlaying() || el.paused) {
      return;
    }
    this.cancelMusicFade();
    const startVolume = el.volume;
    const durationMs = Math.max(0.05, durationSeconds) * 1000;
    const startedAt = globalThis.performance?.now() ?? Date.now();
    const step = (now: number): void => {
      if (this.musicEl !== el) {
        return;
      }
      const progress = Math.min(1, (now - startedAt) / durationMs);
      el.volume = startVolume * (1 - progress);
      if (progress < 1) {
        this.musicFadeFrame = globalThis.requestAnimationFrame(step);
      } else {
        this.musicFadeFrame = null;
      }
    };
    this.musicFadeFrame = globalThis.requestAnimationFrame(step);
  }

  /** Bricht eine laufende Musik-Vorschau ab (ohne Callback). */
  stopPreview(): void {
    this.previewRunId++;
    this.clearPreviewTimer();
    const wasPreviewing = this.musicPreviewing();
    this.musicPreviewing.set(false);
    this.musicPreviewTrackId.set(null);
    if (wasPreviewing && this.musicEl) {
      this.musicEl.onended = null;
      this.musicEl.pause();
    }
  }

  /**
   * Spielt einen Track einmalig bis max. `maxSeconds` (kein Loop).
   * Stoppt die laufende Hintergrundmusik; `onEnd` nach Ende oder Abbruch.
   */
  previewMusic(track: string, maxSeconds = 12, onEnd?: () => void): void {
    if (!this.outputEnabled()) {
      onEnd?.();
      return;
    }
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
    const finish = (): void => {
      if (runId !== this.previewRunId) return;
      this.previewRunId++;
      this.clearPreviewTimer();
      if (this.musicEl) {
        this.musicEl.onended = null;
      }
      this.musicPreviewing.set(false);
      this.musicPreviewTrackId.set(null);
      onEnd?.();
    };

    const path = MUSIC_PATHS[track];
    const el = this.ensureMusicElement();
    if (!path || !el || runId !== this.previewRunId) {
      finish();
      return;
    }

    const sliceMs = Math.max(0, maxSeconds) * 1000;
    if (sliceMs <= 0) {
      finish();
      return;
    }

    this.prepareMusicElement(el, path, false);
    el.onended = () => finish();
    try {
      await el.play();
    } catch {
      finish();
      return;
    }
    if (runId !== this.previewRunId) {
      el.pause();
      return;
    }

    this.previewTimer = setTimeout(() => {
      if (runId !== this.previewRunId) return;
      el.pause();
      finish();
    }, sliceMs);
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
    this.cancelMusicFade();
    if (this.musicEl) {
      this.musicEl.volume = clamped / 100;
    }
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (globalThis.window === undefined) return null;
    if (!this.musicEl) {
      try {
        this.musicEl = new Audio();
      } catch {
        return null;
      }
      this.musicEl.preload = 'auto';
      this.musicEl.setAttribute('playsinline', 'true');
    }
    return this.musicEl;
  }

  /** Neuer Start. Laufende Wiedergabe desselben Tracks geht nicht hier durch. */
  private prepareMusicElement(el: HTMLAudioElement, path: string, loop: boolean): void {
    this.cancelMusicFade();
    el.loop = loop;
    el.volume = this.musicVolume() / 100;
    el.onended = null;
    if (this.musicElementPath !== path) {
      el.src = path;
      this.musicElementPath = path;
    }
    try {
      el.currentTime = 0;
    } catch {
      /* Metadaten noch nicht da */
    }
  }

  private cancelMusicFade(): void {
    if (this.musicFadeFrame !== null) {
      globalThis.cancelAnimationFrame(this.musicFadeFrame);
      this.musicFadeFrame = null;
    }
  }

  private clearPreviewTimer(): void {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }
}
