import { describe, expect, it } from 'vitest';
import {
  QA_SUMMARY_MIN_VISIBLE_QUESTIONS,
  canRequestQaSummary,
  countQaSummaryVisibleQuestions,
  isQaSummaryKeepableResultStatus,
  isQaSummaryVisibleQuestionStatus,
  shouldShowQaSummaryCard,
} from './qa-summary-visibility.js';

describe('qa-summary-visibility', () => {
  it('zählt nur PENDING, ACTIVE und PINNED', () => {
    expect(QA_SUMMARY_MIN_VISIBLE_QUESTIONS).toBe(3);
    expect(isQaSummaryVisibleQuestionStatus('ACTIVE')).toBe(true);
    expect(isQaSummaryVisibleQuestionStatus('ARCHIVED')).toBe(false);
    expect(
      countQaSummaryVisibleQuestions([
        { status: 'PENDING' },
        { status: 'ACTIVE' },
        { status: 'PINNED' },
        { status: 'ARCHIVED' },
        { status: 'DELETED' },
      ]),
    ).toBe(3);
  });

  it('hält pending und ready sichtbar, uncertain und failed nicht', () => {
    expect(isQaSummaryKeepableResultStatus('pending')).toBe(true);
    expect(isQaSummaryKeepableResultStatus('ready')).toBe(true);
    expect(isQaSummaryKeepableResultStatus('uncertain')).toBe(false);
    expect(isQaSummaryKeepableResultStatus('failed')).toBe(false);
  });

  it('zeigt die Karte nur mit Kill-Switch, konfiguriertem Endpunkt und genug Fragen', () => {
    expect(
      shouldShowQaSummaryCard({
        enabled: true,
        inferenceConfigured: true,
        visibleQuestionCount: 3,
      }),
    ).toBe(true);
    expect(
      shouldShowQaSummaryCard({
        enabled: true,
        inferenceConfigured: true,
        visibleQuestionCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldShowQaSummaryCard({
        enabled: true,
        inferenceConfigured: false,
        visibleQuestionCount: 5,
      }),
    ).toBe(false);
    expect(
      shouldShowQaSummaryCard({
        enabled: false,
        inferenceConfigured: true,
        visibleQuestionCount: 5,
      }),
    ).toBe(false);
  });

  it('behält pending und ready auch unter der Frageschwelle', () => {
    expect(
      shouldShowQaSummaryCard({
        enabled: true,
        inferenceConfigured: true,
        visibleQuestionCount: 1,
        resultStatus: 'ready',
      }),
    ).toBe(true);
    expect(
      shouldShowQaSummaryCard({
        enabled: true,
        inferenceConfigured: true,
        visibleQuestionCount: 0,
        resultStatus: 'pending',
      }),
    ).toBe(true);
    expect(
      shouldShowQaSummaryCard({
        enabled: true,
        inferenceConfigured: true,
        visibleQuestionCount: 0,
        resultStatus: 'uncertain',
      }),
    ).toBe(false);
  });

  it('erlaubt eine Anfrage nur bei konfiguriertem Endpunkt und mindestens drei Fragen', () => {
    expect(
      canRequestQaSummary({
        enabled: true,
        inferenceConfigured: true,
        visibleQuestionCount: 3,
      }),
    ).toBe(true);
    expect(
      canRequestQaSummary({
        enabled: true,
        inferenceConfigured: true,
        visibleQuestionCount: 2,
      }),
    ).toBe(false);
    expect(
      canRequestQaSummary({
        enabled: true,
        inferenceConfigured: false,
        visibleQuestionCount: 8,
      }),
    ).toBe(false);
  });
});
