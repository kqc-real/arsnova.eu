import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { Agent, request, type Dispatcher } from 'undici';
import ipaddr from 'ipaddr.js';
import { imageSize } from 'image-size';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 400_000;
const DEFAULT_MAX_REDIRECTS = 3;
const MAX_IMAGE_DIMENSION = 8_192;
const MAX_IMAGE_PIXELS = 16_000_000;

export type SafeExternalImage = {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  pixelCount: number;
};
type DetectedImageMime = SafeExternalImage['mimeType'] | 'image/gif' | 'image/avif';

export type SafeExternalImageFetchErrorCode =
  | 'INVALID_URL'
  | 'BLOCKED_TARGET'
  | 'TOO_MANY_REDIRECTS'
  | 'HTTP_STATUS'
  | 'IMAGE_TOO_LARGE'
  | 'INVALID_IMAGE_TYPE'
  | 'IMAGE_DIMENSIONS'
  | 'TIMEOUT';

export class SafeExternalImageFetchError extends Error {
  constructor(
    readonly code: SafeExternalImageFetchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SafeExternalImageFetchError';
  }
}

type SafeFetchResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array> & {
    dump?: () => Promise<void>;
    destroy?: (error?: Error) => void;
  };
};

type SafeFetchRequest = (
  url: URL,
  options: {
    dispatcher: Dispatcher;
    signal: AbortSignal;
    headers: Record<string, string>;
  },
) => Promise<SafeFetchResponse>;

export type SafeExternalImageFetchDependencies = {
  lookup?: typeof dnsLookup;
  createDispatcher?: (address: LookupAddress) => Dispatcher;
  request?: SafeFetchRequest;
};

function normalizedRange(address: string): string {
  const parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6') {
    const ipv6 = parsed as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) {
      return ipv6.toIPv4Address().range();
    }
  }
  return parsed.range();
}

/** Nur global routbare Unicast-Adressen sind für PDF-Bilder zulässig. */
export function isPublicImageAddress(address: string): boolean {
  try {
    return normalizedRange(address) === 'unicast';
  } catch {
    return false;
  }
}

export async function resolvePublicImageAddresses(
  hostname: string,
  lookup: typeof dnsLookup = dnsLookup,
): Promise<LookupAddress[]> {
  const normalizedHostname =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const addresses = ipaddr.isValid(normalizedHostname)
    ? [
        {
          address: normalizedHostname,
          family: ipaddr.parse(normalizedHostname).kind() === 'ipv4' ? 4 : 6,
        },
      ]
    : await lookup(normalizedHostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicImageAddress(address))) {
    throw new SafeExternalImageFetchError(
      'BLOCKED_TARGET',
      'Das Bildziel ist nicht öffentlich routbar.',
    );
  }
  return addresses;
}

function createPinnedDispatcher(address: LookupAddress): Dispatcher {
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        if (options.all) {
          callback(null, [address]);
          return;
        }
        callback(null, address.address, address.family);
      },
    },
  });
}

async function defaultRequest(
  url: URL,
  options: {
    dispatcher: Dispatcher;
    signal: AbortSignal;
    headers: Record<string, string>;
  },
): Promise<SafeFetchResponse> {
  return request(url, {
    dispatcher: options.dispatcher,
    signal: options.signal,
    headers: options.headers,
  }) as Promise<SafeFetchResponse>;
}

function parseContentLength(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readBoundedBody(response: SafeFetchResponse, maxBytes: number): Promise<Uint8Array> {
  const announcedLength = parseContentLength(response.headers['content-length']);
  if (announcedLength !== null && announcedLength > maxBytes) {
    response.body.destroy?.();
    throw new SafeExternalImageFetchError('IMAGE_TOO_LARGE', 'Das Bild ist zu groß.');
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const rawChunk of response.body) {
    const chunk = rawChunk instanceof Uint8Array ? rawChunk : new Uint8Array(rawChunk);
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      response.body.destroy?.();
      throw new SafeExternalImageFetchError('IMAGE_TOO_LARGE', 'Das Bild ist zu groß.');
    }
    chunks.push(chunk);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function normalizedContentType(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(';', 1)[0]?.trim().toLowerCase() || null;
}

export function detectImageMimeType(bytes: Uint8Array): DetectedImageMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const ascii = (start: number, end: number): string =>
    String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6))) {
    return 'image/gif';
  }
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) {
    return 'image/avif';
  }
  return null;
}

