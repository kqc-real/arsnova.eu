import {
  Component,
  computed,
  input,
  linkedSignal,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { VOTE_FINGER_IMAGES, VOTE_FINGER_PRELOAD_INTERVAL_MS } from './countdown-fingers-preload';

const FINGER_IMAGES: Record<number, string> = {
  5: 'assets/countdown-fingers/countdown_poster_clean_5.png',
  4: 'assets/countdown-fingers/countdown_poster_clean_4.png',
  3: 'assets/countdown-fingers/countdown_poster_clean_3.png',
  2: 'assets/countdown-fingers/countdown_poster_clean_2.png',
  1: 'assets/countdown-fingers/countdown_poster_clean_1.png',
  0: 'assets/countdown-fingers/countdown_poster_clean_0.png',
};

@Component({
  selector: 'app-countdown-fingers',
  standalone: true,
  host: {
    '[class.countdown-fingers-host--viewport]': 'size() === "small"',
    '[class.countdown-fingers-host--present]': 'size() === "present"',
    '[class.countdown-fingers-host--loaded]': 'imageLoaded()',
  },
  template: `
    <div
      class="countdown-fingers"
      [class.countdown-fingers--large]="size() === 'large'"
      [class.countdown-fingers--small]="size() === 'small'"
      [class.countdown-fingers--present]="size() === 'present'"
      [hidden]="!imageLoaded()"
      [attr.role]="imageLoaded() ? 'img' : null"
      [attr.aria-label]="imageLoaded() ? ariaLabel() : null"
      [attr.aria-hidden]="imageLoaded() ? null : 'true'"
    >
      @for (frame of requestedFrames(); track frame) {
        <img
          [src]="fingerImages()[frame]"
          [attr.fetchpriority]="size() === 'small' ? 'low' : null"
          [hidden]="frame !== seconds()"
          alt=""
          aria-hidden="true"
          class="countdown-fingers__img"
          (load)="setFrameLoaded(frame, true)"
          (error)="setFrameLoaded(frame, false)"
        />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      :host.countdown-fingers-host--present {
        display: flex;
        align-items: center;
        justify-content: center;
        width: auto;
        height: min(41%, 24rem);
        max-width: 100%;
        min-height: 0;
      }

      :host.countdown-fingers-host--viewport {
        display: block;
        position: fixed;
        /* Bündig am unteren Viewport-Rand, kein Footer-/Safe-Area-Abstand */
        bottom: 0;
        /* Linke Flucht wie .vote-page-Inhalt (zentrierte Spalte + horizontales Padding), nicht Viewport-Kante */
        left: calc(
          (100vw - min(100vw, var(--vote-page-max-width, 36rem))) / 2 +
            max(var(--vote-page-inline-padding, 1rem), env(safe-area-inset-left, 0px))
        );
        z-index: 100;
        pointer-events: none;
      }

      .countdown-fingers {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: fit-content;
        max-width: max-content;
        background: transparent;
        pointer-events: none;
        user-select: none;
        transform-origin: bottom center;

        &[hidden] {
          display: none;
        }
      }

      .countdown-fingers__img {
        display: block;
        /* Assets sind einheitlich 568×1392 (Seitenverhältnis 142/348), Inhalt unten bündig. */
        object-fit: contain;
        object-position: bottom center;

        &[hidden] {
          display: none;
        }
      }

      .countdown-fingers--large {
        padding: 0;
        background: transparent;

        .countdown-fingers__img {
          /* Feste Box: gleicher Wechsel ohne Höhensprung (Asset-Seitenverhältnis 142/348). */
          width: 120px;
          height: calc(120px * 348 / 142);
          image-rendering: auto;
        }
      }

      .countdown-fingers--small {
        padding: 0;
        background: transparent;

        .countdown-fingers__img {
          /* Kompakt unten links; Asset unten bündig am Content. */
          width: 48px;
          height: calc(48px * 348 / 142);
        }
      }

      .countdown-fingers--present {
        width: auto;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        min-height: 0;
        padding: 0;
        background: transparent;

        .countdown-fingers__img {
          width: auto;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          aspect-ratio: 142 / 348;
          object-fit: contain;
          object-position: bottom center;
          image-rendering: auto;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .countdown-fingers {
          animation: finger-pop 300ms ease-out;
        }
      }

      @keyframes finger-pop {
        0% {
          opacity: 0;
          transform: scale(0.7);
        }
        60% {
          transform: scale(1.08);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
    `,
  ],
})
export class CountdownFingersComponent implements OnInit, OnDestroy {
  readonly seconds = input.required<number>();
  readonly size = input<'small' | 'large' | 'present'>('small');
  readonly fingerImages = computed(() =>
    this.size() === 'small' ? VOTE_FINGER_IMAGES : FINGER_IMAGES,
  );
  private readonly loadedFrames = signal<ReadonlySet<number>>(new Set());
  private readonly voteFrames = signal<readonly number[]>([]);
  private votePreloadTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly stageFrames = linkedSignal({
    source: this.seconds,
    computation: (seconds, previous): ReadonlySet<number> => {
      const frames = new Set(previous?.value);
      const current = Math.min(seconds, 5);
      // Keep loaded images mounted so changing seconds does not restart a browser image load.
      for (const frame of [current, current - 1]) {
        if (FINGER_IMAGES[frame]) frames.add(frame);
      }
      return frames;
    },
  });
  readonly requestedFrames = computed(() =>
    this.size() === 'small' ? this.voteFrames() : this.stageFrames(),
  );
  readonly imageLoaded = computed(() => this.loadedFrames().has(this.seconds()));

  ngOnInit(): void {
    if (this.size() !== 'small') return;
    let frame = Math.min(this.seconds(), VOTE_FINGER_IMAGES.length - 1);
    const requestNextFrame = () => {
      frame = Math.min(frame, this.seconds());
      if (frame < 0) return;
      const next = frame--;
      this.voteFrames.update((frames) => [...frames, next]);
      if (frame >= 0) {
        this.votePreloadTimer = setTimeout(requestNextFrame, VOTE_FINGER_PRELOAD_INTERVAL_MS);
      }
    };
    requestNextFrame();
  }

  ngOnDestroy(): void {
    clearTimeout(this.votePreloadTimer);
  }

  setFrameLoaded(frame: number, loaded: boolean): void {
    this.loadedFrames.update((current) => {
      const frames = new Set(current);
      if (loaded) frames.add(frame);
      else frames.delete(frame);
      return frames;
    });
  }

  ariaLabel(): string {
    const seconds = this.seconds();
    return seconds === 1
      ? $localize`:@@countdownFingers.ariaOne:1 Sekunde, durch einen Finger dargestellt`
      : $localize`:@@countdownFingers.ariaMany:${seconds}:seconds: Sekunden, durch Finger dargestellt`;
  }
}
