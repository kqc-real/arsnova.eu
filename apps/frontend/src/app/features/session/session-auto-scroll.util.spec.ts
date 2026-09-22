import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveAppMainScrollRoot,
  scrollAppMainToTop,
  scrollIntoAppMain,
  sessionScrollBehavior,
} from './session-auto-scroll.util';

describe('session-auto-scroll.util', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('wählt smooth außer bei prefers-reduced-motion', () => {
    expect(sessionScrollBehavior(() => ({ matches: false }) as MediaQueryList)).toBe('smooth');
    expect(sessionScrollBehavior(() => ({ matches: true }) as MediaQueryList)).toBe('auto');
  });

  it('findet .app-main als Scroll-Root', () => {
    const main = document.createElement('main');
    main.className = 'app-main';
    const child = document.createElement('div');
    main.append(child);
    document.body.append(main);
    expect(resolveAppMainScrollRoot(child)).toBe(main);
  });

  it('scrollt Ziel unter Toolbar-Padding in app-main', () => {
    const main = document.createElement('main');
    main.className = 'app-main';
    Object.defineProperty(main, 'scrollTop', { value: 200, writable: true, configurable: true });
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 800,
      left: 0,
      right: 400,
      width: 400,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      paddingTop: '64px',
    } as CSSStyleDeclaration);

    const target = document.createElement('div');
    main.append(target);
    document.body.append(main);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 300,
      bottom: 360,
      left: 0,
      right: 400,
      width: 400,
      height: 60,
      x: 0,
      y: 300,
      toJSON: () => ({}),
    });

    expect(scrollIntoAppMain(target, { behavior: 'auto', gapPx: 8 })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 428, behavior: 'auto' });
  });

  it('berücksichtigt scroll-margin-top am Ziel', () => {
    const main = document.createElement('main');
    main.className = 'app-main';
    Object.defineProperty(main, 'scrollTop', { value: 180, writable: true, configurable: true });
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 800,
      left: 0,
      right: 400,
      width: 400,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const target = document.createElement('div');
    main.append(target);
    document.body.append(main);
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((el) => {
      if (el === target) {
        return { paddingTop: '0px', scrollMarginTop: '80px' } as CSSStyleDeclaration;
      }
      return { paddingTop: '0px', scrollMarginTop: '0px' } as CSSStyleDeclaration;
    });
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 420,
      bottom: 480,
      left: 0,
      right: 400,
      width: 400,
      height: 60,
      x: 0,
      y: 420,
      toJSON: () => ({}),
    });

    expect(scrollIntoAppMain(target, { behavior: 'smooth' })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 520, behavior: 'smooth' });
  });

  it('nearest überspringt Scroll wenn Ziel sichtbar', () => {
    const main = document.createElement('main');
    main.className = 'app-main';
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 800,
      left: 0,
      right: 400,
      width: 400,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      paddingTop: '0px',
    } as CSSStyleDeclaration);

    const target = document.createElement('div');
    main.append(target);
    document.body.append(main);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 160,
      left: 0,
      right: 400,
      width: 400,
      height: 60,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    expect(scrollIntoAppMain(target, { behavior: 'auto', block: 'nearest' })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrollAppMainToTop setzt scrollTop auf 0', () => {
    const main = document.createElement('main');
    main.className = 'app-main';
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    const child = document.createElement('div');
    main.append(child);
    document.body.append(main);

    expect(scrollAppMainToTop(child, 'auto')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
