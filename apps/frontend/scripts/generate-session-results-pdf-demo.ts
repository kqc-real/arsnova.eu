#!/usr/bin/env node
/**
 * Erzeugt einen PDF-Ergebnisbericht aus dem Demo-Quiz-Unterrichtsszenario (30 TN).
 *
 * Run (Backend muss laufen):
 *   npm run generate:session-pdf-demo -w @arsnova/frontend
 *
 * Optional:
 *   SESSION_CODE=ABC123 TRPC_URL=http://127.0.0.1:3000/trpc \
 *   OUTPUT=output/pdf/demo-session-results-30.pdf \
 *   npm run generate:session-pdf-demo -w @arsnova/frontend
 *
 * Ohne SESSION_CODE wird zuerst scripts/load/demo-quiz-classroom-30.mjs ausgeführt.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { chromium } from 'playwright';
import { buildSessionResultsPdfFilename } from '../src/app/core/export-filename.util';
import {
  buildSessionResultsReportHtml,
  getDefaultSessionResultsReportLabelsDe,
} from '../src/app/core/session-results-report.util';
import {
  inlineExportImagesInHtml,
  buildSessionResultsPlaywrightPdfOptions,
} from '@arsnova/session-export-report';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const FRONTEND_ASSET_ROOT = join(REPO_ROOT, 'apps/frontend/src/assets');

async function readDemoLocalAsset(relativePath: string): Promise<Uint8Array | null> {
  try {
    const data = await readFile(join(FRONTEND_ASSET_ROOT, relativePath));
    return new Uint8Array(data);
  } catch {
    return null;
  }
}
const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const ASSET_BASE_URL = String(
  process.env.SESSION_EXPORT_ASSET_BASE_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    'http://127.0.0.1:4200',
).replace(/\/$/, '');
const SESSION_CODE = String(process.env.SESSION_CODE || '')
  .trim()
  .toUpperCase();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const OUTPUT = resolve(
  process.env.OUTPUT || join(REPO_ROOT, 'output/pdf/demo-session-results-30.pdf'),
);

function createTrpcClient() {
  return createTRPCProxyClient({
    links: [httpLink({ url: TRPC_URL })],
  });
}

async function waitForTrpc(client: ReturnType<typeof createTrpcClient>, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await client.health.check.query();
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    }
  }
  throw new Error(`tRPC ist nicht erreichbar: ${TRPC_URL}`);
}

async function runDemoClassroomScenario(): Promise<string> {
  const scriptPath = join(REPO_ROOT, 'scripts/load/demo-quiz-classroom-30.mjs');
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PARTICIPANTS: String(PARTICIPANTS),
      TRPC_URL,
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  const jsonMatch = stdout.match(/\{[\s\S]*"code"\s*:\s*"[A-Z0-9]{6}"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Demo-Szenario lieferte keinen Session-Code in der Ausgabe.');
  }
  const summary = JSON.parse(jsonMatch[0]) as { code?: string };
  if (!summary.code) {
    throw new Error('Demo-Szenario-Summary ohne code-Feld.');
  }
  return summary.code.toUpperCase();
}

async function run() {
  const client = createTrpcClient();
  await waitForTrpc(client);

  const code = SESSION_CODE || (await runDemoClassroomScenario());
  const exportData = await client.session.getSessionExportData.query({ code });
  const labels = getDefaultSessionResultsReportLabelsDe();
  let html = buildSessionResultsReportHtml(exportData, labels, {
    localeId: 'de',
    generatedAt: new Date().toISOString(),
    assetBaseUrl: ASSET_BASE_URL,
    pageNumbersViaCss: false,
  });

  html = await inlineExportImagesInHtml(html, {
    readLocalAsset: readDemoLocalAsset,
    fetchExternal: true,
  });

  const pdfPath = OUTPUT.endsWith('.pdf')
    ? OUTPUT
    : join(OUTPUT, buildSessionResultsPdfFilename(exportData.quizName, exportData.sessionCode));
  const htmlPath = pdfPath.replace(/\.pdf$/i, '.html');

  await mkdir(dirname(pdfPath), { recursive: true });
  await writeFile(htmlPath, html, 'utf8');

  let pdfBuffer: Buffer;
  try {
    const serverPdf = await client.session.getSessionExportPdf.query({ code });
    pdfBuffer = Buffer.from(serverPdf.contentBase64, 'base64');
  } catch {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      pdfBuffer = await page.pdf(
        buildSessionResultsPlaywrightPdfOptions(labels, {
          quizName: exportData.quizName,
          sessionCode: exportData.sessionCode,
        }),
      );
    } finally {
      await browser.close();
    }
  }
  await writeFile(pdfPath, pdfBuffer);

  console.log(
    JSON.stringify(
      {
        sessionCode: code,
        participantCount: exportData.participantCount,
        questionCount: exportData.questions.length,
        hasConfidenceSummary: Boolean(exportData.confidenceSummary),
        pdfPath,
        htmlPath,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
