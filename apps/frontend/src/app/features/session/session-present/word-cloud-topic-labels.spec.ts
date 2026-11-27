import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AnalyzeWordCloudOutput } from '@arsnova/shared-types';
import { describe, expect, it, vi } from 'vitest';
import {
  displayedWordCloudResult,
  wordCloudAnalysisInfo,
  wordCloudTopicAnalysisState,
} from './word-cloud-analysis-info';
import { textAnalysisCopy as copy } from '../../../shared/text-analysis/text-analysis-copy';
import { enrichCurrentTopicCloud } from './word-cloud-topic-labels';

const base: AnalyzeWordCloudOutput = {
  snapshotHash: 'a'.repeat(64),
  mode: 'SEMANTIC',
  locale: 'de',
  metric: 'TOP',
  status: 'ready',
  generatedAt: '2026-11-23T00:00:00.000Z',
  fallbackUsed: false,
  modelId: 'test',
  modelVersion: 'test',
  fallbackLocale: 'de',
  analysisVersion: 'test',
  normalization: 'NONE',
  normalizationApplied: 'NONE',
  normalizationFallbackUsed: false,
  normalizationFallbackReason: null,
  topicLabelsPending: true,
  entries: [
    {
      key: 'regression',
      label: 'Regressionsanalyse',
      labelOrigin: 'extractive',
      basisLabel: 'Regressionsanalyse',
      count: 2,
      confidence: 1,
      variants: [],
      members: [{ sourceId: '1', text: 'Regressionsanalyse', weight: 2 }],
    },
  ],
};
const enriched: AnalyzeWordCloudOutput = {
  ...base,
  labelSettlement: 'complete',
  labelModelId: 'test-model',
  labelModelVersion: 'test-model-version',
  labelPromptVersion: 'topic-label-system-v1',
  entries: [
    { ...base.entries[0]!, label: 'Statistische Vorhersagen', labelOrigin: 'model', count: 100 },
  ],
};

describe('enrichCurrentTopicCloud', () => {
  it('übernimmt nur Labels, sobald die Modellantwort vorliegt', async () => {
    TestBed.configureTestingModule({});
    let reply = (_result: AnalyzeWordCloudOutput) => {};
    const response = new Promise<AnalyzeWordCloudOutput>((resolve) => {
      reply = resolve;
    });
    const update = vi.fn();
    const fetch = vi.fn(() => response);
    const pending = enrichCurrentTopicCloud({
      base,
      injector: TestBed.inject(Injector),
      isCurrent: () => true,
      fetch,
      apply: update,
    });
    expect(update).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      { snapshotHash: base.snapshotHash },
      expect.any(AbortSignal),
    );
    reply(enriched);
    await pending;
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        topicLabelsPending: false,
        labelPromptVersion: 'topic-label-system-v1',
        entries: [
          expect.objectContaining({
            label: 'Statistische Vorhersagen',
            count: 2,
            members: base.entries[0]!.members,
          }),
        ],
      }),
    );
  });

  it('beendet die Benennung nach einer abgelehnten zweiten Anfrage und erhält die Vorschau', async () => {
    TestBed.configureTestingModule({});
    const apply = vi.fn();
    const onPendingChange = vi.fn();

    await enrichCurrentTopicCloud({
      base,
      injector: TestBed.inject(Injector),
      isCurrent: () => true,
      fetch: vi.fn().mockRejectedValue(new Error('request failed')),
      apply,
      onPendingChange,
    });

    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(apply).toHaveBeenCalledWith({ ...base, topicLabelsPending: false });
  });

  it('bricht bei einem Snapshotwechsel ab und ignoriert die verspätete Modellantwort', async () => {
    TestBed.configureTestingModule({});
    const current = signal(true);
    let reply = (_result: AnalyzeWordCloudOutput) => {};
    const response = new Promise<AnalyzeWordCloudOutput>((resolve) => {
      reply = resolve;
    });
    const fetch = vi.fn((_snapshot: unknown, _signal: AbortSignal) => response);
    const apply = vi.fn();
    const onPendingChange = vi.fn();
    const pending = enrichCurrentTopicCloud({
      base,
      injector: TestBed.inject(Injector),
      isCurrent: current,
      fetch,
      apply,
      onPendingChange,
    });
    current.set(false);
    TestBed.tick();
    expect(fetch.mock.calls[0]?.[1].aborted).toBe(true);
    reply(enriched);
    await pending;
    expect(apply).not.toHaveBeenCalled();
    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(base.entries[0]?.labelOrigin).toBe('extractive');
  });
});

describe('wordCloudAnalysisInfo', () => {
  it('leitet die Herkunft aus sichtbaren Labels ab und benennt nur belegte Ursachen', () => {
    const result = { ...enriched, topicLabelsPending: false, labelFallbackReason: 'busy' as const };
    const names = [enriched.entries[0]!, base.entries[0]!];
    const info = wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, names);
    expect(info.status).toBe('Einige Themennamen KI-generiert');
    expect(info.process).toContain('Die Gruppen bleiben dabei unverändert.');
    expect(info.details).toContain('Die KI war belegt. Du siehst die verfügbaren Themennamen.');
    expect(wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, []).status).toBeNull();
    expect(wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, names.slice(1)).status).toBe(
      'Themennamen aus Originalbeiträgen',
    );
  });

  it('belässt die Namensherkunft auch bei einem Cachetreffer im kompakten Status', () => {
    const result = { ...enriched, reuse: { snapshot: true } };
    const info = wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, [
      enriched.entries[0]!,
      base.entries[0]!,
    ]);
    expect(info.status).toBe(copy.someModel);
    expect(info.details).toContain(copy.snapshotReused);
    expect(wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, enriched.entries).status).toBe(
      copy.allModelShort,
    );
  });

  it('zeigt eine wiederverwendete Gruppierung und einen neutralen Wartestatus', () => {
    const result = { ...base, reuse: { preview: true } };
    const info = wordCloudAnalysisInfo(
      { mode: 'SEMANTIC', result, namingPending: true },
      base.entries,
    );
    expect(info.status).toBe('Themennamen werden vorbereitet …');
    expect(info.details).toContain('Vorhandene Themenbildung übernommen');
  });
});

