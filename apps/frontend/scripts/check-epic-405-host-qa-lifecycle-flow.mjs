#!/usr/bin/env node
/**
 * Epic #405 — Host-Nutzerszenario (mehrtägige Q&A-Session).
 *
 * Prüft:
 * - Q&A-Start zeigt die Host-Zugangskarte
 * - Zugang für Teilnehmende sitzt in der Q&A-Action-Bar
 * - Self-Service-Wiederherstellung mit Session-Kennung und Recovery-Code
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 *     npm run smoke:epic-405-host-qa-lifecycle -w @arsnova/frontend
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';
import { configureQaSessionIfNeeded } from '../../../scripts/load/lib/configure-qa-if-needed.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://localhost:3000/trpc').replace(/\/+$/, '');
const DESKTOP = { width: 1440, height: 1000 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const HOST_BROWSER_CAPABILITY_PREFIX = 'arsnova-host-browser-capability';
const HOST_RECOVERY_CARD_PREFIX = 'arsnova-host-recovery-card';

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

function createTrpcClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

async function waitForServer(url, maxAttempts = 30) {
  for (let index = 0; index < maxAttempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // App noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return webkit.launch({ headless: true });
  }
}

async function waitForPathSuffix(page, suffix, timeout = 30_000) {
  await page.waitForFunction(
    (expectedSuffix) => globalThis.location.pathname.endsWith(expectedSuffix),
    suffix,
    { timeout },
  );
}

async function createConfiguredQaSession() {
  const publicTrpc = createTrpcClient();
  const created = await publicTrpc.session.create.mutate({
    type: 'Q_AND_A',
    title: `Epic 405 Host Smoke ${Date.now()}`,
    moderationMode: false,
    qaModerationMode: false,
    quickFeedbackEnabled: false,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
  if (!created.hostBrowserCapability || !created.hostRecoveryCard?.supportId) {
    throw new Error('session.create lieferte keine Host-Zugangskarte.');
  }
  const hostTrpc = createTrpcClient(created.hostToken);
  await configureQaSessionIfNeeded(hostTrpc, created.code, {
    qaTitle: 'Epic 405 Host-Smoke',
  });
  return created;
}

async function seedHostBrowser(context, session) {
  await context.addInitScript(
    ({ browserCapability, card, code, hostToken, prefixes }) => {
      globalThis.sessionStorage.setItem(`${prefixes.token}${code}`, hostToken);
      globalThis.localStorage.setItem(`${prefixes.capability}-${code}`, browserCapability);
      globalThis.sessionStorage.setItem(`${prefixes.card}-${code}`, JSON.stringify(card));
    },
    {
      browserCapability: session.hostBrowserCapability,
      card: session.hostRecoveryCard,
      code: session.code,
      hostToken: session.hostToken,
      prefixes: {
        token: HOST_TOKEN_STORAGE_PREFIX,
        capability: HOST_BROWSER_CAPABILITY_PREFIX,
        card: HOST_RECOVERY_CARD_PREFIX,
      },
    },
  );
}

async function dismissRecoveryCard(page) {
  const heading = page.getByText('Host-Zugang sichern', { exact: true }).first();
  const done = page.locator('[data-testid="host-recovery-card-done"]');
  await heading.waitFor({ state: 'visible', timeout: 20_000 });
  const supportVisible = await page.getByText(sessionSupportIdPattern()).first().isVisible();
  await page.getByRole('checkbox').check();
  await done.click();
  await heading.waitFor({ state: 'hidden', timeout: 10_000 });
  return supportVisible;
}

function sessionSupportIdPattern() {
  return /ARS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/;
}

async function dismissJoinOverlay(page) {
  const overlay = page.locator('.session-host__join-viewport-overlay').first();
  const appeared = await overlay
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;
  await page.locator('.session-host__join-viewport-overlay__close').click();
  await overlay.waitFor({ state: 'hidden', timeout: 5_000 });
}

async function main() {
  if (!(await waitForServer(BASE_URL))) {
    throw new Error(`Frontend nicht erreichbar unter ${BASE_URL}.`);
  }
  if (!(await waitForServer(`${TRPC_URL}/health.check`))) {
    throw new Error(`Backend nicht erreichbar unter ${TRPC_URL}.`);
  }

  const session = await createConfiguredQaSession();
  const browser = await launchBrowser();
  const failures = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    await seedHostBrowser(hostContext, session);
    const host = await hostContext.newPage();
    await host.goto(`${BASE_URL}/session/${session.code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(host, `/session/${session.code}/host`);

    const cardOk = await dismissRecoveryCard(host).catch((error) => {
      failures.push(`Host-Zugangskarte: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    });
    logStep(cardOk, 'Host sichert die Zugangskarte nach Q&A-Start');
    if (!cardOk && failures.length === 0) {
      failures.push('Zugangskarte zeigte keine Session-Kennung.');
    }

    await dismissJoinOverlay(host).catch((error) => {
      failures.push(`Beitritts-Overlay: ${error instanceof Error ? error.message : String(error)}`);
    });

    const qaSettings = host.getByRole('button', { name: /Q&A-Einstellungen/i });
    const settingsOk = await qaSettings.isVisible().catch(() => false);
    logStep(settingsOk, 'Q&A-Kanal zeigt Q&A-Einstellungen');
    if (!settingsOk) {
      failures.push('Q&A ohne »Q&A-Einstellungen«.');
    }

    if (settingsOk) {
      try {
        await qaSettings.click();
        const dialog = host.locator('mat-dialog-container').filter({ hasText: /Fragerunde/i });
        await dialog.waitFor({ state: 'visible', timeout: 10_000 });
        await host.getByRole('button', { name: /Abbrechen/i }).click();
        await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
        logStep(true, 'Host öffnet die Q&A-Einstellungen');
      } catch (error) {
        failures.push(
          `Q&A-Einstellungen-Dialog: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await hostContext.close();

    const recoveryContext = await browser.newContext({ viewport: DESKTOP });
    const recovery = await recoveryContext.newPage();
    await recovery.goto(`${BASE_URL}/host-recovery`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await recovery.getByLabel(/Session-Kennung/i).fill(session.hostRecoveryCard.supportId);
    await recovery
      .getByLabel(/Wiederherstellungscode/i)
      .fill(session.hostRecoveryCard.recoveryCode);
    await recovery.locator('[data-testid="host-recovery-continue"]').click();
    await recovery.locator('[data-testid="host-recovery-activate"]').waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    await recovery.getByRole('checkbox').check();
    await recovery.locator('[data-testid="host-recovery-activate"]').click();
    await recovery.locator('[data-testid="host-recovery-open-session"]').waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    await recovery.locator('[data-testid="host-recovery-open-session"]').click();
    const recovered = await waitForPathSuffix(recovery, `/session/${session.code}/host`, 20_000)
      .then(() => true)
      .catch(() => false);
    const liveCount = recovery.locator('.session-host__live-participants-count').first();
    const liveReady = recovered
      ? await liveCount.waitFor({ state: 'visible', timeout: 15_000 }).then(
          () => true,
          () => false,
        )
      : false;
    logStep(liveReady, 'Host stellt den Zugang über die Zugangskarte wieder her');
    if (!liveReady) {
      const bodyText = (
        (await recovery
          .locator('body')
          .innerText()
          .catch(() => '')) || ''
      ).slice(0, 400);
      failures.push(`Wiederherstellung landete nicht in der Host-Ansicht. DOM: ${bodyText}`);
    }

    await recoveryContext.close();
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('\nFehlgeschlagene Host-Prüfschritte:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`\n✓ Epic-#405-Host-Q&A-Lifecycle-Smoke bestanden (${session.code}).`);
}

await main().catch((error) => {
  console.error(error);
  process.exit(1);
});
