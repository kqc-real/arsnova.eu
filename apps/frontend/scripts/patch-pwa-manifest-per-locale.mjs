// Nach `ng build --localize`: pro Locale start_url, lang, name, description, Screenshot-Labels.
// name/description = gleiche Bedeutung wie seo.titleHome / seo.descHome (XLF).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browserDir = path.resolve(__dirname, '../dist/browser');
const LOCALES = ['de', 'en', 'fr', 'it', 'es'];

export const MANIFEST_I18N = {
  de: {
    name: 'arsnova.eu | Die europäische Alternative zu Mentimeter & Kahoot',
    description:
      'Interaktive Sessions, Quiz & Feedback – Made in Europe. Seit 2012 die DSGVO-konforme Lösung für Schule, Uni & Business. Jetzt arsnova.eu entdecken!',
    screenshotWide: 'Quiz, Q&A und Blitzlicht – ohne Anmeldung',
    screenshotWideLobby: 'Beitritt per QR-Code – ohne Account',
    screenshotWideQuiz: 'Live-Quiz, Q&A und Blitzlicht in einer Session',
    screenshotWidePresent: 'Beamer-Ansicht für Hörsaal und Workshop',
    screenshotWideCloud: 'Wortwolke live aus dem Publikum',
    screenshotWideQa: 'Fragen aus dem Publikum – ohne Login',
    screenshotWideFeedback: 'Blitzlicht: Stimmung in Sekunden',
    screenshotWideLeaderboard: 'Rangliste mit Teams und Nicknames',
    screenshotNarrow: 'Ohne Anmeldung live mitmachen',
    screenshotNarrowQuiz: 'Abstimmen am Handy – ohne Account',
    screenshotNarrowCloud: 'Freitext wird zur Wortwolke',
    screenshotNarrowQa: 'Anonym Fragen stellen',
    screenshotNarrowFeedback: 'Stimmungsbild mit einem Tipp',
    shortcutJoinName: 'Code eingeben',
    shortcutJoinShortName: 'Code',
    shortcutJoinDescription: 'Session-Code eingeben und ohne Anmeldung mitmachen',
    shortcutQuizName: 'Quiz erstellen',
    shortcutQuizShortName: 'Quiz',
    shortcutQuizDescription: 'Neues Quiz vorbereiten, lokal im Browser',
    shortcutQaName: 'Q&A öffnen',
    shortcutQaShortName: 'Q&A',
    shortcutQaDescription: 'Fragen aus dem Publikum sammeln',
    shortcutFeedbackName: 'Blitzlicht starten',
    shortcutFeedbackShortName: 'Blitzlicht',
    shortcutFeedbackDescription: 'Stimmung oder Tempo in Sekunden abfragen',
  },
  en: {
    name: 'arsnova.eu | The European Alternative to Mentimeter & Kahoot',
    description:
      'Interactive sessions, quizzes & live feedback – Made in Europe. The privacy-first ARS since 2012 for schools, universities, and business. Discover more!',
    screenshotWide: 'Quiz, Q&A and live feedback – no sign-up',
    screenshotWideLobby: 'Join with a QR code – no account',
    screenshotWideQuiz: 'Quiz, Q&A and live feedback in one session',
    screenshotWidePresent: 'Presenter view for lecture halls',
    screenshotWideCloud: 'Live word cloud from the audience',
    screenshotWideQa: 'Audience Q&A – no login',
    screenshotWideFeedback: 'Mood check in seconds',
    screenshotWideLeaderboard: 'Team leaderboard with nicknames',
    screenshotNarrow: 'Join live without an account',
    screenshotNarrowQuiz: 'Vote on your phone – no account',
    screenshotNarrowCloud: 'Open answers become a word cloud',
    screenshotNarrowQa: 'Ask a question anonymously',
    screenshotNarrowFeedback: 'Mood check with one tap',
    shortcutJoinName: 'Enter the code',
    shortcutJoinShortName: 'Code',
    shortcutJoinDescription: 'Enter a session code and join without signing up',
    shortcutQuizName: 'Create quiz',
    shortcutQuizShortName: 'Quiz',
    shortcutQuizDescription: 'Prepare a new quiz locally in the browser',
    shortcutQaName: 'Open Q&A',
    shortcutQaShortName: 'Q&A',
    shortcutQaDescription: 'Collect questions from the audience',
    shortcutFeedbackName: 'Start pulse check',
    shortcutFeedbackShortName: 'Pulse',
    shortcutFeedbackDescription: 'Check mood or tempo in seconds',
  },
  fr: {
    name: "arsnova.eu | L'alternative européenne à Mentimeter et Kahoot",
    description:
      "Sessions interactives, quiz et sondages – Made in Europe. La solution RGPD pour l'enseignement et les entreprises depuis 2012. Essayez arsnova.eu !",
    screenshotWide: 'Quiz, Q&R et feedback – sans inscription',
    screenshotWideLobby: 'Rejoindre par QR – sans compte',
    screenshotWideQuiz: 'Quiz, Q&R et feedback dans une session',
    screenshotWidePresent: 'Vue présentateur pour l’amphi',
    screenshotWideCloud: 'Nuage de mots en direct',
    screenshotWideQa: 'Questions du public – sans connexion',
    screenshotWideFeedback: 'Feedback express en quelques secondes',
    screenshotWideLeaderboard: 'Classement avec équipes et surnoms',
    screenshotNarrow: 'Participer en direct sans compte',
    screenshotNarrowQuiz: 'Voter sur mobile – sans compte',
    screenshotNarrowCloud: 'Le texte libre devient un nuage',
    screenshotNarrowQa: 'Poser une question anonymement',
    screenshotNarrowFeedback: 'Humeur de la salle en un tap',
    shortcutJoinName: 'Entrez le code',
    shortcutJoinShortName: 'Code',
    shortcutJoinDescription: 'Saisir le code de session et participer sans compte',
    shortcutQuizName: 'Créer un quiz',
    shortcutQuizShortName: 'Quiz',
    shortcutQuizDescription: 'Préparer un nouveau quiz dans le navigateur',
    shortcutQaName: 'Ouvrir le Q&A',
    shortcutQaShortName: 'Q&R',
    shortcutQaDescription: 'Collecter les questions du public',
    shortcutFeedbackName: 'Lancer le feedback express',
    shortcutFeedbackShortName: 'Flash',
    shortcutFeedbackDescription: 'Mesurer l’ambiance ou le tempo en quelques secondes',
  },
  es: {
    name: 'arsnova.eu | La alternativa europea a Mentimeter & Kahoot',
    description:
      'Sesiones interactivas, quizzes y feedback – Made in Europe. La solución de privacidad para educación y empresas desde 2012. ¡Prueba arsnova.eu!',
    screenshotWide: 'Quiz, Q&A y feedback – sin registro',
    screenshotWideLobby: 'Unirse con QR – sin cuenta',
    screenshotWideQuiz: 'Quiz, Q&A y feedback en una sesión',
    screenshotWidePresent: 'Vista de presentador para el aula',
    screenshotWideCloud: 'Nube de palabras en vivo',
    screenshotWideQa: 'Preguntas del público – sin login',
    screenshotWideFeedback: 'Feedback rápido en segundos',
    screenshotWideLeaderboard: 'Clasificación con equipos y apodos',
    screenshotNarrow: 'Participar en vivo sin cuenta',
    screenshotNarrowQuiz: 'Votar en el móvil – sin cuenta',
    screenshotNarrowCloud: 'El texto libre se vuelve nube',
    screenshotNarrowQa: 'Preguntar de forma anónima',
    screenshotNarrowFeedback: 'Estado de ánimo con un toque',
    shortcutJoinName: 'Introduce el código',
    shortcutJoinShortName: 'Código',
    shortcutJoinDescription: 'Introduce el código de sesión y participa sin cuenta',
    shortcutQuizName: 'Crear quiz',
    shortcutQuizShortName: 'Quiz',
    shortcutQuizDescription: 'Preparar un quiz nuevo en el navegador',
    shortcutQaName: 'Abrir Q&A',
    shortcutQaShortName: 'Q&A',
    shortcutQaDescription: 'Recoger preguntas del público',
    shortcutFeedbackName: 'Iniciar sondeo flash',
    shortcutFeedbackShortName: 'Flash',
    shortcutFeedbackDescription: 'Consultar el ánimo o el ritmo en segundos',
  },
  it: {
    name: "arsnova.eu | L'alternativa europea a Mentimeter e Kahoot",
    description:
      'Sessioni interattive, quiz e feedback live – Made in Europe. La soluzione sicura per scuole, università e business dal 2012. Scopri arsnova.eu!',
    screenshotWide: 'Quiz, Q&A e feedback – senza registrazione',
    screenshotWideLobby: 'Entra con QR – senza account',
    screenshotWideQuiz: 'Quiz, Q&A e feedback in una sessione',
    screenshotWidePresent: 'Vista presentatore per l’aula',
    screenshotWideCloud: 'Nuvola di parole in diretta',
    screenshotWideQa: 'Domande dal pubblico – senza login',
    screenshotWideFeedback: 'Feedback rapido in pochi secondi',
    screenshotWideLeaderboard: 'Classifica con squadre e nickname',
    screenshotNarrow: 'Partecipa in diretta senza account',
    screenshotNarrowQuiz: 'Vota dal telefono – senza account',
    screenshotNarrowCloud: 'Il testo libero diventa nuvola',
    screenshotNarrowQa: 'Fai una domanda in anonimo',
    screenshotNarrowFeedback: 'Umore della sala con un tap',
    shortcutJoinName: 'Inserisci il codice',
    shortcutJoinShortName: 'Codice',
    shortcutJoinDescription: 'Inserisci il codice sessione e partecipa senza account',
    shortcutQuizName: 'Crea quiz',
    shortcutQuizShortName: 'Quiz',
    shortcutQuizDescription: 'Prepara un nuovo quiz nel browser',
    shortcutQaName: 'Apri Q&A',
    shortcutQaShortName: 'Q&A',
    shortcutQaDescription: 'Raccogli le domande del pubblico',
    shortcutFeedbackName: 'Avvia sondaggio flash',
    shortcutFeedbackShortName: 'Flash',
    shortcutFeedbackDescription: 'Rileva umore o ritmo in pochi secondi',
  },
};

