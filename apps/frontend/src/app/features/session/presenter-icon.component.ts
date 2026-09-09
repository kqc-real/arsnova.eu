import { Component } from '@angular/core';

/** Beamer-Silhouette für „Präsentation starten“ (nicht im selbst gehosteten Icon-Font). */
@Component({
  selector: 'app-presenter-icon',
  standalone: true,
  host: {
    // Material-Buttons projizieren [matButtonIcon] neben .mdc-button__label (wie mat-icon).
    matButtonIcon: '',
  },
  template: `
    <svg class="presenter-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g transform="translate(0 1.2)">
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M4.2 6.2h15.6A2.6 2.6 0 0 1 22.4 8.8v6.4a2.6 2.6 0 0 1-2.6 2.6H4.2A2.6 2.6 0 0 1 1.6 15.2V8.8A2.6 2.6 0 0 1 4.2 6.2Zm12.85 1.55a3.85 3.85 0 1 1 0 7.7 3.85 3.85 0 0 1 0-7.7Zm0 .85a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 .85a2.15 2.15 0 1 1 0 4.3 2.15 2.15 0 0 1 0-4.3ZM3.7 7.85h6.7a.55.55 0 0 1 .55.55v.2a.55.55 0 0 1-.55.55H3.7a.55.55 0 0 1-.55-.55v-.2a.55.55 0 0 1 .55-.55Zm0 2.15h6.7a.55.55 0 0 1 .55.55v.2a.55.55 0 0 1-.55.55H3.7a.55.55 0 0 1-.55-.55v-.2a.55.55 0 0 1 .55-.55Zm0 2.15h6.7a.55.55 0 0 1 .55.55v.2a.55.55 0 0 1-.55.55H3.7a.55.55 0 0 1-.55-.55v-.2a.55.55 0 0 1 .55-.55Zm0 2.15h6.7a.55.55 0 0 1 .55.55v.2a.55.55 0 0 1-.55.55H3.7a.55.55 0 0 1-.55-.55v-.2a.55.55 0 0 1 .55-.55Z"
        />
        <rect fill="currentColor" x="4.1" y="17.7" width="3.1" height="1.5" rx="0.75" />
        <rect fill="currentColor" x="16.8" y="17.7" width="3.1" height="1.5" rx="0.75" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      align-self: center;
      width: var(--app-presenter-icon-size, 1.75rem);
      height: var(--app-presenter-icon-size, 1.75rem);
      flex-shrink: 0;
      overflow: visible;
      line-height: 0;
      vertical-align: middle;
      color: inherit;
    }

    .presenter-icon {
      display: block;
      width: 100%;
      height: 100%;
      /* Optische Mitte mit Button-Label (Gehäuse sitzt sonst 1–2px zu tief). */
      transform: translateY(-2px);
    }
  `,
})
export class PresenterIconComponent {}
