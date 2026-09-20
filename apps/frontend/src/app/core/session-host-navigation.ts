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
  extraQuery: Record<string, string> = {},
): Promise<void> {
  const basePath = localizePath(`/session/${sessionCode}/host`);
  const params = new URLSearchParams();
  params.set('tab', initialTab);
  for (const [key, value] of Object.entries(extraQuery)) {
    params.set(key, value);
  }
  const query = params.toString();
  const targetUrl = query ? `${basePath}?${query}` : basePath;

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
