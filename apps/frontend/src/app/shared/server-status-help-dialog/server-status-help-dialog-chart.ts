import type { DailyHighscoreEntry } from '@arsnova/shared-types';

type ChartJsModule = typeof import('chart.js');
type ChartInstance = import('chart.js').Chart<'line', (number | null)[], string>;
type ChartOptions = import('chart.js').ChartOptions<'line'>;
type ChartDataset = import('chart.js').ChartDataset<'line', (number | null)[]>;

type ChartPalette = {
  grid: string;
  line: string;
  fill: string;
  point: string;
  surface: string;
  text: string;
  mutedText: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipBody: string;
  tooltipTitle: string;
  fontFamily: string;
};

export type ServerStatusHistoryChartLabels = {
  dataset: string;
  xAxis: string;
  yAxis: string;
};

const TICK_FONT_SIZE = 11;
const AXIS_TITLE_FONT_SIZE = 12;
const LEGEND_FONT_SIZE = 12;
const TOOLTIP_TITLE_FONT_SIZE = 12;
const TOOLTIP_BODY_FONT_SIZE = 12;

export class ServerStatusHistoryChartRenderer {
  private chartModulePromise: Promise<ChartJsModule> | null = null;
  private chart: ChartInstance | null = null;
  private chartCanvas: HTMLCanvasElement | null = null;
  private renderChain: Promise<void> = Promise.resolve();

  async render(
    points: DailyHighscoreEntry[],
    canvas: HTMLCanvasElement,
    locale: string,
    labels: ServerStatusHistoryChartLabels,
  ): Promise<void> {
    this.renderChain = this.renderChain.then(() => this.renderNow(points, canvas, locale, labels));
    await this.renderChain;
  }

  private async renderNow(
    points: DailyHighscoreEntry[],
    canvas: HTMLCanvasElement,
    locale: string,
    labels: ServerStatusHistoryChartLabels,
  ): Promise<void> {
    if (!points.length) {
      this.destroy();
      return;
    }

    const chartJs = await this.loadChartModule();
    const context = this.tryGetCanvasContext(canvas);
    if (!context) return;

    const axisLabels = points.map((entry) => this.formatChartDate(entry.date, locale));
    const values = points.map((entry) => entry.count);
    const palette = this.readChartPalette(canvas);

    if (this.chart && this.chartCanvas !== canvas) {
      this.destroy();
    }

    if (!this.chart) {
      this.chart = new chartJs.Chart(context, {
        type: 'line',
        data: {
          labels: axisLabels,
          datasets: [this.buildDataset(values, palette, labels.dataset)],
        },
        options: this.buildOptions(points, locale, palette, labels),
      });
      this.chartCanvas = canvas;
      return;
    }

    this.chart.data.labels = axisLabels;
    const dataset = this.chart.data.datasets[0];
    if (!dataset) return;

    dataset.data = values;
    dataset.label = labels.dataset;
    dataset.borderColor = palette.line;
    dataset.backgroundColor = palette.fill;
    dataset.pointBackgroundColor = palette.point;
    dataset.pointBorderColor = palette.surface;
    dataset.pointHoverBackgroundColor = palette.point;
    dataset.pointHoverBorderColor = palette.surface;
    this.chart.options = this.buildOptions(points, locale, palette, labels);
    this.chart.update();
  }

  destroy(): void {
    this.chart?.destroy();
    this.chart = null;
    this.chartCanvas = null;
  }

  private async loadChartModule(): Promise<ChartJsModule> {
    if (!this.chartModulePromise) {
      this.chartModulePromise = import('chart.js').then((chartJs) => {
        chartJs.Chart.register(
          chartJs.CategoryScale,
          chartJs.Filler,
          chartJs.Legend,
          chartJs.LineController,
          chartJs.LineElement,
          chartJs.LinearScale,
          chartJs.PointElement,
          chartJs.Title,
          chartJs.Tooltip,
        );
        return chartJs;
      });
    }

    return this.chartModulePromise;
  }

  private tryGetCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    if (typeof navigator !== 'undefined' && /\bjsdom\b/i.test(navigator.userAgent)) {
      return null;
    }

