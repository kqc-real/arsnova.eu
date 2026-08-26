import { Routes } from '@angular/router';
import { presentViewGuard } from './present-view.guard';

/**
 * Present-Routen inkl. Guard und IndexedDB-Handoff. Nur via `loadChildren` laden,
 * damit der Code nicht im Hauptbündel landet.
 */
export const PRESENT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [presentViewGuard],
    loadComponent: () =>
      import('./session-present.component').then((m) => m.SessionPresentComponent),
  },
];