function validateImageType(response: SafeFetchResponse, bytes: Uint8Array): SafeExternalImage {
  const detected = detectImageMimeType(bytes);
  const declared = normalizedContentType(response.headers['content-type']);
  const normalizedDeclared = declared === 'image/jpg' ? 'image/jpeg' : declared;
  if (!detected || normalizedDeclared !== detected) {
    throw new SafeExternalImageFetchError(
      'INVALID_IMAGE_TYPE',
      'MIME-Typ und Bildsignatur stimmen nicht überein.',
    );
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(detected)) {
    throw new SafeExternalImageFetchError(
      'INVALID_IMAGE_TYPE',
      'Animierte oder komplexe Bildformate sind für PDF-Berichte nicht zulässig.',
    );
  }
  let dimensions: ReturnType<typeof imageSize>;
  try {
    dimensions = imageSize(bytes);
  } catch {
    throw new SafeExternalImageFetchError('INVALID_IMAGE_TYPE', 'Die Bildstruktur ist ungültig.');
  }
  const width = dimensions.width;
  const height = dimensions.height;
  const pixelCount = width * height;
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    pixelCount > MAX_IMAGE_PIXELS
  ) {
    throw new SafeExternalImageFetchError(
      'IMAGE_DIMENSIONS',
      'Die dekodierte Bildgröße überschreitet das PDF-Limit.',
    );
  }
  return {
    bytes,
    mimeType: detected as SafeExternalImage['mimeType'],
    width,
    height,
    pixelCount,
  };
}

function parseImageUrl(rawUrl: string, baseUrl?: URL): URL {
  let url: URL;
  try {
    url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
  } catch {
    throw new SafeExternalImageFetchError('INVALID_URL', 'Ungültige Bild-URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new SafeExternalImageFetchError('INVALID_URL', 'Unzulässige Bild-URL.');
  }
  return url;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new SafeExternalImageFetchError(
                'TIMEOUT',
                'Zeitüberschreitung beim sicheren Bildabruf.',
              ),
            ),
          timeoutMs,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchSafeExternalImage(
  rawUrl: string,
  options: {
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
  } = {},
  dependencies: SafeExternalImageFetchDependencies = {},
): Promise<SafeExternalImage> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const lookup = dependencies.lookup ?? dnsLookup;
  const makeDispatcher = dependencies.createDispatcher ?? createPinnedDispatcher;
  const performRequest = dependencies.request ?? defaultRequest;
  let currentUrl = parseImageUrl(rawUrl);
  const deadlineAt = Date.now() + timeoutMs;

  const remainingTimeoutMs = (): number => {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) {
      throw new SafeExternalImageFetchError(
        'TIMEOUT',
        'Zeitüberschreitung beim sicheren Bildabruf.',
      );
    }
    return remaining;
  };

  for (let redirectCount = 0; ; redirectCount += 1) {
    const addresses = await withTimeout(
      resolvePublicImageAddresses(currentUrl.hostname, lookup),
      remainingTimeoutMs(),
    );
    const dispatcher = makeDispatcher(addresses[0]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingTimeoutMs());
    timeout.unref?.();
    try {
      const response = await performRequest(currentUrl, {
        dispatcher,
        signal: controller.signal,
        headers: {
          accept: 'image/png,image/jpeg,image/webp',
          'user-agent': 'arsnova-pdf-image-fetch/1.0',
        },
      });

      if (response.statusCode >= 300 && response.statusCode < 400) {
        response.body.destroy?.();
        const location = response.headers['location'];
        const redirectTarget = Array.isArray(location) ? location[0] : location;
        if (!redirectTarget || redirectCount >= maxRedirects) {
          throw new SafeExternalImageFetchError(
            'TOO_MANY_REDIRECTS',
            'Zu viele Bild-Weiterleitungen.',
          );
        }
        currentUrl = parseImageUrl(redirectTarget, currentUrl);
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.body.destroy?.();
        throw new SafeExternalImageFetchError(
          'HTTP_STATUS',
          `Bildabruf mit HTTP ${response.statusCode} abgelehnt.`,
        );
      }

      return validateImageType(response, await readBoundedBody(response, maxBytes));
    } finally {
      clearTimeout(timeout);
      if (dispatcher instanceof Agent) {
        await dispatcher.close();
      } else {
        await dispatcher.destroy();
      }
    }
  }
}
