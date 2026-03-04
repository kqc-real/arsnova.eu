import { RenderMode, ServerRoute } from '@angular/ssr';

/** Feste Routen pre-rendern (Shell/SEO). session/:code, join/:code, admin bleiben Client-only. */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'help', renderMode: RenderMode.Prerender },
  { path: 'quiz', renderMode: RenderMode.Prerender },
  { path: 'legal/imprint', renderMode: RenderMode.Prerender },
  { path: 'legal/privacy', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
