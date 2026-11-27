import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AnalyzeWordCloudOutput } from '@arsnova/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { wordCloudAnalysisInfo } from './word-cloud-analysis-info';
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
    const pending = enrichCurrentTopicCloud({
      base,
      injector: TestBed.inject(Injector),
      isCurrent: current,
      fetch,
      apply,
    });
    current.set(false);
    TestBed.tick();
    expect(fetch.mock.calls[0]?.[1].aborted).toBe(true);
    reply(enriched);
    await pending;
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('wordCloudAnalysisInfo', () => {
  it('leitet die Herkunft aus sichtbaren Labels ab und benennt nur belegte Ursachen', () => {
    const result = { ...enriched, topicLabelsPending: false, labelFallbackReason: 'busy' as const };
    const names = [enriched.entries[0]!, base.entries[0]!];
    const info = wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, names);
    expect(info.status).toBe('Teils KI-generiert');
    expect(info.details).toContain('Die KI war belegt. Du siehst die verfügbaren Themennamen.');
    expect(wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, []).status).toBeNull();
    expect(wordCloudAnalysisInfo({ mode: 'SEMANTIC', result }, names.slice(1)).status).toBe(
      'Originalformulierungen',
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