describe('Provenienz der angezeigten Wortwolke', () => {
  it('zeigt Glättung nur bei sichtbaren Einträgen aus dem Lemma-Ergebnis', () => {
    const entry = base.entries[0]!;
    const lemma: AnalyzeWordCloudOutput = {
      ...base,
      mode: 'LEXICAL',
      normalization: 'LEMMA',
      normalizationApplied: 'LEMMA',
    };
    const phrase = { ...entry, key: 'lineare-regression', label: 'Lineare Regression' };
    const phraseResult: AnalyzeWordCloudOutput = { ...base, mode: 'THEME', entries: [phrase] };
    expect(displayedWordCloudResult([], lemma, phraseResult)).toBeNull();
    const displayedPhrase = displayedWordCloudResult([phrase], lemma, phraseResult);
    expect(displayedPhrase).toBe(phraseResult);
    expect(
      wordCloudAnalysisInfo({ mode: 'THEME', result: displayedPhrase }, [phrase]).status,
    ).toBeNull();
    const displayedFallback = displayedWordCloudResult([phrase, entry], lemma, phraseResult);
    expect(displayedFallback).toBe(lemma);
    const fallback = wordCloudAnalysisInfo({ mode: 'SEMANTIC', result: displayedFallback }, [
      phrase,
      entry,
    ]);
    expect(fallback.status).toBe(copy.normalizationShort);
    expect(fallback.description).toBe(copy.topicsInfo);
    expect(wordCloudAnalysisInfo({ mode: 'THEME', result: lemma }, [phrase]).status).toBeNull();
  });

  it.each(['qa', 'freetext'] as const)(
    'zeigt bei %s sowohl das alte Ergebnis als auch den fehlgeschlagenen Refresh',
    (channel) => {
      const state = wordCloudTopicAnalysisState({
        channel,
        result: base,
        hasSources: true,
        pending: false,
        previousTopics: true,
        failed: true,
        freshness: 'changed',
      });
      const info = wordCloudAnalysisInfo(
        { mode: 'SEMANTIC', result: base, topicState: state },
        base.entries,
      );
      expect(info.status).toBe(copy.corpusStaleShort);
      expect(info.details).toContain(copy.corpusStale);
      expect(info.details).toContain(
        'Themen konnten gerade nicht aktualisiert werden. Nutze die bisherige Ansicht oder versuche es erneut.',
      );
      expect(info.details).toContain(copy.allExtractive);
    },
  );

  it.each([
    {
      status: 'fallback',
      semanticFallbackReason: 'no_shared_topics',
      expected: copy.noSharedTopics,
    },
    { status: 'fallback', modelVersion: 'encoder', expected: copy.noSharedTopics },
    {
      status: 'fallback',
      expected: 'Ähnliche Beiträge lassen sich gerade nicht zuverlässig zusammenfassen.',
    },
    { status: 'disabled', expected: 'Themen sind hier nicht verfügbar.' },
    { status: 'failed', expected: copy.topicUpdateFailed },
  ] as const)('trennt den belegten Analyseausgang $status von anderen Ursachen', (scenario) => {
    const { expected, ...fields } = scenario;
    const result: AnalyzeWordCloudOutput = {
      ...base,
      modelVersion: null,
      fallbackUsed: true,
      ...fields,
    };
    const topicState = wordCloudTopicAnalysisState({
      channel: 'qa',
      result,
      hasSources: true,
      pending: false,
      previousTopics: false,
      failed: false,
      freshness: null,
    });
    const info = wordCloudAnalysisInfo({ mode: 'SEMANTIC', result, topicState }, result.entries);
    expect(info.status).toContain(expected);
    expect(info.details.includes(copy.noSharedTopics)).toBe(expected === copy.noSharedTopics);
    expect(info.details).not.toContain(copy.allExtractive);
  });

  it.each([
    { entries: enriched.entries, short: copy.allModelShort, detail: copy.allModel },
    {
      entries: [{ ...base.entries[0]!, labelOrigin: undefined }],
      short: copy.unknownOrigin,
      detail: copy.unknownOrigin,
    },
  ])('zeigt $short in Status und Detail', ({ entries, short, detail }) => {
    const info = wordCloudAnalysisInfo({ mode: 'SEMANTIC', result: base }, entries);
    expect(info.status).toBe(short);
    expect(info.details).toContain(detail);
  });

  it.each([
    { labelSettlement: 'disabled', expected: copy.labelsDisabled },
    { labelSettlement: 'transient', labelFallbackReason: 'timeout', expected: copy.labelTimeout },
    {
      labelSettlement: 'transient',
      labelFallbackReason: 'invalid_response',
      expected: copy.invalidLabel,
    },
    { labelSettlement: undefined, expected: copy.labelUnavailable },
  ] as const)(
    'bewahrt Originalformulierungen bei der Namensherkunft $labelSettlement',
    (scenario) => {
      const { expected, ...fields } = scenario;
      const result: AnalyzeWordCloudOutput = { ...base, topicLabelsPending: false, ...fields };
      const info = wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, result.entries);
      expect(info.status).toBe(copy.allExtractiveShort);
      expect(info.details).toContain(expected);
    },
  );
});
