import { describe, expect, it, vi } from 'vitest';
import { scrollElementIntoAppShell } from './focus-invalid-field.util';

describe('scrollElementIntoAppShell', () => {
  it('zieht bei start-Ausrichtung die Toolbar-Clearance der App-Shell ab', () => {
    const scrollRoot = document.createElement('main');
    scrollRoot.className = 'app-main';
    scrollRoot.style.paddingTop = '80px';
    Object.defineProperty(scrollRoot, 'clientHeight', { value: 700, configurable: true });
    Object.defineProperty(scrollRoot, 'scrollTop', { value: 200, configurable: true });
    scrollRoot.getBoundingClientRect = () => ({ top: 100, height: 700 }) as DOMRect;
    const scrollTo = vi.fn();
    Object.defineProperty(scrollRoot, 'scrollTo', { value: scrollTo, configurable: true });

    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ top: 420, height: 80 }) as DOMRect;
    scrollRoot.appendChild(element);
    document.body.appendChild(scrollRoot);

    expect(scrollElementIntoAppShell(element, 'start')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 432, behavior: 'smooth' });
  });

  it('zentriert innerhalb der sichtbaren Flaeche unterhalb der Toolbar', () => {
    const scrollRoot = document.createElement('main');
    scrollRoot.className = 'app-main';
    scrollRoot.style.paddingTop = '80px';
    Object.defineProperty(scrollRoot, 'clientHeight', { value: 700, configurable: true });
    Object.defineProperty(scrollRoot, 'scrollTop', { value: 200, configurable: true });
    scrollRoot.getBoundingClientRect = () => ({ top: 100, height: 700 }) as DOMRect;
    const scrollTo = vi.fn();
    Object.defineProperty(scrollRoot, 'scrollTo', { value: scrollTo, configurable: true });

    const element = document.createElement('input');
    element.getBoundingClientRect = () => ({ top: 420, height: 80 }) as DOMRect;
    scrollRoot.appendChild(element);
    document.body.appendChild(scrollRoot);

    expect(scrollElementIntoAppShell(element, 'center')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 170, behavior: 'smooth' });
  });
});
