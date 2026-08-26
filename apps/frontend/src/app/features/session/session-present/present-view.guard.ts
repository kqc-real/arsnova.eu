import { inject, Injector, runInInjectionContext } from '@angular/core';
import { type CanActivateFn, type GuardResult } from '@angular/router';
import {
  hasHostToken,
  normalizeHostSessionCode,
  setHostToken,
} from '../../../core/host-session-token';
import { requireHostToken } from '../session-host.guard';
import { readSessionCodeFromSnapshot } from '../session-route-code';
import { SessionTokenStorageService } from './session-token-storage.service';

/**
 * Present-Guard im lazy Present-Chunk: Tab-Token zuerst, sonst IndexedDB-Restore.
 * Es gibt keinen AuthService; Restore schreibt über `setHostToken` in sessionStorage.
 * Autorisierung bleibt serverseitig (`hostProcedure` / `requireHostToken`).
 *
 * `requireHostToken` liefert hier nie ein Observable — nur Sync- oder Promise-Ergebnisse.
 * Deshalb auf `GuardResult | Promise<GuardResult>` eingrenzen, bevor wir awaiten.
 * Nach dem IndexedDB-await muss `requireHostToken` erneut im Injection-Context laufen.
 */
export const presentViewGuard: CanActivateFn = (route, state) => {
  const tokenStorage = inject(SessionTokenStorageService);
  const injector = inject(Injector);
  const codeParam = readSessionCodeFromSnapshot(route);
  const code = codeParam ? normalizeHostSessionCode(codeParam) : '';

  return (async (): Promise<GuardResult> => {
    let restoredFromIndexedDb = false;
    if (code && !hasHostToken(code)) {
      try {
        const savedToken = await tokenStorage.getHostToken(code);
        if (savedToken) {
          setHostToken(code, savedToken);
          restoredFromIndexedDb = true;
        }
      } catch {
        // IndexedDB fehlt oder ist gesperrt: requireHostToken leitet auf Join um.
      }
    }

    const result = await Promise.resolve(
      runInInjectionContext(
        injector,
        () => requireHostToken(route, state) as GuardResult | Promise<GuardResult>,
      ),
    );
    if (code && (result !== true || restoredFromIndexedDb)) {
      // Fehlschlag: aufräumen. Erfolg nach IDB-Restore: Einmal-Handoff konsumieren.
      await tokenStorage.clearHostToken(code);
    }
    return result;
  })();
};
