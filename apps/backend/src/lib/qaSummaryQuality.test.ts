import type { QaSummaryModelOutputV2 } from '@arsnova/shared-types';
import { describe, expect, it } from 'vitest';
import { hasAcceptableQaSummaryQuality } from './qaSummaryQuality';

function output(statements: string[]): QaSummaryModelOutputV2 {
  return {
    status: 'ready',
    statements: statements.map((text, index) => ({ text, sourceIds: [`source-${index}`] })),
    suggestedNextSteps: [],
    limitations: [],
  };
}

describe('hasAcceptableQaSummaryQuality', () => {
  it('akzeptiert mehrere unterscheidbare konkrete Themen', () => {
    expect(
      hasAcceptableQaSummaryQuality(
        output([
          'HTTP-Fehler: Der Umgang mit Status 404 ist noch offen.',
          'Verteilungsdiagramme: Die gewünschte Darstellung braucht Klärung.',
        ]),
        'de',
      ),
    ).toBe(true);
  });

  it.each([
    [['Nur eine Aussage ohne Verdichtung.'], 'zu wenige Aussagen'],
    [
      ['Beispiele: Weitere Anwendungsfälle werden gewünscht.', 'Beispiele: Noch mehr davon.'],
      'wiederholter generischer Lead',
    ],
    [
      ['Fragen: HTTP 404 ist noch offen.', 'Visualisierung: Die Verteilung ist unklar.'],
      'generischer Antwortformat-Lead',
    ],
    [
      [
        'ChatGPT-Grenzen: Die Frage hat eine hohe.',
        'Roter Faden: Die Erklärung zeigt eine hohe Konsistenz mit 248 positiven.',
      ],
      'unvollständige Sätze',
    ],
    [
      [
        'Auswahl: Einige Fragen wurden aufgrund des Budgets nicht berücksichtigt.',
        'Beispiele: Die Frage ist als PINNED-Status markiert.',
      ],
      'technische Metadaten',
    ],
    [
      [
        '**Beispiele:** Weitere Anwendungsfälle werden gewünscht.',
        'Visualisierung: Die Verteilung ist noch unklar.',
      ],
      'Markdown um einen generischen Lead',
    ],
    [
      [
        'Die Grenzen von ChatGPT bleiben unklar.',
        'Visualisierung: Die Verteilung ist noch unklar.',
      ],
      'fehlender Themen-Lead',
    ],
  ])('verwirft %s (%s)', (statements) => {
    expect(hasAcceptableQaSummaryQuality(output(statements), 'de')).toBe(false);
  });

  it('wendet die generischen Leads sprachspezifisch an', () => {
    expect(
      hasAcceptableQaSummaryQuality(
        output(['Examples: More cases are requested.', 'Charts: The distribution is unclear.']),
        'en',
      ),
    ).toBe(false);
  });
});
