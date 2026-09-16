import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendSrc = (...parts: string[]) => resolve(process.cwd(), 'src', ...parts);

describe('Epic-405 Dialogflächen', () => {
  it('begrenzt Overlay-Anpassungen auf die Lifecycle-panelClass', () => {
    const styles = readFileSync(frontendSrc('styles.scss'), 'utf8');
    expect(styles).toContain('.cdk-overlay-pane.session-lifecycle-dialog-panel');
    expect(styles).toContain('.cdk-overlay-backdrop.session-lifecycle-dialog-backdrop');
    expect(styles).toContain('surface-container-high');
    expect(styles).toMatch(
      /\.cdk-overlay-backdrop\.session-lifecycle-dialog-backdrop[\s\S]*?scrim\) 42%/,
    );
    expect(styles).not.toMatch(/session-lifecycle-dialog[\s\S]*::ng-deep/);
  });

  it('bindet Host-Dialoge an dieselbe Overlay-Fläche und den Titelvertrag', () => {
    const hostTs = readFileSync(
      frontendSrc('app/features/session/session-host/session-host.component.ts'),
      'utf8',
    );
    const qaHtml = readFileSync(
      frontendSrc(
        'app/features/session/session-host/qa-channel-configuration-dialog.component.html',
      ),
      'utf8',
    );
    const qaTs = readFileSync(
      frontendSrc('app/features/session/session-host/qa-channel-configuration-dialog.component.ts'),
      'utf8',
    );
    const expirationHtml = readFileSync(
      frontendSrc('app/features/session/session-host/session-expiration-dialog.component.html'),
      'utf8',
    );
    const retentionHtml = readFileSync(
      frontendSrc('app/features/session/session-host/session-retention-dialog.component.html'),
      'utf8',
    );
    const retentionTs = readFileSync(
      frontendSrc('app/features/session/session-host/session-retention-dialog.component.ts'),
      'utf8',
    );
    const recoveryHtml = readFileSync(
      frontendSrc('app/features/session/host-recovery/host-recovery-card-dialog.component.html'),
      'utf8',
    );
    const recoveryPage = readFileSync(
      frontendSrc('app/features/session/host-recovery/host-recovery.component.ts'),
      'utf8',
    );

    expect(hostTs).toContain("panelClass: 'session-lifecycle-dialog-panel'");
    expect(hostTs).toContain("backdropClass: 'session-lifecycle-dialog-backdrop'");
    expect(qaTs).toContain('dialog-title-header.scss');
    expect(qaHtml).toContain('dialog-title-header');
    expect(qaHtml).toContain('matButton="filled"');
    expect(qaHtml).not.toContain('mat-flat-button');
    expect(expirationHtml).toContain('dialog-title-header');
    expect(retentionTs).toContain('dialog-title-header.scss');
    expect(retentionHtml).toContain('dialog-title-header');
    expect(retentionHtml).toContain('matButton="text"');
    expect(recoveryHtml).toContain('dialog-title-header');
    expect(recoveryPage).toContain('dialog-title-header--page');
    expect(recoveryPage).toContain('host-recovery-page__card');
  });
});
