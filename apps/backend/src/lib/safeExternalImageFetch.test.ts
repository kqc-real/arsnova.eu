import type { LookupAddress } from 'node:dns';
import type { Dispatcher } from 'undici';
import { describe, expect, it, vi } from 'vitest';
import {
  detectImageMimeType,
  fetchSafeExternalImage,
  isPublicImageAddress,
  resolvePublicImageAddresses,
  SafeExternalImageFetchError,
  type SafeExternalImageFetchDependencies,
} from './safeExternalImageFetch';

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00,
  ]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const PNG_BYTES = pngHeader(1, 1);

function response(
  statusCode: number,
  headers: Record<string, string> = {},
  chunks: Uint8Array[] = [],
) {
  const iterable = (async function* () {
    yield* chunks;
  })();
  return {
    statusCode,
    headers,
    body: Object.assign(iterable, {
      dump: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    }),
  };
}

function publicLookup(addresses: LookupAddress[] = [{ address: '93.184.216.34', family: 4 }]) {
  return vi.fn().mockResolvedValue(addresses);
}

function dependencies(
  requestMock: ReturnType<typeof vi.fn>,
  lookupMock = publicLookup(),
): SafeExternalImageFetchDependencies {
  return {
    lookup: lookupMock,
    createDispatcher: vi.fn(
      () => ({ destroy: vi.fn().mockResolvedValue(undefined) }) as unknown as Dispatcher,
    ),
    request: requestMock as NonNullable<SafeExternalImageFetchDependencies['request']>,
  };
}

