export interface InlineExportImagesOptions {
  /** Liest `/assets/…`-Dateien vom Dateisystem (Backend). */
  readLocalAsset?: (relativePath: string) => Promise<Uint8Array | null>;
  /** Externe http(s)-Bilder per Fetch laden (Default: true). */
  fetchExternal?: boolean;
  timeoutMs?: number;
  /** Bilder über dieser Größe nicht einbetten. */
  maxImageBytes?: number;
  /** Serverseitiger, DNS-/TOCTOU-gehärteter Loader für externe Bilder. */
  fetchExternalImage?: (
    src: string,
    options: { timeoutMs: number; maxImageBytes: number },
  ) => Promise<{ bytes: Uint8Array; mimeType: string } | null>;
  /** Nicht eingebettete Bilder fail-closed durch einen lokalen Platzhalter ersetzen. */
  replaceUnresolvedImages?: boolean;
  /** Maximale Anzahl unterschiedlicher nicht-data:-Bildquellen pro Report. */
  maxImages?: number;
}

const IMG_TAG_RE = /<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi;
const TRANSPARENT_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

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
    if (options.fetchExternalImage) {
      try {
        const fetched = await options.fetchExternalImage(src, {
          timeoutMs,
          maxImageBytes: options.maxImageBytes ?? 400_000,
        });
        if (!fetched) return null;
        if (options.maxImageBytes && fetched.bytes.byteLength > options.maxImageBytes) {
          return null;
        }
        return toDataUrl(fetched.bytes, fetched.mimeType);
      } catch {
        return null;
      }
    } else {
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
  }

  return null;
}

/** Ersetzt Bild-URLs durch data:-URLs, damit PDF-Render ohne Netzwerk/Frontend funktioniert. */
export async function inlineExportImagesInHtml(
  html: string,
  options: InlineExportImagesOptions = {},
): Promise<string> {
  const cache = new Map<string, string | null>();
  const matches = [...html.matchAll(IMG_TAG_RE)];
  let attemptedImages = 0;

  for (const match of matches) {
    const src = match[2];
    if (!src || cache.has(src)) continue;
    if (!src.startsWith('data:')) {
      if (attemptedImages >= (options.maxImages ?? Number.POSITIVE_INFINITY)) {
        cache.set(src, null);
        continue;
      }
      attemptedImages += 1;
    }
    const dataUrl = await resolveImageDataUrl(src, options);
    cache.set(src, dataUrl);
  }

  return html.replace(IMG_TAG_RE, (full, before, src, after) => {
    const dataUrl = cache.get(src);
    if (!dataUrl && !options.replaceUnresolvedImages) return full;
    return `<img${before}src="${dataUrl ?? TRANSPARENT_IMAGE_PLACEHOLDER}"${after}>`;
  });
}
