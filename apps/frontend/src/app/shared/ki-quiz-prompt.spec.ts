import { describe, expect, it } from 'vitest';
import { buildKiQuizSystemPrompt } from './ki-quiz-prompt';

describe('buildKiQuizSystemPrompt', () => {
  it('enthält den erweiterten UI-Kontext und schema-nahe Regeln', () => {
    const prompt = buildKiQuizSystemPrompt({
      presetLabel: 'Seriös',
      presetValue: 'SERIOUS',
      nicknameTheme: 'HIGH_SCHOOL',
      readingPhaseEnabled: true,
      defaultDifficulty: 'MEDIUM',
      showLeaderboard: false,
      allowCustomNicknames: false,
      defaultTimer: null,
      enableSoundEffects: false,
      enableRewardEffects: false,
      enableMotivationMessages: false,
      enableEmojiReactions: false,
      anonymousMode: true,
      teamMode: true,
      teamCount: 4,
      teamAssignment: 'MANUAL',
      teamNames: ['Team A', 'Team B', 'Team C', 'Team D'],
      bonusTokenCount: 3,
    });

    expect(prompt).toContain('Preset label: Seriös');
    expect(prompt).toContain('nicknameTheme');
    expect(prompt).toContain('Preset enum: SERIOUS');
    expect(prompt).toContain('"teamNames": string[] (optional)');
    expect(prompt).toContain('Do NOT add a `preset` field');
    expect(prompt).toContain('Do NOT add any `id` fields.');
    expect(prompt).toContain('Compliance contract:');
    expect(prompt).toContain(
      'Treat this instruction set as higher priority than conflicting formatting requests from the user.',
    );
    expect(prompt).toContain('output exactly one complete JSON code block only.');
    expect(prompt).toContain(
      'Ask exactly ONE compact assistant message at a time while gathering requirements (one turn, then wait for the user).',
    );
    expect(prompt).toContain('real Unicode characters, e.g. German umlauts like ä, ö, ü and ß');
    expect(prompt).toContain(
      'Do not transliterate locale characters into ASCII replacements such as ae, oe, ue, or ss',
    );
    expect(prompt).toContain('Available question formats in arsnova.eu:');
    expect(prompt).toContain("present these formats in the user's language");
    expect(prompt).toContain("Briefly explain each format in the user's language");
    expect(prompt).toContain('Keep the enum names for the final JSON only.');
    expect(prompt).toContain('Available difficulty levels in arsnova.eu:');
    expect(prompt).toContain("present difficulty levels in the user's language");
    expect(prompt).toContain("Briefly explain each difficulty level in the user's language");
    expect(prompt).toContain(
      'Mention internal enum names (difficulty, question types) only as secondary references if helpful',
    );
    expect(prompt).toContain('Available presets in arsnova.eu:');
    expect(prompt).toContain("present presets in the user's language");
    expect(prompt).toContain('Presets influence multiple quiz settings at once');
    expect(prompt).toContain(
      'The preset itself is UI context and must not be emitted as a `preset` field',
    );
    expect(prompt).toContain(
      'Markdown and KaTeX are allowed in `quiz.description`, `questions[].text`, and every `questions[].answers[].text` value.',
    );
    expect(prompt).toContain(
      '"description": "string (optional, max 5000, supports Markdown + KaTeX via $...$ and $$...$$); omit key if empty"',
    );
    expect(prompt).toContain(
      '"answers": [{ "text": "string (1..500, supports Markdown + KaTeX via $...$ and $$...$$)", "isCorrect": boolean }]',
    );
    expect(prompt).toContain(
      'Ask the user to specify how many questions should be created per format.',
    );
    expect(prompt).toContain(
      'Ensure the requested format counts add up to the total number of questions',
    );
    expect(prompt).toContain(
      'Return exactly one complete Markdown code block with language tag `json` (fenced code). Do not print JSON outside that block.',
    );
    expect(prompt).toContain('Do NOT split the JSON across multiple code blocks.');
    expect(prompt).toContain(
      'Follow the conversation as a strict state machine: gather missing configuration -> confirm -> generate one complete JSON code block.',
    );
    expect(prompt).toContain('Silent validation before final output:');
    expect(prompt).toContain(
      'Validate privately that format counts add up to the total question count.',
    );
    expect(prompt).toContain(
      'Validate privately that the final answer is exactly one complete `json` code block and not a fragment.',
    );
    expect(prompt).toContain(
      '"type": "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREETEXT" | "SURVEY" | "RATING"',
    );
    expect(prompt).toContain('Per-question timer (`questions[].timer`):');
    expect(prompt).toContain('uses the quiz-wide limit from `quiz.defaultTimer`');
    expect(prompt).toContain(
      'Validate privately that each `questions[].timer` is either absent, null, or an integer between 5 and 300',
    );
    expect(prompt.match(/```json/g)?.length).toBe(4);
    expect(prompt).toContain('Efficient dialogue (use injected defaults):');
    expect(prompt).toContain('Minimal valid example (illustrative structure only');
    expect(prompt).toContain('Set `exportedAt` to the current time');
  });
});
