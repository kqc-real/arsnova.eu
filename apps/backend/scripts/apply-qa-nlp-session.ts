#!/usr/bin/env tsx
/**
 * Klassifiziert bestehende Q&A-Fragen einer Session mit dem Gatekeeper
 * und schreibt die NLP-Felder. Umgeht qa.submit, damit Seeds und Altbestand
 * ohne Neueinreichung aktualisiert werden können.
 *
 *   npm run apply:qa-nlp -w @arsnova/backend -- --code 3TVKXF
 */
import { format } from 'node:util';
import { prisma } from '../src/db';
import { classifyQaNlpSnapshot } from '../src/lib/qaNlpGatekeeper';
import { toQaNlpPersistFields } from '../src/lib/qaNlpResult';
import { buildQaNlpAnalysisSnapshot } from '../src/lib/qaNlpSnapshot';

function log(...values: unknown[]): void {
  process.stdout.write(`${format(...values)}\n`);
}

function parseCode(argv: readonly string[]): string {
  const index = argv.indexOf('--code');
  const raw = index >= 0 ? argv[index + 1] : process.env['SESSION_CODE'];
  const code = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('Bitte --code ABC123 (genau 6 Zeichen) angeben.');
  }
  return code;
}

async function main(): Promise<void> {
  const code = parseCode(process.argv.slice(2));
  const session = await prisma.session.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!session) {
    throw new Error(`Session ${code} nicht gefunden.`);
  }

  const questions = await prisma.qaQuestion.findMany({
    where: { sessionId: session.id, status: { not: 'DELETED' } },
    select: { id: true, text: true },
  });

  const counts = { classified: 0, uncertain: 0, failed: 0, other: 0 };
  for (const question of questions) {
    const result = classifyQaNlpSnapshot(buildQaNlpAnalysisSnapshot(question.text));
    await prisma.qaQuestion.update({
      where: { id: question.id },
      data: toQaNlpPersistFields(result),
    });
    if (result.status === 'classified' || result.status === 'uncertain') {
      counts[result.status] += 1;
    } else if (result.status === 'failed') {
      counts.failed += 1;
    } else {
      counts.other += 1;
    }
  }

  log(
    JSON.stringify(
      {
        code,
        questions: questions.length,
        ...counts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
