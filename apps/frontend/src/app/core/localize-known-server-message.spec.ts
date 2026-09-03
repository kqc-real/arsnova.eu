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

  it('lokalisiert Admin-Login-Drosselungen mit expliziter Wartezeit', () => {
    loadTranslations({
      'errors.adminLoginRateLimit': 'Too many admin login attempts. Please try again later.',
      'errors.rateLimitRetryAfter': 'Please try again in {$seconds} seconds.',
    });
    try {
      expect(
        localizeKnownServerError(
          {
            message:
              'TOO_MANY_REQUESTS: Zu viele Admin-Login-Versuche. Bitte später erneut versuchen.',
            data: { retryAfterSeconds: 17 },
          },
          'Login failed.',
        ),
      ).toBe(
        'Too many admin login attempts. Please try again later.\n' +
          'Please try again in 17 seconds.',
      );
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
      'Zu viele Session-Erstellungen. Bitte später erneut versuchen.\n' +
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

  it('lokalisiert den Session-Code-429 (zu viele Fehlversuche) und hängt retryAfterSeconds-Hinweis an', () => {
    loadTranslations({
      'errors.sessionCodeTooManyFailures': 'Zu viele falsche Codes – kurz warten.',
      'errors.rateLimitRetryAfter': 'Please try again in {$seconds} seconds.',
    });

    try {
      expect(
        localizeKnownServerError(
          {
            message:
              'TOO_MANY_REQUESTS: Ungültiger Code. Zu viele Fehlversuche – bitte warten Sie vor dem nächsten Versuch.',
            data: { retryAfterSeconds: 13 },
          },
          'Beitritt fehlgeschlagen.',
        ),
      ).toBe('Zu viele falsche Codes – kurz warten.\n' + 'Please try again in 13 seconds.');
    } finally {
      clearTranslations();
    }
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
