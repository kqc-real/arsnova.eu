import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { AdminMotdTemplateDialogComponent } from './admin-motd-template-dialog.component';

describe('AdminMotdTemplateDialogComponent', () => {
  it('öffnet leeres Formular für neue Vorlage', () => {
    TestBed.configureTestingModule({
      imports: [AdminMotdTemplateDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { templateId: null } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(AdminMotdTemplateDialogComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.tplName()).toBe('');
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.isEdit()).toBe(false);
  });

  it('absolutisiert Root-Asset-Bilder in der Template-Vorschau', () => {
    const previousBaseHref = document.querySelector('base')?.getAttribute('href') ?? null;
    let baseEl = document.querySelector('base');
    if (!baseEl) {
      baseEl = document.createElement('base');
      document.head.appendChild(baseEl);
    }
    baseEl.setAttribute('href', '/de/');

    try {
      TestBed.configureTestingModule({
        imports: [AdminMotdTemplateDialogComponent],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: { templateId: null } },
          { provide: MatDialogRef, useValue: { close: vi.fn() } },
        ],
      });

      const fixture = TestBed.createComponent(AdminMotdTemplateDialogComponent);
      fixture.componentInstance.tplMdDe.set('![Banner](/assets/images/AI-REVOLUTION.png)');
      fixture.detectChanges();

      const html = String(
        (
          fixture.componentInstance.previewHtml() as unknown as {
            changingThisBreaksApplicationSecurity?: string;
          }
        ).changingThisBreaksApplicationSecurity ?? '',
      );

      expect(html).toContain('/de/assets/images/AI-REVOLUTION.png');
      expect(html).toMatch(/data-markdown-image-lightbox="true"/);
    } finally {
      if (previousBaseHref === null) {
        baseEl.removeAttribute('href');
      } else {
        baseEl.setAttribute('href', previousBaseHref);
      }
    }
  });
});
