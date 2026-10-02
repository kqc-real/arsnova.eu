import { describe, expect, it } from 'vitest';
import { localizeMotdArchiveError } from './motd-archive-error';

describe('localizeMotdArchiveError', () => {
  const fallback = 'Das News-Archiv konnte nicht geladen werden. Bitte versuche es später erneut.';

  it('verbirgt technische Transportfehler hinter dem lokalisierten Fallback', () => {
    expect(localizeMotdArchiveError(new Error('fetch failed'), fallback)).toBe(fallback);
    expect(
      localizeMotdArchiveError(
        new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`),
        fallback,
      ),
    ).toBe(fallback);
  });

  it('behält strukturierte Serverfehler und Retry-Hinweise bei', () => {
    expect(
      localizeMotdArchiveError(
        {
          message:
            'TOO_MANY_REQUESTS: Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
          data: { retryAfterSeconds: 9 },
        },
        fallback,
      ),
    ).toBe(
      'Zu viele Sessions wurden erstellt. Bitte versuche es später erneut.\n' +
        'Versuche es bitte in 9 Sekunden erneut.',
    );
  });
});
