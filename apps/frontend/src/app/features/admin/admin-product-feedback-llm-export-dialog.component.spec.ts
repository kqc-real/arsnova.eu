import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminProductFeedbackLlmExportDialogComponent } from './admin-product-feedback-llm-export-dialog.component';

const mutateMock = vi.fn();

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    admin: {
      productFeedback: {
        exportForLlm: { mutate: (...args: unknown[]) => mutateMock(...args) },
      },
    },
  },
}));

describe('AdminProductFeedbackLlmExportDialogComponent', () => {
  let fixture: ComponentFixture<AdminProductFeedbackLlmExportDialogComponent>;
  let component: AdminProductFeedbackLlmExportDialogComponent;

  beforeEach(async () => {
    mutateMock.mockReset();
    mutateMock.mockResolvedValue({
      fileName: 'arsnova-product-feedback_2026-09-06.md',
      markdown: '# test',
      prompt: 'Du bist Produktanalyst:in',
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    await TestBed.configureTestingModule({
      imports: [AdminProductFeedbackLlmExportDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { source: 'IN_APP' } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminProductFeedbackLlmExportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lässt Freitext standardmäßig aus und zeigt den Hinweis erst nach der Auswahl', () => {
    expect(component.includeMessages).toBe(false);
    expect(component.excludeDiscarded).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Die Datei verlässt arsnova.eu');
    component.includeMessages = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Die Datei verlässt arsnova.eu');
  });

  it('übergibt Filter und Opt-in an den Export', async () => {
    component.includeMessages = true;
    await component.downloadMarkdown();
    expect(mutateMock).toHaveBeenCalledWith({
      source: 'IN_APP',
      includeMessages: true,
      excludeDiscarded: true,
    });
    expect(component.status()).toContain('Markdown-Datei');
  });
});
