/**
 * Deterministischer Fachkorpus für eine große Mitarbeitervollversammlung.
 *
 * Die sechs hervorgehobenen Fragen bilden bewusst drei robuste Mehrheitsfragen
 * und drei polarisierende Themen ab. Alle übrigen Texte kombinieren echte
 * Themen, Organisationseinheiten und Zeithorizonte statt technischer Seed-IDs.
 */
export const QA_ASSEMBLY_FEATURED_QUESTIONS = Object.freeze([
  Object.freeze({
    text: 'Wann veröffentlicht das Unternehmen transparente Gehaltsbänder für alle Rollen und Standorte?',
    positiveVotes: 1_600,
    negativeVotes: 80,
  }),
  Object.freeze({
    text: 'Welche verbindliche Standort- und Beschäftigungsgarantie gibt der Vorstand für die nächsten drei Jahre?',
    positiveVotes: 1_450,
    negativeVotes: 120,
  }),
  Object.freeze({
    text: 'Welche messbaren Ziele gelten für Weiterbildung, interne Wechsel und faire Karrierechancen?',
    positiveVotes: 1_300,
    negativeVotes: 150,
  }),
  Object.freeze({
    text: 'Sind betriebsbedingte Kündigungen oder weitere Auslagerungen in diesem Geschäftsjahr ausgeschlossen?',
    positiveVotes: 1_050,
    negativeVotes: 980,
  }),
  Object.freeze({
    text: 'Warum steigen Vorstandsboni, während Teams sparen und offene Stellen nicht nachbesetzt werden?',
    positiveVotes: 950,
    negativeVotes: 930,
  }),
  Object.freeze({
    text: 'Soll eine Vier-Tage-Woche bei vollem Lohnausgleich unternehmensweit erprobt werden?',
    positiveVotes: 900,
    negativeVotes: 850,
  }),
]);

export const QA_ASSEMBLY_EXPECTED_RANKING = Object.freeze({
  TOP: 0,
  BEST: 0,
  CONTROVERSIAL: 4,
});

export const QA_ASSEMBLY_RATING_COUNT = QA_ASSEMBLY_FEATURED_QUESTIONS.reduce(
  (sum, question) => sum + question.positiveVotes + question.negativeVotes,
  0,
);

const QUESTION_STEMS = Object.freeze([
  'Wann werden die Ergebnisse der Mitarbeitendenbefragung veröffentlicht und welche Maßnahmen folgen daraus?',
  'Wie wird verhindert, dass die aktuelle Sparrunde dauerhaft zu Mehrarbeit und Überlastung führt?',
  'Welche Investitionen sind geplant, um veraltete Werkzeuge und langsame Prozesse zu modernisieren?',
  'Wie transparent werden Gehaltsentwicklung, Beförderungskriterien und variable Vergütung künftig gemacht?',
  'Welche konkreten Maßnahmen verbessern Vereinbarkeit, Pflegezeiten und flexible Arbeitsmodelle?',
  'Wie stellt das Unternehmen sicher, dass mobiles Arbeiten fair und einheitlich geregelt wird?',
  'Welche Zusagen gibt es für Ausbildung, duales Studium und die Übernahme junger Beschäftigter?',
  'Wie werden Beschäftigte und Betriebsrat frühzeitig in größere Umstrukturierungen einbezogen?',
  'Welche Schritte reduzieren Leiharbeit, Befristungen und dauerhaft unbesetzte Stellen?',
  'Wie werden psychische Gesundheit, realistische Ziele und Schutz vor Überlastung verbindlich verbessert?',
  'Welche Strategie verfolgt das Unternehmen bei künstlicher Intelligenz und wie werden Arbeitsplätze geschützt?',
  'Wie werden Datenschutz, Mitbestimmung und Qualifizierung bei neuen digitalen Systemen gewährleistet?',
  'Welche messbaren Klimaziele gelten und wie werden Fortschritte offen berichtet?',
  'Wie werden Schichtmodelle, Rufbereitschaft und Wochenendarbeit fairer und planbarer gestaltet?',
  'Welche Perspektive haben kleinere Standorte und wie werden Investitionsentscheidungen nachvollziehbar?',
  'Wie wird die Zusammenarbeit zwischen Führungskräften, Fachbereichen und zentralen Diensten verbessert?',
  'Welche Maßnahmen sorgen für Barrierefreiheit, Inklusion und gleiche Entwicklungschancen?',
  'Wie werden gute Ideen aus den Teams schneller entschieden, finanziert und umgesetzt?',
  'Welche Konsequenzen zieht die Leitung aus Fluktuation, Krankenstand und unbesetzten Schlüsselrollen?',
  'Wie werden Unternehmensziele, wirtschaftliche Lage und Risiken verständlich und regelmäßig kommuniziert?',
]);

const ORGANIZATIONAL_SCOPES = Object.freeze([
  'Produktion und Logistik',
  'Vertrieb und Kundenservice',
  'IT und Digitalisierung',
  'Forschung und Entwicklung',
  'Verwaltung und zentrale Dienste',
  'Auszubildende und Berufseinsteigende',
  'Schichtbeschäftigte',
  'kleine und dezentrale Standorte',
  'Teilzeitbeschäftigte und pflegende Angehörige',
  'internationale und standortübergreifende Teams',
]);

const TIME_HORIZONS = Object.freeze([
  'bis zum Ende dieses Geschäftsjahres',
  'im kommenden Haushaltsjahr',
  'innerhalb der nächsten zwölf Monate',
  'für die nächsten drei Jahre',
  'vor der nächsten Mitarbeitervollversammlung',
]);

export function buildQaAssemblyQuestion(participantIndex, questionIndex) {
  if (
    questionIndex === 0 &&
    participantIndex >= 0 &&
    participantIndex < QA_ASSEMBLY_FEATURED_QUESTIONS.length
  ) {
    return QA_ASSEMBLY_FEATURED_QUESTIONS[participantIndex].text;
  }
  const stemIndex = (participantIndex + questionIndex * 7) % QUESTION_STEMS.length;
  const scopeIndex =
    (Math.floor(participantIndex / QUESTION_STEMS.length) + questionIndex * 3) %
    ORGANIZATIONAL_SCOPES.length;
  const horizonIndex =
    (Math.floor(participantIndex / (QUESTION_STEMS.length * ORGANIZATIONAL_SCOPES.length)) +
      questionIndex) %
    TIME_HORIZONS.length;
  return `${QUESTION_STEMS[stemIndex]} Bitte konkret für ${ORGANIZATIONAL_SCOPES[scopeIndex]} ${TIME_HORIZONS[horizonIndex]}.`;
}

export function buildQaAssemblyVotePlan(participantCount) {
  if (!Number.isSafeInteger(participantCount) || participantCount < 2_500) {
    throw new Error('Das realistische Q&A-Voteprofil benötigt mindestens 2.500 Teilnehmende.');
  }
  return QA_ASSEMBLY_FEATURED_QUESTIONS.flatMap((question, featureIndex) => {
    const voteCount = question.positiveVotes + question.negativeVotes;
    return Array.from({ length: voteCount }, (_, voteIndex) => ({
      featureIndex,
      voterIndex: (featureIndex + 1 + voteIndex) % participantCount,
      direction: voteIndex < question.positiveVotes ? 'UP' : 'DOWN',
    }));
  });
}
