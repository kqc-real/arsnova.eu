import { describe, expect, it } from 'vitest';
import type { SessionExportDTO } from '@arsnova/shared-types';
import { getSessionResultsReportLabelsDe } from './labels-de';
import { SESSION_RESULTS_REPORT_STYLES } from './session-results-report-styles';
import { buildSessionResultsReportHtml } from './session-results-report.util';

describe('strukturierte Ergebnismatrizen im Session-Bericht', () => {
  it('hält die Matching-Legende beim Druck vollständig direkt vor der Matrix', () => {
    expect(SESSION_RESULTS_REPORT_STYLES).toMatch(
      /\.report-structured-matrix-legend\s*\{[\s\S]*?break-inside:\s*avoid;[\s\S]*?page-break-inside:\s*avoid;[\s\S]*?break-after:\s*avoid;[\s\S]*?page-break-after:\s*avoid;/,
    );
  });

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
    const matchingMatrix = html.match(
      /<section class="report-structured-matrix report-structured-matrix--matching">[\s\S]*?<\/section>/,
    )?.[0];
    expect(matchingMatrix).toContain(
      '<span class="report-structured-matrix-key" aria-label="A: 1">A</span>',
    );
    expect(matchingMatrix).toContain(
      '<span class="report-structured-matrix-legend-key" aria-hidden="true">B</span>',
    );
    expect((matchingMatrix ?? '').indexOf('report-structured-matrix-legend')).toBeLessThan(
      (matchingMatrix ?? '').indexOf('<table'),
    );
    expect(html).toContain('<span class="report-structured-pair-key" aria-label="A: 1">A</span>');
    expect(matchingMatrix).not.toContain('<th scope="col">1</th>');
    expect(matchingMatrix).not.toContain('<th scope="col">2</th>');
  });

  it('hält sechs lange Matching-Antworten mit Kurzkennungen und Legende lesbar', () => {
    const rightLabels = [
      'Ausrufung der Republik durch Philipp Scheidemann nach dem Ende der Monarchie',
      'Unterzeichnung des Versailler Vertrags unter deutschem Protest',
      'Inkrafttreten der Weimarer Reichsverfassung mit einem starken Reichspräsidenten',
      'Einführung der Rentenmark beendet die galoppierende Hyperinflation',
      'Börsenkrach in New York löst die weltweite Wirtschaftskrise aus',
      'Ernennung des Reichskanzlers leitet das Ende der demokratischen Republik ein',
    ];
    const matchingPairs = rightLabels.map((right, index) => ({
      leftId: `left-${index + 1}`,
      left: `${index + 1}. Datum`,
      rightId: `right-${index + 1}`,
      right,
    }));
    const data: SessionExportDTO = {
      sessionId: '22222222-2222-4222-8222-222222222222',
      sessionCode: 'ABC123',
      quizName: 'Lange Zuordnungen',
      finishedAt: '2026-08-09T10:00:00.000Z',
      participantCount: 2,
      teamMode: false,
      questions: [
        {
          questionOrder: 0,
          questionTextShort: 'Historische Ereignisse zuordnen',
          type: 'MATCHING',
          participantCount: 2,
          matchingPairs,
          matchingStats: {
            totalVotes: 2,
            fullyCorrectCount: 1,
            pairHitRates: [],
            commonConfusions: [],
            selectionCounts: matchingPairs.map((pair) => ({ ...pair, count: 2 })),
          },
        },
      ],
    };

    const html = buildSessionResultsReportHtml(data, getSessionResultsReportLabelsDe(), {
      localeId: 'de',
      generatedAt: '2026-08-09T10:00:00.000Z',
    });
    const matchingMatrix = html.match(
      /<section class="report-structured-matrix report-structured-matrix--matching report-structured-matrix--new-page">[\s\S]*?<\/section>/,
    )?.[0];
    const matchingHeader = matchingMatrix?.match(/<thead>[\s\S]*?<\/thead>/)?.[0];
    const matchingLegend = matchingMatrix?.match(
      /<ol class="report-structured-matrix-legend"[\s\S]*?<\/ol>/,
    )?.[0];

    expect(matchingHeader?.match(/report-structured-matrix-key/g)).toHaveLength(6);
    expect(matchingLegend?.match(/report-structured-matrix-legend-key/g)).toHaveLength(6);
    expect(SESSION_RESULTS_REPORT_STYLES).toMatch(
      /\.report-structured-matrix--new-page\s*\{[\s\S]*?break-before:\s*page;[\s\S]*?page-break-before:\s*always;/,
    );
    for (const [index, rightLabel] of rightLabels.entries()) {
      const key = String.fromCharCode(65 + index);
      expect(matchingHeader).toContain(`>${key}</span></th>`);
      expect(matchingHeader).not.toContain(`<th scope="col">${rightLabel}</th>`);
      expect(matchingLegend).toContain(`aria-hidden="true">${key}</span>`);
      expect(matchingLegend).toContain(rightLabel);
    }
  });
});
