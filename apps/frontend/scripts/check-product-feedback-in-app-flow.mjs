#!/usr/bin/env node
/**
 * Playwright E2E: ProductFeedback Story 12.2 — In-App „arsnova.eu verbessern“.
 *
 * Deckt ab:
 *  1. Desktop-Footer auf der Startseite: Dialog öffnen, Zwei-Klick absenden
 *  2. Mobile Hilfe: Einstieg öffnen und schließen
 *  3. Zwei-Client-Session: Teilnehmende öffnen während ACTIVE, schließen,
 *     stimmen danach unverändert ab; Host bleibt steuerbar
 *  4. Immersive Host-Utility und Join-Footer
 *  5. Eigenständiges Blitzlicht (Host + Vote)
 *  6. Negativ: Presenteransicht ohne CTA
 *
 * Run (Dev):
 *   BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc \
 *     SMOKE_ARTIFACT_DIR=tmp/product-feedback-in-app-e2e \
 *     npm run smoke:product-feedback-in-app -w @arsnova/frontend
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200').replace(/\/+$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://localhost:3000/trpc').replace(/\/+$/, '');
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || 'tmp/product-feedback-in-app-e2e';
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const FEEDBACK_HOST_TOKEN_PREFIX = 'arsnova-feedback-host-token:';
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const IMPROVE_NAME =
  /arsnova\.eu verbessern|improve arsnova\.eu|améliorer arsnova\.eu|mejorar arsnova\.eu|migliorare arsnova\.eu/i;
const DONE_NAME = /Fertig|Done|Terminer|Listo|Fine|Fatto/i;
const REVEAL_RESULTS_NAME =
  /Ergebnis zeigen|Show results|Afficher le résultat|Mostrar resultado|Mostra risultato/i;

const QUIZ_PAYLOAD = {
  name: `Product Feedback In-App E2E ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  enableSoundEffects: false,
  enableRewardEffects: false,
  enableMotivationMessages: false,
  enableEmojiReactions: false,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: 'AUTO',
  teamNames: [],
  backgroundMusic: null,
  nicknameTheme: 'NOBEL_LAUREATES',
  bonusTokenCount: 1,
  readingPhaseEnabled: false,
  preset: 'SERIOUS',
  questions: [
    {
      text: 'In-App-E2E: Was ist 3+1?',
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false },
      ],
    },
  ],
};

function logStep(label, detail = '') {
  console.log(`OK ${label}${detail ? ` — ${detail}` : ''}`);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function createPublicTrpc() {
  return createTRPCProxyClient({
    links: [httpBatchLink({ url: TRPC_URL })],
  });
}

function createHostTrpc(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: () => ({ 'x-host-token': hostToken }),
      }),
    ],
  });
}

async function waitForServer(url, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
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

async function shot(page, name) {
  const path = join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`SHOT ${path}`);
  return path;
}

async function injectHostToken(page, code, hostToken, prefix = HOST_TOKEN_STORAGE_PREFIX) {
  await page.addInitScript(
    ({ sessionCode, token, storagePrefix }) => {
      globalThis.sessionStorage.setItem(`${storagePrefix}${sessionCode}`, token);
    },
    { sessionCode: code, token: hostToken, storagePrefix: prefix },
  );
}

async function dismissMotdIfPresent(page) {
  const close = page
    .locator(
      '.home-motd-sheet button[aria-label*="Schließen"], .home-motd-sheet button[aria-label*="Close"], .home-motd-sheet__close, button.home-motd-sheet__close-btn',
    )
    .first();
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => undefined);
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Escape').catch(() => undefined);
}

async function closeHostJoinOverlay(page) {
  const closeButton = page
    .locator(
      '.session-host__join-viewport-overlay__close, .feedback-host__join-viewport-overlay__close',
    )
    .first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(300);
  }
  // Fallback: Escape closes presentation overlays
  const overlay = page
    .locator('.session-host__join-viewport-overlay, .feedback-host__join-viewport-overlay')
    .first();
  if (await overlay.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

function improveButton(page) {
  return page.getByRole('button', { name: IMPROVE_NAME });
}

function dialog(page) {
  return page
    .locator(
      '[data-testid="product-feedback-in-app-dialog"], section.product-feedback-in-app-dialog__surface',
    )
    .first();
}

async function openImprove(page, { viaFooter = false } = {}) {
  const trigger = viaFooter
    ? page.locator('button.app-footer__feedback-action')
    : improveButton(page);
  await trigger.first().waitFor({ state: 'visible', timeout: 20_000 });
  await trigger.first().click();
  await dialog(page).waitFor({ state: 'visible', timeout: 15_000 });
  const icon = dialog(page).locator('.product-feedback-in-app-dialog__brand-icon');
  ensure(
    (await icon.textContent())?.trim() === 'insights',
    'In-App-Dialog-Icon ist nicht insights',
  );
}

async function closeDialog(page) {
  const surface = dialog(page);
  if (!(await surface.isVisible().catch(() => false))) return;
  await surface.locator('.product-feedback-in-app-dialog__close').click();
  await surface.waitFor({ state: 'hidden', timeout: 10_000 });
}

async function completeTwoClick(page, shotPrefix) {
  const surface = dialog(page);
  await surface.waitFor({ state: 'visible', timeout: 10_000 });
  await shot(page, `${shotPrefix}-01-kind`);
  const choices = surface.locator('button.product-feedback-in-app-dialog__choice');
  await choices.first().click();
  await surface
    .locator('button.product-feedback-in-app-dialog__choice--area')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await shot(page, `${shotPrefix}-02-area`);
  await surface.locator('button.product-feedback-in-app-dialog__choice--area').first().click();
  await surface
    .getByRole('button', { name: DONE_NAME })
    .waitFor({ state: 'visible', timeout: 20_000 });
  await shot(page, `${shotPrefix}-03-saved`);
  await surface.getByRole('button', { name: DONE_NAME }).click();
  await surface.waitFor({ state: 'hidden', timeout: 15_000 });
  logStep(shotPrefix, 'Zwei-Klick gespeichert');
}

async function ensureNoImproveCta(page, label) {
  const count = await improveButton(page).count();
  ensure(count === 0, `${label}: „arsnova.eu verbessern“ darf nicht sichtbar sein (${count})`);
  const footerUtility = await page.locator('button.app-footer__feedback-action').count();
  ensure(footerUtility === 0, `${label}: Footer-Utility darf nicht sichtbar sein`);
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log(`Artefakte: ${ARTIFACT_DIR}`);

  ensure(await waitForServer(BASE_URL), `Frontend nicht erreichbar: ${BASE_URL}`);
  ensure(
    await waitForServer(`${TRPC_URL.replace(/\/trpc$/, '')}/health`).catch(() =>
      waitForServer(TRPC_URL),
    ),
    `Backend nicht erreichbar: ${TRPC_URL}`,
  );

  const publicTrpc = createPublicTrpc();
  const browser = await launchBrowser();

  try {
    // ── 1) Desktop-Footer Startseite ───────────────────────────────────────
    const homeContext = await browser.newContext({ viewport: DESKTOP });
    const homePage = await homeContext.newPage();
    await homePage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await homePage.waitForTimeout(800);
    await dismissMotdIfPresent(homePage);
    await openImprove(homePage, { viaFooter: true });
    ensure(
      (await homePage.locator('footer.app-footer .app-footer__primary').count()) === 3,
      'Footer muss genau drei primäre Navigationsziele behalten',
    );
    await completeTwoClick(homePage, '01-footer-home');
    await homeContext.close();
    logStep('Desktop-Footer', 'Startseite Zwei-Klick');

    // ── 2) Mobile Hilfe ────────────────────────────────────────────────────
    const helpContext = await browser.newContext({ viewport: MOBILE });
    const helpPage = await helpContext.newPage();
    await helpPage.goto(`${BASE_URL}/help`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await helpPage.waitForTimeout(600);
    await openImprove(helpPage);
    await shot(helpPage, '02-help-mobile-open');
    await closeDialog(helpPage);
    await helpContext.close();
    logStep('Mobile Hilfe', 'Dialog geöffnet und geschlossen');

    // ── 3) Zwei-Client aktive Session + Host/Join/Presenter ───────────────
    const { quizId } = await publicTrpc.quiz.upload.mutate(QUIZ_PAYLOAD);
    const created = await publicTrpc.session.create.mutate({
      quizId,
      type: 'QUIZ',
      qaEnabled: false,
      quickFeedbackEnabled: false,
    });
    const code = String(created.code).toUpperCase();
    const hostToken = created.hostToken;
    ensure(code.length >= 4, 'session.create ohne Code');
    ensure(typeof hostToken === 'string' && hostToken.length > 10, 'session.create ohne hostToken');
    const hostTrpc = createHostTrpc(hostToken);
    logStep('Session', code);

    const hostContext = await browser.newContext({ viewport: DESKTOP });
    const hostPage = await hostContext.newPage();
    await injectHostToken(hostPage, code, hostToken);
    await hostPage.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await hostPage.waitForTimeout(1000);
    await closeHostJoinOverlay(hostPage);

    // Immersive Host-Utility ist Pflicht für Story 12.2 (kein Footer-Fallback)
    const immersiveUtility = hostPage.locator('.session-host__product-feedback-utility');
    await immersiveUtility.waitFor({ state: 'visible', timeout: 20_000 });
    await immersiveUtility.getByRole('button', { name: IMPROVE_NAME }).click();
    await dialog(hostPage).waitFor({ state: 'visible', timeout: 15_000 });
    const immersiveIcon = dialog(hostPage).locator('.product-feedback-in-app-dialog__brand-icon');
    ensure(
      (await immersiveIcon.textContent())?.trim() === 'insights',
      'In-App-Dialog-Icon ist nicht insights',
    );
    await shot(hostPage, '03-host-immersive-open');
    await closeDialog(hostPage);
    logStep('Host-Utility', 'immersiv sichtbar und geklickt');

    const joinContext = await browser.newContext({ viewport: DESKTOP });
    const joinPage = await joinContext.newPage();
    await joinPage.goto(`${BASE_URL}/join/${code}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await joinPage.waitForTimeout(500);
    await openImprove(joinPage, { viaFooter: true });
    await shot(joinPage, '04-join-footer-open');
    await closeDialog(joinPage);
    await joinContext.close();
    logStep('Join-Footer', 'CTA erreichbar');

    const voteContext = await browser.newContext({ viewport: DESKTOP });
    const votePage = await voteContext.newPage();
    await votePage.goto(`${BASE_URL}/join/${code}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await votePage.locator('input[matinput]').fill('InAppE2E');
    await votePage.locator('.join-card__submit').click();
    await votePage.waitForURL(new RegExp(`/session/${code}/vote`), { timeout: 20_000 });

    await hostTrpc.session.nextQuestion.mutate({ code });
    await votePage.locator('#vote-option-0').waitFor({ state: 'visible', timeout: 20_000 });

    // Während ACTIVE: Dialog öffnen, schließen, danach abstimmen
    await openImprove(votePage, { viaFooter: true });
    await shot(votePage, '05-vote-active-open');
    ensure(
      (await dialog(votePage).locator('.product-feedback-in-app-dialog__session-note').count()) >
        0 || (await dialog(votePage).innerText()).length > 0,
      'In-App-Dialog während aktiver Session ohne Inhalt',
    );
    await closeDialog(votePage);
    ensure(
      await votePage.locator('#vote-option-0').isVisible(),
      'Vote-Option nach Dialog-Schließen nicht mehr sichtbar',
    );

    const voteResponse = votePage.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/vote.submit'),
      { timeout: 20_000 },
    );
    await votePage.locator('#vote-option-0').click();
    await votePage.locator('#vote-submit').click();
    const response = await voteResponse;
    ensure(
      response.ok(),
      `Vote-Submit nach In-App-Dialog mit HTTP ${response.status()} abgewiesen`,
    );
    logStep('Zwei-Client ACTIVE', 'Dialog geschlossen und Vote erfolgreich');

    // Hoststeuerung bleibt intakt: Reveal über UI-Button, DOM zeigt Ergebnisse
    const revealButton = hostPage.getByRole('button', { name: REVEAL_RESULTS_NAME }).first();
    await revealButton.waitFor({ state: 'visible', timeout: 20_000 });
    await revealButton.click();
    const hostShowsResults = await hostPage
      .getByText(/Ergebnisse|Results|Résultats|Resultados|Risultati|100\s*%/i)
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    ensure(hostShowsResults, 'Host-UI zeigt nach Reveal keine Ergebnisse');
    ensure(!hostPage.isClosed(), 'Host-Seite nach Reveal unerwartet geschlossen');
    await shot(hostPage, '06-host-after-vote');
    logStep('Hoststeuerung', 'Reveal-Button bedienbar, Ergebnisse sichtbar');

    // Presenter ohne CTA
    const presentContext = await browser.newContext({ viewport: DESKTOP });
    const presentPage = await presentContext.newPage();
    await injectHostToken(presentPage, code, hostToken);
    await presentPage.goto(`${BASE_URL}/session/${code}/present`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await presentPage.waitForTimeout(800);
    await ensureNoImproveCta(presentPage, 'Presenter');
    await shot(presentPage, '07-presenter-no-cta');
    await presentContext.close();
    logStep('Presenter', 'kein Produktfeedback-CTA');

    await hostContext.close();
    await voteContext.close();

    // ── 4) Eigenständiges Blitzlicht ───────────────────────────────────────
    const blitz = await publicTrpc.quickFeedback.create.mutate({ type: 'MOOD' });
    const blitzCode = String(blitz.sessionCode).toUpperCase();
    const blitzHostToken = blitz.hostToken;
    ensure(blitzCode.length >= 4, 'quickFeedback.create ohne Code');
    ensure(
      typeof blitzHostToken === 'string' && blitzHostToken.length > 10,
      'ohne Feedback-Host-Token',
    );

    const blitzHostContext = await browser.newContext({ viewport: DESKTOP });
    const blitzHostPage = await blitzHostContext.newPage();
    await injectHostToken(blitzHostPage, blitzCode, blitzHostToken, FEEDBACK_HOST_TOKEN_PREFIX);
    await blitzHostPage.goto(`${BASE_URL}/feedback/${blitzCode}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await blitzHostPage.waitForTimeout(800);
    await closeHostJoinOverlay(blitzHostPage);
    await openImprove(blitzHostPage);
    await shot(blitzHostPage, '08-blitzlicht-host-open');
    await closeDialog(blitzHostPage);
    await blitzHostContext.close();
    logStep('Blitzlicht-Host', 'Utility erreichbar');

    const blitzVoteContext = await browser.newContext({ viewport: DESKTOP });
    const blitzVotePage = await blitzVoteContext.newPage();
    await blitzVotePage.goto(`${BASE_URL}/feedback/${blitzCode}/vote`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await blitzVotePage.waitForTimeout(800);
    await openImprove(blitzVotePage);
    await shot(blitzVotePage, '09-blitzlicht-vote-open');
    await closeDialog(blitzVotePage);
    await blitzVoteContext.close();
    logStep('Blitzlicht-Vote', 'Utility erreichbar');

    console.log('\nProductFeedback In-App E2E bestanden.');
    console.log(`Screenshots: ${ARTIFACT_DIR}`);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
