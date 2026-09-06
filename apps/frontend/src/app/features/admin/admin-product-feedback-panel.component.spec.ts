import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminProductFeedbackPanelComponent } from './admin-product-feedback-panel.component';

describe('AdminProductFeedbackPanelComponent formatting', () => {
  let component: AdminProductFeedbackPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: 'de-DE' },
        {
          provide: MatDialog,
          useValue: {
            open: vi.fn(() => ({ afterClosed: () => ({ subscribe: vi.fn() }) })),
          },
        },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AdminProductFeedbackPanelComponent());
  });

  it('formatiert Anteile mit der aktuellen Locale', () => {
    expect(component.formatRate(0.125)).toMatch(/^12,5\s?%$/);
    expect(component.formatShare(1, 4)).toMatch(/^25\s?%$/);
  });

  it('verschiebt lokale Kalendertage nicht durch eine vorzeitige UTC-Interpretation', () => {
    const selected = new Date(2026, 8, 6);
    const from = new Date(component['dayBoundIso'](selected, false));
    const to = new Date(component['dayBoundIso'](selected, true));

    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(8);
    expect(from.getDate()).toBe(6);
    expect(from.getHours()).toBe(0);
    expect(to.getDate()).toBe(6);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
  });

  it('übernimmt Postfachfilter in den LLM-Export', () => {
    component.fromDate = new Date(2026, 7, 1);
    component.inboxSourceFilter = 'IN_APP';
    component.inboxRoleFilter = 'HOST';
    component.inboxKindFilter = 'NOT_WORKING';
    const filters = component.currentLlmExportFilters();
    expect(filters.source).toBe('IN_APP');
    expect(filters.role).toBe('HOST');
    expect(filters.kind).toBe('NOT_WORKING');
    expect(filters.from).toBeDefined();
  });

  it('öffnet den Löschdialog mit dem Filterdatum „bis“', () => {
    const dialog = TestBed.inject(MatDialog);
    const open = vi.mocked(dialog.open);
    component.toDate = new Date(2026, 7, 31);
    component.openPurgeDialog();
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { untilDate: component.toDate },
        panelClass: 'admin-product-feedback-dialog-panel',
      }),
    );
  });
});
