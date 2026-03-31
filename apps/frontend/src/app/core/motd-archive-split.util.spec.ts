import { describe, it, expect } from 'vitest';
import { splitMotdArchiveFirstAtxHeading } from './motd-archive-split.util';

describe('splitMotdArchiveFirstAtxHeading', () => {
  it('trennt führende H1 und Rumpf', () => {
    const r = splitMotdArchiveFirstAtxHeading('# Titel\n\nAbsatz.');
    expect(r.title).toBe('Titel');
    expect(r.bodyMarkdown).toBe('Absatz.');
  });

  it('trennt H2 ohne Leerzeile', () => {
    const r = splitMotdArchiveFirstAtxHeading('## Kurz\nText');
    expect(r.title).toBe('Kurz');
    expect(r.bodyMarkdown).toBe('Text');
  });

  it('liefert null und vollen Text ohne führende Überschrift', () => {
    const md = 'Nur Fliesstext ohne Hash.';
    const r = splitMotdArchiveFirstAtxHeading(md);
    expect(r.title).toBeNull();
    expect(r.bodyMarkdown).toBe(md);
  });

  it('ignoriert BOM unmittelbar vor der Überschrift', () => {
    const r = splitMotdArchiveFirstAtxHeading('\uFEFF# X\nY');
    expect(r.title).toBe('X');
    expect(r.bodyMarkdown).toBe('Y');
  });
});
