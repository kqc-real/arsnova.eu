/** Locale codes for info.arsnova.eu (aligned with the app). */
export type Locale = 'de' | 'en' | 'fr' | 'it' | 'es';

export interface NavMessages {
  ariaLabel: string;
  workflow: string;
  estimate: string;
  qa: string;
  qaMobile: string;
  features: string;
  accessibility: string;
  trust: string;
  faq: string;
  tryNow: string;
  menuOpen: string;
  menuClose: string;
  menu: string;
  skipToContent: string;
}

export interface LanguageSwitcherMessages {
  label: string;
  currentLanguage: string;
  chooseLanguage: string;
}

export interface FooterMessages {
  impressum: string;
  privacy: string;
  accessibility: string;
}

export interface MetaMessages {
  homeTitle: string;
  homeDescription: string;
  siteNameInfo: string;
  ogLocale: string;
}

export interface CtaMessages {
  appOpen: string;
  quizCreate: string;
  backToApp: string;
  tryLive: string;
  howItWorks: string;
  viewOpenSource: string;
}

export interface HeroMessages {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  titleAccent1: string;
  titleAccent2: string;
  lead: string;
  a11yLink: string;
  a11ySuffix: string;
  cards: Array<{ title: string; text: string }>;
}

export interface EstimateMessages {
  eyebrow: string;
  title: string;
  lead: string;
  summary: string[];
  docsLink: string;
  demoAria: string;
  hostView: string;
  demoQuestion: string;
  reference: string;
  toleranceBand: string;
  toleranceValue: string;
  plausibilityBand: string;
  plausibilityValue: string;
  histogramNote: string;
  median: string;
  inBand: string;
  round2: string;
  round2Value: string;
}

export interface ConfidenceMessages {
  eyebrow: string;
  title: string;
  lead: string;
  summary: string[];
  docsConfidence: string;
  docsExport: string;
  demoAria: string;
  hostView: string;
  demoQuestion: string;
  badge: string;
  matrix: Array<{ label: string; count: number; tone: 'emerald' | 'slate' | 'amber' | 'rose' }>;
  falseHighTitle: string;
  falseHighText: string;
  consolidated: string;
  misconceptionRisk: string;
  fragile: string;
  afterSessionAria: string;
  afterSession: string;
  debriefing: string;
  resultsPdf: string;
  exportNote: string;
}

export interface QaWallMessages {
  eyebrow: string;
  title: string;
  lead: string;
  signals: Array<{ label: string; text: string }>;
  docsLink: string;
  demoAria: string;
  hostView: string;
  demoTitle: string;
  moderationActive: string;
  sortMostSupported: string;
  sortBest: string;
  sortControversial: string;
  questions: Array<{ score: string; title: string; meta: string }>;
  wordCloud: string;
  wordCloudHint: string;
  frozenLive: string;
  terms: Array<{ label: string; className: string }>;
  nextStep: string;
}

export interface WorkflowMessages {
  eyebrow: string;
  title: string;
  lead: string;
  stepLabel: string;
  steps: Array<{ number: string; title: string; description: string }>;
}

export interface FeaturesMessages {
  eyebrow: string;
  title: string;
  lead: string;
  items: Array<{ title: string; description: string; icon: string }>;
}

export interface AccessibilityMessages {
  eyebrow: string;
  title: string;
  lead: string;
  benefits: Array<{ title: string; description: string }>;
  statementLink: string;
}

export interface TrustMessages {
  eyebrow: string;
  title: string;
  lead: string;
  proofItems: Array<{ value: string; label: string }>;
  items: Array<{ quote: string; source: string; tag: string }>;
  referencesPrefix: string;
  referencesLink: string;
  referencesSuffix: string;
}

export interface ComparisonMessages {
  eyebrow: string;
  title: string;
  lead: string;
  points: Array<{ title: string; description: string }>;
  comparePrefix: string;
  compareLink: string;
}

export interface FaqMessages {
  eyebrow: string;
  title: string;
  answerLabel: string;
  items: Array<{ question: string; answer: string; linkLabel?: string }>;
}

export interface CtaSectionMessages {
  title: string;
  lead: string;
}

export interface JsonLdMessages {
  websiteName: string;
  webAppDescription: string;
  featureList: string[];
}

export interface Messages {
  meta: MetaMessages;
  nav: NavMessages;
  languageSwitcher: LanguageSwitcherMessages;
  footer: FooterMessages;
  cta: CtaMessages;
  hero: HeroMessages;
  estimate: EstimateMessages;
  confidence: ConfidenceMessages;
  qaWall: QaWallMessages;
  workflow: WorkflowMessages;
  features: FeaturesMessages;
  accessibility: AccessibilityMessages;
  trust: TrustMessages;
  comparison: ComparisonMessages;
  faq: FaqMessages;
  ctaSection: CtaSectionMessages;
  jsonLd: JsonLdMessages;
}
