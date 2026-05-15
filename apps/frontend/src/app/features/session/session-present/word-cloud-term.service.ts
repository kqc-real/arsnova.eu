import { Injectable } from '@angular/core';
import type { SupportedLocale } from '../../../core/locale-from-path';
import { getStopwordsForLocale } from './word-cloud.util';

export type WordCloudTermKind = 'unigram' | 'bigram' | 'trigram' | 'protected';

export interface WordCloudTermDocument {
  readonly id: string;
  readonly title?: string | null;
  readonly body?: string | null;
  readonly tags?: readonly string[] | null;
  readonly weight?: number | null;
}

export interface WordCloudTermMember {
  readonly sourceId: string;
  readonly text: string;
  readonly weight: number;
}

export interface WordCloudTerm {
  readonly key: string;
  readonly label: string;
  readonly score: number;
  readonly documentFrequency: number;
  readonly sourceCount: number;
  readonly variants: string[];
  readonly kind: WordCloudTermKind;
  readonly basisLabel: string | null;
  readonly confidence: number | null;
  readonly members: WordCloudTermMember[];
}

export interface WordCloudTermExtractionOptions {
  readonly locale: SupportedLocale;
  readonly customStopwords?: readonly string[];
  readonly maxEntries?: number;
  readonly maxNgramLength?: 1 | 2 | 3;
}

interface FieldCandidate {
  readonly key: string;
  readonly label: string;
  readonly kind: WordCloudTermKind;
  readonly contribution: number;
}

interface DocumentCandidate {
  key: string;
  label: string;
  kind: WordCloudTermKind;
  contribution: number;
}

interface TermBucket {
  readonly key: string;
  kind: WordCloudTermKind;
  rawScore: number;
  score: number;
  documentFrequency: number;
  readonly documentIds: Set<string>;
  readonly variants: Map<string, number>;
  readonly members: WordCloudTermMember[];
}

const DEFAULT_MAX_ENTRIES = 80;
const TITLE_FIELD_WEIGHT = 1.45;
const BODY_FIELD_WEIGHT = 1;
const TAG_FIELD_WEIGHT = 1.35;
const COMMON_TERM_THRESHOLD = 0.8;
const TOKEN_PATTERN = /-?\d+(?:[.,]\d+)*|[\p{L}\p{N}][\p{L}\p{N}#+.-]*/gu;
const COMBINING_MARK_PATTERN = /\p{M}+/gu;
const WHITESPACE_PATTERN = /\s+/gu;
const TECHNICAL_TERM_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}\p{N}_])((?:C\+\+|C#|F#))(?![\p{L}\p{N}_])/giu,
  /(?:^|[^\p{L}\p{N}_])((?:npm|pnpm|yarn)\s+(?:install|add|run|test|build))(?![\p{L}\p{N}_])/giu,
  /(?:^|[^\p{L}\p{N}_])(docker\s+(?:compose|run|build|pull|push|up|down))(?![\p{L}\p{N}_])/giu,
  /(?:^|[^\p{L}\p{N}_])(HTTP\s+\d{3})(?![\p{L}\p{N}_])/giu,
];

const FORUM_STOPWORDS_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
  de: [
    'frage',
    'fragen',
    'antwort',
    'antworten',
    'thema',
    'themen',
    'bitte',
    'genau',
    'eigentlich',
    'nochmal',
    'nochmals',
    'kurz',
    'kann',
    'können',
    'koennen',
    'soll',
    'sollen',
    'muss',
    'müssen',
    'muessen',
  ],
  en: [
    'question',
    'questions',
    'answer',
    'answers',
    'topic',
    'topics',
    'please',
    'exactly',
    'actually',
    'again',
    'could',
    'would',
    'should',
    'need',
  ],
  fr: [
    'question',
    'questions',
    'réponse',
    'reponse',
    'réponses',
    'reponses',
    'sujet',
    'sujets',
    'svp',
    'exactement',
    'encore',
  ],
  it: [
    'domanda',
    'domande',
    'risposta',
    'risposte',
    'argomento',
    'argomenti',
    'favore',
    'esattamente',
    'ancora',
  ],
  es: ['pregunta', 'preguntas', 'respuesta', 'respuestas', 'tema', 'temas', 'favor', 'exactamente'],
};

