import type { Messages } from './types';

const en: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Live quizzes, Q&A, and word clouds',
    homeDescription:
      'Run live quizzes, Q&A, word clouds, and Pulse Checks from your phone. Free, open source, self-hostable, and usable without an account. WCAG 2.2 AA.',
    siteNameInfo: 'arsnova.eu – Information',
    ogLocale: 'en_US',
  },
  nav: {
    ariaLabel: 'Main navigation',
    workflow: 'How it works',
    features: 'Features',
    accessibility: 'Accessibility',
    trust: 'Trust',
    comparison: 'Comparison',
    faq: 'FAQ',
    tryNow: 'Try it now',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    menu: 'Menu',
    skipToContent: 'Skip to content',
  },
  languageSwitcher: {
    label: 'Language',
    currentLanguage: 'English',
    chooseLanguage: 'Choose language',
  },
  themeSwitcher: {
    label: 'Appearance',
    system: 'System setting',
    light: 'Light',
    dark: 'Dark',
    chooseAppearance: 'Choose appearance',
  },
  footer: {
    impressum: 'Legal notice',
    privacy: 'Privacy',
    accessibility: 'Accessibility',
  },
  cta: {
    appOpen: 'Open app',
    quizCreate: 'Create a quiz',
    backToApp: 'Back to arsnova.eu',
    tryLive: 'Try it live now',
    howItWorks: 'How it works',
    viewOpenSource: 'View source code',
  },
  hero: {
    eyebrow: 'Audience participation for education and organizations',
    titleLine1: 'Run quizzes, collect questions,',
    titleLine2: 'hear from your audience',
    titleAccent1: 'live and free',
    titleAccent2: ' without an account.',
    lead: 'Bring live quizzes, numeric estimates, answer confidence, audience questions, word clouds, and Pulse Checks into one session. Create every question type and host from your phone, whether you’re running a class, workshop, training session, or meeting. arsnova.eu is open source, self-hostable, and designed with GDPR requirements in mind.',
    a11yLink: 'Conforms to WCAG 2.2 Level AA',
    a11ySuffix: '—keyboard support, screen readers, and adjustable response time.',
    cards: [
      {
        title: 'Create and host on a phone',
        text: 'Create every question type and run a live session from your phone',
      },
      {
        title: 'Q&A with a question wall',
        text: 'Moderation, voting, word cloud and moderation compass',
      },
      {
        title: 'Answer confidence and follow-up',
        text: 'Identify possible misconceptions and export a PDF debriefing report',
      },
      {
        title: 'Open source and self-hostable',
        text: 'Docker, PostgreSQL, Redis, and an admin activity log',
      },
    ],
  },
  estimate: {
    eyebrow: 'New in the live quiz',
    title: 'Estimate, discuss, and compare two rounds',
    lead: 'Use numeric estimates for dates, orders of magnitude, measurements, and probabilities. Set a reference value, allowed input range, and tolerance. Participants simply enter a number.',
    summary: [
      'The input range defines which values participants can enter.',
      'The tolerance range defines which estimates count as correct.',
      'The response distribution stays hidden until results are shown.',
      'Round 1 and round 2 are compared after the discussion.',
    ],
    docsLink: 'Open the numeric estimation question documentation',
    demoAria: 'Sample results for a numeric estimation question about the French Revolution',
    hostView: 'Host view after results are shown',
    demoQuestion: 'When did the French Revolution begin?',
    reference: 'Reference 1789',
    toleranceBand: 'Tolerance band',
    toleranceValue: '1700 to 1900',
    plausibilityBand: 'Allowed input range',
    plausibilityValue: '1500 to 2000',
    histogramNote:
      'The histogram, reference line, and tolerance range appear only after results are shown. Until then, only participation progress is visible.',
    median: 'Median',
    inBand: 'within tolerance',
    round2: 'Round 2',
    round2Value: '14 answers closer to the reference',
  },
  confidence: {
    eyebrow: 'Pedagogical analysis',
    title: 'Correct or incorrect—and how confident?',
    lead: 'After answering a scored question, participants can rate their confidence from 1 to 5. This helps you spot incorrect answers given with high confidence, which may indicate a misconception. Use these signals to plan your debrief and review them in the PDF report after the session.',
    summary: [
      'An optional setting for scored questions, not a separate question type.',
      'A scale from 1 to 5 after answering, with no effect on points.',
      'After results are shown, the host can compare answer correctness and confidence.',
      'Incorrect answers given with high confidence may indicate misconceptions.',
      'After the session, use the PDF debriefing report to plan your discussion.',
    ],
    docsConfidence: 'Answer confidence documentation',
    docsExport: 'PDF debriefing report documentation',
    demoAria: 'Example of answer correctness and confidence after results are shown',
    hostView: 'Host view after results are shown',
    demoQuestion: 'Which structure is the most stable?',
    badge: 'Answer confidence',
    matrix: [
      { label: 'Correct · low confidence', count: 3, tone: 'emerald' },
      { label: 'Correct · medium confidence', count: 8, tone: 'emerald' },
      { label: 'Correct · high confidence', count: 11, tone: 'emerald' },
      { label: 'Incorrect · low confidence', count: 2, tone: 'slate' },
      { label: 'Incorrect · medium confidence', count: 4, tone: 'amber' },
      { label: 'Incorrect · high confidence', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 incorrect answers with high confidence',
    falseHighText:
      'Option B was selected twice with high confidence. This may indicate a misconception to revisit during the debrief.',
    consolidated: 'Solid',
    misconceptionRisk: 'Possible misconception',
    fragile: 'Fragile',
    afterSessionAria: 'Export after the session ends',
    afterSession: 'After the session ends',
    debriefing: 'Debriefing',
    resultsPdf: 'PDF debriefing report',
    exportNote:
      'A print-ready report with understanding, answer confidence, a heatmap, and full question text. Open it from the host view or quiz card. CSV export for spreadsheets remains under “More”.',
  },
  qaWall: {
    eyebrow: 'A dedicated space for audience questions',
    title: 'Collect questions, set priorities, and spot recurring topics',
    lead: 'Use Q&A to publish audience questions, identify priorities, and address disagreements. A weighted word cloud helps bring recurring topics into the discussion.',
    signals: [
      {
        label: 'Pre-moderation',
        text: 'Review questions before publishing them to participants.',
      },
      {
        label: 'Collective voting',
        text: 'Upvotes and downvotes indicate priorities, points of disagreement and areas needing clarification.',
      },
      {
        label: 'Topic word cloud',
        text: 'Words and phrases are weighted by the selected sort: net votes, strong support, or controversy.',
      },
      {
        label: 'Moderation compass',
        text: 'A suggested next step based on questions, word clouds, quiz results, and pace feedback.',
      },
    ],
    docsLink: 'Read about Q&A sorting and controversy on GitHub',
    demoAria: 'Sample Q&A wall with moderation, voting and word cloud',
    hostView: 'Host Q&A view',
    demoTitle: 'Questions about the event',
    moderationActive: 'Pre-moderation on',
    sortMostSupported: 'Net votes',
    sortBest: 'Strong support',
    sortControversial: 'Controversy',
    questions: [
      {
        score: '+18',
        title: 'When does an estimate fall within an acceptable range?',
        meta: '15 up · 3 down · strong support',
      },
      {
        score: '+4',
        title: 'Should we really hide results before the discussion?',
        meta: '9 up · 5 down · controversial',
      },
      {
        score: '+11',
        title: 'How does Q&A differ from free text in the quiz?',
        meta: '11 up · 0 down · most supported',
      },
    ],
    wordCloud: 'Q&A word cloud',
    wordCloudHint: 'Term size reflects the weighting of the questions.',
    frozenLive: 'Display paused',
    terms: [
      { label: 'Tolerance band', className: 'text-3xl text-landing-primary' },
      { label: 'Discussion', className: 'text-2xl text-landing-status-emerald' },
      { label: 'Q&A', className: 'text-4xl text-landing-fg' },
      { label: 'Plausibility', className: 'text-xl text-landing-status-amber' },
      { label: 'Controversy', className: 'text-2xl text-landing-status-rose' },
      { label: 'Peer Instruction', className: 'text-lg text-landing-fg-muted' },
      { label: 'Moderation', className: 'text-3xl text-landing-tertiary' },
      { label: 'Need for clarification', className: 'text-xl text-landing-status-violet' },
    ],
    nextStep:
      'Next step in the compass: discuss the controversial question with the group. Open the question with a tap.',
  },
  compass: {
    eyebrow: 'Now in the live session',
    title: 'The moderation compass helps you choose your next step',
    lead: 'During a session, the compass suggests a next step based on unanswered questions, word clouds, quiz results, and pace feedback. Review the signals, open the source, and decide what to do next.',
    summary: [
      'Tap “Compass” in any live view.',
      '“Next step” at the top suggests one concrete action.',
      'Below it, review pace feedback, controversial questions, and points to clarify.',
      'Go directly to the question, word cloud, or results.',
      'You decide. The compass never runs the session on its own.',
    ],
    docsLink: 'How the compass works',
    tryLink: 'Try it in the app',
    demoAria: 'Sample moderation compass with the next step and live signals',
    hostView: 'Host view',
    demoTitle: 'Moderation compass',
    nextLabel: 'Next step',
    nextTitle: 'Discuss the controversial question with the group',
    nextText:
      'The question about hiding results has divided the group. Clarify it before moving on.',
    cards: [
      {
        label: 'Controversial questions',
        text: 'The room is split — many votes for and against.',
        tone: 'rose',
      },
      {
        label: 'Feedback on presentation pace',
        text: 'Several people say the pace is too fast. Consider a short pause.',
        tone: 'amber',
      },
      {
        label: 'To clarify',
        text: 'A strongly supported question is still waiting for your answer.',
        tone: 'violet',
      },
    ],
    sourcesLabel: 'Go directly to',
    sources: ['Q&A', 'Word cloud', 'Quiz', 'Pulse Check'],
    note: 'The compass uses only information already available to the host. It does not evaluate individual participants.',
  },
  workflow: {
    eyebrow: 'For teaching, training, and workshops',
    title: 'From idea to live session in a few minutes',
    lead: 'Prepare your content, invite participants, and host the session. The workflow takes you from creating questions to reviewing the results.',
    stepLabel: 'Step',
    steps: [
      {
        number: '01',
        title: 'Prepare a quiz',
        description:
          'Create questions or import existing content, entirely on your phone and in every format. Use Markdown, KaTeX, short answers, numeric estimates, matching, ordering, and categorization.',
      },
      {
        number: '02',
        title: 'Share the library',
        description:
          'Your quiz library stays on your device, helping protect your data. Use a sync link to open it on a borrowed computer instead of bringing a USB drive. Share the same link with colleagues to use and edit the library together. Create the link in your quiz library and paste received links on the home page.',
      },
      {
        number: '03',
        title: 'Start a session',
        description:
          'Start without an account: open a session, choose a style, and share the session code or QR code. You can also connect a phone or tablet and open the presenter view on a projector.',
      },
      {
        number: '04',
        title: 'Host live',
        description:
          'Control the session from your phone as you move around the room. Participants answer, ask questions, and help set priorities. The moderation compass suggests a next step. The host and presenter views support quizzes, Q&A, Pulse Check, word clouds, reading phases, countdowns, second votes, and results.',
      },
      {
        number: '05',
        title: 'Review and export',
        description:
          'After the session, open the PDF debriefing report with understanding, answer confidence, and full question text. The latest session’s debrief and PDF remain available from the quiz library. CSV export for spreadsheets is under “More”.',
      },
    ],
  },
  pairing: {
    eyebrow: 'What sets us apart',
    title: 'Control the presentation from your phone or tablet',
    lead: 'Connect a phone or tablet to control the session while moving around the room. Scan the QR code and confirm the connection on the computer. The connected device gets controls for the current session without needing a separate account.',
    whyTitle: 'What the connected device can do',
    summary: [
      'Move around the room while staying in control of the presentation.',
      'Control questions, results, Q&A, Pulse Check, and the end of the session, beyond just advancing slides.',
      'No account on the phone: you can hand the device to an assistant without sharing passwords.',
      'No credentials to share: show the QR code and confirm the connection on the computer. The phone gets controls for this session only.',
      'The quiz library stays on the computer. The connected device cannot edit or delete quizzes.',
    ],
    laptopLabel: 'Laptop and projector',
    laptopText:
      'The computer and projector show the presentation. Confirm the connection here. The quiz library stays on this computer.',
    phoneLabel: 'Phone or tablet',
    phoneText: 'Control the current session as you move around the room, without another account.',
    demoAria: 'Laptop shows the presentation; the phone controls the session',
  },
  features: {
    eyebrow: 'What sets arsnova.eu apart',
    title: 'Everything you need for live audience participation',
    lead: 'Start without an account and use tools to prepare, host, and review live sessions. Open source code lets you examine how the platform works.',
    items: [
      {
        title: 'Create and host on your phone',
        description:
          'Create every question type on your phone and control quizzes, Q&A, Pulse Check, and results from the same host view. Run the session without a computer, or connect a device to a projected presentation.',
        icon: 'phone',
      },
      {
        title: 'Present from anywhere in the room',
        description:
          'Connect a phone or tablet to control questions, results, Q&A, Pulse Check, and the end of the session. Scan the QR code and confirm on the computer. The quiz library stays there, so you can hand the connected device to an assistant without sharing passwords.',
        icon: 'presenter',
      },
      {
        title: 'Ready in no time',
        description:
          'Hosts start without an account. Participants join directly with a 6-character code or QR code.',
        icon: 'single',
      },
      {
        title: 'Answer confidence in live quizzes',
        description:
          'Participants rate their confidence after answering. Identify incorrect answers given with high confidence, prioritize your debrief, and review the findings in the PDF report.',
        icon: 'confidence',
      },
      {
        title: 'A debriefing report for follow-up',
        description:
          'Export a print-ready PDF after the session with charts, question text, and answer confidence. CSV export for spreadsheets remains under “More”.',
        icon: 'export',
      },
      {
        title: 'Numeric estimation questions for teaching',
        description:
          'Years, orders of magnitude and measurements can be estimated with a reference value, tolerance band, statistics and an optional second round.',
        icon: 'estimate',
      },
      {
        title: 'More than a standard quiz',
        description:
          'MC/SC, short answers, ratings, matching, ordering, categorization, reading phase, Peer Instruction and presenter mode support learning, training and live facilitation.',
        icon: 'toggle',
      },
      {
        title: 'A dedicated space for audience questions',
        description:
          'Review, publish, pin, and archive questions. Participants can upvote or downvote them. Sort by net votes, strong support, or controversy.',
        icon: 'qa',
      },
      {
        title: 'Rich word cloud',
        description:
          'Group free-text responses and Q&A questions into words and phrases. In Q&A, term size follows the selected sort: net votes, strong support, or controversy.',
        icon: 'cloud',
      },
      {
        title: 'Moderation compass in the live session',
        description:
          'Review pace feedback, controversial questions, or quiz results that need discussion. Open “Compass” to see a suggested next step and decide how to continue.',
        icon: 'compass',
      },
      {
        title: 'For different settings',
        description:
          'Presets, team mode, anonymous mode, nicknames and style options support a range of settings, from classes and seminars to workshops, events and meetings.',
        icon: 'bolt',
      },
      {
        title: 'Conforms to WCAG 2.2 Level AA',
        description:
          'Keyboard use, screen-reader status updates, individually adjustable response time and PDF/UA-1-validated results reports — so more learners can join live sessions independently.',
        icon: 'a11y',
      },
      {
        title: 'Privacy and control',
        description:
          'Quiz content stays on your device. Optional data removal and operation on your own infrastructure give you more control over content and live data.',
        icon: 'tools',
      },
      {
        title: 'Open source with deployment and operations',
        description:
          'Docker, Postgres, Redis and an admin activity log make the platform reliable for deployment, operations and auditability.',
        icon: 'server',
      },
    ],
  },
  leaderboard: {
    eyebrow: 'Gamification preset',
    title: 'A leaderboard that keeps the group engaged',
    lead: 'Animal nicknames, scores, and correct answers: a leaderboard without real names. The Gamification preset gives live results a dark, clear presentation.',
    points: [
      'Animal nicknames in place of real names',
      'Points and correct answers at a glance',
      'The same look in light and dark',
    ],
    demoAria: 'Sample live leaderboard in the Gamification preset',
    boardTitle: 'Leaderboard',
    winnerLabel: 'Winner',
    winnerMeta: 'With {score} points',
    rankCol: 'Rank',
    nicknameCol: 'Nickname',
    pointsCol: 'Points',
    correctCol: 'Correct',
    names: [
      'Coral cat',
      'Colorful parrot',
      'Brown bear',
      'Olive green mouse',
      'Light blue swan',
      'Red dragon',
      'Pink butterfly',
      'Brown bear 2',
      'Red dragon 8',
      'Sky blue giraffe',
    ],
  },
  structuredQuestionTypes: {
    eyebrow: 'Structured question types',
    title: 'Match, order, and categorize—with results you can review',
    lead: 'Explore relationships, sequences, and categories through interactive questions you can create entirely on your phone. Answer keys stay hidden during voting. After results are shown, review the correct answers and common mistakes.',
    interactionLabel: 'Interaction',
    exampleLabel: 'Teaching example',
    resultLabel: 'Results',
    scoringNote:
      'All three formats are scored. An answer currently receives full credit or no credit; partial credit is not available.',
    revealNote:
      'During voting, correct pairs, the correct order, and target categories stay hidden. The answer key and detailed response distributions appear only after results are shown.',
    items: [
      {
        id: 'matching',
        title: 'Matching',
        description:
          'Match terms, definitions or examples one to one. The results reveal common mix-ups.',
        interaction:
          'Each term receives exactly one target, each target is used once, and every match must be completed.',
        example: 'Match historical dates to the corresponding events.',
        result: 'Correct pairs, correct-response rates, and common mismatches.',
        symbol: 'A↔B',
      },
      {
        id: 'ordering',
        title: 'Ordering',
        description:
          'Put steps, events or stages of a process in the correct order. The results show which positions caused uncertainty.',
        interaction:
          'Put all items in order with visible move controls or the keyboard. Drag-and-drop is not required.',
        example: 'Order the stages of a biological process.',
        result: 'Model sequence, position distribution and common swaps.',
        symbol: '1→3',
      },
      {
        id: 'categorisation',
        title: 'Categorization',
        description:
          'Assign terms or examples to the appropriate categories. The results reveal clear distinctions and common misclassifications.',
        interaction: 'Each item receives exactly one category, and every item must be assigned.',
        example: 'Classify literary works by period.',
        result: 'Model grouping, category distribution and common misclassifications.',
        symbol: '▦',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibility',
    title: 'WCAG 2.2 AA — so more learners can take part independently',
    lead: 'For schools, universities and continuing education, accessibility is often a decisive criterion. arsnova.eu meets the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA — with keyboard use, screen-reader support, individually adjustable response time and accessibly structured PDF results reports.',
    benefits: [
      {
        title: 'Keyboard operation',
        description:
          'You and your participants can use the core workflows without a mouse. Visible focus indicators and a skip link help you navigate.',
      },
      {
        title: 'Screen-reader support in live use',
        description:
          'Screen readers announce important changes when you join a session, submit an answer, or move to a new phase.',
      },
      {
        title: 'Individually adjustable response time',
        description:
          'For timed questions, choose standard response time, “10× time”, or “No deadline”. These options help accommodate individual response-time needs during the session.',
      },
      {
        title: 'Accessibly structured results report',
        description:
          'The print-ready report is validated against PDF/UA-1 and includes a document title, language, and structure tags for accessible sharing and follow-up.',
      },
    ],
    statementLink: 'Open the accessibility statement',
  },
  trust: {
    eyebrow: 'Trust',
    title: 'Built on an established foundation',
    lead: 'arsnova.eu is part of the ARSnova ecosystem, drawing on years of research, teaching practice, and education technology development.',
    proofItems: [
      { value: 'Since 2012', label: 'ARSnova tradition in education and edtech' },
      { value: 'WCAG 2.2 AA', label: 'Verified accessibility for teaching and institutions' },
      {
        value: '5 UI languages',
        label: 'German, English, French, Spanish, Italian',
      },
      { value: 'Open source', label: 'Transparent code instead of opaque systems' },
    ],
    items: [
      {
        quote: 'A privacy-friendly path: no personal data stored permanently on the server.',
        source: 'DeLFI 2017',
        tag: 'Research',
      },
      {
        quote: 'UX evaluation in direct comparison with Kahoot! as an empirical design checkpoint.',
        source: 'fnm-austria',
        tag: 'Study',
      },
      {
        quote:
          'Privacy from the ground up and technical openness are a real differentiator for European edtech contexts.',
        source: 'Publication analysis',
        tag: 'Architecture',
      },
      {
        quote: 'Practically proven in real education settings, not only described as a concept.',
        source: 'Use in teaching and training contexts',
        tag: 'Practice',
      },
    ],
    referencesPrefix: 'Full references and the underlying publication collection are in',
    referencesLink: 'ARSnova-Recherche.pdf',
    referencesSuffix: 'on GitHub.',
  },
  comparison: {
    eyebrow: 'Differentiation',
    title: 'Compare arsnova.eu with Mentimeter and Kahoot!',
    lead: 'The focus is not only voting, but the full live flow: prepare on your phone, facilitate from anywhere in the room, make results visible and keep control of content and operations.',
    points: [
      {
        title: 'Create and host on your phone',
        description:
          'Create every question type and control quizzes, Q&A, Pulse Check, and results from your phone. You can also use a computer and projector. All host controls remain available on your phone.',
      },
      {
        title: 'Freedom to move, not tied to the laptop',
        description:
          'Some tools offer a remote that needs a separate login or only advances slides. Here, scan a QR code and confirm on the computer. The phone can control questions, results, Q&A, Pulse Check, and the end of the session without its own account. The quiz library stays on the computer.',
      },
      {
        title: 'Lower barriers to entry',
        description:
          'Both hosts and participants can start without an account. Open a session and invite participants to join with a code or QR code.',
      },
      {
        title: 'More interaction formats',
        description:
          'Alongside quizzes: matching, ordering, categorization, numeric estimation questions, reading phase, Peer Instruction, Pulse Check, Q&A wall, weighted word cloud and moderation compass in one platform — not only slide polls.',
      },
      {
        title: 'More control over data and access',
        description:
          'Open source, ready to run on your own infrastructure and with quiz content kept locally — plus conformance to WCAG 2.2 Level AA. Relevant for schools, universities and organizations with privacy and inclusion requirements.',
      },
    ],
    comparePrefix: 'You can still find the full feature comparison in the docs:',
    compareLink: 'Open the comparison on GitHub',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Common questions before the first session',
    answerLabel: 'Answer',
    items: [
      {
        question: 'Do hosts or participants need an account?',
        answer:
          'No. Hosts can start a session without an account. Participants join with a session code or QR code.',
      },
      {
        question: 'Can I really create a quiz and run a session entirely from my phone?',
        answer:
          'Yes. Create every question type on your phone, including single choice, multiple choice, short answer, numeric estimate, matching, ordering, and categorization. Control quizzes, Q&A, Pulse Check, and results from the same host view. You can also connect a second device: the presentation stays on the computer while the phone controls the session, without another account.',
      },
      {
        question: 'Can I control the session from my phone?',
        answer:
          'Yes. Scan the QR code shown on the computer when starting the presentation, then confirm the connection there. Without another account, the phone can control questions, results, Q&A, Pulse Check, and the end of the session. Your quiz library stays on the computer. You can hand the phone to a trusted assistant without sharing a password.',
      },
      {
        question: 'Where is the data stored?',
        answer:
          'Quiz content stays on your device. For live sessions only the technically necessary session data is processed; when you run it yourself, operations stay within your own infrastructure.',
      },
      {
        question: 'Can I use my quiz library on another device or with colleagues?',
        answer:
          'Yes. Your library stays on your device, helping protect your data. Open it on another computer with a sync link rather than a USB drive. Share the same link with colleagues to use and edit the library together. Create the link in your quiz library and paste received links on the home page.',
      },
      {
        question: 'Can I run arsnova.eu on my own infrastructure?',
        answer:
          'Yes. The platform is open source and designed to run with Docker, PostgreSQL and Redis.',
      },
      {
        question: 'What is answer confidence?',
        answer:
          'For scored questions, participants can rate their confidence in their answer from 1 to 5. This does not affect points. Comparing correctness and confidence helps identify possible misconceptions, especially when incorrect answers are given with high confidence. These findings appear in the debrief and PDF report after the session.',
      },
      {
        question: 'Can I export session results?',
        answer:
          'Yes. After the session, export the PDF debriefing report with answer confidence, priorities for discussion, and full question text. The latest session’s debrief and report are available from the quiz library. CSV export for spreadsheets is under “More”.',
      },
      {
        question: 'What makes the numeric estimation question special?',
        answer:
          'It separates the allowed input range from the range considered correct. Results stay hidden during voting. A second round after discussion lets you compare estimates with statistics.',
      },
      {
        question: 'What can the Q&A wall do?',
        answer:
          'Participants submit questions and upvote or downvote them. Hosts can review, publish, pin, archive, or delete questions and sort by net votes, strong support, or controversy.',
      },
      {
        question: 'What makes the Q&A word cloud different?',
        answer:
          'It groups visible questions into words and phrases, weighted by the active sort. This highlights topics from questions with high net votes, strong support, or split opinions.',
      },
      {
        question: 'What does the moderation compass do?',
        answer:
          'During the session, it suggests a next step based on unanswered questions, word clouds, quiz results, and pace feedback. The suggested action appears under “Next step”, followed by its supporting signals. Open the source and decide what to do. The compass never starts an action automatically.',
      },
      {
        question: 'Who is the platform for?',
        answer:
          'Anyone running live audience participation in a class, seminar, training session, workshop, event, or meeting.',
      },
      {
        question: 'Is arsnova.eu accessible?',
        answer:
          'arsnova.eu conforms to WCAG 2.2 Level AA. Core flows are keyboard-operable, screen readers announce status changes, response time on timed questions is individually adjustable (standard time, tenfold response time or no time limit), and the accessibly structured results report is PDF/UA-1-validated.',
        linkLabel: 'Open the accessibility statement',
      },
    ],
  },
  ctaSection: {
    title: 'Ready for the next live session?',
    lead: 'Try the live formats and moderation compass in the app. You can also explore the source code and read how Q&A, word clouds, deployment, and operations work.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Information',
    webAppDescription:
      'Free, open-source audience participation with live quizzes, numeric estimates, Q&A, word clouds, and Pulse Checks. Create and host from your phone, use answer confidence and PDF debriefing reports, and self-host if needed. No account required. Conforms to WCAG 2.2 Level AA.',
    featureList: [
      'Live quiz and voting',
      'Answer confidence on scored questions',
      'PDF debriefing report and follow-up after the session',
      'Numeric estimation questions with two rounds and statistics',
      'Q&A wall with moderation, upvoting and downvoting',
      'Moderation compass with a next-step suggestion from live signals',
      'Waiting room, presenter, QR/code',
      'Quiz creation and hosting from a phone, with every question type',
      'Host pairing: live-session control from a phone or tablet',
      'Question types MC/SC/short answer/free text/survey/rating/numeric estimation/matching/ordering/categorization',
      'Markdown and KaTeX',
      'Reading phase and Peer Instruction',
      'Q&A and free-text word cloud with phrases and weighting',
      'Sorting by net votes, strong support, and controversy',
      'Team mode and presets',
      'Leaderboard, streak, bonus code',
      'Import/export and Yjs sync',
      'Import of quizzes created with external AI, with format validation',
      'UI in five languages',
      'Conforms to WCAG 2.2 Level AA',
      'Docker on your own infrastructure and admin activity log',
      'Locally kept quiz content and operation with GDPR in mind',
    ],
  },
};

export default en;
