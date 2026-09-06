import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminProductFeedbackPanelComponent } from './admin-product-feedback-panel.component';

describe('AdminProductFeedbackPanelComponent formatting', () => {
  let component: AdminProductFeedbackPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOCALE_ID, useValue: 'de-DE' }],
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
});
