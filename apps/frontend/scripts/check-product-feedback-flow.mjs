#!/usr/bin/env node
/**
 * Playwright E2E: ProductFeedback Story 12.1 — Host (Home-Sheet) + Vote (Session-Ende).
 *
 * Ablauf:
 *  1. Quiz/Session anlegen, 3 Teilnehmende joinen und abstimmen (Stichprobe ≥1)
 *  2. Session über die Host-UI beenden und zur Startseite zurückkehren → Home-Sheet
 *  3. Deterministisch gewählte:r Teilnehmende:r sieht die Karte am Session-Ende
 *  4. Beide Rollen: Zwei-Klick → Schreiben → Freitext-Screenshots → Senden
 *     Screenshots unterwegs (inkl. leeres/gefülltes Textfeld)
 *
 * Run (Dev):
 *   BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc \
 *     SMOKE_ARTIFACT_DIR=tmp/product-feedback-e2e \
 *     npm run smoke:product-feedback -w @arsnova/frontend
 */
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200').replace(/\/+$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://localhost:3000/trpc').replace(/\/+$/, '');
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || 'tmp/product-feedback-e2e';
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const DESKTOP = { width: 1280, height: 900 };
const SAMPLE_RATE = 0.1;
const SAMPLE_MAX = 25;
const SAMPLE_MIN_ELIGIBLE = 3;

const QUIZ_PAYLOAD = {
  name: `Product Feedback E2E ${Date.now()}`,
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
      text: 'Product-Feedback-E2E: Was ist 2+2?',
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

/** Spiegel der Backend-Stichprobe — kein claimInvite vor der UI (würde den Slot verbrauchen). */
function sampleParticipantIds(sessionId, eligibleIds) {
  const sorted = [...eligibleIds].sort();
  if (sorted.length === 0) return [];
  const scored = sorted.map((id) => ({
    id,
    score: createHash('sha256').update(`${sessionId}|${id}`, 'utf8').digest('hex'),
  }));
  scored.sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0));
  let n = Math.floor(sorted.length * SAMPLE_RATE);
  if (sorted.length >= SAMPLE_MIN_ELIGIBLE && n < 1) n = 1;
  n = Math.min(SAMPLE_MAX, n, sorted.length);
  return scored.slice(0, n).map((s) => s.id);
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

async function injectHostToken(page, code, hostToken) {
  await page.addInitScript(
    ({ sessionCode, token, prefix }) => {
      globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
    },
    { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
  );
}

async function shot(page, name) {
  const path = join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`SHOT ${path}`);
  return path;
}

async function dismissMotdIfPresent(page) {
  const close = page
    .locator(
      '.home-motd-sheet button[aria-label*="Schließen"], .home-motd-sheet button[aria-label*="Close"], .home-motd-sheet__close, button.home-motd-sheet__close-btn',
    )
    .first();
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape').catch(() => undefined);
}

