import { defineConfig } from 'astro/config';

// Custom-Domain-Deployments liegen am Domain-Root. Für Projekt-Sites können
// beide Werte beim Build weiterhin explizit überschrieben werden.
const base = process.env.BASE_PATH || '/';
const site = process.env.PUBLIC_SITE_URL || 'https://info.arsnova.eu/';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: 'static',
  i18n: {
    locales: ['de', 'en', 'fr', 'it', 'es'],
    defaultLocale: 'de',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
});
