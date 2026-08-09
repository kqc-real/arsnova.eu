import type { Messages } from './types';

const en: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Live quiz, numeric estimation questions and Q&A wall',
    homeDescription:
      'Open-source audience response for education, training and organisations: live quiz with matching, ordering and categorisation, confidence rating, results report (PDF), numeric estimation questions, moderated Q&A wall, word cloud and feedback — conforms to WCAG 2.2 Level AA, free, runnable on your own infrastructure and ready without an account.',
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
    eyebrow: 'Audience response for education and organisations',
    titleLine1: 'Quiz, estimate,',
    titleLine2: 'moderate questions',
    titleAccent1: 'live and free',
    titleAccent2: ' without an account.',
    lead: 'arsnova.eu brings together live quizzes, numeric estimation questions, confidence ratings on scored questions, a Q&A wall, word-cloud analysis and Pulse Check feedback in one interface for schools, universities, continuing education, workshops and business. Open source, runnable on your own infrastructure and designed for operation with GDPR in mind.',
    a11yLink: 'Conforms to WCAG 2.2 Level AA',
    a11ySuffix: '— keyboard, screen reader and individually adjustable response time.',
    cards: [
      { title: 'Live in seconds', text: 'Share a session via code or QR' },
      { title: 'Q&A with a question wall', text: 'Moderation, voting and topic word cloud' },
      {
        title: 'Confidence rating & follow-up',
        text: 'Spot misconceptions, export a PDF results report',
      },
      {
        title: 'Open source & self-operated',
        text: 'Docker, Postgres, Redis and admin activity log',
      },
    ],
  },
  estimate: {
    eyebrow: 'New in the live quiz',
    title: 'Estimate numbers, discuss, and compare the second round clearly',
    lead: 'The numeric estimation question is built for years, orders of magnitude, measurements and probabilities. Facilitators set a reference value, allowed input range and tolerance; participants enter only a number.',
    summary: [
      'A plausibility band limits allowed inputs.',
      'A tolerance band scores estimates that are acceptable from a subject-matter perspective.',
      'Nobody sees the distribution before results are released.',
      'Round 1 and round 2 are compared after the discussion.',
    ],
    docsLink: 'Open the numeric estimation question documentation',
    demoAria: 'Sample results for a numeric estimation question about the French Revolution',
    hostView: 'Facilitator view after release',
    demoQuestion: 'When did the French Revolution begin?',
    reference: 'Reference 1789',
    toleranceBand: 'Tolerance band',
    toleranceValue: '1700 to 1900',
    plausibilityBand: 'Plausibility band',
    plausibilityValue: '1500 to 2000',
    histogramNote:
      'Histogram, reference line and tolerance band appear only after results are released. Until then, only a neutral progress indicator is visible.',
    median: 'Median',
    inBand: 'in band',
    round2: 'Round 2',
    round2Value: '14 answers closer to the reference',
  },
  confidence: {
    eyebrow: 'Pedagogical analysis',
    title: 'Right or wrong — and how sure?',
    lead: 'With the confidence rating, participants indicate how sure they are after answering (1–5). You see not only the hit rate, but also confidently wrong answers — a useful tool for formative evaluation, focused debriefing and the results report (PDF) after the session ends.',
    summary: [
      'Not a separate question type — optional on scored quiz questions.',
      'Scale 1–5 after the answer, with no effect on points.',
      'After release, the facilitator sees correctness × confidence.',
      'Confidently wrong answers may indicate misconceptions.',
      'After the session: results report (PDF) and debriefing.',
    ],
    docsConfidence: 'Confidence rating docs',
    docsExport: 'Results report (PDF) docs',
    demoAria: 'Sample evaluation with confidence rating after results release',
    hostView: 'Facilitator view after release',
    demoQuestion: 'Which structure is the most stable?',
    badge: 'Confidence rating',
    matrix: [
      { label: 'Correct · low confidence', count: 3, tone: 'emerald' },
      { label: 'Correct · medium confidence', count: 8, tone: 'emerald' },
      { label: 'Correct · high confidence', count: 11, tone: 'emerald' },
      { label: 'Incorrect · low confidence', count: 2, tone: 'slate' },
      { label: 'Incorrect · medium confidence', count: 4, tone: 'amber' },
      { label: 'Incorrect · high confidence', count: 2, tone: 'rose' },
    ],
    falseHighTitle: '2 confidently wrong answers',
    falseHighText:
      'Option B was chosen twice with high confidence — a signal for possible misconceptions in the debriefing.',
    consolidated: 'Solid',
    misconceptionRisk: 'Misconception risk',
    fragile: 'Fragile',
    afterSessionAria: 'Export after the session ends',
    afterSession: 'After the session ends',
    debriefing: 'Debriefing',
    resultsPdf: 'Results report (PDF)',
    exportNote:
      'Print-ready report with learning progress, heatmap and full question text — in the facilitator view and on the quiz card. CSV for Excel remains available under “More”.',
  },
  qaWall: {
    eyebrow: 'Live Q&A as a moderation space',
    title: 'Collect questions, prioritise them, and read them as a topic map',
    lead: 'The Q&A wall is not a side chat. It is a dedicated live channel for facilitators and speakers: moderate submissions, spot collective priorities, surface controversial points and bring the key themes into the room via a weighted Q&A word cloud.',
    signals: [
      {
        label: 'Pre-moderation',
        text: 'Release questions only when they are relevant in the teaching context.',
      },
      {
        label: 'Collective voting',
        text: 'Upvotes and downvotes indicate priorities, points of disagreement and needs for clarification.',
      },
      {
        label: 'Topic word cloud',
        text: 'Words and phrases are weighted by support, agreement or controversy.',
      },
      {
        label: 'Coming next: moderation compass',
        text: 'Deterministic signals come first; optional language analysis and summarisation remain extensions.',
      },
    ],
    docsLink: 'Open Q&A scoring and controversy docs on GitHub',
    demoAria: 'Sample Q&A wall with moderation, voting and word cloud',
    hostView: 'Facilitator’s Q&A view',
    demoTitle: 'Questions about the event',
    moderationActive: 'Pre-moderation on',
    sortMostSupported: 'Most supported',
    sortBest: 'Best questions',
    sortControversial: 'Controversial',
    questions: [
      {
        score: '+18',
        title: 'When is an estimate still plausible from a subject-matter perspective?',
        meta: '15 up · 3 down · best question',
      },
      {
        score: '+4',
        title: 'Should we really hide results before the discussion?',
        meta: '9 up · 5 down · controversial',
      },
      {
        score: '+11',
        title: 'How does Q&A differ from free text in the quiz?',
        meta: '11 up · 0 down · mostly supported',
      },
    ],
    wordCloud: 'Q&A word cloud',
    wordCloudHint: 'Weighted by positive support and controversy.',
    frozenLive: 'Live updates paused',
    terms: [
      { label: 'Tolerance band', className: 'text-3xl text-landing-primary' },
      { label: 'Discussion', className: 'text-2xl text-landing-status-emerald' },
      { label: 'Q&A', className: 'text-4xl text-landing-fg' },
      { label: 'Plausibility', className: 'text-xl text-landing-status-amber' },
      { label: 'Controversy', className: 'text-2xl text-landing-status-rose' },
      { label: 'Peer Instruction', className: 'text-lg text-landing-fg-muted' },
      { label: 'Moderation', className: 'text-3xl text-landing-tertiary' },
      { label: 'Clarification need', className: 'text-xl text-landing-status-violet' },
    ],
    nextStep:
      'Next step: a deterministic moderation compass, optionally complemented by asynchronous language-analysis signals and summaries grounded in the submitted questions.',
  },
  workflow: {
    eyebrow: 'For teaching, training and workshops',
    title: 'From idea to live session in a few minutes',
    lead: 'From the question to the running session, the flow deliberately avoids unnecessary steps. That is what makes getting started fast and reliable for educators, trainers and facilitators.',
    stepLabel: 'Step',
    steps: [
      {
        number: '01',
        title: 'Prepare a quiz',
        description:
          'Create questions directly or import existing content. Markdown, KaTeX, short answer, numeric estimation, matching, ordering and categorisation are built in.',
      },
      {
        number: '02',
        title: 'Start a session',
        description:
          'Start without an account: open a session, choose a style, share a code or QR and use the presenter view if needed.',
      },
      {
        number: '03',
        title: 'Moderate live',
        description:
          'Participants vote, ask questions and prioritise together. The facilitator and presenter show the quiz, Q&A wall, word cloud, reading phase, countdown, second round and results in one flow.',
      },
      {
        number: '04',
        title: 'Follow up and export',
        description:
          'After the session ends, the results report (PDF) is ready — with learning progress, confidence rating and full question text. In the quiz collection you will find debriefing and PDF for the last run; CSV for Excel under “More”.',
      },
    ],
  },
  features: {
    eyebrow: 'What sets arsnova.eu apart',
    title: 'Built for live interaction, not only for polling slides',
    lead: 'arsnova.eu combines a fast start, pedagogical depth and a transparent technical foundation. The platform stays simple day to day without shrinking what you can do.',
    items: [
      {
        title: 'Ready in no time',
        description:
          'Facilitators start without an account. Participants join the session directly with a 6-digit code or QR.',
        icon: 'single',
      },
      {
        title: 'Confidence rating in the live quiz',
        description:
          'Participants say how sure they are after answering. You spot confidently wrong answers, prioritise the debriefing and export the level of understanding in the results report (PDF).',
        icon: 'confidence',
      },
      {
        title: 'Results report for follow-up',
        description:
          'After the session ends you export a print-ready PDF report with charts, question text and confidence rating. CSV for Excel remains optional under “More”.',
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
          'MC/SC, short answers, ratings, matching, ordering, categorisation, reading phase, Peer Instruction and presenter mode support learning, training and live facilitation.',
        icon: 'toggle',
      },
      {
        title: 'Q&A wall instead of a side chat',
        description:
          'Q&A offers pre-moderation, pinning, archiving, up/down voting and sorting by support, quality and controversy.',
        icon: 'qa',
      },
      {
        title: 'Rich word cloud',
        description:
          'Free text and Q&A are condensed into words and phrases; the wall weights by agreement, clear majority score or controversy.',
        icon: 'cloud',
      },
      {
        title: 'For different settings',
        description:
          'Presets, team mode, anonymous mode, nicknames and style choice help from class and seminar to workshop, event and meeting.',
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
          'Quiz content stays on your device, optional data removal and operation on your own infrastructure give you more control over content and live data.',
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
  structuredQuestionTypes: {
    eyebrow: 'Structured question types',
    title: 'Match, order and categorise — complete interactions with useful results',
    lead: 'Three formats turn relationships, sequences and conceptual boundaries into active tasks. Solutions stay hidden while voting is open; model answers and common error patterns appear only after reveal.',
    interactionLabel: 'Interaction',
    exampleLabel: 'Teaching example',
    resultLabel: 'Results',
    scoringNote:
      'All three formats are scored. An answer currently receives full credit or no credit; partial credit is not available.',
    revealNote:
      'During an active round, correct pairings, target order and target categories remain hidden. The model answer and detailed distributions appear only after reveal.',
    items: [
      {
        id: 'matching',
        title: 'Matching',
        description:
          'Match terms, definitions or examples one to one. The results reveal common mix-ups.',
        interaction:
          'Each term receives exactly one target, each target is used once, and every match must be completed.',
        example: 'Match historical dates to the corresponding events.',
        result: 'Correct pairs, hit rates and frequently confused targets.',
        symbol: 'A↔B',
      },
      {
        id: 'ordering',
        title: 'Ordering',
        description:
          'Put steps, events or stages of a process in the correct order. The results show which positions caused uncertainty.',
        interaction:
          'Every item forms one complete linear sequence, using visible move controls and the keyboard without requiring drag-and-drop.',
        example: 'Order the stages of a biological process.',
        result: 'Model sequence, position distribution and common swaps.',
        symbol: '1→3',
      },
      {
        id: 'categorisation',
        title: 'Categorisation',
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
          'You and your participants can use the core flows without a mouse. Visible focus marks and a skip link to content make navigation easier.',
      },
      {
        title: 'Screen-reader support in live use',
        description:
          'Status changes when joining a session, during voting and at phase changes are announced for screen readers so users can follow the flow.',
      },
      {
        title: 'Individually adjustable response time',
        description:
          'For timed questions you choose standard time, tenfold response time or participation without a time limit. Reasonable adjustments can be applied directly in the live session.',
      },
      {
        title: 'Accessibly structured results report',
        description:
          'The print-ready report is PDF/UA-1-validated and includes document title, language and tags — for follow-up and accessible sharing.',
      },
    ],
    statementLink: 'Open the accessibility statement',
  },
  trust: {
    eyebrow: 'Trust',
    title: 'Built on an established foundation',
    lead: 'arsnova.eu continues the ARSnova ecosystem tradition and builds on scientific, pedagogical and practical experience from many years of education technology.',
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
    title: 'Not just a Mentimeter or Kahoot substitute',
    lead: 'The focus is not only voting, but the full live flow: prepare, facilitate, make results visible and keep control of content and operations.',
    points: [
      {
        title: 'Lower barriers to entry',
        description:
          'No separate product logic for “create” and “join”. Facilitators start without an account; participants enter the session via code or QR.',
      },
      {
        title: 'More interaction formats',
        description:
          'Alongside quizzes: matching, ordering, categorisation, numeric estimation questions, reading phase, Peer Instruction, Pulse Check, Q&A wall and weighted word cloud in one platform — not only slide polls.',
      },
      {
        title: 'More control over data and access',
        description:
          'Open source, runnable on your own infrastructure and with quiz content kept locally — plus conformance to WCAG 2.2 Level AA. Relevant for schools, universities and organisations with privacy and inclusion requirements.',
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
        question: 'Do facilitators or participants need an account?',
        answer:
          'No. A session can be started without an account. Participants join via code or QR.',
      },
      {
        question: 'Where is the data stored?',
        answer:
          'Quiz content stays on your device. For live sessions only the technically necessary session data is processed; when you run it yourself, operations stay in your own infrastructure.',
      },
      {
        question: 'Can I run arsnova.eu on my own infrastructure?',
        answer:
          'Yes. The platform is open source and designed to run with Docker, PostgreSQL and Redis.',
      },
      {
        question: 'What is confidence rating in the quiz?',
        answer:
          'An optional follow-up after scored questions: participants rate on a scale of 1–5 how sure they are about their answer. Points stay unchanged; in the facilitator evaluation you see correctness × confidence and flag confidently wrong answers as a misconception signal. After the session ends, learning outcomes feed into debriefing and the results report (PDF).',
      },
      {
        question: 'Can I export session results?',
        answer:
          'Yes. After the session ends, the results report (PDF) is the primary format — including confidence rating, debriefing priorities and full question text. In the quiz collection you will find debriefing and PDF for the last run. Tabular CSV data is available under “More” for Excel.',
      },
      {
        question: 'What makes the numeric estimation question special?',
        answer:
          'It separates allowed inputs from the subject-matter tolerance band, shows no distribution during voting, and can evaluate a second round after discussion with statistics and round comparison.',
      },
      {
        question: 'What can the Q&A wall do?',
        answer:
          'Participants submit questions and weight them with upvotes and downvotes. Facilitators can pre-moderate, pin, archive or remove questions and sort the list by support, clear majority agreement or controversy.',
      },
      {
        question: 'What makes the Q&A word cloud different?',
        answer:
          'It condenses visible questions into words and phrases and follows the active sort logic. So it shows not only frequent terms, but topic groups from supported, clearly high-scoring or controversial questions.',
      },
      {
        question: 'Who is the platform for?',
        answer:
          'For live interaction in education and organisations: school, university, continuing education, training, workshop, event or meeting.',
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
    lead: 'Try the live flow directly in the app, or take a look at the open source code, the Q&A logic, the word-cloud processing pipeline and the technical foundations for deployment and operations.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Information',
    webAppDescription:
      'Open-source audience response for education, training and organisations: live quiz with matching, ordering and categorisation, confidence rating, results report (PDF), numeric estimation questions, moderated Q&A wall, word cloud and feedback — conforms to WCAG 2.2 Level AA, free, runnable on your own infrastructure and ready without an account.',
    featureList: [
      'Live quiz and voting',
      'Confidence rating on scored questions',
      'Results report (PDF) and debriefing after the session ends',
      'Numeric estimation questions with two rounds and statistics',
      'Q&A wall with moderation, upvoting and downvoting',
      'Waiting room, presenter, QR/code',
      'Question types MC/SC/short answer/free text/survey/rating/numeric estimation/matching/ordering/categorisation',
      'Markdown and KaTeX',
      'Reading phase and Peer Instruction',
      'Q&A and free-text word cloud with phrases and weighting',
      'Sorting by support, clear majority agreement and controversy',
      'Team mode and presets',
      'Leaderboard, streak, bonus code',
      'Import/export and Yjs sync',
      'External AI import, Zod-validated',
      'UI in five languages',
      'Conforms to WCAG 2.2 Level AA',
      'Docker on your own infrastructure and admin activity log',
      'Locally kept quiz content and operation with GDPR in mind',
    ],
  },
};

export default en;
