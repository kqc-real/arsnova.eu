import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Service für den Sprachwechsel: Quiz Edit/New/Preview melden ungespeicherte Änderungen.
 * Die Toolbar fragt vor dem Wechsel der Locale-URL ab und zeigt ggf. einen Hinweis-Dialog.
 *
 * Mehrere Komponenten können parallel registriert sein (Edit bleibt unter Preview gemountet).
 */
@Injectable({ providedIn: 'root' })
export class LocaleSwitchGuardService {
  private readonly router = inject(Router);
  private readonly getters = new Set<() => boolean>();

  register(getDirty: () => boolean): void {
    this.getters.add(getDirty);
  }

  unregister(getDirty: () => boolean): void {
    this.getters.delete(getDirty);
  }

  /**
   * true, wenn die aktuelle Route Quiz-Edit, Quiz-New oder Quiz-Preview ist
   * und mindestens ein registrierter Getter ungespeicherte Änderungen meldet.
   */
  hasUnsavedChanges(): boolean {
    if (this.getters.size === 0) return false;
    if (!this.isOnProtectedQuizRoute()) return false;
    for (const getDirty of this.getters) {
      if (getDirty()) return true;
    }
    return false;
  }

  private isOnProtectedQuizRoute(): boolean {
    const url = this.router.url.split('?')[0] ?? '';
    if (url.includes('quiz/new')) return true;
    if (url.includes('/quiz/sync')) return false;
    // /quiz/:id und /quiz/:id/preview (auch mit Locale-Prefix)
    return /\/quiz\/[^/]+/.test(url);
  }
}
