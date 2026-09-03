import { Component, computed, input } from '@angular/core';

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
  },
  template: `
    @if (imageSrc()) {
      <div
        class="countdown-fingers"
        [class.countdown-fingers--large]="size() === 'large'"
        [class.countdown-fingers--small]="size() === 'small'"
        [class.countdown-fingers--present]="size() === 'present'"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <img [src]="imageSrc()" alt="" aria-hidden="true" class="countdown-fingers__img" />
      </div>
    }
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
        width: 100%;
        height: 100%;
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
      }

      .countdown-fingers__img {
        display: block;
        object-fit: contain;
      }

      .countdown-fingers--large {
        padding: 0.45rem 0.45rem 0;
        border-radius: var(--mat-sys-corner-extra-large, 1.5rem)
          var(--mat-sys-corner-extra-large, 1.5rem) 0 0;
        /* Host/Present: Light braucht Kontrast hinter der weißen Hand (Theme-Primary). */
        background: light-dark(var(--mat-sys-primary), transparent);

        .countdown-fingers__img {
          width: 120px;
          height: auto;
          image-rendering: auto;
        }
      }

      .countdown-fingers--small {
        /* Schmale Kontrastfläche nur um die Hand, ringsum gleiches Padding */
        padding: 0.35rem;
        border-radius: var(--mat-sys-corner-extra-large, 1.5rem)
          var(--mat-sys-corner-extra-large, 1.5rem) 0 0;
        background: light-dark(var(--mat-sys-primary), transparent);

        .countdown-fingers__img {
          /* Kompakt unten links; Assets sind auf Content + gleiches Padding zugeschnitten. */
          width: 48px;
          height: auto;
        }
      }

      .countdown-fingers--present {
        width: fit-content;
        height: fit-content;
        max-width: 100%;
        max-height: 100%;
        min-height: 0;
        padding: clamp(0.45rem, 1.4vmin, 0.9rem) clamp(0.45rem, 1.4vmin, 0.9rem) 0;
        border-radius: var(--mat-sys-corner-extra-large, 1.5rem)
          var(--mat-sys-corner-extra-large, 1.5rem) 0 0;
        background: light-dark(var(--mat-sys-primary), transparent);

        .countdown-fingers__img {
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .countdown-fingers {
          .countdown-fingers__img {
            animation: none !important;
          }
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .countdown-fingers__img {
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
export class CountdownFingersComponent {
  readonly seconds = input.required<number>();
  readonly size = input<'small' | 'large' | 'present'>('small');

  readonly imageSrc = computed(() => {
    const s = this.seconds();
    return s >= 0 && s <= 5 ? (FINGER_IMAGES[s] ?? null) : null;
  });

  ariaLabel(): string {
    const seconds = this.seconds();
    return seconds === 1
      ? $localize`:@@countdownFingers.ariaOne:1 Sekunde, durch einen Finger dargestellt`
      : $localize`:@@countdownFingers.ariaMany:${seconds}:seconds: Sekunden, durch Finger dargestellt`;
  }
}
