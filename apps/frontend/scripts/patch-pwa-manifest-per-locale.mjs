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
    screenshotWide: 'arsnova.eu – Startseite',
    screenshotNarrow: 'arsnova.eu – Startseite am Handy',
    screenshotWideQuiz: 'arsnova.eu – Live-Quiz aus dem Demo',
    screenshotNarrowQuiz: 'arsnova.eu – Abstimmung im Demo-Quiz',
    screenshotWideCloud: 'arsnova.eu – Wortwolke aus dem Demo-Quiz',
    screenshotNarrowCloud: 'arsnova.eu – Freitext im Demo-Quiz',
  },
  en: {
    name: 'arsnova.eu | The European Alternative to Mentimeter & Kahoot',
    description:
      'Interactive sessions, quizzes & live feedback – Made in Europe. The privacy-first ARS since 2012 for schools, universities, and business. Discover more!',
    screenshotWide: 'arsnova.eu – Home',
    screenshotNarrow: 'arsnova.eu – Home on a phone',
    screenshotWideQuiz: 'arsnova.eu – Live demo quiz',
    screenshotNarrowQuiz: 'arsnova.eu – Voting in the demo quiz',
    screenshotWideCloud: 'arsnova.eu – Word cloud from the demo quiz',
    screenshotNarrowCloud: 'arsnova.eu – Open response in the demo quiz',
  },
  fr: {
    name: "arsnova.eu | L'alternative européenne à Mentimeter et Kahoot",
    description:
      "Sessions interactives, quiz et sondages – Made in Europe. La solution RGPD pour l'enseignement et les entreprises depuis 2012. Essayez arsnova.eu !",
    screenshotWide: 'arsnova.eu – Accueil',
    screenshotNarrow: 'arsnova.eu – Accueil sur mobile',
    screenshotWideQuiz: 'arsnova.eu – Quiz live de la démo',
    screenshotNarrowQuiz: 'arsnova.eu – Vote dans le quiz démo',
    screenshotWideCloud: 'arsnova.eu – Nuage de mots de la démo',
    screenshotNarrowCloud: 'arsnova.eu – Réponse libre dans la démo',
  },
  es: {
    name: 'arsnova.eu | La alternativa europea a Mentimeter & Kahoot',
    description:
      'Sesiones interactivas, quizzes y feedback – Made in Europe. La solución de privacidad para educación y empresas desde 2012. ¡Prueba arsnova.eu!',
    screenshotWide: 'arsnova.eu – Inicio',
    screenshotNarrow: 'arsnova.eu – Inicio en el móvil',
    screenshotWideQuiz: 'arsnova.eu – Quiz en vivo de la demo',
    screenshotNarrowQuiz: 'arsnova.eu – Votación en el quiz demo',
    screenshotWideCloud: 'arsnova.eu – Nube de palabras de la demo',
    screenshotNarrowCloud: 'arsnova.eu – Texto libre en el quiz demo',
  },
  it: {
    name: "arsnova.eu | L'alternativa europea a Mentimeter e Kahoot",
    description:
      'Sessioni interattive, quiz e feedback live – Made in Europe. La soluzione sicura per scuole, università e business dal 2012. Scopri arsnova.eu!',
    screenshotWide: 'arsnova.eu – Home',
    screenshotNarrow: 'arsnova.eu – Home sul telefono',
    screenshotWideQuiz: 'arsnova.eu – Quiz live della demo',
    screenshotNarrowQuiz: 'arsnova.eu – Voto nel quiz demo',
    screenshotWideCloud: 'arsnova.eu – Nuvola di parole della demo',
    screenshotNarrowCloud: 'arsnova.eu – Testo libero nel quiz demo',
  },
};

/** Ordnet Manifest-`src` auf den Locale-Label-Schlüssel. Spezifischere Dateinamen zuerst. */
export function screenshotLabelKey(src) {
  const file = String(src ?? '')
    .split('?')[0]
    .split('/')
    .pop();
  if (file === 'screenshot-wide-quiz.png') return 'screenshotWideQuiz';
  if (file === 'screenshot-narrow-quiz.png') return 'screenshotNarrowQuiz';
  if (file === 'screenshot-wide-cloud.png') return 'screenshotWideCloud';
  if (file === 'screenshot-narrow-cloud.png') return 'screenshotNarrowCloud';
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
    }

    fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
