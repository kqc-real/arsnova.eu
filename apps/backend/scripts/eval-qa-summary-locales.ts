import { performance } from 'node:perf_hooks';
import {
  AppLocaleEnum,
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  type AppLocale,
} from '@arsnova/shared-types';
import {
  prepareModerationSummaryContextFromAnalysis,
  QA_SUMMARY_ADAPTER_CAPABILITIES,
} from '../src/lib/moderationSummaryContext';
import { QA_SUMMARY_TIMEOUT_DEFAULT_MS } from '../src/lib/qaSummaryConfig';
import { runPreparedQaSummary } from '../src/lib/qaSummaryRuntimeAdapter';

const QUESTIONS: Record<AppLocale, readonly string[]> = {
  de: [
    'Wie berechnet man die Standardabweichung?',
    'Welche Formel ergibt die Standardabweichung?',
    'Wann muss die Hausarbeit eingereicht werden?',
    'Bis wann ist die Hausarbeit fällig?',
  ],
  en: [
    'How do we calculate standard deviation?',
    'What is the formula for standard deviation?',
    'When do we submit the term paper?',
    'When is the term paper due?',
  ],
  fr: [
    'Comment calcule-t-on l’écart type ?',
    'Quelle formule donne l’écart type ?',
    'Quand faut-il rendre le dossier ?',
    'Quelle est la date limite pour rendre le dossier ?',
  ],
  es: [
    '¿Cómo se calcula la desviación estándar?',
    '¿Cuál es la fórmula de la desviación estándar?',
    '¿Cuándo hay que entregar el trabajo?',
    '¿Cuál es la fecha límite de entrega del trabajo?',
  ],
  it: [
    'Come si calcola la deviazione standard?',
    'Qual è la formula della deviazione standard?',
    'Quando dobbiamo consegnare la relazione?',
    'Qual è la scadenza per consegnare la relazione?',
  ],
};

async function main(): Promise<void> {
  for (const locale of AppLocaleEnum.options) {
    const fixture = MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1;
    const questionTemplate = fixture.context.questions.items[0]!;
    const texts = QUESTIONS[locale];
    const sources = texts.map((text, index) => ({
      id: `qa-question:00000000-0000-4000-8000-00000000000${index + 1}`,
      kind: 'qa-question',
      content: { state: 'included', text, truncated: false },
    }));
    const now = new Date();
    const analysis = ModerationAnalysisContextV1Schema.parse({
      schemaVersion: fixture.schemaVersion,
      contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
      assembledAt: now.toISOString(),
      context: {
        ...fixture.context,
        locale,
        representation: 'analysis-candidates',
        sources,
        questions: {
          ...fixture.context.questions,
          corpus: { total: 4, eligible: 4, analyzed: 4, deduplicated: 4, represented: 4 },
          items: sources.map(({ id }) => ({ ...questionTemplate, sourceId: id })),
        },
      },
    });
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis,
      plan: {
        capabilities: QA_SUMMARY_ADAPTER_CAPABILITIES,
        selectedMode: 'full-context',
        fallback: null,
        inferenceConfigured: true,
      },
      packedAt: now,
    });
    const start = performance.now();
    const result = await runPreparedQaSummary(prepared, {
      signal: AbortSignal.timeout(QA_SUMMARY_TIMEOUT_DEFAULT_MS),
    });
    const elapsedMs = Math.round(performance.now() - start);
    const sourceIds = new Set(sources.map(({ id }) => id));
    const cited = result.output.statements.every(
      (statement) =>
        statement.sourceIds.length > 0 && statement.sourceIds.every((id) => sourceIds.has(id)),
    );
    const firstTheme = new Set(sources.slice(0, 2).map(({ id }) => id));
    const themes = result.output.statements.map(({ sourceIds: refs }) => {
      if (refs.every((ref) => firstTheme.has(ref))) return 'calculation';
      if (refs.every((ref) => !firstTheme.has(ref))) return 'deadline';
      return 'mixed';
    });
    const distinctThemes =
      themes.includes('calculation') && themes.includes('deadline') && !themes.includes('mixed');
    const statements = result.output.statements.map(({ text }) => text);
    const headings = statements.map((text) => text.split(':', 1)[0]!);
    // These examples contain no numbers, so a generated date or quantity cannot come from them.
    const inventedNumber = statements.some((text) => /\p{N}/u.test(text));
    const passed =
      result.execution.effectiveMode === 'full-context' &&
      result.output.status === 'ready' &&
      elapsedMs < QA_SUMMARY_TIMEOUT_DEFAULT_MS &&
      cited &&
      distinctThemes &&
      !inventedNumber;
    process.stdout.write(
      JSON.stringify({
        locale,
        elapsedMs,
        execution: result.execution,
        status: result.output.status,
        statements,
        headings,
        cited,
        distinctThemes,
        inventedNumber,
        passed,
      }) + '\n',
    );
    if (!passed) process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
