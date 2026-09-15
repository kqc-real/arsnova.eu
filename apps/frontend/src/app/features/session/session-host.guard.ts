import { inject } from '@angular/core';
import { type ActivatedRouteSnapshot, type CanActivateFn, Router } from '@angular/router';
import {
  clearHostToken,
  hasHostToken,
  normalizeHostSessionCode,
  setHostToken,
} from '../../core/host-session-token';
import {
  clearHostBrowserCapability,
  clearRecoveryExchangeId,
  getHostBrowserCapability,
  getOrCreateRecoveryExchangeId,
  getStagedHostRecoveryCard,
  persistInitialHostRecovery,
} from '../../core/host-recovery-access';
import { localizeCommands } from '../../core/locale-router';
import { trpc } from '../../core/trpc.client';
import { readSessionCodeFromSnapshot } from './session-route-code';

/**
 * UX-Guard für Host-Routen. Autorisierung bleibt serverseitig (`hostProcedure`).
 * IndexedDB gehört nicht hierher, damit dieser Guard das Hauptbündel nicht aufbläht.
 */
export async function resolveHostRouteAccess(route: ActivatedRouteSnapshot, router: Router) {
  const codeParam = readSessionCodeFromSnapshot(route);
  if (!codeParam) {
    return router.createUrlTree(localizeCommands(['']));
  }

  const code = normalizeHostSessionCode(codeParam);
  const browserCapability = getHostBrowserCapability(code);
  if (!hasHostToken(code) && browserCapability) {
    try {
      const stagedCard = getStagedHostRecoveryCard(code);
      const issued = stagedCard
        ? await trpc.session.activateHostCredential.mutate({
            supportId: stagedCard.supportId,
            browserCapability,
          })
        : await trpc.session.issueHostAccessToken.mutate({
            code,
            browserCapability,
          });
      setHostToken(code, issued.hostToken);
      if (stagedCard) clearRecoveryExchangeId(stagedCard.supportId);
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
      if (message.includes('UNAUTHORIZED')) {
        clearHostBrowserCapability(code);
      }
    }
  }
  if (!hasHostToken(code)) {
    return router.createUrlTree(localizeCommands(['host-recovery']));
  }

  try {
    await trpc.session.getParticipantSummary.query({ code });
    if (!browserCapability) {
      try {
        const prepared = await trpc.session.prepareHostCredentialBootstrap.mutate({
          code,
          recoveryExchangeId: getOrCreateRecoveryExchangeId(code),
        });
        persistInitialHostRecovery({
          code: prepared.code,
          browserCapability: prepared.browserCapability,
          recoveryCard: prepared.recoveryCard,
        });
        const activated = await trpc.session.activateHostCredential.mutate({
          supportId: prepared.recoveryCard.supportId,
          browserCapability: prepared.browserCapability,
        });
        setHostToken(code, activated.hostToken);
        clearRecoveryExchangeId(code);
      } catch {
        // Legacy-Migration bleibt wiederholbar; der noch gültige Host-Token funktioniert weiter.
      }
    }
    return true;
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (
      (message.startsWith('UNAUTHORIZED:') || message.startsWith('NOT_FOUND:')) &&
      browserCapability
    ) {
      try {
        const issued = await trpc.session.issueHostAccessToken.mutate({
          code,
          browserCapability,
        });
        setHostToken(code, issued.hostToken);
        await trpc.session.getParticipantSummary.query({ code });
        return true;
      } catch {
        clearHostToken(code);
      }
    }
    if (message.startsWith('UNAUTHORIZED:') || message.startsWith('NOT_FOUND:')) {
      clearHostToken(code);
      return router.createUrlTree(localizeCommands(['host-recovery']));
    }
    return true;
  }
}

export const requireHostToken: CanActivateFn = (route) =>
  resolveHostRouteAccess(route, inject(Router));
