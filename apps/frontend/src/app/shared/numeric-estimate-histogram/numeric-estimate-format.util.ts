import { formatNumber } from '@angular/common';
import {
  resolveNumericEstimateToleranceMode,
  resolveNumericTolerance,
  type HostCurrentQuestionDTO,
} from '@arsnova/shared-types';

export function numericEstimateUsesIntegerFormat(question: HostCurrentQuestionDTO | null): boolean {
  return (
    question?.type === 'NUMERIC_ESTIMATE' &&
    (question.numericInputType === 'INTEGER' || question.numericDecimalPlaces === 0)
  );
}

export function numericEstimateUsesYearFormat(question: HostCurrentQuestionDTO | null): boolean {
  if (!numericEstimateUsesIntegerFormat(question) || question?.type !== 'NUMERIC_ESTIMATE') {
    return false;
  }
  const textLooksLikeYear =
    /\b(jahr|jahreszahl|year|année|annee|año|ano|anno)\b/i.test(question.text) ||
    /\bwann\b/i.test(question.text);
  if (textLooksLikeYear) {
    return true;
  }
  const min = question.numericMin;
  const max = question.numericMax;
  return (
    typeof min === 'number' &&
    typeof max === 'number' &&
    min >= 1000 &&
    max <= 2200 &&
    max - min <= 1000
  );
}

function numericEstimateFractionDigits(question: HostCurrentQuestionDTO | null): number {
  if (numericEstimateUsesIntegerFormat(question)) return 0;
  const places = question?.numericDecimalPlaces;
  return typeof places === 'number' && Number.isFinite(places)
    ? Math.max(0, Math.min(4, places))
    : 2;
}

export function formatNumericEstimateValue(
  value: number,
  question: HostCurrentQuestionDTO | null,
  locale: string,
  maximumFractionDigits = numericEstimateFractionDigits(question),
): string {
  if (numericEstimateUsesYearFormat(question)) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits, useGrouping: false }).format(
      value,
    );
  }
  return formatNumber(value, locale, `1.0-${maximumFractionDigits}`);
}

export function numericEstimateReferenceLabel(
  question: HostCurrentQuestionDTO | null,
  locale: string,
): string | null {
  if (
    question?.type !== 'NUMERIC_ESTIMATE' ||
    question.numericReferenceValue === null ||
    question.numericReferenceValue === undefined
  ) {
    return null;
  }
  return $localize`:@@sessionHost.numericReferenceAxisLabel:Referenz ${formatNumericEstimateValue(
    question.numericReferenceValue,
    question,
    locale,
  )}:reference:`;
}

export function numericEstimateToleranceLabel(
  question: HostCurrentQuestionDTO | null,
  locale: string,
): string | null {
  const band = numericEstimateToleranceBand(question);
  if (!band) return null;
  if (numericEstimateUsesIntegerFormat(question)) {
    const acceptedLeft = Math.ceil(band.left);
    const acceptedRight = Math.floor(band.right);
    if (acceptedLeft > acceptedRight) {
      return null;
    }
    if (acceptedLeft === acceptedRight) {
      return $localize`:@@sessionHost.numericAcceptedSingleLabel:Akzeptierter Wert ${formatNumericEstimateValue(
        acceptedLeft,
        question,
        locale,
      )}:value:`;
    }
    return $localize`:@@sessionHost.numericAcceptedRangeLabel:Akzeptierte Werte ${formatNumericEstimateValue(
      acceptedLeft,
      question,
      locale,
    )}:left: bis ${formatNumericEstimateValue(acceptedRight, question, locale)}:right:`;
  }
  return $localize`:@@sessionHost.numericToleranceBandLabel:Toleranzband ${formatNumericEstimateValue(
    band.left,
    question,
    locale,
  )}:left: bis ${formatNumericEstimateValue(band.right, question, locale)}:right:`;
}

export function numericEstimateToleranceBand(
  question: HostCurrentQuestionDTO | null,
): { left: number; right: number } | null {
  if (question?.type !== 'NUMERIC_ESTIMATE') return null;
  return resolveNumericTolerance(
    resolveNumericEstimateToleranceMode(question.numericToleranceMode),
    {
      referenceValue: question.numericReferenceValue ?? null,
      tolerancePercent: question.numericTolerancePercent ?? null,
      intervalLeft: question.numericIntervalLeft ?? null,
      intervalRight: question.numericIntervalRight ?? null,
    },
  );
}
