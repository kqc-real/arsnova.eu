import {
  createWordCloudLemmaFallback,
  resolveWordCloudLemmaApplication,
  type AnalyzeWordCloudInput,
  type WordCloudAnalysisSourceItem,
  type WordCloudLemmaApplication,
  type WordCloudNormalizationFallbackReason,
} from '@arsnova/shared-types';
import { resolveNlpSidecarConfig } from './nlpSidecarConfig';
import * as spacyClient from './spacyClient';
import { SpacyClientError, type SpacyNormalizeToken } from './spacyClient';
import {
  tokenizeWordCloudText,
  toWordCloudLookupToken,
  type WordCloudRawToken,
} from './wordCloudAnalysis';
import { getWordCloudAnalysisCache, type WordCloudAnalysisCache } from './wordCloudAnalysisCache';
import {
  hashWordCloudText,
  toWordCloudNormalizationMeta,
  type WordCloudNormalizationMeta,
} from './wordCloudNormalization';

const NAME_ENTITY_TYPES = new Set(['PERSON', 'GPE', 'ORG', 'LOC']);

export interface WordCloudNormalizer {
  readonly kind: 'identity' | 'lemma';
  normalize(
    items: readonly WordCloudAnalysisSourceItem[],
  ):
    | Promise<ReadonlyMap<string, readonly WordCloudRawToken[]>>
    | ReadonlyMap<string, readonly WordCloudRawToken[]>;
}

export class IdentityNormalizer implements WordCloudNormalizer {
  readonly kind = 'identity' as const;

  normalize(
    items: readonly WordCloudAnalysisSourceItem[],
  ): ReadonlyMap<string, readonly WordCloudRawToken[]> {
    return identityNormalizeWordCloudItems(items);
  }
}

export class LemmaNormalizer implements WordCloudNormalizer {
  readonly kind = 'lemma' as const;

  constructor(
    private readonly locale: 'de' | 'en',
    private readonly sidecar = spacyClient.normalizeWithSpacySidecar,
    private readonly config = resolveNlpSidecarConfig(),
  ) {}

  async normalize(
    items: readonly WordCloudAnalysisSourceItem[],
  ): Promise<ReadonlyMap<string, readonly WordCloudRawToken[]>> {
    const response = await this.sidecar(
      this.locale,
      items.map((item) => ({ id: item.id, text: item.text })),
      this.config,
    );
    return mapSidecarTokens(response.items);
  }
}

export interface WordCloudNormalizationCacheStats {
  readonly textHits: number;
  readonly textMisses: number;
  readonly sidecarCalled: boolean;
}

export interface NormalizeWordCloudResult {
  readonly tokensByItemId: ReadonlyMap<string, readonly WordCloudRawToken[]>;
  readonly meta: WordCloudNormalizationMeta;
  readonly cache: WordCloudNormalizationCacheStats;
}

export interface NormalizeWordCloudOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly sidecar?: typeof spacyClient.normalizeWithSpacySidecar;
  readonly cache?: WordCloudAnalysisCache;
}

const NO_TEXT_CACHE_STATS: WordCloudNormalizationCacheStats = {
  textHits: 0,
  textMisses: 0,
  sidecarCalled: false,
};

/**
 * Wählt Identity- oder Lemma-Normalisierung. spaCy wird nur bei LEXICAL + LEMMA
 * und aktivem Kill-Switch angesprochen; THEME bleibt ohne Sidecar-Aufruf.
 */
