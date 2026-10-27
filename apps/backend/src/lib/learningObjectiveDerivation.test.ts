import { describe, expect, it, vi } from 'vitest';
import {
  LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
  LearningObjectiveDerivationQuestionSchema,
  OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES,
  OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  type LearningObjectiveDerivationInput,
  type OpenWeightLlmLearningObjectivesRequest,
} from '@arsnova/shared-types';
import {
  LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS,
  deriveLearningObjectiveDrafts,
  projectLearningObjectiveDerivationQuestion,
} from './learningObjectiveDerivation';
import { OPEN_WEIGHT_LLM_MODEL_ID, OPEN_WEIGHT_LLM_MODEL_VERSION } from './openWeightLlmConfig';
import { logger } from './logger';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_IDS = [
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000007',
] as const;

function choiceQuestion(
  id: string,
  order = 0,
  text = 'Welche Antwort ist richtig?',
): LearningObjectiveDerivationInput['questions'][number] {
  return {
    sourceQuestionId: id,
    enabled: true,
    order,
    text,
    type: 'SINGLE_CHOICE',
    answers: [
      { text: 'Die richtige Antwort', isCorrect: true },
      { text: 'Die falsche Antwort', isCorrect: false },
    ],
  };
}

function input(
  questions: LearningObjectiveDerivationInput['questions'],
  maximumDrafts = 100,
): LearningObjectiveDerivationInput {
  return {
    schemaVersion: LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
    operationId: OPERATION_ID,
    quizId: QUIZ_ID,
    expectedBundleRevision: 7,
    locale: 'de',
    maximumDrafts,
    questions,
  };
}

const telemetry = {
  taskType: 'learning_objectives' as const,
  elapsedMs: 12,
  model: 'fixture-model.gguf',
  promptTokens: 120,
  completionTokens: 24,
};

function successfulBatch(request: OpenWeightLlmLearningObjectivesRequest) {
  return {
    status: 'completed' as const,
    output: {
      schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
      taskType: 'learning_objectives' as const,
      objectives: [
        {
          text: `Lernziel für ${request.questions[0]!.id}`,
          questionIds: request.questions.map((question) => question.id),
        },
      ],
      limitations: [],
    },
    telemetry,
  };
}