async function closeHostJoinOverlay(host) {
  const closeButton = host.locator('.session-host__join-viewport-overlay__close').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

async function bodySnippet(page, max = 900) {
  const text = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  return text.slice(0, max);
}

async function completeProductFeedbackCard(page, shotPrefix, { withMessage = false } = {}) {
  const card = page.locator('[data-testid="product-feedback-card"]');
  await card.waitFor({ state: 'visible', timeout: 25_000 });
  ensure(
    (await card.locator('#product-feedback-heading').count()) > 0,
    'ProductFeedback-Überschrift fehlt',
  );
  const priorViewport = page.viewportSize() ?? DESKTOP;
  await page.setViewportSize({ width: 320, height: 800 });
  const layout = await card.evaluate((element) => {
    const buttons = [...element.querySelectorAll('button')];
    const documentElement = element.ownerDocument.documentElement;
    return {
      fitsViewport: documentElement.scrollWidth <= documentElement.clientWidth,
      targetsLargeEnough: buttons.every((button) => {
        const touchTarget = button.querySelector('.mat-mdc-button-touch-target');
        const rect = (touchTarget ?? button).getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44;
      }),
    };
  });
  ensure(layout.fitsViewport, `${shotPrefix}: horizontaler Overflow bei 320 px`);
  ensure(layout.targetsLargeEnough, `${shotPrefix}: Touch-Ziel kleiner als 44×44 px`);
  await shot(page, `${shotPrefix}-00-primary-320`);
  await page.setViewportSize(priorViewport);
  await shot(page, `${shotPrefix}-01-primary`);

  const primaryChoices = card.locator('button.product-feedback-card__choice');
  await primaryChoices.first().waitFor({ state: 'visible', timeout: 10_000 });
  await primaryChoices.first().click();
  await page.waitForTimeout(350);
  await shot(page, `${shotPrefix}-02-area`);

  const areaChoices = card.locator('button.product-feedback-card__choice');
  await areaChoices.first().waitFor({ state: 'visible', timeout: 10_000 });
  await areaChoices.first().click();

  await card
    .getByText(
      /Möchtest du noch etwas ergänzen|Would you like to add anything|Souhaites-tu ajouter|Quieres añadir|Vuoi aggiungere/i,
    )
    .waitFor({ state: 'visible', timeout: 20_000 });
  await shot(page, `${shotPrefix}-03-thanks`);

  if (withMessage) {
    await card
      .getByRole('button', {
        name: /Ergänzung hinzufügen|Add details|Ajouter un complément|Añadir información adicional|Aggiungi dettagli/i,
      })
      .click();
    await card.locator('#product-feedback-message').waitFor({ state: 'visible', timeout: 10_000 });
    await shot(page, `${shotPrefix}-04-message-empty`);
    await card.locator('#product-feedback-message').fill('Kurzer Test-Hinweis für den Screenshot.');
    await page.waitForTimeout(200);
    await shot(page, `${shotPrefix}-05-message-filled`);
    await card
      .getByRole('button', {
        name: /Ergänzung senden|Send details|Envoyer le complément|Enviar información adicional|Invia dettagli/i,
      })
      .click();
    await page.waitForTimeout(900);
    await shot(page, `${shotPrefix}-06-after-message`);
    logStep(`${shotPrefix} Zwei-Klick + Freitext abgeschlossen`);
    return;
  }

  const doneBtn = card.getByRole('button', {
    name: /Fertig|Done|Terminer|Listo|Fine/i,
  });
  await doneBtn.click();
  await page.waitForTimeout(700);
  await shot(page, `${shotPrefix}-04-after-done`);
  logStep(`${shotPrefix} Zwei-Klick abgeschlossen`);
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

  const browser = await launchBrowser();
  const hostContext = await browser.newContext({ viewport: DESKTOP });
  const hostPage = await hostContext.newPage();
  const participants = [];
  for (let i = 0; i < 3; i += 1) {
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await context.newPage();
    const nickname = `PfE2E${i + 1}`;
    await page.goto(`${BASE_URL}/join/${code}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.locator('input[matinput]').fill(nickname);
    await page.locator('.join-card__submit').click();
    await page.waitForURL(new RegExp(`/session/${code}/vote`), { timeout: 20_000 });
    const joinedState = await page.evaluate(
      (sessionCode) => ({
        participantId: globalThis.localStorage.getItem(`arsnova-participant-${sessionCode}`),
        productFeedbackClaimToken: globalThis.localStorage.getItem(
          `productFeedback:participantClaim:v1:${sessionCode}`,
        ),
      }),
      code,
    );
    ensure(joinedState.participantId, `UI-Join ${i} ohne participantId`);
    ensure(
      joinedState.productFeedbackClaimToken,
      `UI-Join ${i} ohne ProductFeedback-Besitznachweis`,
    );
    participants.push({
      participantId: joinedState.participantId,
      productFeedbackClaimToken: joinedState.productFeedbackClaimToken,
      nickname,
      context,
      page,
    });
  }
  const sessionInfo = await publicTrpc.session.getInfo.query({ code });
  const sessionId = sessionInfo.id;
  logStep('UI-Joins', `${participants.length} getrennte Browser-Kontexte`);

  const sampledIds = sampleParticipantIds(
    sessionId,
    participants.map((p) => p.participantId),
  );
  ensure(sampledIds.length >= 1, 'Stichprobe lieferte keine Teilnehmer-ID');
  const invitedParticipant =
    participants.find((p) => p.participantId === sampledIds[0]) ?? participants[0];
  logStep('Stichprobe', invitedParticipant.nickname);

  const votePage = invitedParticipant.page;

  try {
    await injectHostToken(hostPage, code, hostToken);
    await hostPage.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await hostPage.waitForTimeout(1200);
    await closeHostJoinOverlay(hostPage);
    await shot(hostPage, '00-host-lobby');

    await hostTrpc.session.nextQuestion.mutate({ code });
    const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
    ensure(question?.id && question.answers?.[0]?.id, 'Frage nach nextQuestion fehlt');

    for (const participant of participants) {
      await participant.page.locator('#vote-option-0').waitFor({
        state: 'visible',
        timeout: 20_000,
      });
      await participant.page.locator('#vote-option-0').click();
      const voteResponse = participant.page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && response.url().includes('/vote.submit'),
        { timeout: 20_000 },
      );
      await participant.page.locator('#vote-submit').click();
      const response = await voteResponse;
      ensure(response.ok(), `Vote-Submit wurde mit HTTP ${response.status()} abgewiesen.`);
    }
    logStep('UI-Votes', '3 Antworten in getrennten Browser-Kontexten abgegeben');
    await shot(hostPage, '01-host-after-votes');

    await hostPage.getByRole('button', { name: /Session beenden|End session/i }).click();
    await hostPage.getByRole('button', { name: /Trotzdem verlassen|Leave anyway/i }).click();
    await hostPage.getByRole('button', { name: /Zur Startseite|Back to home/i }).waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    ensure(
      (await hostPage.locator('[data-testid="product-feedback-card"]').count()) === 0,
      'ProductFeedback darf nicht im Hostresultat erscheinen',
    );
    logStep('UI-Sessionende', 'FINISHED + Invites');
    await shot(hostPage, '01b-host-after-api-end');

    await hostPage.getByRole('button', { name: /Zur Startseite|Back to home/i }).click();
    await hostPage.waitForURL(new RegExp(`${BASE_URL}/?$`), { timeout: 20_000 });
    await hostPage.waitForTimeout(1500);
    await dismissMotdIfPresent(hostPage);
    await shot(hostPage, '02-host-home-after-end');

    const hostCard = hostPage.locator(
      '.home-product-feedback-sheet [data-testid="product-feedback-card"], [data-testid="product-feedback-card"]',
    );
    await hostCard.waitFor({ state: 'visible', timeout: 25_000 }).catch(async () => {
      throw new Error(
        `Host ProductFeedback-Sheet fehlt nach Sessionende.\n${await bodySnippet(hostPage)}`,
      );
    });
    logStep('Host-Sheet', 'ProductFeedback sichtbar');
    await completeProductFeedbackCard(hostPage, 'host', { withMessage: true });

    await votePage.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await votePage.waitForTimeout(2000);
    await shot(votePage, '10-vote-session-end');

    // SessionFeedback (4.8) hat Vorrang — Produktfrage erscheint erst danach.
    const sessionFeedbackCard = votePage.locator('.vote-feedback-card--session-end-gate');
    if (await sessionFeedbackCard.isVisible().catch(() => false)) {
      const stars = sessionFeedbackCard.locator('.vote-feedback-card__star');
      if ((await stars.count()) >= 2) {
        await stars.nth(0).click();
        await stars
          .nth(5)
          .click()
          .catch(() => undefined);
      }
      const yesRepeat = sessionFeedbackCard.getByRole('button', {
        name: /Ja, klar|thumb_up|Yes/i,
      });
      if (
        await yesRepeat
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await yesRepeat.first().click();
      }
      const submitFeedback = sessionFeedbackCard.locator('.vote-feedback-card__submit');
      await submitFeedback.click();
      await votePage.waitForTimeout(1200);
    }

    const voteCard = votePage.locator('[data-testid="product-feedback-card"]');
    await voteCard.waitFor({ state: 'visible', timeout: 25_000 }).catch(async () => {
      throw new Error(
        `Vote ProductFeedback-Karte fehlt am Session-Ende.\n${await bodySnippet(votePage)}`,
      );
    });
    logStep('Vote-Karte', 'ProductFeedback inline sichtbar');
    await completeProductFeedbackCard(votePage, 'vote', { withMessage: true });

    const exportData = await hostTrpc.session.getExportData.query({ code });
    const exportJson = JSON.stringify(exportData);
    ensure(
      !/productFeedback|followUpCapability|inviteFingerprint/i.test(exportJson),
      'ProductFeedback ist im Sessionexport enthalten',
    );
    logStep('Export-Abgrenzung', 'keine ProductFeedback-Felder im Sessionexport');

    const continueHome = votePage.getByRole('button', {
      name: /Zur Startseite|Back to home|Accueil|Inicio/i,
    });
    await continueHome.first().waitFor({ state: 'visible', timeout: 10_000 });
    await shot(votePage, '11-vote-home-still-available');
    logStep('Navigation', 'Zur Startseite weiterhin sichtbar');

    console.log('\nProductFeedback E2E bestanden.');
    console.log(`Screenshots: ${ARTIFACT_DIR}`);
  } catch (err) {
    await shot(hostPage, 'failure-host').catch(() => undefined);
    await shot(votePage, 'failure-vote').catch(() => undefined);
    throw err;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
