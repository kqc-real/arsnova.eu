import type { NumericHistogramBin, QuestionExportEntry } from '@arsnova/shared-types';
import {
  resolveNumericEstimateToleranceMode,
  resolveNumericTolerance,
} from '@arsnova/shared-types';
import type { SessionResultsReportLabels } from './labels-de';
import { formatLocaleColon, formatLocaleCount, formatLocaleNumber } from './locale-number.util';

export type NumericHistogramOverlayContext = Pick<
  QuestionExportEntry,
  | 'numericReferenceValue'
  | 'numericTolerancePercent'
  | 'numericIntervalLeft'
  | 'numericIntervalRight'
  | 'numericToleranceMode'
  | 'numericInputType'
  | 'numericDecimalPlaces'
  | 'questionTextFull'
  | 'questionTextShort'
>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveNumericHistogramOverlayContext(
  question: QuestionExportEntry,
): NumericHistogramOverlayContext {
  return {
    numericReferenceValue: question.numericReferenceValue,
    numericTolerancePercent: question.numericTolerancePercent,
    numericIntervalLeft: question.numericIntervalLeft,
    numericIntervalRight: question.numericIntervalRight,
    numericToleranceMode: question.numericToleranceMode,
    numericInputType: question.numericInputType,
    numericDecimalPlaces: question.numericDecimalPlaces,
    questionTextFull: question.questionTextFull,
    questionTextShort: question.questionTextShort,
  };
}

function toleranceBand(
  context: NumericHistogramOverlayContext,
): { left: number; right: number } | null {
  return resolveNumericTolerance(
    resolveNumericEstimateToleranceMode(context.numericToleranceMode ?? undefined),
    {
      referenceValue: context.numericReferenceValue,
      tolerancePercent: context.numericTolerancePercent,
      intervalLeft: context.numericIntervalLeft,
      intervalRight: context.numericIntervalRight,
    },
  );
}

function histogramValueRange(bins: NumericHistogramBin[]): { min: number; max: number } | null {
  if (!bins.length) return null;
  const min = bins[0]!.from;
  const max = bins[bins.length - 1]!.to;
  if (min === max) return { min: min - 0.5, max: max + 0.5 };
  return { min, max };
}

function valuePositionPercent(value: number, range: { min: number; max: number }): number {
  return Math.min(100, Math.max(0, ((value - range.min) / (range.max - range.min)) * 100));
}

function usesIntegerFormat(context: NumericHistogramOverlayContext): boolean {
  return context.numericInputType === 'INTEGER' || context.numericDecimalPlaces === 0;
}

function usesYearFormat(context: NumericHistogramOverlayContext): boolean {
  if (!usesIntegerFormat(context)) return false;
  const text = `${context.questionTextFull ?? ''} ${context.questionTextShort ?? ''}`;
  if (/\b(jahr|jahreszahl|year|année|annee|año|ano|anno)\b/i.test(text) || /\bwann\b/i.test(text)) {
    return true;
  }
  return false;
}

export function formatNumericEstimateValue(
  value: number,
  context: NumericHistogramOverlayContext,
  localeId: string,
  stats = false,
): string {
  if (usesYearFormat(context)) {
    const digits = stats
      ? usesIntegerFormat(context)
        ? 0
        : 2
      : usesIntegerFormat(context)
        ? 0
        : 2;
    return new Intl.NumberFormat(localeId, {
      minimumIntegerDigits: 1,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
    }).format(value);
  }
  const fractionDigits =
    stats && !usesIntegerFormat(context)
      ? 2
      : usesIntegerFormat(context)
        ? 0
        : Math.max(0, Math.min(4, context.numericDecimalPlaces ?? 2));
  return formatLocaleNumber(value, localeId, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  });
}

function bandStyle(
  band: { left: number; right: number },
  range: { min: number; max: number },
): { left: number; width: number } | null {
  const visibleLeft = Math.max(band.left, range.min);
  const visibleRight = Math.min(band.right, range.max);
  if (visibleLeft > range.max || visibleRight < range.min || visibleLeft > visibleRight) {
    return null;
  }
  const left = valuePositionPercent(visibleLeft, range);
  const right = valuePositionPercent(visibleRight, range);
  return { left, width: Math.max(1, right - left) };
}

function referencePercent(
  referenceValue: number,
  range: { min: number; max: number },
): number | null {
  if (referenceValue < range.min || referenceValue > range.max) return null;
  return valuePositionPercent(referenceValue, range);
}

