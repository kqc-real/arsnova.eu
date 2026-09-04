/**
 * Schreibt das lokalisierte Showcase-Demo-Quiz in alle fünf Seed-JSONs.
 * Aufruf: node scripts/apply-demo-quiz-locale-strings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, '../src/assets/demo');

function md(strings, ...values) {
  return String.raw({ raw: strings.raw }, ...values).trim();
}

const EXPORT_VERSION = 29;
const EXPORTED_AT = '2026-05-24T10:00:00.000Z';

const EMOTION_IMAGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/b/b4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375_%28cropped%29.jpg';
const PI_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Pi-unrolled-720.gif';
const ROOFTOP_SCENE_IMAGE_URL = '/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png';
const CODE_FENCE = '```';
const ORDERING_ITEM_IDS = [
  '5f46d99e-2bf7-4ef8-bfb3-5c90353e798d',
  '5cdfcfe2-c879-476b-b2f1-76c783571830',
  '77ac6f31-b8ce-483c-8af5-d0abdf15e88c',
  '89e52fb7-20d1-4aa8-b7d4-a1d059dd0c23',
  '1d6fb5a5-dc43-4313-9f53-48b2ff903fa4',
  'fd2f863c-6c7b-4592-b537-9f15b51ee9ec',
];
const MATCHING_LEFT_IDS = [
  '95d15b08-c999-403d-adb0-cfc18a4249ad',
  '984ef5dc-fd8c-47e9-9c57-8d6e6e799835',
  'be54805d-8643-48b0-9034-d90567bc2b12',
  '023134ad-42c5-4474-b865-1cf3142291e2',
  '10e6b6b2-9ef3-4a52-855b-592e1eb69678',
  '9e8bd516-2844-4f20-9222-6c5817327907',
];
const MATCHING_RIGHT_IDS = [
  '30b3ddd5-65c0-46c3-9184-116c6d60ec80',
  '65399907-87d5-491b-aea8-18e76093e3a4',
  'd130f8c6-42a6-423b-bc45-7382bbfce72d',
  'bc1f2b60-a2d1-45a8-bb91-9931858f0745',
  '9342f709-78d4-488b-bffb-b781b168f5c1',
  'f97e1e9a-c0fa-423d-be92-35802101930d',
];
const CATEGORIZATION_ITEM_IDS = [
  'cf0c3966-a4e5-4b0e-9ad4-aa09f9ec069b',
  'a42a3285-7b06-4a76-a89c-127d99a85a80',
  '66528b34-d7b3-43f6-8704-f0cddeccdf4f',
  '2855285d-df2a-451e-9b90-bbd8cbdc249d',
  'f3dcafbe-0a1d-45f3-984e-0dfb1a4843a0',
  '94c4b1ae-1ef0-4a22-b641-f3463b983d41',
  'd9d952ae-d363-4871-945d-b480df58b3fb',
  '6e89535f-1fc5-44f0-bfd8-2ee31bb9608f',
  'ffb67168-962f-43f1-af15-d5d1d45858bd',
];

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
  const questionText = (index) =>
    locale.questions[index].text
      .replace(
        /^> \*\*(?:Piste pédagogique :|Teaching move:|Unterrichtsidee:|Uso didattico:|Uso didáctico:)\*\*[^\n]*(?:\n+|$)/gmu,
        '',
      )
      .trim();
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
          text: questionText(0),
          type: 'SURVEY',
          timer: null,
          difficulty: 'EASY',
          order: 0,
          answers: locale.questions[0].answers,
        },
        {
          text: locale.freeTextQuestion,
          type: 'FREETEXT',
          timer: null,
          difficulty: 'EASY',
          order: 1,
          skipReadingPhase: true,
          answers: [],
          confidenceEnabled: false,
        },
        {
          text: questionText(1),
          type: 'NUMERIC_ESTIMATE',
          timer: null,
          difficulty: 'MEDIUM',
          order: 2,
          skipReadingPhase: true,
          answers: [],
          numericToleranceMode: 'ABSOLUTE_INTERVAL',
          numericReferenceValue: 3.14,
          numericTolerancePercent: null,
          numericIntervalLeft: 3.135,
          numericIntervalRight: 3.145,
          numericInputType: 'DECIMAL',
          numericDecimalPlaces: 2,
          numericMin: 3,
          numericMax: 3.5,
          numericTwoRounds: false,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(2),
          type: 'SINGLE_CHOICE',
          timer: null,
          difficulty: 'EASY',
          order: 3,
          answers: locale.questions[2].answers,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(3),
          type: 'MULTIPLE_CHOICE',
          timer: null,
          difficulty: 'MEDIUM',
          order: 4,
          skipReadingPhase: true,
          answers: locale.questions[3].answers,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(4),
          type: 'SINGLE_CHOICE',
          timer: null,
          difficulty: 'HARD',
          order: 5,
          answers: locale.questions[4].answers,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(5),
          type: 'SINGLE_CHOICE',
          timer: null,
          difficulty: 'MEDIUM',
          order: 6,
          answers: locale.questions[5].answers,
        },
        {
          text: questionText(6),
          type: 'SHORT_TEXT',
          timer: null,
          difficulty: 'HARD',
          order: 7,
          answers: locale.questions[6].answers,
          shortTextMaxLength: 32,
          shortTextCaseSensitive: false,
          shortTextEvaluationMode: 'auto',
          shortTextToleranceLevel: 'medium',
          shortTextAllowPartialCredit: true,
          shortTextTrimWhitespace: true,
          shortTextNormalizeWhitespace: true,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(7),
          type: 'NUMERIC_ESTIMATE',
          timer: null,
          difficulty: 'MEDIUM',
          order: 8,
          answers: [],
          numericToleranceMode: 'ABSOLUTE_INTERVAL',
          numericReferenceValue: 1789,
          numericTolerancePercent: null,
          numericIntervalLeft: 1788.5,
          numericIntervalRight: 1789.5,
          numericInputType: 'INTEGER',
          numericMin: 1500,
          numericMax: 2000,
          numericTwoRounds: true,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(9),
          type: 'ORDERING',
          timer: null,
          difficulty: 'HARD',
          order: 9,
          answers: [],
          orderingItems: locale.questions[9].orderingItems.map((item, index) => ({
            ...item,
            id: ORDERING_ITEM_IDS[index],
          })),
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(10),
          type: 'MATCHING',
          timer: null,
          difficulty: 'MEDIUM',
          order: 10,
          answers: [],
          matchingPairs: locale.questions[10].matchingPairs.map((pair, index) => ({
            leftId: MATCHING_LEFT_IDS[index],
            ...pair,
            rightId: MATCHING_RIGHT_IDS[index],
          })),
          matchingShuffleRight: true,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(11),
          type: 'CATEGORIZATION',
          timer: null,
          difficulty: 'MEDIUM',
          order: 11,
          answers: [],
          categories: locale.questions[11].categories,
          categorizationItems: locale.questions[11].categorizationItems.map((item, index) => ({
            id: CATEGORIZATION_ITEM_IDS[index],
            ...item,
          })),
          categorizationShuffleItems: true,
          confidenceEnabled: true,
          confidenceLabelLow: locale.confidenceLabelLow,
          confidenceLabelHigh: locale.confidenceLabelHigh,
        },
        {
          text: questionText(8),
          type: 'RATING',
          timer: null,
          difficulty: 'EASY',
          order: 12,
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
    confidenceLabelLow: 'Sehr unsicher',
    confidenceLabelHigh: 'Sehr sicher',
    freeTextQuestion: md`
### Was hilft dir beim Lernen?

Die Antworten werden als Wortwolke dargestellt.
    `,
    description: md`![Praxis-Showcase](${PI_IMAGE_URL})

# Praxis-Showcase für den Unterricht

Die 13 Fragen zeigen alle zehn Quiz-Fragetypen von arsnova.eu in einem kompakten Live-Ablauf. Du kannst Bilder, Markdown und KaTeX einsetzen, die Antwortsicherheit als Selbsteinschätzung nach bewertbaren Fragen erheben und numerische Fragen auch in zwei Diskussionsrunden durchführen.

Die Demo zeigt außerdem, wie du **Schritte sortierst**, **Begriffe eindeutig zuordnest**, **Beispiele kategorisierst** sowie mit einer offenen Freitextfrage Antworten aus dem Raum sammelst und als Wortwolke besprichst. Nach der Auflösung machen Musterlösungen und Verteilungen typische Unsicherheiten und Verwechslungen sichtbar.

Timer, Teams, Rangliste und Bonus-Codes ergänzen den spielerischen Ablauf. Tritt der Session für die Demo auf einem zweiten Gerät bei und öffne das Quiz anschließend im Bearbeitungsmodus, um die Umsetzung zu erkunden.`,
    questions: [
      {
        text: md`### Wie ist die Stimmung im Raum gerade?

> **Unterrichtsidee:** Nutze das als kurzen Check-in zu Beginn, vor Feedback oder nach einer anspruchsvollen Phase.

![Emotionen im Überblick](${EMOTION_IMAGE_URL})

*[credit] Pass / Le Brun (1821), via Wikimedia Commons*

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
          {
            text: 'Individuelle Prüfungsnoten ohne Identitätsnachweis vergeben',
            isCorrect: false,
          },
          {
            text: 'Komplexe Lernziele anhand einer einzigen Abstimmung abschließend bewerten',
            isCorrect: false,
          },
        ],
      },
      {
        text: md`
### Aus wie vielen von außen sichtbaren Einzelwürfeln (Cubies) besteht ein klassischer 3×3-Zauberwürfel?

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
        text: md`### Für welche Creative-Coding-Umgebung wurde dieses Sketch geschrieben?

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
        ratingLabelMin: 'Sehr unwahrscheinlich',
        ratingLabelMax: 'Sehr wahrscheinlich',
      },
      {
        text: md`
### Ordne die Schritte der Genexpression in einer eukaryotischen Zelle.

> **Unterrichtsidee:** Nutze Sortierfragen in Biologie, Chemie oder Physik, um komplexere mehrstufige Reaktionsketten vor dem Abitur prüfungssicher einzuüben.

Bringe die sechs Schritte in die korrekte Abfolge.
        `,
        orderingItems: [
          {
            id: 'step1',
            text: 'Transkription',
          },
          {
            id: 'step2',
            text: 'RNA-Prozessierung',
          },
          {
            id: 'step3',
            text: 'Export der reifen mRNA',
          },
          {
            id: 'step4',
            text: 'Initiation der Translation',
          },
          {
            id: 'step5',
            text: 'Elongation der Polypeptidkette',
          },
          {
            id: 'step6',
            text: 'Termination und Freisetzung der Polypeptidkette',
          },
        ],
      },
      {
        text: md`
### Ordne den historischen Daten der Weimarer Republik das passende Ereignis zu.

> **Unterrichtsidee:** Nutze Zuordnungsfragen in Geschichte, SOWI oder Geografie, um Schlüsseldaten, Verträge oder Verfassungsorgane 1:1 barrierefrei abzufragen.

_Wähle zu jedem Datum auf der linken Seite das historische Ereignis aus._
        `,
        matchingPairs: [
          {
            left: '9. November 1918',
            right: 'Ausrufung der Republik durch Philipp Scheidemann',
          },
          {
            left: '28. Juni 1919',
            right: 'Unterzeichnung des Versailler Vertrags',
          },
          {
            left: '11. August 1919',
            right: 'Unterzeichnung der Weimarer Reichsverfassung durch Friedrich Ebert',
          },
          {
            left: '15. November 1923',
            right: 'Einführung der Rentenmark',
          },
          {
            left: '29. Oktober 1929',
            right: 'Massiver Kurseinbruch an der Wall Street („Black Tuesday“)',
          },
          {
            left: '30. Januar 1933',
            right: 'Ernennung Adolf Hitlers zum Reichskanzler',
          },
        ],
      },
      {
        text: md`
### Ordne die folgenden sechs Werke der richtigen Literaturepoche zu.

> **Unterrichtsidee:** Nutze Kategorisierungsfragen im Deutsch- oder Fremdsprachenunterricht, um mehrere Texte, Schlüsselbegriffe oder Autoren Epochen und Stilrichtungen zuzuordnen.

_Ordne jedes Element einer der drei Literaturepochen zu._
        `,
        categories: [
          { id: 'cat_aufklaerung', name: 'Aufklärung (ca. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (ca. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romantik (ca. 1795–1835)' },
        ],
        categorizationItems: [
          {
            text: 'Nathan der Weise',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Emilia Galotti',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Die Leiden des jungen Werther',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'Die Räuber',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'Der Sandmann',
            correctCategoryId: 'cat_romantik',
          },
          {
            text: 'Mondnacht',
            correctCategoryId: 'cat_romantik',
          },
        ],
      },
    ],
  },
  en: {
    name: 'Teaching Showcase: Live Team Demo',
    teamNames: ['Team 🍎', 'Team 🍐'],
    confidenceLabelLow: 'Very unsure',
    confidenceLabelHigh: 'Very confident',
    freeTextQuestion: md`
### What helps you learn?

The responses will be displayed as a word cloud.
    `,
    description: md`![Teaching showcase](${PI_IMAGE_URL})

# Teaching Practice Showcase

These 13 questions demonstrate all ten arsnova.eu quiz formats in one concise live sequence. You can use images, Markdown and KaTeX, collect answer confidence after graded questions, and run a numeric question in two discussion rounds.

The showcase also demonstrates how learners **order steps**, **match terms one to one**, **categorise examples**, and collect open free-text responses from the group and discuss them as a word cloud. Once results are revealed, model solutions and distributions expose uncertainty and common mix-ups.

Timers, teams, the leaderboard and bonus codes add a playful rhythm. Join on a second device during the demo, then open the quiz editor to explore how each question is built.`,
    questions: [
      {
        text: md`### How is the room feeling right now?

> **Teaching move:** Use this as a quick check-in at the start of class, before feedback, or after a demanding task.

![Overview of emotions](${EMOTION_IMAGE_URL})

*[credit] Pass / Le Brun (1821), via Wikimedia Commons*

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
          { text: 'Award individual exam grades without verified identities', isCorrect: false },
          {
            text: 'Make a final judgement on complex learning goals from one poll',
            isCorrect: false,
          },
        ],
      },
      {
        text: md`
### How many externally visible cubies make up a classic 3×3 Rubik’s Cube?

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
        text: md`### Which creative-coding environment was this sketch written for?

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
        ratingLabelMin: 'Very unlikely',
        ratingLabelMax: 'Very likely',
      },
      {
        text: md`
### Put the steps of gene expression in a eukaryotic cell into the correct order.

> **Teaching move:** Use ordering prompts in biology, chemistry, or physics to practice multi-step reaction chains before exams.

Arrange the six steps in the correct sequence.
        `,
        orderingItems: [
          {
            id: 'step1',
            text: 'Transcription',
          },
          {
            id: 'step2',
            text: 'RNA processing',
          },
          {
            id: 'step3',
            text: 'Export of mature mRNA',
          },
          {
            id: 'step4',
            text: 'Initiation of translation',
          },
          {
            id: 'step5',
            text: 'Elongation of the polypeptide chain',
          },
          {
            id: 'step6',
            text: 'Termination and release of the polypeptide chain',
          },
        ],
      },
      {
        text: md`
### Match the historical dates of the Weimar Republic to the corresponding event.

> **Teaching move:** Use matching prompts in history, social studies, or geography to check key dates, treaties, or constitutional organs 1:1.

_Match each date on the left to its historical milestone on the right._
        `,
        matchingPairs: [
          {
            left: '9 November 1918',
            right: 'Proclamation of the Republic by Philipp Scheidemann',
          },
          {
            left: '28 June 1919',
            right: 'Signing of the Treaty of Versailles',
          },
          {
            left: '11 August 1919',
            right: 'Signing of the Weimar Constitution by Friedrich Ebert',
          },
          {
            left: '15 November 1923',
            right: 'Introduction of the Rentenmark',
          },
          {
            left: '29 October 1929',
            right: 'Massive Wall Street price collapse ("Black Tuesday")',
          },
          {
            left: '30 January 1933',
            right: 'Appointment of Adolf Hitler as Chancellor',
          },
        ],
      },
      {
        text: md`
### Categorise the following six works by literary period.

> **Teaching move:** Use categorization prompts in literature or language learning to sort works, concepts, or authors into literary periods.

_Assign each item to one of the three literary movements._
        `,
        categories: [
          { id: 'cat_aufklaerung', name: 'Enlightenment (c. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (c. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romanticism (c. 1795–1835)' },
        ],
        categorizationItems: [
          {
            text: 'Nathan the Wise',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Emilia Galotti',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'The Sorrows of Young Werther',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'The Robbers',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'The Sandman',
            correctCategoryId: 'cat_romantik',
          },
          {
            text: 'Moonlit Night',
            correctCategoryId: 'cat_romantik',
          },
        ],
      },
    ],
  },
  fr: {
    name: 'Démonstration pédagogique : quiz en équipe',
    teamNames: ['Équipe 🍎', 'Équipe 🍐'],
    confidenceLabelLow: 'Très incertain·e',
    confidenceLabelHigh: 'Très sûr·e',
    freeTextQuestion: md`
### Qu’est-ce qui t’aide à apprendre ?

Les réponses seront affichées sous forme de nuage de mots.
    `,
    description: md`![Démonstration pédagogique](${PI_IMAGE_URL})

# Démonstration pédagogique

Ces 13 questions présentent les dix formats de quiz d’arsnova.eu dans un parcours en direct concis. Tu peux utiliser des images, Markdown et KaTeX, recueillir le degré de confiance après les questions notées et organiser une question numérique en deux tours de discussion.

La démonstration montre aussi comment **ordonner des étapes**, **associer des termes un à un**, **classer des exemples** et recueillir des réponses libres et les discuter sous forme de nuage de mots. Après la révélation, les solutions modèles et les répartitions font apparaître les hésitations et les confusions fréquentes.

Les chronos, les équipes, le classement et les codes bonus donnent du rythme. Rejoins la session sur un deuxième appareil pendant la démo, puis ouvre l’éditeur pour découvrir la construction des questions.`,
    questions: [
      {
        text: md`### Comment se sent le groupe en ce moment ?

> **Piste pédagogique :** utilisez cette question comme sondage d’humeur rapide au début du cours, avant un débriefing ou après une activité exigeante.

![Aperçu des émotions](${EMOTION_IMAGE_URL})

*[credit] Pass / Le Brun (1821), via Wikimedia Commons*

*Cliquer pour agrandir.*`,
        answers: [
          { text: ':smile: Prêt·e à s’y mettre', isCorrect: false },
          { text: ':cry: Un peu dépassé·e', isCorrect: false },
          { text: ':rage: Frustré·e', isCorrect: false },
          { text: ':neutral_face: Ça va', isCorrect: false },
        ],
      },
      {
        text: md`### Arrondis $\pi$ à deux décimales.

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
          {
            text: 'Attribuer des notes individuelles sans vérifier les identités',
            isCorrect: false,
          },
          {
            text: 'Évaluer définitivement des objectifs complexes à partir d’un seul vote',
            isCorrect: false,
          },
        ],
      },
      {
        text: md`
### Combien de petits cubes visibles de l’extérieur composent un Rubik’s Cube 3×3 classique ?

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
        text: md`### Pour quel environnement de creative coding ce sketch a-t-il été écrit ?

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
### Quelle est la probabilité que tu utilises bientôt un quiz en direct comme celui-ci dans l’un de tes cours ?

> **Piste pédagogique :** utilisez cette question comme prise de température, ticket de sortie ou évaluation rapide.
        `,
        ratingLabelMin: 'Très peu probable',
        ratingLabelMax: 'Très probable',
      },
      {
        text: md`
### Mets dans l’ordre les étapes de l’expression des gènes dans une cellule eucaryote.

> **Piste pédagogique :** utilisez des questions de classement en biologie, chimie ou physique pour vous entraîner aux chaînes de réaction complexes.

Mets les six étapes dans la bonne séquence.
        `,
        orderingItems: [
          {
            id: 'step1',
            text: 'Transcription',
          },
          {
            id: 'step2',
            text: 'Maturation de l’ARN',
          },
          {
            id: 'step3',
            text: 'Export de l’ARNm mature',
          },
          {
            id: 'step4',
            text: 'Initiation de la traduction',
          },
          {
            id: 'step5',
            text: 'Élongation de la chaîne polypeptidique',
          },
          {
            id: 'step6',
            text: 'Terminaison et libération de la chaîne polypeptidique',
          },
        ],
      },
      {
        text: md`
### Associe chaque date de la République de Weimar à l’événement correspondant.

> **Piste pédagogique :** utilisez des questions d'association en histoire ou géographie pour vérifier des dates clés ou traités de manière 1:1.

_Associe chaque date à gauche à l’événement historique correspondant à droite._
        `,
        matchingPairs: [
          {
            left: '9 novembre 1918',
            right: 'Proclamation de la République par Philipp Scheidemann',
          },
          { left: '28 juin 1919', right: 'Signature du traité de Versailles' },
          {
            left: '11 août 1919',
            right: 'Signature de la Constitution de Weimar par Friedrich Ebert',
          },
          {
            left: '15 novembre 1923',
            right: 'Introduction du Rentenmark',
          },
          {
            left: '29 octobre 1929',
            right: 'Effondrement massif des cours à Wall Street (« Black Tuesday »)',
          },
          {
            left: '30 janvier 1933',
            right: 'Nomination d’Adolf Hitler comme chancelier',
          },
        ],
      },
      {
        text: md`
### Classe les six œuvres suivantes dans leur période littéraire.

> **Piste pédagogique :** utilisez des questions de catégorisation en littérature ou langues vivantes pour classer des mouvements littéraires.

_Associe chaque élément à l’un des trois mouvements littéraires._
        `,
        categories: [
          { id: 'cat_aufklaerung', name: 'Lumières / Aufklärung (v. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (v. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romantisme (v. 1795–1835)' },
        ],
        categorizationItems: [
          {
            text: 'Nathan le Sage',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Emilia Galotti',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Les Souffrances du jeune Werther',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'Les Brigands',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'L’Homme au sable',
            correctCategoryId: 'cat_romantik',
          },
          {
            text: 'Nuit de lune',
            correctCategoryId: 'cat_romantik',
          },
        ],
      },
    ],
  },
  es: {
    name: 'Demostración didáctica: cuestionario por equipos',
    teamNames: ['Equipo 🍎', 'Equipo 🍐'],
    confidenceLabelLow: 'Muy inseguro/a',
    confidenceLabelHigh: 'Muy seguro/a',
    freeTextQuestion: md`
### ¿Qué te ayuda a aprender?

Las respuestas se mostrarán como una nube de palabras.
    `,
    description: md`![Demostración didáctica](${PI_IMAGE_URL})

# Demostración didáctica

Estas 13 preguntas presentan los diez formatos de cuestionario de arsnova.eu en una secuencia breve y dinámica. Puedes usar imágenes, Markdown y KaTeX, recoger el grado de seguridad tras las preguntas evaluadas y plantear una pregunta numérica en dos rondas de debate.

La demostración también muestra cómo **ordenar pasos**, **relacionar términos uno a uno**, **clasificar ejemplos** y recoger respuestas abiertas y comentarlas en forma de nube de palabras. Al mostrar los resultados, las soluciones y distribuciones revelan dudas y confusiones frecuentes.

Los temporizadores, los equipos, la clasificación y los códigos de bonificación aportan ritmo. Entra desde un segundo dispositivo durante la demostración y abre después el editor para explorar cada pregunta.`,
    questions: [
      {
        text: md`### ¿Cómo está el grupo ahora mismo?

> **Uso didáctico:** Úsalo como check-in rápido al empezar la clase, antes de dar feedback o después de una actividad exigente.

![Resumen de emociones](${EMOTION_IMAGE_URL})

*[credit] Pass / Le Brun (1821), via Wikimedia Commons*

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
            text: 'Asignar notas individuales sin comprobar la identidad',
            isCorrect: false,
          },
          {
            text: 'Evaluar definitivamente objetivos complejos a partir de una sola votación',
            isCorrect: false,
          },
        ],
      },
      {
        text: md`
### ¿Cuántos cubitos visibles desde el exterior forman un cubo de Rubik 3×3 clásico?

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
        text: md`### ¿Para qué entorno de programación creativa se escribió este sketch?

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
### ¿Qué probabilidad hay de que pruebes pronto un cuestionario en directo como este en una de tus clases?

> **Uso didáctico:** Úsalo como pulso rápido, exit ticket o valoración breve de confianza.
        `,
        ratingLabelMin: 'Muy improbable',
        ratingLabelMax: 'Muy probable',
      },
      {
        text: md`
### Ordena los pasos de la expresión génica en una célula eucariota.

> **Uso didáctico:** Úsalo como pregunta de ordenación en biología o química para ensayar cadenas de reacción complejas antes de los exámenes.

Coloca los seis pasos en la secuencia correcta.
        `,
        orderingItems: [
          {
            id: 'step1',
            text: 'Transcripción',
          },
          {
            id: 'step2',
            text: 'Procesamiento del ARN',
          },
          {
            id: 'step3',
            text: 'Exportación del ARNm maduro',
          },
          {
            id: 'step4',
            text: 'Inicio de la traducción',
          },
          {
            id: 'step5',
            text: 'Elongación de la cadena polipeptídica',
          },
          {
            id: 'step6',
            text: 'Terminación y liberación de la cadena polipeptídica',
          },
        ],
      },
      {
        text: md`
### Relaciona cada fecha de la República de Weimar con el acontecimiento correspondiente.

> **Uso didáctico:** Úsalo como pregunta de emparejamiento en historia o ciencias sociales para comprobar fechas clave o tratados 1:1.

_Relaciona cada fecha de la izquierda con su hito histórico a la derecha._
        `,
        matchingPairs: [
          {
            left: '9 de noviembre de 1918',
            right: 'Proclamación de la República por Philipp Scheidemann',
          },
          { left: '28 de junio de 1919', right: 'Firma del Tratado de Versalles' },
          {
            left: '11 de agosto de 1919',
            right: 'Firma de la Constitución de Weimar por Friedrich Ebert',
          },
          {
            left: '15 de noviembre de 1923',
            right: 'Introducción del Rentenmark',
          },
          {
            left: '29 de octubre de 1929',
            right: 'Desplome masivo de las cotizaciones en Wall Street («Black Tuesday»)',
          },
          {
            left: '30 de enero de 1933',
            right: 'Nombramiento de Adolf Hitler como canciller',
          },
        ],
      },
      {
        text: md`
### Clasifica las seis obras siguientes por época literaria.

> **Uso didáctico:** Úsalo como pregunta de categorización en literatura para clasificar textos, conceptos o autores por movimientos literarios.

_Asigna cada elemento a uno de los tres movimientos literarios._
        `,
        categories: [
          { id: 'cat_aufklaerung', name: 'Ilustración / Aufklärung (c. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (c. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romanticismo (c. 1795–1835)' },
        ],
        categorizationItems: [
          {
            text: 'Natán el Sabio',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Emilia Galotti',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Las penas del joven Werther',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'Los bandidos',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'El hombre de la arena',
            correctCategoryId: 'cat_romantik',
          },
          {
            text: 'Noche de luna',
            correctCategoryId: 'cat_romantik',
          },
        ],
      },
    ],
  },
  it: {
    name: 'Dimostrazione didattica: quiz a squadre',
    teamNames: ['Squadra 🍎', 'Squadra 🍐'],
    confidenceLabelLow: 'Per niente sicuro/a',
    confidenceLabelHigh: 'Molto sicuro/a',
    freeTextQuestion: md`
### Che cosa ti aiuta a imparare?

Le risposte saranno visualizzate sotto forma di nuvola di parole.
    `,
    description: md`![Dimostrazione didattica](${PI_IMAGE_URL})

# Dimostrazione didattica

Queste 13 domande presentano tutti i dieci formati di quiz di arsnova.eu in una sequenza dal vivo compatta. Puoi usare immagini, Markdown e KaTeX, raccogliere il grado di sicurezza dopo le domande valutate e proporre una domanda numerica in due turni di discussione.

La dimostrazione mostra anche come **ordinare passaggi**, **abbinare termini uno a uno**, **classificare esempi** e raccogliere risposte aperte e discuterle sotto forma di nuvola di parole. Dopo la rivelazione, soluzioni e distribuzioni evidenziano incertezze e abbinamenti confusi.

Timer, squadre, classifica e codici bonus danno ritmo. Partecipa da un secondo dispositivo durante la dimostrazione, poi apri l’editor per esplorare ogni domanda.`,
    questions: [
      {
        text: md`### Che clima c’è nel gruppo in questo momento?

> **Uso didattico:** Usalo come check-in rapido all’inizio della lezione, prima di un feedback o dopo una fase impegnativa.

![Panoramica delle emozioni](${EMOTION_IMAGE_URL})

*[credit] Pass / Le Brun (1821), via Wikimedia Commons*

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
### Quali di questi usi sono adatti a una breve verifica in diretta?

> **Uso didattico:** Usalo per mostrare una domanda a scelta multipla con più risposte corrette.

_Sono possibili più risposte corrette._
        `,
        answers: [
          { text: 'Attivare le conoscenze pregresse all’inizio della lezione', isCorrect: true },
          { text: 'Far emergere i fraintendimenti a metà attività', isCorrect: true },
          {
            text: 'Assegnare voti individuali senza verificare l’identità',
            isCorrect: false,
          },
          {
            text: 'Valutare definitivamente obiettivi complessi con una sola votazione',
            isCorrect: false,
          },
        ],
      },
      {
        text: md`
### Da quanti cubetti visibili dall’esterno è composto un classico Cubo di Rubik 3×3?

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
        text: md`### Per quale ambiente di programmazione creativa è stato scritto questo sketch?

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
### Quanto è probabile che tu provi presto un quiz in diretta come questo in una tua lezione?

> **Uso didattico:** Usalo come rapido polso della situazione, exit ticket o autovalutazione di fiducia.
        `,
        ratingLabelMin: 'Molto improbabile',
        ratingLabelMax: 'Molto probabile',
      },
      {
        text: md`
### Metti in ordine le fasi dell’espressione genica in una cellula eucariotica.

> **Uso didattico:** Usalo come domanda di ordinamento in biologia o chimica per esercitarsi su catene di reazioni complesse prima degli esami.

Disponi i sei passaggi nella sequenza corretta.
        `,
        orderingItems: [
          {
            id: 'step1',
            text: 'Trascrizione',
          },
          {
            id: 'step2',
            text: 'Maturazione dell’RNA',
          },
          {
            id: 'step3',
            text: 'Esportazione dell’mRNA maturo',
          },
          {
            id: 'step4',
            text: 'Inizio della traduzione',
          },
          {
            id: 'step5',
            text: 'Allungamento della catena polipeptidica',
          },
          {
            id: 'step6',
            text: 'Terminazione e rilascio della catena polipeptidica',
          },
        ],
      },
      {
        text: md`
### Associa le date storiche della Repubblica di Weimar all'evento corrispondente.

> **Uso didattico:** Usalo come domanda di associazione in storia o scienze sociali per verificare date chiave o trattati 1:1.

_Collega ciascuna data a sinistra con il relativo evento storico a destra._
        `,
        matchingPairs: [
          {
            left: '9 novembre 1918',
            right: 'Proclamazione della Repubblica da parte di Philipp Scheidemann',
          },
          { left: '28 giugno 1919', right: 'Firma del Trattato di Versailles' },
          {
            left: '11 agosto 1919',
            right: 'Firma della Costituzione di Weimar da parte di Friedrich Ebert',
          },
          {
            left: '15 novembre 1923',
            right: 'Introduzione del Rentenmark',
          },
          {
            left: '29 ottobre 1929',
            right: 'Crollo massiccio delle quotazioni a Wall Street («Black Tuesday»)',
          },
          {
            left: '30 gennaio 1933',
            right: 'Nomina di Adolf Hitler a cancelliere',
          },
        ],
      },
      {
        text: md`
### Classifica le sei opere seguenti per epoca letteraria.

> **Uso didattico:** Usalo come domanda di categorizzazione in letteratura per classificare testi o autori per movimento letterario.

_Assegna ciascun elemento a uno dei tre movimenti letterari._
        `,
        categories: [
          { id: 'cat_aufklaerung', name: 'Illuminismo / Aufklärung (c. 1720–1785)' },
          { id: 'cat_sturm', name: 'Sturm und Drang (c. 1765–1785)' },
          { id: 'cat_romantik', name: 'Romanticismo (c. 1795–1835)' },
        ],
        categorizationItems: [
          {
            text: 'Nathan il saggio',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'Emilia Galotti',
            correctCategoryId: 'cat_aufklaerung',
          },
          {
            text: 'I dolori del giovane Werther',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'I masnadieri',
            correctCategoryId: 'cat_sturm',
          },
          {
            text: 'L’uomo della sabbia',
            correctCategoryId: 'cat_romantik',
          },
          {
            text: 'Notte di luna',
            correctCategoryId: 'cat_romantik',
          },
        ],
      },
    ],
  },
};

for (const [locale, data] of Object.entries(LOCALES)) {
  const outPath = path.join(demoDir, `quiz-demo-showcase.${locale}.json`);
  const json = await format(JSON.stringify(buildPayload(data)), { filepath: outPath });
  fs.writeFileSync(outPath, json, 'utf8');
}

console.log('Wrote quiz-demo-showcase.{de,en,fr,es,it}.json');
