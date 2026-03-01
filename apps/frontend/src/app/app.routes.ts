import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'quiz',
    loadComponent: () =>
      import('./pages/quiz/quiz.component').then((m) => m.QuizComponent),
  },
  {
    path: 'session/:code',
    loadComponent: () =>
      import('./pages/session/session.component').then((m) => m.SessionComponent),
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'legal/:slug',
    loadComponent: () =>
      import('./pages/legal/legal-page.component').then((m) => m.LegalPageComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
