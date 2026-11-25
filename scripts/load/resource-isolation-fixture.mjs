#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import {
  ModerationPromptQuestionSchema,
  QaQuestionStatusEnum,
  SubmitQaQuestionInputSchema,
} from '@arsnova/shared-types';
import {
  buildResourceIsolationFixture,
  hashResourceIsolationFixture,
  serializeResourceIsolationFixture,
} from './lib/resource-isolation-fixture.mjs';

function parseArguments(args) {
  let mode;
  let seed;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--validate' || argument === '--print') {
      if (mode) throw new Error('Select exactly one mode: --validate or --print.');
      mode = argument;
    } else if (argument === '--seed') {
      const value = args[++index];
      if (seed !== undefined || !/^\d+$/.test(value ?? '')) {
        throw new Error('Provide --seed once, with an unsigned decimal 32-bit integer.');
      }
      seed = Number(value);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (!mode) throw new Error('Select exactly one mode: --validate or --print.');
  return { mode, seed };
}

function main(args) {
  const { mode, seed } = parseArguments(args);
  const fixture = buildResourceIsolationFixture(seed === undefined ? {} : { seed });
  for (const { context } of [...fixture.reference.questions, ...fixture.counterCases]) {
    ModerationPromptQuestionSchema.parse(context);
  }
  for (const question of [...fixture.analysis.questions, ...fixture.analysis.exclusionControls]) {
    SubmitQaQuestionInputSchema.shape.text.parse(question.text);
    QaQuestionStatusEnum.parse(question.status);
  }
  const eligible = fixture.analysis.questions;
  const uniqueAnalysisTexts = new Set(eligible.map(({ text }) => text)).size;
  if (
    eligible.length !== 500 ||
    uniqueAnalysisTexts !== 500 ||
    eligible.some(({ status }) => status !== 'ACTIVE' && status !== 'PINNED')
  ) {
    throw new Error('The A1 fixture requires exactly 500 distinct eligible question texts.');
  }
  const output =
    mode === '--print'
      ? serializeResourceIsolationFixture(fixture)
      : JSON.stringify(
          {
            mode: 'network-free-validation',
            fixtureVersion: fixture.fixtureVersion,
            seed: fixture.seed,
            sha256: hashResourceIsolationFixture(fixture),
            locale: fixture.locale,
            sharedArtifact: fixture.sharedArtifact,
            referenceQuestions: fixture.reference.questions.length,
            referenceParticipantCount: fixture.reference.participantBasis.value,
            counterCases: fixture.counterCases.length,
            eligibleQuestions: eligible.length,
            uniqueAnalysisTexts,
            exclusionControls: fixture.analysis.exclusionControls.length,
          },
          null,
          2,
        );
  process.stdout.write(`${output}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
