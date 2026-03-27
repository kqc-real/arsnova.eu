import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

/** Löst Neuabfrage von `motd.getHeaderState` in der Toolbar aus (z. B. nach „Archiv gelesen“). */
@Injectable({ providedIn: 'root' })
export class MotdHeaderRefreshService {
  private readonly request$ = new Subject<void>();
  /** Entprellt: mehrere Trigger (z. B. schnell hintereinander) → eine Netzwerkanfrage. */
  readonly requests = this.request$.pipe(debounceTime(120));

  notifyMotdHeaderRefresh(): void {
    this.request$.next();
  }
}
