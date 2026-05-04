import type { DailyHighscoreEntry } from '@arsnova/shared-types';

type ChartJsModule = typeof import('chart.js');
type ChartInstance = import('chart.js').Chart<'line', number[], string>;
type ChartOptions = import('chart.js').ChartOptions<'line'>;
type ChartDataset = import('chart.js').ChartDataset<'line', number[]>;

type ChartPalette = {
  grid: string;
  line: string;
  point: string;
  text: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipBody: string;
  tooltipTitle: string;
};

export class ServerStatusHistoryChartRenderer {
  private chartModulePromise: Promise<ChartJsModule> | null = null;
  private chart: ChartInstance | null = null;
  private chartCanvas: HTMLCanvasElement | null = null;
  private renderChain: Promise<void> = Promise.resolve();

  async render(
    points: DailyHighscoreEntry[],
    canvas: HTMLCanvasElement,
    locale: string,
  ): Promise<void> {
    this.renderChain = this.renderChain.then(() => this.renderNow(points, canvas, locale));
    await this.renderChain;
  }

  private async renderNow(
    points: DailyHighscoreEntry[],
    canvas: HTMLCanvasElement,
    locale: string,
  ): Promise<void> {
    if (!points.length) {
      this.destroy();
      return;
    }

    const chartJs = await this.loadChartModule();
    const context = this.tryGetCanvasContext(canvas);
    if (!context) return;

    const labels = points.map((entry) => this.formatChartDate(entry.date, locale));
    const values = points.map((entry) => entry.count);
    const palette = this.readChartPalette(canvas);

    if (this.chart && this.chartCanvas !== canvas) {
      this.destroy();
    }

    if (!this.chart) {
      this.chart = new chartJs.Chart(context, {
        type: 'line',
        data: {
          labels,
          datasets: [this.buildDataset(values, palette)],
        },
        options: this.buildOptions(locale, palette),
      });
      this.chartCanvas = canvas;
      return;
    }

    this.chart.data.labels = labels;
    const dataset = this.chart.data.datasets[0];
    if (!dataset) return;

    dataset.data = values;
    dataset.borderColor = palette.line;
    dataset.backgroundColor = palette.line;
    dataset.pointBackgroundColor = palette.point;
    dataset.pointBorderColor = palette.point;
    dataset.pointHoverBackgroundColor = palette.point;
    dataset.pointHoverBorderColor = palette.point;
    this.chart.options = this.buildOptions(locale, palette);
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
          chartJs.LineController,
          chartJs.LineElement,
          chartJs.LinearScale,
          chartJs.PointElement,
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

  private buildDataset(values: number[], palette: ChartPalette): ChartDataset {
    return {
      data: values,
      backgroundColor: palette.line,
      borderColor: palette.line,
      borderWidth: 2,
      cubicInterpolationMode: 'monotone',
      fill: false,
      pointBackgroundColor: palette.point,
      pointBorderColor: palette.point,
      pointHitRadius: 16,
      pointHoverBackgroundColor: palette.point,
      pointHoverBorderColor: palette.point,
      pointHoverRadius: 4,
      pointRadius: 2.5,
      tension: 0.32,
    };
  }

  private buildOptions(locale: string, palette: ChartPalette): ChartOptions {
    return {
      animation: false,
      locale,
      maintainAspectRatio: false,
      responsive: true,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: palette.tooltipBackground,
          bodyColor: palette.tooltipBody,
          borderColor: palette.tooltipBorder,
          borderWidth: 1,
          displayColors: false,
          titleColor: palette.tooltipTitle,
          callbacks: {
            label: (tooltipItem) =>
              this.formatChartCount(Number(tooltipItem.parsed.y ?? 0), locale),
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
          ticks: {
            autoSkip: true,
            color: palette.text,
            maxRotation: 0,
            maxTicksLimit: 6,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          border: {
            display: false,
          },
          grid: {
            color: palette.grid,
          },
          ticks: {
            callback: (value) => {
              const numericValue = Number(value);
              if (!Number.isFinite(numericValue)) {
                return '';
              }

              return this.formatChartCount(numericValue, locale);
            },
            color: palette.text,
            precision: 0,
          },
        },
      },
    };
  }

  private readChartPalette(canvas: HTMLCanvasElement): ChartPalette {
    const styles = getComputedStyle(canvas);
    return {
      grid: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-grid').trim() ||
          styles.getPropertyValue('--mat-sys-outline-variant').trim(),
        '#c4c7cf',
      ),
      line: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-line').trim() ||
          styles.getPropertyValue('--mat-sys-primary').trim(),
        '#005cbb',
      ),
      point: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-point').trim() ||
          styles.getPropertyValue('--mat-sys-tertiary').trim(),
        '#7d5260',
      ),
      text: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-text').trim() ||
          styles.getPropertyValue('--mat-sys-on-surface').trim(),
        '#1c1b1f',
      ),
      tooltipBackground: this.resolveBackgroundToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-background').trim() ||
          styles.getPropertyValue('--mat-sys-surface-container-high').trim(),
        '#f3f0f4',
      ),
      tooltipBorder: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-border').trim() ||
          styles.getPropertyValue('--mat-sys-outline-variant').trim(),
        '#c4c7cf',
      ),
      tooltipBody: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-body').trim() ||
          styles.getPropertyValue('--mat-sys-on-surface').trim(),
        '#1c1b1f',
      ),
      tooltipTitle: this.resolveColorToken(
        canvas,
        styles.getPropertyValue('--app-status-chart-tooltip-title').trim() ||
          styles.getPropertyValue('--mat-sys-on-surface').trim(),
        '#1c1b1f',
      ),
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
