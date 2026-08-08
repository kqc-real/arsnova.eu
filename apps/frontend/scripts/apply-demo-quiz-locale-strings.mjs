/**
 * Schreibt das lokalisierte Showcase-Demo-Quiz in alle fünf Seed-JSONs.
 * Aufruf: node scripts/apply-demo-quiz-locale-strings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, '../src/assets/demo');

function md(strings, ...values) {
  return String.raw({ raw: strings.raw }, ...values).trim();
}

const EXPORT_VERSION = 28;
const EXPORTED_AT = '2026-05-24T10:00:00.000Z';

const EMOTION_IMAGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/b/b4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375_%28cropped%29.jpg';
const PI_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Pi-unrolled-720.gif';
const ROOFTOP_SCENE_IMAGE_URL = '/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png';
const CODE_FENCE = '```';

const PROCESSING_SKETCH = [
  'float angle = 0;',
  '',
  'void setup() {',
  '  size(130, 130, OPENGL);',
  '}',
  '',
  'void draw() {',
  '  background(100);',
  '',
  '  translate(60, 40, 0);',
  '  rotateY(angle);',
  '  angle += .01;',
  '',
  '  beginShape(TRIANGLES);',
  '  vertex(0, 40, 0);',
  '  vertex(40, 40, 0);',
  '  vertex(20, 0, -20);',
  '',
  '  vertex(0, 40, 0);',
  '  vertex(20, 40, -40);',
  '  vertex(20, 0, -20);',
  '',
  '  vertex(40, 40, 0);',
  '  vertex(20, 40, -40);',
  '  vertex(20, 0, -20);',
  '  endShape();',
  '}',
].join('\n');

function buildPayload(locale) {
  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: EXPORTED_AT,
    quiz: {
      name: locale.name,
      description: locale.description,
      motifImageUrl: EMOTION_IMAGE_URL,
      showLeaderboard: true,
      allowCustomNicknames: false,
      defaultTimer: 30,
      timerScaleByDifficulty: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNames: locale.teamNames,
      backgroundMusic: null,
      nicknameTheme: 'KINDERGARTEN',
      bonusTokenCount: 3,
      readingPhaseEnabled: true,
      questions: [
        {
          text: locale.questions[0].text,
          type: 'SURVEY',
          timer: null,
          difficulty: 'EASY',
          order: 0,
          answers: locale.questions[0].answers,
        },
        {
          text: locale.questions[1].text,
          type: 'FREETEXT',
          timer: null,
          difficulty: 'MEDIUM',
          order: 1,
          skipReadingPhase: true,
          answers: [],
        },
        {
          text: locale.questions[2].text,
          type: 'SINGLE_CHOICE',
          timer: null,
          difficulty: 'EASY',
          order: 2,
          answers: locale.questions[2].answers,
        },
        {
          text: locale.questions[3].text,
          type: 'MULTIPLE_CHOICE',
          timer: null,
          difficulty: 'MEDIUM',
          order: 3,
          skipReadingPhase: true,
          answers: locale.questions[3].answers,
        },
        {
          text: locale.questions[4].text,
          type: 'SINGLE_CHOICE',
          timer: null,
          difficulty: 'HARD',
          order: 4,
          answers: locale.questions[4].answers,
        },
        {
          text: locale.questions[5].text,
          type: 'SINGLE_CHOICE',
          timer: null,
          difficulty: 'MEDIUM',
          order: 5,
          answers: locale.questions[5].answers,
        },
        {
          text: locale.questions[6].text,
          type: 'SHORT_TEXT',
          timer: null,
          difficulty: 'HARD',
          order: 6,
          answers: locale.questions[6].answers,
          shortTextMaxLength: 32,
          shortTextCaseSensitive: false,
          shortTextEvaluationMode: 'auto',
          shortTextToleranceLevel: 'medium',
          shortTextAllowPartialCredit: true,
          shortTextTrimWhitespace: true,
          shortTextNormalizeWhitespace: true,
        },
        {
          text: locale.questions[7].text,
          type: 'NUMERIC_ESTIMATE',
          timer: null,
          difficulty: 'MEDIUM',
          order: 7,
          answers: [],
          numericToleranceMode: 'ABSOLUTE_INTERVAL',
          numericReferenceValue: 1789,
          numericIntervalLeft: 1788.5,
          numericIntervalRight: 1789.5,
          numericInputType: 'INTEGER',
          numericMin: 1700,
          numericMax: 1900,
          numericTwoRounds: true,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow ?? 'Geraten',
          confidenceLabelHigh: locale.confidenceLabelHigh ?? 'Sehr sicher',
        },
        {
          text: locale.questions[9].text,
          type: 'ORDERING',
          timer: null,
          difficulty: 'HARD',
          order: 8,
          answers: [],
          orderingItems: locale.questions[9].orderingItems,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow ?? 'Geraten',
          confidenceLabelHigh: locale.confidenceLabelHigh ?? 'Sehr sicher',
        },
        {
          text: locale.questions[10].text,
          type: 'MATCHING',
          timer: null,
          difficulty: 'MEDIUM',
          order: 9,
          answers: [],
          matchingPairs: locale.questions[10].matchingPairs,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow ?? 'Geraten',
          confidenceLabelHigh: locale.confidenceLabelHigh ?? 'Sehr sicher',
        },
        {
          text: locale.questions[11].text,
          type: 'CATEGORIZATION',
          timer: null,
          difficulty: 'MEDIUM',
          order: 10,
          answers: [],
          categories: locale.questions[11].categories,
          categorizationItems: locale.questions[11].categorizationItems,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow ?? 'Geraten',
          confidenceLabelHigh: locale.confidenceLabelHigh ?? 'Sehr sicher',
        },
        {
          text: locale.questions[8].text,
          type: 'RATING',
          timer: null,
          difficulty: 'EASY',
          order: 11,
          answers: [],
          ratingMin: 1,
          ratingMax: 5,
          ratingLabelMin: locale.questions[8].ratingLabelMin,
          ratingLabelMax: locale.questions[8].ratingLabelMax,
        },
      ],
    },
  };
}

const LOCALES = {
  de: {
    name: 'Praxis-Showcase: Team-Quiz',
    teamNames: ['Team 🍎', 'Team 🍐'],
    description: md`![Praxis-Showcase](${PI_IMAGE_URL})

# Praxis-Showcase für den Unterricht

Diese Demo ist für den **echten Unterrichtseinsatz** gedacht. Sie will kein perfekt durchkomponiertes Fachquiz von Anfang bis Ende sein. Ihr Zweck ist ein anderer: Sie soll Lehrkräften, Dozierenden und Trainer:innen zeigen, wie arsnova.eu eine Live-Session abwechslungsreicher, visueller und spielerischer machen kann.

Nutze sie als kurze, **Kahoot-artige Team-Demo für den Live-Unterricht**, um zu zeigen, wie du:
- mit einem kurzen emotionalen oder sozialen Check-in startest
- Bilder statt reiner Textfragen einsetzt
- Formeln und wissenschaftliche Notation in MINT-Fächern einbindest
- numerische Schätzfragen mit Referenzwert, Toleranzband und zwei Runden ausprobierst
- kurze Freitextantworten aus dem Raum sammelst, die später als Wortwolke sichtbar werden
- Multiple-Choice- und Rating-Fragen sinnvoll einsetzt
- mit Timer, Teams, Rangliste und Bonus-Codes mehr Energie aufbaust
- Codebeispiele im Informatik- oder Technikunterricht einsetzt

Die Fragen sind bewusst gemischt. Ziel ist es, dir konkrete Ideen für Einstiege, Verständnischecks, Aufmerksamkeitssignale und kurze interaktive Momente im Unterricht zu geben.

**Tipp für die Demo:** Tritt der Session auf einem zweiten Gerät bei, am besten per QR-Code auf dem Smartphone. So kannst du den Wechsel zwischen Host-Ansicht und Teilnehmenden-Perspektive realistisch durchspielen.

**Noch ein Tipp:** Öffne danach den Bearbeitungsmodus des Quiz und schau dir an, wie die Fragen mit Markdown und KaTeX umgesetzt sind.

**Und noch etwas:** Weitere Frageformate oder Features kannst du gern anfragen. Die Kontaktdaten findest du im Impressum.`,
    questions: [
      {
        text: md`### Wie ist die Stimmung im Raum gerade?

> **Unterrichtsidee:** Nutze das als kurzen Check-in zu Beginn, vor Feedback oder nach einer anspruchsvollen Phase.

![Emotionen im Überblick](${EMOTION_IMAGE_URL})

*Für die Vollansicht anklicken.*`,
        answers: [
          { text: ':smile: Bereit loszulegen', isCorrect: false },
          { text: ':cry: Gerade etwas überfordert', isCorrect: false },
          { text: ':rage: Genervt', isCorrect: false },
          { text: ':neutral_face: Ganz okay', isCorrect: false },
        ],
      },
      {
        text: md`### Runde $\pi$ auf zwei Dezimalstellen.

> **Unterrichtsidee:** Nutze das als kurze MINT-Frage, die Formeln, Medien und offene Texteingaben zusammenbringt.

![Die Zahl Pi](${PI_IMAGE_URL})

Leonhard Euler:

$$e^{i \pi} + 1 = 0$$

Karl Weierstraß:

$$\pi = \int_{-\infty}^{\infty} \frac{\mathrm{d}x}{1 + x^2} = 2 \cdot \int_{-1}^{1} \frac{\mathrm{d}x}{1 + x^2}$$`,
      },
      {
        text: md`### KI-Bild oder echtes Foto?

> **Unterrichtsidee:** Nutze das als visuellen Einstieg, als Aufmerksamkeitssignal oder als niedrigschwelligen Gesprächseinstieg.

![Dachszene](${ROOFTOP_SCENE_IMAGE_URL})`,
        answers: [
          { text: 'KI-generiertes Bild', isCorrect: false },
          { text: 'Echtes Foto', isCorrect: true },
        ],
      },
      {
        text: md`
### Welche dieser Einsätze eignen sich gut für einen kurzen Live-Check?

> **Unterrichtsidee:** Nutze das, um Multiple Choice mit mehreren richtigen Antworten zu zeigen.

_Mehrere Antworten möglich._
        `,
        answers: [
          { text: 'Vorwissen zu Beginn einer Stunde aktivieren', isCorrect: true },
          { text: 'Missverständnisse mitten in der Stunde sichtbar machen', isCorrect: true },
          { text: 'Vor einer Prüfung das Sicherheitsgefühl anonym abfragen', isCorrect: true },
          {
            text: 'Nur benotete Abschlusstests am Ende einer Einheit durchführen',
            isCorrect: false,
          },
        ],
      },
      {
        text: md`
### Wie viele sichtbare Teile hat der klassische Zauberwürfel?

> **Unterrichtsidee:** Nutze das für einen spielshowartigen Moment mit Tempo, Spannung und sichtbarem Teamwettbewerb.

Gemeint ist der klassische Rubik’s Cube von Ernő Rubik.

Optionaler Impuls: [Wie man einen 3×3 Zauberwürfel ohne Erfahrung löst](https://www.youtube.com/watch?v=EoINieyz6gE).
        `,
        answers: [
          { text: '28', isCorrect: false },
          { text: '26', isCorrect: true },
          { text: '24', isCorrect: false },
          { text: '22', isCorrect: false },
        ],
      },
      {
        text: md`### In welcher Sprache ist dieser Code geschrieben?

> **Unterrichtsidee:** Nutze das als schnellen Erkennungsimpuls für Informatik, Maker-Projekte oder technische Einführungen.

${CODE_FENCE}java
${PROCESSING_SKETCH}
${CODE_FENCE}`,
        answers: [
          { text: 'Groovy', isCorrect: false },
          { text: 'Python', isCorrect: false },
          { text: 'Processing', isCorrect: true },
          { text: 'Scala', isCorrect: false },
        ],
      },
      {
        text: md`
### Wie heißt die Methode, bei der Lernende erst individuell abstimmen, dann kurz diskutieren und anschließend erneut abstimmen?

> **Unterrichtsidee:** Nutze das als anspruchsvolle Fachbegriffsfrage, um explizite Varianten, kleine Buchstabendreher und transparente Kurzantwort-Bewertung mit Teilpunkten zu demonstrieren.

Gesucht ist der etablierte didaktische Begriff für diesen Ablauf.
        `,
        answers: [
          { text: 'Peer Instruction', isCorrect: true },
          { text: 'Peer-Instruction', isCorrect: true },
          { text: 'Mazur-Methode', isCorrect: true },
          { text: 'Mazur Methode', isCorrect: true },
        ],
      },
      {
        text: md`
### In welchem Jahr begann die Französische Revolution?

> **Unterrichtsidee:** Nutze das als Schätzfrage mit zwei Runden: erst spontan schätzen, dann kurz diskutieren und die zweite Runde mit Referenzwert, Toleranzband und Score vergleichen.

Gesucht ist das Jahr, das historisch üblicherweise als Beginn der Französischen Revolution gilt.
        `,
      },
      {
        text: md`
### Wie wahrscheinlich ist es, dass du so ein Live-Quiz bald selbst einsetzt?

> **Unterrichtsidee:** Nutze das als schnelles Meinungsbild, Exit-Ticket oder Confidence-Check.
        `,
        ratingLabelMin: 'Eher noch nicht',
        ratingLabelMax: 'Ich probiere es aus',
      },
      {
        text: md`### Bringe die 6 Phasen der Proteinbiosynthese in die richtige molekulare Reihenfolge.

> **Unterrichtsidee:** Nutze Sortierfragen in Biologie, Chemie oder Physik, um komplexere mehrstufige Reaktionsketten vor dem Abitur prüfungssicher einzuüben.

Bringe die Phasen von der Entwindung der DNA im Zellkern bis zur fertigen Proteinfaltung im Zytoplasma in die korrekte Abfolge.`,
        orderingItems: [
          { id: 'step1', text: 'Entwindung: Die RNA-Polymerase bindet am Promoter und entwindet den DNA-Doppelstrang.' },
          { id: 'step2', text: 'Transkription: Ablesen des codogenen Strangs und Synthese der komplementären prä-m-RNA.' },
          { id: 'step3', text: 'Prozessierung: Spleißen der prä-m-RNA (Introns entfernen) und Anfügen von Cap & Poly-A-Schwanz.' },
          { id: 'step4', text: 'Kernexport: Die reife m-RNA wandert durch die Kernporen ins Zytoplasma zu den Ribosomen.' },
          { id: 'step5', text: 'Translation: Ribosom liest m-RNA ab; t-RNAs knüpfen Aminosäuren am Start-Codon (AUG) an.' },
          { id: 'step6', text: 'Faltung: Die abgelöste Aminosäurekette faltet sich zur funktionsfähigen 3D-Proteinstruktur.' },
        ],
      },
      {
        text: md`### Ordne den historischen Daten der Weimarer Republik das passende Ereignis zu.

> **Unterrichtsidee:** Nutze Zuordnungsfragen in Geschichte, SOWI oder Geografie, um Schlüsseldaten, Verträge oder Verfassungsorgane 1:1 barrierefrei abzufragen.

_Wähle zu jedem Datum auf der linken Seite das historische Ereignis aus._`,
        matchingPairs: [
          { left: '9. November 1918', right: 'Ausrufung der Republik durch Philipp Scheidemann (Sturz der Monarchie)' },
          { left: '28. Juni 1919', right: 'Unterzeichnung des Versailler Vertrags unter deutschem Protest' },
          { left: '11. August 1919', right: 'Inkrafttreten der Weimarer Reichsverfassung (Reichspräsidentenverfassung)' },
          { left: '15. November 1923', right: 'Einführung der Rentenmark stoppt die galoppierende Hyperinflation' },
          { left: '25. Oktober 1929', right: 'Börsenkrach in New York („Schwarzer Freitag“) löst Weltwirtschaftskrise aus' },
          { left: '30. Januar 1933', right: 'Ernennung Adolf Hitlers zum Reichskanzler leitet das Ende der Republik ein' },
        ],
      },
      {
        text: md`### Ordne die folgenden 9 Werke, Zitate und Motive der richtigen Epoche zu.

> **Unterrichtsidee:** Nutze Kategorisierungsfragen im Deutsch- oder Fremdsprachenunterricht, um mehrere Texte, Schlüsselbegriffe oder Autoren Epochen und Stilrichtungen zuzuordnen.

_Ordne jedes Element einer der drei Literaturepochen zu._`,
        categories: [
          { id: 'cat_aufklaerung', name: 'Aufklärung (ca. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (ca. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romantik (ca. 1795–1835)' },
        ],
        categorizationItems: [
          { text: 'Nathan der Weise (G. E. Lessing & Toleranzgedanke/Ringparabel)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Die Leiden des jungen Werthers (J. W. von Goethe & Gefühlsüberschwang)', correctCategoryId: 'cat_sturm' },
          { text: 'Das Marmorbild & Das Gedicht „Mondnacht“ (Joseph von Eichendorff)', correctCategoryId: 'cat_romantik' },
          { text: '„Sapere aude! – Habe Mut, dich deines eigenen Verstandes zu bedienen!“ (I. Kant)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Gedicht „Prometheus“ („Bedecke deinen Himmel, Zeus, mit Wolkendunst...“)', correctCategoryId: 'cat_sturm' },
          { text: 'Die „Blaue Blume“ als zentrales Symbol der Sehnsucht (Novalis)', correctCategoryId: 'cat_romantik' },
          { text: 'Kabale und Liebe (Friedrich Schiller & Kritik am Ständecharakter)', correctCategoryId: 'cat_sturm' },
          { text: 'Emilia Galotti (G. E. Lessing & Bürgerliches Trauerspiel)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Der Sandmann & Die Schwarze Romantik / Unheimliche (E. T. A. Hoffmann)', correctCategoryId: 'cat_romantik' },
        ],
      },
    ],
  },
  en: {
    name: 'Teaching Showcase: Live Team Demo',
    teamNames: ['Team 🍎', 'Team 🍐'],
    description: md`![Teaching showcase](${PI_IMAGE_URL})

# Teaching Practice Showcase

This demo is built for **real classroom use**. It is not trying to be the perfect subject quiz from start to finish. Its job is different: it shows teachers, trainers, and facilitators how arsnova.eu can make a live session feel more varied, more visual, and more game-like.

Use it as a short, **Kahoot-style team demo for live teaching** to show how you can:
- open with a quick emotional or social check-in
- use images instead of text-only prompts
- bring in formulas and scientific notation in STEM
- try numeric estimate questions with a reference value, tolerance band, and two rounds
- collect short free-text answers from the room that later reappear as a word cloud
- use multiple-answer and quick rating prompts well
- ask for **answer confidence** (1–5) after graded answers and spot **incorrect answers with high confidence**
- add energy with timers, teams, a leaderboard, and bonus codes
- show code snippets in computer science or technical courses

The questions are intentionally mixed. The point is to give you practical ideas for warm-ups, comprehension checks, attention resets, and short interactive moments you can reuse in your own teaching.

**Demo tip:** Join the session on a second device, ideally by scanning the QR code with your phone. That lets you rehearse the back-and-forth between the host view and the participant experience realistically.

**Another tip:** Then open the quiz in edit mode to see how the questions are built with Markdown and KaTeX.

**One more thing:** If you would like additional question types or features, feel free to ask. You can find the contact details in the legal notice.`,
    questions: [
      {
        text: md`### How is the room feeling right now?

> **Teaching move:** Use this as a quick check-in at the start of class, before feedback, or after a demanding task.

![Overview of emotions](${EMOTION_IMAGE_URL})

*Click for full view.*`,
        answers: [
          { text: ':smile: Ready to dive in', isCorrect: false },
          { text: ':cry: A little overwhelmed', isCorrect: false },
          { text: ':rage: Frustrated', isCorrect: false },
          { text: ':neutral_face: Doing okay', isCorrect: false },
        ],
      },
      {
        text: md`### Round $\pi$ to two decimal places.

> **Teaching move:** Use this as a short STEM prompt that combines formulas, media, and open text input.

![The number pi](${PI_IMAGE_URL})

Leonhard Euler:

$$e^{i \pi} + 1 = 0$$

Karl Weierstraß:

$$\pi = \int_{-\infty}^{\infty} \frac{\mathrm{d}x}{1 + x^2} = 2 \cdot \int_{-1}^{1} \frac{\mathrm{d}x}{1 + x^2}$$`,
      },
      {
        text: md`### AI image or real photo?

> **Teaching move:** Use this as a visual warm-up, an attention reset, or a low-stakes discussion starter.

![Rooftop scene](${ROOFTOP_SCENE_IMAGE_URL})`,
        answers: [
          { text: 'AI-generated image', isCorrect: false },
          { text: 'Real photo', isCorrect: true },
        ],
      },
      {
        text: md`
### Which of these are strong use cases for a quick live check?

> **Teaching move:** Use this to demonstrate a multiple-answer question.

_Select all that apply._
        `,
        answers: [
          { text: 'Activate prior knowledge at the start of class', isCorrect: true },
          { text: 'Surface misconceptions halfway through a lesson', isCorrect: true },
          { text: 'Gauge confidence anonymously before exam prep', isCorrect: true },
          { text: 'Use it only for graded tests at the end of a unit', isCorrect: false },
        ],
      },
      {
        text: md`
### How many visible pieces does the classic Rubik’s Cube have?

> **Teaching move:** Use this for a game-show beat with pace, suspense, and visible team competition.

The question refers to the classic Rubik’s Cube designed by Ernő Rubik.

Optional resource: [How to solve a 3×3 Rubik’s Cube with no prior experience — German-language resource](https://www.youtube.com/watch?v=EoINieyz6gE).
        `,
        answers: [
          { text: '28', isCorrect: false },
          { text: '26', isCorrect: true },
          { text: '24', isCorrect: false },
          { text: '22', isCorrect: false },
        ],
      },
      {
        text: md`### Which language is this code written in?

> **Teaching move:** Use this as a quick recognition prompt in computer science, maker, or STEM classes.

${CODE_FENCE}java
${PROCESSING_SKETCH}
${CODE_FENCE}`,
        answers: [
          { text: 'Groovy', isCorrect: false },
          { text: 'Python', isCorrect: false },
          { text: 'Processing', isCorrect: true },
          { text: 'Scala', isCorrect: false },
        ],
      },
      {
        text: md`
### What is the teaching method called in which learners vote individually, discuss briefly, and then vote again?

> **Teaching move:** Use this as a challenging terminology question to demonstrate accepted answer variants, minor spelling errors, and transparent partial-credit scoring.

Expected answer: the established instructional term for this sequence.
        `,
        answers: [
          { text: 'Peer Instruction', isCorrect: true },
          { text: 'Peer-Instruction', isCorrect: true },
          { text: 'Mazur method', isCorrect: true },
          { text: "Mazur's method", isCorrect: true },
        ],
      },
      {
        text: md`
### In which year did the French Revolution begin?

> **Teaching move:** Use this as a two-round estimate question: first collect spontaneous guesses, then discuss briefly and compare the second round against the reference value, tolerance band, and score.

Expected answer: the year commonly used as the beginning of the French Revolution.
        `,
      },
      {
        text: md`
### How likely are you to try a live quiz like this in one of your own classes?

> **Teaching move:** Use this as a quick pulse check, exit ticket, or confidence rating.
        `,
        ratingLabelMin: 'Not yet',
        ratingLabelMax: 'Ready to try it',
      },
      {
        text: md`### Put the 6 phases of protein biosynthesis into the correct molecular order.

> **Teaching move:** Use ordering prompts in biology, chemistry, or physics to practice multi-step reaction chains before exams.

Arrange the steps from DNA unwinding in the nucleus to the finished 3D protein folding in the cytoplasm.`,
        orderingItems: [
          { id: 'step1', text: 'Unwinding: RNA polymerase binds at promoter and unwinds the DNA double helix.' },
          { id: 'step2', text: 'Transcription: Reading the template strand and synthesizing complementary pre-mRNA.' },
          { id: 'step3', text: 'Processing: Splicing pre-mRNA (removing introns) and adding cap & poly-A tail.' },
          { id: 'step4', text: 'Nuclear Export: Mature mRNA exits the nucleus through pores to ribosomes in cytoplasm.' },
          { id: 'step5', text: 'Translation: Ribosome reads mRNA; tRNAs link amino acids starting at codon AUG.' },
          { id: 'step6', text: 'Folding: Detached amino acid chain folds into a functional 3D protein structure.' },
        ],
      },
      {
        text: md`### Match the historical dates of the Weimar Republic to the corresponding event.

> **Teaching move:** Use matching prompts in history, social studies, or geography to check key dates, treaties, or constitutional organs 1:1.

_Match each date on the left to its historical milestone on the right._`,
        matchingPairs: [
          { left: '9 November 1918', right: 'Proclamation of the German Republic by Philipp Scheidemann (fall of monarchy)' },
          { left: '28 June 1919', right: 'Signing of the Treaty of Versailles under German protest' },
          { left: '11 August 1919', right: 'Weimar Constitution comes into force' },
          { left: '15 November 1923', right: 'Introduction of the Rentenmark halts hyperinflation' },
          { left: '25 October 1929', right: 'Wall Street crash ("Black Friday") triggers Global Great Depression' },
          { left: '30 January 1933', right: 'Appointment of Adolf Hitler as Chancellor marks the end of the Republic' },
        ],
      },
      {
        text: md`### Categorize the following 9 literary works, quotes, and motifs into their correct period.

> **Teaching move:** Use categorization prompts in literature or language learning to sort works, concepts, or authors into literary periods.

_Assign each item to one of the three literary movements._`,
        categories: [
          { id: 'cat_aufklaerung', name: 'Enlightenment (c. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (c. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romanticism (c. 1795–1835)' },
        ],
        categorizationItems: [
          { text: 'Nathan the Wise (G. E. Lessing & Ring Parable / Tolerance)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'The Sorrows of Young Werther (J. W. von Goethe & Emotionalism)', correctCategoryId: 'cat_sturm' },
          { text: 'The Marble Statue & Poem "Mondnacht" (Joseph von Eichendorff)', correctCategoryId: 'cat_romantik' },
          { text: '"Sapere aude! – Dare to know / Have courage to use your own reason!" (Immanuel Kant)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Poem "Prometheus" ("Cover your heaven, Zeus, with clouds...")', correctCategoryId: 'cat_sturm' },
          { text: 'The "Blue Flower" as central symbol of longing (Novalis)', correctCategoryId: 'cat_romantik' },
          { text: 'Intrigue and Love (Friedrich Schiller & Social critique)', correctCategoryId: 'cat_sturm' },
          { text: 'Emilia Galotti (G. E. Lessing & Bourgeois Tragedy)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'The Sandman & Dark Romanticism / The Uncanny (E. T. A. Hoffmann)', correctCategoryId: 'cat_romantik' },
        ],
      },
    ],
  },
  fr: {
    name: 'Showcase pédagogique : démo en équipe',
    teamNames: ['Équipe 🍎', 'Équipe 🍐'],
    description: md`![Showcase pédagogique](${PI_IMAGE_URL})

# Showcase pédagogique

Cette démo est pensée pour un **usage réel en classe**. Elle n’essaie pas d’être un quiz disciplinaire parfait du début à la fin. Son rôle est ailleurs : montrer aux enseignant·es, formateur·rices et animateur·rices comment arsnova.eu peut rendre une séance en direct plus variée, plus visuelle et plus ludique.

Utilisez-la comme une courte **démo en équipe, façon Kahoot, pour les cours en direct** afin de montrer comment vous pouvez :
- démarrer avec un rapide tour d’humeur ou un check-in social
- utiliser des images plutôt que des consignes purement textuelles
- intégrer des formules et de la notation scientifique en STEM
- tester des questions d’estimation numérique avec valeur de référence, bande de tolérance et deux tours
- recueillir de courtes réponses en texte libre qui réapparaîtront ensuite sous forme de nuage de mots
- utiliser à bon escient les choix multiples et les échelles d’évaluation
- demander le **degré de confiance** (1–5) après les réponses notées et repérer les réponses **incorrectes avec un degré de confiance élevé** dans la vue hôte
- ajouter de l’énergie avec des chronos, des équipes, un classement et des codes bonus
- afficher des extraits de code en informatique ou dans des cours techniques

Les questions sont volontairement variées. L’idée est de vous donner des pistes concrètes pour les échauffements, les vérifications de compréhension, les relances d’attention et les petits moments interactifs réutilisables en classe.

**Conseil pour la démo :** Rejoignez la session sur un deuxième appareil, idéalement en scannant le QR code avec votre téléphone. Vous pourrez ainsi rejouer de façon réaliste l’aller-retour entre la vue hôte et l’expérience participante.

**Autre conseil :** Ouvrez ensuite le quiz en mode édition pour voir comment les questions sont construites avec Markdown et KaTeX.

**Et encore une chose :** Si vous souhaitez d’autres formats de questions ou fonctionnalités, n’hésitez pas à les demander. Les coordonnées figurent dans les mentions légales.`,
    questions: [
      {
        text: md`### Comment se sent le groupe en ce moment ?

> **Piste pédagogique :** utilisez cette question comme sondage d’humeur rapide au début du cours, avant un débriefing ou après une activité exigeante.

![Aperçu des émotions](${EMOTION_IMAGE_URL})

*Cliquer pour agrandir.*`,
        answers: [
          { text: ':smile: Prêt·e à s’y mettre', isCorrect: false },
          { text: ':cry: Un peu dépassé·e', isCorrect: false },
          { text: ':rage: Frustré·e', isCorrect: false },
          { text: ':neutral_face: Ça va', isCorrect: false },
        ],
      },
      {
        text: md`### Arrondissez $\pi$ à deux décimales.

> **Piste pédagogique :** utilisez cette question comme brève activité d’estimation en STEM avec valeur de référence, bande de tolérance absolue de 3,1 à 3,2 et plage de plausibilité de 3,0 à 3,5.

![Le nombre pi](${PI_IMAGE_URL})

Leonhard Euler :

$$e^{i \pi} + 1 = 0$$

Karl Weierstraß :

$$\pi = \int_{-\infty}^{\infty} \frac{\mathrm{d}x}{1 + x^2} = 2 \cdot \int_{-1}^{1} \frac{\mathrm{d}x}{1 + x^2}$$`,
      },
      {
        text: md`### Image IA ou photo réelle ?

> **Piste pédagogique :** utilisez cette question comme échauffement visuel, relance d’attention ou amorce de discussion sans enjeu d’évaluation.

![Scène de toit](${ROOFTOP_SCENE_IMAGE_URL})`,
        answers: [
          { text: 'Image générée par IA', isCorrect: false },
          { text: 'Photo réelle', isCorrect: true },
        ],
      },
      {
        text: md`
### Lesquels de ces usages conviennent à une question flash en direct ?

> **Piste pédagogique :** utilisez cette question pour illustrer un format à réponses multiples.

_Plusieurs réponses possibles._
        `,
        answers: [
          { text: 'Activer les connaissances préalables au début du cours', isCorrect: true },
          { text: 'Faire émerger des idées fausses au milieu d’une séance', isCorrect: true },
          { text: 'Sonder anonymement le niveau de confiance avant une révision', isCorrect: true },
          {
            text: 'L’utiliser uniquement pour des évaluations notées en fin de séquence',
            isCorrect: false,
          },
        ],
      },
      {
        text: md`
### Combien de pièces visibles possède le Rubik’s Cube classique ?

> **Piste pédagogique :** utilisez cette question pour créer un moment façon jeu télévisé, avec rythme, suspense et compétition visible entre équipes.

Il s’agit du Rubik’s Cube classique conçu par Ernő Rubik.

Ressource facultative : [Comment résoudre un Rubik’s Cube 3×3 sans expérience préalable — ressource en allemand](https://www.youtube.com/watch?v=EoINieyz6gE).
        `,
        answers: [
          { text: '28', isCorrect: false },
          { text: '26', isCorrect: true },
          { text: '24', isCorrect: false },
          { text: '22', isCorrect: false },
        ],
      },
      {
        text: md`### Dans quel langage ce code est-il écrit ?

> **Piste pédagogique :** utilisez cette question comme reconnaissance rapide en informatique, dans des activités maker ou en STEM.

${CODE_FENCE}java
${PROCESSING_SKETCH}
${CODE_FENCE}`,
        answers: [
          { text: 'Groovy', isCorrect: false },
          { text: 'Python', isCorrect: false },
          { text: 'Processing', isCorrect: true },
          { text: 'Scala', isCorrect: false },
        ],
      },
      {
        text: md`
### Comment appelle-t-on la méthode pédagogique où les apprenant·es votent d’abord individuellement, discutent brièvement, puis votent à nouveau ?

> **Piste pédagogique :** utilisez cette question comme rappel d’un terme spécialisé pour montrer les variantes acceptées, les petites inversions de lettres et une correction transparente des réponses courtes, avec attribution de points partiels.

On cherche le terme didactique établi pour cette séquence.
        `,
        answers: [
          { text: 'Peer Instruction', isCorrect: true },
          { text: 'Peer-Instruction', isCorrect: true },
          { text: 'méthode Mazur', isCorrect: true },
          { text: 'méthode de Mazur', isCorrect: true },
        ],
      },
      {
        text: md`
### En quelle année la Révolution française a-t-elle commencé ?

> **Piste pédagogique :** utilisez cette question comme estimation en deux tours : d’abord une estimation spontanée, puis une brève discussion et une comparaison du second tour avec la valeur de référence, la bande de tolérance et le score.

On cherche l’année généralement retenue comme début de la Révolution française.
        `,
      },
      {
        text: md`
### Quelle est la probabilité que vous utilisiez bientôt un quiz en direct comme celui-ci dans l’un de vos cours ?

> **Piste pédagogique :** utilisez cette question comme prise de température, ticket de sortie ou évaluation rapide.
        `,
        ratingLabelMin: 'Pas pour l’instant',
        ratingLabelMax: 'Je vais l’essayer',
      },
      {
        text: md`### Mettez les 6 phases de la biosynthèse des protéines dans l'ordre moléculaire correct.

> **Piste pédagogique :** utilisez des questions de classement en biologie, chimie ou physique pour vous entraîner aux chaînes de réaction complexes.

Mettez les étapes dans l'ordre, du déroulement de l'ADN dans le noyau au repliement 3D final de la protéine dans le cytoplasme.`,
        orderingItems: [
          { id: 'step1', text: 'Déroulement : L\'ARN polymérase se lie au promoteur et déroule la double hélice d\'ADN.' },
          { id: 'step2', text: 'Transcription : Lecture du brin codant et synthèse de l\'ARN pré-messager complémentaire.' },
          { id: 'step3', text: 'Maturation : Épissage de l\'ARN pré-messager (retrait des introns) et ajout de la coiffe et queue poly-A.' },
          { id: 'step4', text: 'Export nucléaire : L\'ARN messager mature quitte le noyau par les pores vers les ribosomes.' },
          { id: 'step5', text: 'Traduction : Le ribosome lit l\'ARNm ; les ARNt assemblent les acides aminés au codon AUG.' },
          { id: 'step6', text: 'Repliement : La chaîne d\'acides aminés se replie en une structure protéique 3D fonctionnelle.' },
        ],
      },
      {
        text: md`### Associez les dates historiques de la République de Weimar à l'événement correspondant.

> **Piste pédagogique :** utilisez des questions d'association en histoire ou géographie pour vérifier des dates clés ou traités de manière 1:1.

_Associez chaque date à gauche à l'événement historique correspondant à droite._`,
        matchingPairs: [
          { left: '9 novembre 1918', right: 'Proclamation de la République allemande par Philipp Scheidemann' },
          { left: '28 juin 1919', right: 'Signature du traité de Versailles' },
          { left: '11 août 1919', right: 'Entrée en vigueur de la Constitution de Weimar' },
          { left: '15 novembre 1923', right: 'Lancement du Rentenmark qui stoppe l\'hyperinflation' },
          { left: '25 octobre 1929', right: 'Krach de Wall Street ("Vendredi noir") déclenchant la Grande Dépression' },
          { left: '30 janvier 1933', right: 'Nomination d\'Adolf Hitler comme chancelier marquant la fin de la République' },
        ],
      },
      {
        text: md`### Classifiez les 9 œuvres littéraires, citations et motifs suivants dans leur période correspondante.

> **Piste pédagogique :** utilisez des questions de catégorisation en littérature ou langues vivantes pour classer des mouvements littéraires.

_Associez chaque élément à l'un des trois mouvements littéraires._`,
        categories: [
          { id: 'cat_aufklaerung', name: 'Lumières / Aufklärung (v. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (v. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romantisme (v. 1795–1835)' },
        ],
        categorizationItems: [
          { text: 'Nathan le Sage (G. E. Lessing & Parabole de l\'anneau / Tolérance)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Les Souffrances du jeune Werther (J. W. von Goethe & Passion débordante)', correctCategoryId: 'cat_sturm' },
          { text: 'La Statue de marbre & Poème "Mondnacht" (Joseph von Eichendorff)', correctCategoryId: 'cat_romantik' },
          { text: '"Sapere aude ! – Aie le courage de te servir de ton propre entendement !" (Immanuel Kant)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Poème "Prométhée" ("Couvre ton ciel, Zeus, de vapeurs de nuages...")', correctCategoryId: 'cat_sturm' },
          { text: 'La "Fleur bleue" comme symbole central de la nostalgie (Novalis)', correctCategoryId: 'cat_romantik' },
          { text: 'Intrigue et Amour (Friedrich Schiller & Critique sociale)', correctCategoryId: 'cat_sturm' },
          { text: 'Emilia Galotti (G. E. Lessing & Tragédie bourgeoise)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'L\'Homme au sable & Romantisme noir / L\'Inquiétante étrangeté (E. T. A. Hoffmann)', correctCategoryId: 'cat_romantik' },
        ],
      },
    ],
  },
  es: {
    name: 'Showcase docente: demo por equipos',
    teamNames: ['Equipo 🍎', 'Equipo 🍐'],
    description: md`![Showcase docente](${PI_IMAGE_URL})

# Showcase docente

Esta demo está pensada para el **uso real en el aula**. No pretende ser el quiz perfecto de principio a fin. Su objetivo es otro: mostrar a docentes, formadores y facilitadores cómo arsnova.eu puede hacer que una sesión en vivo sea más variada, más visual y más lúdica.

Úsala como una **demo breve por equipos, al estilo Kahoot, para clases en vivo** para mostrar cómo puedes:
- arrancar con un check-in emocional o social
- usar imágenes en lugar de preguntas solo de texto
- incorporar fórmulas y notación científica en STEM
- probar preguntas de estimación numérica con valor de referencia, banda de tolerancia y dos rondas
- recoger respuestas breves en texto libre que después reaparecen como nube de palabras
- usar bien preguntas de respuesta múltiple y escalas de valoración
- añadir energía con temporizadores, equipos, clasificación y códigos de bonificación
- mostrar fragmentos de código en informática o en materias técnicas

Las preguntas están mezcladas a propósito. La idea es darte ejemplos concretos para rompehielos, comprobaciones de comprensión, reinicios de atención y momentos interactivos breves que puedas reutilizar en clase.

**Consejo para la demo:** Únete también a la sesión desde un segundo dispositivo, idealmente escaneando el código QR con el móvil. Así podrás ensayar de forma realista el cambio entre la vista del anfitrión y la experiencia del participante.

**Otro consejo:** Después abre el cuestionario en modo de edición para ver cómo están hechas las preguntas con Markdown y KaTeX.

**Y una cosa más:** Si echas en falta otros tipos de pregunta o funciones, puedes pedirlos sin problema. Encontrarás los datos de contacto en el aviso legal.`,
    questions: [
      {
        text: md`### ¿Cómo está el grupo ahora mismo?

> **Uso didáctico:** Úsalo como check-in rápido al empezar la clase, antes de dar feedback o después de una actividad exigente.

![Resumen de emociones](${EMOTION_IMAGE_URL})

*Haz clic para ampliar.*`,
        answers: [
          { text: ':smile: Con ganas de empezar', isCorrect: false },
          { text: ':cry: Un poco saturado/a', isCorrect: false },
          { text: ':rage: Frustrado/a', isCorrect: false },
          { text: ':neutral_face: Más o menos bien', isCorrect: false },
        ],
      },
      {
        text: md`### Redondea $\pi$ a dos decimales.

> **Uso didáctico:** Úsalo como una consigna breve de STEM que combine fórmulas, medios y respuesta abierta.

![El número pi](${PI_IMAGE_URL})

Leonhard Euler:

$$e^{i \pi} + 1 = 0$$

Karl Weierstraß:

$$\pi = \int_{-\infty}^{\infty} \frac{\mathrm{d}x}{1 + x^2} = 2 \cdot \int_{-1}^{1} \frac{\mathrm{d}x}{1 + x^2}$$`,
      },
      {
        text: md`### ¿Imagen creada por IA o foto real?

> **Uso didáctico:** Úsalo como calentamiento visual, reinicio de atención o punto de partida para una conversación sencilla.

![Escena en una azotea](${ROOFTOP_SCENE_IMAGE_URL})`,
        answers: [
          { text: 'Imagen generada por IA', isCorrect: false },
          { text: 'Foto real', isCorrect: true },
        ],
      },
      {
        text: md`
### ¿Cuáles de estos usos encajan bien con una comprobación rápida en directo?

> **Uso didáctico:** Úsalo para mostrar una pregunta de respuesta múltiple con varias opciones correctas.

_Puede haber varias respuestas correctas._
        `,
        answers: [
          { text: 'Activar conocimientos previos al inicio de la clase', isCorrect: true },
          { text: 'Detectar malentendidos a mitad de la sesión', isCorrect: true },
          {
            text: 'Medir de forma anónima la confianza antes de repasar para un examen',
            isCorrect: true,
          },
          { text: 'Usarlo solo para pruebas calificadas al final de una unidad', isCorrect: false },
        ],
      },
      {
        text: md`
### ¿Cuántas piezas visibles tiene el cubo de Rubik clásico?

> **Uso didáctico:** Úsalo para crear un momento tipo concurso, con ritmo, suspense y competencia visible entre equipos.

La pregunta se refiere al cubo de Rubik clásico diseñado por Ernő Rubik.

Sugerencia opcional: [Wie man einen 3×3 Zauberwürfel ohne Erfahrung löst (en alemán)](https://www.youtube.com/watch?v=EoINieyz6gE).
        `,
        answers: [
          { text: '28', isCorrect: false },
          { text: '26', isCorrect: true },
          { text: '24', isCorrect: false },
          { text: '22', isCorrect: false },
        ],
      },
      {
        text: md`### ¿En qué lenguaje está escrito este código?

> **Uso didáctico:** Úsalo como reconocimiento rápido en informática, maker o asignaturas STEM.

${CODE_FENCE}java
${PROCESSING_SKETCH}
${CODE_FENCE}`,
        answers: [
          { text: 'Groovy', isCorrect: false },
          { text: 'Python', isCorrect: false },
          { text: 'Processing', isCorrect: true },
          { text: 'Scala', isCorrect: false },
        ],
      },
      {
        text: md`
### ¿Cómo se llama el método didáctico en el que el alumnado vota primero de forma individual, luego debate brevemente y después vuelve a votar?

> **Uso didáctico:** Úsalo como una pregunta exigente de recuerdo de conceptos para mostrar variantes explícitas, letras vecinas intercambiadas y retroalimentación transparente en respuestas cortas con puntos parciales.

Buscamos el término pedagógico establecido para esta secuencia.
        `,
        answers: [
          { text: 'Peer Instruction', isCorrect: true },
          { text: 'instrucción entre pares', isCorrect: true },
          { text: 'método Mazur', isCorrect: true },
          { text: 'método de Mazur', isCorrect: true },
        ],
      },
      {
        text: md`
### ¿En qué año comenzó la Revolución francesa?

> **Uso didáctico:** Úsalo como pregunta de estimación en dos rondas: primero recoge estimaciones espontáneas, luego debatid brevemente y comparad la segunda ronda con el valor de referencia, la banda de tolerancia y la puntuación.

Buscamos el año que se suele tomar como inicio de la Revolución francesa.
        `,
      },
      {
        text: md`
### ¿Qué probabilidad hay de que pruebes pronto un quiz en vivo como este en una de tus clases?

> **Uso didáctico:** Úsalo como pulso rápido, exit ticket o valoración breve de confianza.
        `,
        ratingLabelMin: 'Todavía no',
        ratingLabelMax: 'Lo voy a probar',
      },
      {
        text: md`### Ordena las 6 fases de la biosíntesis de proteínas en la secuencia molecular correcta.

> **Uso didáctico:** Úsalo como pregunta de ordenación en biología o química para ensayar cadenas de reacción complejas antes de los exámenes.

Ordena los pasos desde el desenrollamiento del ADN en el núcleo hasta el plegamiento 3D final de la proteína en el citoplasma.`,
        orderingItems: [
          { id: 'step1', text: 'Desenrollamiento: La ARN polimerasa se une al promotor y desenrolla la doble hélice de ADN.' },
          { id: 'step2', text: 'Transcripción: Lectura de la hebra molde y síntesis del ARN pre-mensajero complementario.' },
          { id: 'step3', text: 'Procesamiento: Empalme del ARN pre-mensajero (eliminación de intrones) y adición de capuchón y cola poli-A.' },
          { id: 'step4', text: 'Exportación nuclear: El ARN mensajero maduro sale del núcleo hacia los ribosomas en el citoplasma.' },
          { id: 'step5', text: 'Traducción: El ribosoma lee el ARNm; los ARNt unen aminoácidos a partir del codón AUG.' },
          { id: 'step6', text: 'Plegamiento: La cadena de aminoácidos se pliega en una estructura proteica 3D funcional.' },
        ],
      },
      {
        text: md`### Empareja las fechas históricas de la República de Weimar con el evento correspondiente.

> **Uso didáctico:** Úsalo como pregunta de emparejamiento en historia o ciencias sociales para comprobar fechas clave o tratados 1:1.

_Relaciona cada fecha de la izquierda con su hito histórico a la derecha._`,
        matchingPairs: [
          { left: '9 de noviembre de 1918', right: 'Proclamación de la República alemana por Philipp Scheidemann' },
          { left: '28 de junio de 1919', right: 'Firma del Tratado de Versalles' },
          { left: '11 de agosto de 1919', right: 'Entrada en vigor de la Constitución de Weimar' },
          { left: '15 de noviembre de 1923', right: 'Introducción del Rentenmark para frenar la hiperinflación' },
          { left: '25 de octubre de 1929', right: 'Crack de Wall Street ("Viernes Negro") que desata la Gran Depresión' },
          { left: '30 de enero de 1933', right: 'Nombramiento de Adolf Hitler como canciller, marcando el fin de la República' },
        ],
      },
      {
        text: md`### Clasifica las siguientes 9 obras literarias, citas y motivos en su época correspondiente.

> **Uso didáctico:** Úsalo como pregunta de categorización en literatura para clasificar textos, conceptos o autores por movimientos literarios.

_Asigna cada elemento a uno de los tres movimientos literarios._`,
        categories: [
          { id: 'cat_aufklaerung', name: 'Ilustración / Aufklärung (c. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (c. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romanticismo (c. 1795–1835)' },
        ],
        categorizationItems: [
          { text: 'Natán el Sabio (G. E. Lessing & Parábola del anillo / Tolerancia)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Las cuitas del joven Werther (J. W. von Goethe & Pasión desbordante)', correctCategoryId: 'cat_sturm' },
          { text: 'La estatua de mármol y Poema "Mondnacht" (Joseph von Eichendorff)', correctCategoryId: 'cat_romantik' },
          { text: '"¡Sapere aude! – ¡Ten el valor de servirte de tu propio entendimiento!" (Immanuel Kant)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Poema "Prometeo" ("Cubre tu cielo, Zeus, con manto de nubes...")', correctCategoryId: 'cat_sturm' },
          { text: 'La "Flor Azul" como símbolo central del anhelo (Novalis)', correctCategoryId: 'cat_romantik' },
          { text: 'Intriga y amor (Friedrich Schiller & Crítica social)', correctCategoryId: 'cat_sturm' },
          { text: 'Emilia Galotti (G. E. Lessing & Tragedia burguesa)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'El hombre de la arena y Romanticismo oscuro / Lo siniestro (E. T. A. Hoffmann)', correctCategoryId: 'cat_romantik' },
        ],
      },
    ],
  },
  it: {
    name: 'Showcase didattico: demo a squadre',
    teamNames: ['Squadra 🍎', 'Squadra 🍐'],
    description: md`![Showcase didattico](${PI_IMAGE_URL})

# Showcase didattico

Questa demo è pensata per un **uso reale in classe**. Non vuole essere il quiz disciplinare perfetto dall’inizio alla fine. Il suo obiettivo è un altro: mostrare a docenti, formatori e facilitatori come arsnova.eu possa rendere una sessione dal vivo più varia, più visiva e più coinvolgente.

Usala come una **demo breve a squadre, in stile Kahoot, per lezioni dal vivo** per mostrare come puoi:
- iniziare con un check-in emotivo o sociale
- usare immagini invece di sole domande testuali
- inserire formule e notazione scientifica nelle materie STEM
- provare domande di stima numerica con valore di riferimento, fascia di tolleranza e due turni
- raccogliere risposte brevi in testo libero che poi riappaiono come nuvola di parole
- usare bene domande a scelta multipla e scale di valutazione rapide
- aggiungere energia con timer, squadre, classifica e codici bonus
- mostrare frammenti di codice in informatica o in corsi tecnici

Le domande sono volutamente varie. L’idea è offrirti spunti pratici per attività rompighiaccio, verifiche rapide della comprensione, reset dell’attenzione e brevi momenti interattivi da riutilizzare in classe.

**Suggerimento per la demo:** Entra nella sessione anche da un secondo dispositivo, idealmente scansionando il QR code con il telefono. Così puoi provare in modo realistico il passaggio tra la vista host e l’esperienza del partecipante.

**Un altro suggerimento:** Poi apri il quiz in modalità modifica per vedere come le domande sono realizzate con Markdown e KaTeX.

**E ancora una cosa:** Se ti servono altri tipi di domanda o funzionalità, puoi richiederli senza problemi. Trovi i contatti nelle note legali.`,
    questions: [
      {
        text: md`### Che clima c’è nel gruppo in questo momento?

> **Uso didattico:** Usalo come check-in rapido all’inizio della lezione, prima di un feedback o dopo una fase impegnativa.

![Panoramica delle emozioni](${EMOTION_IMAGE_URL})

*Clicca per ingrandire.*`,
        answers: [
          { text: ':smile: Pronto/a a partire', isCorrect: false },
          { text: ':cry: Un po’ sopraffatto/a', isCorrect: false },
          { text: ':rage: Frustrato/a', isCorrect: false },
          { text: ':neutral_face: Tutto sommato bene', isCorrect: false },
        ],
      },
      {
        text: md`### Arrotonda $\pi$ a due cifre decimali.

> **Uso didattico:** Usalo come prompt STEM rapido che unisce formule, media e risposta aperta.

![Il numero pi](${PI_IMAGE_URL})

Leonhard Euler:

$$e^{i \pi} + 1 = 0$$

Karl Weierstraß:

$$\pi = \int_{-\infty}^{\infty} \frac{\mathrm{d}x}{1 + x^2} = 2 \cdot \int_{-1}^{1} \frac{\mathrm{d}x}{1 + x^2}$$`,
      },
      {
        text: md`### Immagine generata dall’IA o foto reale?

> **Uso didattico:** Usalo come avvio visivo, reset dell’attenzione o spunto di discussione a bassa soglia.

![Scena sul tetto](${ROOFTOP_SCENE_IMAGE_URL})`,
        answers: [
          { text: 'Immagine generata dall’IA', isCorrect: false },
          { text: 'Foto reale', isCorrect: true },
        ],
      },
      {
        text: md`
### Quali di questi usi si prestano bene a un rapido check dal vivo?

> **Uso didattico:** Usalo per mostrare una domanda a scelta multipla con più risposte corrette.

_Sono possibili più risposte corrette._
        `,
        answers: [
          { text: 'Attivare le conoscenze pregresse all’inizio della lezione', isCorrect: true },
          { text: 'Far emergere i fraintendimenti a metà attività', isCorrect: true },
          {
            text: 'Rilevare in modo anonimo il livello di sicurezza prima del ripasso',
            isCorrect: true,
          },
          { text: 'Usarlo solo per verifiche valutate alla fine di un’unità', isCorrect: false },
        ],
      },
      {
        text: md`
### Quanti pezzi visibili ha il classico Cubo di Rubik?

> **Uso didattico:** Usalo per creare un momento in stile quiz televisivo, con ritmo, suspense e competizione visibile tra squadre.

La domanda si riferisce al classico Cubo di Rubik progettato da Ernő Rubik.

Spunto facoltativo: [Wie man einen 3×3 Zauberwürfel ohne Erfahrung löst (in tedesco)](https://www.youtube.com/watch?v=EoINieyz6gE).
        `,
        answers: [
          { text: '28', isCorrect: false },
          { text: '26', isCorrect: true },
          { text: '24', isCorrect: false },
          { text: '22', isCorrect: false },
        ],
      },
      {
        text: md`### In quale linguaggio è scritto questo codice?

> **Uso didattico:** Usalo come rapido prompt di riconoscimento in informatica, nelle attività maker o nelle materie STEM.

${CODE_FENCE}java
${PROCESSING_SKETCH}
${CODE_FENCE}`,
        answers: [
          { text: 'Groovy', isCorrect: false },
          { text: 'Python', isCorrect: false },
          { text: 'Processing', isCorrect: true },
          { text: 'Scala', isCorrect: false },
        ],
      },
      {
        text: md`
### Come si chiama il metodo didattico in cui chi apprende vota prima individualmente, poi discute brevemente e infine vota di nuovo?

> **Uso didattico:** Usalo come domanda impegnativa di richiamo terminologico per mostrare varianti esplicite, piccole inversioni di lettere adiacenti e feedback trasparente nelle risposte brevi con punti parziali.

Cerchiamo il termine didattico consolidato per questa sequenza.
        `,
        answers: [
          { text: 'Peer Instruction', isCorrect: true },
          { text: 'istruzione tra pari', isCorrect: true },
          { text: 'metodo Mazur', isCorrect: true },
          { text: 'metodo di Mazur', isCorrect: true },
        ],
      },
      {
        text: md`
### In quale anno iniziò la Rivoluzione francese?

> **Uso didattico:** Usalo come domanda di stima in due turni: prima raccogli stime spontanee, poi discutete brevemente e confrontate il secondo turno con valore di riferimento, fascia di tolleranza e punteggio.

Cerchiamo l’anno comunemente indicato come inizio della Rivoluzione francese.
        `,
      },
      {
        text: md`
### Quanto è probabile che tu provi presto un quiz live come questo in una tua lezione?

> **Uso didattico:** Usalo come rapido polso della situazione, exit ticket o autovalutazione di fiducia.
        `,
        ratingLabelMin: 'Non ancora',
        ratingLabelMax: 'Lo provo',
      },
      {
        text: md`### Metti le 6 fasi della biosintesi proteica nel corretto ordine molecolare.

> **Uso didattico:** Usalo come domanda di ordinamento in biologia o chimica per esercitarsi su catene di reazioni complesse prima degli esami.

Disponi le fasi dal srotolamento del DNA nel nucleo fino al ripiegamento 3D finale della proteina nel citoplasma.`,
        orderingItems: [
          { id: 'step1', text: 'Srotolamento: L\'RNA polimerasi si lega al promotore e srotola la doppia elica di DNA.' },
          { id: 'step2', text: 'Trascrizione: Lettura del filamento stampo e sintesi dell\'pre-mRNA complementare.' },
          { id: 'step3', text: 'Maturazione: Splicing dell\'pre-mRNA (rimozione degli introni) e aggiunta del cappuccio e coda poly-A.' },
          { id: 'step4', text: 'Esportazione nucleare: L\'mRNA maturo esce dal nucleo verso i ribosomi nel citoplasma.' },
          { id: 'step5', text: 'Traduzione: Il ribosoma legge l\'mRNA; i tRNA legano gli amminoacidi dal codone AUG.' },
          { id: 'step6', text: 'Ripiegamento: La catena amminoacidica si ripiega nella struttura proteica 3D funzionale.' },
        ],
      },
      {
        text: md`### Associa le date storiche della Repubblica di Weimar all'evento corrispondente.

> **Uso didattico:** Usalo come domanda di associazione in storia o scienze sociali per verificare date chiave o trattati 1:1.

_Collega ciascuna data a sinistra con il relativo evento storico a destra._`,
        matchingPairs: [
          { left: '9 novembre 1918', right: 'Proclamazione della Repubblica tedesca da parte di Philipp Scheidemann' },
          { left: '28 giugno 1919', right: 'Firma del Trattato di Versailles' },
          { left: '11 agosto 1919', right: 'Entrata in vigore della Costituzione di Weimar' },
          { left: '15 novembre 1923', right: 'Introduzione del Rentenmark per fermare l\'iperinflazione' },
          { left: '25 ottobre 1929', right: 'Crollo di Wall Street ("Venerdì nero") che scatena la Grande Depressione' },
          { left: '30 gennaio 1933', right: 'Nomina di Adolf Hitler a Cancelliere, che segna la fine della Repubblica' },
        ],
      },
      {
        text: md`### Classifica le seguenti 9 opere letterarie, citazioni e motivi nella loro epoca corrispondente.

> **Uso didattico:** Usalo come domanda di categorizzazione in letteratura per classificare testi o autori per movimento letterario.

_Assegna ciascun elemento a uno dei tre movimenti letterari._`,
        categories: [
          { id: 'cat_aufklaerung', name: 'Illuminismo / Aufklärung (c. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (c. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romanticismo (c. 1795–1835)' },
        ],
        categorizationItems: [
          { text: 'Nathan il saggio (G. E. Lessing & Parabola dell\'anello / Tolleranza)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'I dolori del giovane Werther (J. W. von Goethe & Passione travolgente)', correctCategoryId: 'cat_sturm' },
          { text: 'La statua di marmo & Poesia "Mondnacht" (Joseph von Eichendorff)', correctCategoryId: 'cat_romantik' },
          { text: '"Sapere aude! – Abbi il coraggio di servirti della tua propria intelligenza!" (I. Kant)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'Poesia "Prometeo" ("Copri il tuo cielo, Zeus, con veli di nubi...")', correctCategoryId: 'cat_sturm' },
          { text: 'Il "Fiore Blu" come simbolo centrale della nostalgia (Novalis)', correctCategoryId: 'cat_romantik' },
          { text: 'Intrigo e amore (Friedrich Schiller & Critica sociale)', correctCategoryId: 'cat_sturm' },
          { text: 'Emilia Galotti (G. E. Lessing & Tragedia borghese)', correctCategoryId: 'cat_aufklaerung' },
          { text: 'L\'uomo della sabbia & Romanticismo nero / Il perturbante (E. T. A. Hoffmann)', correctCategoryId: 'cat_romantik' },
        ],
      },
    ],
  },
};

for (const [locale, data] of Object.entries(LOCALES)) {
  const outPath = path.join(demoDir, `quiz-demo-showcase.${locale}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(buildPayload(data), null, 2)}\n`, 'utf8');
}

console.log('Wrote quiz-demo-showcase.{de,en,fr,es,it}.json');
