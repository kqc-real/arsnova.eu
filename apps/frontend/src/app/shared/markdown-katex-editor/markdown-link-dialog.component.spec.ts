import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { markdownLinkHrefValidator } from './markdown-link-dialog.component';

describe('markdownLinkHrefValidator', () => {
  it('accepts https URLs without spaces', () => {
    const c = new FormControl('https://example.com/path');
    expect(markdownLinkHrefValidator(c)).toBeNull();
  });

  it('accepts mailto with local part', () => {
    const c = new FormControl('mailto:team@schule.de');
    expect(markdownLinkHrefValidator(c)).toBeNull();
  });

  it('accepts mailto with query', () => {
    const c = new FormControl('mailto:a@b.co?subject=Hi');
    expect(markdownLinkHrefValidator(c)).toBeNull();
  });

  it('accepts tel links', () => {
    const c = new FormControl('tel:+49301234567');
    expect(markdownLinkHrefValidator(c)).toBeNull();
  });

  it('rejects bare mailto', () => {
    const c = new FormControl('mailto:');
    expect(markdownLinkHrefValidator(c)).toEqual({ markdownLinkHref: true });
  });

  it('rejects bare tel', () => {
    const c = new FormControl('tel:');
    expect(markdownLinkHrefValidator(c)).toEqual({ markdownLinkHref: true });
  });

  it('rejects http without s', () => {
    const c = new FormControl('http://example.com');
    expect(markdownLinkHrefValidator(c)).toEqual({ markdownLinkHref: true });
  });

  it('rejects https with space', () => {
    const c = new FormControl('https://ex ample.com');
    expect(markdownLinkHrefValidator(c)).toEqual({ markdownLinkHref: true });
  });

  it('returns null when empty (required handles that)', () => {
    const c = new FormControl('');
    expect(markdownLinkHrefValidator(c)).toBeNull();
  });
});
