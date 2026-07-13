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
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import type { CloudLayout } from 'd3-cloud';
import type { WordCloudAnalysisEntryDTO } from '@arsnova/shared-types';
import { getEffectiveLocale, localeIdToSupported } from '../../../core/locale-from-path';
import { formatLocaleCount } from '../../../core/locale-number.util';
import { tryRequestDocumentFullscreen } from '../../../core/document-fullscreen.util';
import {
  getWordCloudChipPadding,
  getWordCloudLayoutHeight,
  getWordCloudLayoutWordCap,
  getWordCloudWidthScale,
  MIN_WORD_CLOUD_LAYOUT_WIDTH,
  MOBILE_WORD_CLOUD_BREAKPOINT,
  shouldUseWordCloudLayout,
} from './word-cloud-layout';
import {
  aggregateWeightedWords,
  createWordCloudStopwordContext,
  extractResponseGroupKeys,
  getStopwordsForLocale,
  normalizeFreeTextResponseForDisplay,
  type WordCloudAnalysisMode,
  type WordCloudStopwordContext,
  type WeightedWordSource,
} from './word-cloud.util';
import type { WordCloudTerm } from './word-cloud-term.service';
import type { WordCloudDialogData } from './word-cloud-dialog.component';

const CLOUD_LAYOUT_DEBOUNCE_MS = 120;
const CLOUD_LAYOUT_TIME_SLICE_MS = 8;

interface CloudWord {
  word: string;
  count: number;
  sourceCount: number;
  groupKey: string;
  variants: string[];
  basisLabel: string | null;
  confidence: number | null;
  size: number;
  rank: number;
}

type AnalysisDetailTone = 'neutral' | 'high' | 'medium' | 'cautious';

interface AnalysisDetailChip {
  readonly label: string;
  readonly tone: AnalysisDetailTone;
}

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

