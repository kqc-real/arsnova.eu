import sharp from 'sharp';
import { PdfWorkerFatalRenderError } from './pdfWorkerTransport';

export const PDF_IMAGE_NORMALIZER_MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const PDF_IMAGE_NORMALIZER_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const PDF_IMAGE_NORMALIZER_MAX_TOTAL_OUTPUT_BYTES = 16 * 1024 * 1024;
export const PDF_IMAGE_NORMALIZER_MAX_DIMENSION = 4_096;
export const PDF_IMAGE_NORMALIZER_MAX_PIXELS = 16_000_000;
export const PDF_IMAGE_NORMALIZER_MAX_IMAGES = 100;
export const PDF_IMAGE_NORMALIZER_DEADLINE_MS = 20_000;
export const PDF_IMAGE_NORMALIZATION_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const DATA_IMAGE_SRC_RE = /\bsrc=(["'])(data:image\/[^"']+)\1/gi;
const ALLOWED_INPUT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export type NormalizedPdfImage = {
  bytes: Buffer;
  mimeType: 'image/webp';
};

export class PdfImageNormalizationDeadlineError extends PdfWorkerFatalRenderError {
  constructor() {
    super('PDF-Bildnormalisierung überschritt harte Deadline.');
    this.name = 'PdfImageNormalizationDeadlineError';
  }
}

export function configurePdfImageNormalizer(): void {
  sharp.cache(false);
  sharp.concurrency(1);
}

export async function normalizePdfImageBytes(
  input: Uint8Array,
  declaredMimeType: string,
  options: { timeoutMs?: number } = {},
): Promise<NormalizedPdfImage> {
  if (
    input.byteLength < 1 ||
    input.byteLength > PDF_IMAGE_NORMALIZER_MAX_INPUT_BYTES ||
    !ALLOWED_INPUT_MIME_TYPES.has(declaredMimeType.toLowerCase())
  ) {
    throw new Error('Unzulässiges PDF-Bild.');
  }

  const source = Buffer.from(input);
  const decoderOptions = {
    failOn: 'error' as const,
    limitInputPixels: PDF_IMAGE_NORMALIZER_MAX_PIXELS,
    sequentialRead: true,
  };
  const timeoutSeconds = Math.max(1, Math.ceil((options.timeoutMs ?? 10_000) / 1_000));
  const metadata = await sharp(source, decoderOptions)
    .timeout({ seconds: timeoutSeconds })
    .metadata();
  const detectedMimeType =
    metadata.format === 'jpeg' ? 'image/jpeg' : metadata.format ? `image/${metadata.format}` : null;
  const normalizedDeclared =
    declaredMimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : declaredMimeType.toLowerCase();
  if (
    detectedMimeType !== normalizedDeclared ||
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > PDF_IMAGE_NORMALIZER_MAX_PIXELS ||
    (metadata.pages ?? 1) !== 1
  ) {
    throw new Error('Bildformat oder dekodierte Bildgröße ist unzulässig.');
  }

  const { data, info } = await sharp(source, decoderOptions)
    .timeout({ seconds: timeoutSeconds })
    .rotate()
    .resize({
      width: PDF_IMAGE_NORMALIZER_MAX_DIMENSION,
      height: PDF_IMAGE_NORMALIZER_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  if (
    data.byteLength < 1 ||
    data.byteLength > PDF_IMAGE_NORMALIZER_MAX_OUTPUT_BYTES ||
    info.width > PDF_IMAGE_NORMALIZER_MAX_DIMENSION ||
    info.height > PDF_IMAGE_NORMALIZER_MAX_DIMENSION ||
    info.width * info.height > PDF_IMAGE_NORMALIZER_MAX_PIXELS
  ) {
    throw new Error('Normalisiertes PDF-Bild überschreitet das Ausgabelimit.');
  }
  return { bytes: data, mimeType: 'image/webp' };
}

function withDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onDeadline?: () => void,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        onDeadline?.();
        reject(new PdfImageNormalizationDeadlineError());
      }, timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function normalizePdfImageDataUrlsInHtml(
  html: string,
  options: {
    deadlineMs?: number;
    normalizeImage?: typeof normalizePdfImageBytes;
    onDeadline?: () => void;
    maxTotalOutputBytes?: number;
  } = {},
): Promise<string> {
  const deadlineAt = Date.now() + (options.deadlineMs ?? PDF_IMAGE_NORMALIZER_DEADLINE_MS);
  const normalizeImage = options.normalizeImage ?? normalizePdfImageBytes;
  const matches = [...html.matchAll(DATA_IMAGE_SRC_RE)];
  const occurrences = new Map<string, number>();
  for (const match of matches) {
    occurrences.set(match[2], (occurrences.get(match[2]) ?? 0) + 1);
  }
  const sources = [...occurrences.keys()];
  const replacements = new Map<string, string>();
  const maxTotalOutputBytes = Math.min(
    options.maxTotalOutputBytes ?? PDF_IMAGE_NORMALIZER_MAX_TOTAL_OUTPUT_BYTES,
    PDF_IMAGE_NORMALIZER_MAX_TOTAL_OUTPUT_BYTES,
  );
  if (!Number.isSafeInteger(maxTotalOutputBytes) || maxTotalOutputBytes < 1) {
    throw new Error('Ungültiges PDF-Bild-Gesamtausgabelimit.');
  }
  let totalOutputBytes = 0;

  const setBudgetedReplacement = (source: string, candidate: string): void => {
    const occurrenceCount = occurrences.get(source) ?? 0;
    if (!Number.isSafeInteger(occurrenceCount) || occurrenceCount < 1) {
      throw new Error('Ungültige PDF-Bild-Vorkommenszahl.');
    }
    const candidates =
      candidate === PDF_IMAGE_NORMALIZATION_PLACEHOLDER
        ? [PDF_IMAGE_NORMALIZATION_PLACEHOLDER, '']
        : [candidate, PDF_IMAGE_NORMALIZATION_PLACEHOLDER, ''];
    const remainingBytes = maxTotalOutputBytes - totalOutputBytes;
    for (const replacement of candidates) {
      const replacementBytes = Buffer.byteLength(replacement, 'utf8');
      if (
        replacementBytes === 0 ||
        replacementBytes <= Math.floor(remainingBytes / occurrenceCount)
      ) {
        totalOutputBytes += replacementBytes * occurrenceCount;
        replacements.set(source, replacement);
        return;
      }
    }
  };

  for (const source of sources.slice(0, PDF_IMAGE_NORMALIZER_MAX_IMAGES)) {
    const match = source.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
    const remainingMs = deadlineAt - Date.now();
    if (!match || remainingMs <= 0) {
      setBudgetedReplacement(source, PDF_IMAGE_NORMALIZATION_PLACEHOLDER);
      continue;
    }
    try {
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.byteLength > PDF_IMAGE_NORMALIZER_MAX_INPUT_BYTES) {
        throw new Error('PDF-Bild überschreitet das Eingabelimit.');
      }
      const normalized = await withDeadline(
        normalizeImage(bytes, match[1].toLowerCase(), { timeoutMs: remainingMs }),
        remainingMs,
        options.onDeadline,
      );
      setBudgetedReplacement(
        source,
        `data:${normalized.mimeType};base64,${normalized.bytes.toString('base64')}`,
      );
    } catch (error) {
      if (error instanceof PdfImageNormalizationDeadlineError) throw error;
      setBudgetedReplacement(source, PDF_IMAGE_NORMALIZATION_PLACEHOLDER);
    }
  }
  for (const source of sources.slice(PDF_IMAGE_NORMALIZER_MAX_IMAGES)) {
    setBudgetedReplacement(source, PDF_IMAGE_NORMALIZATION_PLACEHOLDER);
  }

  return html.replace(DATA_IMAGE_SRC_RE, (full, quote: string, source: string) => {
    const replacement = replacements.get(source);
    if (replacement === undefined) return full;
    return replacement ? `src=${quote}${replacement}${quote}` : 'data-pdf-image-omitted="budget"';
  });
}

export async function normalizePdfWorkerRequest<T extends { html: string }>(
  request: T,
  options: Parameters<typeof normalizePdfImageDataUrlsInHtml>[1] = {},
): Promise<T> {
  return {
    ...request,
    html: await normalizePdfImageDataUrlsInHtml(request.html, options),
  };
}

export function createPdfImageNormalizingRenderer<TRequest extends { html: string }, TResult>(
  render: (request: TRequest) => Promise<TResult>,
  options: Parameters<typeof normalizePdfImageDataUrlsInHtml>[1] = {},
): (request: TRequest) => Promise<TResult> {
  let fatal = false;
  return async (request) => {
    if (fatal) throw new Error('PDF image normalizer is fatal');
    try {
      const normalized = await normalizePdfWorkerRequest(request, {
        ...options,
        onDeadline: () => {
          fatal = true;
          options.onDeadline?.();
        },
      });
      if (fatal) throw new Error('PDF image normalizer is fatal');
      return await render(normalized);
    } catch (error) {
      if (error instanceof PdfImageNormalizationDeadlineError) fatal = true;
      throw error;
    }
  };
}
