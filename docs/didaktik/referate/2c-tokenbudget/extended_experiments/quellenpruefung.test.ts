/** Ergänzende Kontrolle mit eingespeisten Modellantworten und Nachprüfung der echten Rohdaten. */
import { it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import * as S from '@arsnova/shared-types';
import {
  prepareModerationSummaryContextFromAnalysis as prepare,
  resolveQaSummaryAdapterPlan,
} from './moderationSummaryContext';
import { resolveOpenWeightLlmConfig } from './openWeightLlmConfig';
import { resetOpenWeightLlmClientForTests } from './openWeightLlmClient';
import { runPreparedQaSummary } from './qaSummaryRuntimeAdapter';
import { bindQaSummaryModelOutputV2 } from './qaSummaryValidateV2';
import { hasAcceptableQaSummaryQuality } from './qaSummaryQuality';

const at = new Date('2026-01-15T10:05:00Z');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const save = (name: string, value: unknown) =>
  writeFileSync('/evidence/' + name, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const plan = {
  ...resolveQaSummaryAdapterPlan(),
  selectedMode: 'full-context' as const,
  inferenceConfigured: true,
  fallback: null,
};
function prepared(folder: string, key: string) {
  const analysis = S.ModerationAnalysisContextV1Schema.parse(
    read(folder + '/fixture-' + key + '.json'),
  );
  return prepare({ analysis, plan, packedAt: at });
}
const statement = (text: string, ...sourceIds: string[]) => ({ text, sourceIds });
it('trennt JSON, Schema, Quellenliste, Qualitätsfilter und tatsächlich ausgelieferte Ausgabe', async () => {
  const audit: Record<string, unknown> = {};
  for (const series of ['640', '1024', 'erweitert']) {
    const folder = '/messung/measure-' + series;
    const runs =
      series === 'erweitert'
        ? /^erweitert-[RP]\d+-(long100|meta6)-[AB]\.json$/
        : /^(640|1024)-[RP]\d+-(S6|S100)-[AB]\.json$/;
    for (const name of readdirSync(folder).filter((n) => runs.test(n))) {
      const record = read(folder + '/' + name);
      const [, , key, arm] = record.id.split('-');
      const p = prepared(folder, key);
      let raw;
      try {
        raw = JSON.parse(record.rawContent);
      } catch {
        raw = null;
      }
      const parsed = S.OpenWeightLlmOutputSchema.safeParse(raw);
      const output =
        parsed.success && parsed.data.taskType === 'qa_summary' && parsed.data.schemaVersion === 2
          ? parsed.data
          : null;
      const ids = new Set(
        read(folder + '/context-' + key + '-B.json').map((s: { id: string }) => s.id),
      );
      const refs = output?.output
        ? [...output.output.statements, ...output.output.suggestedNextSteps].flatMap(
            (s) => s.sourceIds,
          )
        : [];
      audit[record.id] = {
        json: !!raw,
        schema: !!output,
        appRefs: output ? S.hasOnlyAllowedOpenWeightLlmReferences(p.request, output) : null,
        armRefs: output && arm === 'B' ? refs.every((id) => ids.has(id)) : null,
        qualityGate: output ? hasAcceptableQaSummaryQuality(output.output, 'de') : null,
        modelStatus: output?.output.status ?? null,
        actualMode: record.execution?.effectiveMode ?? null,
        finalStatus: record.bound?.status ?? null,
      };
    }
  }
  save('pruefstufen.json', audit);
  const p = prepared('/messung/measure-640', 'S100');
  const [a, , c, , e] = p.request.promptContext.context.sources
    .filter((s) => s.kind === 'qa-question')
    .map((s) => s.id);
  const exam = statement('Klausur: Der Umfang von Kapitel vier soll geklärt werden.', c);
  const practice = 'Regression: Es gibt einen Wunsch nach weiteren Übungsbeispielen.';
  const cases = [
    ['korrekt', statement(practice, a), exam],
    ['unbekannte-id', statement(practice, 'qa-question:unknown'), exam],
    ['gemischte-ids', statement(practice, a, 'qa-question:unknown'), exam],
    ['fehlende-id', statement(practice), exam],
    ['falscher-beleg', statement(practice, e), exam],
    [
      'erfundene-statistik',
      statement('Beteiligung: Genau 73 Personen lehnen die Pflicht ab.', e),
      exam,
    ],
    [
      'lernstandsdiagnose',
      statement('Verständnis: Alle Studierenden beherrschen die lineare Regression.', a),
      exam,
    ],
    [
      'pending-fehldeutung',
      statement('Freigabe: Der Übungswunsch wurde von der Lehrperson abgelehnt.', a),
      exam,
    ],
    [
      'stimmen-fehldeutung',
      statement('Anwesenheit: Die ausgewogene Bewertung belegt Gleichgültigkeit.', e),
      exam,
    ],
    ['nur-ein-anliegen', statement(practice, a)],
  ] as const;
  const controls = [];
  const config = resolveOpenWeightLlmConfig({
    OPEN_WEIGHT_LLM_ENABLED: 'true',
    OPEN_WEIGHT_LLM_URL: 'http://127.0.0.1:8080',
    OPEN_WEIGHT_LLM_TOKEN: 'synthetic-study-control-token-0123456789',
  });
  for (const [label, ...items] of cases) {
    const raw = {
      schemaVersion: 2,
      taskType: 'qa_summary',
      outputContract: p.request.outputContract,
      output: { status: 'ready', statements: items, limitations: [], suggestedNextSteps: [] },
    };
    const body = JSON.stringify({
      choices: [{ message: { content: JSON.stringify(raw) }, finish_reason: 'stop' }],
    });
    resetOpenWeightLlmClientForTests({
      config: () => config,
      request: async (input) => ({ status: 200, body: input.method === 'GET' ? '[]' : body }),
    });
    const result = await runPreparedQaSummary(p);
    const bound = bindQaSummaryModelOutputV2({
      output: result.output,
      prepared: p,
      execution: result.execution,
      analyzedAt: at.toISOString(),
    });
    controls.push({ label, raw, execution: result.execution, adapter: result.output, bound });
  }
  save('kontrollantworten.json', controls);
  expect(controls[0].execution.effectiveMode).toBe('full-context');
  expect(controls).toHaveLength(10);
});
