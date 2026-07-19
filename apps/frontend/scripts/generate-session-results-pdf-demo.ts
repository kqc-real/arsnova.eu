#!/usr/bin/env node
/**
 * Erzeugt PDF-Ergebnisberichte aus dem Demo-Quiz-Unterrichtsszenario (30 TN).
 *
 * Run (Backend muss laufen):
 *   npm run generate:session-pdf-demo -w @arsnova/frontend
 *
 * Optional:
 *   SESSION_CODE=ABC123 TRPC_URL=http://127.0.0.1:3000/trpc \
 *   OUTPUT=output/pdf/demo-session-results-30.pdf \
 *   PDF_PROFILE=visual|pdfUa|both \
 *   QUIZ_CONTENT_LOCALE=de|en|fr|es|it \
 *   DEMO_PDF_LOCALES=de,en,fr,es,it \
 *   npm run generate:session-pdf-demo -w @arsnova/frontend
 *
 * Standard (PDF_PROFILE=both, alle Locales): schreibt je Locale
 *   apps/frontend/src/assets/demo/demo-session-results-30.{locale}.pdf
 *   apps/frontend/src/assets/demo/demo-session-results-30.{locale}-pdfua.pdf
 * und DE-Aliase ohne Locale-Suffix (Backward-Compat / MOTD).
 *
 * Standardmäßig wird das PDF lokal per Playwright aus dem frisch gerenderten HTML
 * erzeugt (aktueller Workspace-Stand). USE_BACKEND_PDF=1 testet zusätzlich die Backend-Route.
 *
 * Ohne SESSION_CODE wird zuerst scripts/load/demo-quiz-classroom-30.mjs ausgeführt
 * (pro Locale eine eigene Session, wenn mehrere Locales erzeugt werden).
 */
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { chromium } from 'playwright';
import {
  buildSessionResultsReportHtml,
  getSessionResultsReportLabelsForLocale,
} from '../src/app/core/session-results-report.util';
import {
  inlineExportImagesInHtml,
  buildSessionResultsPlaywrightPdfOptions,
  buildQuestionContinuationStamps,
  stampQuestionContinuationsOnPdf,
  type SessionResultsReportLabels,
} from '@arsnova/session-export-report';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const FRONTEND_ASSET_ROOT = join(REPO_ROOT, 'apps/frontend/src/assets');
const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'es', 'it'] as const;
type DemoLocale = (typeof SUPPORTED_LOCALES)[number];

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
const DEMO_ASSETS_DIR = join(FRONTEND_ASSET_ROOT, 'demo');
const OUTPUT_ENV = process.env.OUTPUT ? resolve(process.env.OUTPUT) : '';
const PDF_PROFILE_RAW = String(process.env.PDF_PROFILE || 'both')
  .trim()
  .toLowerCase();
type DemoPdfProfile = 'visual' | 'pdfUa';
const PDF_PROFILES: DemoPdfProfile[] =
  PDF_PROFILE_RAW === 'visual'
    ? ['visual']
    : PDF_PROFILE_RAW === 'pdfua'
      ? ['pdfUa']
      : ['visual', 'pdfUa'];

function parseLocales(): DemoLocale[] {
  const raw = String(process.env.DEMO_PDF_LOCALES || process.env.QUIZ_CONTENT_LOCALE || '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return [...SUPPORTED_LOCALES];
  }
  const parts = raw
    .split(/[,\s]+/)
    .map((part) => part.slice(0, 2))
    .filter((part): part is DemoLocale => (SUPPORTED_LOCALES as readonly string[]).includes(part));
  if (parts.length === 0) {
    throw new Error(
      `No valid locales in DEMO_PDF_LOCALES/QUIZ_CONTENT_LOCALE=${raw}. Expected: ${SUPPORTED_LOCALES.join(', ')}`,
    );
  }
  return [...new Set(parts)];
}

