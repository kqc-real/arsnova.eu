import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import {
  inject,
  LOCALE_ID,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
  type StateKey,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { ResolveFn } from '@angular/router';
import type { AppLocale } from '@arsnova/shared-types';
import {
  fromNewsArchiveTransferState,
  loadNewsArchivePageModel,
  toNewsArchiveTransferState,
  type NewsArchiveInitialModel,
  type NewsArchiveTransferState,
} from './news-archive-initial';

function appLocaleFromInjectedId(localeId: string): AppLocale {
  if (
    localeId === 'de' ||
    localeId === 'en' ||
    localeId === 'fr' ||
    localeId === 'it' ||
    localeId === 'es'
  ) {
    return localeId;
  }
  return 'de';
}

export function newsArchiveTransferStateKey(locale: AppLocale): StateKey<NewsArchiveTransferState> {
  return makeStateKey<NewsArchiveTransferState>(`news-archive-page:${locale}`);
}

export const newsArchivePageResolver: ResolveFn<NewsArchiveInitialModel> = async () => {
  const locale = appLocaleFromInjectedId(inject(LOCALE_ID));
  const sanitizer = inject(DomSanitizer);
  const platformId = inject(PLATFORM_ID);
  const transferState = inject(TransferState);
  const stateKey = newsArchiveTransferStateKey(locale);
  const fallbackTitle = $localize`:@@motd.archiveItemFallbackTitle:Archiv-Meldung`;
  const loadError = $localize`:@@motd.archiveLoadError:Archiv konnte nicht geladen werden.`;

  if (isPlatformBrowser(platformId) && transferState.hasKey(stateKey)) {
    const transferred = transferState.get(stateKey, {
      items: [],
      nextCursor: null,
      archiveMaxEndsAtIso: null,
      archiveUnreadCount: 0,
      errorMessage: null,
    });
    transferState.remove(stateKey);
    return fromNewsArchiveTransferState(transferred, sanitizer, fallbackTitle);
  }

  const model = await loadNewsArchivePageModel(locale, sanitizer, fallbackTitle, loadError);
  if (isPlatformServer(platformId)) {
    transferState.set(stateKey, toNewsArchiveTransferState(model));
  }
  return model;
};
