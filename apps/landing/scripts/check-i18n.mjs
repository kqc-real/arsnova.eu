#!/usr/bin/env node
/**
 * Automated i18n checks for the landing page (Issue #192).
 * Expects a production build in dist/ (runs build when locale pages are missing).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const locales = ['de', 'en', 'fr', 'it', 'es'];
const legacyAliases = [
  'schaetzfrage',
  'selbsteinschaetzung',
  'fragenwand',
  'ablauf',
  'barrierefreiheit',
  'vertrauen',
  'vergleich',
];
const canonicalAnchors = [
  'workflow',
  'features',
  'numeric-estimate',
  'confidence',
  'qa-wall',
  'accessibility',
  'trust',
  'comparison',
  'faq',
];
/** Document order for main section ids (Issue #198). */
const sectionOrder = [
  'workflow',
  'features',
  'numeric-estimate',
  'confidence',
  'qa-wall',
  'accessibility',
  'trust',
  'comparison',
  'faq',
];
/** Main nav section targets and mandatory labels (Issue #198). */
const navSpec = [
  {
    anchor: 'workflow',
    labels: {
      de: 'Ablauf',
      en: 'How it works',
      fr: 'Fonctionnement',
      it: 'Come funziona',
      es: 'Cómo funciona',
    },
  },
  {
    anchor: 'features',
    labels: {
      de: 'Funktionen',
      en: 'Features',
      fr: 'Fonctionnalités',
      it: 'Funzionalità',
      es: 'Funciones',
    },
  },
  {
    anchor: 'accessibility',
    labels: {
      de: 'Barrierefreiheit',
      en: 'Accessibility',
      fr: 'Accessibilité',
      it: 'Accessibilità',
      es: 'Accesibilidad',
    },
  },
  {
    anchor: 'trust',
    labels: {
      de: 'Vertrauen',
      en: 'Trust',
      fr: 'Confiance',
      it: 'Fiducia',
      es: 'Confianza',
    },
  },
  {
    anchor: 'comparison',
    labels: {
      de: 'Vergleich',
      en: 'Comparison',
      fr: 'Comparatif',
      it: 'Confronto',
      es: 'Comparativa',
    },
  },
  {
    anchor: 'faq',
    labels: {
      de: 'FAQ',
      en: 'FAQ',
      fr: 'FAQ',
      it: 'FAQ',
      es: 'FAQ',
    },
  },
];
const tryNowLabels = {
  de: 'Jetzt ausprobieren',
  en: 'Try it now',
  fr: 'Essayer maintenant',
  it: 'Provalo ora',
  es: 'Probar ahora',
};
const removedNavAnchors = ['numeric-estimate', 'qa-wall', 'confidence'];
const deSmokePhrases = [
  'Jetzt ausprobieren',
  'Zum Inhalt springen',
  'Menü öffnen',
  'So funktioniert’s',
  'Jetzt live ausprobieren',
  'Häufige Fragen vor dem ersten Einsatz',
  'Bereit für die nächste Live-Session?',
  'Darstellung wählen',
  'Systemeinstellung',
];

const errors = [];
const fail = (message) => errors.push(message);

/**
 * Always rebuild so checks never pass against a stale dist/ from an older commit.
 * Review #201: a pre-existing locale tree must not short-circuit validation.
 */
function ensureBuild() {
  console.log('Running fresh landing build for i18n checks…');
  // Do not leak Playwright BASE_URL into Vite/Astro import.meta.env.BASE_URL.
  const env = { ...process.env };
  delete env.BASE_URL;
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    fail('Landing build failed');
    return;
  }
  for (const locale of locales) {
    if (!existsSync(join(dist, locale, 'index.html'))) {
      fail(`Fresh build missing locale page: /${locale}/`);
    }
  }
}

function assertDictionaries() {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', join(root, 'scripts/probe-dicts.ts')],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0 || !result.stdout.includes('dictionaries-ok')) {
    fail(`Dictionary key check failed:\n${result.stderr || result.stdout}`);
  }
}

