import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, LOCALE_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import type {
  ProductFeedbackActiveChannel,
  ProductFeedbackInAppArea,
  ProductFeedbackInAppContext,
  ProductFeedbackInAppSubmitOutput,
  ProductFeedbackRole,
  ProductFeedbackRouteGroup,
  ProductFeedbackSessionPhase,
} from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import {
  detectProductFeedbackDeviceClass,
  flushProductFeedbackOutbox,
} from './product-feedback-storage';

export type ProductFeedbackLaunchContext = {
  role?: ProductFeedbackRole;
  suggestedArea?: ProductFeedbackInAppArea;
  routeGroup?: ProductFeedbackRouteGroup;
  sessionPhase?: ProductFeedbackSessionPhase;
  activeChannel?: ProductFeedbackActiveChannel;
  errorRequestId?: string;
  sessionRunning?: boolean;
};

export type ProductFeedbackInAppDraft = {
  idempotencyKey: string;
  role: ProductFeedbackRole;
  kind: 'NOT_WORKING' | 'UNCLEAR' | 'MISSING_FEATURE' | 'PRAISE';
  area: ProductFeedbackInAppArea;
  context: ProductFeedbackInAppContext;
};

export function resolveProductFeedbackRouteGroup(url: string): ProductFeedbackRouteGroup {
  const path = url.split(/[?#]/)[0].replace(/^\/(?:de|en|fr|it|es)(?=\/|$)/, '') || '/';
  if (path === '/') return 'HOME';
  if (path.startsWith('/help')) return 'HELP';
  if (/^\/quiz\/[^/]+\/edit/.test(path) || path.startsWith('/quiz/new')) return 'QUIZ_EDITOR';
  if (path.startsWith('/quiz')) return 'QUIZ_LIBRARY';
  if (/^\/session\/[^/]+\/host/.test(path)) return 'SESSION_HOST';
  if (/^\/session\/[^/]+\/vote/.test(path)) return 'SESSION_VOTE';
  if (/^\/session\/[^/]+\/results/.test(path)) return 'SESSION_RESULTS';
  if (path.startsWith('/join')) return 'SESSION_JOIN';
  if (path.startsWith('/feedback')) return 'QUICK_FEEDBACK';
  return 'OTHER';
}

export function resolveProductFeedbackRole(
  routeGroup: ProductFeedbackRouteGroup,
): ProductFeedbackRole {
  if (routeGroup === 'SESSION_HOST' || routeGroup === 'QUIZ_EDITOR') return 'HOST';
  if (
    routeGroup === 'SESSION_JOIN' ||
    routeGroup === 'SESSION_VOTE' ||
    routeGroup === 'SESSION_RESULTS'
  ) {
    return 'PARTICIPANT';
  }
  return 'GENERAL';
}

@Injectable({ providedIn: 'root' })
export class ProductFeedbackLauncherService {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly localeId = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);

  async open(
    launchContext: ProductFeedbackLaunchContext = {},
    focusReturn?: HTMLElement | null,
  ): Promise<void> {
    const [{ MatDialog }, { ProductFeedbackInAppDialogComponent }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./product-feedback-in-app-dialog.component'),
    ]);
    const data = this.resolveLaunchContext(launchContext);
    const ref = this.injector.get(MatDialog).open(ProductFeedbackInAppDialogComponent, {
      data,
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'product-feedback-in-app-dialog-panel',
      width: 'min(42rem, calc(100vw - 1rem))',
      maxWidth: '100vw',
      maxHeight: 'calc(100dvh - 1rem)',
    });
    ref.afterClosed().subscribe(() => this.restoreFocus(focusReturn));
  }

  resolveLaunchContext(
    provided: ProductFeedbackLaunchContext = {},
  ): Required<Omit<ProductFeedbackLaunchContext, 'errorRequestId' | 'suggestedArea'>> &
    Pick<ProductFeedbackLaunchContext, 'errorRequestId' | 'suggestedArea'> {
    const routeGroup = provided.routeGroup ?? resolveProductFeedbackRouteGroup(this.router.url);
    const role = provided.role ?? resolveProductFeedbackRole(routeGroup);
    return {
      role,
      routeGroup,
      sessionPhase: provided.sessionPhase ?? 'NONE',
      activeChannel: provided.activeChannel ?? 'NONE',
      sessionRunning: provided.sessionRunning ?? this.isLiveRouteGroup(routeGroup),
      suggestedArea: provided.suggestedArea,
      errorRequestId: provided.errorRequestId,
    };
  }

  buildContext(
    launch: ReturnType<ProductFeedbackLauncherService['resolveLaunchContext']>,
  ): ProductFeedbackInAppContext {
    const { browserFamily, browserMajorVersion } = this.detectBrowser();
    return {
      locale: this.resolveLocale(),
      appVersion: '0.1.0',
      routeGroup: launch.routeGroup,
      sessionPhase: launch.sessionPhase,
      activeChannel: launch.activeChannel,
      deviceClass: detectProductFeedbackDeviceClass(),
      browserFamily,
      ...(browserMajorVersion ? { browserMajorVersion } : {}),
      osFamily: this.detectOsFamily(),
      onlineState: typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE',
      ...(launch.errorRequestId ? { errorRequestId: launch.errorRequestId } : {}),
    };
  }

  async submitDraft(draft: ProductFeedbackInAppDraft): Promise<ProductFeedbackInAppSubmitOutput> {
    const challenge = await trpc.productFeedback.getInAppChallenge.mutate({
      idempotencyKey: draft.idempotencyKey,
    });
    return trpc.productFeedback.submitInApp.mutate({
      ...draft,
      challengeToken: challenge.challengeToken,
    });
  }

  async flushOutbox(): Promise<void> {
    await flushProductFeedbackOutbox({
      submit: (payload) => trpc.productFeedback.submit.mutate(payload as never),
      followUp: (payload) => trpc.productFeedback.followUp.mutate(payload as never),
      inAppSubmit: (payload) => this.submitDraft(payload as ProductFeedbackInAppDraft),
      inAppFollowUp: (payload) => trpc.productFeedback.followUpInApp.mutate(payload as never),
    });
  }

  private isLiveRouteGroup(routeGroup: ProductFeedbackRouteGroup): boolean {
    return (
      routeGroup === 'SESSION_HOST' ||
      routeGroup === 'SESSION_VOTE' ||
      routeGroup === 'SESSION_RESULTS' ||
      routeGroup === 'QA' ||
      routeGroup === 'QUICK_FEEDBACK'
    );
  }

  private resolveLocale(): 'de' | 'en' | 'fr' | 'es' | 'it' {
    const locale = String(this.localeId).toLowerCase().slice(0, 2);
    return locale === 'en' || locale === 'fr' || locale === 'es' || locale === 'it' ? locale : 'de';
  }

  private detectBrowser(): {
    browserFamily: ProductFeedbackInAppContext['browserFamily'];
    browserMajorVersion?: number;
  } {
    const ua = this.document.defaultView?.navigator.userAgent ?? '';
    const candidates: Array<[ProductFeedbackInAppContext['browserFamily'], RegExp]> = [
      ['EDGE', /Edg\/(\d+)/],
      ['CHROME', /(?:Chrome|CriOS)\/(\d+)/],
      ['FIREFOX', /(?:Firefox|FxiOS)\/(\d+)/],
      ['SAFARI', /Version\/(\d+).+Safari/],
    ];
    for (const [browserFamily, pattern] of candidates) {
      const match = ua.match(pattern);
      if (match?.[1]) return { browserFamily, browserMajorVersion: Number(match[1]) };
    }
    return { browserFamily: ua ? 'OTHER' : 'UNKNOWN' };
  }

  private detectOsFamily(): ProductFeedbackInAppContext['osFamily'] {
    const ua = this.document.defaultView?.navigator.userAgent ?? '';
    if (/Android/i.test(ua)) return 'ANDROID';
    if (/CrOS/i.test(ua)) return 'CHROMEOS';
    if (/(iPhone|iPad|iPod)/i.test(ua)) return 'IOS';
    if (/Windows/i.test(ua)) return 'WINDOWS';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'MACOS';
    if (/Linux/i.test(ua)) return 'LINUX';
    return ua ? 'OTHER' : 'UNKNOWN';
  }

  private restoreFocus(target?: HTMLElement | null): void {
    if (!target?.isConnected || target.closest('[inert]')) return;
    const style = getComputedStyle(target);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    target.focus({ preventScroll: true });
  }
}
