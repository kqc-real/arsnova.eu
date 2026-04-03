import { Router } from '@angular/router';
import { localizePath } from './locale-router';

type SessionStartTab = 'quiz' | 'qa' | 'quickFeedback';

interface LocationLike {
  assign(url: string): void;
}

function resolveWindowLocation(): LocationLike | null {
  const windowRef = globalThis.window;
  return windowRef ? windowRef.location : null;
}

export async function navigateToHostSession(
  router: Router,
  sessionCode: string,
  initialTab: SessionStartTab,
  locationRef: LocationLike | null = resolveWindowLocation(),
): Promise<void> {
  const basePath = localizePath(`/session/${sessionCode}/host`);
  const targetUrl =
    initialTab === 'quiz' ? basePath : `${basePath}?tab=${encodeURIComponent(initialTab)}`;

  const navigated = await router.navigateByUrl(targetUrl);
  if (navigated) {
    return;
  }

  if (locationRef) {
    locationRef.assign(targetUrl);
    return;
  }

  throw new Error('Host-Navigation fehlgeschlagen.');
}
