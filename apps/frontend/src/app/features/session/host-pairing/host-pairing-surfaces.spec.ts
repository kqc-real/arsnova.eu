import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (...parts: string[]) => resolve(process.cwd(), 'src/app/features/session', ...parts);

describe('Host-Pairing Oberflächengrenzen (Story 2.10)', () => {
  it('bietet Freigabe und Präsentationsstart nur im privaten Host-Client an', () => {
    const hostHtml = readFileSync(root('session-host/session-host.component.html'), 'utf8');
    const hostTs = readFileSync(root('session-host/session-host.component.ts'), 'utf8');
    const startHtml = readFileSync(
      root('host-pairing/presentation-start-dialog.component.html'),
      'utf8',
    );
    expect(hostHtml).not.toContain('data-testid="connect-smartphone"');
    expect(hostHtml).not.toContain('openHostPairingDialog');
    expect(hostTs).not.toContain('openHostPairingDialog');
    expect(hostTs).not.toContain('showHostPairingAction');
    expect(hostTs).toContain('PresentationStartDialogComponent');
    expect(hostTs).toContain('startPresenterView');
    expect(startHtml).toContain('data-testid="presentation-start-connect"');
    expect(hostTs).toContain('markHostAccessRevoked');
    expect(hostTs).toContain('setOutputEnabled');
    expect(hostHtml).toContain('host-access-revoked');
    expect(hostHtml).toContain('session-host--revoked');
    expect(readFileSync(root('session-host/session-host.component.scss'), 'utf8')).toContain(
      '.session-host.session-host--revoked',
    );
  });

  it('hält Presenter frei von Pairing-Secrets und Freigabe-Aktionen', () => {
    const presentHtml = readFileSync(
      root('session-present/session-present.component.html'),
      'utf8',
    );
    const presentTs = readFileSync(root('session-present/session-present.component.ts'), 'utf8');
    expect(presentHtml).not.toContain('connect-smartphone');
    expect(presentHtml).not.toContain('Als Host zulassen');
    expect(presentHtml).not.toContain('host-pairing-approve');
    expect(presentTs).not.toContain('createHostPairingInvite');
    expect(presentTs).not.toContain('approveHostPairing');
    expect(presentTs).not.toContain('pairingSecret');
    expect(presentTs).not.toContain('PresentationStartDialog');
    expect(presentHtml).not.toContain('presentation-start-connect');
    expect(presentTs).not.toContain('revokePairedHost');
    expect(presentHtml).not.toContain('host-pairing-revoke');
    expect(presentHtml).not.toContain('Verbindung trennen');
    const pairingTs = readFileSync(root('host-pairing/host-pairing-dialog.component.ts'), 'utf8');
    const pairingHtml = readFileSync(
      root('host-pairing/host-pairing-dialog.component.html'),
      'utf8',
    );
    expect(pairingTs).toContain('revokePairedHost');
    expect(pairingHtml).not.toContain('pairingUrl()');
    expect(pairingHtml).not.toContain('host-pairing-link');
  });

  it('begrenzt Overlay-Anpassungen auf die Pairing-panelClass', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8');
    expect(styles).toContain('.cdk-overlay-pane.host-pairing-dialog-panel');
    expect(styles).toContain('.cdk-overlay-pane.presentation-start-dialog-panel');
    expect(styles).toContain('.cdk-overlay-backdrop.host-pairing-dialog-backdrop');
    expect(styles).toContain('.cdk-overlay-backdrop.presentation-start-dialog-backdrop');
    expect(styles).toMatch(
      /\.cdk-overlay-pane\.host-pairing-dialog-panel\s*\{[\s\S]*?width:\s*min\(28rem/,
    );
    expect(styles).not.toMatch(/host-pairing[\s\S]*::ng-deep/);
  });

  it('strukturiert Pair- und Widerruf-Karten mit dialog-title-header und devices-Icon', () => {
    const pairHtml = readFileSync(
      root('host-pairing/session-host-pairing-request.component.html'),
      'utf8',
    );
    const pairTs = readFileSync(
      root('host-pairing/session-host-pairing-request.component.ts'),
      'utf8',
    );
    const pairScss = readFileSync(
      root('host-pairing/session-host-pairing-request.component.scss'),
      'utf8',
    );
    const hostHtml = readFileSync(root('session-host/session-host.component.html'), 'utf8');
    const hostScss = readFileSync(root('session-host/session-host.component.scss'), 'utf8');
    expect(pairTs).toContain('dialog-title-header.scss');
    expect(pairHtml).toContain('dialog-title-header--page');
    expect(pairHtml).toContain('<mat-icon>devices</mat-icon>');
    expect(pairHtml).toContain('host-pairing-request__section');
    expect(pairHtml).toContain('host-pairing-request__hint--confirm');
    expect(pairScss).toContain('.host-pairing-request__section');
    expect(pairScss).toContain('text-align: center');
    expect(hostHtml).toMatch(/host-access-revoked[\s\S]*dialog-title-header/);
    expect(hostHtml).toMatch(/host-access-revoked[\s\S]*<mat-icon>devices<\/mat-icon>/);
    expect(hostHtml).toContain('dialog-title-header__icon--warn');
    expect(hostScss).toContain('.session-host__revoked-head');
    const pairingHtml = readFileSync(
      root('host-pairing/host-pairing-dialog.component.html'),
      'utf8',
    );
    const startHtml = readFileSync(
      root('host-pairing/presentation-start-dialog.component.html'),
      'utf8',
    );
    expect(pairingHtml).toContain('<mat-icon>devices</mat-icon>');
    expect(pairingHtml).not.toContain('<mat-icon>smartphone</mat-icon>');
    expect(pairingHtml).toContain('app-qr-image');
    expect(pairingHtml).toContain('matButton="filled"');
    expect(pairingHtml).toContain('matButton="text"');
    expect(startHtml).toContain('<mat-icon>launch</mat-icon>');
    expect(startHtml).toContain('hourglass_top');
    expect(startHtml).not.toContain('presentation-start-dialog__subtitle-icon');
    expect(startHtml).toContain('matButton="filled"');
    expect(startHtml).toContain('matButton="outlined"');
    expect(startHtml).toContain('presentation-start-dialog__notice');
    expect(startHtml).not.toContain('present_to_all');
    expect(pairHtml).toContain('matButton="filled"');
    expect(pairHtml).toContain('matButton="text"');
    const pairingTs = readFileSync(root('host-pairing/host-pairing-dialog.component.ts'), 'utf8');
    const pairingScss = readFileSync(
      root('host-pairing/host-pairing-dialog.component.scss'),
      'utf8',
    );
    const startScss = readFileSync(
      root('host-pairing/presentation-start-dialog.component.scss'),
      'utf8',
    );
    expect(pairingTs).toContain('createDataURL(8, 4)');
    expect(pairingScss).toContain('padding: 0.65rem');
    expect(pairingScss).toContain('host-pairing-md3');
    expect(startScss).toContain('host-pairing-md3');
    expect(pairScss).toContain('host-pairing-md3');
  });

  it('zentriert die Smartphone-Pair-Karte in der verbleibenden Viewport-Höhe', () => {
    const sessionHtml = readFileSync(root('session.component.html'), 'utf8');
    const sessionTs = readFileSync(root('session.component.ts'), 'utf8');
    const pairScss = readFileSync(
      root('host-pairing/session-host-pairing-request.component.scss'),
      'utf8',
    );
    const sessionScss = readFileSync(root('session.component.scss'), 'utf8');
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8');
    expect(sessionTs).toContain('isPairRoute');
    expect(sessionHtml).toContain('session-page-shell--pair');
    expect(sessionScss).toContain('.session-page-shell--pair');
    expect(sessionScss).toContain('justify-content: center');
    expect(styles).toContain('.l-page.session-page-shell--pair:first-child');
    expect(pairScss).toContain('justify-content: center');
  });
});
