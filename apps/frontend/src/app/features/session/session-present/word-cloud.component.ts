import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  LOCALE_ID,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { getEffectiveLocale, localeIdToSupported } from '../../../core/locale-from-path';
import {
  aggregateWeightedWords,
  getStopwordsForLocale,
  type WeightedWordSource,
} from './word-cloud.util';

const EMPTY_STOPWORDS = new Set<string>();

interface CloudWord {
  word: string;
  count: number;
  size: number;
}

interface ExportChipLayout {
  readonly entry: CloudWord;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ExportPalette {
  readonly panelBackground: string;
  readonly panelBorder: string;
  readonly chipBackground: string;
  readonly chipBorder: string;
  readonly chipText: string;
  readonly activeChipBackground: string;
  readonly activeChipBorder: string;
  readonly activeChipText: string;
  readonly fontFamily: string;
}

interface RoundedRectStyle {
  readonly fill: string;
  readonly stroke: string;
}

@Component({
  selector: 'app-word-cloud',
  standalone: true,
  imports: [MatButton, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatIcon],
  templateUrl: './word-cloud.component.html',
  styleUrl: './word-cloud.component.scss',
})
export class WordCloudComponent {
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);
  private readonly exportSurface = viewChild.required<ElementRef<HTMLElement>>('exportSurface');
  private readonly activeLocale = getEffectiveLocale(localeIdToSupported(this.localeId));
  private readonly stopwords = getStopwordsForLocale(this.activeLocale);
  private static readonly EXPORT_WIDTH = 1400;
  private static readonly EXPORT_PADDING = 64;
  private static readonly EXPORT_GAP = 18;
  private static readonly EXPORT_CHIP_PADDING_X = 18;
  private static readonly EXPORT_CHIP_PADDING_Y = 10;

  readonly responses = input<string[]>([]);
  readonly weightedResponses = input<WeightedWordSource[] | null>(null);
  readonly title = input($localize`:@@wordCloud.title:Word-Cloud (Freitext)`);
  readonly emptyMessage = input(
    $localize`:@@wordCloud.empty:Noch keine Freitext-Antworten vorhanden.`,
  );
  readonly itemLabelSingular = input($localize`:@@wordCloud.itemSingular:Antwort`);
  readonly itemLabelPlural = input($localize`Antworten`);
  readonly showResponsesPanel = input(true);
  readonly showReleaseNote = input(true);
  readonly selectedWord = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly hideStopwords = signal(true);
  readonly showResponses = signal(false);
  readonly showStopwordsLabel = $localize`:@@wordCloud.showStopwords:Stopwörter einblenden`;
  readonly hideStopwordsLabel = $localize`:@@wordCloud.hideStopwords:Stopwörter ausblenden`;

  private readonly aggregationSources = computed<WeightedWordSource[]>(() => {
    const weighted = this.weightedResponses();
    if (weighted && weighted.length > 0) {
      return weighted;
    }

    return this.responses().map((response) => ({ text: response }));
  });

  readonly words = computed<CloudWord[]>(() => {
    const aggregated = aggregateWeightedWords(
      this.aggregationSources(),
      this.hideStopwords() ? this.stopwords : EMPTY_STOPWORDS,
    );
    const maxCount = aggregated[0]?.count ?? 1;
    return aggregated.map((entry) => ({
      ...entry,
      size: 14 + Math.round((entry.count / maxCount) * 26),
    }));
  });

  readonly filteredResponses = computed(() => {
    const selected = this.selectedWord();
    if (!selected) return this.responses();
    return this.responses().filter((response) => response.toLowerCase().includes(selected));
  });

  readonly stageMinHeight = computed(() => {
    const wordCount = this.words().length;
    if (wordCount <= 6) return '10.5rem';
    if (wordCount <= 14) return '14rem';
    if (wordCount <= 28) return '18rem';
    return '22rem';
  });

  readonly responseSummary = computed(() => ({
    total: this.responses().length,
    visible: this.filteredResponses().length,
  }));

  itemLabel(count: number): string {
    return count === 1 ? this.itemLabelSingular() : this.itemLabelPlural();
  }

  toggleWord(word: string): void {
    this.selectedWord.update((current) => (current === word ? null : word));
  }

  toggleStopwords(): void {
    this.hideStopwords.update((value) => !value);
    this.selectedWord.set(null);
  }

  toggleResponses(): void {
    this.showResponses.update((value) => !value);
  }

  exportCsv(): void {
    const rows = ['word,count', ...this.words().map((entry) => `${entry.word},${entry.count}`)];
    this.downloadBlob(
      rows.join('\n'),
      `wordcloud_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8',
    );
    this.statusMessage.set($localize`CSV exportiert.`);
  }

  async exportPng(): Promise<void> {
    if (this.words().length === 0) {
      this.statusMessage.set($localize`PNG-Export nicht möglich.`);
      return;
    }

    const canvas = this.document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.statusMessage.set($localize`PNG-Export nicht möglich.`);
      return;
    }

    const palette = this.readExportPalette();
    const layout = this.createExportLayout(ctx, palette);
    const scale = 2;
    canvas.width = WordCloudComponent.EXPORT_WIDTH * scale;
    canvas.height = layout.height * scale;
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, WordCloudComponent.EXPORT_WIDTH, layout.height);

    this.drawRoundedRect(
      ctx,
      0.5,
      0.5,
      WordCloudComponent.EXPORT_WIDTH - 1,
      layout.height - 1,
      28,
      { fill: palette.panelBackground, stroke: palette.panelBorder },
    );

    ctx.textBaseline = 'middle';
    for (const chip of layout.chips) {
      const isActive = this.selectedWord() === chip.entry.word;
      const fill = isActive ? palette.activeChipBackground : palette.chipBackground;
      const stroke = isActive ? palette.activeChipBorder : palette.chipBorder;
      const textColor = isActive ? palette.activeChipText : palette.chipText;
      const radius = Math.min(22, chip.height / 2);

      this.drawRoundedRect(ctx, chip.x, chip.y, chip.width, chip.height, radius, {
        fill,
        stroke,
      });
      ctx.font = `600 ${chip.entry.size}px ${palette.fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.fillText(
        chip.entry.word,
        chip.x + WordCloudComponent.EXPORT_CHIP_PADDING_X,
        chip.y + chip.height / 2,
      );
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), 'image/png'),
    );
    if (!blob) {
      this.statusMessage.set($localize`PNG-Export nicht möglich.`);
      return;
    }

