import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  isWordCloudLemmaLocale,
  WORD_CLOUD_LEMMA_LOCALES,
  type WordCloudLemmaLocale,
} from '@arsnova/shared-types';

const WORD_CLOUD_LEMMA_LOCALE_LABELS: Record<WordCloudLemmaLocale, { code: string; name: string }> =
  {
    de: { code: 'DE', name: 'Deutsch' },
    en: { code: 'EN', name: 'English' },
    fr: { code: 'FR', name: 'Français' },
    es: { code: 'ES', name: 'Español' },
  };

@Component({
  selector: 'app-word-cloud-lemma-locale-select',
  standalone: true,
  template: `
    <label class="word-cloud-lemma-locale">
      <span class="sr-only" i18n="@@sessionHost.wordCloudLemmaLocaleAria"
        >Sprache der Antworten</span
      >
      <select
        class="word-cloud-lemma-locale__select"
        [value]="locale ?? ''"
        (change)="onChange($event)"
      >
        @if (!locale) {
          <option value="" disabled selected i18n="@@sessionHost.wordCloudLemmaLocalePlaceholder">
            Sprache
          </option>
        }
        @for (option of options; track option.id) {
          <option [value]="option.id" [attr.title]="option.name">{{ option.code }}</option>
        }
      </select>
    </label>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: stretch;
      align-self: stretch;
      flex: 0 0 auto;
    }

    .word-cloud-lemma-locale {
      display: inline-flex;
      align-items: stretch;
      height: 100%;
    }

    .word-cloud-lemma-locale__select {
      box-sizing: border-box;
      height: 100%;
      min-height: 2.5rem;
      min-width: 3.6rem;
      max-width: 4.6rem;
      padding: 0 0.2rem 0 0.4rem;
      border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 16%, transparent);
      border-radius: var(--mat-sys-corner-small, 0.5rem);
      background: color-mix(in srgb, var(--mat-sys-surface) 88%, transparent);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-small);
      font-weight: 700;
      letter-spacing: 0.06em;
      cursor: pointer;
    }

    .word-cloud-lemma-locale__select:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
  `,
})
export class WordCloudLemmaLocaleSelectComponent {
  @Input() locale: WordCloudLemmaLocale | null = null;
  @Output() readonly localeChange = new EventEmitter<WordCloudLemmaLocale>();

  readonly options = WORD_CLOUD_LEMMA_LOCALES.map((id) => ({
    id,
    ...WORD_CLOUD_LEMMA_LOCALE_LABELS[id],
  }));

  onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    if (!value || !isWordCloudLemmaLocale(value)) {
      return;
    }

    this.localeChange.emit(value);
  }
}
