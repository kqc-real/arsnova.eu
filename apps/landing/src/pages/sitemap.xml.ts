import type { APIRoute } from 'astro';

import { toAbsoluteUrl } from '@/config/site';

export const prerender = true;

const pages = [
  { path: '', lastmod: '2026-07-27', changefreq: 'weekly', priority: '1.0' },
  { path: 'impressum/', lastmod: '2026-07-19', changefreq: 'monthly', priority: '0.5' },
  { path: 'datenschutz/', lastmod: '2026-07-19', changefreq: 'monthly', priority: '0.5' },
];

export const GET: APIRoute = () => {
  const urls = pages
    .map(
      (page) =>
        `<url><loc>${toAbsoluteUrl(page.path)}</loc><lastmod>${page.lastmod}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`,
    )
    .join('');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
