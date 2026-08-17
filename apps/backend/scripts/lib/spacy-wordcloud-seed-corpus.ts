import { SHORT_TEXT_MAX_LENGTH_LIMIT, WORD_CLOUD_MAX_ANALYZE_ITEMS } from '@arsnova/shared-types';

/** Analyse-Cap der lexikalischen Wortwolke; Default für lokale spaCy-UI-Tests. */
export const SPACY_WORDCLOUD_SEED_ITEM_COUNT = WORD_CLOUD_MAX_ANALYZE_ITEMS;
export const SPACY_WORDCLOUD_SEED_ITEM_CHARS = SHORT_TEXT_MAX_LENGTH_LIMIT;
export const SPACY_WORDCLOUD_SEED_PARTICIPANT_COUNT = 250;

type SeedFamily = {
  readonly name: string;
  readonly weight: number;
  readonly unigrams: readonly string[];
  readonly phrases: readonly string[];
  readonly sentences: readonly string[];
};

const FREETEXT_FAMILIES: readonly SeedFamily[] = [
  {
    name: 'beispiel',
    weight: 10,
    unigrams: ['Beispiel', 'Beispiele', 'Beispielen', 'Beispiels'],
    phrases: [
      'konkrete Beispiele',
      'gute Beispiele',
      'Beispiele aus der Praxis',
      'mit Beispielen üben',
      'ein anschauliches Beispiel',
    ],
    sentences: [
      'Mir helfen konkrete Beispiele mehr als lange Theorie.',
      'Bei neuen Themen brauche ich Beispiele und Gegenbeispiele.',
      'Mit Beispielen aus dem Projektalltag bleibt der Stoff greifbar.',
    ],
  },
  {
    name: 'uebung',
    weight: 8,
    unigrams: ['Übung', 'Übungen', 'Übungsteil'],
    phrases: [
      'kurze Übungen',
      'mehr Übungen',
      'Übungen mit Lösungsweg',
      'die nächste Übung',
      'gezieltes Üben',
    ],
    sentences: [
      'Kurze Übungen direkt nach der Erklärung festigen das Gelernte.',
      'Ohne Übungen vergesse ich die Schritte bis zur nächsten Sitzung.',
      'Die Übung war klarer als die Folien zur gleichen Frage.',
    ],
  },
  {
    name: 'feedback',
    weight: 8,
    unigrams: ['Feedback', 'Rückmeldung', 'Rückmeldungen'],
    phrases: [
      'schnelles Feedback',
      'konstruktives Feedback',
      'Feedback zur Übung',
      'klare Rückmeldungen',
      'Rückmeldung zum Zwischenergebnis',
    ],
    sentences: [
      'Schnelles Feedback zur Übung verhindert, dass sich Fehler festsetzen.',
      'Rückmeldungen zu Zwischenergebnissen helfen mehr als eine Note am Ende.',
      'Ohne Rückmeldung weiß ich nicht, ob mein Beispiel tragfähig war.',
    ],
  },
  {
    name: 'visualisierung',
    weight: 7,
    unigrams: ['Visualisierung', 'Visualisierungen'],
    phrases: [
      'klare Visualisierung',
      'Visualisierung der Verteilung',
      'gute Visualisierungen',
      'Skizze und Visualisierung',
    ],
    sentences: [
      'Eine klare Visualisierung macht Zusammenhänge schneller sichtbar.',
      'Visualisierungen ersetzen keine Erklärung, aber sie stützen sie.',
      'Die Visualisierung der Verteilung hat mir den Ausreißer erklärt.',
    ],
  },
  {
    name: 'erklaerung',
    weight: 7,
    unigrams: ['Erklärung', 'Erklärungen', 'Erklärungsweg'],
    phrases: [
      'kurze Erklärung',
      'klare Erklärungen',
      'Erklärung mit Beispiel',
      'schrittweise Erklärung',
    ],
    sentences: [
      'Kurze Erklärungen mit einem Beispiel bleiben besser hängen.',
      'Die Erklärung war nach der zweiten Wiederholung endlich greifbar.',
      'Ohne Erklärung der Begriffe bleiben die Übungen rätselhaft.',
    ],
  },
  {
    name: 'lernen-pause-faden',
    weight: 7,
    unigrams: ['Lernen', 'Pause', 'Pausen', 'Faden'],
    phrases: [
      'beim Lernen',
      'kurze Pausen',
      'Pausen zwischen Themen',
      'verliere den Faden',
      'roter Faden',
    ],
    sentences: [
      'Das hilft beim Lernen, besonders nach einer kurzen Pause.',
      'Kurze Pausen helfen, den Faden nicht zu verlieren.',
      'Ohne roten Faden verliere ich beim Lernen schnell die Orientierung.',
    ],
  },
  {
    name: 'frage',
    weight: 6,
    unigrams: ['Frage', 'Fragen'],
    phrases: ['offene Fragen', 'eine klare Frage', 'Fragen im Q&A', 'Rückfragen zur Übung'],
    sentences: [
      'Offene Fragen sollten sichtbar bleiben, bis sie beantwortet sind.',
      'Eine gute Frage klärt mehr als drei ungenaue Nachfragen.',
      'Live-Fragen im Q&A ersetzen die leise Unsicherheit in der letzten Reihe.',
    ],
  },
  {
    name: 'praxis-gruppe',
    weight: 6,
    unigrams: ['Praxisbezug', 'Gruppenarbeit', 'Transfer'],
    phrases: [
      'klarer Praxisbezug',
      'Transfer in die Praxis',
      'Rollen in der Gruppenarbeit',
      'Zusammenarbeit im Team',
    ],
    sentences: [
      'Praxisbezug und Transfer helfen, die Übung nicht als Selbstzweck zu sehen.',
      'In der Gruppenarbeit brauche ich klare Rollen und ein gemeinsames Beispiel.',
      'Ohne Praxisbezug bleibt die Visualisierung eine schöne, aber leere Folie.',
    ],
  },
  {
    name: 'validierung',
    weight: 5,
    unigrams: ['Validierung', 'validieren', 'validiert'],
    phrases: ['Ergebnisse validieren', 'Validierung der Schätzung', 'kritisch validiert'],
    sentences: [
      'Wir sollten Ergebnisse validieren, bevor wir die Visualisierung zeigen.',
      'Die Validierung macht die Prognose glaubwürdiger als ein einzelnes Beispiel.',
      'Ein validiertes Modell braucht trotzdem noch eine klare Erklärung.',
    ],
  },
  {
    name: 'propn-tech',
    weight: 4,
    unigrams: ['Moodle', 'ChatGPT', 'Berlin', 'C++', 'arsnova.eu'],
    phrases: ['HTTP 404', 'C++ Beispiel', 'Fragen in Moodle', 'Grenzen von ChatGPT'],
    sentences: [
      'ChatGPT liefert Entwürfe, die Validierung bleibt bei uns.',
      'Ein HTTP 404 in Moodle stoppt die Übung härter als eine unklare Erklärung.',
      'C++ Beispiele brauchen eine langsamere Erklärung als die Folie suggeriert.',
    ],
  },
  {
    name: 'zahlen',
    weight: 3,
    unigrams: ['3 Beispiele', 'zwei Übungen', '10 Minuten'],
    phrases: ['3 konkrete Beispiele', 'zwei kurze Übungen', '10 Minuten Pause'],
    sentences: [
      'Drei Beispiele und zwei Übungen reichen oft für den Einstieg.',
      'Nach 10 Minuten Pause bleibt der Faden besser erhalten.',
      'Zwei Übungen mit Feedback schlagen zehn Folien ohne Rückmeldung.',
    ],
  },
  {
    name: 'keine-semantik',
    weight: 4,
    unigrams: ['Struktur', 'Aufbau', 'Motivation', 'Lernfreude'],
    phrases: ['klare Struktur', 'klarer Aufbau', 'mehr Motivation', 'echte Lernfreude'],
    sentences: [
      'Struktur und Aufbau sind verwandt, fallen in der Wolke aber getrennt.',
      'Motivation allein ersetzt keine Übung und kein Beispiel.',
      'Lernfreude entsteht bei mir durch Feedback, nicht durch Tempo.',
    ],
  },
  {
    name: 'stoppwort-rauschen',
    weight: 2,
    unigrams: ['und', 'sehr', 'eigentlich'],
    phrases: ['das ist wichtig', 'für mich persönlich', 'irgendwie ganz gut'],
    sentences: [
      'Das ist für mich wichtig und hilft mir sehr dabei.',
      'Eigentlich war es ganz gut, aber irgendwie auch unklar.',
      'Mir hat das heute irgendwie sehr geholfen.',
    ],
  },
];

