import { inject } from '@angular/core';
import {
  type CanActivateFn,
  type CanDeactivateFn,
  Router,
  type UrlSegment,
  Routes,
} from '@angular/router';
import {
  getLocaleFromBaseHref,
  getLocaleFromPath,
  getPreferredJoinLocale,
} from './core/locale-from-path';
import { hasFeedbackHostToken, normalizeFeedbackCode } from './core/feedback-host-token';
import {
  clearHostToken,
  getSessionEntryCommands,
  hasHostToken,
  normalizeHostSessionCode,
} from './core/host-session-token';
import { localizeCommands } from './core/locale-router';
import { trpc } from './core/trpc.client';
import type { SessionHostComponent } from './features/session/session-host/session-host.component';
import { newsArchivePageResolver } from './features/news-archive/news-archive-page.resolver';

const canDeactivateHost: CanDeactivateFn<SessionHostComponent> = (component) =>
  component.canDeactivate();

function getCodeParamFromRoute(route: Parameters<CanActivateFn>[0]): string | null {
  return (
    route.paramMap.get('code') ??
    route.parent?.paramMap.get('code') ??
    route.pathFromRoot
      .map((snapshot) => snapshot.paramMap.get('code'))
      .find((value): value is string => typeof value === 'string' && value.length > 0) ??
    null
  );
}

function getLocaleParamFromRoute(route: Parameters<CanActivateFn>[0]): string | null {
  const parentRoute = (() => {
    try {
      return route.parent ?? null;
    } catch {
      return null;
    }
  })();
  const pathFromRoot = (() => {
    try {
      return route.pathFromRoot ?? [route];
    } catch {
      return [route];
    }
  })();

  return (
    route.paramMap.get('locale') ??
    parentRoute?.paramMap.get('locale') ??
    pathFromRoot
      .map((snapshot) => snapshot.paramMap.get('locale'))
      .find((value): value is string => typeof value === 'string' && value.length > 0) ??
    pathFromRoot
      .map((snapshot) => snapshot.params['locale'])
      .find((value): value is string => typeof value === 'string' && value.length > 0) ??
    null
  );
}

const redirectSessionEntry: CanActivateFn = (route) => {
  const codeParam = getCodeParamFromRoute(route);
  if (!codeParam) {
    return inject(Router).createUrlTree(localizeCommands(['']));
  }

  return inject(Router).createUrlTree(localizeCommands(getSessionEntryCommands(codeParam)));
};

const redirectJoinToPreferredLocale: CanActivateFn = (route) => {
  const router = inject(Router);
  const codeParam = getCodeParamFromRoute(route);
  if (!codeParam) {
    return router.createUrlTree(localizeCommands(['']));
  }

  if (getLocaleParamFromRoute(route) || getLocaleFromPath() || getLocaleFromBaseHref()) {
    return true;
  }

  const code = codeParam.trim().toUpperCase();
  const preferredLocale = getPreferredJoinLocale();
  return router.createUrlTree([preferredLocale, 'join', code], {
    queryParams: route.queryParams,
    fragment: route.fragment ?? undefined,
  });
};

const requireHostToken: CanActivateFn = (route) => {
  const router = inject(Router);
  const codeParam = getCodeParamFromRoute(route);
  if (!codeParam) {
    return router.createUrlTree(localizeCommands(['']));
  }

  const code = normalizeHostSessionCode(codeParam);
  if (!hasHostToken(code)) {
    return router.createUrlTree(localizeCommands(['join', code]));
  }

  return trpc.session.getParticipants
    .query({ code })
    .then(() => true)
    .catch((error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
      if (message.startsWith('UNAUTHORIZED:') || message.startsWith('NOT_FOUND:')) {
        clearHostToken(code);
        return router.createUrlTree(localizeCommands(['join', code]));
      }
      return true;
    });
};

