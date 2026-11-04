import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION,
  QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
  QA_SUMMARY_V2_SCHEMA_VERSION,
} from '@arsnova/shared-types';
import { OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS } from './openWeightLlmConfig';
import {
  getOpenWeightLlmRuntimeProbe,
  getOpenWeightLlmSummaryV2ProbeRequestForTests,
  OPEN_WEIGHT_LLM_PROBE_LEARNING_TIMEOUT_MS,
  resetOpenWeightLlmRuntimeProbeForTests,
  resolveOpenWeightLlmProbeTaskTimeoutsMs,
  wouldOpenWeightLlmRuntimeProbeRequireLiveMeasurement,
} from './openWeightLlmRuntimeProbe';

const enabledEnv = {
  OPEN_WEIGHT_LLM_ENABLED: 'true',
  OPEN_WEIGHT_LLM_URL: 'http://127.0.0.1:8080',
  OPEN_WEIGHT_LLM_TOKEN: 'a'.repeat(32),
} as NodeJS.ProcessEnv;

afterEach(() => {
  resetOpenWeightLlmRuntimeProbeForTests();
});

describe('getOpenWeightLlmRuntimeProbe', () => {
  it('meldet disabled ohne Runtime-Aufruf', async () => {
    const topicLabel = vi.fn();
    const result = await getOpenWeightLlmRuntimeProbe({
      env: { OPEN_WEIGHT_LLM_ENABLED: 'false' },
      topicLabel,
    });
    expect(result.enabled).toBe(false);
    expect(result.overall).toBe('disabled');
    expect(result.cache).toBe('skipped');
    expect(result.modelAlias).toBeNull();
    expect(result.modelReported).toBeNull();
    expect(result.tasks.topic_label.status).toBe('disabled');
    expect(topicLabel).not.toHaveBeenCalled();
  });

  it('prüft die drei Aufgaben über den produktiven Summary-V2-Vertrag und cached', async () => {
    const topicLabel = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'topic_label' as const,
        label: 'lineare Funktionen',
        sourceIds: ['probe-s1'],
      },
      telemetry: {
        taskType: 'topic_label' as const,
        elapsedMs: 12,
        model: 'gemma-3-4b-it-qat-q4_0',
        promptTokens: null,
        completionTokens: null,
      },
    }));
    const summaryV2 = vi.fn(async (request) => {
      expect(request.schemaVersion).toBe(QA_SUMMARY_V2_SCHEMA_VERSION);
      expect(request.requestContract).toBe(QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION);
      expect(request.outputContract).toBe(QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION);
      expect(request.promptContext).toBeDefined();
      return {
        status: 'completed' as const,
        output: {
          schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
          taskType: 'qa_summary' as const,
          outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
          output: {
            status: 'ready' as const,
            statements: [
              {
                text: 'Kapitel 4',
                sourceIds: [request.promptContext.context.sources[0]!.id],
              },
            ],
            suggestedNextSteps: [],
            limitations: [],
          },
        },
        telemetry: {
          taskType: 'qa_summary' as const,
          elapsedMs: 20,
          model: 'gemma-3-4b-it-qat-q4_0',
          promptTokens: null,
          completionTokens: null,
        },
      };
    });
    const learning = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'learning_objectives' as const,
        objectives: [
          {
            text: 'Lineare Funktionen interpretieren',
            questionIds: ['11111111-1111-4111-8111-111111111111'],
          },
        ],
        limitations: [],
      },
      telemetry: {
        taskType: 'learning_objectives' as const,
        elapsedMs: 30,
        model: 'gemma-3-4b-it-qat-q4_0',
        promptTokens: null,
        completionTokens: null,
      },
    }));

    const first = await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      topicLabel: topicLabel as never,
      summaryV2: summaryV2 as never,
      learning: learning as never,
    });
    expect(first.overall).toBe('ok');
    expect(first.cache).toBe('live');
    expect(first.modelAlias).toBe('gemma-3-4b-it-qat-q4_0');
    expect(first.modelReported).toBe('gemma-3-4b-it-qat-q4_0');
    expect(first.tasks.topic_label.status).toBe('ok');
    expect(first.tasks.qa_summary.status).toBe('ok');
    expect(first.tasks.learning_objectives.status).toBe('ok');
    expect(topicLabel).toHaveBeenCalledTimes(1);
    expect(summaryV2).toHaveBeenCalledTimes(1);

    const second = await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      topicLabel: topicLabel as never,
      summaryV2: summaryV2 as never,
      learning: learning as never,
    });
    expect(second.cache).toBe('fresh');
    expect(topicLabel).toHaveBeenCalledTimes(1);
  });

  it('lässt refresh den Cache nicht umgehen', async () => {
    const topicLabel = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'topic_label' as const,
        label: 'Probe',
        sourceIds: ['probe-s1'],
      },
      telemetry: {
        taskType: 'topic_label' as const,
        elapsedMs: 1,
        model: 'gemma-3-4b-it-qat-q4_0',
        promptTokens: null,
        completionTokens: null,
      },
    }));
    const summaryV2 = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
        taskType: 'qa_summary' as const,
        outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
        output: {
          status: 'ready' as const,
          statements: [],
          suggestedNextSteps: [],
          limitations: [],
        },
      },
      telemetry: {
        taskType: 'qa_summary' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    }));
    const learning = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'learning_objectives' as const,
        objectives: [],
        limitations: [],
      },
      telemetry: {
        taskType: 'learning_objectives' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    }));

    await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      topicLabel: topicLabel as never,
      summaryV2: summaryV2 as never,
      learning: learning as never,
    });
    const refreshed = await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      refresh: true,
      topicLabel: topicLabel as never,
      summaryV2: summaryV2 as never,
      learning: learning as never,
    });
    expect(refreshed.cache).toBe('fresh');
    expect(topicLabel).toHaveBeenCalledTimes(1);
    expect(summaryV2).toHaveBeenCalledTimes(1);
    expect(learning).toHaveBeenCalledTimes(1);
  });

  it('baut einen gültigen Summary-V2-Probe-Request', () => {
    const request = getOpenWeightLlmSummaryV2ProbeRequestForTests();
    expect(request.schemaVersion).toBe(2);
    expect(request.requestContract).toBe(QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION);
    expect(request.outputContract).toBe(QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION);
    expect(request.promptContext.budget.instructionTokens).toBe(
      new TextEncoder().encode(request.instructionText).byteLength,
    );
    expect(request.promptContext.budget.definitionTokens).toBe(
      new TextEncoder().encode(request.definitionText).byteLength,
    );
  });

  it('hält Topic beim kurzen Probe-Budget, Learning gedeckelt und Summary beim konfigurierten Timeout', () => {
    expect(resolveOpenWeightLlmProbeTaskTimeoutsMs(enabledEnv)).toEqual({
      topic_label: 20_000,
      qa_summary: OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS,
      learning_objectives: OPEN_WEIGHT_LLM_PROBE_LEARNING_TIMEOUT_MS,
    });
    expect(
      resolveOpenWeightLlmProbeTaskTimeoutsMs({
        ...enabledEnv,
        OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS: '12000',
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: '180000',
        OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS: '110000',
      }),
    ).toEqual({
      topic_label: 20_000,
      qa_summary: 180_000,
      learning_objectives: OPEN_WEIGHT_LLM_PROBE_LEARNING_TIMEOUT_MS,
    });
    expect(
      resolveOpenWeightLlmProbeTaskTimeoutsMs({
        ...enabledEnv,
        OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS: '45000',
      }).learning_objectives,
    ).toBe(45_000);
    expect(resolveOpenWeightLlmProbeTaskTimeoutsMs(enabledEnv, 2_500)).toEqual({
      topic_label: 2_500,
      qa_summary: 2_500,
      learning_objectives: 2_500,
    });
    // Token-/Transport-Fehler dürfen die Summary-Timeout-Auflösung nicht werfen.
    expect(
      resolveOpenWeightLlmProbeTaskTimeoutsMs({
        OPEN_WEIGHT_LLM_ENABLED: 'true',
        OPEN_WEIGHT_LLM_TOKEN: 'zu-kurz',
        OPEN_WEIGHT_LLM_URL: 'http://127.0.0.1:8080',
        OPEN_WEIGHT_LLM_SOCKET_PATH: '/tmp/llm.sock',
      }).qa_summary,
    ).toBe(OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS);
  });

  it('liefert bei ungültigem Summary-Timeout strukturiert misconfigured ohne Exception', async () => {
    const topicLabel = vi.fn();
    const summaryV2 = vi.fn();
    const learning = vi.fn();
    const result = await getOpenWeightLlmRuntimeProbe({
      env: {
        ...enabledEnv,
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: 'abc',
      },
      topicLabel: topicLabel as never,
      summaryV2: summaryV2 as never,
      learning: learning as never,
    });
    expect(result.enabled).toBe(true);
    expect(result.overall).toBe('unavailable');
    expect(result.tasks.qa_summary.reason).toBe('misconfigured');
    expect(topicLabel).not.toHaveBeenCalled();
    expect(summaryV2).not.toHaveBeenCalled();
    expect(learning).not.toHaveBeenCalled();
  });

  it('übergibt 20s an Topic/Learning und das konfigurierte Summary-Timeout an summaryV2', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const completedTopic = {
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'topic_label' as const,
        label: 'Probe',
        sourceIds: ['probe-s1'],
      },
      telemetry: {
        taskType: 'topic_label' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    };
    const completedSummary = {
      status: 'completed' as const,
      output: {
        schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
        taskType: 'qa_summary' as const,
        outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
        output: {
          status: 'ready' as const,
          statements: [],
          suggestedNextSteps: [],
          limitations: [],
        },
      },
      telemetry: {
        taskType: 'qa_summary' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    };
    const completedLearning = {
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'learning_objectives' as const,
        objectives: [],
        limitations: [],
      },
      telemetry: {
        taskType: 'learning_objectives' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    };

    await getOpenWeightLlmRuntimeProbe({
      env: {
        ...enabledEnv,
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: '180000',
      },
      topicLabel: (async () => completedTopic) as never,
      summaryV2: (async () => completedSummary) as never,
      learning: (async () => completedLearning) as never,
    });

    expect(timeoutSpy).toHaveBeenCalledWith(20_000);
    expect(timeoutSpy).toHaveBeenCalledWith(180_000);
    expect(timeoutSpy).toHaveBeenCalledWith(OPEN_WEIGHT_LLM_PROBE_LEARNING_TIMEOUT_MS);
    expect(timeoutSpy.mock.calls.filter((call) => call[0] === 20_000)).toHaveLength(1);
    timeoutSpy.mockRestore();
  });

  it('wertet schema-valides Summary-V2 mit status failed nicht als ok', async () => {
    const result = await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      topicLabel: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: 1 as const,
          taskType: 'topic_label' as const,
          label: 'Probe',
          sourceIds: ['probe-s1'],
        },
        telemetry: {
          taskType: 'topic_label' as const,
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
      summaryV2: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
          taskType: 'qa_summary' as const,
          outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
          output: {
            status: 'failed' as const,
            statements: [],
            suggestedNextSteps: [],
            limitations: [{ code: 'model-failed', detail: 'fixture' }],
          },
        },
        telemetry: {
          taskType: 'qa_summary' as const,
          elapsedMs: 1,
          model: 'gemma-3-4b-it-qat-q4_0',
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
      learning: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: 1 as const,
          taskType: 'learning_objectives' as const,
          objectives: [
            {
              text: 'Lineare Funktionen interpretieren',
              questionIds: ['11111111-1111-4111-8111-111111111111'],
            },
          ],
          limitations: [],
        },
        telemetry: {
          taskType: 'learning_objectives' as const,
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
    });
    expect(result.tasks.qa_summary.status).toBe('degraded');
    expect(result.tasks.qa_summary.reason).toBe('invalid_response');
    expect(result.overall).toBe('degraded');
  });

  it('fordert Live-Messung nur ohne gültigen Cache', async () => {
    expect(
      wouldOpenWeightLlmRuntimeProbeRequireLiveMeasurement({
        env: { OPEN_WEIGHT_LLM_ENABLED: 'false' },
      }),
    ).toBe(false);

    expect(wouldOpenWeightLlmRuntimeProbeRequireLiveMeasurement({ env: enabledEnv })).toBe(true);

    await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      topicLabel: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: 1 as const,
          taskType: 'topic_label' as const,
          label: 'Probe',
          sourceIds: ['probe-s1'],
        },
        telemetry: {
          taskType: 'topic_label' as const,
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
      summaryV2: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
          taskType: 'qa_summary' as const,
          outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
          output: {
            status: 'ready' as const,
            statements: [],
            suggestedNextSteps: [],
            limitations: [],
          },
        },
        telemetry: {
          taskType: 'qa_summary' as const,
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
      learning: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: 1 as const,
          taskType: 'learning_objectives' as const,
          objectives: [
            {
              text: 'Lineare Funktionen interpretieren',
              questionIds: ['11111111-1111-4111-8111-111111111111'],
            },
          ],
          limitations: [],
        },
        telemetry: {
          taskType: 'learning_objectives' as const,
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
    });

    expect(wouldOpenWeightLlmRuntimeProbeRequireLiveMeasurement({ env: enabledEnv })).toBe(false);
  });

  it('koppelt beforeLiveMeasurement atomar an den Single-Flight-Start', async () => {
    let releaseGate: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const beforeLive = vi.fn(async () => {
      await gate;
    });
    const topicLabel = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'topic_label' as const,
        label: 'Probe',
        sourceIds: ['probe-s1'],
      },
      telemetry: {
        taskType: 'topic_label' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    }));
    const summaryV2 = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
        taskType: 'qa_summary' as const,
        outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
        output: {
          status: 'ready' as const,
          statements: [],
          suggestedNextSteps: [],
          limitations: [],
        },
      },
      telemetry: {
        taskType: 'qa_summary' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    }));
    const learning = vi.fn(async () => ({
      status: 'completed' as const,
      output: {
        schemaVersion: 1 as const,
        taskType: 'learning_objectives' as const,
        objectives: [
          {
            text: 'Lineare Funktionen interpretieren',
            questionIds: ['11111111-1111-4111-8111-111111111111'],
          },
        ],
        limitations: [],
      },
      telemetry: {
        taskType: 'learning_objectives' as const,
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    }));

    const pending = Array.from({ length: 80 }, () =>
      getOpenWeightLlmRuntimeProbe({
        env: enabledEnv,
        beforeLiveMeasurement: beforeLive,
        topicLabel: topicLabel as never,
        summaryV2: summaryV2 as never,
        learning: learning as never,
      }),
    );
    // Alle 80 Requests sind eingetroffen, bevor das Rate-Limit-Gate freigegeben wird.
    await Promise.resolve();
    expect(beforeLive).toHaveBeenCalledTimes(1);
    expect(wouldOpenWeightLlmRuntimeProbeRequireLiveMeasurement({ env: enabledEnv })).toBe(false);
    releaseGate?.();
    const results = await Promise.all(pending);
    expect(beforeLive).toHaveBeenCalledTimes(1);
    expect(topicLabel).toHaveBeenCalledTimes(1);
    expect(summaryV2).toHaveBeenCalledTimes(1);
    expect(learning).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(80);
    expect(new Set(results.map((result) => result.checkedAt)).size).toBe(1);
  });

  it('ordnet busy und Teilausfälle dem Gesamtstatus zu', async () => {
    const result = await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      topicLabel: (async () => ({
        status: 'fallback' as const,
        reason: 'busy',
        output: {
          schemaVersion: 1 as const,
          taskType: 'topic_label' as const,
          label: 'Probe',
          sourceIds: ['probe-s1'],
        },
      })) as never,
      summaryV2: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
          taskType: 'qa_summary' as const,
          outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
          output: {
            status: 'ready' as const,
            statements: [],
            suggestedNextSteps: [],
            limitations: [],
          },
        },
        telemetry: {
          taskType: 'qa_summary' as const,
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
      learning: (async () => ({ status: 'busy' as const, retry: 'manual' as const })) as never,
    });
    expect(result.tasks.topic_label.status).toBe('busy');
    expect(result.tasks.qa_summary.status).toBe('ok');
    expect(result.tasks.learning_objectives.status).toBe('busy');
    expect(result.overall).toBe('busy');
  });

  it('wartet nach einer abgebrochenen Teilprobe kurz auf die Slot-Freigabe von llama-server', async () => {
    const result = await getOpenWeightLlmRuntimeProbe({
      env: enabledEnv,
      topicLabel: (async () => ({
        status: 'fallback' as const,
        reason: 'timeout',
        output: {
          schemaVersion: 1 as const,
          taskType: 'topic_label' as const,
          label: 'Probe',
          sourceIds: ['probe-s1'],
        },
      })) as never,
      summaryV2: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
          taskType: 'qa_summary' as const,
          outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
          output: {
            status: 'ready' as const,
            statements: [],
            suggestedNextSteps: [],
            limitations: [],
          },
        },
        telemetry: {
          taskType: 'qa_summary' as const,
          elapsedMs: 1,
          model: 'gemma-3-4b-it-qat-q4_0',
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
      learning: (async () => ({
        status: 'completed' as const,
        output: {
          schemaVersion: 1 as const,
          taskType: 'learning_objectives' as const,
          objectives: [],
          limitations: [],
        },
        telemetry: {
          taskType: 'learning_objectives' as const,
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      })) as never,
    });
    expect(result.tasks.topic_label.status).toBe('unavailable');
    expect(result.tasks.qa_summary.status).toBe('ok');
    expect(result.tasks.learning_objectives.status).toBe('ok');
    expect(result.overall).toBe('degraded');
  });
});
