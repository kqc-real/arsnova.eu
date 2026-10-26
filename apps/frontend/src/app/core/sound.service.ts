import { Injectable, signal } from '@angular/core';

export type SoundKey = 'sessionEnd' | 'questionStart' | 'countdownEnd';

const SOUND_PATHS: Record<SoundKey, string> = {
  sessionEnd: 'assets/sound/countdownEnd/Song0.mp3',
  questionStart: 'assets/sound/connecting/Song0.mp3',
  countdownEnd: 'assets/sound/countdownEnd/Song1.mp3',
};

/** Kurzer stiller Clip, damit die erste Nutzeraktion das Media-Element freigibt. */
const MUSIC_UNLOCK_SRC =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

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
  private musicSource: MediaElementAudioSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicElementPrimed = false;
  private musicGeneration = 0;
  private musicPlaybackOwner = 0;
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
    if (!this.outputEnabled()) {
      if (!this.unlocked) {
        void this.tryUnlockContext();
      }
      return;
    }
    // play() muss in der Nutzeraktion selbst starten. Ein await davor verlässt die Geste.
    this.attachMusicGain();
    this.primeMusicElementInGesture();
    if (!this.unlocked) {
      void this.tryUnlockContext();
    }
  }

  private async tryUnlockContext(): Promise<void> {
    const ctx = await this.ensureContextRunning();
    if (ctx) {
      this.unlocked = true;
      this.attachMusicGain();
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
        const owner = this.claimMusicPlayback();
        try {
          await el.play();
        } catch {
          return;
        }
        if (owner !== this.musicPlaybackOwner) {
          this.pauseMusicElementIfAbandoned(el);
          return;
        }
        this.musicPlaying.set(true);
        return;
      }
    }
    if (this.pendingMusicTrack === track) {
      return;
    }

    this.stopMusic();
    const generation = this.musicGeneration;
    const owner = this.claimMusicPlayback();
    this.pendingMusicTrack = track;
    this.attachMusicGain();
    this.prepareMusicElement(el, path, true);
    try {
      await el.play();
    } catch {
      if (generation === this.musicGeneration) {
        this.pendingMusicTrack = null;
      } else {
        this.pauseMusicElementIfAbandoned(el);
      }
      return;
    }
    if (owner !== this.musicPlaybackOwner) {
      this.pauseMusicElementIfAbandoned(el);
      return;
    }
    this.currentMusicTrack = track;
    this.musicPlaying.set(true);
    this.pendingMusicTrack = null;
  }

  stopMusic(): void {
    this.musicGeneration++;
    this.musicPlaybackOwner++;
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

  /** Ein veraltetes play() darf nur pausieren, wenn niemand das Element übernommen hat. */
  private pauseMusicElementIfAbandoned(el: HTMLAudioElement): void {
    if (this.musicEl !== el) return;
    if (
      this.currentMusicTrack !== null ||
      this.pendingMusicTrack !== null ||
      this.musicPreviewing()
    ) {
      return;
    }
    el.pause();
  }

  private claimMusicPlayback(): number {
    this.musicPlaybackOwner += 1;
    return this.musicPlaybackOwner;
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
    const duration = Math.max(0.05, durationSeconds);
    const gain = this.musicGain;
    const ctx = this.ctx;
    if (gain && ctx) {
      const now = ctx.currentTime;
      const current = gain.gain.value;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(current, now);
        gain.gain.linearRampToValueAtTime(0, now + duration);
      } catch {
        gain.gain.value = 0;
      }
      return;
    }
    const startVolume = el.volume;
    const durationMs = duration * 1000;
    const startedAt = globalThis.performance?.now() ?? Date.now();
    const step = (now: number): void => {
      if (this.musicEl !== el || this.musicGain) {
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
    this.musicPlaybackOwner++;
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

    this.attachMusicGain();
    this.prepareMusicElement(el, path, false);
    el.onended = () => finish();
    const owner = this.claimMusicPlayback();
    try {
      await el.play();
    } catch {
      if (runId !== this.previewRunId) {
        this.pauseMusicElementIfAbandoned(el);
        return;
      }
      finish();
      return;
    }
    if (runId !== this.previewRunId || owner !== this.musicPlaybackOwner) {
      this.pauseMusicElementIfAbandoned(el);
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
    this.applyMusicVolume();
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
    el.onended = null;
    if (this.musicElementPath !== path) {
      el.src = path;
      this.musicElementPath = path;
    }
    this.applyMusicVolume();
    try {
      el.currentTime = 0;
    } catch {
      /* Metadaten noch nicht da */
    }
  }

  /**
   * iOS Safari ignoriert `HTMLMediaElement.volume`. Die Lautstärke und das
   * Ausblenden laufen deshalb über einen Gain-Knoten am Media-Element.
   */
  private attachMusicGain(): void {
    if (this.musicGain || this.musicSource) return;
    const el = this.ensureMusicElement();
    const ctx = this.getContext();
    if (!el || !ctx || typeof ctx.createMediaElementSource !== 'function') return;
    try {
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = this.musicVolume() / 100;
      source.connect(gain);
      gain.connect(ctx.destination);
      this.musicSource = source;
      this.musicGain = gain;
      el.volume = 1;
    } catch {
      this.musicSource = null;
      this.musicGain = null;
    }
  }

  private applyMusicVolume(): void {
    const level = this.musicVolume() / 100;
    if (this.musicGain) {
      this.musicGain.gain.value = level;
      if (this.musicEl) {
        this.musicEl.volume = 1;
      }
      return;
    }
    if (this.musicEl) {
      this.musicEl.volume = level;
    }
  }

  private primeMusicElementInGesture(): void {
    if (this.musicElementPrimed) return;
    const el = this.ensureMusicElement();
    if (!el) return;
    if (!el.src) {
      el.src = MUSIC_UNLOCK_SRC;
    }
    try {
      void el
        .play()
        .then(() => {
          this.musicElementPrimed = true;
          if (!this.currentMusicTrack && !this.pendingMusicTrack && !this.musicPreviewing()) {
            el.pause();
          }
        })
        .catch(() => undefined);
    } catch {
      /* Autoplay */
    }
  }

  private cancelMusicFade(): void {
    if (this.musicFadeFrame !== null) {
      globalThis.cancelAnimationFrame(this.musicFadeFrame);
      this.musicFadeFrame = null;
    }
    if (this.musicGain && this.ctx) {
      try {
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      } catch {
        /* noop */
      }
    }
  }

  private clearPreviewTimer(): void {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }
}
