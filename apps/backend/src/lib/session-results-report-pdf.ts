import { existsSync } from 'node:fs';
import { chromium, type Browser, type LaunchOptions } from 'playwright';
import type { SessionExportDTO } from '@arsnova/shared-types';
import {
  buildSessionResultsReportHtml,
  buildSessionResultsPdfFilename,
  buildSessionResultsPlaywrightPdfOptions,
  buildQuestionContinuationStamps,
  getSessionResultsReportLabelsForLocale,
  inlineExportImagesInHtml,
  stampQuestionContinuationsOnPdf,
} from '@arsnova/session-export-report';
import { readSessionExportLocalAsset } from './session-export-asset-reader';

export { buildSessionResultsPdfFilename };

export interface BuildSessionResultsPdfOptions {
  localeId?: string;
}

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

export async function buildSessionResultsPdf(
  data: SessionExportDTO,
  options: BuildSessionResultsPdfOptions = {},
): Promise<Buffer> {
  const assetBaseUrl = resolveExportAssetBaseUrl();
  const localeId = options.localeId ?? 'de';
  const labels = getSessionResultsReportLabelsForLocale(localeId);
  let html = buildSessionResultsReportHtml(data, labels, {
    localeId,
    assetBaseUrl,
    pageNumbersViaCss: false,
  });
  html = await inlineExportImagesInHtml(html, {
    readLocalAsset: readSessionExportLocalAsset,
    fetchExternal: true,
    maxImageBytes: 400_000,
  });

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch(resolveChromiumLaunchOptions());
    const page = await browser.newPage();
    // `load` statt `networkidle`: fehlende Asset-URLs sollen den PDF-Export nicht hängen lassen.
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    const rawPdf = Buffer.from(
      await page.pdf(
        buildSessionResultsPlaywrightPdfOptions(labels, {
          quizName: data.quizName,
          sessionCode: data.sessionCode,
        }),
      ),
    );
    const stamped = await stampQuestionContinuationsOnPdf(
      new Uint8Array(rawPdf),
      buildQuestionContinuationStamps(data, labels),
    );
    return Buffer.from(stamped);
  } finally {
    await browser?.close();
  }
}