    try {
      return canvas.getContext('2d');
    } catch {
      return null;
    }
  }

  private formatChartDate(date: string, locale: string): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(parsed);
  }

  private formatChartCount(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatTooltipDate(date: string, locale: string): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(parsed);
  }

  private formatTooltipTime(updatedAt: string | null, locale: string): string | undefined {
    if (!updatedAt) {
      return undefined;
    }

    const parsed = new Date(updatedAt);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    const timeLabel = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    }).format(parsed);

    return `${timeLabel} UTC`;
  }

  private buildDataset(
    values: (number | null)[],
    palette: ChartPalette,
    label: string,
  ): ChartDataset {
    return {
      label,
      data: values,
      backgroundColor: palette.fill,
      borderColor: palette.line,
      borderWidth: 2.5,
      cubicInterpolationMode: 'monotone',
      fill: true,
      pointBackgroundColor: palette.point,
      pointBorderColor: palette.surface,
      pointBorderWidth: 2,
      pointHitRadius: 14,
      pointHoverBackgroundColor: palette.point,
      pointHoverBorderColor: palette.surface,
      pointHoverBorderWidth: 2,
      pointHoverRadius: 5,
      pointRadius: 0,
      spanGaps: true,
      tension: 0.28,
    };
  }

  private buildOptions(
    points: DailyHighscoreEntry[],
    locale: string,
    palette: ChartPalette,
    labels: ServerStatusHistoryChartLabels,
  ): ChartOptions {
    const tickFont = {
      family: palette.fontFamily,
      size: TICK_FONT_SIZE,
      weight: 'normal' as const,
    };
    const titleFont = {
      family: palette.fontFamily,
      size: AXIS_TITLE_FONT_SIZE,
      weight: 500 as const,
    };

    return {
      animation: false,
      locale,
      maintainAspectRatio: false,
      responsive: true,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      layout: {
        padding: {
          top: 8,
          right: 12,
          bottom: 6,
          left: 6,
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: {
            boxWidth: 18,
            boxHeight: 3,
            color: palette.text,
            font: {
              family: palette.fontFamily,
              size: LEGEND_FONT_SIZE,
              weight: 500,
            },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'line',
          },
        },
        tooltip: {
          backgroundColor: palette.tooltipBackground,
          bodyColor: palette.tooltipBody,
          borderColor: palette.tooltipBorder,
          borderWidth: 1,
          caretPadding: 8,
          cornerRadius: 12,
          displayColors: false,
          titleColor: palette.tooltipTitle,
          titleFont: {
            family: palette.fontFamily,
            size: TOOLTIP_TITLE_FONT_SIZE,
            weight: 'bold',
          },
          bodyFont: {
            family: palette.fontFamily,
            size: TOOLTIP_BODY_FONT_SIZE,
            weight: 'normal',
          },
          padding: 12,
          callbacks: {
            title: (tooltipItems) => {
              const point = tooltipItems[0] ? points[tooltipItems[0].dataIndex] : undefined;
              return point
                ? this.formatTooltipDate(point.date, locale)
                : (tooltipItems[0]?.label ?? '');
            },
            label: (tooltipItem) => {
              const raw = tooltipItem.parsed.y;
              if (raw === null || raw === undefined || Number.isNaN(Number(raw))) {
                return '—';
              }
              return this.formatChartCount(Number(raw), locale);
            },
            afterLabel: (tooltipItem) =>
              this.formatTooltipTime(points[tooltipItem.dataIndex]?.updatedAt ?? null, locale),
          },
        },
      },
      scales: {
        x: {
          border: {
            display: false,
          },
          grid: {
            display: false,
          },
          title: {
            display: true,
            text: labels.xAxis,
            color: palette.mutedText,
            font: titleFont,
            padding: { top: 10, bottom: 0 },
          },
          ticks: {
            autoSkip: true,
            color: palette.mutedText,
            font: tickFont,
            maxRotation: 0,
            maxTicksLimit: 6,
            minRotation: 0,
            padding: 6,
          },
        },
        y: {
          beginAtZero: true,
          border: {
            display: false,
          },
          grid: {
            color: palette.grid,
            drawTicks: false,
          },
          title: {
            display: true,
            text: labels.yAxis,
            color: palette.mutedText,
            font: titleFont,
            padding: { top: 0, bottom: 8 },
          },
          ticks: {
            callback: (value) => {
              const numericValue = Number(value);
              if (!Number.isFinite(numericValue)) {
                return '';
              }

              return this.formatChartCount(numericValue, locale);
            },
            color: palette.mutedText,
            font: tickFont,
            padding: 8,
            precision: 0,
          },
        },
      },
    };
  }

  private readChartPalette(canvas: HTMLCanvasElement): ChartPalette {
    const styles = getComputedStyle(canvas);
    const host = canvas.parentElement instanceof HTMLElement ? canvas.parentElement : canvas;
    const hostStyles = getComputedStyle(host);
    const fontFamily =
      hostStyles.fontFamily?.trim() ||
      styles.fontFamily?.trim() ||
      'Roboto, "Helvetica Neue", sans-serif';

    return {
      grid: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-grid').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-grid').trim() ||
          styles.getPropertyValue('--mat-sys-outline-variant').trim(),
        '#c4c7cf',
      ),
      line: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-line').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-line').trim() ||
          styles.getPropertyValue('--mat-sys-primary').trim(),
        '#005cbb',
      ),
      fill: this.resolveBackgroundToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-fill').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-fill').trim() ||
          'color-mix(in srgb, var(--mat-sys-primary) 20%, transparent)',
        'rgba(0, 92, 187, 0.18)',
      ),
      point: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-point').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-point').trim() ||
          styles.getPropertyValue('--mat-sys-primary').trim(),
        '#005cbb',
      ),
      surface: this.resolveBackgroundToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-surface').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-surface').trim() ||
          styles.getPropertyValue('--mat-sys-surface-container-lowest').trim(),
        '#fef7ff',
      ),
      text: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-text').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-text').trim() ||
          styles.getPropertyValue('--mat-sys-on-surface').trim(),
        '#1c1b1f',
      ),
      mutedText: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-muted-text').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-muted-text').trim() ||
          styles.getPropertyValue('--mat-sys-on-surface-variant').trim(),
        '#49454f',
      ),
      tooltipBackground: this.resolveBackgroundToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-background').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-tooltip-background').trim() ||
          styles.getPropertyValue('--mat-sys-surface-container-highest').trim(),
        '#e6e0e9',
      ),
      tooltipBorder: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-border').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-tooltip-border').trim() ||
          styles.getPropertyValue('--mat-sys-outline-variant').trim(),
        '#c4c7cf',
      ),
      tooltipBody: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-body').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-tooltip-body').trim() ||
          styles.getPropertyValue('--mat-sys-on-surface').trim(),
        '#1c1b1f',
      ),
      tooltipTitle: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-title').trim() ||
          hostStyles.getPropertyValue('--app-status-chart-tooltip-title').trim() ||
          styles.getPropertyValue('--mat-sys-on-surface').trim(),
        '#1c1b1f',
      ),
      fontFamily,
    };
  }

  private resolveColorToken(canvas: HTMLCanvasElement, token: string, fallback: string): string {
    return this.resolveCssColor(canvas, token, fallback, 'color');
  }

  private resolveBackgroundToken(
    canvas: HTMLCanvasElement,
    token: string,
    fallback: string,
  ): string {
    return this.resolveCssColor(canvas, token, fallback, 'backgroundColor');
  }

  private resolveCssColor(
    canvas: HTMLCanvasElement,
    token: string,
    fallback: string,
    property: 'color' | 'backgroundColor',
  ): string {
    if (!token) {
      return fallback;
    }

    const host = canvas.parentElement instanceof HTMLElement ? canvas.parentElement : canvas;
    const probe = canvas.ownerDocument.createElement('span');
    probe.style.position = 'absolute';
    probe.style.inlineSize = '0';
    probe.style.blockSize = '0';
    probe.style.overflow = 'hidden';
    probe.style.opacity = '0';
    probe.style.pointerEvents = 'none';
    probe.style.setProperty('--app-status-chart-probe-color', token);
    probe.style[property] = 'var(--app-status-chart-probe-color)';
    host.appendChild(probe);

    const probeStyles = getComputedStyle(probe);
    const resolved =
      property === 'backgroundColor' ? probeStyles.backgroundColor : probeStyles.color;
    probe.remove();

    return this.normalizeCanvasColor(canvas, resolved) || resolved || fallback;
  }

  private normalizeCanvasColor(canvas: HTMLCanvasElement, color: string): string | null {
    if (!color) {
      return null;
    }

    const normalizationCanvas = canvas.ownerDocument.createElement('canvas');
    const context = normalizationCanvas.getContext('2d');
    if (!context) {
      return color;
    }

    try {
      context.fillStyle = color;
      return context.fillStyle || color;
    } catch {
      return color;
    }
  }
}