const QA_SHORT = [
  'Mehr Beispiele?',
  'Mehr Beispielmaterial?',
  'Welche Übung war unklar?',
  'Welche Übungen fehlen noch?',
  'Offene Fragen zur Visualisierung?',
  'Eine Frage zur Erklärung?',
  'Kurze Pausen zwischen Themen?',
  'Feedback zur letzten Übung?',
  'Rückmeldungen zu Zwischenergebnissen?',
  'Praxisbezug in den Beispielen?',
  'Validierung vor der Visualisierung?',
  'Grenzen von ChatGPT in der Übung?',
  'HTTP 404 in Moodle – was tun?',
  'C++ Beispiel langsamer erklären?',
  'Struktur oder Aufbau der Sitzung?',
  'Lernen mit kurzen Pausen?',
];

const QA_PHRASES = [
  'konkrete Beispiele',
  'gute Beispiele',
  'Beispiele aus der Praxis',
  'kurze Übungen',
  'die nächste Übung',
  'schnelles Feedback',
  'klare Rückmeldungen',
  'klare Visualisierung',
  'Visualisierung der Verteilung',
  'kurze Erklärung',
  'Erklärung mit Beispiel',
  'offene Fragen',
  'Fragen im Q&A',
  'kurze Pausen',
  'roter Faden',
  'klarer Praxisbezug',
  'Rollen in der Gruppenarbeit',
  'Ergebnisse validieren',
  'Grenzen von ChatGPT',
  'HTTP 404',
];