    this.downloadBlob(blob, `wordcloud_${new Date().toISOString().slice(0, 10)}.png`, 'image/png');
    this.statusMessage.set($localize`PNG exportiert.`);
  }

  private downloadBlob(data: Blob | string, filename: string, mimeType: string): void {
    const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private createExportLayout(
    ctx: CanvasRenderingContext2D,
    palette: ExportPalette,
  ): { readonly chips: ExportChipLayout[]; readonly height: number } {
    const maxWidth = WordCloudComponent.EXPORT_WIDTH - WordCloudComponent.EXPORT_PADDING * 2;
    const chips: ExportChipLayout[] = [];
    let currentRow: Array<{ entry: CloudWord; width: number; height: number }> = [];
    let y = WordCloudComponent.EXPORT_PADDING;
    let rowHeight = 0;

    const flushRow = () => {
      if (currentRow.length === 0) {
        return;
      }

      const rowWidth =
        currentRow.reduce((sum, item) => sum + item.width, 0) +
        WordCloudComponent.EXPORT_GAP * (currentRow.length - 1);
      let x = WordCloudComponent.EXPORT_PADDING + Math.max(0, (maxWidth - rowWidth) / 2);

      for (const item of currentRow) {
        chips.push({
          entry: item.entry,
          x,
          y,
          width: item.width,
          height: item.height,
        });
        x += item.width + WordCloudComponent.EXPORT_GAP;
      }

      y += rowHeight + WordCloudComponent.EXPORT_GAP;
      currentRow = [];
      rowHeight = 0;
    };

    let currentRowWidth = 0;

    for (const entry of this.words()) {
      ctx.font = `600 ${entry.size}px ${palette.fontFamily}`;
      const textWidth = ctx.measureText(entry.word).width;
      const chipHeight = entry.size + WordCloudComponent.EXPORT_CHIP_PADDING_Y * 2;
      const chipWidth = Math.ceil(textWidth + WordCloudComponent.EXPORT_CHIP_PADDING_X * 2);

      const projectedWidth =
        currentRowWidth === 0
          ? chipWidth
          : currentRowWidth + WordCloudComponent.EXPORT_GAP + chipWidth;

      if (currentRow.length > 0 && projectedWidth > maxWidth) {
        flushRow();
        currentRowWidth = 0;
      }

      currentRow.push({
        entry,
        width: chipWidth,
        height: chipHeight,
      });
      currentRowWidth =
        currentRowWidth === 0
          ? chipWidth
          : currentRowWidth + WordCloudComponent.EXPORT_GAP + chipWidth;
      rowHeight = Math.max(rowHeight, chipHeight);
    }

    flushRow();

    return {
      chips,
      height: Math.max(
        300,
        Math.ceil(y - WordCloudComponent.EXPORT_GAP + WordCloudComponent.EXPORT_PADDING),
      ),
    };
  }

  private readExportPalette(): ExportPalette {
    const exportSurface = this.exportSurface().nativeElement;
    const surfaceStyle = this.readComputedStyle(exportSurface);
    const defaultButton = exportSurface.querySelector<HTMLButtonElement>(
      '.word-cloud__word:not(.word-cloud__word--active)',
    );
    const activeButton =
      exportSurface.querySelector<HTMLButtonElement>('.word-cloud__word--active') ?? defaultButton;
    const defaultButtonStyle = defaultButton ? this.readComputedStyle(defaultButton) : null;
    const activeButtonStyle = activeButton
      ? this.readComputedStyle(activeButton)
      : defaultButtonStyle;

    return {
      panelBackground: surfaceStyle.backgroundColor || 'rgb(248, 250, 252)',
      panelBorder: surfaceStyle.borderTopColor || 'rgb(203, 213, 225)',
      chipBackground: defaultButtonStyle?.backgroundColor || 'rgb(255, 255, 255)',
      chipBorder: defaultButtonStyle?.borderTopColor || 'rgb(203, 213, 225)',
      chipText: defaultButtonStyle?.color || 'rgb(15, 23, 42)',
      activeChipBackground: activeButtonStyle?.backgroundColor || 'rgb(219, 234, 254)',
      activeChipBorder: activeButtonStyle?.borderTopColor || 'rgb(96, 165, 250)',
      activeChipText: activeButtonStyle?.color || 'rgb(15, 23, 42)',
      fontFamily: defaultButtonStyle?.fontFamily || surfaceStyle.fontFamily || 'system-ui',
    };
  }

  private readComputedStyle(element: HTMLElement): CSSStyleDeclaration {
    return this.document.defaultView?.getComputedStyle(element) ?? element.style;
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    style: RoundedRectStyle,
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