function createTrpcClient(hostToken?: string) {
  return createTRPCProxyClient({
    links: [
      httpLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

async function mintHostToken(sessionCode: string): Promise<string> {
  const hostTokenEnv = String(process.env.HOST_TOKEN || '').trim();
  if (hostTokenEnv) {
    return hostTokenEnv;
  }

  const backendDir = join(REPO_ROOT, 'apps/backend');
  const script = `
    import { createHostSessionToken } from './src/lib/hostAuth.ts';
    createHostSessionToken(${JSON.stringify(sessionCode)})
      .then((token) => {
        console.log(token);
        process.exit(0);
      })
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  `;
  const { stdout } = await execFileAsync('npx', ['tsx', '-e', script], {
    cwd: backendDir,
    encoding: 'utf8',
  });
  const token = stdout.trim();
  if (!token) {
    throw new Error(`Host-Token für Session ${sessionCode} konnte nicht erzeugt werden.`);
  }
  return token;
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

async function runDemoClassroomScenario(locale: DemoLocale): Promise<string> {
  const scriptPath = join(REPO_ROOT, 'scripts/load/demo-quiz-classroom-30.mjs');
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PARTICIPANTS: String(PARTICIPANTS),
      TRPC_URL,
      QUIZ_CONTENT_LOCALE: locale,
      // PDF-Demo: lokale Runner-Last darf das p95-Smoke-Gate nicht blockieren
      VOTE_P95_LIMIT_MS: String(process.env.VOTE_P95_LIMIT_MS || 3_000),
      // Pro Locale frische Session (SESSION_CODE nur für Single-Locale-Debug)
      SESSION_CODE: '',
      HOST_TOKEN: '',
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  const jsonMatch = stdout.match(/\{[\s\S]*"code"\s*:\s*"[A-Z0-9]{6}"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Demo-Szenario (${locale}) lieferte keinen Session-Code in der Ausgabe.`);
  }
  const summary = JSON.parse(jsonMatch[0]) as { code?: string };
  if (!summary.code) {
    throw new Error(`Demo-Szenario-Summary (${locale}) ohne code-Feld.`);
  }
  return summary.code.toUpperCase();
}

async function renderLocalPlaywrightPdf(
  html: string,
  labels: SessionResultsReportLabels,
  exportData: {
    quizName: string;
    sessionCode: string;
    questions: { questionOrder: number; questionTextShort: string }[];
  },
  profile: DemoPdfProfile,
  localeId: DemoLocale,
): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const raw = await page.pdf(
      buildSessionResultsPlaywrightPdfOptions(
        labels,
        {
          quizName: exportData.quizName,
          sessionCode: exportData.sessionCode,
        },
        profile,
      ),
    );
    const documentTitle = `${labels.documentTitle} — ${exportData.quizName}`;
    const stamped = await stampQuestionContinuationsOnPdf(
      new Uint8Array(raw),
      buildQuestionContinuationStamps(exportData, labels),
      { documentTitle, localeId, claimPdfUa: profile === 'pdfUa' },
    );
    return Buffer.from(stamped);
  } finally {
    await browser.close();
  }
}

function resolveProfileOutput(profile: DemoPdfProfile, locale: DemoLocale): string {
  const suffix = profile === 'pdfUa' ? '-pdfua' : '';
  if (OUTPUT_ENV) {
    if (PDF_PROFILES.length === 1 && parseLocales().length === 1) {
      return OUTPUT_ENV.endsWith('.pdf')
        ? OUTPUT_ENV
        : join(OUTPUT_ENV, `demo-session-results-30.${locale}${suffix}.pdf`);
    }
    const base = OUTPUT_ENV.endsWith('.pdf') ? OUTPUT_ENV.replace(/\.pdf$/i, '') : OUTPUT_ENV;
    return `${base}.${locale}${suffix}.pdf`;
  }
  return join(DEMO_ASSETS_DIR, `demo-session-results-30.${locale}${suffix}.pdf`);
}

async function generateForLocale(locale: DemoLocale): Promise<{
  locale: DemoLocale;
  sessionCode: string;
  profiles: { profile: DemoPdfProfile; pdfPath: string; htmlPath: string }[];
}> {
  const code =
    parseLocales().length === 1 && SESSION_CODE
      ? SESSION_CODE
      : await runDemoClassroomScenario(locale);
  const hostToken = await mintHostToken(code);
  const client = createTrpcClient(hostToken);
  const exportData = await client.session.getExportData.query({ code });
  const labels = getSessionResultsReportLabelsForLocale(locale);
  const useBackendPdf = String(process.env.USE_BACKEND_PDF || '').trim() === '1';
  const outputs: { profile: DemoPdfProfile; pdfPath: string; htmlPath: string }[] = [];

  for (const profile of PDF_PROFILES) {
    let html = buildSessionResultsReportHtml(exportData, labels, {
      localeId: locale,
      generatedAt: new Date().toISOString(),
      assetBaseUrl: ASSET_BASE_URL,
      pageNumbersViaCss: false,
      pdfUaSafeVisuals: profile === 'pdfUa',
      quizContentLocale: locale,
      includeTeachingNotes: true,
    });

    html = await inlineExportImagesInHtml(html, {
      readLocalAsset: readDemoLocalAsset,
      fetchExternal: true,
    });

    const pdfPath = resolveProfileOutput(profile, locale);
    const htmlPath =
      pdfPath.includes('/assets/demo/') || pdfPath.includes('\\assets\\demo\\')
        ? join(
            REPO_ROOT,
            'output/pdf',
            profile === 'pdfUa'
              ? `demo-session-results-30.${locale}-pdfua.html`
              : `demo-session-results-30.${locale}.html`,
          )
        : pdfPath.replace(/\.pdf$/i, '.html');

    await mkdir(dirname(pdfPath), { recursive: true });
    await mkdir(dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, html, 'utf8');

    let pdfBuffer: Buffer;
    if (useBackendPdf) {
      try {
        const serverPdf = await client.session.getSessionExportPdf.query({
          code,
          localeId: locale,
          profile,
        });
        pdfBuffer = Buffer.from(serverPdf.contentBase64, 'base64');
      } catch (error) {
        console.warn(
          `Backend-PDF fehlgeschlagen (${locale}/${profile}), fallback auf lokales Playwright:`,
          error,
        );
        pdfBuffer = await renderLocalPlaywrightPdf(html, labels, exportData, profile, locale);
      }
    } else {
      pdfBuffer = await renderLocalPlaywrightPdf(html, labels, exportData, profile, locale);
    }
    await writeFile(pdfPath, pdfBuffer);

    // DE-Aliase ohne Suffix für bestehende MOTD-/Menü-Links
    if (locale === 'de' && !OUTPUT_ENV) {
      const alias = join(
        DEMO_ASSETS_DIR,
        profile === 'pdfUa' ? 'demo-session-results-30-pdfua.pdf' : 'demo-session-results-30.pdf',
      );
      await copyFile(pdfPath, alias);
    }

    outputs.push({ profile, pdfPath, htmlPath });
  }

  return { locale, sessionCode: code, profiles: outputs };
}

async function run() {
  const locales = parseLocales();
  const bootstrapClient = createTrpcClient();
  await waitForTrpc(bootstrapClient);

  const results = [];
  for (const locale of locales) {
    console.error(`Generating demo PDF for locale=${locale}…`);
    results.push(await generateForLocale(locale));
  }

  console.log(JSON.stringify({ locales, results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
