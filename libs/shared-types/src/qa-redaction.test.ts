import { describe, expect, it } from 'vitest';
import {
  QA_QUESTION_TEXT_MAX_CODE_POINTS,
  QA_REDACTION_MAX_OFFSET,
  QA_REDACTION_PLACEHOLDER,
  applyQaPassageRedaction,
  findQaRedactionSearchOccurrences,
  previewQaPassageRedaction,
  qaQuestionTextVersion,
  qaTextCodePoints,
} from './qa-redaction';
import { RedactQaPassagesInputSchema } from './schemas';

describe('qa-redaction', () => {
  it('ersetzt mehrere disjunkte Stellen und erhält Unicode-Codepunkte', () => {
    const text = 'Hallo 👩‍💻 Max und Max nochmal';
    const occurrences = findQaRedactionSearchOccurrences(text, 'Max');
    expect(occurrences).toHaveLength(2);
    const result = applyQaPassageRedaction(text, occurrences);
    expect(result).toEqual({
      ok: true,
      text: `Hallo 👩‍💻 ${QA_REDACTION_PLACEHOLDER} und ${QA_REDACTION_PLACEHOLDER} nochmal`,
    });
    expect(qaTextCodePoints(text).slice(0, 6).join('')).toBe('Hallo ');
  });

  it('lehnt Überlappungen und Platzhalter-Treffer ab', () => {
    const already = `Vor ${QA_REDACTION_PLACEHOLDER} nach`;
    const placeholderStart = qaTextCodePoints('Vor ').length;
    expect(
      applyQaPassageRedaction(already, [{ start: placeholderStart, end: placeholderStart + 2 }]).ok,
    ).toBe(false);
    expect(
      applyQaPassageRedaction('abcdef', [
        { start: 0, end: 3 },
        { start: 2, end: 5 },
      ]).ok,
    ).toBe(false);
  });

  it('findet nur die gewählte Fundstelle bei mehrfach identischem Text', () => {
    const text = 'Anna kennt Anna und Anna';
    const occurrences = findQaRedactionSearchOccurrences(text, 'Anna');
    expect(occurrences).toEqual([
      { start: 0, end: 4 },
      { start: 11, end: 15 },
      { start: 20, end: 24 },
    ]);
    const preview = previewQaPassageRedaction(text, [occurrences[1]!]);
    expect(preview).toBe(`Anna kennt ${QA_REDACTION_PLACEHOLDER} und Anna`);
  });

  it('ändert die Textversion nur bei inhaltlicher Änderung', () => {
    expect(qaQuestionTextVersion('Anna')).toBe(qaQuestionTextVersion('Anna'));
    expect(qaQuestionTextVersion('Anna')).not.toBe(qaQuestionTextVersion('Max'));
  });

  it('erlaubt eine zweite Schwärzung hinter dem ursprünglichen 500er-Limit', () => {
    const original = 'a'.repeat(QA_QUESTION_TEXT_MAX_CODE_POINTS);
    const first = applyQaPassageRedaction(original, [
      { start: QA_QUESTION_TEXT_MAX_CODE_POINTS - 1, end: QA_QUESTION_TEXT_MAX_CODE_POINTS },
    ]);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const grownLength = qaTextCodePoints(first.text).length;
    expect(grownLength).toBeGreaterThan(QA_QUESTION_TEXT_MAX_CODE_POINTS);
    expect(grownLength).toBeLessThanOrEqual(QA_REDACTION_MAX_OFFSET);

    // Letztes Originalzeichen vor dem Platzhalter (nicht der Platzhalter selbst).
    const secondRange = {
      start: QA_QUESTION_TEXT_MAX_CODE_POINTS - 2,
      end: QA_QUESTION_TEXT_MAX_CODE_POINTS - 1,
    };
    expect(secondRange.end).toBeGreaterThan(490);
    expect(
      RedactQaPassagesInputSchema.safeParse({
        sessionCode: 'ABC123',
        questionId: '11111111-1111-4111-8111-111111111111',
        expectedTextVersion: qaQuestionTextVersion(first.text),
        ranges: [{ start: grownLength - 1, end: grownLength }],
      }).success,
    ).toBe(true);

    const second = applyQaPassageRedaction(first.text, [secondRange]);
    expect(second.ok).toBe(true);
  });
});
