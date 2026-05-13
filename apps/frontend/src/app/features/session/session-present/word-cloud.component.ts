import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  LOCALE_ID,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import d3Cloud, { type CloudLayout } from 'd3-cloud';
import { getEffectiveLocale, localeIdToSupported } from '../../../core/locale-from-path';
import {
  getWordCloudChipPadding,
  getWordCloudLayoutHeight,
  getWordCloudLayoutWordCap,
  shouldUseWordCloudLayout,
} from './word-cloud-layout';
import {
  aggregateWeightedWords,
  createWordCloudStopwordLookup,
  extractResponseGroupKeys,
  getStopwordsForLocale,
  normalizeFreeTextResponseForDisplay,
  type WordCloudAnalysisMode,
  type WeightedWordSource,
} from './word-cloud.util';
import type { WordCloudDialogData } from './word-cloud-dialog.component';

const CLOUD_LAYOUT_DEBOUNCE_MS = 120;
const CLOUD_LAYOUT_TIME_SLICE_MS = 8;

interface CloudWord {
  word: string;
  count: number;
  groupKey: string;
  variants: string[];
  size: number;
  rank: number;
}

interface PositionedCloudWord extends CloudWord {
  readonly x: number;
  readonly y: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly rotate: number;
}

interface LayoutWord {
  text: string;
  size: number;
  rotate: number;
  padding: number;
  entry: CloudWord;
  x?: number;
  y?: number;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
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
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatIcon,
  ],
  templateUrl: './word-cloud.component.html',
  styleUrl: './word-cloud.component.scss',
})
export class WordCloudComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog, { optional: true });
  private readonly localeId = inject(LOCALE_ID);
  private readonly exportSurface = viewChild<ElementRef<HTMLElement>>('exportSurface');
  private readonly layoutStage = viewChild<ElementRef<HTMLElement>>('layoutStage');
  private readonly activeLocale = getEffectiveLocale(localeIdToSupported(this.localeId));
  private readonly stopwords = getStopwordsForLocale(this.activeLocale);
  private static readonly EXPORT_WIDTH = 1400;
  private static readonly EXPORT_PADDING = 64;
  private static readonly EXPORT_GAP = 18;
  private static readonly EXPORT_CHIP_PADDING_X = 18;
  private static readonly EXPORT_CHIP_PADDING_Y = 10;
  private static readonly RESPONSES_PAGE_SIZE = 50;

  private resizeObserver: ResizeObserver | null = null;
  private observedStage: HTMLElement | null = null;
  private layoutTimer: ReturnType<typeof setTimeout> | null = null;
  private activeCloudLayout: CloudLayout<LayoutWord> | null = null;
  private layoutRunId = 0;
  private previousSelectionScopeKey: string | null | undefined = undefined;

  readonly responses = input<string[]>([]);
  readonly weightedResponses = input<WeightedWordSource[] | null>(null);
  readonly analysisMode = input<WordCloudAnalysisMode>('default');
  readonly selectionScopeKey = input<string | null>(null);
  readonly title = input($localize`:@@wordCloud.title:Word-Cloud (Freitext)`);
  readonly eyebrow = input<string | null>(null);
  readonly description = input<string | null>(
    $localize`:@@wordCloud.description:Antworten verdichten sich live zu einem schnellen Themenbild.`,
  );
  readonly presentationMode = input(false);
  readonly outputOnly = input(false);
  readonly showMaximizeAction = input(true);
  readonly showExportActions = input(true);
  readonly emptyMessage = input(
    $localize`:@@wordCloud.empty:Noch keine Freitext-Antworten vorhanden.`,
  );
  readonly itemLabelSingular = input($localize`:@@wordCloud.itemSingular:Antwort`);
  readonly itemLabelPlural = input($localize`:@@wordCloud.itemPlural:Antworten`);
  readonly wordLabelSingular = input($localize`:@@wordCloud.wordSingular:Wort`);
  readonly wordLabelPlural = input($localize`:@@wordCloud.wordPlural:Wörter`);
  readonly showResponsesSingularLabel = input(
    $localize`:@@wordCloud.showResponsesSingular:Antwort anzeigen`,
  );
  readonly showResponsesPluralLabel = input(
    $localize`:@@wordCloud.showResponsesPlural:Antworten anzeigen`,
  );
  readonly showResponsesPanel = input(true);
  readonly weightingHint = input<string | null>(
    $localize`:@@wordCloud.weightingHint:Größere Begriffe stehen für häufigere Nennungen.`,
  );
  readonly showReleaseNote = input(false);
  readonly selectedGroupKey = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly showResponses = signal(false);
  readonly responsesVisibleLimit = signal(WordCloudComponent.RESPONSES_PAGE_SIZE);
  readonly positionedWords = signal<PositionedCloudWord[]>([]);
  readonly layoutPending = signal(false);
  readonly maximizeLabel = $localize`:@@wordCloud.maximize:Maximieren`;
  readonly maximizeAriaLabel = $localize`:@@wordCloud.maximizeAria:Wortwolke maximieren`;
  readonly exportPngLabel = $localize`:@@wordCloud.exportPngOrdered:PNG exportieren (geordnet)`;
  readonly showActionsPanel = computed(
    () => !this.outputOnly() && (this.showMaximizeAction() || this.showExportActions()),
  );
  readonly showSupportingSection = computed(
    () =>
      this.showActionsPanel() ||
      (!this.outputOnly() && (this.showResponsesPanel() || this.showReleaseNote())),
  );

  private readonly stageWidth = signal(0);
  private readonly renderedCloudStageWidth = signal(0);
  private readonly renderedCloudStageHeight = signal(0);
  private readonly layoutFontFamily = signal('system-ui');
  private readonly activeLayoutSignature = signal('');
  private readonly stopwordLookup = computed(() =>
    createWordCloudStopwordLookup(this.stopwords, this.activeLocale, this.analysisMode()),
  );

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
      this.stopwords,
      this.activeLocale,
      this.analysisMode(),
    );
    const maxCount = aggregated[0]?.count ?? 1;
    const minFontSize = this.presentationMode() ? 16 : 14;
    const maxFontSize = this.presentationMode() ? 56 : 40;
    return aggregated.map((entry, index) => ({
      ...entry,
      size: minFontSize + Math.round((entry.count / maxCount) * (maxFontSize - minFontSize)),
      rank: index,
    }));
  });

  readonly displayWords = computed<CloudWord[]>(() => {
    const words = this.words();
    const width = this.stageWidth();
    if (!shouldUseWordCloudLayout(width, words.length)) {
      return words;
    }

    return words.slice(0, getWordCloudLayoutWordCap(width, this.presentationMode()));
  });

  readonly cloudStageHeightPx = computed(() => {
    const width = this.stageWidth();
    const wordCount = this.displayWords().length;
    if (!shouldUseWordCloudLayout(width, wordCount)) {
      return 0;
    }

    return getWordCloudLayoutHeight(width, wordCount, this.presentationMode());
  });

  readonly layoutInputSignature = computed(() => {
    const width = Math.round(this.stageWidth());
    const height = Math.round(this.cloudStageHeightPx());
    return [
      width,
      height,
      this.layoutFontFamily(),
      ...this.displayWords().map((entry) => `${entry.groupKey}:${entry.word}:${entry.count}`),
    ].join('|');
  });

  readonly cloudLayoutActive = computed(
    () =>
      this.positionedWords().length > 0 &&
      (this.activeLayoutSignature() === this.layoutInputSignature() || this.layoutPending()),
  );

  readonly renderedCloudStageHeightPx = computed(() =>
    this.cloudLayoutActive()
      ? this.renderedCloudStageHeight() || this.cloudStageHeightPx()
      : this.cloudStageHeightPx(),
  );

  readonly visibleWordCount = computed(() =>
    this.cloudLayoutActive() ? this.positionedWords().length : this.displayWords().length,
  );

  readonly isWordCountPartial = computed(() => this.visibleWordCount() < this.words().length);

  readonly selectedWordLabel = computed(() => {
    const selected = this.selectedGroupKey();
    if (!selected) {
      return null;
    }

    return this.words().find((entry) => entry.groupKey === selected)?.word ?? selected;
  });

  private readonly responseSearchIndex = computed(() =>
    this.responses().map((response) => ({
      response: normalizeFreeTextResponseForDisplay(response),
      groupKeys: new Set(
        extractResponseGroupKeys(
          response,
          this.stopwordLookup(),
          this.activeLocale,
          this.analysisMode(),
        ),
      ),
    })),
  );

  readonly filteredResponses = computed(() => {
    const selected = this.selectedGroupKey();
    return this.responseSearchIndex()
      .filter((entry) => !selected || entry.groupKeys.has(selected))
      .map((entry) => entry.response);
  });

  readonly visibleResponses = computed(() =>
    this.filteredResponses().slice(0, this.responsesVisibleLimit()),
  );

  readonly remainingResponsesCount = computed(() =>
    Math.max(0, this.filteredResponses().length - this.visibleResponses().length),
  );

  readonly hasMoreResponses = computed(() => this.remainingResponsesCount() > 0);

  readonly stageMinHeight = computed(() => {
    const wordCount = this.displayWords().length;
    if (this.presentationMode()) {
      if (wordCount <= 6) return '22rem';
      if (wordCount <= 14) return '28rem';
      if (wordCount <= 28) return '36rem';
      return '44rem';
    }

    if (wordCount <= 6) return '10.5rem';
    if (wordCount <= 14) return '14rem';
    if (wordCount <= 28) return '18rem';
    return '22rem';
  });

  readonly responseSummary = computed(() => ({
    total: this.responses().length,
    visible: this.filteredResponses().length,
  }));

  constructor() {
    effect(() => {
      const stage = this.layoutStage()?.nativeElement ?? null;
      queueMicrotask(() => this.observeStage(stage));
    });

    effect(() => {
      const scopeKey = this.selectionScopeKey();
      if (
        this.previousSelectionScopeKey !== undefined &&
        scopeKey !== this.previousSelectionScopeKey
      ) {
        this.selectedGroupKey.set(null);
        this.showResponses.set(false);
        this.responsesVisibleLimit.set(WordCloudComponent.RESPONSES_PAGE_SIZE);
      }
      this.previousSelectionScopeKey = scopeKey;
    });

    effect(() => {
      const selected = this.selectedGroupKey();
      if (!selected) {
        return;
      }

      const stillVisible = this.words().some((entry) => entry.groupKey === selected);
      if (!stillVisible) {
        this.selectedGroupKey.set(null);
        this.showResponses.set(false);
        this.responsesVisibleLimit.set(WordCloudComponent.RESPONSES_PAGE_SIZE);
      }
    });

    effect(() => {
      this.selectedGroupKey();
      this.responsesVisibleLimit.set(WordCloudComponent.RESPONSES_PAGE_SIZE);
    });

    effect(() => {
      const width = this.stageWidth();
      const height = this.cloudStageHeightPx();
      const signature = this.layoutInputSignature();
      const words = this.displayWords();
      const fontFamily = this.layoutFontFamily();

      if (!shouldUseWordCloudLayout(width, words.length)) {
        this.resetCloudLayout();
        return;
      }

      this.clearScheduledLayout();
      this.layoutPending.set(true);
      const runId = ++this.layoutRunId;
      const layoutWords = this.createLayoutWords(words);
      this.layoutTimer = setTimeout(
        () => this.runCloudLayout(layoutWords, width, height, fontFamily, signature, runId),
        CLOUD_LAYOUT_DEBOUNCE_MS,
      );
    });
  }

  ngAfterViewInit(): void {
    this.observeStage(this.layoutStage()?.nativeElement ?? null);
  }

  ngOnDestroy(): void {
    this.clearScheduledLayout();
    this.stopCloudLayout();
    this.resizeObserver?.disconnect();
  }

  itemLabel(count: number): string {
    return count === 1 ? this.itemLabelSingular() : this.itemLabelPlural();
  }

  wordLabel(count: number): string {
    return count === 1 ? this.wordLabelSingular() : this.wordLabelPlural();
  }

  showResponsesLabel(count: number): string {
    return count === 1 ? this.showResponsesSingularLabel() : this.showResponsesPluralLabel();
  }

  toggleWord(groupKey: string): void {
    this.selectedGroupKey.update((current) => (current === groupKey ? null : groupKey));
  }

  toggleResponses(): void {
    this.showResponses.update((value) => !value);
  }

  showMoreResponses(): void {
    this.responsesVisibleLimit.update((value) => value + WordCloudComponent.RESPONSES_PAGE_SIZE);
  }

  async openInDialog(): Promise<void> {
    const dialog = this.dialog;
    if (!dialog) {
      return;
    }

    const { WordCloudDialogComponent } = await import('./word-cloud-dialog.component');
    dialog.open(WordCloudDialogComponent, {
      data: this.buildDialogData(),
      autoFocus: false,
      restoreFocus: true,
      enterAnimationDuration: 180,
      exitAnimationDuration: 140,
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      panelClass: 'word-cloud-dialog-panel',
      backdropClass: 'word-cloud-dialog-backdrop',
    });
  }

  cloudWordLeft(entry: PositionedCloudWord): number {
    const stageWidth = this.cloudLayoutActive()
      ? this.renderedCloudStageWidth() || this.stageWidth()
      : this.stageWidth();
    return stageWidth / 2 + entry.x;
  }

  cloudWordTop(entry: PositionedCloudWord): number {
    const stageHeight = this.cloudLayoutActive()
      ? this.renderedCloudStageHeight() || this.cloudStageHeightPx()
      : this.cloudStageHeightPx();
    return stageHeight / 2 + entry.y;
  }

  cloudWordTransform(entry: PositionedCloudWord): string {
    return `translate(-50%, -50%) rotate(${entry.rotate}deg)`;
  }

  wordZIndex(rank: number): number {
    return Math.max(1, 200 - rank);
  }

  wordTooltip(entry: CloudWord): string {
    const base = $localize`:@@wordCloud.countTooltip:Anzahl: ${entry.count}:count:`;
    if (entry.variants.length <= 1) {
      return base;
    }

    const variants = this.wordVariantPreview(entry.variants);
    return $localize`:@@wordCloud.variantsTooltip:${base}:base: · Formen: ${variants}:variants:`;
  }

  loadMoreResponsesLabel(): string {
    const remaining = this.remainingResponsesCount();
    return remaining === 1
      ? $localize`:@@wordCloud.loadMoreOne:1 weitere Antwort laden`
      : $localize`:@@wordCloud.loadMoreMany:${remaining}:count: weitere Antworten laden`;
  }

  exportCsv(): void {
    const rows = [
      'word,count,variants',
      ...this.words().map((entry) =>
        [
          this.escapeCsvField(entry.word),
          String(entry.count),
          this.escapeCsvField(entry.variants.join(' | ')),
        ].join(','),
      ),
    ];
    this.downloadBlob(
      rows.join('\n'),
      `wordcloud_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8',
    );
    this.statusMessage.set($localize`CSV exportiert.`);
  }

  async exportPng(): Promise<void> {
    if (this.displayWords().length === 0) {
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
    const scale = 2;
    const layout = this.createExportLayout(ctx, palette);
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
      const isActive = this.selectedGroupKey() === chip.entry.groupKey;
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

  private observeStage(stage: HTMLElement | null): void {
    if (stage === this.observedStage) {
      if (stage) {
        this.updateStageMetrics(stage);
      }
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.observedStage = stage;

    if (!stage) {
      this.stageWidth.set(0);
      this.layoutFontFamily.set('system-ui');
      return;
    }

    this.updateStageMetrics(stage);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.updateStageMetrics(stage));
    this.resizeObserver.observe(stage);
  }

  private updateStageMetrics(stage: HTMLElement): void {
    const width = Math.max(0, Math.round(stage.clientWidth));
    if (width !== this.stageWidth()) {
      this.stageWidth.set(width);
    }

    const fontFamily = this.readComputedStyle(stage).fontFamily || 'system-ui';
    if (fontFamily !== this.layoutFontFamily()) {
      this.layoutFontFamily.set(fontFamily);
    }
  }

  private clearScheduledLayout(): void {
    if (this.layoutTimer) {
      clearTimeout(this.layoutTimer);
      this.layoutTimer = null;
    }
  }

  private stopCloudLayout(): void {
    this.activeCloudLayout?.stop();
    this.activeCloudLayout = null;
  }

  private resetCloudLayout(): void {
    this.clearScheduledLayout();
    this.stopCloudLayout();
    this.layoutPending.set(false);
    this.activeLayoutSignature.set('');
    this.positionedWords.set([]);
    this.renderedCloudStageWidth.set(0);
    this.renderedCloudStageHeight.set(0);
  }

  private createLayoutWords(entries: CloudWord[]): LayoutWord[] {
    return entries.map((entry) => ({
      text: entry.word,
      size: entry.size,
      rotate: 0,
      padding: getWordCloudChipPadding(entry.size),
      entry,
    }));
  }

  private runCloudLayout(
    words: LayoutWord[],
    stageWidth: number,
    stageHeight: number,
    fontFamily: string,
    signature: string,
    runId: number,
  ): void {
    this.layoutTimer = null;
    if (!shouldUseWordCloudLayout(stageWidth, words.length)) {
      this.resetCloudLayout();
      return;
    }

    this.stopCloudLayout();

    try {
      const layout = d3Cloud<LayoutWord>()
        .size([Math.round(stageWidth), Math.round(stageHeight)])
        .words(words.map((word) => ({ ...word })))
        .font(fontFamily || 'system-ui')
        .padding((word) => word.padding)
        .rotate((word) => word.rotate)
        .fontSize((word) => word.size)
        .random(this.createSeededRandom(this.hashSignature(signature)))
        .timeInterval(CLOUD_LAYOUT_TIME_SLICE_MS);

      this.activeCloudLayout = layout;
      layout.on('end', (placedWords) => {
        if (runId !== this.layoutRunId) {
          return;
        }

        const positioned = placedWords.map((word) => ({
          ...word.entry,
          x: word.x ?? 0,
          y: word.y ?? 0,
          x0: word.x0 ?? 0,
          x1: word.x1 ?? 0,
          y0: word.y0 ?? 0,
          y1: word.y1 ?? 0,
          rotate: word.rotate ?? 0,
        }));

        this.activeCloudLayout = null;
        this.layoutPending.set(false);
        this.positionedWords.set(positioned);
        this.renderedCloudStageWidth.set(Math.round(stageWidth));
        this.renderedCloudStageHeight.set(Math.round(stageHeight));
        this.activeLayoutSignature.set(positioned.length > 0 ? signature : '');
      });
      layout.start();
    } catch {
      if (runId !== this.layoutRunId) {
        return;
      }

      this.activeCloudLayout = null;
      this.layoutPending.set(false);
      this.positionedWords.set([]);
      this.renderedCloudStageWidth.set(0);
      this.renderedCloudStageHeight.set(0);
      this.activeLayoutSignature.set('');
    }
  }

  private createSeededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  private hashSignature(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
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

  private escapeCsvField(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private wordVariantPreview(variants: string[]): string {
    const preview = variants.slice(0, 4).join(' | ');
    return variants.length > 4 ? `${preview} | …` : preview;
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

    for (const entry of this.displayWords()) {
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

  private buildDialogData(): WordCloudDialogData {
    return {
      responses: this.responses(),
      weightedResponses: this.weightedResponses(),
      analysisMode: this.analysisMode(),
      title: this.title(),
      eyebrow: this.eyebrow(),
      description: this.description(),
      emptyMessage: this.emptyMessage(),
      itemLabelSingular: this.itemLabelSingular(),
      itemLabelPlural: this.itemLabelPlural(),
      wordLabelSingular: this.wordLabelSingular(),
      wordLabelPlural: this.wordLabelPlural(),
      showResponsesSingularLabel: this.showResponsesSingularLabel(),
      showResponsesPluralLabel: this.showResponsesPluralLabel(),
      showResponsesPanel: this.showResponsesPanel(),
      weightingHint: this.weightingHint(),
    };
  }

  private readExportPalette(): ExportPalette {
    const exportSurface = this.exportSurface()?.nativeElement;
    if (!exportSurface) {
      return {
        panelBackground: 'rgb(248, 250, 252)',
        panelBorder: 'rgb(203, 213, 225)',
        chipBackground: 'rgb(255, 255, 255)',
        chipBorder: 'rgb(203, 213, 225)',
        chipText: 'rgb(15, 23, 42)',
        activeChipBackground: 'rgb(219, 234, 254)',
        activeChipBorder: 'rgb(96, 165, 250)',
        activeChipText: 'rgb(15, 23, 42)',
        fontFamily: 'system-ui',
      };
    }

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
