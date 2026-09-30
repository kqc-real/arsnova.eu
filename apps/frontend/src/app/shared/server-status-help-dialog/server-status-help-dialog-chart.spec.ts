import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerStatusHistoryChartRenderer } from './server-status-help-dialog-chart';

const basePalette = {
  grid: 'rgb(120, 120, 120)',
  line: 'rgb(255, 171, 243)',
  fill: 'rgba(255, 171, 243, 0.22)',
  point: 'rgb(255, 171, 243)',
  surface: 'rgb(45, 41, 44)',
  text: 'rgb(233, 224, 228)',
  mutedText: 'rgb(180, 172, 176)',
  tooltipBackground: 'rgb(45, 41, 44)',
  tooltipBorder: 'rgb(95, 88, 92)',
  tooltipBody: 'rgb(233, 224, 228)',
  tooltipTitle: 'rgb(233, 224, 228)',
  fontFamily: 'Roboto, sans-serif',
};

const baseLabels = {
  dataset: 'Join-Höchststand',
  xAxis: 'Datum (UTC)',
  yAxis: 'Joins (kumulativ)',
};

describe('ServerStatusHistoryChartRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('resolves theme token formulas to concrete chart text colors', () => {
    const shell = document.createElement('div');
    const canvas = document.createElement('canvas');
    shell.appendChild(canvas);
    document.body.appendChild(shell);

    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((element: Element) => {
      if (element === canvas) {
        return {
          getPropertyValue: (property: string) => {
            switch (property) {
              case '--app-status-chart-grid':
                return 'rgb(120, 120, 120)';
              case '--app-status-chart-line':
                return 'rgb(255, 171, 243)';
              case '--app-status-chart-fill':
                return 'rgba(255, 171, 243, 0.22)';
              case '--app-status-chart-point':
                return 'rgb(255, 171, 243)';
              case '--app-status-chart-surface':
                return 'rgb(45, 41, 44)';
              case '--app-status-chart-text':
                return 'light-dark(#1e1a1d, #e9e0e4)';
              case '--app-status-chart-muted-text':
                return 'rgb(180, 172, 176)';
              case '--app-status-chart-tooltip-background':
                return 'rgb(45, 41, 44)';
              case '--app-status-chart-tooltip-border':
                return 'rgb(95, 88, 92)';
              case '--app-status-chart-tooltip-body':
              case '--app-status-chart-tooltip-title':
                return 'rgb(233, 224, 228)';
              default:
                return '';
            }
          },
          fontFamily: 'Roboto, sans-serif',
        } as CSSStyleDeclaration;
      }

      if (element === shell) {
        return {
          getPropertyValue: (property: string) => {
            if (property.startsWith('--app-status-chart-')) {
              return '';
            }
            return '';
          },
          fontFamily: 'Roboto, sans-serif',
          color: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
        } as CSSStyleDeclaration;
      }

      const htmlElement = element as HTMLElement;
      const probeToken = htmlElement.style.getPropertyValue('--app-status-chart-probe-color');
      let color = 'rgb(0, 0, 0)';
      let backgroundColor = htmlElement.style.backgroundColor || 'rgb(45, 41, 44)';
      if (probeToken === 'light-dark(#1e1a1d, #e9e0e4)') {
        color = 'rgb(233, 224, 228)';
      } else if (probeToken === 'rgb(180, 172, 176)') {
        color = 'rgb(180, 172, 176)';
      } else if (probeToken === 'rgba(255, 171, 243, 0.22)') {
        backgroundColor = 'rgba(255, 171, 243, 0.22)';
      } else if (probeToken === 'rgb(45, 41, 44)') {
        backgroundColor = 'rgb(45, 41, 44)';
      }
      return {
        getPropertyValue: () => '',
        color,
        backgroundColor,
        fontFamily: 'Roboto, sans-serif',
      } as CSSStyleDeclaration;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      let fillStyle = '';
      return {
        get fillStyle() {
          return fillStyle;
        },
        set fillStyle(value: string) {
          fillStyle = value;
        },
      } as unknown as CanvasRenderingContext2D;
    });

    const renderer = new ServerStatusHistoryChartRenderer() as ServerStatusHistoryChartRenderer & {
      readChartPalette: (canvas: HTMLCanvasElement) => {
        text: string;
        mutedText: string;
        fill: string;
        fontFamily: string;
      };
    };

    const palette = renderer.readChartPalette(canvas);

    expect(palette.text).toBe('rgb(233, 224, 228)');
    expect(palette.mutedText).toBe('rgb(180, 172, 176)');
    expect(palette.fill).toBe('rgba(255, 171, 243, 0.22)');
    expect(palette.fontFamily).toContain('Roboto');
  });

  it('formats y-axis ticks with the active locale', () => {
    const renderer = new ServerStatusHistoryChartRenderer() as ServerStatusHistoryChartRenderer & {
      buildOptions: (
        points: Array<{ date: string; count: number; updatedAt: string | null }>,
        locale: string,
        palette: typeof basePalette,
        labels: typeof baseLabels,
      ) => {
        scales?: {
          y?: {
            ticks?: {
              callback?: (value: number | string) => string;
            };
          };
        };
      };
    };

    const options = renderer.buildOptions([], 'de-DE', basePalette, baseLabels);

    expect(options.scales?.y?.ticks?.callback?.(1400)).toBe('1.400');
  });

  it('exposes axis titles and a legend for the join-record series', () => {
    const renderer = new ServerStatusHistoryChartRenderer() as ServerStatusHistoryChartRenderer & {
      buildOptions: (
        points: Array<{ date: string; count: number; updatedAt: string | null }>,
        locale: string,
        palette: typeof basePalette,
        labels: typeof baseLabels,
      ) => {
        plugins?: {
          legend?: {
            display?: boolean;
            labels?: { font?: { size?: number } };
          };
        };
        scales?: {
          x?: {
            title?: { display?: boolean; text?: string };
            ticks?: { font?: { size?: number } };
          };
          y?: {
            title?: { display?: boolean; text?: string };
            ticks?: { font?: { size?: number } };
          };
        };
      };
      buildDataset: (
        values: (number | null)[],
        palette: typeof basePalette,
        label: string,
      ) => { label?: string; fill?: boolean; borderWidth?: number };
    };

    const options = renderer.buildOptions([], 'de-DE', basePalette, baseLabels);
    const dataset = renderer.buildDataset([1, 2], basePalette, baseLabels.dataset);

    expect(options.plugins?.legend?.display).toBe(true);
    expect(options.plugins?.legend?.labels?.font?.size).toBe(12);
    expect(options.scales?.x?.title).toEqual(
      expect.objectContaining({ display: true, text: 'Datum (UTC)' }),
    );
    expect(options.scales?.y?.title).toEqual(
      expect.objectContaining({ display: true, text: 'Joins (kumulativ)' }),
    );
    expect(options.scales?.x?.ticks?.font?.size).toBe(11);
    expect(options.scales?.y?.ticks?.font?.size).toBe(11);
    expect(dataset.label).toBe('Join-Höchststand');
    expect(dataset).toEqual(expect.objectContaining({ fill: true, borderWidth: 2.5 }));
  });

  it('shows the exact UTC time in the tooltip when a timestamp is available', () => {
    const renderer = new ServerStatusHistoryChartRenderer() as ServerStatusHistoryChartRenderer & {
      buildOptions: (
        points: Array<{ date: string; count: number; updatedAt: string | null }>,
        locale: string,
        palette: typeof basePalette,
        labels: typeof baseLabels,
      ) => {
        plugins?: {
          tooltip?: {
            callbacks?: {
              afterLabel?: (tooltipItem: { dataIndex: number }) => string | string[] | undefined;
            };
          };
        };
      };
    };

    const options = renderer.buildOptions(
      [{ date: '2026-05-04', count: 1400, updatedAt: '2026-05-04T15:30:45.000Z' }],
      'de-DE',
      basePalette,
      baseLabels,
    );

    expect(options.plugins?.tooltip?.callbacks?.afterLabel?.({ dataIndex: 0 })).toBe(
      '15:30:45 UTC',
    );
  });
});
