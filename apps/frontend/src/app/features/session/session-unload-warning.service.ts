import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, isDevMode } from '@angular/core';
import type { SessionInfoDTO } from '@arsnova/shared-types';
import { normalizeHostSessionCode } from '../../core/host-session-token';

/** Holds the unload warning across navigation between the two live views. */
@Injectable()
export class SessionUnloadWarningService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly enabled =
    !isDevMode() || !['localhost', '127.0.0.1'].includes(this.document.location?.hostname ?? '');
  private guardedCode: string | null = null;

  private readonly warn = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    event.returnValue = '';
  };

  sync(code: string, status: SessionInfoDTO['status'] | null, participantCount = 0): void {
    if (!this.enabled) return;
    const normalizedCode = normalizeHostSessionCode(code);
    if (normalizedCode.length !== 6) return;
    if (status && status !== 'FINISHED' && (status !== 'LOBBY' || participantCount > 0)) {
      if (!this.guardedCode) this.document.defaultView?.addEventListener('beforeunload', this.warn);
      this.guardedCode = normalizedCode;
    } else if (this.guardedCode === normalizedCode) {
      this.clear();
    }
  }

  keepOnly(code: string | null): void {
    if (code === null || this.guardedCode !== normalizeHostSessionCode(code)) this.clear();
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private clear(): void {
    if (!this.guardedCode) return;
    this.document.defaultView?.removeEventListener('beforeunload', this.warn);
    this.guardedCode = null;
  }
}
