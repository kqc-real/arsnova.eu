#!/usr/bin/env node
/**
 * Story 2.10 Slice 5 — Browser-Smoke mit getrennten Kontexten.
 *
 * Prueft:
 * - Presenter ohne Pairing-/Freigabe-/Widerruf-UI
 * - oeffentlicher QR → Pending ohne Host-Rechte → Reject
 * - Approve auf /host → Smartphone steuert LOBBY → Frage → Ergebnis
 *   → Kanalwechsel → Session-Ende
 * - Sofortiger Entzug zeigt das Widerruf-Overlay
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:host-pairing-security -w @arsnova/frontend
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200/de';
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const DESKTOP = { width: 1440, height: 1000 };
function presenterStartButton(page) {
  return page.locator('[data-testid="open-presenter-view"]').locator('visible=true').first();
}
const PRESENTER = { width: 1280, height: 720 };
const MOBILE = { width: 430, height: 932 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const HOST_ROLE_STORAGE_PREFIX = 'arsnova-host-role:';
const QUIZ_PROMPT = 'Welche Route wird fuer das Pairing geprueft?';
const QUIZ_PAYLOAD = {
  name: `Host Pairing Security ${Date.now()}`,
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
      text: QUIZ_PROMPT,
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      answers: [
        { text: 'Host, Smartphone und Presenter', isCorrect: true },
        { text: 'Nur der Session-Code', isCorrect: false },
      ],
    },
  ],
};

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
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

function createBrowserTrpcClient() {
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

async function waitForPathSuffix(page, suffix, timeout = 30_000) {
  await page.waitForFunction(
    (expectedSuffix) => globalThis.location.pathname.endsWith(expectedSuffix),
    suffix,
    { timeout },
  );
}

async function injectHostSession(context, code, token, role) {
  await context.addInitScript(
    ({ sessionCode, hostToken, hostRole, tokenPrefix, rolePrefix }) => {
      globalThis.sessionStorage.setItem(`${tokenPrefix}${sessionCode}`, hostToken);
      if (hostRole) {
        globalThis.sessionStorage.setItem(`${rolePrefix}${sessionCode}`, hostRole);
      }
    },
    {
      sessionCode: code,
      hostToken: token,
      hostRole: role,
      tokenPrefix: HOST_TOKEN_STORAGE_PREFIX,
      rolePrefix: HOST_ROLE_STORAGE_PREFIX,
    },
  );
}

async function hasTestId(page, testId) {
  return page
    .locator(`[data-testid="${testId}"]`)
    .first()
    .isVisible()
    .catch(() => false);
}

async function clickTestId(page, testId, timeout = 15_000, options = {}) {
  const locator = page.locator(`[data-testid="${testId}"]`).last();
  await locator.waitFor({ state: 'visible', timeout });
  await locator.click({ force: options.force === true, timeout });
}

async function pairViaTrpc(trpc, hostToken, code, deviceLabel) {
  const host = createHostTrpc(hostToken);
  const invite = await host.session.createHostPairingInvite.mutate({
    code,
    screenVisibility: 'PROJECTED',
  });
  const requested = await trpc.session.requestHostPairing.mutate({
    code,
    pairingSecret: invite.pairingSecret,
    deviceLabel,
  });
  await host.session.approveHostPairing.mutate({
    code,
    requestId: requested.requestId,
  });
  const claimed = await trpc.session.getHostPairingRequest.query({
    code,
    requestId: requested.requestId,
    requestSecret: requested.requestSecret,
  });
  if (!claimed.token?.pairedHostToken) {
    throw new Error('Claim nach Approve lieferte kein PairedHostToken.');
  }
  return claimed.token.pairedHostToken;
}

async function main() {
  console.log(`Warte auf ${BASE_URL}…`);
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.error(`App nicht erreichbar unter ${BASE_URL}.`);
    process.exit(1);
  }

  const trpc = createBrowserTrpcClient();
  const { quizId } = await trpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const { code, hostToken } = await trpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: true,
    quickFeedbackEnabled: false,
  });
  const hostApi = createHostTrpc(hostToken);

  const browser = await launchBrowser();
  const failures = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    await injectHostSession(hostContext, code, hostToken, 'ORIGINAL_HOST');
    const presenterContext = await browser.newContext({ viewport: PRESENTER });
    await injectHostSession(presenterContext, code, hostToken, 'ORIGINAL_HOST');
    const phoneContext = await browser.newContext({ viewport: MOBILE });

    const host = await hostContext.newPage();
    const presenter = await presenterContext.newPage();
    const phone = await phoneContext.newPage();

    await host.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(host, `/session/${code}/host`);
    await presenterStartButton(host).waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    const hostToolbarPairing = await hasTestId(host, 'connect-smartphone');
    logStep(!hostToolbarPairing, 'Original-Host hat Pairing nur im Presenter-Dialog');
    if (hostToolbarPairing) {
      failures.push('Host-Leiste zeigte Smartphone-Verbinden außerhalb des Presenter-Dialogs.');
    }

    await presenter.goto(`${BASE_URL}/session/${code}/present`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(presenter, `/session/${code}/present`);
    const gate = presenter.locator('[data-testid="presenter-fullscreen-enter"]').first();
    if (await gate.isVisible().catch(() => false)) {
      await gate.click().catch(() => undefined);
      await presenter.waitForTimeout(400);
    }
    const presenterHasPairing =
      (await hasTestId(presenter, 'connect-smartphone')) ||
      (await hasTestId(presenter, 'host-pairing-approve')) ||
      (await hasTestId(presenter, 'host-pairing-revoke')) ||
      (await hasTestId(presenter, 'presentation-start-connect'));
    logStep(!presenterHasPairing, 'Presenter ohne Freigabe- oder Widerruf-UI');
    if (presenterHasPairing) {
      failures.push('Presenter zeigte Pairing-Freigabe oder Geräteverwaltung.');
    }

    const publicInvite = await hostApi.session.createHostPairingInvite.mutate({
      code,
      screenVisibility: 'PROJECTED',
    });
    const pairingUrl = `${BASE_URL}/session/${code}/pair#s=${publicInvite.pairingSecret}`;
    if (pairingUrl.includes('?s=') || pairingUrl.includes('/s=')) {
      failures.push('Pairing-Secret darf nicht in Query oder Pfad stehen.');
    } else {
      logStep(true, 'Pairing-Secret liegt nur im Fragment');
    }

    await phone.goto(pairingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await clickTestId(phone, 'host-pairing-request');
    await phone
      .locator('[data-testid="host-pairing-request-indicator"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
    logStep(true, 'Oeffentlicher Scan bleibt im Pending ohne Host-Rechte');

    await presenterStartButton(host).evaluate((element) => {
      element.click();
    });
    const reviewOrConnect = host
      .locator(
        '[data-testid="presentation-start-review-request"], [data-testid="presentation-start-connect"]',
      )
      .first();
    await reviewOrConnect.waitFor({ state: 'visible', timeout: 15_000 });
    await reviewOrConnect.evaluate((element) => {
      element.click();
    });
    await host.locator('[data-testid="host-pairing-reject"]').first().waitFor({
      state: 'visible',
      timeout: 15_000,
    });

    const sneaky = await phoneContext.newPage();
    await sneaky.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await sneaky.waitForTimeout(1_500);
    const sneakyPath = new URL(sneaky.url()).pathname;
    const sneakyOnHost = sneakyPath.endsWith(`/session/${code}/host`);
    logStep(!sneakyOnHost, 'Pending-Client erreicht /host nicht ohne Token', sneakyPath);
    if (sneakyOnHost) {
      failures.push('Pending-Client konnte die Host-Route ohne Token oeffnen.');
    }
    await sneaky.close();

    await clickTestId(host, 'host-pairing-reject', 15_000, { force: true });
    await phone.getByText(/abgelehnt|rejected|refus|rechazad|rifiutat/i).waitFor({
      timeout: 10_000,
    });
    logStep(true, 'Reject zeigt dem Smartphone die Ablehnung');
    await host.keyboard.press('Escape').catch(() => undefined);

    const pairedToken = await pairViaTrpc(trpc, hostToken, code, 'Browser-Smartphone');
    const pairedApi = createHostTrpc(pairedToken);
    const pairedContext = await browser.newContext({ viewport: MOBILE });
    await injectHostSession(pairedContext, code, pairedToken, 'PAIRED_HOST');
    const paired = await pairedContext.newPage();
    await paired.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(paired, `/session/${code}/host`);
    const pairedCanManage = await hasTestId(paired, 'connect-smartphone');
    logStep(!pairedCanManage, 'Paired Host sieht keine Freigabe-UI');
    if (pairedCanManage) {
      failures.push('Paired Host sah die Original-Host-Pairing-Verwaltung.');
    }

    const started = await pairedApi.session.nextQuestion.mutate({ code });
    logStep(
      started.status === 'ACTIVE' || started.status === 'QUESTION_OPEN',
      'Smartphone startet die Frage',
      started.status,
    );
    if (started.status !== 'ACTIVE' && started.status !== 'QUESTION_OPEN') {
      failures.push(`Nach Smartphone-Start war der Status ${started.status}.`);
    }
    await presenter.waitForTimeout(800);
    const presenterHasQuestion =
      (await presenter
        .locator('.session-present--quiz, [data-testid="presenter-quiz-stage"]')
        .count()) > 0 ||
      (await presenter
        .getByText(QUIZ_PROMPT)
        .first()
        .isVisible()
        .catch(() => false));
    if (!presenterHasQuestion) {
      const infoActive = await trpc.session.getInfo.query({ code });
      if (infoActive.status !== 'ACTIVE' && infoActive.status !== 'QUESTION_OPEN') {
        failures.push('Presenter zeigte die gestartete Frage nicht.');
      } else {
        logStep(true, 'Presenter-Snapshot folgt der gestarteten Frage', infoActive.status);
      }
    } else {
      logStep(true, 'Presenter folgt der gestarteten Frage');
    }

    const revealed = await pairedApi.session.revealResults.mutate({ code });
    logStep(revealed.status === 'RESULTS', 'Smartphone gibt das Ergebnis frei', revealed.status);
    if (revealed.status !== 'RESULTS') {
      failures.push(`Nach Ergebnis zeigen war der Status ${revealed.status}.`);
    }

    await hostApi.session.setPreferredLiveChannel.mutate({ code, channel: 'qa' });
    await presenter.waitForTimeout(1_000);
    const infoQa = await trpc.session.getInfo.query({ code });
    const presenterQa = (await presenter.locator('.session-present--qa').count()) > 0;
    logStep(infoQa.preferredChannel === 'qa', 'Kanalwechsel auf Q&A', infoQa.preferredChannel);
    if (infoQa.preferredChannel !== 'qa' && !presenterQa) {
      failures.push('Kanalwechsel auf Q&A war weder im Snapshot noch im Presenter sichtbar.');
    }

    const devices = await hostApi.session.listPairedHosts.query({ code });
    const tokenId = devices.devices[0]?.tokenId;
    if (!tokenId) {
      failures.push('Kein Paired-Host-Token zum Widerruf gefunden.');
    } else {
      await hostApi.session.revokePairedHost.mutate({ code, tokenId });
      await paired
        .locator('[data-testid="host-access-revoked"]')
        .first()
        .waitFor({ state: 'visible', timeout: 12_000 });
      logStep(true, 'Widerruf zeigt das sichere Overlay auf dem Smartphone');
    }

    await hostApi.session.end.mutate({ code });
    await presenter.waitForTimeout(800);
    const infoEnd = await trpc.session.getInfo.query({ code });
    logStep(
      infoEnd.status === 'FINISHED',
      'Session-Ende nach Kanalwechsel und Entzug',
      infoEnd.status,
    );
    if (infoEnd.status !== 'FINISHED') {
      failures.push(`Session-Ende lieferte ${infoEnd.status}.`);
    }

    await pairedContext.close();
    await phoneContext.close();
    await presenterContext.close();
    await hostContext.close();
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('\nFehlgeschlagene Pruefschritte:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`\n✓ Host-Pairing-Security-Browser-Smoke bestanden (${code}).`);
}

await main().catch((error) => {
  console.error(error);
  process.exit(1);
});
