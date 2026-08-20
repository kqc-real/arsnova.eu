import { describe, expect, it } from 'vitest';
import { sortQaSummaryStatementsByImportance, toQaSummaryScanBullet } from './qa-summary-scan.js';

describe('toQaSummaryScanBullet', () => {
  it('lässt vorhandene kurze Leads stehen', () => {
    expect(toQaSummaryScanBullet('Median: Formel und Berechnung sind unklar.')).toBe(
      'Median: Formel und Berechnung sind unklar.',
    );
  });

  it('macht die aktuellen Gemini-Protokolle zu Stichpunkten', () => {
    expect(
      toQaSummaryScanBullet(
        'Mehrere Teilnehmende bitten um zusätzliche Beispiele sowie eine erneute Erklärung von Kapitel 4 mitsamt Klausurrelevanz.',
      ),
    ).toBe('Kapitel 4: Beispiele sowie Wiederholung und Klausurrelevanz.');
    expect(
      toQaSummaryScanBullet(
        'Es gibt konkrete Fragen zur Berechnung des Medians und der dazu passenden Formel.',
      ),
    ).toBe('Median: Berechnung und Formel.');
    expect(
      toQaSummaryScanBullet(
        'Zudem wird diskutiert, wie Visualisierungen der Verteilung, Gruppenrollen und Validierungen die Planbarkeit der Übungen verbessern.',
      ),
    ).toBe('Übungen: Visualisierungen der Verteilung, Gruppenrollen und Validierungen.');
  });

  it('lässt zitierte Extraktfragen unangetastet', () => {
    expect(toQaSummaryScanBullet('„Kommt Kapitel 4 in der Klausur vor?“')).toBe(
      '„Kommt Kapitel 4 in der Klausur vor?“',
    );
  });

  it('lässt kurze Sätze unverändert', () => {
    expect(toQaSummaryScanBullet('Es gibt eine Frage zur Klausur.')).toBe(
      'Es gibt eine Frage zur Klausur.',
    );
  });

  it('schneidet nicht an Konjunktionen ab und lässt keine von-Kommas stehen', () => {
    expect(
      toQaSummaryScanBullet(
        'Kapitel 4: Es gibt mehrere Bitten um Praxisbeispiele und eine detailliertere Erklärung von, Klausurrelevanz.',
      ),
    ).toBe('Kapitel 4: Praxisbeispiele, Wiederholung und Klausurrelevanz.');
    expect(
      toQaSummaryScanBullet(
        'Ein Studierender fragt nach der genauen Formel und Berechnung des Medians.',
      ),
    ).toBe('Median: Formel und Berechnung.');
    expect(
      toQaSummaryScanBullet(
        'Es wird nach der Bedeutung und Visualisierung von Verteilungen, rechtzeitigem Feedback gefragt.',
      ),
    ).toBe('Visualisierung: Bedeutung von Verteilungen und rechtzeitiges Feedback.');
    expect(
      toQaSummaryScanBullet(
        'Übungen: Ein Teilnehmer bittet um mehr Orientierung und Planbarkeit bei den kommenden und.',
      ),
    ).toBe('Übungen: Mehr Orientierung und Planbarkeit.');
  });
});

describe('sortQaSummaryStatementsByImportance', () => {
  const first = 'qa-question:11111111-1111-4111-8111-111111111111';
  const second = 'qa-question:22222222-2222-4222-8222-222222222222';
  const third = 'qa-question:33333333-3333-4333-8333-333333333333';

  it('stellt Aussagen zur ranghöchsten Quelle nach vorn', () => {
    const sorted = sortQaSummaryStatementsByImportance(
      [
        { text: 'Übungen: Planbarkeit.', sourceIds: [third] },
        { text: 'Kapitel 4: Klausurrelevanz.', sourceIds: [second] },
        { text: 'Median: Formel.', sourceIds: [first] },
      ],
      [first, second, third],
    );
    expect(sorted.map((item) => item.text)).toEqual([
      'Median: Formel.',
      'Kapitel 4: Klausurrelevanz.',
      'Übungen: Planbarkeit.',
    ]);
  });

  it('nimmt bei gleichem Rang die Aussage mit mehr Quellen', () => {
    const sorted = sortQaSummaryStatementsByImportance(
      [
        { text: 'Einzelthema.', sourceIds: [first] },
        { text: 'Mehrfach genannt.', sourceIds: [first, second] },
      ],
      [first, second],
    );
    expect(sorted.map((item) => item.text)).toEqual(['Mehrfach genannt.', 'Einzelthema.']);
  });
});
