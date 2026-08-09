import type { SessionExportDTO } from '@arsnova/shared-types';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { getSessionResultsReportLabelsForLocale } from './labels-locale.util';
import { buildSessionResultsReportHtml } from './session-results-report.util';

const LOCALES = ['de', 'en', 'fr', 'es', 'it'] as const;

function buildLongMatrixFixture(): SessionExportDTO {
  const matchingPairs = [
    'Proclamation of the republic after the constitutional end of the monarchy',
    'Signing of the Treaty of Versailles amid strong political protests',
    'Signature of the Weimar Constitution by President Friedrich Ebert',
    'Introduction of the Rentenmark to stabilise the national currency',
    'Massive Wall Street price collapse on the day known as Black Tuesday',
    'Appointment of the chancellor and the end of the democratic republic',
  ].map((right, index) => ({
    leftId: `left-${index}`,
    left: `${index + 1}. exceptionally long historical date label`,
    rightId: `right-${index}`,
    right,
  }));
  const categories = [
    { id: 'category-a', name: 'Enlightenment and rational civic responsibility' },
    { id: 'category-b', name: 'Storm and Stress literary movement' },
    { id: 'category-c', name: 'European Romanticism and the uncanny' },
  ];

  return {
    sessionId: '44444444-4444-4444-8444-444444444444',
    sessionCode: 'LAYOUT',
    quizName: 'Structured matrix layout regression',
    finishedAt: '2026-08-09T10:00:00.000Z',
    participantCount: 8,
    teamMode: false,
    questions: [
      {
        questionOrder: 0,
        questionTextShort: 'Put six long process descriptions into their correct order.',
        type: 'ORDERING',
        participantCount: 8,
        orderingItems: matchingPairs.map((pair, index) => ({
          id: `order-${index}`,
          text: pair.right,
        })),
        orderingStats: {
          totalVotes: 8,
          fullyCorrectCount: 4,
          commonSwaps: [],
          positionCounts: matchingPairs.flatMap((pair, itemIndex) =>
            matchingPairs.map((_, position) => ({
              position,
              itemId: `order-${itemIndex}`,
              itemText: pair.right,
              count: position === itemIndex ? 6 : position === (itemIndex + 1) % 6 ? 2 : 0,
            })),
          ),
        },
      },
      {
        questionOrder: 1,
        questionTextShort: 'Match each historical date with its complete event description.',
        type: 'MATCHING',
        participantCount: 8,
        matchingPairs,
        matchingStats: {
          totalVotes: 8,
          fullyCorrectCount: 4,
          pairHitRates: [],
          commonConfusions: [],
          selectionCounts: matchingPairs.flatMap((leftPair, leftIndex) =>
            matchingPairs.map((rightPair, rightIndex) => ({
              leftId: leftPair.leftId,
              left: leftPair.left,
              rightId: rightPair.rightId,
              right: rightPair.right,
              count: rightIndex === leftIndex ? 6 : rightIndex === (leftIndex + 1) % 6 ? 2 : 0,
            })),
          ),
        },
      },
      {
        questionOrder: 2,
        questionTextShort: 'Assign each work to its detailed literary category.',
        type: 'CATEGORIZATION',
        participantCount: 8,
        categories,
        categorizationItems: matchingPairs.map((pair, index) => ({
          id: `item-${index}`,
          text: pair.right,
          correctCategoryId: categories[index % categories.length].id,
        })),
        categorizationStats: {
          totalVotes: 8,
          fullyCorrectCount: 4,
          commonMisclassifications: [],
          itemCategoryCounts: matchingPairs.flatMap((pair, itemIndex) =>
            categories.map((category, categoryIndex) => ({
              itemId: `item-${itemIndex}`,
              itemText: pair.right,
              categoryId: category.id,
              categoryName: category.name,
              count:
                categoryIndex === itemIndex % categories.length ? 6 : categoryIndex === 0 ? 2 : 0,
            })),
          ),
        },
      },
    ],
  };
}

describe('strukturierte Ergebnismatrizen im A4-Layout', () => {
  it('hält Kopf-, Daten- und Legendenelemente in allen fünf Sprachen innerhalb ihrer Boxen', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
      await page.emulateMedia({ media: 'print' });
      const data = buildLongMatrixFixture();

      for (const locale of LOCALES) {
        const html = buildSessionResultsReportHtml(
          data,
          getSessionResultsReportLabelsForLocale(locale),
          { localeId: locale, generatedAt: '2026-08-09T10:00:00.000Z' },
        );
        await page.setContent(html, { waitUntil: 'load' });

        const layout = await page.locator('.report-structured-matrix').evaluateAll((matrices) =>
          matrices.flatMap((matrix, matrixIndex) => {
            const matrixRect = matrix.getBoundingClientRect();
            const table = matrix.querySelector('table');
            const tableRect = table?.getBoundingClientRect();
            const elements = matrix.querySelectorAll<HTMLElement>(
              'th, td, .report-structured-matrix-legend li, .report-structured-matrix-legend li > :last-child',
            );
            const violations: string[] = [];
            if (
              !tableRect ||
              tableRect.left < matrixRect.left - 1 ||
              tableRect.right > matrixRect.right + 1 ||
              tableRect.right > document.documentElement.clientWidth + 1
            ) {
              violations.push(`matrix-${matrixIndex}:table`);
            }
            elements.forEach((element, elementIndex) => {
              const rect = element.getBoundingClientRect();
              if (
                element.scrollWidth > element.clientWidth + 1 ||
                rect.left < matrixRect.left - 1 ||
                rect.right > matrixRect.right + 1
              ) {
                violations.push(`matrix-${matrixIndex}:element-${elementIndex}`);
              }
            });
            return violations;
          }),
        );

        expect(layout, `${locale}: ${layout.join(', ')}`).toEqual([]);
      }
    } finally {
      await browser.close();
    }
  }, 60_000);
});
