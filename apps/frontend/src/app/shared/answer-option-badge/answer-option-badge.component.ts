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
        @case ('pentagon') {
          <path d="M12 4.2 19.2 9.4l-2.8 8.4H7.6L4.8 9.4Z" />
        }
        @case ('kite') {
          <path d="M12 3.8 18.8 12 12 20.2 5.2 12Z" />
          <path d="M12 3.8v16.4" />
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
        fill: none;
        stroke: currentColor;
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