function checkLocalePaths() {
  for (const locale of locales) {
    const indexPath = join(dist, locale, 'index.html');
    if (!existsSync(indexPath)) {
      fail(`Missing built locale path: /${locale}/`);
      continue;
    }
    const html = readFileSync(indexPath, 'utf8');
    if (!html.includes(`lang="${locale}"`)) fail(`/${locale}/ missing html lang="${locale}"`);
    if (!html.includes('hreflang="x-default"')) fail(`/${locale}/ missing hreflang x-default`);
    for (const other of locales) {
      if (!html.includes(`hreflang="${other}"`)) fail(`/${locale}/ missing hreflang="${other}"`);
    }
    for (const anchor of canonicalAnchors) {
      if (!html.includes(`id="${anchor}"`)) fail(`/${locale}/ missing canonical anchor #${anchor}`);
    }
    for (const alias of legacyAliases) {
      if (!html.includes(`id="${alias}"`)) fail(`/${locale}/ missing legacy alias #${alias}`);
    }
    if (!html.includes(`https://arsnova.eu/${locale}/`)) {
      fail(`/${locale}/ missing locale-safe app URL https://arsnova.eu/${locale}/`);
    }
  }
}

function checkNoGermanFallback() {
  for (const locale of locales) {
    if (locale === 'de') continue;
    const html = readFileSync(join(dist, locale, 'index.html'), 'utf8');
    for (const phrase of deSmokePhrases) {
      if (html.includes(phrase)) {
        fail(`/${locale}/ contains German UI phrase: ${JSON.stringify(phrase)}`);
      }
    }
  }
}

function checkSitemap() {
  const sitemapPath = join(dist, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    fail('Missing dist/sitemap.xml');
    return;
  }
  const xml = readFileSync(sitemapPath, 'utf8');
  for (const locale of locales) {
    if (!xml.includes(`/${locale}/`)) fail(`Sitemap missing locale /${locale}/`);
  }
}

function checkRootRedirectPreservesHash() {
  const indexPath = join(dist, 'index.html');
  if (!existsSync(indexPath)) {
    fail('Missing dist/index.html root redirect page');
    return;
  }
  const html = readFileSync(indexPath, 'utf8');
  if (!html.includes('window.location.hash')) {
    fail('Root redirect must preserve window.location.hash for legacy bookmarks');
  }
  if (!html.includes('de/')) {
    fail('Root redirect must target the default locale /de/');
  }
}

function checkLegalPagesOmitHomeHreflang() {
  for (const page of ['impressum', 'datenschutz']) {
    const pagePath = join(dist, page, 'index.html');
    if (!existsSync(pagePath)) {
      fail(`Missing built legal page: /${page}/`);
      continue;
    }
    const html = readFileSync(pagePath, 'utf8');
    // Language-switcher anchors may carry hreflang; only head alternates are SEO clusters.
    if (
      html.includes('rel="alternate" hreflang="x-default"') ||
      html.includes('rel="alternate" hreflang="en"')
    ) {
      fail(`/${page}/ must not declare localized-home hreflang alternates`);
    }
  }
}

/**
 * Exact demo / WCAG / editorial phrases from Issues #192/#194.
 * Only pin strings after the dictionaries have been editorially approved.
 */
