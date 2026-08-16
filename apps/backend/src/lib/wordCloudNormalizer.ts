import {
  createWordCloudLemmaFallback,
  resolveWordCloudLemmaApplication,
  type AnalyzeWordCloudInput,
  type WordCloudAnalysisSourceItem,
  type WordCloudLemmaApplication,
  type WordCloudLemmaLocale,
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
const LEMMA_POS_TYPES = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'AUX']);

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
    private readonly locale: WordCloudLemmaLocale,
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

export function mapSpacyTokenToWordCloud(
  token: SpacyNormalizeToken,
  neighbors: { readonly next?: SpacyNormalizeToken } = {},
): WordCloudRawToken {
  const pos = token.pos.toUpperCase();
  const entType = token.entType?.trim().toUpperCase() ?? '';
  const nominalizedInfinitive = isNominalizedInfinitive(token, neighbors.next);
  const effectivePos = nominalizedInfinitive ? 'NOUN' : pos;
  const keepSurface =
    effectivePos === 'PROPN' ||
    NAME_ENTITY_TYPES.has(entType) ||
    !LEMMA_POS_TYPES.has(effectivePos) ||
    nominalizedInfinitive;
  const lemma = token.lemma.trim();
  const surfaceOrLemma = keepSurface || lemma.length === 0 ? token.text : lemma;
  const lookup = toWordCloudLookupToken(surfaceOrLemma);
  const surfaceLookup = toWordCloudLookupToken(token.text);
  return {
    display: surfaceOrLemma,
    lookup,
    pos: effectivePos,
    ...(surfaceLookup !== lookup ? { surfaceLookup } : {}),
  };
}

function mapSidecarTokens(
  items: ReadonlyArray<{ readonly id: string; readonly tokens: readonly SpacyNormalizeToken[] }>,
): ReadonlyMap<string, readonly WordCloudRawToken[]> {
  return new Map(
    items.map((item) => [
      item.id,
      item.tokens.map((token, index) =>
        mapSpacyTokenToWordCloud(token, {
          next: item.tokens[index + 1],
        }),
      ),
    ]),
  );
}

function isNominalizedInfinitive(token: SpacyNormalizeToken, next?: SpacyNormalizeToken): boolean {
  if (token.pos.toUpperCase() !== 'VERB') {
    return false;
  }

  const text = token.text.trim();
  if (!hasNounCapitalization(text)) {
    return false;
  }

  const lemma = token.lemma.trim();
  if (!lemma || toWordCloudLookupToken(lemma) !== toWordCloudLookupToken(text)) {
    return false;
  }

  const nextPos = next?.pos.toUpperCase();
  return nextPos !== 'PRON' && nextPos !== 'AUX';
}

function hasNounCapitalization(text: string): boolean {
  const first = [...text][0];
  if (!first || !/\p{L}/u.test(first)) {
    return false;
  }

  if (first !== first.toLocaleUpperCase() || first === first.toLocaleLowerCase()) {
    return false;
  }

  return text !== text.toLocaleUpperCase() || text.length > 4;
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
