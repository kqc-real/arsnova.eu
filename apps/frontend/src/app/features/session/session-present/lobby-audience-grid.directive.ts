import {
  afterRenderEffect,
  computed,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  lobbyAnimalGridColumnCount,
  lobbyFitColumnCount,
  lobbyTextGridLayout,
} from './lobby-audience-density.util';

@Directive({
  selector: '[appLobbyAudienceGrid]',
  standalone: true,
  host: {
    '[style.grid-template-columns]': 'gridColumns()',
    '[style.--lobby-name-size.px]': 'layout().fontSize',
  },
})
export class LobbyAudienceGridDirective {
  readonly appLobbyAudienceGrid = input.required<'animals' | 'text' | 'count'>();
  readonly participantCount = input.required<number>();
  readonly names = input<readonly string[]>([]);
  private readonly grid = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly size = signal<DOMRectReadOnly | null>(null);
  private readonly fontsReady = signal(false);

  protected readonly layout = computed(() => {
    const count = this.participantCount();
    const size = this.size();
    const view = this.grid.ownerDocument.defaultView;
    const mode = this.appLobbyAudienceGrid();
    const fallback = { columns: lobbyFitColumnCount(count), fontSize: null, minColumnWidth: 0 };
    if (!size?.width || !size.height || !view || mode === 'count') return fallback;

    const styles = view.getComputedStyle(this.grid);
    const columnGap = Number.parseFloat(styles.columnGap) || 0;
    const rowGap = Number.parseFloat(styles.rowGap) || 0;
    if (mode === 'animals') {
      return {
        columns: lobbyAnimalGridColumnCount(count, size.width, size.height, columnGap, rowGap),
        fontSize: null,
        minColumnWidth: 0,
      };
    }

    if (!this.fontsReady()) return fallback;
    const context = this.grid.ownerDocument.createElement('canvas').getContext('2d');
    if (!context) return fallback;
    const rootSize = Number.parseFloat(
      view.getComputedStyle(this.grid.ownerDocument.documentElement).fontSize,
    );
    // Use a standard canvas weight for Safari and budget for the wider glyphs.
    context.font = `700 100px ${styles.fontFamily}`;
    let longestLine = 100;
    for (const name of this.names()) {
      longestLine = Math.max(longestLine, context.measureText(name).width);
    }
    return lobbyTextGridLayout(
      count,
      size.width,
      size.height,
      columnGap,
      rowGap,
      longestLine / 100,
      rootSize,
    );
  });

  protected readonly gridColumns = computed(() => {
    const { columns, minColumnWidth } = this.layout();
    const minimum = minColumnWidth ? `${minColumnWidth}px` : '0';
    return `repeat(${columns}, minmax(${minimum}, 1fr))`;
  });

  constructor() {
    afterRenderEffect((onCleanup) => {
      if (typeof ResizeObserver === 'undefined' || this.appLobbyAudienceGrid() === 'count') return;
      const observer = new ResizeObserver(([entry]) => {
        if (entry) this.size.set(entry.contentRect);
      });
      if (this.appLobbyAudienceGrid() === 'text') {
        const fonts = this.grid.ownerDocument.fonts;
        if (fonts) void fonts.ready.then(() => this.fontsReady.set(true));
        else this.fontsReady.set(true);
      }
      observer.observe(this.grid);
      onCleanup(() => observer.disconnect());
    });
  }
}
