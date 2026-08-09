import { describe, expect, it } from 'vitest';
import type { SessionExportDTO } from '@arsnova/shared-types';
import { getSessionResultsReportLabelsDe } from './labels-de';
import { buildSessionResultsReportHtml } from './session-results-report.util';

describe('strukturierte Ergebnismatrizen im Session-Bericht', () => {
  it('rendert Sortierung, Zuordnung und Kategorisierung vollständig mit Nullzellen', () => {
    const data: SessionExportDTO = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      sessionCode: 'ABC123',
      quizName: 'Strukturformate',
      finishedAt: '2026-08-09T10:00:00.000Z',
      participantCount: 2,
      teamMode: false,
      questions: [
        {
          questionOrder: 0,
          questionTextShort: 'Sortiere',
          type: 'ORDERING',
          participantCount: 2,
          orderingItems: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
          orderingStats: {
            totalVotes: 2,
            fullyCorrectCount: 1,
            positionCounts: [
              { position: 0, itemId: 'a', itemText: 'A', count: 2 },
              { position: 1, itemId: 'b', itemText: 'B', count: 1 },
            ],
            commonSwaps: [],
          },
        },
        {
          questionOrder: 1,
          questionTextShort: 'Ordne zu',
          type: 'MATCHING',
          participantCount: 2,
          matchingPairs: [
            { leftId: 'left-a', left: 'A', rightId: 'right-1', right: '1' },
            { leftId: 'left-b', left: 'B', rightId: 'right-2', right: '2' },
          ],
          matchingStats: {
            totalVotes: 2,
            fullyCorrectCount: 1,
            pairHitRates: [],
            commonConfusions: [],
            selectionCounts: [
              { leftId: 'left-a', left: 'A', rightId: 'right-1', right: '1', count: 2 },
              { leftId: 'left-b', left: 'B', rightId: 'right-2', right: '2', count: 1 },
            ],
          },
        },
        {
          questionOrder: 2,
          questionTextShort: 'Kategorisiere',
          type: 'CATEGORIZATION',
          participantCount: 2,
          categories: [
            { id: 'cat-a', name: 'Kategorie A' },
            { id: 'cat-b', name: 'Kategorie B' },
          ],
          categorizationItems: [
            { id: 'item-a', text: 'Element A', correctCategoryId: 'cat-a' },
            { id: 'item-b', text: 'Element B', correctCategoryId: 'cat-b' },
          ],
          categorizationStats: {
            totalVotes: 2,
            fullyCorrectCount: 1,
            itemCategoryCounts: [
              {
                itemId: 'item-a',
                itemText: 'Element A',
                categoryId: 'cat-a',
                categoryName: 'Kategorie A',
                count: 2,
              },
              {
                itemId: 'item-b',
                itemText: 'Element B',
                categoryId: 'cat-b',
                categoryName: 'Kategorie B',
                count: 1,
              },
            ],
            commonMisclassifications: [],
          },
        },
      ],
    };

    const html = buildSessionResultsReportHtml(data, getSessionResultsReportLabelsDe(), {
      localeId: 'de',
      generatedAt: '2026-08-09T10:00:00.000Z',
    });

    expect(html).toContain('<caption>Gewählte Positionen</caption>');
    expect(html).toContain('<caption>Gewählte Zuordnungen</caption>');
    expect(html).toContain('<caption>Gewählte Kategorien</caption>');
    expect(html.match(/<td class="report-structured-matrix-cell--correct">/g)).toHaveLength(6);
    expect(html).toContain('0 (0\u202f%)');
    expect(html).toContain('2 (100\u202f%)');
    expect(html).toContain('✓ Musterlösung');
  });
});
