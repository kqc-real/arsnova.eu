import { describe, expect, it } from 'vitest';
import {
  QA_QUESTION_TEXT_MAX_CODE_POINTS,
  QA_REDACTION_CHAR,
  QA_REDACTION_MAX_OFFSET,
  QA_REDACTION_PLACEHOLDER_LEGACY,
  applyQaPassageRedaction,
  findQaRedactionSearchOccurrences,
  previewQaPassageRedaction,
  qaQuestionTextVersion,
  qaRedactionDialogTextIsCurrent,
  qaTextCodePointLength,
  qaTextCodePoints,
  qaTruncateToCodePoints,
} from './qa-redaction';
import { RedactQaPassagesInputSchema } from './schemas';

function blocks(count: number): string {
  return QA_REDACTION_CHAR.repeat(count);
}

describe('qa-redaction', () => {
  it('ersetzt mehrere disjunkte Stellen längenerhaltend und erhält Unicode-Codepunkte', () => {
    const text = 'Hallo 👩‍💻 Max und Max nochmal';
    const occurrences = findQaRedactionSearchOccurrences(text, 'Max');
    expect(occurrences).toHaveLength(2);
    const result = applyQaPassageRedaction(text, occurrences);
    expect(result).toEqual({
      ok: true,
      text: `Hallo 👩‍💻 ${blocks(3)} und ${blocks(3)} nochmal`,
    });
    expect(qaTextCodePoints(result.ok ? result.text : '').length).toBe(
      qaTextCodePoints(text).length,
    );
    expect(qaTextCodePoints(text).slice(0, 6).join('')).toBe('Hallo ');
  });

  it('erkennt veralteten Dialogtext gegenüber der Host-Liste', () => {
    const dialogText = 'Bitte Max anonymisieren';
    expect(qaRedactionDialogTextIsCurrent(dialogText, dialogText)).toBe(true);
    expect(qaRedactionDialogTextIsCurrent(dialogText, `Bitte ${blocks(3)} anonymisieren`)).toBe(
      false,
    );
  });

  it('lehnt Überlappungen und Platzhalter-Treffer ab', () => {
    const already = `Vor ${blocks(4)} nach`;
    const placeholderStart = qaTextCodePoints('Vor ').length;
    expect(
      applyQaPassageRedaction(already, [{ start: placeholderStart, end: placeholderStart + 2 }]).ok,
    ).toBe(false);
    expect(
      applyQaPassageRedaction(`Vor ${QA_REDACTION_PLACEHOLDER_LEGACY} nach`, [
        {
          start: qaTextCodePoints('Vor ').length,
          end: qaTextCodePoints('Vor ').length + 2,
        },
      ]).ok,
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
    expect(preview).toBe(`Anna kennt ${blocks(4)} und Anna`);
  });

  it('ändert die Textversion nur bei inhaltlicher Änderung', () => {
    expect(qaQuestionTextVersion('Anna')).toBe(qaQuestionTextVersion('Anna'));
    expect(qaQuestionTextVersion('Anna')).not.toBe(qaQuestionTextVersion('Max'));
  });

  it('hält die Textlänge beim Schwärzen und erlaubt Folge-Schwärzungen', () => {
    const original = 'a'.repeat(QA_QUESTION_TEXT_MAX_CODE_POINTS);
    const first = applyQaPassageRedaction(original, [
      { start: QA_QUESTION_TEXT_MAX_CODE_POINTS - 1, end: QA_QUESTION_TEXT_MAX_CODE_POINTS },
    ]);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(qaTextCodePoints(first.text).length).toBe(QA_QUESTION_TEXT_MAX_CODE_POINTS);
    expect(first.text.endsWith(QA_REDACTION_CHAR)).toBe(true);
    expect(QA_REDACTION_MAX_OFFSET).toBeGreaterThanOrEqual(QA_QUESTION_TEXT_MAX_CODE_POINTS);

    const secondRange = {
      start: QA_QUESTION_TEXT_MAX_CODE_POINTS - 2,
      end: QA_QUESTION_TEXT_MAX_CODE_POINTS - 1,
    };
    expect(
      RedactQaPassagesInputSchema.safeParse({
        sessionCode: 'ABC123',
        questionId: '11111111-1111-4111-8111-111111111111',
        expectedTextVersion: qaQuestionTextVersion(first.text),
        ranges: [secondRange],
      }).success,
    ).toBe(true);

    const second = applyQaPassageRedaction(first.text, [secondRange]);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(qaTextCodePoints(second.text).length).toBe(QA_QUESTION_TEXT_MAX_CODE_POINTS);
    expect(second.text.endsWith(`${QA_REDACTION_CHAR}${QA_REDACTION_CHAR}`)).toBe(true);
  });

  it('zählt und kürzt nach Unicode-Codepunkten ohne Surrogatpaare zu trennen', () => {
    expect(qaTextCodePointLength('😀'.repeat(3))).toBe(3);
    expect('😀'.repeat(3).length).toBe(6);
    expect(qaTruncateToCodePoints('😀'.repeat(5), 3)).toBe('😀'.repeat(3));
    expect(qaTruncateToCodePoints('ab😀cd', 3)).toBe('ab😀');
    expect(
      qaTruncateToCodePoints(
        'a'.repeat(QA_QUESTION_TEXT_MAX_CODE_POINTS + 5),
        QA_QUESTION_TEXT_MAX_CODE_POINTS,
      ).length,
    ).toBe(QA_QUESTION_TEXT_MAX_CODE_POINTS);
  });
});
