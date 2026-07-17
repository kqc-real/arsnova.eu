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
  formatNumericEstimateValue,
  renderNumericHistogramOverlayElements,
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
  cellCountNote: string;
  legendToneTitle: string;
  legendToneSuccess: string;
  legendToneRisk: string;
  legendToneCaution: string;
  legendToneNeutral: string;
  legendToneMid: string;
  legendFrequencyHint: string;
  compactLegend: string;
}

function cellTone(
  correctness: 'correct' | 'incorrect',
  tier: 'low' | 'mid' | 'high',
): 'mid' | 'fragile' | 'gap' | 'success' | 'risk' {
  if (tier === 'mid') return 'mid';
  if (correctness === 'incorrect' && tier === 'high') return 'risk';
  if (correctness === 'incorrect') return 'gap';
  if (correctness === 'correct' && tier === 'high') return 'success';
  return 'fragile';
}

function cellSymbol(correctness: 'correct' | 'incorrect', tier: 'low' | 'mid' | 'high'): string {
  if (tier === 'mid') return 'M';
  if (correctness === 'correct' && tier === 'high') return '✓';
  if (correctness === 'incorrect' && tier === 'high') return '⚠';
  if (correctness === 'correct') return '?';
  return '◯';
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

export function renderConfidenceCategoryListHtml(
  crossTab: ConfidenceCrossTab,
  labels: ConfidenceHeatmapLabels & {
    mastery: string;
    risk: string;
    fragile: string;
    gap: string;
    middle: string;
  },
  localeId: string,
): string {
  const items = [
    { symbol: '✓', text: labels.mastery, count: crossTab.correctHigh },
    { symbol: '⚠', text: labels.risk, count: crossTab.incorrectHigh },
    { symbol: '?', text: labels.fragile, count: crossTab.correctLow },
    { symbol: '◯', text: labels.gap, count: crossTab.incorrectLow },
    {
      symbol: 'M',
      text: `${labels.middle}, ${labels.rowCorrect.toLowerCase()}`,
      count: crossTab.correctMid,
    },
    {
      symbol: 'M',
      text: `${labels.middle}, ${labels.rowIncorrect.toLowerCase()}`,
      count: crossTab.incorrectMid,
    },
  ];
  return `<div class="report-chart-block">
    <h5>${escapeHtml(labels.legendToneTitle)}</h5>
    <ul class="report-confidence-category-list">
      ${items
        .map(
          (item) =>
            `<li><span class="report-heat-symbol" aria-hidden="true">${item.symbol}</span><span>${escapeHtml(item.text)}</span><strong>${formatLocaleCount(item.count, localeId)}</strong></li>`,
        )
        .join('')}
    </ul>
  </div>`;
}

export function renderConfidenceHeatmapHtml(
  crossTab: ConfidenceCrossTab,
  labels: ConfidenceHeatmapLabels,
  localeId: string,
  legendMode: 'full' | 'compact' | 'none' = 'full',
): string {
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
          const tone = cellTone(row.correctness, tier);
          const symbol = cellSymbol(row.correctness, tier);
          return `<td class="report-heat report-heat--plain report-heat--${tone}"><span class="report-heat-cell"><span class="report-heat-symbol" aria-hidden="true">${symbol}</span><span class="report-heat-count">${formatLocaleCount(count, localeId)}</span></span></td>`;
        })
        .join('');
      return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}</tr>`;
    })
    .join('');

  const legend =
    legendMode === 'none'
      ? ''
      : legendMode === 'compact'
        ? `<p class="report-heatmap-legend report-heatmap-legend--compact">${escapeHtml(labels.compactLegend)}</p>`
        : `<p class="report-heatmap-legend report-heatmap-legend--compact">${escapeHtml(labels.compactLegend)}</p>`;

  return `<div class="report-chart-block">
    <h5>${escapeHtml(labels.title)}</h5>
    <table class="report-heatmap report-heatmap--simple" role="grid">
      <thead><tr><th></th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="report-heatmap-cell-note">${escapeHtml(labels.cellCountNote)}</p>
    ${legend}
  </div>`;
}

export function renderConfidenceDistributionBarsHtml(
  result: ConfidenceResultDTO,
  title: string,
  localeId: string,
  endpointLabel?: string,
  axisLabel?: string,
): string {
  const total = Object.values(result.distribution).reduce((sum, value) => sum + value, 0);
  const max = Math.max(...Object.values(result.distribution), 1);
  const rows = (['1', '2', '3', '4', '5'] as const)
    .map((step) => {
      const count = result.distribution[step];
      const width = count > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
      return `<li class="report-vbar-row">
        <span class="report-vbar-label">${step}</span>
        <div class="report-vbar-track${count === 0 ? ' report-vbar-track--zero' : ''}">${count > 0 ? `<div class="report-vbar-fill" style="height:${width}%"></div>` : ''}</div>
        <span class="report-vbar-value">${formatLocaleCount(count, localeId)}</span>
      </li>`;
    })
    .join('');
  return `<div class="report-chart-block">
    <h5>${escapeHtml(title)}</h5>
    <ul class="report-vbars" aria-label="${escapeHtml(title)} (${formatLocaleCount(total, localeId)})">${rows}</ul>
    ${axisLabel ? `<p class="report-chart-axis-label">${escapeHtml(axisLabel)}</p>` : ''}
    ${endpointLabel ? `<p class="report-scale-endpoints">${escapeHtml(endpointLabel)}</p>` : ''}
  </div>`;
}

export function renderHistogramHtml(
  bins: NumericHistogramBin[],
  title: string,
  localeId: string,
  subtitle?: string,
  overlayContext?: NumericHistogramOverlayContext,
  labels?: SessionResultsReportLabels,
  options?: { secondary?: boolean },
): string {
  const displayBins = filterHistogramBinsForDisplay(bins);
  if (!displayBins.length) return '';
  const max = Math.max(...displayBins.map((bin) => bin.count), 1);
  const overlayElements =
    overlayContext && labels
      ? renderNumericHistogramOverlayElements(displayBins, overlayContext)
      : '';
  const bandCaption =
    overlayContext && labels
      ? renderNumericHistogramBandCaption(overlayContext, labels, localeId)
      : '';
  const columns = displayBins
    .map((bin) => {
      const height = bin.count > 0 ? Math.max(6, Math.round((bin.count / max) * 100)) : 0;
      const formatAxis = (value: number) =>
        overlayContext
          ? formatNumericEstimateValue(value, overlayContext, localeId)
          : formatLocaleNumber(value, localeId, { useGrouping: false });
      const range =
        bin.from === bin.to
          ? formatAxis(bin.from)
          : `${formatAxis(bin.from)}–${formatAxis(bin.to)}`;
      const bandClass = bin.inBand && !overlayContext ? ' report-hist-col--in-band' : '';
      return `<li class="report-hist-col${bandClass}">
        <div class="report-hist-bar-wrap${bin.count === 0 ? ' report-hist-bar-wrap--zero' : ''}">${
          bin.count > 0 ? `<div class="report-hist-bar" style="height:${height}%"></div>` : ''
        }</div>
        <span class="report-hist-count">${formatLocaleCount(bin.count, localeId)}</span>
        <span class="report-hist-range">${escapeHtml(range)}</span>
      </li>`;
    })
    .join('');
  const blockClass = options?.secondary
    ? 'report-chart-block report-chart-block--secondary'
    : 'report-chart-block';
  return `<div class="${blockClass}">
    <h5>${escapeHtml(title)}</h5>
    ${subtitle ? `<p class="report-chart-subtitle">${escapeHtml(subtitle)}</p>` : ''}
    ${bandCaption}
    <div class="report-histogram-stage">
      ${overlayElements}
      <ul class="report-histogram">${columns}</ul>
    </div>
  </div>`;
}

export function renderNumericRoundHistogramsHtml(
  comparison: NumericRoundComparisonDTO | undefined,
  _mainHistogram: NumericHistogramBin[] | undefined,
  labels: {
    round1: string;
    round2: string;
    delta: string;
    identical?: string;
    identicalNote?: string;
  },
  localeId: string,
  overlayContext?: NumericHistogramOverlayContext,
  reportLabels?: SessionResultsReportLabels,
): string {
  if (!comparison) return '';
  if (comparison.round2Stats.n <= 0) return '';
  const parts: string[] = [];
  const distributionsAreIdentical = histogramsEqual(
    comparison.round1Histogram,
    comparison.round2Histogram,
  );
  if (distributionsAreIdentical) {
    if (labels.identicalNote) {
      parts.push(
        `<p class="report-note report-identical-distributions">${escapeHtml(labels.identicalNote)}</p>`,
      );
    }
    if (comparison.round2Histogram.length) {
      parts.push(
        renderHistogramHtml(
          comparison.round2Histogram,
          labels.identical ?? labels.round2,
          localeId,
          undefined,
          overlayContext,
          reportLabels,
        ),
      );
    }
    return parts.filter(Boolean).join('');
  }
  if (comparison.round1Histogram.length) {
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
  const allUnchanged =
    comparison.pairedAnalysis &&
    comparison.pairedAnalysis.pairedCount > 0 &&
    comparison.pairedAnalysis.unchangedCount === comparison.pairedAnalysis.pairedCount;
  if (!allUnchanged && comparison.pairedAnalysis && comparison.pairedAnalysis.pairedCount > 0) {
    parts.push(renderNumericPeerChangeBarsHtml(comparison.pairedAnalysis, reportLabels, localeId));
  }
  return parts.filter(Boolean).join('');
}

export function renderNumericPeerChangeBarsHtml(
  paired: {
    closerCount: number;
    fartherCount: number;
    unchangedCount: number;
    pairedCount: number;
  },
  labels: SessionResultsReportLabels | undefined,
  localeId: string,
): string {
  if (!labels || paired.pairedCount <= 0) return '';
  const segments = [
    {
      key: 'closer',
      count: paired.closerCount,
      label: labels.numericPeerCloser,
      className: 'report-peer-change-seg--closer',
    },
    {
      key: 'unchanged',
      count: paired.unchangedCount,
      label: labels.numericPeerUnchanged,
      className: 'report-peer-change-seg--unchanged',
    },
    {
      key: 'farther',
      count: paired.fartherCount,
      label: labels.numericPeerFarther,
      className: 'report-peer-change-seg--farther',
    },
  ];
  const bars = segments
    .map((segment) => {
      return `<div class="report-peer-change-seg ${segment.className}" style="flex:${Math.max(segment.count, 0.0001)}" title="${escapeHtml(segment.label)}: ${formatLocaleCount(segment.count, localeId)}">
        <span class="report-peer-change-count">${formatLocaleCount(segment.count, localeId)}</span>
      </div>`;
    })
    .join('');
  const legend = segments
    .map(
      (segment) =>
        `<li><span class="report-peer-change-swatch ${segment.className}" aria-hidden="true"></span>${escapeHtml(segment.label)} · ${formatLocaleCount(segment.count, localeId)}</li>`,
    )
    .join('');
  return `<div class="report-chart-block report-peer-change">
    <h5>${escapeHtml(labels.numericPeerChangeBarsTitle)}</h5>
    <div class="report-peer-change-bar" role="img" aria-label="${escapeHtml(labels.numericPeerChangeBarsTitle)}">${bars}</div>
    <ul class="report-peer-change-legend">${legend}</ul>
  </div>`;
}

export function renderOptionBarsHtml(
  options: OptionDistributionEntry[],
  title: string,
  labels: { optionCorrect: string; optionIncorrect?: string },
  localeId: string,
  footnote?: string,
  participantCount?: number,
  valueTemplate?: string,
  introNote?: string,
  showCorrectness = false,
): string {
  if (!options.length) return '';
  const total = options.reduce((sum, option) => sum + option.count, 0) || 1;
  const maxCount = Math.max(...options.map((option) => option.count), 1);
  const rows = options
    .map((option) => {
      const width = Math.max(4, Math.round((option.count / maxCount) * 100));
      const denominator = participantCount && participantCount > 0 ? participantCount : total;
      const pct = Math.round((option.count / denominator) * 100);
      const correct = option.isCorrect
        ? ` <span class="report-correct-marker" aria-hidden="true">✓</span><span class="report-tag">${escapeHtml(labels.optionCorrect)}</span>`
        : showCorrectness
          ? ` <span class="report-incorrect-marker" aria-label="${escapeHtml(labels.optionIncorrect ?? '')}">✕</span>`
          : '';
      const fillClass = option.isCorrect
        ? 'report-bar-fill report-bar-fill--correct'
        : 'report-bar-fill';
      const inlinePercent = valueTemplate ? '' : `<span class="report-bar-pct">${pct} %</span>`;
      return `<li class="report-bar-row">
        <div class="report-bar-label">${formatReportBarLabelHtml(option.text, escapeHtml)}${correct}</div>
        <div class="report-bar-track"><div class="${fillClass}" style="width:${width}%">${inlinePercent}</div></div>
        <div class="report-bar-value">${
          valueTemplate
            ? escapeHtml(
                valueTemplate
                  .replace('{0}', `${pct} %`)
                  .replace('{1}', formatLocaleCount(option.count, localeId))
                  .replace('{2}', formatLocaleCount(denominator, localeId)),
              )
            : formatLocaleCount(option.count, localeId)
        }</div>
      </li>`;
    })
    .join('');
  const note = footnote ? `<p class="report-chart-footnote">${escapeHtml(footnote)}</p>` : '';
  const intro = introNote ? `<p class="report-chart-intro">${escapeHtml(introNote)}</p>` : '';
  return `<h4>${escapeHtml(title)}</h4>${intro}<ul class="report-bars">${rows}</ul>${note}`;
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
  endpointLabel?: string,
  averageLabels?: {
    averageTemplate: string;
    averageWithSigmaTemplate: string;
  },
): string {
  const entries = (['1', '2', '3', '4', '5'] as const).map(
    (star) => [star, distribution[star] ?? 0] as const,
  );
  if (entries.every(([, count]) => count === 0)) return '';
  const max = Math.max(...entries.map(([, count]) => count), 1);
  const rows = entries
    .map(([star, count]) => {
      const width = count > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
      const pct = Math.round(
        (count /
          Math.max(
            entries.reduce((s, [, c]) => s + c, 0),
            1,
          )) *
          100,
      );
      return `<li class="report-bar-row report-bar-row--rating">
        <div class="report-bar-label">${star} ★</div>
        <div class="report-bar-track"><div class="report-bar-fill report-bar-fill--rating" style="width:${width}%"></div></div>
        <div class="report-bar-value">${pct} % · ${formatLocaleCount(count, localeId)}</div>
      </li>`;
    })
    .join('');
  const avgNumber =
    average !== null && average !== undefined
      ? formatLocaleNumber(average, localeId, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : null;
  const sigmaNumber =
    standardDeviation !== null && standardDeviation !== undefined
      ? formatLocaleNumber(standardDeviation, localeId, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;
  const avg =
    avgNumber !== null
      ? `<p class="report-chart-subtitle">${escapeHtml(
          sigmaNumber !== null && averageLabels
            ? averageLabels.averageWithSigmaTemplate
                .replace('{0}', avgNumber)
                .replace('{1}', sigmaNumber)
            : averageLabels
              ? averageLabels.averageTemplate.replace('{0}', avgNumber)
              : sigmaNumber !== null
                ? `Ø ${avgNumber} ★ · σ ${sigmaNumber}`
                : `Ø ${avgNumber} ★`,
        )}</p>`
      : '';
  return `<div class="report-chart-block">
    <h5>${escapeHtml(title)}</h5>
    ${avg}
    <ul class="report-bars">${rows}</ul>
    ${endpointLabel ? `<p class="report-scale-endpoints">${escapeHtml(endpointLabel)}</p>` : ''}
  </div>`;
}
