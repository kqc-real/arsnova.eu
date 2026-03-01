import { RenderMode, ServerRoute } from '@angular/ssr';

/** Nur feste Routen pre-rendern (Shell/SEO). legal/:slug und session/:code bleiben Client-only. */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'help', renderMode: RenderMode.Prerender },
  { path: 'quiz', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
