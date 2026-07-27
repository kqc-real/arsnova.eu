const DEFAULT_SITE_URL = 'https://info.arsnova.eu/';

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export const SITE_URL = ensureTrailingSlash(import.meta.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL);

export function toAbsoluteUrl(path = ''): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, SITE_URL).href;
}
