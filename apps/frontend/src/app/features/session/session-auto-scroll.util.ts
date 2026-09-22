/**
 * Gemeinsame Auto-Scroll-Helfer für Host, Vote und Presenter.
 * Scrollt im App-Shell-Container (`#main-content` / `.app-main`), nicht im Window.
 */

export type SessionScrollBehavior = ScrollBehavior;

export function sessionScrollBehavior(
  matchMedia: typeof globalThis.matchMedia | undefined = globalThis.matchMedia,
): SessionScrollBehavior {
  if (typeof matchMedia !== 'function') return 'auto';
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  } catch {
    return 'auto';
  }
}

export function resolveAppMainScrollRoot(from: ParentNode | null | undefined): HTMLElement | null {
  if (!from || typeof (from as Element).closest !== 'function') {
    if (typeof document === 'undefined') return null;
    return (
      (document.getElementById('main-content') as HTMLElement | null) ??
      (document.querySelector('.app-main') as HTMLElement | null) ??
      ((document.scrollingElement ?? document.documentElement) as HTMLElement | null)
    );
  }
  const el = from as Element;
  return (
    (el.closest('.app-main') as HTMLElement | null) ??
    (el.ownerDocument?.getElementById('main-content') as HTMLElement | null) ??
    ((el.ownerDocument?.scrollingElement ??
      el.ownerDocument?.documentElement ??
      null) as HTMLElement | null)
  );
}

export type ScrollIntoAppMainOptions = {
  behavior?: SessionScrollBehavior;
  /** Extra Abstand unter der fixen Toolbar (px). */
  gapPx?: number;
  block?: 'start' | 'nearest';
};

/**
 * Scrollt `target` so, dass es unter der Toolbar im App-Main sichtbar wird.
 * `nearest`: nur scrollen, wenn das Ziel außerhalb des Viewports liegt.
 */
export function scrollIntoAppMain(
  target: HTMLElement | null | undefined,
  options: ScrollIntoAppMainOptions = {},
): boolean {
  if (!target?.isConnected) return false;
  const scrollRoot = resolveAppMainScrollRoot(target);
  const behavior = options.behavior ?? sessionScrollBehavior();
  const gapPx = options.gapPx ?? 8;
  const block = options.block ?? 'start';

  if (!scrollRoot) {
    try {
      target.scrollIntoView({
        behavior,
        block: block === 'nearest' ? 'nearest' : 'start',
      });
      return true;
    } catch {
      try {
        target.scrollIntoView();
        return true;
      } catch {
        return false;
      }
    }
  }

  const rootRect = scrollRoot.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const toolbarClearancePx = parseFloat(getComputedStyle(scrollRoot).paddingTop) || 0;
  const scrollMarginTop = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const clearancePx = Math.max(toolbarClearancePx, scrollMarginTop);
  const effectiveGapPx = scrollMarginTop > 0 ? 0 : gapPx;
  const visibleTop = rootRect.top + clearancePx + effectiveGapPx;
  const visibleBottom = rootRect.bottom - gapPx;

  if (block === 'nearest') {
    const fullyVisible = targetRect.top >= visibleTop && targetRect.bottom <= visibleBottom;
    if (fullyVisible) return true;
  }

  const y = targetRect.top - rootRect.top + scrollRoot.scrollTop - clearancePx - effectiveGapPx;
  try {
    scrollRoot.scrollTo({ top: Math.max(0, y), behavior });
  } catch {
    scrollRoot.scrollTop = Math.max(0, y);
  }
  return true;
}

export function scrollAppMainToTop(
  from: ParentNode | null | undefined,
  behavior: SessionScrollBehavior = sessionScrollBehavior(),
): boolean {
  const scrollRoot = resolveAppMainScrollRoot(from);
  if (!scrollRoot) return false;
  try {
    scrollRoot.scrollTo({ top: 0, behavior });
  } catch {
    scrollRoot.scrollTop = 0;
  }
  return true;
}

export function ensureElementFocusable(element: HTMLElement): void {
  if (element.tabIndex < 0 && !element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }
}

export function scrollAndFocusInAppMain(
  target: HTMLElement | null | undefined,
  options: ScrollIntoAppMainOptions & { focus?: boolean; preventScrollFocus?: boolean } = {},
): boolean {
  if (!target?.isConnected) return false;
  const scrolled = scrollIntoAppMain(target, options);
  if (options.focus !== false) {
    ensureElementFocusable(target);
    try {
      target.focus({ preventScroll: options.preventScrollFocus !== false });
    } catch {
      /* Fokus optional */
    }
  }
  return scrolled;
}
