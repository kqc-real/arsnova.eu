import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'quiz',
    loadComponent: () =>
      import('./features/quiz/quiz.component').then((m) => m.QuizComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/quiz/quiz-list/quiz-list.component').then(
            (m) => m.QuizListComponent
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./features/quiz/quiz-new/quiz-new.component').then(
            (m) => m.QuizNewComponent
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/quiz/quiz-edit/quiz-edit.component').then(
            (m) => m.QuizEditComponent
          ),
        children: [
          {
            path: 'preview',
            loadComponent: () =>
              import('./features/quiz/quiz-preview/quiz-preview.component').then(
                (m) => m.QuizPreviewComponent
              ),
          },
        ],
      },
      {
        path: 'sync/:docId',
        loadComponent: () =>
          import('./features/quiz/quiz-sync/quiz-sync.component').then(
            (m) => m.QuizSyncComponent
          ),
      },
    ],
  },
  {
    path: 'session/:code',
    loadComponent: () =>
      import('./features/session/session.component').then(
        (m) => m.SessionComponent
      ),
    children: [
      { path: '', redirectTo: 'host', pathMatch: 'full' },
      {
        path: 'host',
        loadComponent: () =>
          import('./features/session/session-host/session-host.component').then(
            (m) => m.SessionHostComponent
          ),
      },
      {
        path: 'present',
        loadComponent: () =>
          import(
            './features/session/session-present/session-present.component'
          ).then((m) => m.SessionPresentComponent),
      },
      {
        path: 'vote',
        loadComponent: () =>
          import('./features/session/session-vote/session-vote.component').then(
            (m) => m.SessionVoteComponent
          ),
      },
    ],
  },
  {
    path: 'feedback/:code',
    loadComponent: () =>
      import('./features/feedback/feedback-host.component').then(
        (m) => m.FeedbackHostComponent
      ),
  },
  {
    path: 'feedback/:code/vote',
    loadComponent: () =>
      import('./features/feedback/feedback-vote.component').then(
        (m) => m.FeedbackVoteComponent
      ),
  },
  {
    path: 'join/:code',
    loadComponent: () =>
      import('./features/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./features/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'legal',
    children: [
      {
        path: 'imprint',
        loadComponent: () =>
          import(
            './features/legal/legal-page.component'
          ).then((m) => m.LegalPageComponent),
        data: { slug: 'imprint' },
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import(
            './features/legal/legal-page.component'
          ).then((m) => m.LegalPageComponent),
        data: { slug: 'privacy' },
      },
      { path: '', redirectTo: 'imprint', pathMatch: 'full' },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
