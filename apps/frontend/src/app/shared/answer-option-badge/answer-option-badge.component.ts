import { Component, Input } from '@angular/core';
import type { QuestionType } from '@arsnova/shared-types';
import {
  answerOptionColor,
  answerOptionShapeKind,
  type AnswerOptionShapeKind,
} from '../answer-option-badge.util';

@Component({
  selector: 'app-answer-option-badge',
  standalone: true,
  host: {
    '[style.background-color]': 'backgroundColor()',
    '[attr.data-answer-shape]': 'shapeKind()',
    'aria-hidden': 'true',
  },
  template: `
    <svg class="answer-option-badge__icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      @switch (shapeKind()) {
        @case ('triangle') {
          <path d="M12 4.6 20 18.7H4Z" />
        }
        @case ('circle') {
          <circle cx="12" cy="12" r="7.3" />
        }
        @case ('square') {
          <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1.4" />
        }
        @case ('diamond') {
          <path d="M12 2.4 21.6 12 12 21.6 2.4 12Z" />
        }
        @case ('star') {
          <path d="m12 4.2 2.2 4.8 5.2.6-3.9 3.6 1.1 5.1-4.6-2.6-4.6 2.6 1.1-5.1-3.9-3.6 5.2-.6Z" />
        }
        @case ('hexagon') {
          <path d="M12 4.2 18.9 8.1v7.8L12 19.8l-6.9-3.9V8.1Z" />
        }
        @case ('plus') {
          <path d="M9.2 3.4h5.6V9.2H20.6v5.6H14.8V20.6H9.2V14.8H3.4V9.2h5.8V3.4Z" />
        }
        @case ('heart') {
          <path
            d="M12 19.4C7.6 16.2 4.2 13.4 4.2 9.8 4.2 7.2 6.2 5.4 8.6 5.4c1.6 0 2.8.8 3.4 2.2.6-1.4 1.8-2.2 3.4-2.2 2.4 0 4.4 1.8 4.4 4.4 0 3.6-3.4 6.4-7.8 9.6Z"
          />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        --answer-option-badge-icon-size: 64%;
        --answer-option-badge-stroke-width: 2.6;
        --answer-option-badge-offset-y: -1px;
        --answer-option-badge-fill: none;
        --answer-option-badge-stroke: currentColor;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        line-height: 1;
        vertical-align: middle;
        transform: translateY(var(--answer-option-badge-offset-y));
        color: #fff;
      }

      .answer-option-badge__icon {
        width: var(--answer-option-badge-icon-size);
        height: var(--answer-option-badge-icon-size);
        display: block;
        fill: var(--answer-option-badge-fill);
        stroke: var(--answer-option-badge-stroke);
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: var(--answer-option-badge-stroke-width);
        vector-effect: non-scaling-stroke;
      }
    `,
  ],
})
export class AnswerOptionBadgeComponent {
  @Input({ required: true }) index = 0;
  @Input() questionType: QuestionType | null | undefined;
  @Input() showTypeIndicator: boolean | null | undefined = true;

  backgroundColor(): string {
    return answerOptionColor(this.index);
  }

  shapeKind(): AnswerOptionShapeKind {
    return answerOptionShapeKind(this.index, this.questionType, this.showTypeIndicator);
  }
}
