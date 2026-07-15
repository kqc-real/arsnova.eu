import { chromium } from 'playwright';
import type { SessionExportDTO } from '@arsnova/shared-types';
import {
  buildSessionResultsReportHtml,
  buildSessionResultsPdfFilename,
  buildSessionResultsPlaywrightPdfOptions,
  getSessionResultsReportLabelsForLocale,
  inlineExportImagesInHtml,
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
    'http://127.0.0.1:4200'
  ).replace(/\/$/, '');
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
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    return Buffer.from(
      await page.pdf(
        buildSessionResultsPlaywrightPdfOptions(labels, {
          quizName: data.quizName,
          sessionCode: data.sessionCode,
        }),
      ),
    );
  } finally {
    await browser.close();
  }
}