const requireFeedbackHostToken: CanActivateFn = (route) => {
  const codeParam = getCodeParamFromRoute(route);
  if (!codeParam) {
    return inject(Router).createUrlTree(localizeCommands(['']));
  }

  const code = normalizeFeedbackCode(codeParam);
  if (hasFeedbackHostToken(code)) {
    return true;
  }

  return inject(Router).createUrlTree(localizeCommands(['feedback', code, 'vote']));
};

const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'it', 'es'];

/** Matcher: nur Pfade wie /de, /en usw. (für Dev mit base href /). */
function localeMatcher(segments: UrlSegment[]) {
  if (segments.length > 0 && SUPPORTED_LOCALES.includes(segments[0].path)) {
    return { consumed: [segments[0]], posParams: { locale: segments[0] } };
  }
  return null;
}

const mainRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'quiz',
    loadComponent: () => import('./features/quiz/quiz.component').then((m) => m.QuizComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/quiz/quiz-list/quiz-list.component').then((m) => m.QuizListComponent),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./features/quiz/quiz-new/quiz-new.component').then((m) => m.QuizNewComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/quiz/quiz-edit/quiz-edit.component').then((m) => m.QuizEditComponent),
        children: [
          {
            path: 'preview',
            loadComponent: () =>
              import('./features/quiz/quiz-preview/quiz-preview.component').then(
                (m) => m.QuizPreviewComponent,
              ),
          },
        ],
      },
      {
        path: 'sync/:docId',
        loadComponent: () =>
          import('./features/quiz/quiz-sync/quiz-sync.component').then((m) => m.QuizSyncComponent),
      },
    ],
  },
  {
    path: 'session/:code',
    pathMatch: 'full',
    canActivate: [redirectSessionEntry],
    loadComponent: () =>
      import('./features/session/session.component').then((m) => m.SessionComponent),
  },
  {
    path: 'session/:code',
    loadComponent: () =>
      import('./features/session/session.component').then((m) => m.SessionComponent),
    children: [
      { path: '', redirectTo: 'host', pathMatch: 'full' },
      {
        path: 'host',
        loadComponent: () =>
          import('./features/session/session-host/session-host.component').then(
            (m) => m.SessionHostComponent,
          ),
        canActivate: [requireHostToken],
        canDeactivate: [canDeactivateHost],
      },
      {
        path: 'present',
        loadComponent: () =>
          import('./features/session/session-present/session-present.component').then(
            (m) => m.SessionPresentComponent,
          ),
        canActivate: [requireHostToken],
      },
      {
        path: 'vote',
        loadComponent: () =>
          import('./features/session/session-vote/session-vote.component').then(
            (m) => m.SessionVoteComponent,
          ),
      },
    ],
  },
  {
    path: 'feedback/:code',
    canActivate: [requireFeedbackHostToken],
    loadComponent: () =>
      import('./features/feedback/feedback-host.component').then((m) => m.FeedbackHostComponent),
  },
  {
    path: 'feedback/:code/vote',
    loadComponent: () =>
      import('./features/feedback/feedback-vote.component').then((m) => m.FeedbackVoteComponent),
  },
  {
    path: 'join/:code',
    canActivate: [redirectJoinToPreferredLocale],
    loadComponent: () => import('./features/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'help',
    loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'news-archive',
    loadComponent: () =>
      import('./features/news-archive/news-archive-page.component').then(
        (m) => m.NewsArchivePageComponent,
      ),
    resolve: { newsArchive: newsArchivePageResolver },
  },
  {
    path: 'legal',
    children: [
      {
        path: 'imprint',
        loadComponent: () =>
          import('./features/legal/legal-page.component').then((m) => m.LegalPageComponent),
        data: { slug: 'imprint' },
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./features/legal/legal-page.component').then((m) => m.LegalPageComponent),
        data: { slug: 'privacy' },
      },
      { path: '', redirectTo: 'imprint', pathMatch: 'full' },
    ],
  },
];

/** Dev (base /): /de, /en usw. nutzen dieselben Routen. Production (base /de/): nur '' bis **. */
export const routes: Routes = [
  ...mainRoutes,
  { matcher: localeMatcher, children: mainRoutes },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
