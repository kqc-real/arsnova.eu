import { describe, expect, it } from 'vitest';
import { clearTranslations, loadTranslations } from '@angular/localize';
import {
  localizeKnownServerError,
  localizeKnownServerMessage,
} from './localize-known-server-message';

describe('localizeKnownServerError', () => {
  it('lokalisiert die bekannte Session-Create-Drosselung auch mit tRPC-Präfix', () => {
    loadTranslations({
      'errors.sessionCreateRateLimit':
        'Too many session creation attempts. Please try again later.',
    });
    try {
      expect(
        localizeKnownServerMessage(
          'TOO_MANY_REQUESTS: Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
        ),
      ).toBe('Too many session creation attempts. Please try again later.');
    } finally {
      clearTranslations();
    }
  });

  it('verwendet retryAfterSeconds aus dem expliziten tRPC-Datenfeld', () => {
    const error = {
      message: 'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
      data: {
        code: 'TOO_MANY_REQUESTS',
        retryAfterSeconds: 13,
      },
    };

    expect(localizeKnownServerError(error, 'Session konnte nicht gestartet werden.')).toBe(
      'WICHTIG: Zu viele Session-Erstellungen. Bitte später erneut versuchen.\n' +
        'Bitte in 13 Sekunden erneut versuchen.',
    );
  });

  it('unterstützt die tRPC-Shape und ignoriert nicht freigegebene Cause-Daten', () => {
    const error = {
      message: 'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
      cause: { retryAfterSeconds: 99 },
      shape: {
        data: {
          retryAfterSeconds: 7,
        },
      },
    };

    expect(localizeKnownServerError(error, 'Session konnte nicht gestartet werden.')).toContain(
      'Bitte in 7 Sekunden erneut versuchen.',
    );
  });

  it('zeigt ohne validiertes Datenfeld nur die generische Fehlermeldung', () => {
    const error = {
      message: 'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
      cause: { retryAfterSeconds: 99 },
    };

    expect(localizeKnownServerError(error, 'Session konnte nicht gestartet werden.')).toBe(
      'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
    );
  });
});
