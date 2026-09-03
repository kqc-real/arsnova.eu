import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AdminComponent } from './admin.component';

vi.mock('../../core/trpc.client', () => ({
  getAdminToken: vi.fn().mockReturnValue(null),
  setAdminToken: vi.fn(),
  trpc: {
    admin: {
      whoami: { query: vi.fn().mockRejectedValue(new Error('unauthorized')) },
      listSessions: { query: vi.fn().mockResolvedValue({ sessions: [], total: 0 }) },
    },
  },
}));

describe('AdminComponent', () => {
  it('rendert Quiz-Markdown mit Lightbox-Attributen und absolutisierten Asset-URLs', () => {
    const previousBaseHref = document.querySelector('base')?.getAttribute('href') ?? null;
    let baseEl = document.querySelector('base');
    if (!baseEl) {
      baseEl = document.createElement('base');
      document.head.appendChild(baseEl);
    }
    baseEl.setAttribute('href', '/de/');

    try {
      TestBed.configureTestingModule({
        imports: [AdminComponent],
      });

      const fixture = TestBed.createComponent(AdminComponent);
      const html = String(
        (
          fixture.componentInstance.renderQuizRichText(
            '![Demo](/assets/demo/example.png)',
          ) as unknown as { changingThisBreaksApplicationSecurity?: string }
        ).changingThisBreaksApplicationSecurity ?? '',
      );

      expect(html).toMatch(/data-markdown-image-lightbox="true"/);
      expect(html).toMatch(/data-markdown-image-state="loading"/);
      expect(html).toContain('/de/assets/demo/example.png');
    } finally {
      if (previousBaseHref === null) {
        baseEl.removeAttribute('href');
      } else {
        baseEl.setAttribute('href', previousBaseHref);
      }
    }
  });

  it('liefert für denselben Text und Heading-Level dieselbe SafeHtml-Referenz', () => {
    TestBed.configureTestingModule({
      imports: [AdminComponent],
    });

    const fixture = TestBed.createComponent(AdminComponent);
    const first = fixture.componentInstance.renderQuizRichText(
      '![Demo](https://example.org/a.png)',
    );
    const second = fixture.componentInstance.renderQuizRichText(
      '![Demo](https://example.org/a.png)',
    );
    const differentLevel = fixture.componentInstance.renderQuizRichText(
      '![Demo](https://example.org/a.png)',
      4,
    );

    expect(second).toBe(first);
    expect(differentLevel).not.toBe(first);
  });

  it('hält Tab-, Button- und Markdown-Overrides ohne Piercing-Selektoren', () => {
    const styles = readFileSync(
      resolve(process.cwd(), 'src/app/features/admin/admin.component.scss'),
      'utf8',
    );
    const globalStyles = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8');

    expect(styles).not.toContain('::ng-deep');
    expect(styles).not.toContain(':deep(');
    expect(globalStyles).toMatch(/\.admin-tabs \.mat-mdc-tab-body-content\s*\{/);
    expect(globalStyles).toMatch(/\.admin-card \.mdc-button__label\s*\{/);
    expect(globalStyles).toMatch(/\.admin-question__text\.markdown-body p\s*\{/);
    expect(globalStyles).toMatch(/\.admin-answer-text\.markdown-body p\s*\{/);
  });
});
