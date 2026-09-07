import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundService } from './sound.service';

describe('SoundService', () => {
  const originalAudioContext = globalThis.AudioContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
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

    const service = new SoundService();
    service.setOutputEnabled(false);
    await service.play('questionStart');
    await service.playMusic('LOBBY_0');
    expect(decodeAudioData).not.toHaveBeenCalled();
    expect(service.outputEnabled()).toBe(false);
  });
});
