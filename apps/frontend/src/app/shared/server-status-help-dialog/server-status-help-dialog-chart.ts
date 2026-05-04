import type { DailyHighscoreEntry } from '@arsnova/shared-types';

type ChartJsModule = typeof import('chart.js');
type ChartInstance = import('chart.js').Chart<'line', number[], string>;

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
          datasets: [
            {
              data: values,
              borderColor: palette.line,
              backgroundColor: palette.line,
              pointBackgroundColor: palette.point,
              pointBorderColor: palette.point,
              pointHoverBackgroundColor: palette.point,
              pointHoverBorderColor: palette.point,
              borderWidth: 2,
              cubicInterpolationMode: 'monotone',
              fill: false,
              pointHitRadius: 16,
              pointHoverRadius: 4,
              pointRadius: 2.5,
              tension: 0.32,
            },
          ],
        },
        options: {
          animation: false,
          maintainAspectRatio: false,
          responsive: true,
          interaction: {
            intersect: false,
            mode: 'index',
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                label: (tooltipItem) =>
                  new Intl.NumberFormat(locale).format(Number(tooltipItem.parsed.y ?? 0)),
              },
            },
          },
          scales: {
            x: {
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
              grid: {
                color: palette.grid,
              },
              ticks: {
                color: palette.text,
                precision: 0,
              },
            },
          },
        },
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

  private readChartPalette(canvas: HTMLCanvasElement): {
    grid: string;
    line: string;
    point: string;
    text: string;
  } {
    const styles = getComputedStyle(canvas);
    return {
      grid: styles.getPropertyValue('--mat-sys-outline-variant').trim() || '#c4c7cf',
      line: styles.getPropertyValue('--mat-sys-primary').trim() || '#005cbb',
      point: styles.getPropertyValue('--mat-sys-tertiary').trim() || '#7d5260',
      text: styles.getPropertyValue('--mat-sys-on-surface-variant').trim() || '#44474e',
    };
  }
}
