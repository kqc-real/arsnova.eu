/**
 * TRPC-Fehlermeldungen kommen vom Server auf Deutsch.
 * Bekannte Texte werden für die aktuelle UI-Locale übersetzt.
 */
const SESSION_NOT_FOUND_DE = 'Session nicht gefunden.';

export function sessionNotFoundUiMessage(): string {
  return $localize`:@@session.notFound:Session nicht gefunden.`;
}

export function localizeKnownServerMessage(message: string): string {
  if (message === SESSION_NOT_FOUND_DE) {
    return sessionNotFoundUiMessage();
  }
  return message;
}
