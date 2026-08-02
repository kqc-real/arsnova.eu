import type { FooterStatusDTO } from '@arsnova/shared-types';

export type FooterStatusColor = 'green' | 'yellow' | 'red' | 'gray';

/**
 * Gemeinsame Ampelfarbe für Footer-Mehr-Menü und ServerStatusWidget.
 * Eine Quelle für connectionOk / loading / serviceStatus (#196).
 */
export function resolveFooterStatusColor(
  connectionOk: boolean,
  loading: boolean,
  stats: Pick<FooterStatusDTO, 'serviceStatus'> | null | undefined,
): FooterStatusColor {
  if (!connectionOk || loading) return 'gray';
  if (!stats) return 'gray';
  switch (stats.serviceStatus) {
    case 'stable':
      return 'green';
    case 'limited':
      return 'yellow';
    case 'critical':
      return 'red';
    default:
      return 'gray';
  }
}

/** CSS-Token für den Status-Dot (Mat-Menu-Overlay braucht oft Inline-Farbe). */
export function resolveFooterStatusDotCssColor(color: FooterStatusColor): string {
  switch (color) {
    case 'green':
      return 'var(--app-status-healthy)';
    case 'yellow':
      return 'var(--app-status-busy)';
    case 'red':
      return 'var(--mat-sys-error)';
    default:
      return 'var(--mat-sys-outline-variant)';
  }
}
