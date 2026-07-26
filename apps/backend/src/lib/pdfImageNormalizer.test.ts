import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  PDF_IMAGE_NORMALIZATION_PLACEHOLDER,
  PDF_IMAGE_NORMALIZER_MAX_DIMENSION,
  PDF_IMAGE_NORMALIZER_MAX_INPUT_BYTES,
  PDF_IMAGE_NORMALIZER_MAX_TOTAL_OUTPUT_BYTES,
  configurePdfImageNormalizer,
  createPdfImageNormalizingRenderer,
  normalizePdfImageBytes,
  normalizePdfImageDataUrlsInHtml,
  normalizePdfWorkerRequest,
} from './pdfImageNormalizer';

function dataUrl(mimeType: string, bytes: Uint8Array): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function imageBytesFromHtml(html: string): Buffer {
  const encoded = html.match(/src="data:image\/webp;base64,([^"]+)"/)?.[1];
  if (!encoded) throw new Error('Normalisiertes WebP fehlt.');
  return Buffer.from(encoded, 'base64');
}

describe('pdfImageNormalizer', () => {
  it('deaktiviert Worker-Caches und begrenzt native Decode-Parallelität', () => {
    configurePdfImageNormalizer();
    expect(sharp.cache().memory.max).toBe(0);
    expect(sharp.concurrency()).toBe(1);
  });

  it('dekodiert, verkleinert und transkodiert Rasterbilder ohne Metadaten', async () => {
    const input = await sharp({
      create: {
        width: PDF_IMAGE_NORMALIZER_MAX_DIMENSION + 100,
        height: 10,
        channels: 3,
        background: '#ff0000',
      },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const normalized = await normalizePdfImageBytes(input, 'image/jpeg');
    const metadata = await sharp(normalized.bytes).metadata();

    expect(normalized.mimeType).toBe('image/webp');
    expect(metadata.width).toBe(PDF_IMAGE_NORMALIZER_MAX_DIMENSION);
    expect(metadata.height).toBeGreaterThan(0);
    expect(metadata.exif).toBeUndefined();
  });

  it('entfernt angehängte Polyglot-Nutzlast durch echtes Decode/Encode', async () => {
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const polyglot = Buffer.concat([png, Buffer.from('<script>metadata()</script>')]);

    const html = await normalizePdfImageDataUrlsInHtml(
      `<img src="${dataUrl('image/png', polyglot)}" alt="x">`,
    );
    const normalized = imageBytesFromHtml(html);

    expect(normalized.toString('utf8')).not.toContain('<script>');
    await expect(sharp(normalized).metadata()).resolves.toMatchObject({ format: 'webp' });
  });

  it('ersetzt SVG, beschädigte, übergroße und Pixel-Bomben fail-closed', async () => {
    const oversized = new Uint8Array(PDF_IMAGE_NORMALIZER_MAX_INPUT_BYTES + 1);
    const pixelBomb = await sharp({
      create: {
        width: 4_001,
        height: 4_001,
        channels: 3,
        background: '#000000',
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const sources = [
      dataUrl('image/svg+xml', Buffer.from('<svg><image href="http://metadata/"/></svg>')),
      dataUrl('image/png', Buffer.from('not-a-png')),
      dataUrl('image/png', oversized),
      dataUrl('image/png', pixelBomb),
    ];
    const html = sources.map((src) => `<img src="${src}">`).join('');

    const normalized = await normalizePdfImageDataUrlsInHtml(html);

    expect(normalized).not.toContain('http://metadata/');
    expect(normalized.split(PDF_IMAGE_NORMALIZATION_PLACEHOLDER)).toHaveLength(5);
  });

  it('normalisiert doppelte Quellen nur einmal', async () => {
    const source = dataUrl('image/png', Buffer.from('fake'));
    const normalizeImage = vi.fn(async () => ({
      bytes: Buffer.from('webp'),
      mimeType: 'image/webp' as const,
    }));
    const html = `<img src="${source}"><img src="${source}">`;

    const normalized = await normalizePdfImageDataUrlsInHtml(html, {
      normalizeImage,
      deadlineMs: 1_000,
    });

    expect(normalizeImage).toHaveBeenCalledOnce();
    expect(normalized.match(/data:image\/webp;base64,/g)).toHaveLength(2);
  });

  it('wird bei hängender Normalisierung fatal und startet kein Chromium', async () => {
    const source = dataUrl('image/png', Buffer.from('fake'));
    const chromiumRender = vi.fn(async () => Buffer.from('%PDF'));
    const onDeadline = vi.fn();
    const render = createPdfImageNormalizingRenderer(chromiumRender, {
      deadlineMs: 5,
      normalizeImage: () => new Promise(() => undefined),
      onDeadline,
    });
    const request = { html: `<img src="${source}">`, pdfOptions: { format: 'A4' } };

    await expect(render(request)).rejects.toThrow(/Deadline/);
    expect(onDeadline).toHaveBeenCalledOnce();
    expect(chromiumRender).not.toHaveBeenCalled();
    await expect(render(request)).rejects.toThrow(/fatal/);
    expect(chromiumRender).not.toHaveBeenCalled();
  });

  it('bindet die Normalisierung vor Chromium in den Worker-Request ein', async () => {
    const request = {
      html: `<img src='${dataUrl('image/png', Buffer.from('invalid'))}'>`,
      pdfOptions: { format: 'A4' },
    };

    await expect(normalizePdfWorkerRequest(request)).resolves.toEqual({
      ...request,
      html: `<img src='${PDF_IMAGE_NORMALIZATION_PLACEHOLDER}'>`,
    });
  });

  it('begrenzt die normalisierte Gesamtausgabe pro Renderjob', async () => {
    const chunk = Buffer.alloc(1024 * 1024, 1);
    const count = PDF_IMAGE_NORMALIZER_MAX_TOTAL_OUTPUT_BYTES / chunk.byteLength + 1;
    const html = Array.from(
      { length: count },
      (_, index) => `<img src="${dataUrl('image/png', Buffer.from([index]))}">`,
    ).join('');

    const normalized = await normalizePdfImageDataUrlsInHtml(html, {
      normalizeImage: async () => ({ bytes: chunk, mimeType: 'image/webp' }),
    });

    expect(normalized.split(PDF_IMAGE_NORMALIZATION_PLACEHOLDER)).toHaveLength(2);
  });
});
