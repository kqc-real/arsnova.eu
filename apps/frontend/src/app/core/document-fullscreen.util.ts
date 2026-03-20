/**
 * Browser-Vollbild direkt aus einer User-Geste (Click).
 * Kein await davor — sonst blockieren Chromium/WebKit die API oft.
 */

export function isDocumentFullscreenEnterAvailable(doc: Document): boolean {
  const d = doc as Document & {
    fullscreenEnabled?: boolean;
    webkitFullscreenEnabled?: boolean;
  };
  const root = doc.documentElement as HTMLElement & {
    requestFullscreen?: () => Promise<void> | void;
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const hasApi =
    typeof root.requestFullscreen === 'function' ||
    typeof root.webkitRequestFullscreen === 'function';
  if (!hasApi) {
    return false;
  }
  if (d.fullscreenEnabled === false) {
    return false;
  }
  if (d.webkitFullscreenEnabled === false) {
    return false;
  }
  return true;
}

export function getDocumentFullscreenElement(doc: Document): Element | null {
  const d = doc as Document & { webkitFullscreenElement?: Element | null };
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/**
 * @param onSettled optional: z. B. Signal aktualisieren (nach Promise oder sofort)
 */
export function tryRequestDocumentFullscreen(doc: Document, onSettled?: () => void): void {
  if (!isDocumentFullscreenEnterAvailable(doc)) {
    return;
  }
  if (getDocumentFullscreenElement(doc)) {
    onSettled?.();
    return;
  }

  const root = doc.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  let pending: Promise<void> | void;
  try {
    if (typeof root.requestFullscreen === 'function') {
      try {
        pending = root.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      } catch {
        pending = root.requestFullscreen();
      }
    } else if (typeof root.webkitRequestFullscreen === 'function') {
      pending = root.webkitRequestFullscreen();
    } else if (typeof root.msRequestFullscreen === 'function') {
      pending = root.msRequestFullscreen();
    } else {
      return;
    }
  } catch {
    return;
  }

  const sync = (): void => {
    onSettled?.();
  };

  if (pending && typeof (pending as Promise<void>).then === 'function') {
    void (pending as Promise<void>).then(sync, sync);
  } else {
    sync();
  }
}

/** Vollbild verlassen, falls aktiv (kein User-Gesture nötig). */
export function tryExitDocumentFullscreen(doc: Document, onSettled?: () => void): void {
  if (!getDocumentFullscreenElement(doc)) {
    onSettled?.();
    return;
  }

  const d = doc as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };

  let pending: Promise<void> | void;
  try {
    if (typeof doc.exitFullscreen === 'function') {
      pending = doc.exitFullscreen();
    } else if (typeof d.webkitExitFullscreen === 'function') {
      pending = d.webkitExitFullscreen();
    } else if (typeof d.msExitFullscreen === 'function') {
      pending = d.msExitFullscreen();
    } else {
      onSettled?.();
      return;
    }
  } catch {
    onSettled?.();
    return;
  }

  const sync = (): void => {
    onSettled?.();
  };

  if (pending && typeof (pending as Promise<void>).then === 'function') {
    void (pending as Promise<void>).then(sync, sync);
  } else {
    sync();
  }
}
