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
  },
  template: `
    @if (imageSrc()) {
      <div
        class="countdown-fingers"
        [class.countdown-fingers--large]="size() === 'large'"
        [class.countdown-fingers--small]="size() === 'small'"
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

      :host.countdown-fingers-host--viewport {
        display: block;
        position: fixed;
        /* Fallback ohne Anchor-API (Footer-Höhe variiert) */
        bottom: max(5.5rem, env(safe-area-inset-bottom, 0px));
        /* Linke Flucht wie .vote-page-Inhalt (zentrierte Spalte + horizontales Padding), nicht Viewport-Kante */
        left: calc(
          (100vw - min(100vw, var(--vote-page-max-width, 36rem))) / 2 +
            max(var(--vote-page-inline-padding, 1rem), env(safe-area-inset-left, 0px))
        );
        z-index: 100;
        pointer-events: none;
      }

      @supports (position-anchor: --_) {
        :host.countdown-fingers-host--viewport {
          position-anchor: --app-footer-anchor;
          bottom: anchor(top);
        }
      }

      .countdown-fingers {
        pointer-events: none;
        user-select: none;
      }

      .countdown-fingers__img {
        display: block;
        object-fit: contain;
      }

      .countdown-fingers--large {
        .countdown-fingers__img {
          width: 120px;
          height: auto;
          image-rendering: auto;
        }
      }

      .countdown-fingers--small {
        .countdown-fingers__img {
          width: 56px;
          height: auto;
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
  readonly size = input<'small' | 'large'>('small');

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
