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

  constructor() {
    FakeMusicAudio.instances.push(this);
  }

  setAttribute(): void {
    /* playsinline */
  }

  async play(): Promise<void> {
    this.playCount += 1;
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
});
