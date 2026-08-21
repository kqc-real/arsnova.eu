import { describe, expect, it } from 'vitest';
import {
  findNextUnskippedQuestionIndex,
  findFollowingQuestionIndex,
  findPreviousIncludedQuestionIndex,
  getSessionQuestionProgressSummary,
  markSessionQuestionCompleted,
  markSessionQuestionOpened,
  markSessionQuestionSkipped,
} from './sessionQuestionProgress';

const questions = [
  { id: '00000000-0000-4000-8000-000000000001', order: 0 },
  { id: '00000000-0000-4000-8000-000000000002', order: 1 },
  { id: '00000000-0000-4000-8000-000000000003', order: 2 },
  { id: '00000000-0000-4000-8000-000000000004', order: 3 },
];

describe('sessionQuestionProgress', () => {
  it('nimmt bei vollständigem Verlauf nur geöffnete und abgeschlossene Fragen auf', () => {
    const openedAt = new Date('2026-08-10T12:00:00.000Z');
    let progress = markSessionQuestionOpened({}, questions[1].id, openedAt);
    progress = markSessionQuestionCompleted(progress, questions[1].id, openedAt);
    progress = markSessionQuestionOpened(progress, questions[2].id, openedAt);
    progress = markSessionQuestionSkipped(progress, questions[2].id, openedAt);
    progress = markSessionQuestionOpened(progress, questions[3].id, openedAt);

    const summary = getSessionQuestionProgressSummary(questions, progress, true);

    expect([...summary.includedQuestionIds]).toEqual([questions[1].id, questions[3].id]);
    expect(summary).toMatchObject({
      totalQuestionCount: 4,
      conductedQuestionCount: 2,
      skippedQuestionCount: 1,
      startQuestionOrder: 2,
    });
  });

  it('behält für unvollständige Legacy-Verläufe die Vorlage bei und entfernt explizite Skips', () => {
    const progress = markSessionQuestionSkipped({}, questions[2].id, new Date());
    const summary = getSessionQuestionProgressSummary(questions, progress, false);

    expect([...summary.includedQuestionIds]).toEqual([
      questions[0].id,
      questions[1].id,
      questions[3].id,
    ]);
  });

  it('überspringt ausgelassene und optional eine bereits geöffnete Frage bei Vorwärtsnavigation', () => {
    const at = new Date();
    let progress = markSessionQuestionOpened({}, questions[1].id, at);
    progress = markSessionQuestionSkipped(progress, questions[2].id, at);
    progress = markSessionQuestionOpened(progress, questions[3].id, at);

    expect(findNextUnskippedQuestionIndex(questions, progress, 0)).toBe(1);
    expect(findNextUnskippedQuestionIndex(questions, progress, 0, 1)).toBe(3);
  });

  it('navigiert rückwärts nur zu fachlich enthaltenen Fragen', () => {
    const at = new Date();
    let progress = markSessionQuestionOpened({}, questions[0].id, at);
    progress = markSessionQuestionSkipped(progress, questions[1].id, at);
    progress = markSessionQuestionOpened(progress, questions[2].id, at);

    expect(findPreviousIncludedQuestionIndex(questions, progress, true, 2)).toBe(0);
    expect(findPreviousIncludedQuestionIndex(questions, progress, true, 0)).toBeNull();
    expect(findPreviousIncludedQuestionIndex(questions, progress, true, 2)).not.toBe(1);
  });

  it('findet keine Vorgängerfrage, wenn die erste durchgeführte Frage nicht order 0 ist', () => {
    const at = new Date();
    const progress = markSessionQuestionOpened(
      markSessionQuestionSkipped({}, questions[0].id, at),
      questions[1].id,
      at,
    );

    expect(findPreviousIncludedQuestionIndex(questions, progress, true, 1)).toBeNull();
  });

  it('behandelt nie geöffnete Fragen vor einem späteren Start wie nicht enthalten', () => {
    const at = new Date();
    const progress = markSessionQuestionOpened({}, questions[2].id, at);

    expect(findPreviousIncludedQuestionIndex(questions, progress, true, 2)).toBeNull();
    expect(findFollowingQuestionIndex(questions, progress, true, 2, false)).toBe(3);
    expect(findFollowingQuestionIndex(questions, progress, true, 3, false)).toBeNull();
  });

  it('unterscheidet die nächste Frage vom Weiter nach einem Ergebnis-Rückblick', () => {
    const at = new Date();
    let progress = markSessionQuestionCompleted({}, questions[0].id, at);
    progress = markSessionQuestionCompleted(progress, questions[1].id, at);
    progress = markSessionQuestionCompleted(progress, questions[2].id, at);
    progress = markSessionQuestionCompleted(progress, questions[3].id, at);

    expect(findFollowingQuestionIndex(questions, progress, true, 0, false)).toBe(1);
    expect(findFollowingQuestionIndex(questions, progress, true, 1, false)).toBe(2);
    expect(findFollowingQuestionIndex(questions, progress, true, 3, false)).toBeNull();
    expect(findFollowingQuestionIndex(questions, progress, true, 1, true)).toBe(3);
    expect(findFollowingQuestionIndex(questions, progress, true, 2, true)).toBeNull();
    expect(findFollowingQuestionIndex(questions, progress, true, 3, true)).toBeNull();
  });
});
