import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveSeoForPath } from './seo-route-meta';

describe('resolveSeoForPath', () => {
  it('verwendet für den codefreien Join-Einstieg die Join-Metadaten', () => {
    expect(resolveSeoForPath('/join')).toEqual({
      title: 'Session beitreten – arsnova.eu',
      description:
        'Mit Session-Code einer Live-Veranstaltung beitreten – Quiz, Q&A oder Blitzlicht.',
    });
  });

  it('begrenzt Join-Metadaten auf das Join-Pfadsegment', () => {
    expect(resolveSeoForPath('/join/ABC123').title).toBe('Session beitreten – arsnova.eu');
    expect(resolveSeoForPath('/joinery').title).toBe(
      'arsnova.eu | Die europäische Alternative zu Mentimeter & Kahoot',
    );
  });

  it('verwendet die rollenorientierten Help-Metadaten', () => {
    expect(resolveSeoForPath('/help')).toEqual({
      title: 'Hilfe & Einstieg – arsnova.eu',
      description:
        'Hilfe für Veranstaltungsleitungen und Teilnehmende: Session starten, abstimmen, Q&A und Blitzlicht nutzen, Ergebnisse auswerten und Funktionen nachschlagen.',
    });
  });

  it('erhält in static-root-index.html sprachneutrale Pfade wie /host-recovery und /join beim Locale-Redirect', () => {
    const html = readFileSync(resolve(process.cwd(), 'static-root-index.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scriptBody = doc.querySelector('script')?.textContent ?? '';
    expect(scriptBody.length).toBeGreaterThan(0);
    const runRedirect = (pathname: string, search = '', hash = '', languages = ['de-DE', 'en']) => {
      let replacedUrl = '';
      const fn = new Function('location', 'navigator', scriptBody) as (
        loc: { pathname: string; search: string; hash: string; replace: (url: string) => void },
        nav: { languages: string[]; language: string },
      ) => void;
      fn(
        {
          pathname,
          search,
          hash,
          replace: (url: string) => {
            replacedUrl = url;
          },
        },
        { languages, language: languages[0] ?? 'en' },
      );
      return replacedUrl;
    };

    expect(runRedirect('/')).toBe('/de/');
    expect(runRedirect('/host-recovery')).toBe('/de/host-recovery');
    expect(runRedirect('/host-recovery/', '?code=F7KE5E', '#step')).toBe(
      '/de/host-recovery?code=F7KE5E#step',
    );
    expect(runRedirect('/join')).toBe('/de/join');
    expect(runRedirect('/join/F7KE5E', '', '', ['fr-FR'])).toBe('/fr/join/F7KE5E');
  });
});