const QA_DETAILS = [
  'die Übung planbarer wird',
  'Beispiele nicht abstrakt bleiben',
  'Erklärungen nachvollziehbar bleiben',
  'Visualisierungen den Faden halten',
  'Rückmeldungen rechtzeitig kommen',
  'Fragen nicht untergehen',
  'Pausen das Lernen stützen',
  'die Validierung vor der Folie sitzt',
];

const QA_FRAMES = [
  'Warum bleibt „{phrase}“ oft unklar, obwohl {detail}?',
  'Was hilft bei „{phrase}“ am meisten, damit {detail}?',
  'Wie sollten „{phrase}“ sichtbar werden, sodass {detail}?',
  'Wo brauchen wir bei „{phrase}“ mehr Orientierung, damit {detail}?',
  'Was wäre der nächste Schritt bei „{phrase}“, wenn {detail}?',
  'Welche Risiken entstehen ohne „{phrase}“, besonders wenn {detail}?',
  'Wie hängt „{phrase}“ mit den Übungen zusammen, damit {detail}?',
  'Welche Beispiele zu „{phrase}“ würden helfen, wenn {detail}?',
];

function clipSeedText(text: string, max = SPACY_WORDCLOUD_SEED_ITEM_CHARS): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  const sliced = normalized.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace >= 40 ? sliced.slice(0, lastSpace) : sliced).trim();
}

