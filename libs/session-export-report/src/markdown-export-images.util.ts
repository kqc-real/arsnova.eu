export interface InlineExportImagesOptions {
  /** Liest `/assets/…`-Dateien vom Dateisystem (Backend). */
  readLocalAsset?: (relativePath: string) => Promise<Uint8Array | null>;
  /** Externe http(s)-Bilder per Fetch laden (Default: true). */
  fetchExternal?: boolean;
  timeoutMs?: number;
  /** Bilder über dieser Größe nicht einbetten (URL bleibt erhalten). */
  maxImageBytes?: number;
}

const IMG_TAG_RE = /<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi;

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export function assetRelativePathFromSrc(src: string): string | null {
  try {
    const url = src.startsWith('http') ? new URL(src) : new URL(src, 'http://local');
    const match = url.pathname.match(/\/assets\/(.+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function fetchImageBytes(src: string, timeoutMs: number): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(src, { signal: controller.signal });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveImageDataUrl(
  src: string,
  options: InlineExportImagesOptions,
): Promise<string | null> {
  if (src.startsWith('data:')) return src;

  const timeoutMs = options.timeoutMs ?? 15000;
  const assetPath = assetRelativePathFromSrc(src);

  if (assetPath && options.readLocalAsset) {
    const localBytes = await options.readLocalAsset(assetPath);
    if (localBytes) {
      if (options.maxImageBytes && localBytes.byteLength > options.maxImageBytes) {
        return null;
      }
      return toDataUrl(localBytes, mimeFromPath(assetPath));
    }
  }

  if (options.fetchExternal !== false && /^https?:\/\//i.test(src)) {
    const fetched = await fetchImageBytes(src, timeoutMs);
    if (fetched) {
      if (options.maxImageBytes && fetched.byteLength > options.maxImageBytes) {
        return null;
      }
      const mimeType =
        mimeFromPath(new URL(src).pathname) !== 'application/octet-stream'
          ? mimeFromPath(new URL(src).pathname)
          : 'image/jpeg';
      return toDataUrl(fetched, mimeType);
    }
  }

  return null;
}

/** Ersetzt Bild-URLs durch data:-URLs, damit PDF-Render ohne Netzwerk/Frontend funktioniert. */
export async function inlineExportImagesInHtml(
  html: string,
  options: InlineExportImagesOptions = {},
): Promise<string> {
  const cache = new Map<string, string>();
  const matches = [...html.matchAll(IMG_TAG_RE)];

  for (const match of matches) {
    const src = match[2];
    if (!src || cache.has(src)) continue;
    const dataUrl = await resolveImageDataUrl(src, options);
    if (dataUrl) cache.set(src, dataUrl);
  }

  if (cache.size === 0) return html;

  return html.replace(IMG_TAG_RE, (full, before, src, after) => {
    const dataUrl = cache.get(src);
    if (!dataUrl) return full;
    return `<img${before}src="${dataUrl}"${after}>`;
  });
}