/** Ordnet Manifest-`src` auf den Locale-Label-Schlüssel. Spezifischere Dateinamen zuerst. */
export function screenshotLabelKey(src) {
  const file = String(src ?? '')
    .split('?')[0]
    .split('/')
    .pop();
  if (file === 'screenshot-wide-quiz.png') return 'screenshotWideQuiz';
  if (file === 'screenshot-wide-present.png') return 'screenshotWidePresent';
  if (file === 'screenshot-wide-cloud.png') return 'screenshotWideCloud';
  if (file === 'screenshot-wide-lobby.png') return 'screenshotWideLobby';
  if (file === 'screenshot-wide-qa.png') return 'screenshotWideQa';
  if (file === 'screenshot-wide-feedback.png') return 'screenshotWideFeedback';
  if (file === 'screenshot-wide-leaderboard.png') return 'screenshotWideLeaderboard';
  if (file === 'screenshot-narrow-quiz.png') return 'screenshotNarrowQuiz';
  if (file === 'screenshot-narrow-cloud.png') return 'screenshotNarrowCloud';
  if (file === 'screenshot-narrow-qa.png') return 'screenshotNarrowQa';
  if (file === 'screenshot-narrow-feedback.png') return 'screenshotNarrowFeedback';
  if (file === 'screenshot-wide.png') return 'screenshotWide';
  if (file === 'screenshot-narrow.png') return 'screenshotNarrow';
  return null;
}

