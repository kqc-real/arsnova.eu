import { Injectable, inject } from '@angular/core';
import {
  ProductFeedbackLauncherService,
  type ProductFeedbackLaunchContext,
} from './product-feedback-launcher.service';

const COOLDOWN_PREFIX = 'productFeedback:contextOffer:v1:';
const CONTEXT_OFFER_COOLDOWN_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class ContextualFeedbackOfferService {
  private readonly launcher = inject(ProductFeedbackLauncherService);

  isAvailable(eventKey: string): boolean {
    if (typeof localStorage === 'undefined') return true;
    const last = Number(localStorage.getItem(this.storageKey(eventKey)));
    return !Number.isFinite(last) || Date.now() - last >= CONTEXT_OFFER_COOLDOWN_MS;
  }

  open(
    eventKey: string,
    context: ProductFeedbackLaunchContext,
    focusReturn?: HTMLElement | null,
  ): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey(eventKey), String(Date.now()));
    }
    void this.launcher.open(
      {
        ...context,
        errorRequestId: this.safeEventId(eventKey),
      },
      focusReturn,
    );
  }

  private storageKey(eventKey: string): string {
    return `${COOLDOWN_PREFIX}${this.safeEventId(eventKey)}`;
  }

  private safeEventId(eventKey: string): string {
    const normalized = eventKey.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 128);
    return normalized || 'unknown';
  }
}
