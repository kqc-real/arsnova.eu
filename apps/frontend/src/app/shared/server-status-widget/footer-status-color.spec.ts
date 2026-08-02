import { describe, expect, it } from 'vitest';
import { resolveFooterStatusColor, resolveFooterStatusDotCssColor } from './footer-status-color';

describe('footer-status-color', () => {
  it('maps serviceStatus to ampelfarben', () => {
    expect(resolveFooterStatusColor(true, false, { serviceStatus: 'stable' })).toBe('green');
    expect(resolveFooterStatusColor(true, false, { serviceStatus: 'limited' })).toBe('yellow');
    expect(resolveFooterStatusColor(true, false, { serviceStatus: 'critical' })).toBe('red');
  });

  it('falls back to gray while offline, loading, or without stats', () => {
    expect(resolveFooterStatusColor(false, false, { serviceStatus: 'stable' })).toBe('gray');
    expect(resolveFooterStatusColor(true, true, { serviceStatus: 'stable' })).toBe('gray');
    expect(resolveFooterStatusColor(true, false, null)).toBe('gray');
  });

  it('maps colors to design tokens', () => {
    expect(resolveFooterStatusDotCssColor('green')).toBe('var(--app-status-healthy)');
    expect(resolveFooterStatusDotCssColor('yellow')).toBe('var(--app-status-busy)');
    expect(resolveFooterStatusDotCssColor('red')).toBe('var(--mat-sys-error)');
    expect(resolveFooterStatusDotCssColor('gray')).toBe('var(--mat-sys-outline-variant)');
  });
});
