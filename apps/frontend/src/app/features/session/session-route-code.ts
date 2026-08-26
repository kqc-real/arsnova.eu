import type { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';

/** Liest den Session-Code aus der aktuellen Route oder einem Vorfahren. */
export function readSessionCodeFromSnapshot(route: ActivatedRouteSnapshot): string | null {
  return (
    route.paramMap.get('code') ??
    route.parent?.paramMap.get('code') ??
    route.pathFromRoot
      .map((snapshot) => snapshot.paramMap.get('code'))
      .find((value): value is string => typeof value === 'string' && value.length > 0) ??
    null
  );
}

/** Wie `readSessionCodeFromSnapshot`, für Komponenten inklusive lazy Child-Routen. */
export function readSessionCodeFromActivatedRoute(route: ActivatedRoute): string {
  let current: ActivatedRoute | null = route;
  while (current) {
    const code = current.snapshot?.paramMap?.get('code');
    if (code) {
      return code;
    }
    current = current.parent;
  }
  return '';
}
