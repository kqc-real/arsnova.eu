import { describe, expect, it } from 'vitest';
import { buildHostRecoveryCardPlainText } from './host-recovery-card-format';

describe('host-recovery-card-format', () => {
  it('liefert Copy-all als Klartext mit unverändertem Recovery-Code', () => {
    const recoveryUrl = 'https://example.test/de/host-recovery';
    const text = buildHostRecoveryCardPlainText(
      {
        supportId: 'ARS-ABCD-2345',
        recoveryCode: 'AbC_def-1234567890abcdefghijklmnop',
      },
      recoveryUrl,
      {
        downloadHeading: 'Host-Zugangsdaten',
        supportIdLabel: 'Session-Kennung',
        recoveryCodeLabel: 'Wiederherstellungscode',
        recoveryPageLabel: 'Wiederherstellungsseite',
        downloadUsage: `Öffne ${recoveryUrl} in dem Browser.`,
        downloadRotationNotice: 'Nach einer Wiederherstellung gilt der neu ausgegebene Code.',
        downloadStatePending: 'Diese Zugangsdaten werden gültig nach Aktivierung.',
      },
    );

    expect(text).toBe(
      [
        'Host-Zugangsdaten',
        'Session-Kennung: ARS-ABCD-2345',
        'Wiederherstellungscode: AbC_def-1234567890abcdefghijklmnop',
        `Wiederherstellungsseite: ${recoveryUrl}`,
        '',
        `Öffne ${recoveryUrl} in dem Browser.`,
        'Nach einer Wiederherstellung gilt der neu ausgegebene Code.',
        'Diese Zugangsdaten werden gültig nach Aktivierung.',
      ].join('\n'),
    );
    expect(text).not.toContain('**');
    expect(text).not.toContain('{');
  });
});
