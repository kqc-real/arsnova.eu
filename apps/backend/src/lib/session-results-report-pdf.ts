import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium, type Browser, type LaunchOptions } from 'playwright';
import type { SessionExportDTO, SessionResultsPdfProfile } from '@arsnova/shared-types';
import {
  buildSessionResultsReportHtml,
  buildSessionResultsPdfFilename,
  buildSessionResultsPlaywrightPdfOptions,
  buildQuestionContinuationStamps,
  EXPORT_REPORT_HLJS_CSS_URL,
  EXPORT_REPORT_KATEX_CSS_URL,
  getSessionResultsReportLabelsForLocale,
  inlineExportImagesInHtml,
  stampQuestionContinuationsOnPdf,
} from '@arsnova/session-export-report';
import { readSessionExportLocalAsset } from './session-export-asset-reader';
import { fetchSafeExternalImage, type SafeExternalImage } from './safeExternalImageFetch';

export { buildSessionResultsPdfFilename };

export interface BuildSessionResultsPdfOptions {
  localeId?: string;
  /** `visual` (Standard) oder `pdfUa`. */
  profile?: SessionResultsPdfProfile;
}

export const PDF_MAX_REPORT_IMAGES = 100;
export const PDF_MAX_EXTERNAL_IMAGES = 50;
export const PDF_MAX_EXTERNAL_IMAGE_BYTES = 5_000_000;
export const PDF_MAX_EXTERNAL_IMAGE_PIXELS = 40_000_000;
export const PDF_IMAGE_INLINE_DEADLINE_MS = 30_000;

function resolveExportAssetBaseUrl(): string {
  return (
    process.env.SESSION_EXPORT_ASSET_BASE_URL?.trim() ||
    process.env.PUBLIC_FRONTEND_URL?.trim() ||
    `http://127.0.0.1:${process.env.PORT?.trim() || '3000'}`
  ).replace(/\/$/, '');
}

function resolveChromiumExecutablePath(): string | undefined {
  const fromEnv =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || process.env.CHROMIUM_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  for (const candidate of ['/usr/bin/chromium-browser', '/usr/bin/chromium']) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resolveChromiumLaunchOptions(): LaunchOptions {
  return {
    headless: true,
    executablePath: resolveChromiumExecutablePath(),
    // Docker/Alpine: kein Sandbox-Namespace, kleines /dev/shm
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
}

async function inlineKatexWoff2Fonts(css: string, cssPath: string): Promise<string> {
  const fontPathPattern = /url\((fonts\/[^)]+\.woff2)\)/g;
  const fontPaths = [...new Set([...css.matchAll(fontPathPattern)].map((match) => match[1]))];
  const dataUrls = new Map(
    await Promise.all(
      fontPaths.map(async (fontPath) => {
        const bytes = await readFile(resolve(dirname(cssPath), fontPath));
        return [fontPath, `data:font/woff2;base64,${bytes.toString('base64')}`] as const;
      }),
    ),
  );
  return css
    .replace(fontPathPattern, (_full, fontPath: string) => `url(${dataUrls.get(fontPath)})`)
    .replace(/,url\(fonts\/[^)]+\.(?:woff|ttf)\) format\("[^"]+"\)/g, '');
}

async function inlineTrustedReportStylesheets(html: string): Promise<string> {
  const katexCssPath = require.resolve('katex/dist/katex.min.css');
  const highlightCssPath = require.resolve('highlight.js/styles/github.min.css');
  const [rawKatexCss, highlightCss] = await Promise.all([
    readFile(katexCssPath, 'utf8'),
    readFile(highlightCssPath, 'utf8'),
  ]);
  const katexCss = await inlineKatexWoff2Fonts(rawKatexCss, katexCssPath);
  return html
    .replace(
      new RegExp(
        `<link[^>]+href="${EXPORT_REPORT_KATEX_CSS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`,
      ),
      `<style data-pdf-source="katex">${katexCss}</style>`,
    )
    .replace(
      new RegExp(
        `<link[^>]+href="${EXPORT_REPORT_HLJS_CSS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`,
      ),
      `<style data-pdf-source="highlight">${highlightCss}</style>`,
    );
}

export function createPdfExternalImageLoader(
  now: () => number = Date.now,
  fetchImage: typeof fetchSafeExternalImage = fetchSafeExternalImage,
): (
  src: string,
  options: { timeoutMs: number; maxImageBytes: number },
) => Promise<SafeExternalImage | null> {
  const deadlineAt = now() + PDF_IMAGE_INLINE_DEADLINE_MS;
  let externalImages = 0;
  let totalBytes = 0;
  let totalPixels = 0;

  return async (src, options) => {
    const remainingMs = deadlineAt - now();
    if (externalImages >= PDF_MAX_EXTERNAL_IMAGES || remainingMs <= 0) {
      return null;
    }
    externalImages += 1;
    const image = await fetchImage(src, {
      timeoutMs: Math.max(1, Math.min(options.timeoutMs, remainingMs)),
      maxBytes: options.maxImageBytes,
    });
    if (
      totalBytes + image.bytes.byteLength > PDF_MAX_EXTERNAL_IMAGE_BYTES ||
      totalPixels + image.pixelCount > PDF_MAX_EXTERNAL_IMAGE_PIXELS
    ) {
      return null;
    }
    totalBytes += image.bytes.byteLength;
    totalPixels += image.pixelCount;
    return image;
  };
}

export async function buildSessionResultsPdf(
  data: SessionExportDTO,
  options: BuildSessionResultsPdfOptions = {},
): Promise<Buffer> {
  const assetBaseUrl = resolveExportAssetBaseUrl();
  const localeId = options.localeId ?? 'de';
  const profile: SessionResultsPdfProfile = options.profile ?? 'visual';
  const labels = getSessionResultsReportLabelsForLocale(localeId);
  let html = buildSessionResultsReportHtml(data, labels, {
    localeId,
    assetBaseUrl,
    pageNumbersViaCss: false,
    pdfUaSafeVisuals: profile === 'pdfUa',
  });
  html = await inlineExportImagesInHtml(html, {
    readLocalAsset: readSessionExportLocalAsset,
    fetchExternal: true,
    fetchExternalImage: createPdfExternalImageLoader(),
    maxImageBytes: 400_000,
    replaceUnresolvedImages: true,
    maxImages: PDF_MAX_REPORT_IMAGES,
  });
  html = await inlineTrustedReportStylesheets(html);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch(resolveChromiumLaunchOptions());
    const page = await browser.newPage();
    await page.route(/^(?:https?|file):/i, (route) => route.abort('blockedbyclient'));
    // `load` statt `networkidle`: fehlende Asset-URLs sollen den PDF-Export nicht hängen lassen.
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    const rawPdf = Buffer.from(
      await page.pdf(
        buildSessionResultsPlaywrightPdfOptions(
          labels,
          {
            quizName: data.quizName,
            sessionCode: data.sessionCode,
          },
          profile,
        ),
      ),
    );
    const documentTitle = `${labels.documentTitle} — ${data.quizName}`;
    const stamped = await stampQuestionContinuationsOnPdf(
      new Uint8Array(rawPdf),
      buildQuestionContinuationStamps(data, labels),
      { documentTitle, localeId, claimPdfUa: profile === 'pdfUa' },
    );
    return Buffer.from(stamped);
  } finally {
    await browser?.close();
  }
}
