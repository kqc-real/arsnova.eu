import { Component } from '@angular/core';

/** Kompassrose für Button und Dialogkopf des Moderationskompasses. */
@Component({
  selector: 'app-moderation-compass-icon',
  standalone: true,
  template: `
    <svg class="moderation-compass-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.35" fill="none" stroke="currentColor" stroke-width="1.7" />
      <path
        d="M12 3.55v2.05M20.45 12h-2.05M12 20.45v-2.05M3.55 12h2.05"
        fill="none"
        stroke="currentColor"
        stroke-width="1.55"
        stroke-linecap="round"
      />
      <path d="M12 5.7 14.05 12 12 11.2 9.95 12Z" fill="currentColor" />
      <path d="M12 18.3 9.95 12 12 12.8 14.05 12Z" fill="currentColor" opacity="0.38" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1.5rem;
      height: 1.5rem;
      flex-shrink: 0;
      line-height: 0;
      color: inherit;
    }

    .moderation-compass-icon {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class ModerationCompassIconComponent {}