export function applyScreenshotLabels(screenshots, copy) {
  if (!Array.isArray(screenshots) || !copy) return;
  for (const shot of screenshots) {
    const key = screenshotLabelKey(shot?.src);
    if (key && typeof copy[key] === 'string') {
      shot.label = copy[key];
    }
  }
}

const LOCALE_PREFIX = /^\/(de|en|fr|es|it)(?=\/|$)/;

/** Ordnet Shortcut-URLs auf MANIFEST_I18N-Präfixe (join / quiz / qa / feedback). */
export function shortcutCopyPrefix(url) {
  let parsed;
  try {
    parsed = new URL(String(url ?? ''), 'https://arsnova.eu');
  } catch {
    return null;
  }
  const path = parsed.pathname.replace(LOCALE_PREFIX, '') || '/';
  if (path === '/join' || path.endsWith('/join')) return 'shortcutJoin';
  if (path.includes('/quiz/new')) return 'shortcutQuiz';
  const host = parsed.searchParams.get('host');
  if (host === 'qa') return 'shortcutQa';
  if (host === 'quickFeedback') return 'shortcutFeedback';
  return null;
}

export function localizeShortcutUrl(url, locale) {
  let parsed;
  try {
    parsed = new URL(String(url ?? ''), 'https://arsnova.eu');
  } catch {
    return url;
  }
  const alreadyPrefixed = LOCALE_PREFIX.test(parsed.pathname);
  const path = alreadyPrefixed
    ? parsed.pathname
    : parsed.pathname === '/'
      ? `/${locale}/`
      : `/${locale}${parsed.pathname}`;
  return `${path}${parsed.search}${parsed.hash}`;
}

export function applyShortcutCopy(shortcuts, copy, locale) {
  if (!Array.isArray(shortcuts) || !copy) return;
  for (const shortcut of shortcuts) {
    const prefix = shortcutCopyPrefix(shortcut?.url);
    if (prefix) {
      const name = copy[`${prefix}Name`];
      const shortName = copy[`${prefix}ShortName`];
      const description = copy[`${prefix}Description`];
      if (typeof name === 'string') shortcut.name = name;
      if (typeof shortName === 'string') shortcut.short_name = shortName;
      if (typeof description === 'string') shortcut.description = description;
    }
    if (locale && typeof shortcut.url === 'string') {
      shortcut.url = localizeShortcutUrl(shortcut.url, locale);
    }
  }
}

function main() {
  if (!fs.existsSync(browserDir)) {
    console.warn('patch-pwa-manifest-per-locale: dist/browser fehlt, überspringe.');
    process.exit(0);
  }

  for (const locale of LOCALES) {
    const file = path.join(browserDir, locale, 'manifest.webmanifest');
    if (!fs.existsSync(file)) {
      console.warn(`patch-pwa-manifest-per-locale: ${file} fehlt, überspringe ${locale}.`);
      continue;
    }
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
      console.warn(`patch-pwa-manifest-per-locale: Lesen fehlgeschlagen (${locale}):`, e);
      continue;
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.warn(`patch-pwa-manifest-per-locale: JSON ungültig (${locale}):`, e);
      continue;
    }
    json.start_url = `/${locale}/?homescreen=1`;
    json.lang = locale;

    const copy = MANIFEST_I18N[locale];
    if (copy) {
      json.name = copy.name;
      json.description = copy.description;
      applyScreenshotLabels(json.screenshots, copy);
      applyShortcutCopy(json.shortcuts, copy, locale);
    }

    fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
