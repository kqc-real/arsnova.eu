import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import {
  clearHostToken,
  hasHostToken,
  normalizeHostSessionCode,
} from '../../core/host-session-token';
import { localizeCommands } from '../../core/locale-router';
import { trpc } from '../../core/trpc.client';
import { readSessionCodeFromSnapshot } from './session-route-code';

/**
 * UX-Guard für Host-Routen. Autorisierung bleibt serverseitig (`hostProcedure`).
 * IndexedDB gehört nicht hierher, damit dieser Guard das Hauptbündel nicht aufbläht.
 */
export const requireHostToken: CanActivateFn = (route) => {
  const router = inject(Router);
  const codeParam = readSessionCodeFromSnapshot(route);
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
