import { Component, computed, inject, input, LOCALE_ID } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type {
  HostCurrentQuestionDTO,
  NumericHistogramBin,
  NumericStatsDTO,
} from '@arsnova/shared-types';
import { formatLocaleCount } from '../../core/locale-number.util';
import {
  formatNumericEstimateValue,
  numericEstimateReferenceLabel,
  numericEstimateToleranceBand,
  numericEstimateToleranceLabel,
} from './numeric-estimate-format.util';

function binMarkerValue(bin: NumericHistogramBin, stats: NumericStatsDTO | null): number {
  const min = stats?.min;
  const max = stats?.max;
  // Identical estimates are plotted at their actual value, including an exact reference hit.
  if (
    typeof min === 'number' &&
    typeof max === 'number' &&
    Math.abs(max - min) <= 1e-9 &&
    min >= bin.from - 1e-9 &&
    min <= bin.to + 1e-9
  ) {
    return min;
  }
  return (bin.from + bin.to) / 2;
}

@Component({
  selector: 'app-numeric-estimate-histogram',
  standalone: true,
  imports: [MatIcon],
  templateUrl: './numeric-estimate-histogram.component.html',
  styleUrl: './numeric-estimate-histogram.component.scss',
})
export class NumericEstimateHistogramComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly question = input.required<HostCurrentQuestionDTO | null>();
  readonly histogram = input.required<NumericHistogramBin[]>();
  readonly stats = input<NumericStatsDTO | null>(null);
  readonly showLegend = input(false);

  readonly referenceLabel = computed(() =>
    numericEstimateReferenceLabel(this.question(), this.locale),
  );
  readonly toleranceLabel = computed(() =>
    numericEstimateToleranceLabel(this.question(), this.locale),
  );

  readonly plot = computed(() => {
    const histogram = this.histogram();
    if (histogram.length === 0) return null;

    let min = Math.min(...histogram.map((bin) => Math.min(bin.from, bin.to)));
    let max = Math.max(...histogram.map((bin) => Math.max(bin.from, bin.to)));
    if (min === max) {
      min -= 0.5;
      max += 0.5;
    }
    const position = (value: number) => ((value - min) / (max - min)) * 100;
    const question = this.question();
    const formatValue = (value: number) => formatNumericEstimateValue(value, question, this.locale);

    const toleranceBand = numericEstimateToleranceBand(question);
    const band =
      toleranceBand && toleranceBand.left <= max && toleranceBand.right >= min
        ? {
            left: Math.min(99, position(Math.max(toleranceBand.left, min))),
            right: position(Math.min(toleranceBand.right, max)),
          }
        : null;
    const reference = question?.type === 'NUMERIC_ESTIMATE' ? question.numericReferenceValue : null;
    const maxCount = Math.max(1, ...histogram.map((bin) => bin.count));
    const stats = this.stats();

    return {
      min: formatValue(min),
      max: formatValue(max),
      band: band && { left: band.left, width: Math.max(1, band.right - band.left) },
      reference:
        typeof reference === 'number' && reference >= min && reference <= max
          ? position(reference)
          : null,
      bins: histogram
        .filter((bin) => bin.count > 0)
        .map((bin) => {
          const count = formatLocaleCount(bin.count, this.locale);
          return {
            inBand: bin.inBand,
            left: Math.max(0, Math.min(100, position(binMarkerValue(bin, stats)))),
            height: Math.round(18 + (bin.count / maxCount) * 42),
            count,
            label: `${formatValue(bin.from)} – ${formatValue(bin.to)}: ${count}`,
          };
        }),
    };
  });
}
