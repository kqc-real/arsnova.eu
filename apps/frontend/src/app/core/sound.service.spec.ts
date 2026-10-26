import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundService } from './sound.service';

class FakeMusicAudio {
  static instances: FakeMusicAudio[] = [];

  src = '';
  loop = false;
  volume = 1;
  paused = true;
  ended = false;
  currentTime = 0;
  preload = '';
  onended: (() => void) | null = null;
  playCount = 0;
  static playGate: (() => Promise<void>) | null = null;

  constructor() {
    FakeMusicAudio.instances.push(this);
  }

  setAttribute(): void {
    /* playsinline */
  }

  async play(): Promise<void> {
    this.playCount += 1;
    if (FakeMusicAudio.playGate) {
      await FakeMusicAudio.playGate();
    }
    this.paused = false;
    this.ended = false;
  }

  pause(): void {
    this.paused = true;
  }
}

describe('SoundService', () => {
  const originalAudioContext = globalThis.AudioContext;
  const originalAudio = globalThis.Audio;

  beforeEach(() => {
    vi.restoreAllMocks();
    FakeMusicAudio.instances = [];
    FakeMusicAudio.playGate = null;
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    globalThis.Audio = originalAudio;
  });

  it('erlaubt einen erneuten Unlock-Versuch nach blockierter Autoplay-Freigabe', async () => {
    let resumeAttempts = 0;

    class FakeAudioContext {
      state: AudioContextState = 'suspended';

      async resume(): Promise<void> {
        resumeAttempts += 1;
        if (resumeAttempts === 1) {
          throw new Error('blocked');
        }
        this.state = 'running';
      }
    }

    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;

    const service = new SoundService();

    service.unlock();
    await Promise.resolve();
    await Promise.resolve();

    expect((service as unknown as { unlocked: boolean }).unlocked).toBe(false);

    service.unlock();
    await Promise.resolve();
    await Promise.resolve();

    expect(resumeAttempts).toBe(2);
    expect((service as unknown as { unlocked: boolean }).unlocked).toBe(true);
  });

  it('spielt ohne Ausgabe nichts ab, wenn der Ausgang aus ist', async () => {
    const decodeAudioData = vi.fn();
    class FakeAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      destination = {} as AudioDestinationNode;
      async resume(): Promise<void> {
        this.state = 'running';
      }
      createBufferSource(): AudioBufferSourceNode {
        throw new Error('output disabled');
      }
      createGain(): GainNode {
        throw new Error('output disabled');
      }
      decodeAudioData = decodeAudioData;
    }
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    globalThis.Audio = function Audio(): never {
      throw new Error('Audio sollte bei stummer Ausgabe nicht entstehen');
    } as unknown as typeof Audio;

    const service = new SoundService();
    service.setOutputEnabled(false);
    await service.play('questionStart');
    await service.playMusic('LOBBY_0');
    expect(decodeAudioData).not.toHaveBeenCalled();
    expect(service.outputEnabled()).toBe(false);
  });

  it('setzt laufende Hintergrundmusik nicht an den Anfang zurück', async () => {
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;
    const service = new SoundService();

    await service.playMusic('LOBBY_0');
    const el = FakeMusicAudio.instances[0];
    expect(el).toBeDefined();
    el.currentTime = 12.5;

    await service.playMusic('LOBBY_0');

    expect(el.currentTime).toBe(12.5);
    expect(el.playCount).toBe(1);
    expect(el.loop).toBe(true);
    expect(service.musicPlaying()).toBe(true);
  });

  it('setzt unterbrochene Hintergrundmusik fort, ohne an den Anfang zu springen', async () => {
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;
    const service = new SoundService();

    await service.playMusic('LOBBY_0');
    const el = FakeMusicAudio.instances[0];
    el.currentTime = 8;
    el.ended = true;
    el.pause();

    await service.playMusic('LOBBY_0');

    expect(el.currentTime).toBe(8);
    expect(el.paused).toBe(false);
    expect(el.playCount).toBe(2);
  });

  it('setzt musicPlaying nach stopMusic nicht aus einem alten play() zurück', async () => {
    let release = (): void => undefined;
    let gated = false;
    FakeMusicAudio.playGate = () => {
      if (gated) {
        return Promise.resolve();
      }
      gated = true;
      return Promise.resolve();
    };
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;
    const service = new SoundService();
    await service.playMusic('LOBBY_0');

    FakeMusicAudio.playGate = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const el = FakeMusicAudio.instances[0];
    el.currentTime = 4;
    el.pause();
    const pending = service.playMusic('LOBBY_0');
    service.stopMusic();
    release();
    await pending;

    expect(service.musicPlaying()).toBe(false);
  });

  it('pausiert einen neueren Track nicht, wenn ein älteres play() endet', async () => {
    let releaseFirst = (): void => undefined;
    let playCalls = 0;
    FakeMusicAudio.playGate = () => {
      playCalls += 1;
      if (playCalls === 1) {
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve();
    };
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;
    const service = new SoundService();

    const first = service.playMusic('LOBBY_0');
    await vi.waitUntil(() => playCalls === 1);
    const second = service.playMusic('LOBBY_1');
    await second;
    releaseFirst();
    await first;

    const el = FakeMusicAudio.instances[0];
    expect(el.paused).toBe(false);
    expect(el.src).toContain('Song1.mp3');
    expect(service.musicPlaying()).toBe(true);
  });

  it('pausiert eine neuere Vorschau nicht, wenn ein älteres play() endet', async () => {
    let releaseFirst = (): void => undefined;
    let playCalls = 0;
    FakeMusicAudio.playGate = () => {
      playCalls += 1;
      if (playCalls === 1) {
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve();
    };
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;
    const service = new SoundService();

    service.previewMusic('LOBBY_0', 12);
    await vi.waitUntil(() => playCalls === 1);
    service.previewMusic('LOBBY_1', 12);
    await vi.waitUntil(() => playCalls === 2);
    releaseFirst();
    await Promise.resolve();

    const el = FakeMusicAudio.instances[0];
    expect(el.paused).toBe(false);
    expect(service.musicPreviewTrackId()).toBe('LOBBY_1');
  });

  it('gibt das Media-Element in der Nutzeraktion frei', () => {
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;
    const service = new SoundService();

    service.unlock();

    const el = FakeMusicAudio.instances[0];
    expect(el.playCount).toBe(1);
    expect(el.src).toContain('data:audio/wav');
  });

  it('regelt die Lautstärke über den Gain-Knoten', async () => {
    const gainParam = {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    };
    class FakeAudioContext {
      state: AudioContextState = 'running';
      currentTime = 3;
      destination = {} as AudioDestinationNode;
      async resume(): Promise<void> {
        this.state = 'running';
      }
      createMediaElementSource(): MediaElementAudioSourceNode {
        return { connect: () => undefined } as unknown as MediaElementAudioSourceNode;
      }
      createGain(): GainNode {
        return {
          gain: gainParam,
          connect: () => undefined,
        } as unknown as GainNode;
      }
    }
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    globalThis.Audio = FakeMusicAudio as unknown as typeof Audio;
    const service = new SoundService();

    await service.playMusic('LOBBY_0');
    service.setMusicVolume(40);
    service.fadeOutMusic(2);

    expect(gainParam.value).toBe(0.4);
    expect(FakeMusicAudio.instances[0].volume).toBe(1);
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalledWith(0, 5);
  });
});