function familyTexts(family: SeedFamily): readonly string[] {
  return [...family.unigrams, ...family.phrases, ...family.sentences];
}

function buildDenseItem(family: SeedFamily, salt: number): string {
  const parts = familyTexts(family);
  const chunks: string[] = [];
  let cursor = salt;
  while (chunks.join(' ').length < SPACY_WORDCLOUD_SEED_ITEM_CHARS - 24) {
    chunks.push(parts[cursor % parts.length] ?? family.name);
    cursor += 1;
  }
  return clipSeedText(chunks.join('. '));
}

export function buildSpacyFreetextResponses(count = SPACY_WORDCLOUD_SEED_ITEM_COUNT): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count muss eine positive Ganzzahl sein.');
  }

  const totalWeight = FREETEXT_FAMILIES.reduce((sum, family) => sum + family.weight, 0);
  const cursors = FREETEXT_FAMILIES.map(() => 0);
  const responses: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const slot = index % totalWeight;
    let acc = 0;
    let familyIndex = 0;
    for (let current = 0; current < FREETEXT_FAMILIES.length; current += 1) {
      acc += FREETEXT_FAMILIES[current]?.weight ?? 0;
      if (slot < acc) {
        familyIndex = current;
        break;
      }
    }

    const family = FREETEXT_FAMILIES[familyIndex] ?? FREETEXT_FAMILIES[0]!;
    if (index % 23 === 0) {
      responses.push(buildDenseItem(family, index));
      continue;
    }

    const texts = familyTexts(family);
    const cursor = cursors[familyIndex] ?? 0;
    cursors[familyIndex] = cursor + 1;
    responses.push(clipSeedText(texts[cursor % texts.length] ?? family.name));
  }

  return responses;
}

function buildLongQaQuestion(index: number): string {
  const phrase = QA_PHRASES[index % QA_PHRASES.length] ?? 'konkrete Beispiele';
  const other = QA_PHRASES[(index * 3 + 1) % QA_PHRASES.length] ?? 'kurze Übungen';
  const detail = QA_DETAILS[index % QA_DETAILS.length] ?? 'die Übung planbarer wird';
  return clipSeedText(
    `Wie können „${phrase}“ und „${other}“ so verzahnt werden, dass ${detail}? ` +
      `Bitte mit einer Frage, mehreren Fragen, einem Beispiel und weiteren Beispielen antworten. ` +
      `Mir helfen Erklärungen, Visualisierungen und Rückmeldungen, solange die Übung den Faden hält. ` +
      `Ohne Pause, ohne Feedback und ohne Validierung bleibt das Lernen bruchstückhaft.`,
  );
}

export function buildSpacyQaQuestionTexts(count = SPACY_WORDCLOUD_SEED_ITEM_COUNT): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count muss eine positive Ganzzahl sein.');
  }

  const questions: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const bucket = index % 10;
    if (bucket <= 1) {
      questions.push(QA_SHORT[index % QA_SHORT.length] ?? 'Mehr Beispiele?');
      continue;
    }
    if (bucket === 9) {
      questions.push(buildLongQaQuestion(index));
      continue;
    }

    const phrase = QA_PHRASES[index % QA_PHRASES.length] ?? 'konkrete Beispiele';
    const detail = QA_DETAILS[(index * 3) % QA_DETAILS.length] ?? 'die Übung planbarer wird';
    const frame = QA_FRAMES[(index + Math.floor(index / QA_PHRASES.length)) % QA_FRAMES.length]!;
    const suffix =
      index % 13 === 0
        ? ' Kontext: Lernen mit Beispielen und Übungen.'
        : index % 19 === 0
          ? ' Bitte mit Visualisierung oder Gegenbeispiel antworten.'
          : '';
    questions.push(
      clipSeedText(
        `${frame.replaceAll('{phrase}', phrase).replaceAll('{detail}', detail)}${suffix}`,
      ),
    );
  }
  return questions;
}
