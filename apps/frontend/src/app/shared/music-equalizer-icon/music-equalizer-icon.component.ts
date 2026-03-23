import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';

/** Wie ThemePresetService / Quiz-Store – Root-Repaint kann SVG-CSS-Animationen auf iOS einfrieren. */
const THEME_PRESET_DOM_EVENT = 'arsnova:preset-updated';

/**
 * Animiertes Equalizer-Icon (4 Balken) für „Musik läuft“.
 * Balken sind HTML-Elemente (kein SVG-rect): WebKit/iOS friert `transform`-Keyframes auf SVG oft nach Theme-Wechsel ein.
 */
@Component({
  selector: 'app-music-equalizer-icon',
  standalone: true,
  template: `
    <span
      #root
      class="music-equalizer-icon"
      [class.music-equalizer-icon--small]="size() === 'small'"
      role="img"
      aria-hidden="true"
    >
      <span class="music-equalizer-icon__bar music-equalizer-icon__bar--1"></span>
      <span class="music-equalizer-icon__bar music-equalizer-icon__bar--2"></span>
      <span class="music-equalizer-icon__bar music-equalizer-icon__bar--3"></span>
      <span class="music-equalizer-icon__bar music-equalizer-icon__bar--4"></span>
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        vertical-align: middle;
      }

      .music-equalizer-icon {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        box-sizing: border-box;
        width: 24px;
        height: 24px;
        padding: 6px 3px;
        flex-shrink: 0;
        contain: paint;
        isolation: isolate;
      }

      .music-equalizer-icon--small {
        width: 1rem;
        height: 1rem;
        padding: 4px 2px;
      }

      .music-equalizer-icon__bar {
        display: block;
        width: 2.5px;
        height: 12px;
        border-radius: 0.5px;
        background: currentColor;
        transform-origin: bottom center;
        flex-shrink: 0;
      }

      .music-equalizer-icon--small .music-equalizer-icon__bar {
        width: 2px;
        height: 8px;
      }

      /* Animation: global in styles/music-equalizer-global.scss (Production-tauglich). */
    `,
  ],
})
export class MusicEqualizerIconComponent {
  readonly size = input<'small' | 'default'>('default');

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      const win = this.doc.defaultView;
      if (!win) {
        return;
      }

      const kick = (): void => this.kickBarAnimations();
      const onVisibility = (): void => {
        if (this.doc.visibilityState === 'visible') {
          kick();
        }
      };
      const onPageShow = (e: Event): void => {
        if ((e as PageTransitionEvent).persisted) {
          kick();
        }
      };

      win.addEventListener(THEME_PRESET_DOM_EVENT, kick);
      this.doc.addEventListener('visibilitychange', onVisibility);
      win.addEventListener('pageshow', onPageShow);

      this.destroyRef.onDestroy(() => {
        win.removeEventListener(THEME_PRESET_DOM_EVENT, kick);
        this.doc.removeEventListener('visibilitychange', onVisibility);
        win.removeEventListener('pageshow', onPageShow);
      });
    });
  }

  /** iOS/WebKit: Animation nach globalem Style-Update oder Tab-Resume neu starten. */
  private kickBarAnimations(): void {
    const host = this.root()?.nativeElement;
    if (!host) {
      return;
    }
    host.classList.add('music-equalizer-icon--anim-reset');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        host.classList.remove('music-equalizer-icon--anim-reset');
      });
    });
  }
}
