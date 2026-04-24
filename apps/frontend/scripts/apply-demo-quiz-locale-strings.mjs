/**
 * Schreibt das lokalisierte Showcase-Demo-Quiz in alle fünf Seed-JSONs.
 * Aufruf: node scripts/apply-demo-quiz-locale-strings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, '../src/assets/demo');
const md = String.raw;

const EXPORT_VERSION = 16;
const EXPORTED_AT = '2026-04-24T14:30:00.000Z';

const EMOTION_IMAGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/b/b4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375_%28cropped%29.jpg';
const PI_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Pi-unrolled-720.gif';
const PHOTO_IMAGE_URL = 'https://cdn.imago-images.de/bild/st/0105048862/s.jpg';
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
          type: 'RATING',
          timer: null,
          difficulty: 'EASY',
          order: 6,
          answers: [],
          ratingMin: 1,
          ratingMax: 5,
          ratingLabelMin: locale.questions[6].ratingLabelMin,
          ratingLabelMax: locale.questions[6].ratingLabelMax,
        },
      ],
    },
  };
}

const LOCALES = {
  de: {
    name: 'Praxis-Showcase: Live-Teamdemo',
    teamNames: ['🍎 Apfel', '🍐 Birne'],
    description: md`![Praxis-Showcase](${PI_IMAGE_URL})

# Praxis-Showcase für den Unterricht

Diese Demo ist für den **echten Unterrichtseinsatz** gedacht. Sie will kein perfekt durchkomponiertes Fachquiz von Anfang bis Ende sein. Ihr Zweck ist ein anderer: Sie soll Lehrkräften, Dozierenden und Trainer:innen zeigen, wie arsnova.eu eine Live-Session abwechslungsreicher, visueller und spielerischer machen kann.

Nutze sie als kurze, **Kahoot-artige Team-Demo für den Live-Unterricht**, um zu zeigen, wie du:
- mit einem kurzen emotionalen oder sozialen Check-in startest
- Bilder statt reiner Textfragen einsetzt
- Formeln und wissenschaftliche Notation in MINT-Fächern einbindest
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

![Stadtfoto](${PHOTO_IMAGE_URL})`,
        answers: [
          { text: 'KI-generiertes Bild', isCorrect: false },
          { text: 'Echtes Foto', isCorrect: true },
        ],
      },
      {
        text: md`### Welche dieser Einsätze eignen sich gut für einen kurzen Live-Check?

> **Unterrichtsidee:** Nutze das, um Multiple Choice mit mehreren richtigen Antworten zu zeigen.

*Mehrere Antworten möglich.*`,
        answers: [
          { text: 'Vorwissen zu Beginn einer Stunde aktivieren', isCorrect: true },
          { text: 'Missverständnisse mitten in der Stunde sichtbar machen', isCorrect: true },
          { text: 'Vor einer Prüfung das Sicherheitsgefühl anonym abfragen', isCorrect: true },
          { text: 'Nur benotete Abschlusstests am Ende einer Einheit durchführen', isCorrect: false },
        ],
      },
      {
        text: md`### Wie viele sichtbare Teile hat der klassische Zauberwürfel?

> **Unterrichtsidee:** Nutze das für einen spielshowartigen Moment mit Tempo, Spannung und sichtbarem Teamwettbewerb.

Gemeint ist der klassische Rubik’s Cube von Ernő Rubik.`,
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
        text: md`### Wie wahrscheinlich ist es, dass du so ein Live-Quiz bald selbst einsetzt?

> **Unterrichtsidee:** Nutze das als schnelles Meinungsbild, Exit-Ticket oder Confidence-Check.`,
        ratingLabelMin: 'Eher noch nicht',
        ratingLabelMax: 'Ich probiere es aus',
      },
    ],
  },
  en: {
    name: 'Teaching Showcase: Live Team Demo',
    teamNames: ['🍎 Apple', '🍐 Pear'],
    description: md`![Teaching showcase](${PI_IMAGE_URL})

# Teaching Practice Showcase

This demo is built for **real classroom use**. It is not trying to be the perfect subject quiz from start to finish. Its job is different: it shows teachers, trainers, and facilitators how arsnova.eu can make a live session feel more varied, more visual, and more game-like.

Use it as a short, **Kahoot-style team demo for live teaching** to show how you can:
- open with a quick emotional or social check-in
- use images instead of text-only prompts
- bring in formulas and scientific notation in STEM
- collect short free-text answers from the room that later reappear as a word cloud
- use multiple-choice and quick rating prompts well
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

![City photo](${PHOTO_IMAGE_URL})`,
        answers: [
          { text: 'AI-generated image', isCorrect: false },
          { text: 'Real photo', isCorrect: true },
        ],
      },
      {
        text: md`### Which of these are strong use cases for a quick live check?

> **Teaching move:** Use this to demonstrate multiple choice with more than one correct answer.

*Select all that apply.*`,
        answers: [
          { text: 'Activate prior knowledge at the start of class', isCorrect: true },
          { text: 'Surface misconceptions halfway through a lesson', isCorrect: true },
          { text: 'Gauge confidence anonymously before exam prep', isCorrect: true },
          { text: 'Use it only for graded tests at the end of a unit', isCorrect: false },
        ],
      },
      {
        text: md`### How many visible pieces does the classic Rubik’s Cube have?

> **Teaching move:** Use this for a game-show beat with pace, suspense, and visible team competition.

The question refers to the classic Rubik’s Cube designed by Ernő Rubik.`,
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
        text: md`### How likely are you to try a live quiz like this in one of your own classes?

> **Teaching move:** Use this as a quick pulse check, exit ticket, or confidence rating.`,
        ratingLabelMin: 'Not yet',
        ratingLabelMax: 'Ready to try it',
      },
    ],
  },
  fr: {
    name: 'Showcase pédagogique : démo en équipe',
    teamNames: ['🍎 Pomme', '🍐 Poire'],
    description: md`![Showcase pédagogique](${PI_IMAGE_URL})

# Showcase pédagogique

Cette démo est pensée pour un **usage réel en classe**. Elle n’essaie pas d’être un quiz disciplinaire parfait du début à la fin. Son rôle est ailleurs : montrer aux enseignant·es, formateur·rices et animateur·rices comment arsnova.eu peut rendre une séance en direct plus variée, plus visuelle et plus ludique.

Utilise-la comme une courte **démo en équipe, façon Kahoot, pour les cours en direct** afin de montrer comment tu peux :
- démarrer avec un rapide tour d’humeur ou un check-in social
- utiliser des images plutôt que des consignes purement textuelles
- intégrer des formules et de la notation scientifique en STEM
- recueillir de courtes réponses en texte libre qui réapparaîtront ensuite sous forme de nuage de mots
- utiliser à bon escient les choix multiples et les échelles d’évaluation
- ajouter de l’énergie avec des chronos, des équipes, un classement et des codes bonus
- afficher des extraits de code en informatique ou dans des cours techniques

Les questions sont volontairement variées. L’idée est de te donner des pistes concrètes pour les échauffements, les vérifications de compréhension, les relances d’attention et les petits moments interactifs réutilisables en classe.

**Conseil pour la démo :** Rejoins la session sur un deuxième appareil, idéalement en scannant le QR code avec ton téléphone. Tu pourras ainsi rejouer de façon réaliste l’aller-retour entre la vue hôte et l’expérience participante.

**Autre conseil :** Ouvre ensuite le quiz en mode édition pour voir comment les questions sont construites avec Markdown et KaTeX.

**Et encore une chose :** Si tu souhaites d’autres formats de questions ou fonctionnalités, n’hésite pas à les demander. Les coordonnées figurent dans les mentions légales.`,
    questions: [
      {
        text: md`### Comment se sent le groupe en ce moment ?

> **Usage pédagogique :** Utilise cela comme tour d’humeur rapide au début du cours, avant un retour ou après une séquence exigeante.

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
        text: md`### Arrondis $\pi$ à deux décimales.

> **Usage pédagogique :** Utilise cela comme courte relance STEM combinant formules, médias et réponse ouverte.

![Le nombre pi](${PI_IMAGE_URL})

Leonhard Euler :

$$e^{i \pi} + 1 = 0$$

Karl Weierstraß :

$$\pi = \int_{-\infty}^{\infty} \frac{\mathrm{d}x}{1 + x^2} = 2 \cdot \int_{-1}^{1} \frac{\mathrm{d}x}{1 + x^2}$$`,
      },
      {
        text: md`### Image IA ou photo réelle ?

> **Usage pédagogique :** Utilise cela comme échauffement visuel, relance d’attention ou amorce de discussion à faible seuil.

![Photo de ville](${PHOTO_IMAGE_URL})`,
        answers: [
          { text: 'Image générée par IA', isCorrect: false },
          { text: 'Photo réelle', isCorrect: true },
        ],
      },
      {
        text: md`### Lesquels de ces usages conviennent bien à un rapide check en direct ?

> **Usage pédagogique :** Utilise cela pour montrer un choix multiple avec plusieurs bonnes réponses.

*Plusieurs réponses possibles.*`,
        answers: [
          { text: 'Activer les connaissances préalables au début du cours', isCorrect: true },
          { text: 'Faire émerger des idées fausses au milieu d’une séance', isCorrect: true },
          { text: 'Sonder anonymement le niveau de confiance avant une révision', isCorrect: true },
          { text: 'L’utiliser uniquement pour des évaluations notées en fin de séquence', isCorrect: false },
        ],
      },
      {
        text: md`### Combien de pièces visibles possède le Rubik’s Cube classique ?

> **Usage pédagogique :** Utilise cela pour créer un moment façon jeu télévisé, avec rythme, suspense et compétition visible entre équipes.

Il s’agit du Rubik’s Cube classique conçu par Ernő Rubik.`,
        answers: [
          { text: '28', isCorrect: false },
          { text: '26', isCorrect: true },
          { text: '24', isCorrect: false },
          { text: '22', isCorrect: false },
        ],
      },
      {
        text: md`### Dans quel langage ce code est-il écrit ?

> **Usage pédagogique :** Utilise cela comme question de reconnaissance rapide en informatique, dans des activités maker ou en STEM.

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
        text: md`### Quelle est la probabilité que tu essaies bientôt un quiz en direct comme celui-ci dans l’un de tes cours ?

> **Usage pédagogique :** Utilise cela comme prise de température, ticket de sortie ou auto-évaluation rapide.`,
        ratingLabelMin: 'Pas pour l’instant',
        ratingLabelMax: 'Je vais l’essayer',
      },
    ],
  },
  es: {
    name: 'Showcase docente: demo por equipos',
    teamNames: ['🍎 Manzana', '🍐 Pera'],
    description: md`![Showcase docente](${PI_IMAGE_URL})

# Showcase docente

Esta demo está pensada para el **uso real en el aula**. No pretende ser el quiz perfecto de principio a fin. Su objetivo es otro: mostrar a docentes, formadores y facilitadores cómo arsnova.eu puede hacer que una sesión en vivo sea más variada, más visual y más lúdica.

Úsala como una **demo breve por equipos, al estilo Kahoot, para clases en vivo** para mostrar cómo puedes:
- arrancar con un check-in emocional o social
- usar imágenes en lugar de preguntas solo de texto
- incorporar fórmulas y notación científica en STEM
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

![Foto de ciudad](${PHOTO_IMAGE_URL})`,
        answers: [
          { text: 'Imagen generada por IA', isCorrect: false },
          { text: 'Foto real', isCorrect: true },
        ],
      },
      {
        text: md`### ¿Cuáles de estos usos encajan bien con una comprobación rápida en directo?

> **Uso didáctico:** Úsalo para mostrar una pregunta de respuesta múltiple con varias opciones correctas.

*Puede haber varias respuestas correctas.*`,
        answers: [
          { text: 'Activar conocimientos previos al inicio de la clase', isCorrect: true },
          { text: 'Detectar malentendidos a mitad de la sesión', isCorrect: true },
          { text: 'Medir de forma anónima la confianza antes de repasar para un examen', isCorrect: true },
          { text: 'Usarlo solo para pruebas calificadas al final de una unidad', isCorrect: false },
        ],
      },
      {
        text: md`### ¿Cuántas piezas visibles tiene el cubo de Rubik clásico?

> **Uso didáctico:** Úsalo para crear un momento tipo concurso, con ritmo, suspense y competencia visible entre equipos.

La pregunta se refiere al cubo de Rubik clásico diseñado por Ernő Rubik.`,
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
        text: md`### ¿Qué probabilidad hay de que pruebes pronto un quiz en vivo como este en una de tus clases?

> **Uso didáctico:** Úsalo como pulso rápido, exit ticket o valoración breve de confianza.`,
        ratingLabelMin: 'Todavía no',
        ratingLabelMax: 'Lo voy a probar',
      },
    ],
  },
  it: {
    name: 'Showcase didattico: demo a squadre',
    teamNames: ['🍎 Mela', '🍐 Pera'],
    description: md`![Showcase didattico](${PI_IMAGE_URL})

# Showcase didattico

Questa demo è pensata per un **uso reale in classe**. Non vuole essere il quiz disciplinare perfetto dall’inizio alla fine. Il suo obiettivo è un altro: mostrare a docenti, formatori e facilitatori come arsnova.eu possa rendere una sessione dal vivo più varia, più visiva e più coinvolgente.

Usala come una **demo breve a squadre, in stile Kahoot, per lezioni dal vivo** per mostrare come puoi:
- iniziare con un check-in emotivo o sociale
- usare immagini invece di sole domande testuali
- inserire formule e notazione scientifica nelle materie STEM
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

![Foto di città](${PHOTO_IMAGE_URL})`,
        answers: [
          { text: 'Immagine generata dall’IA', isCorrect: false },
          { text: 'Foto reale', isCorrect: true },
        ],
      },
      {
        text: md`### Quali di questi usi si prestano bene a un rapido check dal vivo?

> **Uso didattico:** Usalo per mostrare una domanda a scelta multipla con più risposte corrette.

*Sono possibili più risposte corrette.*`,
        answers: [
          { text: 'Attivare le conoscenze pregresse all’inizio della lezione', isCorrect: true },
          { text: 'Far emergere i fraintendimenti a metà attività', isCorrect: true },
          { text: 'Rilevare in modo anonimo il livello di sicurezza prima del ripasso', isCorrect: true },
          { text: 'Usarlo solo per verifiche valutate alla fine di un’unità', isCorrect: false },
        ],
      },
      {
        text: md`### Quanti pezzi visibili ha il classico Cubo di Rubik?

> **Uso didattico:** Usalo per creare un momento in stile quiz televisivo, con ritmo, suspense e competizione visibile tra squadre.

La domanda si riferisce al classico Cubo di Rubik progettato da Ernő Rubik.`,
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
        text: md`### Quanto è probabile che tu provi presto un quiz live come questo in una tua lezione?

> **Uso didattico:** Usalo come rapido polso della situazione, exit ticket o autovalutazione di fiducia.`,
        ratingLabelMin: 'Non ancora',
        ratingLabelMax: 'Lo provo',
      },
    ],
  },
};

for (const [locale, data] of Object.entries(LOCALES)) {
  const outPath = path.join(demoDir, `quiz-demo-showcase.${locale}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(buildPayload(data), null, 2)}\n`, 'utf8');
}

console.log('Wrote quiz-demo-showcase.{de,en,fr,es,it}.json');
