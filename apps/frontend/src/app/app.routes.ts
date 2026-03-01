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
  },
  {
    path: 'session/:code',
    loadComponent: () =>
      import('./features/session/session.component').then((m) => m.SessionComponent),
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./features/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'legal/:slug',
    loadComponent: () =>
      import('./features/legal/legal-page.component').then((m) => m.LegalPageComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
