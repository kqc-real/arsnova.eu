import {
  QA_SUMMARY_GROUPED_MAX_TOPIC_LENGTH,
  type AppLocale,
  type QaSummaryModelOutputV2,
} from '@arsnova/shared-types';
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
  it('wendet das längere Titellimit ausschließlich bei der gruppierten Kurzfassung an', () => {
    const summary = output([
      'Verschwinden von Kundinnen im LEFT JOIN bei Statusfilterung: Offen ist, wie sich der Join beim Filtern verhält.',
    ]);
    expect(hasAcceptableQaSummaryQuality(summary, 'de', 1)).toBe(false);
    expect(
      hasAcceptableQaSummaryQuality(summary, 'de', {
        minimumStatements: 1,
        maximumTopicLength: QA_SUMMARY_GROUPED_MAX_TOPIC_LENGTH,
      }),
    ).toBe(true);
  });

  it.each([
    {
      locale: 'de',
      questions: [
        'Wann muss die Hausarbeit eingereicht werden?',
        'Bis wann ist die Hausarbeit fällig?',
      ],
      summary: 'Abgabefrist: Offen ist, welche Abgabefrist für die Hausarbeit gilt.',
    },
    {
      locale: 'en',
      questions: ['When do we submit the term paper?', 'When is the term paper due?'],
      summary: 'Term paper: Participants want to clarify the deadline for the term paper.',
    },
    {
      locale: 'fr',
      questions: [
        'Quand faut-il rendre le dossier ?',
        'Quelle est la date limite pour rendre le dossier ?',
      ],
      summary: 'Remise du dossier: Le groupe souhaite clarifier la date limite du dossier.',
    },
    {
      locale: 'es',
      questions: [
        '¿Cuándo hay que entregar el trabajo?',
        '¿Cuál es la fecha límite de entrega del trabajo?',
      ],
      summary: 'Entrega del trabajo: El grupo quiere aclarar el plazo del trabajo.',
    },
    {
      locale: 'it',
      questions: [
        'Quando dobbiamo consegnare la relazione?',
        'Qual è la scadenza per consegnare la relazione?',
      ],
      summary: 'Consegna della relazione: Il gruppo vuole chiarire la scadenza della relazione.',
    },
  ] satisfies { locale: AppLocale; questions: string[]; summary: string }[])(
    'erkennt gleichbedeutende Abgabefristen ($locale)',
    ({ locale, questions, summary }) => {
      const sourceTextsById = new Map(questions.map((text, index) => [`source-${index}`, text]));
      const modelOutput = output([summary]);
      modelOutput.statements[0]!.sourceIds = [...sourceTextsById.keys()];
      expect(
        hasAcceptableQaSummaryQuality(modelOutput, locale, {
          minimumStatements: 1,
          checkGroupedQaCoverage: true,
          sourceTextsById,
          includedQaTextsById: sourceTextsById,
        }),
      ).toBe(true);
    },
  );

  it.each([
    [
      'Wann muss die Hausarbeit als Ausdruck eingereicht werden?',
      'Wann muss die Hausarbeit digital eingereicht werden?',
    ],
    ['Wann muss die Hausarbeit 1 eingereicht werden?', 'Bis wann ist die Hausarbeit 2 fällig?'],
    ['Wann kann die Hausarbeit eingereicht werden?', 'Bis wann ist die Hausarbeit fällig?'],
  ])('fordert konkrete Abgabebedingungen bei unterschiedlichen Anliegen (%s)', (first, second) => {
    const sourceTextsById = new Map([
      ['source-0', first],
      ['source-1', second],
    ]);
    const modelOutput = output([
      'Abgabefrist: Offen ist, welche Abgabefrist für die Hausarbeit gilt.',
    ]);
    modelOutput.statements[0]!.sourceIds = [...sourceTextsById.keys()];
    expect(
      hasAcceptableQaSummaryQuality(modelOutput, 'de', {
        minimumStatements: 1,
        checkGroupedQaCoverage: true,
        sourceTextsById,
        includedQaTextsById: sourceTextsById,
      }),
    ).toBe(false);
  });

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

  it('lehnt Aussagen ab, die Frage C zitieren, aber ohne Cluster-Abgleich ausschließlich Frage D paraphrasieren', () => {
    const questionC = 'Ist Kapitel 4 klausurrelevant?';
    const questionD = 'Müssen wir den vierten Abschnitt für die Prüfung lernen?';
    const sourceTextsById = new Map<string, string>([
      ['qa-question:c', questionC],
      ['qa-question:d', questionD],
    ]);

    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Klausurstoff: Müssen wir den vierten Abschnitt für die Prüfung lernen?',
              sourceIds: ['qa-question:c'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        {
          minimumStatements: 1,
          sourceTextsById,
          includedQaTextsById: sourceTextsById,
        },
      ),
    ).toBe(false);

    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Klausurstoff: Müssen wir den vierten Abschnitt für die Prüfung lernen?',
              sourceIds: ['qa-question:c', 'qa-question:d'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        {
          minimumStatements: 1,
          sourceTextsById,
          includedQaTextsById: sourceTextsById,
        },
      ),
    ).toBe(true);
  });

  it('akzeptiert wertgleiche Dezimal- und Tausenderformen bei strikter Trennung von bloßen Zahlen und Prozentwerten', () => {
    const sourceTextsById = new Map<string, string>([
      ['source-pct-int', 'Warum ist die Schwelle 80 %?'],
      ['source-pct-dec', 'Warum liegt das Konfidenzintervall bei 95,50 %?'],
      ['source-plain-int', 'Wir sind 80.0 Teilnehmende im Hörsaal — gibt es Zusatzplätze?'],
      ['source-chapter-one', 'Ist Kapitel 1 klausurrelevant?'],
      ['source-grouped-dec', 'Warum weicht der Schätzwert 1.234,50 so stark ab?'],
    ]);

    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Statistik: Warum ist die Schwelle 80.0%?',
              sourceIds: ['source-pct-int'],
            },
            {
              text: 'Konfidenzintervall: Warum liegt die Schwelle bei 95.5%?',
              sourceIds: ['source-pct-dec'],
            },
            {
              text: 'Schätzwert: Warum weicht der Wert 1234.5 so stark ab?',
              sourceIds: ['source-grouped-dec'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(true);

    // Bloße Zahl (80.0) darf auch in wertgleicher Dezimalschreibweise (80.0% / 80 %) keinen Prozentbezug erfinden:
    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Hörsaal: Warum sind 80.0% der Plätze belegt?',
              sourceIds: ['source-plain-int'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(false);

    // Kapitel 1 darf Tausendergruppierungen wie 1.000 nicht als Dezimalwert 1 freigeben:
    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Klausur: Sind 1.000 Punkte für das Bestehen nötig?',
              sourceIds: ['source-chapter-one'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(false);
  });

  it('erhält Vorzeichen bei negativen Kennzahlen und Prozent-Deltas ohne Bindestrich-Tokens oder Bereiche zu verfälschen', () => {
    const sourceTextsById = new Map<string, string>([
      ['source-neg-median', 'Released numeric summary\n4\n0\n-12.5\n-12.50\n2.5\n0%\n-25%'],
      ['source-pos-median', 'Released numeric summary\n4\n12.5\n2.5'],
      ['source-hyphen-range', 'Status 404 tritt in Kapitel 10-20 auf — woran liegt das?'],
    ]);

    // -12.5 erlaubt -12,50 / −12,5 und -25 % erlaubt -25,0 %, während HTTP-404 und 10 bis 20 vorzeichenneutral bleiben:
    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Schätzwert: Warum liegt der Median bei -12,50?',
              sourceIds: ['source-neg-median'],
            },
            {
              text: 'Rundenvergleich: Warum sank die Trefferquote um −25,0 %?',
              sourceIds: ['source-neg-median'],
            },
            {
              text: 'Fehlermeldung: Warum tritt HTTP-404 in Abschnitt 10 bis 20 auf?',
              sourceIds: ['source-hyphen-range'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(true);

    // Negativer Median -12.5 darf weder 12,5 noch +12,5 freigeben:
    for (const wrongSignStatement of [
      'Schätzwert: Warum liegt der Median bei 12,5?',
      'Schätzwert: Warum liegt der Median bei +12,5?',
      'Rundenvergleich: Warum stieg die Trefferquote um +25 %?',
    ]) {
      expect(
        hasAcceptableQaSummaryQuality(
          {
            status: 'ready',
            statements: [{ text: wrongSignStatement, sourceIds: ['source-neg-median'] }],
            suggestedNextSteps: [],
            limitations: [],
          },
          'de',
          { minimumStatements: 1, sourceTextsById },
        ),
      ).toBe(false);
    }

    // Umgekehrt darf positiver Median 12.5 kein negatives -12,5 freigeben:
    expect(
      hasAcceptableQaSummaryQuality(
        {
          status: 'ready',
          statements: [
            {
              text: 'Schätzwert: Warum liegt der Median bei -12,5?',
              sourceIds: ['source-pos-median'],
            },
          ],
          suggestedNextSteps: [],
          limitations: [],
        },
        'de',
        { minimumStatements: 1, sourceTextsById },
      ),
    ).toBe(false);
  });
});
