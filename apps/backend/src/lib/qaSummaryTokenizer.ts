import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BPE, Tokenizer } from '@huggingface/tokenizers';
import type { ModerationPromptDomainContextV1 } from '@arsnova/shared-types';
import { groupedSummaryChatMessages } from './qaSummaryModelPrompt';

let tokenizer: Tokenizer | undefined;

export function countQwenSummaryTokens(text: string): number {
  if (!tokenizer) {
    const assets = resolve(__dirname, '../../assets/qa-summary');
    const model = JSON.parse(
      gunzipSync(readFileSync(resolve(assets, 'tokenizer.json.gz'))).toString(),
    );
    const config = JSON.parse(readFileSync(resolve(assets, 'tokenizer_config.json'), 'utf8'));
    // The GGUF qwen2 pre-tokenizer operates on the original UTF-8, even for decomposed Unicode.
    tokenizer = new Tokenizer({ ...model, normalizer: null }, config);
  }
  try {
    return tokenizer.encode(text, { add_special_tokens: false }).ids.length;
  } finally {
    // Do not keep fragments of private question texts in the global BPE cache.
    if (tokenizer.model instanceof BPE) tokenizer.model.clear_cache();
  }
}

export const QA_SUMMARY_QWEN_TOKENIZATION = {
  tokenizer: {
    method: 'exact-tokenizer',
    id: 'qwen3-4b-instruct-2507-bpe',
    version: 'aeb13307a71acd8f:gguf-chat-v1:tokenizers-js-0.2.0',
  },
  count(context: ModerationPromptDomainContextV1, instructionText: string, definitionText: string) {
    const messages = groupedSummaryChatMessages(context, instructionText, definitionText);
    // This is the pinned model's Jinja template for system/system/user without tools.
    const render = ({ role, content }: (typeof messages)[number]) =>
      `<|im_start|>${role}\n${content}<|im_end|>\n`;
    const instruction = render(messages[0]);
    const system = instruction + render(messages[1]);
    const instructionTokens = countQwenSummaryTokens(instruction);
    const systemTokens = countQwenSummaryTokens(system);
    const packedInputTokens = countQwenSummaryTokens(
      system + render(messages[2]) + '<|im_start|>assistant\n',
    );
    return {
      instructionTokens,
      definitionTokens: systemTokens - instructionTokens,
      dataTokens: packedInputTokens - systemTokens,
    };
  },
} as const;
