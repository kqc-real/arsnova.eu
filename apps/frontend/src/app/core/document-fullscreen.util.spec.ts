import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  shouldSkipAutoDocumentFullscreen,
  tryAutoRequestDocumentFullscreen,
} from './document-fullscreen.util';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SAMSUNG_ANDROID =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:123.0) Gecko/123.0 Firefox/123.0';

describe('shouldSkipAutoDocumentFullscreen', () => {
  it('überspringt Chrome und Samsung Internet auf Android', () => {
    expect(shouldSkipAutoDocumentFullscreen(CHROME_ANDROID)).toBe(true);
    expect(shouldSkipAutoDocumentFullscreen(SAMSUNG_ANDROID)).toBe(true);
  });

  it('lässt Desktop-Chrome und Firefox auf Android zu', () => {
    expect(shouldSkipAutoDocumentFullscreen(DESKTOP_CHROME)).toBe(false);
    expect(shouldSkipAutoDocumentFullscreen(FIREFOX_ANDROID)).toBe(false);
  });
});

describe('tryAutoRequestDocumentFullscreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fordert auf Android-Chrome kein Dokument-Vollbild an', () => {
    vi.stubGlobal('navigator', { userAgent: CHROME_ANDROID });
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const onSettled = vi.fn();
    const doc = {
      fullscreenEnabled: true,
      fullscreenElement: null,
      documentElement: { requestFullscreen },
    } as unknown as Document;

    tryAutoRequestDocumentFullscreen(doc, onSettled);

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('fordert auf Desktop-Chrome weiterhin Vollbild an', () => {
    vi.stubGlobal('navigator', { userAgent: DESKTOP_CHROME });
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const doc = {
      fullscreenEnabled: true,
      fullscreenElement: null,
      documentElement: { requestFullscreen },
    } as unknown as Document;

    tryAutoRequestDocumentFullscreen(doc);

    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });
});