@Injectable({ providedIn: 'root' })
export class WordCloudTermExtractorService {
  extractTerms(
    documents: readonly WordCloudTermDocument[],
    options: WordCloudTermExtractionOptions,
  ): WordCloudTerm[] {
    const validDocuments = documents.filter((document) => this.documentText(document).length > 0);
    if (validDocuments.length === 0) {
      return [];
    }

    const stopwords = this.createStopwordLookup(options.locale, options.customStopwords ?? []);
    const maxNgramLength = options.maxNgramLength ?? 3;
    const buckets = new Map<string, TermBucket>();

    for (const document of validDocuments) {
      const documentWeight = this.normalizeDocumentWeight(document.weight);
      const documentCandidates = new Map<string, DocumentCandidate>();

      this.collectFieldCandidates(
        document.title ?? '',
        TITLE_FIELD_WEIGHT * documentWeight,
        stopwords,
        maxNgramLength,
        documentCandidates,
      );
      this.collectFieldCandidates(
        document.body ?? '',
        BODY_FIELD_WEIGHT * documentWeight,
        stopwords,
        maxNgramLength,
        documentCandidates,
      );
      for (const tag of document.tags ?? []) {
        this.collectFieldCandidates(
          tag,
          TAG_FIELD_WEIGHT * documentWeight,
          stopwords,
          maxNgramLength,
          documentCandidates,
        );
      }

      const memberText = this.documentText(document);
      for (const candidate of documentCandidates.values()) {
        const bucket = this.getOrCreateBucket(buckets, candidate);
        bucket.rawScore += candidate.contribution * this.kindMultiplier(candidate.kind);
        bucket.documentFrequency += 1;
        bucket.documentIds.add(document.id);
        bucket.variants.set(
          candidate.label,
          (bucket.variants.get(candidate.label) ?? 0) + candidate.contribution,
        );
        bucket.members.push({
          sourceId: document.id,
          text: memberText,
          weight: Math.max(0, Number(document.weight ?? 1)),
        });
      }
    }

    const minDf = this.resolveMinDocumentFrequency(validDocuments.length);
    const terms = [...buckets.values()]
      .filter((bucket) => bucket.documentFrequency >= minDf)
      .map((bucket) => this.finalizeBucket(bucket, validDocuments.length, buckets))
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.documentFrequency - left.documentFrequency ||
          this.kindRank(right.kind) - this.kindRank(left.kind) ||
          left.label.localeCompare(right.label),
      );

    return terms.slice(0, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
  }

  private collectFieldCandidates(
    value: string,
    fieldWeight: number,
    stopwords: ReadonlySet<string>,
    maxNgramLength: 1 | 2 | 3,
    documentCandidates: Map<string, DocumentCandidate>,
  ): void {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return;
    }

    const { candidates: protectedCandidates, masked } = this.extractProtectedCandidates(
      normalizedValue,
      fieldWeight,
    );
    for (const candidate of protectedCandidates) {
      if (stopwords.has(candidate.key)) {
        continue;
      }
      this.addDocumentCandidate(documentCandidates, candidate);
    }

    const tokens = this.tokenize(masked, stopwords);
    for (const token of tokens) {
      this.addDocumentCandidate(documentCandidates, {
        key: token.key,
        label: token.label,
        kind: 'unigram',
        contribution: fieldWeight,
      });
    }

