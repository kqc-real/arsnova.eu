// E3a: extractive algorithm applied directly to the repo's #456 reference context fixture.
import { writeFileSync } from 'node:fs';
import {
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  type ModerationPromptContextV1,
  type ModerationPromptSource,
} from '@arsnova/shared-types';
import { createExtractiveQaSummaryOutput } from '../../../../../apps/backend/src/lib/qaSummaryExtractive.ts';
import { EVIDENCE, environment } from './lib.ts';

const env = environment();
const ctx = MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1 as unknown as ModerationPromptContextV1;

function sourceLabel(source: ModerationPromptSource): string | undefined {
  if (source.kind === 'qa-question') {
    return source.content.state === 'included' ? source.content.text : undefined;
  }
  if ('label' in source) return source.label;
  if ('text' in source) return source.text;
  return undefined;
}

const sources = ctx.context.sources.map((source) => ({
  id: source.id,
  kind: source.kind,
  label: sourceLabel(source),
  state: source.kind === 'qa-question' ? source.content.state : undefined,
}));
const out = createExtractiveQaSummaryOutput(ctx);
const report = { env, inputSourceCount: sources.length, inputSources: sources, output: out };
writeFileSync(`${EVIDENCE}/E3/e3a-${env.commitShort}.json`, JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify({ inputSources: sources, output: out }, null, 1)}\n`);
