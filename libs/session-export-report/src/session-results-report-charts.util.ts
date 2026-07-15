import type {
  ConfidenceCrossTab,
  ConfidenceResultDTO,
  NumericHistogramBin,
  NumericRoundComparisonDTO,
  OptionDistributionEntry,
  FreetextAggregateEntry,
} from '@arsnova/shared-types';
import { formatLocaleCount, formatLocaleNumber } from './locale-number.util';
import type { SessionResultsReportLabels } from './labels-de';
import {
  renderNumericHistogramOverlayElements,
  renderNumericHistogramReferenceLabel,
  renderNumericHistogramBandCaption,
  type NumericHistogramOverlayContext,
} from './numeric-histogram-overlay.util';
import { formatReportBarLabelHtml } from './report-bar-label.util';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ConfidenceHeatmapLabels {
  title: string;
  rowCorrect: string;
  rowIncorrect: string;
  tierLow: string;
  tierMid: string;
  tierHigh: string;
  legendTitle?: string;
  legendScale?: string;
  legendHint?: string;
}

function heatIntensity(count: number, total: number): 0 | 1 | 2 | 3 {
  if (count <= 0 || total <= 0) return 0;
  const share = count / total;
  if (share >= 0.34) return 3;
  if (share >= 0.14) return 2;
  return 1;
}

function heatClass(
  tone: 'neutral' | 'success' | 'caution' | 'risk',
  intensity: 0 | 1 | 2 | 3,
): string {
  if (intensity === 0) return 'report-heat report-heat--empty';
  return `report-heat report-heat--${tone}-${intensity}`;
}

function cellTone(
  correctness: 'correct' | 'incorrect',
  tier: 'low' | 'mid' | 'high',
): 'neutral' | 'success' | 'caution' | 'risk' {
  if (correctness === 'incorrect' && tier === 'high') return 'risk';
  if (correctness === 'incorrect') return 'caution';
  if (correctness === 'correct' && tier === 'high') return 'success';
  return 'neutral';
}

function crossTabTotal(crossTab: ConfidenceCrossTab): number {
  return (
    crossTab.correctHigh +
    crossTab.correctMid +
    crossTab.correctLow +
    crossTab.incorrectHigh +
    crossTab.incorrectMid +
    crossTab.incorrectLow
  );
}

/** Nur relevante Histogramm-Bins für den Druck (leere Ränder entfernen). */
export function filterHistogramBinsForDisplay(bins: NumericHistogramBin[]): NumericHistogramBin[] {
  if (bins.length <= 8) return bins.filter((bin) => bin.count > 0);
  const first = bins.findIndex((bin) => bin.count > 0);
  if (first < 0) return bins.slice(0, 8);
  const last = bins.length - 1 - [...bins].reverse().findIndex((bin) => bin.count > 0);
  const slice = bins.slice(Math.max(0, first - 1), Math.min(bins.length, last + 2));
  return slice.length > 14 ? slice.filter((bin) => bin.count > 0) : slice;
}

export function histogramsEqual(
  a: NumericHistogramBin[] | undefined,
  b: NumericHistogramBin[] | undefined,
): boolean {
  if (!a?.length || !b?.length || a.length !== b.length) return false;
  return a.every(
    (bin, index) =>
      bin.from === b[index]?.from &&
      bin.to === b[index]?.to &&
      bin.count === b[index]?.count &&
      bin.inBand === b[index]?.inBand,
  );
}