const localeContentSmoke = {
  de: {
    matrix: [
      'Richtig · geringe Sicherheit',
      'Richtig · mittlere Sicherheit',
      'Richtig · hohe Sicherheit',
      'Falsch · geringe Sicherheit',
      'Falsch · mittlere Sicherheit',
      'Falsch · hohe Sicherheit',
    ],
    round2: '14 Antworten näher am Referenzwert',
    editorial: [
      'Bei der Selbsteinschätzung geben Teilnehmende nach ihrer Antwort an, wie sicher sie sind',
      'falsche Antworten mit hoher Antwortsicherheit',
      'im jeweiligen didaktischen Kontext relevant sind',
      'Aussagekräftige Wortwolke',
      'Live-Aktualisierung pausiert',
      'Was arsnova.eu auszeichnet',
      'Auf langjähriger Erfahrung aufgebaut',
      'technischen Grundlagen für Bereitstellung und Betrieb',
    ],
    banned: ['selbstsicher falsch', 'Elaborierte Word Cloud', 'didaktischen Moment passen'],
  },
  en: {
    matrix: [
      'Correct · low confidence',
      'Correct · medium confidence',
      'Correct · high confidence',
      'Incorrect · low confidence',
      'Incorrect · medium confidence',
      'Incorrect · high confidence',
    ],
    round2: '14 answers closer to the reference',
    wcag: 'Conforms to WCAG 2.2 Level AA',
    term: 'numeric estimation question',
    editorial: [
      'With the confidence rating,',
      'Confidently wrong answers may indicate misconceptions.',
      'Pedagogical analysis',
      'Coming next: moderation compass',
      'Built on an established foundation',
      'The facilitator and presenter show the quiz, Q&amp;A wall, word cloud',
      'Until then, only a neutral progress indicator is visible.',
      'Facilitator’s Q&amp;A view',
    ],
    banned: ['Until then only neutral progress', 'Facilitator view Q&amp;A'],
  },
  fr: {
    matrix: [
      'Réponse correcte · confiance faible',
      'Réponse correcte · confiance moyenne',
      'Réponse correcte · confiance élevée',
      'Réponse incorrecte · confiance faible',
      'Réponse incorrecte · confiance moyenne',
      'Réponse incorrecte · confiance élevée',
    ],
    round2: '14 réponses plus proches de la référence',
    wcag: 'Conforme aux WCAG 2.2, niveau AA',
    term: 'sondage express',
    editorial: [
      'Prêt en quelques secondes',
      'Publier les questions uniquement lorsqu’elles sont pertinentes dans le contexte pédagogique.',
      'À venir : boussole de modération',
      'L’animateur et le présentateur affichent le quiz,',
      'indiquent les priorités, les désaccords et les besoins de clarification',
      'Vue Q&amp;A de l’animateur',
      'indicateur neutre de progression',
      'mode présentateur',
      'croisement entre l’exactitude des réponses et le degré de confiance',
    ],
    banned: [
      'Feedback express',
      'Vue hôte',
      'En direct immédiatement',
      'montrent priorité, friction',
      'Vue de l’animateur Q&amp;A',
      'flux présentateur',
      'progression neutre',
    ],
  },
  it: {
    matrix: [
      'Corretta · sicurezza bassa',
      'Corretta · sicurezza media',
      'Corretta · sicurezza alta',
      'Errata · sicurezza bassa',
      'Errata · sicurezza media',
      'Errata · sicurezza alta',
    ],
    round2: '14 risposte più vicine al valore di riferimento',
    wcag: 'Conforme alle WCAG 2.2, livello AA',
    term: 'domanda di stima numerica',
    editorial: [
      'un valore di riferimento, un intervallo di immissione e una tolleranza',
      'spazio di moderazione',
      'In arrivo: bussola di moderazione',
      'si adattano a contesti che vanno dalla classe e dal seminario al workshop',
      'mostrano il quiz, la bacheca delle domande',
      'i punti di disaccordo e le esigenze di chiarimento',
      'modalità presentatore',
      'indicatore neutro di avanzamento',
    ],
    banned: [
      'superficie di moderazione',
      'Prospettiva della bussola',
      'priorità, attrito',
      'flusso presentatore',
      'progresso neutrale',
    ],
  },
  es: {
    matrix: [
      'Correcta · confianza baja',
      'Correcta · confianza media',
      'Correcta · confianza alta',
      'Incorrecta · confianza baja',
      'Incorrecta · confianza media',
      'Incorrecta · confianza alta',
    ],
    round2: '14 respuestas más próximas al valor de referencia',
    wcag: 'Cumple las WCAG 2.2, nivel AA',
    term: 'pregunta de estimación numérica',
    editorial: [
      'estimaciones aceptables desde el punto de vista de la materia',
      'espacio de moderación',
      'un recurso útil',
      'Próximamente: brújula de moderación',
      'El Q&amp;A permite premoderar',
      'infraestructura de despliegue y operación de la plataforma',
      'El anfitrión y el presentador muestran el cuestionario',
      'indican las prioridades, los puntos de desacuerdo',
      'modo de presentación',
      'El objetivo no es únicamente votar',
      'indicador neutro de progreso',
      'Compatibilidad con lectores de pantalla',
      'en directo',
    ],
    banned: [
      'en vivo',
      'superficie de moderación',
      'palanca fuerte',
      'flujo presentador',
      'El centro no es solo',
      'progreso neutro',
      'Apoyo de lector',
    ],
  },
};