    for (let size = 2; size <= maxNgramLength; size += 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const slice = tokens.slice(index, index + size);
        this.addDocumentCandidate(documentCandidates, {
          key: slice.map((token) => token.key).join(' '),
          label: slice.map((token) => token.label).join(' '),
          kind: size === 2 ? 'bigram' : 'trigram',
          contribution: fieldWeight,
        });
      }
    }
  }

  private extractProtectedCandidates(
    value: string,
    fieldWeight: number,
  ): { candidates: FieldCandidate[]; masked: string } {
    const candidates: FieldCandidate[] = [];
    const chars = value.split('');
    const mask = chars.map(() => false);

    for (const pattern of TECHNICAL_TERM_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of value.matchAll(pattern)) {
        const raw = (match[1] ?? match[0])?.trim();
        if (!raw) {
          continue;
        }
        const start = (match.index ?? 0) + (match[0]?.indexOf(raw) ?? 0);
        const end = start + raw.length;
        for (let index = start; index < end; index += 1) {
          mask[index] = true;
        }
        candidates.push({
          key: this.normalizeKey(raw),
          label: this.normalizeProtectedLabel(raw),
          kind: 'protected',
          contribution: fieldWeight,
        });
      }
    }

    return {
      candidates,
      masked: chars.map((char, index) => (mask[index] ? ' ' : char)).join(''),
    };
  }

  private tokenize(
    value: string,
    stopwords: ReadonlySet<string>,
  ): Array<{ key: string; label: string }> {
    const tokens: Array<{ key: string; label: string }> = [];
    for (const match of value.matchAll(TOKEN_PATTERN)) {
      const label = (match[0] ?? '').trim();
      const key = this.normalizeKey(label);
      if (!key || key.length < 2 || stopwords.has(key)) {
        continue;
      }
      tokens.push({ key, label });
    }
    return tokens;
  }

  private addDocumentCandidate(
    documentCandidates: Map<string, DocumentCandidate>,
    candidate: FieldCandidate,
  ): void {
    const existing = documentCandidates.get(candidate.key);
    if (!existing) {
      documentCandidates.set(candidate.key, { ...candidate });
      return;
    }

    if (candidate.contribution > existing.contribution) {
      existing.contribution = candidate.contribution;
      existing.label = candidate.label;
    }
    if (this.kindRank(candidate.kind) > this.kindRank(existing.kind)) {
      existing.kind = candidate.kind;
    }
  }

  private getOrCreateBucket(
    buckets: Map<string, TermBucket>,
    candidate: DocumentCandidate,
  ): TermBucket {
    const existing = buckets.get(candidate.key);
    if (existing) {
      if (this.kindRank(candidate.kind) > this.kindRank(existing.kind)) {
        existing.kind = candidate.kind;
      }
      return existing;
    }

    const created: TermBucket = {
      key: candidate.key,
      kind: candidate.kind,
      rawScore: 0,
      score: 0,
      documentFrequency: 0,
      documentIds: new Set(),
      variants: new Map(),
      members: [],
    };
    buckets.set(candidate.key, created);
    return created;
  }

  private finalizeBucket(
    bucket: TermBucket,
    totalDocuments: number,
    buckets: ReadonlyMap<string, TermBucket>,
  ): WordCloudTerm {
    const ubiquityPenalty =
      bucket.documentFrequency / totalDocuments > COMMON_TERM_THRESHOLD
        ? this.resolveCommonTermPenalty(totalDocuments)
        : 1;
    const phraseCoveragePenalty = this.resolvePhraseCoveragePenalty(bucket, buckets);
    bucket.score = Number((bucket.rawScore * ubiquityPenalty * phraseCoveragePenalty).toFixed(2));
    const variants = this.sortedVariants(bucket.variants);
    const label = variants[0] ?? bucket.key;

    return {
      key: bucket.key,
      label,
      score: Math.max(0.01, bucket.score),
      documentFrequency: bucket.documentFrequency,
      sourceCount: bucket.documentFrequency,
      variants,
      kind: bucket.kind,
      basisLabel: bucket.kind === 'unigram' ? null : label,
      confidence: null,
      members: bucket.members.sort(
        (left, right) => right.weight - left.weight || left.text.localeCompare(right.text),
      ),
    };
  }

  private resolvePhraseCoveragePenalty(
    bucket: TermBucket,
    buckets: ReadonlyMap<string, TermBucket>,
  ): number {
    if (bucket.kind !== 'unigram') {
      return 1;
    }

    const dominatedByPhrase = [...buckets.values()].some(
      (candidate) =>
        candidate.kind !== 'unigram' &&
        candidate.key.split(' ').includes(bucket.key) &&
        candidate.documentFrequency >= Math.ceil(bucket.documentFrequency * 0.65),
    );
    return dominatedByPhrase ? 0.55 : 1;
  }

  private sortedVariants(variants: ReadonlyMap<string, number>): string[] {
    return [...variants.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([variant]) => variant);
  }

  private createStopwordLookup(
    locale: SupportedLocale,
    customStopwords: readonly string[],
  ): ReadonlySet<string> {
    return new Set(
      [...getStopwordsForLocale(locale), ...FORUM_STOPWORDS_BY_LOCALE[locale], ...customStopwords]
        .map((word) => this.normalizeKey(word))
        .filter(Boolean),
    );
  }

  private resolveMinDocumentFrequency(totalDocuments: number): number {
    if (totalDocuments < 15) {
      return 1;
    }
    if (totalDocuments < 50) {
      return 2;
    }
    return 3;
  }

  private resolveCommonTermPenalty(totalDocuments: number): number {
    if (totalDocuments < 15) {
      return 0.35;
    }
    if (totalDocuments < 50) {
      return 0.15;
    }
    return 0.05;
  }

  private kindMultiplier(kind: WordCloudTermKind): number {
    switch (kind) {
      case 'protected':
        return 2;
      case 'trigram':
        return 1.85;
      case 'bigram':
        return 1.55;
      case 'unigram':
        return 1;
    }
  }

  private kindRank(kind: WordCloudTermKind): number {
    switch (kind) {
      case 'protected':
        return 4;
      case 'trigram':
        return 3;
      case 'bigram':
        return 2;
      case 'unigram':
        return 1;
    }
  }

  private documentText(document: WordCloudTermDocument): string {
    return [document.title, document.body, ...(document.tags ?? [])]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private normalizeDocumentWeight(weight: number | null | undefined): number {
    if (!Number.isFinite(weight)) {
      return 1;
    }
    return Math.max(0, Number(weight));
  }

  private normalizeProtectedLabel(value: string): string {
    const collapsed = value.trim().replace(WHITESPACE_PATTERN, ' ');
    return /^http\s+\d{3}$/iu.test(collapsed) ? collapsed.toUpperCase() : collapsed;
  }

  private normalizeKey(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase()
      .replace(WHITESPACE_PATTERN, ' ')
      .normalize('NFKD')
      .replace(COMBINING_MARK_PATTERN, '');
  }
}
