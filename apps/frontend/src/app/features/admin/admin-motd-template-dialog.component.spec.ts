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
});