function checkLocaleContentSmoke() {
  for (const locale of locales) {
    const html = readFileSync(join(dist, locale, 'index.html'), 'utf8');
    const smoke = localeContentSmoke[locale];
    for (const label of smoke.matrix) {
      if (!html.includes(label)) fail(`/${locale}/ missing matrix label ${JSON.stringify(label)}`);
    }
    if (!html.includes(smoke.round2)) {
      fail(`/${locale}/ missing round-2 phrase ${JSON.stringify(smoke.round2)}`);
    }
    if (smoke.wcag && !html.includes(smoke.wcag)) {
      fail(`/${locale}/ missing WCAG phrase ${JSON.stringify(smoke.wcag)}`);
    }
    if (smoke.term && !html.includes(smoke.term)) {
      fail(`/${locale}/ missing terminology ${JSON.stringify(smoke.term)}`);
    }
    for (const phrase of smoke.editorial || []) {
      if (!html.includes(phrase)) {
        fail(`/${locale}/ missing editorial phrase ${JSON.stringify(phrase)}`);
      }
    }
    for (const banned of smoke.banned || []) {
      if (html.includes(banned))
        fail(`/${locale}/ contains banned phrase ${JSON.stringify(banned)}`);
    }
  }
}

function checkLanguageSwitcherMarkup() {
  const html = readFileSync(join(dist, 'de', 'index.html'), 'utf8');
  if (html.includes('aria-haspopup')) {
    fail('/de/ language switcher must not use aria-haspopup for disclosure links');
  }
  if (!html.includes('data-language-switcher') || !html.includes('data-lang-menu')) {
    fail('/de/ missing language switcher disclosure markup');
  }
  if (!html.includes('syncLocaleHrefs') || !html.includes("addEventListener('hashchange'")) {
    fail('/de/ must sync locale href hashes on load and hashchange');
  }
  if (!html.includes('id="lang-desktop-button"') || !html.includes('id="lang-mobile-button"')) {
    fail('/de/ missing desktop and mobile language switcher instances');
  }
}

function checkThemeSwitcherMarkup() {
  const html = readFileSync(join(dist, 'de', 'index.html'), 'utf8');
  if (!html.includes('data-theme-switcher') || !html.includes('data-theme-menu')) {
    fail('/de/ missing theme switcher disclosure markup');
  }
  if (html.includes('role="menu"') || html.includes("role='menu'")) {
    fail('/de/ theme switcher must use disclosure buttons, not role=menu');
  }
  if (html.includes('menuitemradio')) {
    fail('/de/ theme switcher must not use menuitemradio');
  }
  if (html.includes('role="radiogroup"') || html.includes('role="radio"')) {
    fail('/de/ theme switcher must use aria-pressed buttons, not radiogroup/radio');
  }
  if (!html.includes('aria-pressed')) {
    fail('/de/ theme switcher missing aria-pressed on options');
  }
  if (html.includes('aria-haspopup')) {
    fail('/de/ theme/language disclosure must not use aria-haspopup');
  }
  if (!html.includes('arsnova-info-color-scheme-v1')) {
    fail('/de/ missing theme storage key arsnova-info-color-scheme-v1');
  }
  if (!html.includes('id="theme-desktop-button"') || !html.includes('id="theme-mobile-button"')) {
    fail('/de/ missing desktop and mobile theme switcher instances');
  }
  for (const phrase of [
    'Darstellung',
    'Systemeinstellung',
    'Hell',
    'Dunkel',
    'Darstellung wählen',
  ]) {
    if (!html.includes(phrase)) fail(`/de/ missing theme phrase ${JSON.stringify(phrase)}`);
  }
  const fr = readFileSync(join(dist, 'fr', 'index.html'), 'utf8');
  if (!fr.includes('Apparence') || !fr.includes('Réglage du système')) {
    fail('/fr/ missing French theme switcher labels');
  }
  const it = readFileSync(join(dist, 'it', 'index.html'), 'utf8');
  if (!it.includes('Aspetto') || !it.includes('Impostazione di sistema')) {
    fail('/it/ missing Italian theme switcher labels');
  }
  const es = readFileSync(join(dist, 'es', 'index.html'), 'utf8');
  if (!es.includes('Apariencia') || !es.includes('Configuración del sistema')) {
    fail('/es/ missing Spanish theme switcher labels');
  }
}

