import { describe, expect, it } from 'vitest';
import {
  QA_REDACTION_PLACEHOLDER,
  applyQaPassageRedaction,
  findQaRedactionSearchOccurrences,
  previewQaPassageRedaction,
  qaQuestionTextVersion,
  qaTextCodePoints,
} from './qa-redaction';

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
});
