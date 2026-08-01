import type { Messages } from './types';

const en: Messages = {
  meta: {
    homeTitle: 'arsnova.eu | Live quiz, numeric estimates and Q&A wall',
    homeDescription:
      'Open-source audience response for education, training and organisations: live quiz, confidence rating, results report (PDF), numerical estimates, moderated Q&A wall, word cloud and feedback — accessible to WCAG 2.2 AA, free, self-hostable and ready without an account.',
    siteNameInfo: 'arsnova.eu – Information',
    ogLocale: 'en_US',
  },
  nav: {
    ariaLabel: 'Main navigation',
    workflow: 'Workflow',
    estimate: 'Estimate',
    qa: 'Q&A',
    qaMobile: 'Q&A wall',
    features: 'Benefits',
    accessibility: 'Accessibility',
    trust: 'Trust',
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
    viewOpenSource: 'View open source',
  },
  hero: {
    eyebrow: 'Audience response for education and organisations',
    titleLine1: 'Quiz, estimate,',
    titleLine2: 'moderate questions',
    titleAccent1: 'live and free',
    titleAccent2: ' without an account.',
    lead: 'arsnova.eu brings together live quizzes, numerical estimates, confidence ratings on scored questions, a Q&A wall, word-cloud analysis and Pulse Check feedback in one interface for schools, universities, continuing education, workshops and business. Open source, self-hostable and designed for GDPR-oriented operation.',
    a11yLink: 'Accessible to WCAG 2.2 AA',
    a11ySuffix: '— keyboard, screen reader and individually adjustable response time.',
    cards: [
      { title: 'Live in seconds', text: 'Share a session via code or QR' },
      { title: 'Q&A with a question wall', text: 'Moderation, voting and topic word cloud' },
      {
        title: 'Confidence rating & follow-up',
        text: 'Spot misconceptions, export a PDF results report',
      },
      { title: 'Open source & self-hostable', text: 'Docker, Postgres, Redis and admin audit' },
    ],
  },
  estimate: {
    eyebrow: 'New in the live quiz',
    title: 'Estimate numbers, discuss, and compare the second round clearly',
    lead: 'The numerical estimate question is built for years, orders of magnitude, measurements and probabilities. Facilitators set a reference value, allowed input range and tolerance; participants enter only a number.',
    summary: [
      'A plausibility band limits allowed inputs.',
      'A tolerance band scores estimates that are acceptable in subject terms.',
      'Nobody sees the distribution before results are released.',
      'Round 1 and round 2 are compared after the discussion.',
    ],
    docsLink: 'Open the estimate question documentation',
    demoAria: 'Sample results for an estimate question about the French Revolution',
    hostView: 'Host view after release',
    demoQuestion: 'When did the French Revolution begin?',
    reference: 'Reference 1789',
    toleranceBand: 'Tolerance band',
    toleranceValue: '1700 to 1900',
    plausibilityBand: 'Plausibility band',
    plausibilityValue: '1500 to 2000',
    histogramNote:
      'Histogram, reference line and tolerance band appear only after results are released. Until then only neutral progress stays visible.',
    median: 'Median',
    inBand: 'in band',
    round2: 'Round 2',
    round2Value: '14 closer',
  },
  confidence: {
    eyebrow: 'Didactic evaluation',
    title: 'Right or wrong — and how sure?',
    lead: 'With confidence rating, participants indicate how sure they are after answering (1–5). You see not only the hit rate, but also confidently wrong answers — a strong lever for formative evaluation, focused debriefing and the results report (PDF) after the session ends.',
    summary: [
      'Not a separate question type — optional on scored quiz questions.',
      'Scale 1–5 after the answer, with no effect on points.',
      'After release, the host sees correctness × confidence.',
      'Confidently wrong flags possible misconceptions.',
      'After the session: results report (PDF) and debriefing.',
    ],
    docsConfidence: 'Confidence rating docs',
    docsExport: 'Results report (PDF) docs',
    demoAria: 'Sample evaluation with confidence rating after results release',
    hostView: 'Host view after release',
    demoQuestion: 'Which structure is the most stable?',
    badge: 'Confidence rating',
    matrix: [
      { label: 'Correct · low', count: 3, tone: 'emerald' },
      { label: 'Correct · mid', count: 8, tone: 'emerald' },
      { label: 'Correct · high', count: 11, tone: 'emerald' },
      { label: 'Wrong · low', count: 2, tone: 'slate' },
      { label: 'Wrong · mid', count: 4, tone: 'amber' },
      { label: 'Wrong · high', count: 2, tone: 'rose' },
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
      'Print-ready report with learning status, heatmap and full question text — in the host view and on the quiz card. CSV for Excel remains available under “More”.',
  },
  qaWall: {
    eyebrow: 'Live Q&A as a moderation surface',
    title: 'Collect questions, prioritise them, and read them as a topic map',
    lead: 'The Q&A wall is not a side chat. It is a dedicated live channel for facilitators and speakers: moderate submissions, spot collective priorities, surface controversial points and bring the key themes into the room via a weighted Q&A word cloud.',
    signals: [
      {
        label: 'Pre-moderation',
        text: 'Release questions only when they fit the teaching moment.',
      },
      {
        label: 'Collective voting',
        text: 'Upvotes and downvotes show priority, friction and need for clarification.',
      },
      {
        label: 'Topic word cloud',
        text: 'Words and phrases are weighted by support, agreement or controversy.',
      },
      {
        label: 'Compass outlook',
        text: 'Deterministic signals come first; Q&A NLP and summarisation remain optional extensions.',
      },
    ],
    docsLink: 'Open Q&A scoring and controversy docs on GitHub',
    demoAria: 'Sample Q&A wall with moderation, voting and word cloud',
    hostView: 'Host view Q&A',
    demoTitle: 'Questions about the event',
    moderationActive: 'Pre-moderation on',
    sortMostSupported: 'Most supported',
    sortBest: 'Best questions',
    sortControversial: 'Controversial',
    questions: [
      {
        score: '+18',
        title: 'When is an estimate still plausible in subject terms?',
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
    wordCloudHint: 'Weighted by positive resonance and controversy.',
    frozenLive: 'Frozen live',
    terms: [
      { label: 'Tolerance band', className: 'text-3xl text-brand-200' },
      { label: 'Discussion', className: 'text-2xl text-emerald-200' },
      { label: 'Q&A', className: 'text-4xl text-white' },
      { label: 'Plausibility', className: 'text-xl text-amber-200' },
      { label: 'Controversy', className: 'text-2xl text-rose-200' },
      { label: 'Peer Instruction', className: 'text-lg text-slate-300' },
      { label: 'Moderation', className: 'text-3xl text-cyan-200' },
      { label: 'Clarification need', className: 'text-xl text-violet-200' },
    ],
    nextStep:
      'Next step: a deterministic moderation compass, optionally complemented by asynchronous Q&A NLP signals and source-bound summaries.',
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
          'Create questions directly or import existing content. Markdown, KaTeX, short answer and numerical estimates are built in.',
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
          'Participants vote, ask questions and prioritise together. Host and presenter show quiz, Q&A wall, word cloud, reading phase, countdown, second round and results in one flow.',
      },
      {
        number: '04',
        title: 'Follow up and export',
        description:
          'After the session ends, the results report (PDF) is ready — with learning status, confidence rating and full question text. In the quiz collection you will find debriefing and PDF for the last run; CSV for Excel under “More”.',
      },
    ],
  },
  features: {
    eyebrow: 'Why it feels different',
    title: 'Built for live interaction, not only for polling slides',
    lead: 'arsnova.eu combines a fast start, didactic depth and a transparent technical foundation. The platform stays simple day to day without shrinking what you can do.',
    items: [
      {
        title: 'Ready in no time',
        description:
          'Hosts start without an account. Participants join the session directly with a 6-digit code or QR.',
        icon: 'single',
      },
      {
        title: 'Confidence rating in the live quiz',
        description:
          'Participants say how sure they are after answering. You spot confidently wrong answers, prioritise the debriefing and export learning status in the results report (PDF).',
        icon: 'confidence',
      },
      {
        title: 'Results report for follow-up',
        description:
          'After the session ends you export a print-ready PDF report with charts, question text and confidence rating. CSV for Excel remains optional under “More”.',
        icon: 'export',
      },
      {
        title: 'Didactic estimate questions',
        description:
          'Years, orders of magnitude and measurements can be estimated with a reference value, tolerance band, statistics and an optional second round.',
        icon: 'estimate',
      },
      {
        title: 'More than a standard quiz',
        description:
          'MC/SC, short answer, rating, reading phase, Peer Instruction and presenter flow support learning, training and live facilitation.',
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
          'Free text and Q&A are condensed into words and phrases; the wall weights by agreement, robust score or controversy.',
        icon: 'cloud',
      },
      {
        title: 'For different settings',
        description:
          'Presets, team mode, anonymous mode, nicknames and style choice help from class and seminar to workshop, event and meeting.',
        icon: 'bolt',
      },
      {
        title: 'Accessibility to WCAG 2.2 AA',
        description:
          'Keyboard use, screen-reader status updates, individually adjustable response time and PDF/UA-1-validated results reports — so more learners can join live sessions independently.',
        icon: 'a11y',
      },
      {
        title: 'Privacy and control',
        description:
          'Local-first, data stripping and self-hostable operation give you more control over content and live data.',
        icon: 'tools',
      },
      {
        title: 'Open source with an ops path',
        description:
          'Docker, Postgres, Redis and admin audit make the platform robust for hosting, operations and auditability.',
        icon: 'server',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibility',
    title: 'WCAG 2.2 AA — so more learners can take part independently',
    lead: 'For schools, universities and continuing education, accessibility is often a decisive criterion. arsnova.eu meets the Web Content Accessibility Guidelines (WCAG) 2.2 at conformance level AA — with keyboard use, screen-reader support, individually adjustable response time and accessibly structured PDF results reports.',
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
    title: 'Credible because the product does not start from zero',
    lead: 'arsnova.eu continues the ARSnova ecosystem tradition and builds on scientific, didactic and practical experience from many years of education technology.',
    proofItems: [
      { value: 'Since 2012', label: 'ARSnova tradition in education and edtech' },
      { value: 'WCAG 2.2 AA', label: 'Verified accessibility for teaching and institutions' },
      {
        value: '5 UI languages',
        label: 'German, English, French, Spanish, Italian',
      },
      { value: 'Open source', label: 'Transparent code instead of a black box' },
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
          'Privacy by design and technical openness are a real differentiator for European edtech contexts.',
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
          'No separate product logic for “create” and “join”. Hosts start without an account; participants enter the session via code or QR.',
      },
      {
        title: 'More interaction formats',
        description:
          'Alongside quizzes: numerical estimates, reading phase, Peer Instruction, Pulse Check, Q&A wall and weighted word cloud in the same platform — not only slide polls.',
      },
      {
        title: 'More control over data and access',
        description:
          'Open source, self-hostable and local-first by design — plus accessibility to WCAG 2.2 AA. Relevant for schools, universities and organisations with privacy and inclusion requirements.',
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
          'No. A session can be started without an account. Participants join via code or QR.',
      },
      {
        question: 'Where is the data stored?',
        answer:
          'Quiz content is designed local-first. For live sessions only the technically necessary session data is processed; with self-hosting, operations stay in your own infrastructure.',
      },
      {
        question: 'Can I self-host arsnova.eu?',
        answer:
          'Yes. The platform is open source and designed to run with Docker, PostgreSQL and Redis.',
      },
      {
        question: 'What is confidence rating in the quiz?',
        answer:
          'An optional follow-up after scored questions: participants rate on a scale of 1–5 how sure they are about their answer. Points stay unchanged; in the host evaluation you see correctness × confidence and flag confidently wrong answers as a misconception signal. After the session ends, learning status flows into debriefing and the results report (PDF).',
      },
      {
        question: 'Can I export session results?',
        answer:
          'Yes. After the session ends, the results report (PDF) is the primary format — including confidence rating, debriefing priorities and full question text. In the quiz collection you will find debriefing and PDF for the last run. Tabular CSV data is available under “More” for Excel.',
      },
      {
        question: 'What makes the numerical estimate special?',
        answer:
          'It separates allowed inputs from the subject-matter tolerance band, shows no distribution during voting, and can evaluate a second round after discussion with statistics and round comparison.',
      },
      {
        question: 'What can the Q&A wall do?',
        answer:
          'Participants submit questions and weight them with upvotes and downvotes. Hosts can pre-moderate, pin, archive or remove questions and sort the list by support, robust agreement or controversy.',
      },
      {
        question: 'What makes the Q&A word cloud different?',
        answer:
          'It condenses visible questions into words and phrases and follows the active sort logic. So it shows not only frequent terms, but topic clusters from supported, robustly scored or controversial questions.',
      },
      {
        question: 'Who is the platform for?',
        answer:
          'For live interaction in education and organisations: school, university, continuing education, training, workshop, event or meeting.',
      },
      {
        question: 'Is arsnova.eu accessible?',
        answer:
          'arsnova.eu meets WCAG 2.2 AA. Core flows are keyboard-operable, screen readers announce status changes, response time on timed questions is individually adjustable (standard time, tenfold response time or no time limit), and the accessibly structured results report is PDF/UA-1-validated.',
        linkLabel: 'Open the accessibility statement',
      },
    ],
  },
  ctaSection: {
    title: 'Ready for the next live session?',
    lead: 'Try the live flow directly in the app, or take a look at the open code, the Q&A logic, the word-cloud pipeline and the operations path behind the platform.',
  },
  jsonLd: {
    websiteName: 'arsnova.eu – Information',
    webAppDescription:
      'Open-source audience response for education, training and organisations: live quiz, confidence rating, results report (PDF), numerical estimates, moderated Q&A wall, word cloud and feedback — accessible to WCAG 2.2 AA, free, self-hostable and ready without an account.',
    featureList: [
      'Live quiz and voting',
      'Confidence rating on scored questions',
      'Results report (PDF) and debriefing after the session ends',
      'Numerical estimates with two rounds and statistics',
      'Q&A wall with moderation, upvoting and downvoting',
      'Lobby, presenter, QR/code',
      'Question types MC/SC/short answer/free text/survey/rating/estimate',
      'Markdown and KaTeX',
      'Reading phase and Peer Instruction',
      'Q&A and free-text word cloud with phrases and weighting',
      'Sorting by support, robust agreement and controversy',
      'Team mode and presets',
      'Leaderboard, streak, bonus code',
      'Import/export and Yjs sync',
      'External AI import, Zod-validated',
      'UI in five languages',
      'Accessibility to WCAG 2.2 AA',
      'Docker self-host and admin audit',
      'Local-first and GDPR-oriented operation',
    ],
  },
};

export default en;