/**
 * Extract hash targets from a contiguous HTML fragment of nav links.
 * Returns anchors in document order (e.g. "workflow").
 */
function extractHashAnchors(fragment) {
  const anchors = [];
  const re = /href="[^"]*?#([a-z0-9-]+)"/gi;
  let match;
  while ((match = re.exec(fragment)) !== null) {
    anchors.push(match[1]);
  }
  return anchors;
}

function extractMainSectionOrder(html) {
  const mainMatch = html.match(/<main\b[^>]*id="main-content"[^>]*>([\s\S]*?)<\/main>/i);
  if (!mainMatch) return null;
  const order = [];
  const re =
    /id="(workflow|features|numeric-estimate|confidence|qa-wall|accessibility|trust|comparison|faq)"/g;
  let match;
  while ((match = re.exec(mainMatch[1])) !== null) {
    order.push(match[1]);
  }
  return order;
}

function checkNavAndSectionOrder() {
  const expectedAnchors = navSpec.map((item) => item.anchor);

  for (const locale of locales) {
    const html = readFileSync(join(dist, locale, 'index.html'), 'utf8');

    const desktopHook = html.indexOf('data-main-nav="desktop"');
    const mobileHook = html.indexOf('data-main-nav="mobile"');
    if (desktopHook < 0) {
      fail(`/${locale}/ missing desktop navigation [data-main-nav="desktop"]`);
      continue;
    }
    if (mobileHook < 0) {
      fail(`/${locale}/ missing mobile navigation [data-main-nav="mobile"]`);
      continue;
    }
    // Slice between stable hooks so nested LanguageSwitcher <div>s cannot truncate the match.
    const desktopNavHtml = html.slice(desktopHook, mobileHook);
    const mobileClose = html.indexOf('</ul>', mobileHook);
    const mobileNavHtml =
      mobileClose >= 0 ? html.slice(mobileHook, mobileClose + '</ul>'.length) : '';
    if (!mobileNavHtml) {
      fail(`/${locale}/ missing mobile navigation markup after [data-main-nav="mobile"]`);
      continue;
    }

    const desktopAnchors = extractHashAnchors(desktopNavHtml).filter((anchor) =>
      expectedAnchors.includes(anchor),
    );
    const mobileAnchors = extractHashAnchors(mobileNavHtml).filter((anchor) =>
      expectedAnchors.includes(anchor),
    );

    if (desktopAnchors.join(',') !== expectedAnchors.join(',')) {
      fail(
        `/${locale}/ desktop nav anchors expected ${expectedAnchors.join(' → ')}, got ${desktopAnchors.join(' → ')}`,
      );
    }
    if (mobileAnchors.join(',') !== expectedAnchors.join(',')) {
      fail(
        `/${locale}/ mobile nav anchors expected ${expectedAnchors.join(' → ')}, got ${mobileAnchors.join(' → ')}`,
      );
    }
    if (desktopAnchors.join(',') !== mobileAnchors.join(',')) {
      fail(`/${locale}/ desktop and mobile nav anchors diverge`);
    }

    for (const item of navSpec) {
      const label = item.labels[locale];
      if (!html.includes(`#${item.anchor}`) || !html.includes(label)) {
        fail(`/${locale}/ missing nav label ${JSON.stringify(label)} for #${item.anchor}`);
      }
      // Label must appear as link text next to the hash (desktop + mobile share markup patterns).
      const labelNearHref = new RegExp(
        `href="[^"]*?#${item.anchor}"[^>]*>\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<`,
      );
      const labelMatches = html.match(new RegExp(labelNearHref.source, 'g'));
      if (!labelMatches || labelMatches.length < 2) {
        fail(
          `/${locale}/ expected #${item.anchor} labeled ${JSON.stringify(label)} in desktop and mobile nav`,
        );
      }
    }

    const tryNow = tryNowLabels[locale];
    const tryNowMatches = html.match(
      new RegExp(
        `href="[^"]*?#start"[^>]*>\\s*${tryNow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<`,
        'g',
      ),
    );
    if (!tryNowMatches || tryNowMatches.length < 2) {
      fail(
        `/${locale}/ CTA ${JSON.stringify(tryNow)} must remain a separate #start control (desktop + mobile)`,
      );
    }
    if (!html.includes('bg-landing-primary') || !html.includes(tryNow)) {
      fail(
        `/${locale}/ CTA ${JSON.stringify(tryNow)} must remain visually emphasized (landing primary button)`,
      );
    }

    for (const removed of removedNavAnchors) {
      const navHits = [
        ...desktopNavHtml.matchAll(new RegExp(`#${removed}`, 'g')),
        ...mobileNavHtml.matchAll(new RegExp(`#${removed}`, 'g')),
      ];
      if (navHits.length) {
        fail(`/${locale}/ main nav must not link #${removed}`);
      }
    }

    const order = extractMainSectionOrder(html);
    if (!order) {
      fail(`/${locale}/ missing <main id="main-content">`);
      continue;
    }
    if (order.join(',') !== sectionOrder.join(',')) {
      fail(
        `/${locale}/ section order expected ${sectionOrder.join(' → ')}, got ${order.join(' → ')}`,
      );
    }
    if (order.indexOf('features') !== 1 || order.indexOf('workflow') !== 0) {
      fail(`/${locale}/ Workflow must follow Hero and Features must precede spotlights`);
    }
    if (
      order.indexOf('features') > order.indexOf('numeric-estimate') ||
      order.indexOf('features') > order.indexOf('confidence') ||
      order.indexOf('features') > order.indexOf('qa-wall')
    ) {
      fail(`/${locale}/ #features must start the feature block before spotlights`);
    }

    // Footer remains the compact strip (no multi-column redesign).
    if (!html.includes('©') || !html.includes('Open Source') || !html.includes('MIT')) {
      fail(`/${locale}/ footer copyright strip changed unexpectedly`);
    }
    for (const footerKey of ['impressum', 'datenschutz']) {
      if (!html.includes(`/${footerKey}/`)) fail(`/${locale}/ footer missing /${footerKey}/`);
    }
    if (!html.includes('/legal/accessibility')) {
      fail(`/${locale}/ footer missing accessibility legal link`);
    }
    if (html.includes('app-footer') || html.match(/footer[\s\S]{0,200}grid-cols-3/)) {
      fail(`/${locale}/ footer must not adopt the app's multi-column information architecture`);
    }
  }
}

ensureBuild();
if (!errors.length) assertDictionaries();
if (!errors.length) {
  checkLocalePaths();
  checkNoGermanFallback();
  checkSitemap();
  checkRootRedirectPreservesHash();
  checkLegalPagesOmitHomeHreflang();
  checkLocaleContentSmoke();
  checkLanguageSwitcherMarkup();
  checkNavAndSectionOrder();
  checkThemeSwitcherMarkup();
}

if (errors.length) {
  console.error('\nLanding i18n checks failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Landing i18n checks passed:');
console.log(`- locales: ${locales.join(', ')}`);
console.log(`- dictionaries: matching keys`);
console.log(`- canonical anchors + legacy aliases present`);
console.log('- nav IA: six section targets + Comparison, desktop/mobile parity');
console.log(`- section order: ${sectionOrder.join(' → ')}`);
console.log('- sitemap includes all locales');
console.log('- no German UI smoke phrases in en/fr/it/es');
