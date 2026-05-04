import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerStatusHistoryChartRenderer } from './server-status-help-dialog-chart';

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
              case '--app-status-chart-point':
                return 'rgb(255, 232, 252)';
              case '--app-status-chart-text':
                return 'light-dark(#1e1a1d, #e9e0e4)';
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
        } as CSSStyleDeclaration;
      }

      const htmlElement = element as HTMLElement;
      const probeToken = htmlElement.style.getPropertyValue('--app-status-chart-probe-color');
      return {
        getPropertyValue: () => '',
        color:
          probeToken === 'light-dark(#1e1a1d, #e9e0e4)' ? 'rgb(233, 224, 228)' : 'rgb(0, 0, 0)',
        backgroundColor: htmlElement.style.backgroundColor || 'rgb(45, 41, 44)',
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
      readChartPalette: (canvas: HTMLCanvasElement) => { text: string };
    };

    const palette = renderer.readChartPalette(canvas);

    expect(palette.text).toBe('rgb(233, 224, 228)');
  });

  it('formats y-axis ticks with the active locale', () => {
    const renderer = new ServerStatusHistoryChartRenderer() as ServerStatusHistoryChartRenderer & {
      buildOptions: (
        locale: string,
        palette: {
          grid: string;
          line: string;
          point: string;
          text: string;
          tooltipBackground: string;
          tooltipBorder: string;
          tooltipBody: string;
          tooltipTitle: string;
        },
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

    const options = renderer.buildOptions('de-DE', {
      grid: 'rgb(120, 120, 120)',
      line: 'rgb(255, 171, 243)',
      point: 'rgb(255, 232, 252)',
      text: 'rgb(233, 224, 228)',
      tooltipBackground: 'rgb(45, 41, 44)',
      tooltipBorder: 'rgb(95, 88, 92)',
      tooltipBody: 'rgb(233, 224, 228)',
      tooltipTitle: 'rgb(233, 224, 228)',
    });

    expect(options.scales?.y?.ticks?.callback?.(1400)).toBe('1.400');
  });
});
