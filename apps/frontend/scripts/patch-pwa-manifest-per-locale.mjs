// Nach `ng build --localize`: pro Locale start_url, lang, name, description, Screenshot-Labels.
// name/description = gleiche Bedeutung wie seo.titleHome / seo.descHome (XLF).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browserDir = path.resolve(__dirname, '../dist/browser');
const LOCALES = ['de', 'en', 'fr', 'it', 'es'];

const MANIFEST_I18N = {
  de: {
    name: 'arsnova.eu | Die europäische Alternative zu Mentimeter & Kahoot',
    description:
      'Interaktive Sessions, Quiz & Feedback – Made in Europe. Seit 2012 die DSGVO-konforme Lösung für Schule, Uni & Business. Jetzt arsnova.eu entdecken!',
    screenshotWide: 'arsnova.eu – Desktop Ansicht',
    screenshotNarrow: 'arsnova.eu – Mobile Ansicht',
  },
  en: {
    name: 'arsnova.eu | The European Alternative to Mentimeter & Kahoot',
    description:
      'Interactive sessions, quizzes & live feedback – Made in Europe. The privacy-first ARS since 2012 for schools, universities, and business. Discover more!',
    screenshotWide: 'arsnova.eu – Desktop view',
    screenshotNarrow: 'arsnova.eu – Mobile view',
  },
  fr: {
    name: "arsnova.eu | L'alternative européenne à Mentimeter et Kahoot",
    description:
      "Sessions interactives, quiz et sondages – Made in Europe. La solution RGPD pour l'enseignement et les entreprises depuis 2012. Essayez arsnova.eu !",
    screenshotWide: 'arsnova.eu – Vue bureau',
    screenshotNarrow: 'arsnova.eu – Vue mobile',
  },
  es: {
    name: 'arsnova.eu | La alternativa europea a Mentimeter y Kahoot',
    description:
      'Sesiones interactivas, quizzes y feedback – Made in Europe. La solución de privacidad para educación y empresas desde 2012. ¡Prueba arsnova.eu!',
    screenshotWide: 'arsnova.eu – Vista de escritorio',
    screenshotNarrow: 'arsnova.eu – Vista móvil',
  },
  it: {
    name: "arsnova.eu | L'alternativa europea a Mentimeter e Kahoot",
    description:
      'Sessioni interattive, quiz e feedback live – Made in Europe. La soluzione sicura per scuole, università e business dal 2012. Scopri arsnova.eu!',
    screenshotWide: 'arsnova.eu – Vista desktop',
    screenshotNarrow: 'arsnova.eu – Vista mobile',
  },
};

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
      if (Array.isArray(json.screenshots)) {
        for (const shot of json.screenshots) {
          if (shot.form_factor === 'wide') shot.label = copy.screenshotWide;
          if (shot.form_factor === 'narrow') shot.label = copy.screenshotNarrow;
        }
      }
    }

    fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  }
}

main();