export function renderNumericHistogramOverlayElements(
  bins: NumericHistogramBin[],
  context: NumericHistogramOverlayContext,
): string {
  const band = toleranceBand(context);
  const range = histogramValueRange(bins);
  if (!band || !range) return '';

  const parts: string[] = [];
  const style = bandStyle(band, range);
  if (style) {
    parts.push(
      `<div class="report-hist-band" style="left:${style.left.toFixed(2)}%;width:${style.width.toFixed(2)}%" aria-hidden="true"></div>`,
    );
  }

  const referenceValue = context.numericReferenceValue;
  if (referenceValue !== null && referenceValue !== undefined) {
    const refLeft = referencePercent(referenceValue, range);
    if (refLeft !== null) {
      parts.push(
        `<div class="report-hist-reference" style="left:${refLeft.toFixed(2)}%" aria-hidden="true"></div>`,
      );
    }
  }

  return parts.join('');
}

export function renderNumericHistogramBandCaption(
  context: NumericHistogramOverlayContext,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const band = toleranceBand(context);
  if (!band) return '';

  const referenceValue = context.numericReferenceValue;
  const colon = formatLocaleColon(localeId);
  const caption = `${labels.numericToleranceBand}${colon} ${formatNumericEstimateValue(band.left, context, localeId, true)}–${formatNumericEstimateValue(band.right, context, localeId, true)}${
    referenceValue !== null && referenceValue !== undefined
      ? ` · ${labels.numericReference}${colon} ${formatNumericEstimateValue(referenceValue, context, localeId)}`
      : ''
  }`;

  return `<p class="report-numeric-band-caption">${escapeHtml(caption)}</p>`;
}

/** Hauptbotschaft für Schätzfragen: Anteil im akzeptierten Bereich vor dem Histogramm. */
export function renderNumericInBandSummaryHtml(
  stats: { n: number; inBandCount: number },
  context: NumericHistogramOverlayContext,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const band = toleranceBand(context);
  if (!band || stats.n <= 0) return '';

  const text = labels.numericInBandSummaryTemplate
    .replace('{0}', formatLocaleCount(stats.inBandCount, localeId))
    .replace('{1}', formatLocaleCount(stats.n, localeId))
    .replace('{2}', formatNumericEstimateValue(band.left, context, localeId, true))
    .replace('{3}', formatNumericEstimateValue(band.right, context, localeId, true));

  return `<p class="report-numeric-primary"><strong>${escapeHtml(text)}</strong></p>`;
}

export function renderNumericHistogramReferenceLabel(
  bins: NumericHistogramBin[],
  context: NumericHistogramOverlayContext,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const range = histogramValueRange(bins);
  const referenceValue = context.numericReferenceValue;
  if (!range || referenceValue === null || referenceValue === undefined) return '';
  const refLeft = referencePercent(referenceValue, range);
  if (refLeft === null) return '';
  const refLabel = `${labels.numericReference}${formatLocaleColon(localeId)} ${formatNumericEstimateValue(referenceValue, context, localeId)}`;
  return `<span class="report-hist-reference-label" style="left:${refLeft.toFixed(2)}%">${escapeHtml(refLabel)}</span>`;
}

export function renderNumericHistogramBandLabel(
  bins: NumericHistogramBin[],
  context: NumericHistogramOverlayContext,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const band = toleranceBand(context);
  const range = histogramValueRange(bins);
  if (!band || !range) return '';
  const style = bandStyle(band, range);
  if (!style) return '';
  const label = `${labels.numericToleranceBand}${formatLocaleColon(localeId)} ${formatNumericEstimateValue(band.left, context, localeId, true)}–${formatNumericEstimateValue(band.right, context, localeId, true)}`;
  return `<span class="report-hist-band-label" style="left:${style.left.toFixed(2)}%;width:${style.width.toFixed(2)}%">${escapeHtml(label)}</span>`;
}

/** @deprecated Nutze {@link renderNumericHistogramOverlayElements} und {@link renderNumericHistogramBandCaption}. */
export function renderNumericHistogramOverlayHtml(
  bins: NumericHistogramBin[],
  context: NumericHistogramOverlayContext,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  return (
    renderNumericHistogramOverlayElements(bins, context) +
    renderNumericHistogramBandLabel(bins, context, labels, localeId) +
    renderNumericHistogramReferenceLabel(bins, context, labels, localeId) +
    renderNumericHistogramBandCaption(context, labels, localeId)
  );
}
