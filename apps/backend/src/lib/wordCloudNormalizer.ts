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
import {
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

export interface NormalizeWordCloudResult {
  readonly tokensByItemId: ReadonlyMap<string, readonly WordCloudRawToken[]>;
  readonly meta: WordCloudNormalizationMeta;
}

export interface NormalizeWordCloudOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly sidecar?: typeof spacyClient.normalizeWithSpacySidecar;
}

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
    };
  }

  try {
    const lemma = new LemmaNormalizer(
      input.locale,
      options.sidecar ?? spacyClient.normalizeWithSpacySidecar,
      nlp,
    );
    return {
      tokensByItemId: await lemma.normalize(input.items),
      meta: toWordCloudNormalizationMeta(input, planned),
    };
  } catch (error) {
    return {
      tokensByItemId: identityTokens,
      meta: toWordCloudNormalizationMeta(input, fallbackFromSidecarError(input, planned, error)),
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
