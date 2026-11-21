import type { QaSummaryModelOutputV2 } from '@arsnova/shared-types';
import { describe, expect, it } from 'vitest';
import { hasAcceptableQaSummaryQuality } from './qaSummaryQuality';

function output(
  statements: string[],
  status: QaSummaryModelOutputV2['status'] = 'ready',
): QaSummaryModelOutputV2 {
  return {
    status,
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

  it('behandelt Bindestriche innerhalb eines Themen-Leads nicht als Trennzeichen', () => {
    expect(
      hasAcceptableQaSummaryQuality(
        output([
          'HTTP-Fehler: Der Umgang mit Status 404 ist noch offen.',
          'HTTP-Statuscodes: Die Bedeutung der Statusgruppen braucht Klärung.',
        ]),
        'de',
      ),
    ).toBe(true);
  });

  it('akzeptiert Fachthemen über Tokens, Budgets und Abstimmungen', () => {
    expect(
      hasAcceptableQaSummaryQuality(
        output([
          'Tokenisierung: Wie aus Text einzelne Tokens entstehen, ist noch offen.',
          'Cloud-Budget: Die Kostenplanung für den Kurs braucht eine Erläuterung.',
          'Abstimmung: 48 positive und 12 negative Stimmen sollen fachlich verglichen werden.',
        ]),
        'de',
      ),
    ).toBe(true);
  });

  it('prüft dieselben fehlerhaften Aussagen bei ready und uncertain', () => {
    const statements = [
      'ChatGPT-Grenzen: Die Frage hat eine hohe.',
      'Auswahl: Einige Fragen wurden aufgrund des Budgets nicht berücksichtigt.',
    ];
    expect(hasAcceptableQaSummaryQuality(output(statements, 'ready'), 'de')).toBe(false);
    expect(hasAcceptableQaSummaryQuality(output(statements, 'uncertain'), 'de')).toBe(false);
  });

  it('lässt ein leeres uncertain-Ergebnis für die vorgesehene Unsicherheitsanzeige zu', () => {
    expect(hasAcceptableQaSummaryQuality(output([], 'uncertain'), 'de')).toBe(true);
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

  it.each([
    [
      'de',
      'Klausurrelevanz: Ist Kapitel 4 klausurrelevant?',
      'Ist Kapitel 4 klausurrelevant?',
      'Anwesenheit: Sind 80 % der Stimmen dagegen?',
      'Soll die Anwesenheit verpflichtend sein?',
    ],
    [
      'en',
      'Exam scope: Is chapter 4 relevant for the exam?',
      'Is chapter 4 relevant for the exam?',
      'Attendance: Did 80 percent reject mandatory attendance?',
      'Should attendance be mandatory?',
    ],
    [
      'fr',
      'Examen: Le chapitre 4 est-il au programme ?',
      'Le chapitre 4 est-il au programme ?',
      'Présence: Y a-t-il 80\u202f% d’avis négatifs ?',
      'La présence doit-elle être obligatoire ?',
    ],
    [
      'es',
      'Examen: ¿Entra el capítulo 4 en el examen?',
      '¿Entra el capítulo 4 en el examen?',
      'Asistencia: ¿Hay un 80 por ciento en contra?',
      '¿Debería ser obligatoria la asistencia?',
    ],
    [
      'it',
      'Esame: Il capitolo 4 è rilevante per l’esame?',
      'Il capitolo 4 è rilevante per l’esame?',
      'Presenza: Ci sono l’80 per cento di voti contrari?',
      'La presenza dovrebbe essere obbligatoria?',
    ],
  ] as const)(
    'prüft Zahlen- und Prozent-Grounding gegen die zitierten Quellen in %s',
    (locale, groundedStatement, groundedSource, ungroundedStatement, ungroundedSource) => {
      const sourceTextsById = new Map<string, string>([
        ['source-0', groundedSource],
        ['source-1', ungroundedSource],
      ]);

      expect(
        hasAcceptableQaSummaryQuality(
          {
            status: 'ready',
            statements: [{ text: groundedStatement, sourceIds: ['source-0'] }],
            suggestedNextSteps: [],
            limitations: [],
          },
          locale,
          { minimumStatements: 1, sourceTextsById },
        ),
      ).toBe(true);

      expect(
        hasAcceptableQaSummaryQuality(
          {
            status: 'ready',
            statements: [
              { text: groundedStatement, sourceIds: ['source-0'] },
              { text: ungroundedStatement, sourceIds: ['source-1'] },
            ],
            suggestedNextSteps: [],
            limitations: [],
          },
          locale,
          { minimumStatements: 1, sourceTextsById },
        ),
      ).toBe(false);
    },
  );

  it('lehnt Prozentbehauptungen ab, wenn die Quelle nur eine bloße Zahl ohne Prozentbezug trägt', () => {
    const sourceTextsById = new Map<string, string>([
      ['source-0', 'Wir sind 80 Studierende im Hörsaal — gibt es Tutorien?'],
      ['source-1', 'Warum liegt das Konfidenzintervall bei 95,5 %?'],
    ]);

    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            { text: 'Tutorien: Warum bewerten 80 % die Übung kritisch?', sourceIds: ['source-0'] },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(false);

    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Konfidenzintervall: Warum liegt die Schwelle bei 95.5%?',
              sourceIds: ['source-1'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(true);
  });

  it('lehnt Zahlen aus einer nicht zitierten Quelle sowie ungeerdete Zahlen in suggestedNextSteps ab', () => {
    const sourceTextsById = new Map<string, string>([
      ['source-chapter', 'Ist Kapitel 4 klausurrelevant?'],
      ['source-attendance', 'Soll die Anwesenheit verpflichtend sein?'],
    ]);

    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Klausurstoff: Ist Kapitel 4 klausurrelevant?',
              sourceIds: ['source-attendance'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(false);

    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Anwesenheit: Soll die Anwesenheit verpflichtend sein?',
              sourceIds: ['source-attendance'],
            },
          ],
          suggestedNextSteps: [
            {
              text: 'Die 40 positiven und 40 negativen Stimmen im Plenum einordnen.',
              sourceIds: ['source-attendance'],
            },
          ],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(false);
  });
});