export async function normalizeWordCloudItems(
  input: AnalyzeWordCloudInput,
  options: NormalizeWordCloudOptions = {},
): Promise<NormalizeWordCloudResult> {
  const env = options.env ?? process.env;
  const nlp = resolveNlpSidecarConfig(env);
  const planned = resolveWordCloudLemmaApplication({
    requested: input.normalization,
    mode: input.mode,
    locale: input.locale,
    nlpEnabled: nlp.enabled,
    sidecarAvailable: nlp.enabled,
  });
  const identity = new IdentityNormalizer();
  const identityTokens = identity.normalize(input.items);

  if (planned.applied !== 'LEMMA') {
    return {
      tokensByItemId: identityTokens,
      meta: toWordCloudNormalizationMeta(input, planned),
      cache: NO_TEXT_CACHE_STATS,
    };
  }

  const cache = options.cache ?? getWordCloudAnalysisCache();
  const groups = groupItemsByTextHash(input.items);
  const tokensByHash = new Map<string, readonly WordCloudRawToken[]>();
  const missItems: WordCloudAnalysisSourceItem[] = [];
  const hashByMissId = new Map<string, string>();
  let textHits = 0;
  let textMisses = 0;

  for (const group of groups.values()) {
    const cached = await cache.getText(input.locale, group.hash);
    if (cached) {
      tokensByHash.set(group.hash, cached);
      textHits += 1;
      continue;
    }
    textMisses += 1;
    const representative = group.items[0]!;
    missItems.push(representative);
    hashByMissId.set(representative.id, group.hash);
  }

  if (missItems.length === 0) {
    return {
      tokensByItemId: tokensByItemIdFromHashes(input.items, tokensByHash),
      meta: toWordCloudNormalizationMeta(input, planned),
      cache: { textHits, textMisses, sidecarCalled: false },
    };
  }

  try {
    const lemma = new LemmaNormalizer(
      input.locale,
      options.sidecar ?? spacyClient.normalizeWithSpacySidecar,
      nlp,
    );
    const missTokens = await lemma.normalize(missItems);
    for (const item of missItems) {
      const tokens = missTokens.get(item.id);
      if (!tokens) {
        throw new SpacyClientError('INVALID_RESPONSE');
      }
      const hash = hashByMissId.get(item.id)!;
      tokensByHash.set(hash, tokens);
      await cache.setText(input.locale, hash, tokens);
    }
    return {
      tokensByItemId: tokensByItemIdFromHashes(input.items, tokensByHash),
      meta: toWordCloudNormalizationMeta(input, planned),
      cache: { textHits, textMisses, sidecarCalled: true },
    };
  } catch (error) {
    return {
      tokensByItemId: identityTokens,
      meta: toWordCloudNormalizationMeta(input, fallbackFromSidecarError(input, planned, error)),
      cache: { textHits, textMisses, sidecarCalled: true },
    };
  }
}

export function identityNormalizeWordCloudItems(
  items: readonly WordCloudAnalysisSourceItem[],
): ReadonlyMap<string, readonly WordCloudRawToken[]> {
  return new Map(items.map((item) => [item.id, tokenizeWordCloudText(item.text)]));
}

export function mapSpacyTokenToWordCloud(token: SpacyNormalizeToken): WordCloudRawToken {
  const pos = token.pos.toUpperCase();
  const entType = token.entType?.trim().toUpperCase() ?? '';
  const keepSurface = pos === 'PROPN' || NAME_ENTITY_TYPES.has(entType) || pos !== 'NOUN';
  const surfaceOrLemma = keepSurface ? token.text : token.lemma;
  return {
    display: surfaceOrLemma,
    lookup: toWordCloudLookupToken(surfaceOrLemma),
  };
}

function mapSidecarTokens(
  items: ReadonlyArray<{ readonly id: string; readonly tokens: readonly SpacyNormalizeToken[] }>,
): ReadonlyMap<string, readonly WordCloudRawToken[]> {
  return new Map(items.map((item) => [item.id, item.tokens.map(mapSpacyTokenToWordCloud)]));
}

function fallbackFromSidecarError(
  input: AnalyzeWordCloudInput,
  planned: WordCloudLemmaApplication,
  error: unknown,
): WordCloudLemmaApplication {
  return createWordCloudLemmaFallback(
    planned.requested,
    input.locale,
    reasonFromSidecarError(error),
  );
}

function groupItemsByTextHash(
  items: readonly WordCloudAnalysisSourceItem[],
): Map<string, { hash: string; items: WordCloudAnalysisSourceItem[] }> {
  const groups = new Map<string, { hash: string; items: WordCloudAnalysisSourceItem[] }>();
  for (const item of items) {
    const hash = hashWordCloudText(item.text);
    const existing = groups.get(hash);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(hash, { hash, items: [item] });
  }
  return groups;
}

function tokensByItemIdFromHashes(
  items: readonly WordCloudAnalysisSourceItem[],
  tokensByHash: ReadonlyMap<string, readonly WordCloudRawToken[]>,
): ReadonlyMap<string, readonly WordCloudRawToken[]> {
  return new Map(
    items.map((item) => [item.id, tokensByHash.get(hashWordCloudText(item.text)) ?? []]),
  );
}

function reasonFromSidecarError(error: unknown): WordCloudNormalizationFallbackReason {
  if (error instanceof SpacyClientError) {
    if (error.code === 'TIMEOUT') {
      return 'TIMEOUT';
    }
    if (error.code === 'INVALID_RESPONSE') {
      return 'INVALID_RESPONSE';
    }
  }
  return 'SIDECAR_UNAVAILABLE';
}
