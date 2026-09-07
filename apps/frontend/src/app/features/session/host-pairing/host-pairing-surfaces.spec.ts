import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (...parts: string[]) => resolve(process.cwd(), 'src/app/features/session', ...parts);

describe('Host-Pairing Oberflächengrenzen (Story 2.10)', () => {
  it('bietet Freigabe und Präsentationsstart nur im privaten Host-Client an', () => {
    const hostHtml = readFileSync(root('session-host/session-host.component.html'), 'utf8');
    const hostTs = readFileSync(root('session-host/session-host.component.ts'), 'utf8');
    expect(hostHtml).toContain('data-testid="connect-smartphone"');
    expect(hostTs).toContain('HostPairingDialogComponent');
    expect(hostTs).toContain('PresentationStartDialogComponent');
    expect(hostTs).toContain('startPresenterView');
    expect(hostTs).toContain('openHostPairingDialog');
    expect(hostTs).toContain('showHostPairingAction');
    expect(hostTs).toContain('markHostAccessRevoked');
    expect(hostTs).toContain('setOutputEnabled');
    expect(hostHtml).toContain('host-access-revoked');
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
    expect(pairingTs).toContain('revokePairedHost');
  });

  it('begrenzt Overlay-Anpassungen auf die Pairing-panelClass', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8');
    expect(styles).toContain('.cdk-overlay-pane.host-pairing-dialog-panel');
    expect(styles).toContain('.cdk-overlay-pane.presentation-start-dialog-panel');
    expect(styles).not.toMatch(/host-pairing[\s\S]*::ng-deep/);
  });
});