describe('safeExternalImageFetch', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'fe80::1',
    'fc00::1',
    'ff02::1',
    '2001:db8::1',
  ])('blockiert nicht öffentliche Adresse %s', (address) => {
    expect(isPublicImageAddress(address)).toBe(false);
  });

  it.each(['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111'])(
    'erlaubt öffentliche Unicast-Adresse %s',
    (address) => {
      expect(isPublicImageAddress(address)).toBe(true);
    },
  );

  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg'],
    [new TextEncoder().encode('GIF89a'), 'image/gif'],
    [
      new Uint8Array([
        ...new TextEncoder().encode('RIFF'),
        0,
        0,
        0,
        0,
        ...new TextEncoder().encode('WEBP'),
      ]),
      'image/webp',
    ],
    [new Uint8Array([0, 0, 0, 0, ...new TextEncoder().encode('ftypavif')]), 'image/avif'],
  ])('erkennt Bildsignatur %#', (bytes, mimeType) => {
    expect(detectImageMimeType(bytes as Uint8Array)).toBe(mimeType);
  });

  it('lehnt einen Host ab, sobald eine von mehreren A/AAAA-Adressen blockiert ist', async () => {
    const lookup = publicLookup([
      { address: '93.184.216.34', family: 4 },
      { address: '::ffff:127.0.0.1', family: 6 },
    ]);

    await expect(resolvePublicImageAddresses('example.test', lookup)).rejects.toMatchObject({
      code: 'BLOCKED_TARGET',
    });
  });

  it.each([
    'http://2130706433/image.png',
    'http://0x7f000001/image.png',
    'http://0177.0.0.1/image.png',
    'http://127.1/image.png',
    'http://[::ffff:7f00:1]/image.png',
  ])('blockiert alternative Loopback-Schreibweise %s', async (url) => {
    await expect(fetchSafeExternalImage(url)).rejects.toMatchObject({
      code: 'BLOCKED_TARGET',
    });
  });

  it('bindet den Request an die unmittelbar validierte DNS-Adresse', async () => {
    const lookup = publicLookup();
    const pinnedDispatcher = {
      destroy: vi.fn().mockResolvedValue(undefined),
    } as unknown as Dispatcher;
    const createDispatcher = vi.fn(() => pinnedDispatcher);
    const requestMock = vi
      .fn()
      .mockResolvedValue(
        response(
          200,
          { 'content-type': 'image/png', 'content-length': String(PNG_BYTES.byteLength) },
          [PNG_BYTES],
        ),
      );

    await expect(
      fetchSafeExternalImage(
        'https://images.example.test/picture.png',
        {},
        { lookup, createDispatcher, request: requestMock },
      ),
    ).resolves.toEqual({
      bytes: PNG_BYTES,
      mimeType: 'image/png',
      width: 1,
      height: 1,
      pixelCount: 1,
    });

    expect(lookup).toHaveBeenCalledOnce();
    expect(createDispatcher).toHaveBeenCalledWith({ address: '93.184.216.34', family: 4 });
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'images.example.test' }),
      expect.objectContaining({ dispatcher: pinnedDispatcher }),
    );
  });

  it('prüft jedes Redirect-Ziel erneut und blockiert interne Ziele vor dem Request', async () => {
    const requestMock = vi
      .fn()
      .mockResolvedValueOnce(response(302, { location: 'http://127.0.0.1/metadata' }));
    const deps = dependencies(requestMock);

    await expect(
      fetchSafeExternalImage('https://images.example.test/start', {}, deps),
    ).rejects.toMatchObject({ code: 'BLOCKED_TARGET' });
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it('begrenzt Redirect-Ketten', async () => {
    const requestMock = vi.fn().mockImplementation(async (url: URL) =>
      response(302, {
        location: `https://images.example.test${url.pathname}x`,
      }),
    );

    await expect(
      fetchSafeExternalImage(
        'https://images.example.test/start',
        { maxRedirects: 2 },
        dependencies(requestMock),
      ),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' });
    expect(requestMock).toHaveBeenCalledTimes(3);
  });

  it('sendet keine Auth-, Cookie-, Forwarded- oder Proxy-Header weiter', async () => {
    const requestMock = vi
      .fn()
      .mockResolvedValue(
        response(
          200,
          { 'content-type': 'image/png', 'content-length': String(PNG_BYTES.byteLength) },
          [PNG_BYTES],
        ),
      );

    await fetchSafeExternalImage(
      'https://images.example.test/picture.png',
      {},
      dependencies(requestMock),
    );

    const sentHeaders = requestMock.mock.calls[0]?.[1]?.headers;
    expect(sentHeaders).toEqual({
      accept: 'image/png,image/jpeg,image/webp',
      'user-agent': 'arsnova-pdf-image-fetch/1.0',
    });
  });

  it('bricht anhand von Content-Length vor dem Puffern ab', async () => {
    const oversized = response(
      200,
      {
        'content-type': 'image/png',
        'content-length': String(PNG_BYTES.byteLength),
      },
      [PNG_BYTES],
    );
    const requestMock = vi.fn().mockResolvedValue(oversized);

    await expect(
      fetchSafeExternalImage(
        'https://images.example.test/picture.png',
        { maxBytes: PNG_BYTES.byteLength - 1 },
        dependencies(requestMock),
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });
    expect(oversized.body.destroy).toHaveBeenCalledOnce();
  });

  it('bricht chunked Bodies bei Cap plus einem Byte ab', async () => {
    const oversized = response(200, { 'content-type': 'image/png' }, [
      PNG_BYTES,
      new Uint8Array([0]),
    ]);

    await expect(
      fetchSafeExternalImage(
        'https://images.example.test/picture.png',
        { maxBytes: PNG_BYTES.byteLength },
        dependencies(vi.fn().mockResolvedValue(oversized)),
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });
    expect(oversized.body.destroy).toHaveBeenCalledOnce();
  });

  it('lehnt MIME-/Magic-Mismatches und HTML unter Bild-MIME ab', async () => {
    const html = new TextEncoder().encode('<html>metadata</html>');
    await expect(
      fetchSafeExternalImage(
        'https://images.example.test/picture.jpg',
        {},
        dependencies(
          vi.fn().mockResolvedValue(response(200, { 'content-type': 'image/jpeg' }, [html])),
        ),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE_TYPE' });
    expect(detectImageMimeType(html)).toBeNull();
  });

  it('lehnt kleine Dateien mit übergroßen dekodierten Abmessungen ab', async () => {
    const bombHeader = pngHeader(5_000, 5_000);

    await expect(
      fetchSafeExternalImage(
        'https://images.example.test/bomb.png',
        {},
        dependencies(
          vi.fn().mockResolvedValue(response(200, { 'content-type': 'image/png' }, [bombHeader])),
        ),
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_DIMENSIONS' });
  });

  it('lehnt URL-Credentials und nicht-HTTP-Protokolle ab', async () => {
    await expect(fetchSafeExternalImage('file:///etc/passwd')).rejects.toBeInstanceOf(
      SafeExternalImageFetchError,
    );
    await expect(
      fetchSafeExternalImage('https://user:secret@example.test/image.png'),
    ).rejects.toMatchObject({ code: 'INVALID_URL' });
  });

  it('begrenzt bereits die DNS-Auflösung zeitlich', async () => {
    const lookup = vi.fn(
      () =>
        new Promise<LookupAddress[]>((_resolve) => {
          // absichtlich offen
        }),
    );

    await expect(
      fetchSafeExternalImage(
        'https://images.example.test/picture.png',
        { timeoutMs: 5 },
        { lookup: lookup as unknown as typeof import('node:dns/promises').lookup },
      ),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