interface ConfidenceFilterOption {
  readonly value: ConfidenceFilter;
  readonly label: string;
  readonly count: number;
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
    MatButtonToggle,
    MatButtonToggleGroup,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatIcon,
    MatTooltip,
  ],
  templateUrl: './word-cloud.component.html',
  styleUrl: './word-cloud.component.scss',
})
export class WordCloudComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog, { optional: true });
  private readonly localeId = inject(LOCALE_ID);
  private readonly exportSurface = viewChild<ElementRef<HTMLElement>>('exportSurface');
  private readonly visualFrame = viewChild<ElementRef<HTMLElement>>('visualFrame');
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
  private frameResizeObserver: ResizeObserver | null = null;
  private observedVisualFrame: HTMLElement | null = null;
  private layoutTimer: ReturnType<typeof setTimeout> | null = null;
  private activeCloudLayout: CloudLayout<LayoutWord> | null = null;
  private d3CloudFactory: (typeof import('d3-cloud'))['default'] | null = null;
  private d3CloudImportPromise: Promise<(typeof import('d3-cloud'))['default']> | null = null;
  private layoutRunId = 0;
  private previousSelectionScopeKey: string | null | undefined = undefined;

  readonly responses = input<string[]>([]);
  readonly weightedResponses = input<WeightedWordSource[] | null>(null);
  readonly terms = input<WordCloudTerm[] | null>(null);
  readonly analysisEntries = input<WordCloudAnalysisEntryDTO[] | null>(null);
  readonly analysisMode = input<WordCloudAnalysisMode>('default');
  readonly selectionScopeKey = input<string | null>(null);
  readonly title = input($localize`:@@wordCloud.title:Wortwolke`);
  readonly eyebrow = input<string | null>(null);
  readonly description = input<string | null>(
    $localize`:@@wordCloud.description:Häufig genannte Wörter erscheinen größer.`,
  );
  readonly tooltipMetricLabel = input<string | null>(null);
  readonly disableCloudLayout = input(false);
  readonly presentationMode = input(false);
  readonly outputOnly = input(false);
  readonly showMaximizeAction = input(true);
  readonly maximizeActionHandler = input<(() => void | Promise<void>) | null>(null);
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
    $localize`:@@wordCloud.weightingHint:Je größer ein Wort, desto öfter wurde es genannt.`,
  );
  readonly showReleaseNote = input(false);
  readonly selectedGroupKey = signal<string | null>(null);
  readonly confidenceFilter = signal<ConfidenceFilter>('high');
  readonly statusMessage = signal<string | null>(null);
  readonly showResponses = signal(false);
  readonly responsesVisibleLimit = signal(WordCloudComponent.RESPONSES_PAGE_SIZE);
  readonly positionedWords = signal<PositionedCloudWord[]>([]);
  readonly layoutPending = signal(false);
  readonly maximizeLabel = $localize`:@@wordCloud.maximize:Maximieren`;
  readonly maximizeAriaLabel = $localize`:@@wordCloud.maximizeAria:Wortwolke maximieren`;
  readonly selectedFilterPrefix = $localize`:@@wordCloud.selectedFilterPrefix:Ausgewählt:`;
  readonly focusFilterPrefix = $localize`:@@wordCloud.focusFilterPrefix:Im Fokus:`;
  readonly exportCsvLabel = $localize`:@@wordCloud.exportCsv:CSV speichern`;
  readonly exportPngLabel = $localize`:@@wordCloud.exportPngOrdered:PNG speichern`;
  readonly confidenceFilterGroupLabel = $localize`:@@wordCloud.themeConfidenceFilter:Erkannte Themen`;
  readonly showActionsPanel = computed(
    () => !this.outputOnly() && (this.showMaximizeAction() || this.showExportActions()),
  );
  readonly showSupportingSection = computed(
    () =>
      this.showActionsPanel() ||
      (!this.outputOnly() && (this.showResponsesPanel() || this.showReleaseNote())),
  );

  private readonly stageWidth = signal(0);
  private readonly availableVisualFrameHeight = signal(0);
  private readonly renderedCloudStageWidth = signal(0);
  private readonly renderedCloudStageHeight = signal(0);
  private readonly layoutFontFamily = signal('system-ui');
  private readonly activeLayoutSignature = signal('');
  private readonly stopwordContext = computed<WordCloudStopwordContext>(() =>
    createWordCloudStopwordContext(this.stopwords, this.activeLocale, this.analysisMode()),
  );

  private readonly aggregationSources = computed<WeightedWordSource[]>(() => {
    const weighted = this.weightedResponses();
    if (weighted && weighted.length > 0) {
      return weighted;
    }

    return this.responses().map((response) => ({ text: response }));
  });

  private readonly analysisResponsesByGroupKey = computed(() => {
    const grouped = new Map<string, string[]>();

    for (const entry of this.filteredAnalysisEntries() ?? []) {
      const responses: string[] = [];
      const seenSourceIds = new Set<string>();
      for (const member of entry.members) {
        if (seenSourceIds.has(member.sourceId)) {
          continue;
        }
        seenSourceIds.add(member.sourceId);
        responses.push(normalizeFreeTextResponseForDisplay(member.text));
      }
      grouped.set(entry.key, responses);
    }

    return grouped;
  });

  private readonly allAnalysisResponses = computed(() => {
    const responses: string[] = [];
    const seenSourceIds = new Set<string>();

    for (const entry of this.filteredAnalysisEntries() ?? []) {
      for (const member of entry.members) {
        if (seenSourceIds.has(member.sourceId)) {
          continue;
        }
        seenSourceIds.add(member.sourceId);
        responses.push(normalizeFreeTextResponseForDisplay(member.text));
      }
    }

    return responses;
  });

  private readonly termResponsesByGroupKey = computed(() => {
    const grouped = new Map<string, string[]>();

    for (const term of this.filteredTerms() ?? []) {
      const responses: string[] = [];
      const seenSourceIds = new Set<string>();
      for (const member of term.members) {
        if (seenSourceIds.has(member.sourceId)) {
          continue;
        }
        seenSourceIds.add(member.sourceId);
        responses.push(normalizeFreeTextResponseForDisplay(member.text));
      }
      grouped.set(term.key, responses);
    }

    return grouped;
  });

  private readonly allTermResponses = computed(() => {
    const responses: string[] = [];
    const seenSourceIds = new Set<string>();

    for (const term of this.filteredTerms() ?? []) {
      for (const member of term.members) {
        if (seenSourceIds.has(member.sourceId)) {
          continue;
        }
        seenSourceIds.add(member.sourceId);
        responses.push(normalizeFreeTextResponseForDisplay(member.text));
      }
    }

    return responses;
  });

  private readonly filteredTerms = computed(() => {
    const terms = this.terms();
    if (terms === null) {
      return null;
    }

    if (!terms.some((term) => this.resolveConfidenceFilterTier(term.confidence))) {
      return terms;
    }

    const filter = this.confidenceFilter();
    if (filter === 'all') {
      return terms;
    }

    return terms.filter((term) => this.matchesConfidenceFilter(term.confidence, filter));
  });

  readonly confidenceFilterOptions = computed<ConfidenceFilterOption[]>(() => {
    const entries = this.terms() ?? this.analysisEntries() ?? [];
    const counts = {
      high: 0,
      medium: 0,
      low: 0,
    } satisfies Record<Exclude<ConfidenceFilter, 'all'>, number>;

    for (const entry of entries) {
      const tier = this.resolveConfidenceFilterTier(entry.confidence);
      if (!tier) {
        continue;
      }
      counts[tier] += 1;
    }

    const confidenceEntryCount = counts.high + counts.medium + counts.low;
    if (confidenceEntryCount === 0) {
      return [];
    }

    return [
      {
        value: 'all',
        label: $localize`:@@wordCloud.themeConfidenceAll:alle`,
        count: entries.length,
      },
      {
        value: 'high',
        label: this.confidenceFilterTierLabel('high'),
        count: counts.high,
      },
      {
        value: 'medium',
        label: this.confidenceFilterTierLabel('medium'),
        count: counts.medium,
      },
      {
        value: 'low',
        label: this.confidenceFilterTierLabel('low'),
        count: counts.low,
      },
    ];
  });

  readonly showConfidenceFilterToggle = computed(
    () => !this.outputOnly() && this.confidenceFilterOptions().length > 0,
  );

  private readonly filteredAnalysisEntries = computed(() => {
    const entries = this.analysisEntries();
    if (!entries || entries.length === 0) {
      return entries;
    }

    if (!entries.some((entry) => this.resolveConfidenceFilterTier(entry.confidence))) {
      return entries;
    }

    const filter = this.confidenceFilter();
    if (filter === 'all') {
      return entries;
    }

    return entries.filter((entry) => this.matchesConfidenceFilter(entry.confidence, filter));
  });

  readonly words = computed<CloudWord[]>(() => {
    const providedTerms = this.filteredTerms();
    const providedEntries = this.filteredAnalysisEntries();
    const fontSizeRange = this.resolveFontSizeRange(
      providedTerms?.length ?? providedEntries?.length ?? this.aggregationSources().length,
    );
    if (providedTerms !== null) {
      if (providedTerms.length === 0) {
        return [];
      }

      const maxScore = Math.max(0.01, ...providedTerms.map((term) => term.score));
      const { min: minFontSize, max: maxFontSize } = fontSizeRange;

      return providedTerms.map((term, index) => ({
        word: term.label,
        count: Math.max(1, Math.round(term.score)),
        sourceCount: term.sourceCount,
        groupKey: term.key,
        variants: term.variants.length > 0 ? term.variants : [term.label],
        basisLabel: term.basisLabel,
        confidence: term.confidence,
        size: minFontSize + Math.round((term.score / maxScore) * (maxFontSize - minFontSize)),
        rank: index,
      }));
    }

    if (providedEntries && providedEntries.length > 0) {
      const maxCount = Math.max(1, ...providedEntries.map((entry) => entry.count));
      const { min: minFontSize, max: maxFontSize } = fontSizeRange;

      return providedEntries.map((entry, index) => ({
        word: entry.label,
        count: entry.count,
        sourceCount: this.analysisEntrySourceCount(entry),
        groupKey: entry.key,
        variants: entry.variants.length > 0 ? entry.variants : [entry.label],
        basisLabel: entry.basisLabel,
        confidence: entry.confidence,
        size: minFontSize + Math.round((entry.count / maxCount) * (maxFontSize - minFontSize)),
        rank: index,
      }));
    }

    const aggregated = aggregateWeightedWords(
      this.aggregationSources(),
      this.stopwords,
      this.activeLocale,
      this.analysisMode(),
    );
    const maxCount = aggregated[0]?.count ?? 1;
    const { min: minFontSize, max: maxFontSize } = this.resolveFontSizeRange(aggregated.length);
    return aggregated.map((entry, index) => ({
      ...entry,
      basisLabel: null,
      confidence: null,
      size: minFontSize + Math.round((entry.count / maxCount) * (maxFontSize - minFontSize)),
      rank: index,
    }));
  });

  readonly displayWords = computed<CloudWord[]>(() => {
    const words = this.words();
    const width = this.stageWidth();
    if (this.disableCloudLayout() || !shouldUseWordCloudLayout(width, words.length)) {
      if (this.presentationMode() && this.disableCloudLayout()) {
        return this.arrangeWrappedPresentationWords(words);
      }

      return words;
    }

    return words.slice(0, getWordCloudLayoutWordCap(width, this.presentationMode()));
  });

  readonly cloudStageHeightPx = computed(() => {
    const width = this.stageWidth();
    const wordCount = this.displayWords().length;
    if (this.disableCloudLayout() || !shouldUseWordCloudLayout(width, wordCount)) {
      return 0;
    }

    const preferredHeight = getWordCloudLayoutHeight(width, wordCount, this.presentationMode());
    if (!this.presentationMode()) {
      return preferredHeight;
    }

    const availableHeight = this.availableVisualFrameHeight();
    const minimumHeight = this.minimumPresentationStageHeight(width, availableHeight);
    if (availableHeight <= 0) {
      if (width < MOBILE_WORD_CLOUD_BREAKPOINT) {
        return Math.max(minimumHeight, Math.min(preferredHeight, Math.round(width * 1.2)));
      }

      return preferredHeight;
    }

    if (this.shouldAllowPresentationFrameScroll(width, availableHeight)) {
      return minimumHeight;
    }

    return Math.max(minimumHeight, Math.min(preferredHeight, availableHeight));
  });

  readonly presentationFrameScrollable = computed(() => {
    if (!this.presentationMode()) {
      return false;
    }

    if (this.disableCloudLayout()) {
      return true;
    }

    const availableHeight = this.availableVisualFrameHeight();
    if (availableHeight <= 0) {
      return false;
    }

    return this.shouldAllowPresentationFrameScroll(this.stageWidth(), availableHeight);
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

  readonly selectedWordEntry = computed<CloudWord | null>(() => {
    const selected = this.selectedGroupKey();
    if (!selected) {
      return null;
    }

    return this.words().find((entry) => entry.groupKey === selected) ?? null;
  });

  readonly selectedWordLabel = computed(() => this.selectedWordEntry()?.word ?? null);

  readonly analysisDetailEntry = computed<CloudWord | null>(() => {
    const selected = this.selectedWordEntry();
    if (selected) {
      return selected;
    }

    if (this.terms() === null && (this.analysisEntries()?.length ?? 0) === 0) {
      return null;
    }

    return this.words()[0] ?? null;
  });

  readonly analysisDetailLabel = computed(() => this.analysisDetailEntry()?.word ?? null);

  readonly showsSelectedFilterDetails = computed(() => this.selectedWordEntry() !== null);

  readonly selectedWordAnalysisDetails = computed<AnalysisDetailChip[]>(() => {
    const entry = this.analysisDetailEntry();
    if (!entry) {
      return [];
    }

    const details: AnalysisDetailChip[] = [];
    const basisDetail = this.analysisBasisDetail(entry);
    if (basisDetail) {
      details.push(basisDetail);
    }

    const confidenceDetail = this.analysisConfidenceDetail(entry.confidence);
    if (confidenceDetail) {
      details.push(confidenceDetail);
    }

    return details;
  });

  private readonly responseSearchIndex = computed(() =>
    this.responses().map((response) => ({
      response: normalizeFreeTextResponseForDisplay(response),
      groupKeys: new Set(extractResponseGroupKeys(response, this.stopwordContext())),
    })),
  );

  private readonly tooltipResponseIndex = computed(() => {
    const grouped = new Map<string, string[]>();
    const seenByGroup = new Map<string, Set<string>>();

    for (const entry of this.responseSearchIndex()) {
      for (const groupKey of entry.groupKeys) {
        const seen = seenByGroup.get(groupKey) ?? new Set<string>();
        if (seen.has(entry.response)) {
          continue;
        }

        seen.add(entry.response);
        seenByGroup.set(groupKey, seen);
        const responses = grouped.get(groupKey) ?? [];
        responses.push(entry.response);
        grouped.set(groupKey, responses);
      }
    }

    return grouped;
  });

  readonly filteredResponses = computed(() => {
    const selected = this.selectedGroupKey();
    const termResponsesByGroupKey = this.termResponsesByGroupKey();
    if (this.terms() !== null) {
      if (selected) {
        return termResponsesByGroupKey.get(selected) ?? [];
      }

      return this.allTermResponses();
    }

    const analysisResponsesByGroupKey = this.analysisResponsesByGroupKey();
    if (this.analysisEntries() !== null) {
      if (selected) {
        return analysisResponsesByGroupKey.get(selected) ?? [];
      }

      return this.allAnalysisResponses();
    }

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
      const availableHeight = this.availableVisualFrameHeight();
      if (this.disableCloudLayout()) {
        if (availableHeight > 0) {
          return `${availableHeight}px`;
        }

        return '100%';
      }

      const layoutHeightPx = this.cloudStageHeightPx();
      if (layoutHeightPx > 0) {
        return `${layoutHeightPx}px`;
      }

      const preferredHeightPx = getWordCloudLayoutHeight(
        Math.max(this.stageWidth(), MIN_WORD_CLOUD_LAYOUT_WIDTH),
        Math.max(wordCount, 1),
        true,
      );
      if (availableHeight > 0) {
        return `${Math.max(240, Math.min(preferredHeightPx, availableHeight))}px`;
      }

      return `${preferredHeightPx}px`;
    }

    if (wordCount <= 6) return '10.5rem';
    if (wordCount <= 14) return '14rem';
    if (wordCount <= 28) return '18rem';
    return '22rem';
  });

  readonly responseSummary = computed(() => ({
    total:
      this.responses().length ||
      this.allTermResponses().length ||
      this.allAnalysisResponses().length,
    visible: this.filteredResponses().length,
  }));

  constructor() {
    effect(() => {
      const stage = this.layoutStage()?.nativeElement ?? null;
      queueMicrotask(() => this.observeStage(stage));
    });

    effect(() => {
      const frame = this.visualFrame()?.nativeElement ?? null;
      queueMicrotask(() => this.observeVisualFrame(frame));
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
      const filter = this.confidenceFilter();
      const options = this.confidenceFilterOptions();
      if (options.length === 0) {
        return;
      }

      const activeOption = options.find((option) => option.value === filter);
      if (!activeOption || activeOption.count === 0) {
        this.confidenceFilter.set(this.defaultConfidenceFilter(options));
      }
    });

    effect(() => {
      this.selectedGroupKey();
      this.responsesVisibleLimit.set(WordCloudComponent.RESPONSES_PAGE_SIZE);
    });

    effect(() => {
      this.confidenceFilter();
      this.responsesVisibleLimit.set(WordCloudComponent.RESPONSES_PAGE_SIZE);
    });

    effect(() => {
      const width = this.stageWidth();
      const height = this.cloudStageHeightPx();
      const signature = this.layoutInputSignature();
      const words = this.displayWords();
      const fontFamily = this.layoutFontFamily();

      if (this.disableCloudLayout() || !shouldUseWordCloudLayout(width, words.length)) {
        this.resetCloudLayout();
        return;
      }

      this.clearScheduledLayout();
      this.layoutPending.set(true);
      const runId = ++this.layoutRunId;
      const layoutWords = this.createLayoutWords(words);
      this.layoutTimer = setTimeout(
        () => void this.runCloudLayout(layoutWords, width, height, fontFamily, signature, runId),
        CLOUD_LAYOUT_DEBOUNCE_MS,
      );
    });
  }

  ngAfterViewInit(): void {
    this.observeVisualFrame(this.visualFrame()?.nativeElement ?? null);
    this.observeStage(this.layoutStage()?.nativeElement ?? null);
  }

  ngOnDestroy(): void {
    this.layoutRunId += 1;
    this.clearScheduledLayout();
    this.stopCloudLayout();
    this.resizeObserver?.disconnect();
    this.frameResizeObserver?.disconnect();
  }

  itemLabel(count: number): string {
    return count === 1 ? this.itemLabelSingular() : this.itemLabelPlural();
  }

  wordLabel(count: number): string {
    return count === 1 ? this.wordLabelSingular() : this.wordLabelPlural();
  }

  formatCount(value: number): string {
    return formatLocaleCount(value, this.localeId);
  }

  showResponsesLabel(count: number): string {
    return count === 1 ? this.showResponsesSingularLabel() : this.showResponsesPluralLabel();
  }

  toggleWord(groupKey: string): void {
    this.selectedGroupKey.update((current) => (current === groupKey ? null : groupKey));
  }

  setConfidenceFilter(filter: ConfidenceFilter): void {
    this.confidenceFilter.set(filter);
  }

  toggleResponses(): void {
    this.showResponses.update((value) => !value);
  }

  showMoreResponses(): void {
    this.responsesVisibleLimit.update((value) => value + WordCloudComponent.RESPONSES_PAGE_SIZE);
  }

  handleMaximize(): void {
    tryRequestDocumentFullscreen(this.document);

    const customHandler = this.maximizeActionHandler();
    if (customHandler) {
      void customHandler();
      return;
    }

    void this.openInDialog();
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
    const lines = [this.tooltipValueLine(entry.count)];
    const sourceCountLine = this.tooltipSourceCountLine(entry.sourceCount);
    if (sourceCountLine) {
      lines.push(sourceCountLine);
    }

    const metricLine = this.tooltipMetricLine();
    if (metricLine) {
      lines.push(metricLine);
    }

    const basisLine = this.analysisBasisLine(entry);
    if (basisLine) {
      lines.push(basisLine);
    }

    const confidenceLine = this.analysisConfidenceLine(entry.confidence);
    if (confidenceLine) {
      lines.push(confidenceLine);
    }

    if (entry.variants.length > 1) {
      const variants = this.wordVariantPreview(entry.variants);
      lines.push($localize`:@@wordCloud.variantsTooltip:Auch gezählt: ${variants}:variants:`);
    }

    if (this.analysisMode() === 'qa') {
      const relatedResponses = this.relatedResponsePreview(entry.groupKey);
      if (relatedResponses.length > 0) {
        lines.push(`${this.itemLabel(relatedResponses.length)}:`);
        lines.push(...relatedResponses.map((response) => `- ${response}`));
      }
    }

    return lines.join('\n');
  }

  wordTooltipDisplay(entry: CloudWord): string {
    const lines = [this.tooltipValueLine(entry.count)];
    const sourceCountLine = this.tooltipSourceCountLine(entry.sourceCount);
    if (sourceCountLine) {
      lines.push(sourceCountLine);
    }

    const metricLine = this.tooltipMetricLine();
    if (metricLine) {
      lines.push(metricLine);
    }

    const basisLine = this.analysisBasisLine(entry);
    if (basisLine) {
      lines.push(basisLine);
    }

    const confidenceLine = this.analysisConfidenceLine(entry.confidence);
    if (confidenceLine) {
      lines.push(confidenceLine);
    }

    if (entry.variants.length > 1) {
      const variants = this.wordVariantPreview(entry.variants);
      lines.push($localize`:@@wordCloud.variantsTooltip:Auch gezählt: ${variants}:variants:`);
    }

    if (this.analysisMode() === 'qa') {
      const relatedResponses = this.relatedResponsePreview(entry.groupKey);
      if (relatedResponses.length > 0) {
        lines.push(`${this.itemLabel(relatedResponses.length)}:`);
        lines.push(...relatedResponses.map((response) => this.formatTooltipListItem(response)));
      }
    }

    return lines.join('\n');
  }

  loadMoreResponsesLabel(): string {
    const remaining = this.remainingResponsesCount();
    return remaining === 1
      ? $localize`:@@wordCloud.loadMoreOne:1 weitere Antwort laden`
      : $localize`:@@wordCloud.loadMoreMany:${remaining}:count: weitere Antworten laden`;
  }

  exportCsv(): void {
    const terms = this.terms();
    if (terms && terms.length > 0) {
      const rows = [
        'label,score,documentFrequency,kind,variants,members',
        ...terms.map((term) =>
          [
            this.escapeCsvField(term.label),
            String(Math.round(term.score)),
            String(term.documentFrequency),
            term.kind,
            this.escapeCsvField(term.variants.join(' | ')),
            this.escapeCsvField(term.members.map((member) => member.text).join(' | ')),
          ].join(','),
        ),
      ];
      this.downloadBlob(
        rows.join('\n'),
        `wordcloud_${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8',
      );
      this.statusMessage.set($localize`CSV exportiert.`);
      return;
    }

    const analysisEntries = this.analysisEntries();
    if (analysisEntries && analysisEntries.length > 0) {
      const rows = [
        'label,count,variants,basis,members',
        ...analysisEntries.map((entry) =>
          [
            this.escapeCsvField(entry.label),
            String(entry.count),
            this.escapeCsvField(entry.variants.join(' | ')),
            this.escapeCsvField(entry.basisLabel ?? ''),
            this.escapeCsvField(entry.members.map((member) => member.text).join(' | ')),
          ].join(','),
        ),
      ];
      this.downloadBlob(
        rows.join('\n'),
        `wordcloud_${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8',
      );
      this.statusMessage.set($localize`CSV exportiert.`);
      return;
    }

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

  private observeVisualFrame(frame: HTMLElement | null): void {
    if (frame === this.observedVisualFrame) {
      if (frame) {
        this.updateVisualFrameMetrics(frame);
      }
      return;
    }

    this.frameResizeObserver?.disconnect();
    this.frameResizeObserver = null;
    this.observedVisualFrame = frame;

    if (!frame) {
      this.availableVisualFrameHeight.set(0);
      return;
    }

    this.updateVisualFrameMetrics(frame);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.frameResizeObserver = new ResizeObserver(() => this.updateVisualFrameMetrics(frame));
    this.frameResizeObserver.observe(frame);
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

  private updateVisualFrameMetrics(frame: HTMLElement): void {
    const frameStyle = this.readComputedStyle(frame);
    const paddingTop = Number.parseFloat(frameStyle.paddingTop || '0');
    const paddingBottom = Number.parseFloat(frameStyle.paddingBottom || '0');
    const availableHeight = Math.max(
      0,
      Math.round(frame.clientHeight - paddingTop - paddingBottom),
    );

    if (availableHeight !== this.availableVisualFrameHeight()) {
      this.availableVisualFrameHeight.set(availableHeight);
    }
  }

  private arrangeWrappedPresentationWords(entries: CloudWord[]): CloudWord[] {
    if (entries.length < 3) {
      return entries;
    }

    const arranged = new Array<CloudWord>(entries.length);
    const centerIndex = Math.floor((entries.length - 1) / 2);
    const placementOrder: number[] = [centerIndex];

    for (let offset = 1; placementOrder.length < entries.length; offset += 1) {
      const rightIndex = centerIndex + offset;
      if (rightIndex < entries.length) {
        placementOrder.push(rightIndex);
      }

      const leftIndex = centerIndex - offset;
      if (leftIndex >= 0) {
        placementOrder.push(leftIndex);
      }
    }

    for (const [entryIndex, targetIndex] of placementOrder.entries()) {
      arranged[targetIndex] = entries[entryIndex];
    }

    return arranged;
  }

  private resolveFontSizeRange(wordCount: number): { min: number; max: number } {
    if (!this.presentationMode()) {
      return { min: 14, max: 40 };
    }

    if (!this.disableCloudLayout()) {
      const stageWidth = this.stageWidth();
      const availableHeight = this.availableVisualFrameHeight();
      if (availableHeight > 0 && availableHeight < 260) {
        if (wordCount >= 24) {
          return { min: 9, max: 18 };
        }

        if (wordCount >= 12) {
          return { min: 10, max: 22 };
        }

        return { min: 11, max: 26 };
      }

      if (availableHeight > 0 && availableHeight < 360) {
        if (wordCount >= 24) {
          return { min: 10, max: 22 };
        }

        if (wordCount >= 12) {
          return { min: 11, max: 28 };
        }

        return { min: 12, max: 34 };
      }

      if (stageWidth > 0 && stageWidth < MOBILE_WORD_CLOUD_BREAKPOINT) {
        const widthScale = getWordCloudWidthScale(stageWidth);
        if (wordCount >= 24) {
          return {
            min: Math.round(10 + widthScale),
            max: Math.round(16 + widthScale * 4),
          };
        }

        if (wordCount >= 12) {
          return {
            min: Math.round(11 + widthScale),
            max: Math.round(17 + widthScale * 5),
          };
        }

        return {
          min: Math.round(12 + widthScale),
          max: Math.round(19 + widthScale * 5),
        };
      }

      return { min: 16, max: 56 };
    }

    const availableHeight = this.availableVisualFrameHeight();
    if (availableHeight > 0 && (availableHeight < 420 || wordCount >= 32)) {
      return { min: 13, max: 30 };
    }

    if (availableHeight > 0 && (availableHeight < 520 || wordCount >= 20)) {
      return { min: 14, max: 36 };
    }

    if (wordCount >= 28) {
      return { min: 15, max: 42 };
    }

    return { min: 16, max: 48 };
  }

  private shouldAllowPresentationFrameScroll(width: number, availableHeight: number): boolean {
    return availableHeight < this.minimumPresentationStageHeight(width, availableHeight);
  }

  private minimumPresentationStageHeight(width: number, availableHeight: number): number {
    if (availableHeight > 0 && availableHeight < 260) {
      return 180;
    }

    return width < MOBILE_WORD_CLOUD_BREAKPOINT ? 180 : 240;
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
    const stageWidth = this.stageWidth();
    return entries.map((entry) => ({
      text: entry.word,
      size: entry.size,
      rotate: 0,
      padding: getWordCloudChipPadding(entry.size, stageWidth),
      entry,
    }));
  }

  private async runCloudLayout(
    words: LayoutWord[],
    stageWidth: number,
    stageHeight: number,
    fontFamily: string,
    signature: string,
    runId: number,
  ): Promise<void> {
    this.layoutTimer = null;
    if (!shouldUseWordCloudLayout(stageWidth, words.length)) {
      this.resetCloudLayout();
      return;
    }

    this.stopCloudLayout();

    try {
      const d3Cloud = await this.loadD3Cloud();
      if (runId !== this.layoutRunId) {
        return;
      }

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

  private loadD3Cloud(): Promise<(typeof import('d3-cloud'))['default']> {
    if (this.d3CloudFactory) {
      return Promise.resolve(this.d3CloudFactory);
    }

    this.d3CloudImportPromise ??= import('d3-cloud').then((module) => {
      this.d3CloudFactory = module.default;
      return module.default;
    });
    return this.d3CloudImportPromise;
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

  private tooltipValueLine(count: number): string {
    if (this.analysisMode() === 'qa') {
      return $localize`:@@wordCloud.weightedValueTooltip:Größenwert: ${count}:count:`;
    }

    return $localize`:@@wordCloud.mentionsTooltip:Nennungen: ${count}:count:`;
  }

  private tooltipSourceCountLine(sourceCount: number): string | null {
    if (this.analysisMode() !== 'qa' || !Number.isFinite(sourceCount) || sourceCount <= 0) {
      return null;
    }

    return sourceCount === 1
      ? $localize`:@@wordCloud.qaSourceCountTooltipOne:In 1 Frage gefunden`
      : $localize`:@@wordCloud.qaSourceCountTooltipMany:In ${sourceCount}:count: Fragen gefunden`;
  }

  private tooltipMetricLine(): string | null {
    const metricLabel = this.tooltipMetricLabel()?.trim();
    if (!metricLabel) {
      return null;
    }

    return $localize`:@@wordCloud.metricWeightTooltip:Gewichtung: ${metricLabel}:metric:`;
  }

  private analysisEntrySourceCount(entry: WordCloudAnalysisEntryDTO): number {
    const sourceIds = new Set(entry.members.map((member) => member.sourceId));
    return Math.max(1, sourceIds.size);
  }

  private analysisBasisLine(entry: Pick<CloudWord, 'basisLabel' | 'word'>): string | null {
    const basisLabel = entry.basisLabel?.trim();
    if (!basisLabel || basisLabel === entry.word) {
      return null;
    }

    return $localize`:@@wordCloud.groupedAsTooltip:Zusammengefasst als: ${basisLabel}:metric:`;
  }

  private analysisBasisDetail(
    entry: Pick<CloudWord, 'basisLabel' | 'word'>,
  ): AnalysisDetailChip | null {
    const label = this.analysisBasisLine(entry);
    if (!label) {
      return null;
    }

    return {
      label,
      tone: 'neutral',
    };
  }

  private analysisConfidenceLine(confidence: number | null): string | null {
    if (confidence === null) {
      return null;
    }

    const percent = new Intl.NumberFormat(this.localeId, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(confidence);

    const tier = this.analysisConfidenceTierLabel(confidence);

    return $localize`:@@wordCloud.themeConfidenceLabel:Erkennung: ${tier}:tier: (${percent}:percent:)`;
  }

  private analysisConfidenceDetail(confidence: number | null): AnalysisDetailChip | null {
    const label = this.analysisConfidenceLine(confidence);
    if (label === null || confidence === null) {
      return null;
    }

    return {
      label,
      tone: this.analysisConfidenceTone(confidence),
    };
  }

  private analysisConfidenceTone(confidence: number): AnalysisDetailTone {
    if (confidence >= 0.85) {
      return 'high';
    }

    if (confidence >= 0.65) {
      return 'medium';
    }

    return 'cautious';
  }

  private analysisConfidenceTierLabel(confidence: number): string {
    return this.confidenceFilterTierLabel(this.resolveConfidenceFilterTier(confidence) ?? 'low');
  }

  private confidenceFilterTierLabel(tier: Exclude<ConfidenceFilter, 'all'>): string {
    switch (tier) {
      case 'high':
        return $localize`:@@wordCloud.themeConfidenceHigh:sicher`;
      case 'medium':
        return $localize`:@@wordCloud.themeConfidenceMedium:mittel`;
      case 'low':
        return $localize`:@@wordCloud.themeConfidenceCautious:unsicher`;
    }
  }

  private resolveConfidenceFilterTier(
    confidence: number | null,
  ): Exclude<ConfidenceFilter, 'all'> | null {
    if (confidence === null) {
      return null;
    }

    if (confidence >= 0.85) {
      return 'high';
    }

    if (confidence >= 0.65) {
      return 'medium';
    }

    return 'low';
  }

  private matchesConfidenceFilter(
    confidence: number | null,
    filter: Exclude<ConfidenceFilter, 'all'>,
  ): boolean {
    return this.resolveConfidenceFilterTier(confidence) === filter;
  }

  private defaultConfidenceFilter(options: readonly ConfidenceFilterOption[]): ConfidenceFilter {
    if (options.find((option) => option.value === 'high')?.count) {
      return 'high';
    }

    return 'all';
  }

  private relatedResponsePreview(groupKey: string): string[] {
    const responses =
      this.termResponsesByGroupKey().get(groupKey) ??
      this.analysisResponsesByGroupKey().get(groupKey) ??
      this.tooltipResponseIndex().get(groupKey) ??
      [];
    const preview = responses.slice(0, 4);
    return responses.length > 4 ? [...preview, '...'] : preview;
  }

  private formatTooltipListItem(value: string): string {
    if (value === '...') {
      return '…';
    }

    return this.wrapTooltipLine(value, '• ', '   ', 44);
  }

  private wrapTooltipLine(
    value: string,
    firstPrefix: string,
    continuationPrefix: string,
    maxCharactersPerLine: number,
  ): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return firstPrefix.trimEnd();
    }

    const words = normalized.split(' ');
    const lines: string[] = [];
    let current = '';
    let currentLimit = Math.max(8, maxCharactersPerLine - firstPrefix.length);

    const flush = (prefix: string) => {
      lines.push(`${prefix}${current}`.trimEnd());
      current = '';
      currentLimit = Math.max(8, maxCharactersPerLine - continuationPrefix.length);
    };

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= currentLimit || current.length === 0) {
        current = candidate;
        continue;
      }

      flush(lines.length === 0 ? firstPrefix : continuationPrefix);
      current = word;
    }

    if (current) {
      lines.push(`${lines.length === 0 ? firstPrefix : continuationPrefix}${current}`.trimEnd());
    }

    return lines.join('\n');
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
      terms: this.terms(),
      analysisEntries: this.analysisEntries(),
      analysisMode: this.analysisMode(),
      disableCloudLayout: false,
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
      tooltipMetricLabel: this.tooltipMetricLabel(),
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
