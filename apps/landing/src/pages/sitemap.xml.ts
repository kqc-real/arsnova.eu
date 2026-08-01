import type { APIRoute } from 'astro';

import { toAbsoluteUrl } from '@/config/site';
import { LOCALES } from '@/i18n';

export const prerender = true;

const legalPages = [
  { path: 'impressum/', lastmod: '2026-07-19', changefreq: 'monthly', priority: '0.5' },
  { path: 'datenschutz/', lastmod: '2026-07-19', changefreq: 'monthly', priority: '0.5' },
];

export const GET: APIRoute = () => {
  const localeUrls = LOCALES.map(
    (locale) =>
      `<url><loc>${toAbsoluteUrl(`${locale}/`)}</loc><lastmod>2026-08-01</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
  );

  const legalUrls = legalPages.map(
    (page) =>
      `<url><loc>${toAbsoluteUrl(page.path)}</loc><lastmod>${page.lastmod}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`,
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...localeUrls, ...legalUrls].join('')}</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
