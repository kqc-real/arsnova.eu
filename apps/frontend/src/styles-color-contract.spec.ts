import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8');

describe('Globales Farbkonzept (Overlay-Chrome)', () => {
  it('steuert Dialog-Surfaces global statt über eine panelClass-Whitelist', () => {
    expect(styles).toContain('@mixin app-dialog-surface-base');
    expect(styles).toContain('@mixin app-playful-surface-chrome');
    expect(styles).toMatch(
      /\.cdk-overlay-pane:not\(\.word-cloud-dialog-panel\):not\(\.markdown-image-lightbox-dialog-panel\):not\(\s*\.product-feedback-in-app-dialog-panel\s*\)/,
    );
    expect(styles).toMatch(/@include app-dialog-surface-base;/);
    expect(styles).toMatch(/html\.preset-playful[\s\S]*@include app-playful-surface-chrome;/);
    expect(styles).not.toMatch(
      /html\.preset-playful \.cdk-overlay-pane\.host-pairing-dialog-panel \.mat-mdc-dialog-surface,/,
    );
    expect(styles).not.toMatch(
      /html\.preset-playful \.cdk-overlay-pane\.admin-motd-template-dialog-panel \.mat-mdc-dialog-surface,/,
    );
  });

  it('hält Fullscreen- und Sheet-Träger transparent', () => {
    expect(styles).toMatch(
      /\.cdk-overlay-pane\.word-cloud-dialog-panel \.mat-mdc-dialog-surface\s*\{[\s\S]*?background:\s*transparent/,
    );
    expect(styles).toMatch(
      /\.cdk-overlay-pane\.markdown-image-lightbox-dialog-panel \.mat-mdc-dialog-surface\s*\{[\s\S]*?background:\s*transparent/,
    );
    expect(styles).toMatch(
      /\.cdk-overlay-pane\.product-feedback-in-app-dialog-panel \.mat-mdc-dialog-surface\s*\{[\s\S]*?background:\s*transparent/,
    );
    expect(styles).toMatch(
      /\.cdk-overlay-backdrop\.markdown-image-lightbox-dialog-backdrop\s*\{[\s\S]*?mat-sys-scrim/,
    );
    expect(styles).not.toMatch(
      /\.cdk-overlay-backdrop\.markdown-image-lightbox-dialog-backdrop\s*\{[\s\S]*?rgb\(\s*7\s+10\s+16/,
    );
  });

  it('bindet Menü, Select, Tooltip, Datepicker, Snackbar und Filled-CTAs global', () => {
    expect(styles).toContain('@include mat.tooltip-overrides');
    expect(styles).toContain('@include mat.menu-overrides');
    expect(styles).toContain('@include mat.select-overrides');
    expect(styles).toContain('@include mat.autocomplete-overrides');
    expect(styles).toContain('@include mat.datepicker-overrides');
    expect(styles).toContain('@include mat.snack-bar-overrides');
    expect(styles).toContain('--mat-button-filled-container-color: var(--mat-sys-tertiary)');
    expect(styles).toContain(
      '--mat-button-tonal-container-color: var(--mat-sys-surface-container-high)',
    );
    expect(styles).toMatch(
      /html\.preset-playful \.mat-mdc-snack-bar-container:not\(\.feedback-compare-round-snackbar\)/,
    );
    expect(styles).toMatch(
      /html\.preset-playful \.mat-mdc-snack-bar-container:not\(\.feedback-compare-round-snackbar\)[\s\S]*--mat-snack-bar-container-color/,
    );
    expect(styles).not.toMatch(/tooltip-overrides[\s\S]*inverse-surface/);
    expect(styles).not.toMatch(/menu-overrides[\s\S]*inverse-surface/);
  });
});
