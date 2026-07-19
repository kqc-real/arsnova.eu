import { describe, expect, it } from 'vitest';
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
});