export function renderConfidenceHeatmapHtml(
  crossTab: ConfidenceCrossTab,
  labels: ConfidenceHeatmapLabels,
  localeId: string,
): string {
  const total = crossTabTotal(crossTab);
  const rows: Array<{
    label: string;
    correctness: 'correct' | 'incorrect';
    values: [number, number, number];
  }> = [
    {
      label: labels.rowCorrect,
      correctness: 'correct',
      values: [crossTab.correctLow, crossTab.correctMid, crossTab.correctHigh],
    },
    {
      label: labels.rowIncorrect,
      correctness: 'incorrect',
      values: [crossTab.incorrectLow, crossTab.incorrectMid, crossTab.incorrectHigh],
    },
  ];
  const tiers: Array<{ key: 'low' | 'mid' | 'high'; label: string }> = [
    { key: 'low', label: labels.tierLow },
    { key: 'mid', label: labels.tierMid },
    { key: 'high', label: labels.tierHigh },
  ];

  const head = tiers.map((tier) => `<th scope="col">${escapeHtml(tier.label)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = row.values
        .map((count, index) => {
          const tier = tiers[index]?.key ?? 'mid';
          const intensity = heatIntensity(count, total);
          const tone = cellTone(row.correctness, tier);
          return `<td class="${heatClass(tone, intensity)}">${formatLocaleCount(count, localeId)}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}</tr>`;
    })
    .join('');

  return `<div class="report-chart-block">
    <h5>${escapeHtml(labels.title)}</h5>
    <table class="report-heatmap" role="grid">
      <thead><tr><th></th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${
      labels.legendTitle
        ? `<div class="report-heatmap-legend">
      <strong>${escapeHtml(labels.legendTitle)}</strong>
      <span>${escapeHtml(labels.legendScale ?? '')}</span>
      <span class="report-heatmap-legend-hint">${escapeHtml(labels.legendHint ?? '')}</span>
      <div class="report-heatmap-legend-scale" aria-hidden="true">
        <span class="report-heat report-heat--neutral-1">1</span>
        <span class="report-heat report-heat--neutral-2">2</span>
        <span class="report-heat report-heat--success-2">3</span>
        <span class="report-heat report-heat--risk-2">3</span>
        <span class="report-heat report-heat--risk-3">3</span>
      </div>
    </div>`
        : ''
    }
  </div>`;
}

export function renderConfidenceDistributionBarsHtml(
  result: ConfidenceResultDTO,
  title: string,
  localeId: string,
): string {
  const total = Object.values(result.distribution).reduce((sum, value) => sum + value, 0);
  const max = Math.max(...Object.values(result.distribution), 1);
  const rows = (['1', '2', '3', '4', '5'] as const)
    .map((step) => {
      const count = result.distribution[step];
      const width = Math.max(4, Math.round((count / max) * 100));
      return `<li class="report-vbar-row">
        <span class="report-vbar-label">${step}</span>
        <div class="report-vbar-track"><div class="report-vbar-fill" style="height:${width}%"></div></div>
        <span class="report-vbar-value">${formatLocaleCount(count, localeId)}</span>
      </li>`;
    })
    .join('');
  return `<div class="report-chart-block">
    <h5>${escapeHtml(title)}</h5>
    <ul class="report-vbars" aria-label="${escapeHtml(title)} (${formatLocaleCount(total, localeId)})">${rows}</ul>
  </div>`;
}

export function renderHistogramHtml(
  bins: NumericHistogramBin[],
  title: string,
  localeId: string,
  subtitle?: string,
  overlayContext?: NumericHistogramOverlayContext,
  labels?: SessionResultsReportLabels,
): string {
  const displayBins = filterHistogramBinsForDisplay(bins);
  if (!displayBins.length) return '';
  const max = Math.max(...displayBins.map((bin) => bin.count), 1);
  const overlayElements =
    overlayContext && labels
      ? renderNumericHistogramOverlayElements(displayBins, overlayContext)
      : '';
  const referenceLabel =
    overlayContext && labels
      ? renderNumericHistogramReferenceLabel(displayBins, overlayContext, labels, localeId)
      : '';
  const bandCaption =
    overlayContext && labels
      ? renderNumericHistogramBandCaption(overlayContext, labels, localeId)
      : '';
  const columns = displayBins
    .map((bin) => {
      const height = Math.max(6, Math.round((bin.count / max) * 100));
      const range =
        bin.from === bin.to
          ? formatLocaleNumber(bin.from, localeId)
          : `${formatLocaleNumber(bin.from, localeId)}–${formatLocaleNumber(bin.to, localeId)}`;
      const bandClass = bin.inBand ? ' report-hist-col--in-band' : '';
      return `<li class="report-hist-col${bandClass}">
        <div class="report-hist-bar-wrap"><div class="report-hist-bar" style="height:${height}%"></div></div>
        <span class="report-hist-count">${formatLocaleCount(bin.count, localeId)}</span>
        <span class="report-hist-range">${escapeHtml(range)}</span>
      </li>`;
    })
    .join('');
  return `<div class="report-chart-block">
    <h5>${escapeHtml(title)}</h5>
    ${subtitle ? `<p class="report-chart-subtitle">${escapeHtml(subtitle)}</p>` : ''}
    <div class="report-histogram-stage">
      ${overlayElements}
      ${referenceLabel}
      <ul class="report-histogram">${columns}</ul>
    </div>
    ${bandCaption}
  </div>`;
}

export function renderNumericRoundHistogramsHtml(
  comparison: NumericRoundComparisonDTO | undefined,
  mainHistogram: NumericHistogramBin[] | undefined,
  labels: { round1: string; round2: string; delta: string },
  localeId: string,
  overlayContext?: NumericHistogramOverlayContext,
  reportLabels?: SessionResultsReportLabels,
): string {
  if (!comparison) return '';
  const parts: string[] = [];
  if (
    comparison.round1Histogram.length &&
    !histogramsEqual(mainHistogram, comparison.round1Histogram)
  ) {
    parts.push(
      renderHistogramHtml(
        comparison.round1Histogram,
        labels.round1,
        localeId,
        undefined,
        overlayContext,
        reportLabels,
      ),
    );
  }
  if (comparison.round2Histogram.length) {
    parts.push(
      renderHistogramHtml(
        comparison.round2Histogram,
        labels.round2,
        localeId,
        undefined,
        overlayContext,
        reportLabels,
      ),
    );
  }
  if (comparison.deltaHistogram?.length) {
    parts.push(renderHistogramHtml(comparison.deltaHistogram, labels.delta, localeId));
  }
  return parts.filter(Boolean).join('');
}

export function renderOptionBarsHtml(
  options: OptionDistributionEntry[],
  title: string,
  labels: { optionCorrect: string },
  localeId: string,
): string {
  if (!options.length) return '';
  const total = options.reduce((sum, option) => sum + option.count, 0) || 1;
  const maxCount = Math.max(...options.map((option) => option.count), 1);
  const rows = options
    .map((option) => {
      const width = Math.max(4, Math.round((option.count / maxCount) * 100));
      const pct = Math.round((option.count / total) * 100);
      const correct = option.isCorrect
        ? ` <span class="report-tag">${escapeHtml(labels.optionCorrect)}</span>`
        : '';
      const fillClass = option.isCorrect
        ? 'report-bar-fill report-bar-fill--correct'
        : 'report-bar-fill';
      return `<li class="report-bar-row">
        <div class="report-bar-label">${formatReportBarLabelHtml(option.text, escapeHtml)}${correct}</div>
        <div class="report-bar-track"><div class="${fillClass}" style="width:${width}%"><span class="report-bar-pct">${pct} %</span></div></div>
        <div class="report-bar-value">${formatLocaleCount(option.count, localeId)}</div>
      </li>`;
    })
    .join('');
  return `<h4>${escapeHtml(title)}</h4><ul class="report-bars">${rows}</ul>`;
}

export function renderPeerInstructionOptionComparisonHtml(
  round1: OptionDistributionEntry[],
  round2: OptionDistributionEntry[],
  title: string,
  round1Label: string,
  round2Label: string,
  optionCorrectLabel: string,
  localeId: string,
): string {
  if (!round1.length || !round2.length) return '';
  const labels = round2.map((option) => option.text);
  const round1ByText = new Map(round1.map((option) => [option.text, option]));
  const round2ByText = new Map(round2.map((option) => [option.text, option]));
  const keys = [...new Set([...labels, ...round1.map((option) => option.text)])];
  const maxCount = Math.max(
    ...round1.map((option) => option.count),
    ...round2.map((option) => option.count),
    1,
  );
  const rows = keys
    .map((key) => {
      const r1 = round1ByText.get(key);
      const r2 = round2ByText.get(key);
      const r1Count = r1?.count ?? 0;
      const r2Count = r2?.count ?? 0;
      const r1Width = Math.max(2, Math.round((r1Count / maxCount) * 100));
      const r2Width = Math.max(2, Math.round((r2Count / maxCount) * 100));
      const correctTag =
        r2?.isCorrect || r1?.isCorrect
          ? ` <span class="report-tag">${escapeHtml(optionCorrectLabel)}</span>`
          : '';
      return `<li class="report-pi-row">
        <div class="report-pi-label">${formatReportBarLabelHtml(key, escapeHtml)}${correctTag}</div>
        <div class="report-pi-bars">
          <div class="report-pi-bar-group" aria-label="${escapeHtml(round1Label)}">
            <span class="report-pi-round">${escapeHtml(round1Label)}</span>
            <div class="report-bar-track"><div class="report-bar-fill" style="width:${r1Width}%"><span class="report-bar-pct">${formatLocaleCount(r1Count, localeId)}</span></div></div>
          </div>
          <div class="report-pi-bar-group" aria-label="${escapeHtml(round2Label)}">
            <span class="report-pi-round">${escapeHtml(round2Label)}</span>
            <div class="report-bar-track"><div class="report-bar-fill report-bar-fill--correct" style="width:${r2Width}%"><span class="report-bar-pct">${formatLocaleCount(r2Count, localeId)}</span></div></div>
          </div>
        </div>
      </li>`;
    })
    .join('');
  return `<div class="report-pi-comparison"><h4>${escapeHtml(title)}</h4><ul class="report-pi-list">${rows}</ul></div>`;
}

export function renderFreetextTopBarsHtml(
  aggregates: FreetextAggregateEntry[],
  title: string,
  moreLabelTemplate: string,
  localeId: string,
  topN = 8,
): string {
  if (!aggregates.length) return '';
  const sorted = [...aggregates].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const max = Math.max(...top.map((entry) => entry.count), 1);
  const total = sorted.reduce((sum, entry) => sum + entry.count, 0) || 1;
  const rows = top
    .map((entry) => {
      const width = Math.max(4, Math.round((entry.count / max) * 100));
      const pct = Math.round((entry.count / total) * 100);
      return `<li class="report-bar-row">
        <div class="report-bar-label">${formatReportBarLabelHtml(entry.text, escapeHtml)}</div>
        <div class="report-bar-track"><div class="report-bar-fill" style="width:${width}%"><span class="report-bar-pct">${pct} %</span></div></div>
        <div class="report-bar-value">${formatLocaleCount(entry.count, localeId)}</div>
      </li>`;
    })
    .join('');
  const more =
    rest.length > 0
      ? `<p class="report-note">${escapeHtml(moreLabelTemplate.replace('{0}', formatLocaleCount(rest.length, localeId)))}</p>`
      : '';
  return `<h4>${escapeHtml(title)}</h4><ul class="report-bars">${rows}</ul>${more}`;
}

export function renderStarRatingBarsHtml(
  distribution: Record<string, number>,
  title: string,
  localeId: string,
  average?: number | null,
  standardDeviation?: number | null,
): string {
  const entries = Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!entries.length) return '';
  const max = Math.max(...entries.map(([, count]) => count), 1);
  const rows = entries
    .map(([star, count]) => {
      const width = Math.max(4, Math.round((count / max) * 100));
      const pct = Math.round(
        (count /
          Math.max(
            entries.reduce((s, [, c]) => s + c, 0),
            1,
          )) *
          100,
      );
      return `<li class="report-bar-row">
        <div class="report-bar-label">${star} ★</div>
        <div class="report-bar-track"><div class="report-bar-fill report-bar-fill--rating" style="width:${width}%"><span class="report-bar-pct">${pct} %</span></div></div>
        <div class="report-bar-value">${formatLocaleCount(count, localeId)}</div>
      </li>`;
    })
    .join('');
  const avg =
    average !== null && average !== undefined
      ? `<p class="report-chart-subtitle">Ø ${formatLocaleNumber(average, localeId, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★${
          standardDeviation !== null && standardDeviation !== undefined
            ? ` · σ ${formatLocaleNumber(standardDeviation, localeId, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : ''
        }</p>`
      : '';
  return `<div class="report-chart-block">
    <h5>${escapeHtml(title)}</h5>
    ${avg}
    <ul class="report-bars">${rows}</ul>
  </div>`;
}