describe('learningObjectiveDerivation', () => {
  it('projects every solution-bearing quiz type completely and canonically', () => {
    const questions = [
      choiceQuestion(QUESTION_IDS[0]),
      {
        sourceQuestionId: QUESTION_IDS[1],
        enabled: true,
        order: 1,
        text: 'Nenne eine Primzahl.',
        type: 'SHORT_TEXT' as const,
        answers: [
          { text: '2', isCorrect: true },
          { text: '3', isCorrect: true },
        ],
        shortTextEvaluationMode: 'exact' as const,
        shortTextCaseSensitive: false,
      },
      {
        sourceQuestionId: QUESTION_IDS[2],
        enabled: true,
        order: 2,
        text: 'Schätze den Wert.',
        type: 'NUMERIC_ESTIMATE' as const,
        answers: [],
        numericToleranceMode: 'RELATIVE_PERCENT' as const,
        numericReferenceValue: 42,
        numericTolerancePercent: 5,
        numericInputType: 'DECIMAL' as const,
      },
      {
        sourceQuestionId: QUESTION_IDS[3],
        enabled: true,
        order: 3,
        text: 'Ordne zu.',
        type: 'MATCHING' as const,
        answers: [],
        matchingPairs: [
          { leftId: 'l1', left: 'A', rightId: 'r1', right: '1' },
          { leftId: 'l2', left: 'B', rightId: 'r2', right: '2' },
        ],
      },
      {
        sourceQuestionId: QUESTION_IDS[4],
        enabled: true,
        order: 4,
        text: 'Sortiere.',
        type: 'ORDERING' as const,
        answers: [],
        orderingItems: [
          { id: 'o1', text: 'Erstens' },
          { id: 'o2', text: 'Zweitens' },
          { id: 'o3', text: 'Drittens' },
        ],
      },
      {
        sourceQuestionId: QUESTION_IDS[5],
        enabled: true,
        order: 5,
        text: 'Kategorisiere.',
        type: 'CATEGORIZATION' as const,
        answers: [],
        categories: [
          { id: 'c1', name: 'Gerade' },
          { id: 'c2', name: 'Ungerade' },
        ],
        categorizationItems: [
          { id: 'i1', text: '1', correctCategoryId: 'c2' },
          { id: 'i2', text: '2', correctCategoryId: 'c1' },
          { id: 'i3', text: '3', correctCategoryId: 'c2' },
          { id: 'i4', text: '4', correctCategoryId: 'c1' },
        ],
      },
    ].map((question) => LearningObjectiveDerivationQuestionSchema.parse(question));

    const projected = questions.map(projectLearningObjectiveDerivationQuestion);
    expect(projected[0]?.answerOptions).toEqual([
      { text: 'Die richtige Antwort', isCorrect: true },
      { text: 'Die falsche Antwort', isCorrect: false },
    ]);
    expect(projected[1]?.answerOptions.map(({ text }) => text)).toEqual(['2', '3']);
    expect(projected[1]?.solutionExplanation).toContain('"evaluationMode":"exact"');
    expect(projected[2]).toMatchObject({
      answerOptions: [{ text: '42', isCorrect: true }],
    });
    expect(projected[2]?.solutionExplanation).toContain('"tolerancePercent":5');
    expect(projected[3]?.answerOptions.map(({ text }) => text)).toEqual(['A ⇔ 1', 'B ⇔ 2']);
    expect(projected[4]?.answerOptions.map(({ text }) => text)).toEqual([
      '1. Erstens',
      '2. Zweitens',
      '3. Drittens',
    ]);
    expect(projected[5]?.solutionExplanation).toContain(
      '"assignments":[{"itemId":"i1","item":"1","categoryId":"c2","category":"Ungerade"}',
    );
  });

  it('excludes disabled and non-assessed questions', async () => {
    const disabled = { ...choiceQuestion(QUESTION_IDS[0]), enabled: false };
    const survey = {
      sourceQuestionId: QUESTION_IDS[1],
      enabled: true,
      order: 1,
      text: 'Wie war es?',
      type: 'SURVEY' as const,
      answers: [{ text: 'Gut', isCorrect: false }],
    };
    const run = vi.fn();
    await expect(
      deriveLearningObjectiveDrafts(input([disabled, survey]), { run }),
    ).resolves.toEqual(expect.objectContaining({ status: 'no_eligible_questions' }));
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts exactly 2,500 UTF-8 bytes and rejects the same projection at 2,501', async () => {
    const seedQuestion = choiceQuestion(QUESTION_IDS[0], 0, 'x'.repeat(2_000));
    seedQuestion.answers = [
      { text: 'a', isCorrect: true },
      { text: 'b', isCorrect: false },
    ];
    const seedRequests: OpenWeightLlmLearningObjectivesRequest[] = [];
    await deriveLearningObjectiveDrafts(input([seedQuestion]), {
      run: async (request) => {
        seedRequests.push(request);
        return successfulBatch(request);
      },
    });
    expect(seedRequests).toHaveLength(1);

    const seedBytes = new TextEncoder().encode(JSON.stringify(seedRequests[0])).byteLength;
    const missingBytes = OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES - seedBytes;
    expect(missingBytes).toBeGreaterThan(0);
    expect(missingBytes).toBeLessThan(500);

    const exactQuestion = {
      ...seedQuestion,
      answers: [
        { text: `a${'y'.repeat(missingBytes)}`, isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    };
    const exactRequests: OpenWeightLlmLearningObjectivesRequest[] = [];
    const exact = await deriveLearningObjectiveDrafts(input([exactQuestion]), {
      run: async (request) => {
        exactRequests.push(request);
        return successfulBatch(request);
      },
    });
    expect(exact.status).toBe('completed');
    expect(exactRequests).toHaveLength(1);
    expect(new TextEncoder().encode(JSON.stringify(exactRequests[0])).byteLength).toBe(2_500);

    const overBoundaryQuestion = {
      ...exactQuestion,
      answers: [
        { text: `${exactQuestion.answers[0]!.text}z`, isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    };
    expect(overBoundaryQuestion.answers[0]!.text.length).toBeLessThanOrEqual(500);
    const overBoundaryProjection = projectLearningObjectiveDerivationQuestion(
      LearningObjectiveDerivationQuestionSchema.parse(overBoundaryQuestion),
    );
    if (!overBoundaryProjection) throw new Error('solution-bearing projection expected');
    expect(
      new TextEncoder().encode(
        JSON.stringify({ ...exactRequests[0], questions: [overBoundaryProjection] }),
      ).byteLength,
    ).toBe(2_501);

    const overBoundaryRun = vi.fn();
    const overBoundary = await deriveLearningObjectiveDrafts(input([overBoundaryQuestion]), {
      run: overBoundaryRun,
    });
    expect(overBoundary).toMatchObject({
      status: 'input_too_large',
      sourceQuestionId: QUESTION_IDS[0],
    });
    expect(overBoundaryRun).not.toHaveBeenCalled();
  });

  it('forms stable ordered batches within the UTF-8 byte boundary', async () => {
    const questions = QUESTION_IDS.slice(0, 4).map((id, index) =>
      choiceQuestion(id, 3 - index, `${'🧪'.repeat(170)}-${index}`),
    );
    const requests: OpenWeightLlmLearningObjectivesRequest[] = [];
    const run = vi.fn(async (request: OpenWeightLlmLearningObjectivesRequest) => {
      requests.push(request);
      return successfulBatch(request);
    });
    const first = await deriveLearningObjectiveDrafts(input(questions), {
      run,
      now: () => new Date('2026-10-05T12:00:00.000Z'),
    });
    expect(first.status).toBe('completed');
    expect(requests.length).toBeGreaterThan(1);
    expect(
      requests.every(
        (request) =>
          new TextEncoder().encode(JSON.stringify(request)).byteLength <=
          OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES,
      ),
    ).toBe(true);
    const firstGrouping = requests.map((request) => request.questions.map(({ id }) => id));

    requests.length = 0;
    await deriveLearningObjectiveDrafts(input([...questions].reverse()), {
      run,
      now: () => new Date('2026-10-05T12:00:00.000Z'),
    });
    expect(requests.map((request) => request.questions.map(({ id }) => id))).toEqual(firstGrouping);
  });

  it('rejects a single multibyte question that cannot fit instead of truncating it', async () => {
    const run = vi.fn();
    const result = await deriveLearningObjectiveDrafts(
      input([choiceQuestion(QUESTION_IDS[0], 0, '🧪'.repeat(600))]),
      { run },
    );
    expect(result).toMatchObject({
      status: 'input_too_large',
      sourceQuestionId: QUESTION_IDS[0],
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('discards partial output and stops after busy without an automatic retry', async () => {
    const questions = QUESTION_IDS.slice(0, 4).map((id, index) =>
      choiceQuestion(id, index, '🧪'.repeat(170)),
    );
    const run = vi
      .fn()
      .mockImplementationOnce(async (request: OpenWeightLlmLearningObjectivesRequest) =>
        successfulBatch(request),
      )
      .mockResolvedValueOnce({ status: 'busy', retry: 'manual' });
    const result = await deriveLearningObjectiveDrafts(input(questions), { run });
    expect(result).toMatchObject({ status: 'busy', retry: 'manual' });
    expect(run).toHaveBeenCalledTimes(2);
    expect(result).not.toHaveProperty('drafts');
  });

  it('reports deterministic capacity capping and an empty completed model result explicitly', async () => {
    const questions = QUESTION_IDS.slice(0, 4).map((id, index) =>
      choiceQuestion(id, index, '🧪'.repeat(170)),
    );
    const many = vi.fn(async (request: OpenWeightLlmLearningObjectivesRequest) => ({
      status: 'completed' as const,
      output: {
        schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
        taskType: 'learning_objectives' as const,
        objectives: Array.from({ length: 100 }, (_, index) => ({
          text: `${request.requestId}: Ziel ${index}`,
          questionIds: [request.questions[0]!.id],
        })),
        limitations: ['Die Frage-IDs werden exakt verwendet und nicht verändert.'],
      },
      telemetry,
    }));
    const capped = await deriveLearningObjectiveDrafts(input(questions, 1), {
      run: many,
      now: () => new Date('2026-10-05T12:00:00.000Z'),
    });
    expect(capped).toMatchObject({
      status: 'completed',
      limitations: ['Weitere Vorschläge wurden wegen der Lernziel-Obergrenze nicht übernommen.'],
    });
    if (capped.status === 'completed') expect(capped.drafts).toHaveLength(1);

    const empty = await deriveLearningObjectiveDrafts(input([choiceQuestion(QUESTION_IDS[0])]), {
      run: async () => ({
        status: 'completed',
        output: {
          schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
          taskType: 'learning_objectives',
          objectives: [],
          limitations: [],
        },
        telemetry,
      }),
      now: () => new Date('2026-10-05T12:00:00.000Z'),
    });
    expect(empty).toMatchObject({
      status: 'completed',
      drafts: [],
      limitations: ['Das Modell hat keine belegten Lernzielvorschläge geliefert.'],
    });
  });

  it('returns the runtime status before publishing question-group progress', async () => {
    const run = vi.fn();
    const onProgress = vi.fn();
    const unavailable = await deriveLearningObjectiveDrafts(
      input([choiceQuestion(QUESTION_IDS[0])]),
      {
        run,
        onProgress,
        preflight: async () => 'unavailable',
      },
    );
    expect(unavailable).toMatchObject({ status: 'unavailable' });
    const disabled = await deriveLearningObjectiveDrafts(input([choiceQuestion(QUESTION_IDS[0])]), {
      run,
      onProgress,
      preflight: async () => 'disabled',
    });
    expect(disabled).toMatchObject({ status: 'disabled' });
    expect(run).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('stops between batches when the host cancels and exposes no partial draft', async () => {
    const questions = QUESTION_IDS.slice(0, 4).map((id, index) =>
      choiceQuestion(id, index, '🧪'.repeat(170)),
    );
    const controller = new AbortController();
    const run = vi.fn(async (request: OpenWeightLlmLearningObjectivesRequest) => {
      controller.abort();
      return successfulBatch(request);
    });
    const published: Array<{
      completedGroups: number;
      totalGroups: number;
      promptTokens: number;
      completionTokens: number;
    }> = [];
    const result = await deriveLearningObjectiveDrafts(input(questions), {
      run,
      signal: controller.signal,
      onProgress: (progress) => {
        published.push(progress);
      },
    });
    expect(result).toMatchObject({
      status: 'aborted',
      progress: {
        completedGroups: 0,
        promptTokens: 0,
        completionTokens: 0,
      },
    });
    expect(result.status === 'aborted' && result.progress.totalGroups).toBeGreaterThan(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('drafts');
    expect(published[0]).toMatchObject({
      completedGroups: 0,
      totalGroups: result.status === 'aborted' ? result.progress.totalGroups : 0,
    });
    expect(published.at(-1)).toMatchObject({
      completedGroups: 0,
      promptTokens: 0,
      completionTokens: 0,
    });
  });

  it('bounds the complete multi-batch lifecycle and releases the active run after deadline', async () => {
    expect(LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS).toBe(1_200_000);
    const questions = QUESTION_IDS.slice(0, 4).map((id, index) =>
      choiceQuestion(id, index, '🧪'.repeat(170)),
    );
    let runtimeCalls = 0;
    let active = false;
    let blockSecondCall = true;
    const run = vi.fn(
      async (
        request: OpenWeightLlmLearningObjectivesRequest,
        options: { signal?: AbortSignal },
      ) => {
        if (active) return { status: 'busy' as const, retry: 'manual' as const };
        active = true;
        runtimeCalls += 1;
        try {
          if (blockSecondCall && runtimeCalls === 2) {
            await new Promise<void>((resolve) => {
              options.signal?.addEventListener('abort', () => resolve(), { once: true });
            });
            return { status: 'aborted' as const };
          }
          return successfulBatch(request);
        } finally {
          active = false;
        }
      },
    );

    const timedOut = await deriveLearningObjectiveDrafts(input(questions), {
      run,
      overallTimeoutMs: 15,
    });
    expect(timedOut).toMatchObject({
      status: 'timeout',
      progress: {
        completedGroups: 1,
        promptTokens: 120,
        completionTokens: 24,
        queuedObjectives: 1,
      },
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(active).toBe(false);

    blockSecondCall = false;
    const afterDeadline = await deriveLearningObjectiveDrafts(
      input([choiceQuestion(QUESTION_IDS[0])]),
      { run, overallTimeoutMs: 100 },
    );
    expect(afterDeadline).toMatchObject({ status: 'completed' });
    expect(active).toBe(false);
  });

  it('fails closed on invented and cross-batch references', async () => {
    const foreignId = '99999999-9999-4999-8999-999999999999';
    const run = vi.fn(async (_request: OpenWeightLlmLearningObjectivesRequest) => ({
      status: 'completed' as const,
      output: {
        schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
        taskType: 'learning_objectives' as const,
        objectives: [{ text: 'Unbelegt', questionIds: [foreignId] }],
        limitations: [],
      },
      telemetry,
    }));
    await expect(
      deriveLearningObjectiveDrafts(input([choiceQuestion(QUESTION_IDS[0])]), { run }),
    ).resolves.toEqual(expect.objectContaining({ status: 'invalid_response' }));

    const crossBatch = vi.fn(async (_request: OpenWeightLlmLearningObjectivesRequest) => ({
      status: 'completed' as const,
      output: {
        schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
        taskType: 'learning_objectives' as const,
        objectives: [{ text: 'Falscher Batch', questionIds: [QUESTION_IDS[3]] }],
        limitations: [],
      },
      telemetry,
    }));
    const batchedQuestions = QUESTION_IDS.slice(0, 4).map((id, index) =>
      choiceQuestion(id, index, '🧪'.repeat(170)),
    );
    await expect(
      deriveLearningObjectiveDrafts(input(batchedQuestions), { run: crossBatch }),
    ).resolves.toEqual(expect.objectContaining({ status: 'invalid_response' }));
    expect(crossBatch).toHaveBeenCalledTimes(1);
  });

  it('protokolliert den fehlerhaften Batch ohne Aufgaben-IDs oder Entwurfstexte', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const questions = QUESTION_IDS.slice(0, 4).map((id, index) =>
      choiceQuestion(id, index, '🧪'.repeat(170)),
    );
    let call = 0;
    try {
      const result = await deriveLearningObjectiveDrafts(input(questions), {
        run: async (request) => {
          call += 1;
          return call === 1 ? successfulBatch(request) : { status: 'invalid_response' };
        },
      });
      expect(result).toMatchObject({ status: 'invalid_response' });
      expect(info).toHaveBeenCalledWith('learning_objectives:batch_completed', {
        batch: 1,
        batchCount: expect.any(Number),
        elapsedMs: 12,
        promptTokens: 120,
        completionTokens: 24,
      });
      expect(warn).toHaveBeenCalledWith('learning_objectives:batch_failed', {
        batch: 2,
        batchCount: expect.any(Number),
        status: 'invalid_response',
      });
      const logs = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
      expect(logs).not.toContain(QUESTION_IDS[0]);
      expect(logs).not.toContain('🧪');
    } finally {
      info.mockRestore();
      warn.mockRestore();
    }
  });

  it('capitalizes lowercase model-authored infinitive phrases in the requested locale', async () => {
    const run = vi.fn(async (request: OpenWeightLlmLearningObjectivesRequest) => ({
      status: 'completed' as const,
      output: {
        schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
        taskType: 'learning_objectives' as const,
        objectives: [
          { text: '  lineare   Modelle anwenden  ', questionIds: [request.questions[0]!.id] },
          { text: 'überprüfen, ob die Annahme gilt', questionIds: [request.questions[0]!.id] },
        ],
        limitations: [],
      },
      telemetry,
    }));
    const german = await deriveLearningObjectiveDrafts(input([choiceQuestion(QUESTION_IDS[0])]), {
      run,
      now: () => new Date('2026-10-05T12:00:00.000Z'),
    });
    expect(german).toMatchObject({
      status: 'completed',
      drafts: [{ text: 'Lineare Modelle anwenden.' }, { text: 'Überprüfen, ob die Annahme gilt.' }],
    });

    const frenchInput = { ...input([choiceQuestion(QUESTION_IDS[0])]), locale: 'fr' as const };
    const frenchRun = vi.fn(async (request: OpenWeightLlmLearningObjectivesRequest) => ({
      status: 'completed' as const,
      output: {
        schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
        taskType: 'learning_objectives' as const,
        objectives: [
          { text: 'établir un modèle linéaire', questionIds: [request.questions[0]!.id] },
        ],
        limitations: [],
      },
      telemetry,
    }));
    const french = await deriveLearningObjectiveDrafts(frenchInput, {
      run: frenchRun,
      now: () => new Date('2026-10-05T12:00:00.000Z'),
    });
    expect(french).toMatchObject({
      status: 'completed',
      drafts: [{ text: 'Établir un modèle linéaire.' }],
    });
  });

  it('discards model-authored boilerplate and creates deterministic draft IDs and digests', async () => {
    expect(OPEN_WEIGHT_LLM_MODEL_ID).toBe(
      'unsloth/Qwen3-4B-Instruct-2507-GGUF@sha256:3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597',
    );
    expect(OPEN_WEIGHT_LLM_MODEL_VERSION).toBe(
      'revision:a06e946bb6b655725eafa393f4a9745d460374c9|quant:Q4_K_M|llama:server-b10524',
    );
    const run = vi.fn(async (request: OpenWeightLlmLearningObjectivesRequest) => ({
      status: 'completed' as const,
      output: {
        schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
        taskType: 'learning_objectives' as const,
        objectives: [
          { text: '  Ableiten   können  ', questionIds: [request.questions[0]!.id] },
          { text: 'ableiten können', questionIds: [request.questions[0]!.id] },
        ],
        limitations: [
          'Die Frage-IDs werden exakt verwendet und nicht transformiert.',
          'Die IDs wurden direkt aus der Eingabe übernommen.',
          'Die Lernziele beziehen sich nur auf Fragen und Lösungen.',
        ],
      },
      telemetry,
    }));
    const hooks = {
      run,
      now: () => new Date('2026-10-05T12:00:00.000Z'),
    };
    const first = await deriveLearningObjectiveDrafts(
      input([choiceQuestion(QUESTION_IDS[0])]),
      hooks,
    );
    const second = await deriveLearningObjectiveDrafts(
      input([choiceQuestion(QUESTION_IDS[0])]),
      hooks,
    );
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      status: 'completed',
      limitations: [],
      drafts: [
        {
          text: 'Ableiten können.',
          origin: {
            modelId: OPEN_WEIGHT_LLM_MODEL_ID,
            modelVersion: OPEN_WEIGHT_LLM_MODEL_VERSION,
            sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
        },
      ],
    });

    const changedSource = choiceQuestion(QUESTION_IDS[0]);
    changedSource.answers = [
      { text: 'Eine fachlich geänderte richtige Antwort', isCorrect: true },
      { text: 'Die falsche Antwort', isCorrect: false },
    ];
    const changed = await deriveLearningObjectiveDrafts(input([changedSource]), hooks);
    if (first.status !== 'completed' || changed.status !== 'completed') {
      throw new Error('completed result expected');
    }
    expect(changed.drafts[0]?.id).not.toBe(first.drafts[0]?.id);
    expect(changed.drafts[0]?.origin.sourceDigest).not.toBe(first.drafts[0]?.origin.sourceDigest);
  });
});
