#!/usr/bin/env node
/**
 * Epic #405 — Teilnehmer-Nutzerszenario (mehrtägige Q&A-Session).
 *
 * Prüft:
 * - Join mit eigenem Nickname in eine konfigurierte Q&A-Session
 * - Frage senden im offenen Kanal
 * - Host sieht die Frage live
 * - Host-Sortierung Meist unterstützt, Beste Fragen und Umstritten
 * - Favoritenfilter „Nur hervorgehobene“
 * - Q&A-Wortwolke mit Größe nach Stimmen, besten Fragen und Kontroverse
 * - Nach Sessionende ist der Teilnehmer-Schreibpfad geschlossen
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 *     npm run smoke:epic-405-participant-qa -w @arsnova/frontend
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';
import { configureQaSessionIfNeeded } from '../../../scripts/load/lib/configure-qa-if-needed.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://localhost:3000/trpc').replace(/\/+$/, '');
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 430, height: 932 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const HOST_BROWSER_CAPABILITY_PREFIX = 'arsnova-host-browser-capability';
const HOST_RECOVERY_CARD_PREFIX = 'arsnova-host-recovery-card';
const PARTICIPANT_NAME = 'Epic405TN';
const QUESTION_TEXT = 'Können wir die Q&A-Frist noch einmal erklären?';
const RANKED_QUESTIONS = {
  top: 'Bitte die Klausurtermine fuer den Sommer noch einmal nennen.',
  best: 'Bitte die Hausaufgabenfrist fuer den Sommer noch einmal nennen.',
  controversial: 'Bitte die Kontroversenregel fuer den Sommer noch einmal nennen.',
};
const VOTER_COUNT = 9;

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

function createTrpcClient(hostToken, participantCapability) {
  const headers = {
    ...(hostToken ? { 'x-host-token': hostToken } : {}),
    ...(participantCapability ? { 'x-participant-capability': participantCapability } : {}),
  };
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: Object.keys(headers).length > 0 ? () => headers : undefined,
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
    title: `Epic 405 Participant Smoke ${Date.now()}`,
    moderationMode: false,
    qaModerationMode: false,
    quickFeedbackEnabled: false,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
  const hostTrpc = createTrpcClient(created.hostToken);
  await configureQaSessionIfNeeded(hostTrpc, created.code, {
    qaTitle: 'Epic 405 Teilnehmer-Smoke',
  });
  return { created, hostTrpc };
}

async function seedHostBrowser(context, session) {
  await context.addInitScript(
    ({ browserCapability, card, code, hostToken, prefixes }) => {
      globalThis.sessionStorage.setItem(`${prefixes.token}${code}`, hostToken);
      if (browserCapability) {
        globalThis.localStorage.setItem(`${prefixes.capability}-${code}`, browserCapability);
      }
      if (card) {
        globalThis.sessionStorage.setItem(`${prefixes.card}-${code}`, JSON.stringify(card));
      }
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

async function dismissRecoveryCardIfPresent(page) {
  const heading = page.getByText('Host-Zugang sichern', { exact: true }).first();
  const visible = await heading.waitFor({ state: 'visible', timeout: 8_000 }).then(
    () => true,
    () => false,
  );
  if (!visible) return;
  await page.getByRole('checkbox').check();
  await page.locator('[data-testid="host-recovery-card-done"]').click();
  await heading.waitFor({ state: 'hidden', timeout: 10_000 });
}

async function chooseJoinIdentity(page, fallbackName, timeout = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const textFields = page.locator(
      'input[type="text"], input:not([type]), input[matinput], textarea',
    );
    const count = await textFields.count();
    for (let index = 0; index < count; index += 1) {
      const field = textFields.nth(index);
      if (await field.isVisible().catch(() => false)) {
        await field.fill(fallbackName);
        return true;
      }
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function clickJoinAction(page, timeout = 15_000) {
  const startedAt = Date.now();
  const submitButton = page.locator('.join-card__submit').first();
  while (Date.now() - startedAt < timeout) {
    const visible = await submitButton.isVisible().catch(() => false);
    const enabled = visible && (await submitButton.isEnabled().catch(() => false));
    if (enabled) {
      await submitButton.click();
      return true;
    }
    await page.waitForTimeout(250);
  }
  const joinButton = page.getByRole('button', { name: /Jetzt beitreten|Mitmachen|Join now/i });
  if (
    (await joinButton.isVisible().catch(() => false)) &&
    (await joinButton.isEnabled().catch(() => false))
  ) {
    await joinButton.click();
    return true;
  }
  return false;
}

async function dismissJoinOverlay(page) {
  const overlay = page.locator('.session-host__join-viewport-overlay').first();
  if (!(await overlay.isVisible().catch(() => false))) return;
  await page.keyboard.press('Escape');
  await overlay.waitFor({ state: 'hidden', timeout: 5_000 }).catch(async () => {
    await page.locator('.session-host__join-viewport-overlay__close').click();
    await overlay.waitFor({ state: 'hidden', timeout: 5_000 });
  });
}

async function seedRankedQaBoard(hostTrpc, created) {
  const publicTrpc = createTrpcClient();
  const voters = [];
  for (let index = 0; index < VOTER_COUNT; index += 1) {
    const joined = await publicTrpc.session.join.mutate({
      code: created.code,
      nickname: `RangTN${index + 1}`,
      anonymousClientId: globalThis.crypto.randomUUID(),
      joinIdempotencyKey: globalThis.crypto.randomUUID(),
    });
    if (!joined.rejoinToken) {
      throw new Error(`Join RangTN${index + 1} lieferte keine Capability.`);
    }
    voters.push({
      ...joined,
      qaTrpc: createTrpcClient(undefined, joined.rejoinToken),
    });
  }

  const author = voters[0];
  const ballots = voters.slice(1);
  const seeded = {};
  for (const [key, text] of Object.entries(RANKED_QUESTIONS)) {
    const createdQuestion = await author.qaTrpc.qa.submit.mutate({
      sessionId: created.sessionId ?? author.id,
      participantId: author.participantId,
      text,
      idempotencyKey: globalThis.crypto.randomUUID(),
    });
    seeded[key] = createdQuestion.question;
  }

  const plan = [
    { key: 'top', ups: 6, downs: 2 },
    { key: 'best', ups: 4, downs: 0 },
    { key: 'controversial', ups: 3, downs: 3 },
  ];
  for (const { key, ups, downs } of plan) {
    const question = seeded[key];
    for (let index = 0; index < ups + downs; index += 1) {
      const voter = ballots[index];
      await voter.qaTrpc.qa.vote.mutate({
        questionId: question.id,
        participantId: voter.participantId,
        direction: index < ups ? 'UP' : 'DOWN',
      });
    }
  }

  return seeded;
}

async function qaCardTexts(page) {
  return page
    .locator('.session-qa-card')
    .evaluateAll((cards) =>
      cards.map((card) => (card.textContent ?? '').replace(/\s+/g, ' ').trim()),
    );
}

async function collectWordCloudTerms(page) {
  return page.evaluate(() => {
    const visual = [...document.querySelectorAll('.word-cloud__word')]
      .map((node) => (node.textContent ?? '').trim())
      .filter(Boolean);
    if (visual.length > 0) {
      return visual;
    }

    return [...document.querySelectorAll('.word-cloud ol.sr-only li')]
      .map((node) => (node.textContent ?? '').trim())
      .filter(Boolean);
  });
}

async function waitForWordCloudTerms(page, timeout = 45_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const labels = await collectWordCloudTerms(page);
    if (labels.length > 0) {
      return labels;
    }
    await page.waitForTimeout(400);
  }
  return [];
}

async function revealLatestQaQuestions(page) {
  const banner = page.getByRole('button', { name: /neue Fragen/i });
  if (await banner.isVisible().catch(() => false)) {
    await banner.click();
  }
}

async function selectQaSort(page, label) {
  await page
    .locator('.session-qa-sort-toggle mat-button-toggle')
    .filter({ hasText: label })
    .click();
  await page.waitForTimeout(400);
  await revealLatestQaQuestions(page);
}

async function firstQaCardContains(page, snippet) {
  const texts = await qaCardTexts(page);
  return texts[0]?.includes(snippet) === true;
}

async function seedRankedQaBoardAndAssertHostViews(page, hostTrpc, created, failures) {
  await dismissJoinOverlay(page);
  const seeded = await seedRankedQaBoard(hostTrpc, created);
  await revealLatestQaQuestions(page);
  await page.getByText(RANKED_QUESTIONS.controversial, { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });

  await selectQaSort(page, 'Meist unterstützt');
  const topOk = await firstQaCardContains(page, 'Klausurtermine');
  logStep(topOk, 'Host sortiert nach Meist unterstützt (Favorit)');
  if (!topOk) {
    failures.push(
      `Meist unterstützt zeigte nicht die Klausurfrage zuerst: ${await qaCardTexts(page)}`,
    );
  }

  await selectQaSort(page, 'Beste Fragen');
  const bestOk = await firstQaCardContains(page, 'Hausaufgabenfrist');
  logStep(bestOk, 'Host sortiert nach Beste Fragen');
  if (!bestOk) {
    failures.push(
      `Beste Fragen zeigte nicht die Hausaufgabenfrage zuerst: ${await qaCardTexts(page)}`,
    );
  }

  await selectQaSort(page, 'Umstritten');
  const controversialOk = await firstQaCardContains(page, 'Kontroversenregel');
  logStep(controversialOk, 'Host sortiert nach Umstritten');
  if (!controversialOk) {
    failures.push(
      `Umstritten zeigte nicht die Kontroversenfrage zuerst: ${await qaCardTexts(page)}`,
    );
  }

  await hostTrpc.qa.moderate.mutate({
    sessionCode: created.code,
    questionId: seeded.best.id,
    action: 'PIN',
  });
  await page.getByRole('button', { name: /Nur hervorgehobene Fragen anzeigen/i }).click();
  await page.waitForTimeout(400);
  const favoriteTexts = await qaCardTexts(page);
  const favoriteOk = favoriteTexts.length === 1 && favoriteTexts[0].includes('Hausaufgabenfrist');
  logStep(favoriteOk, 'Host filtert Favoriten (hervorgehobene Frage)');
  if (!favoriteOk) {
    failures.push(`Favoritenfilter zeigte unerwartete Karten: ${favoriteTexts.join(' | ')}`);
  }
  await page.getByRole('button', { name: /Alle Fragen anzeigen/i }).click();

  const wordCloudButton = page.getByRole('button', { name: /Wortwolke anzeigen/i });
  await wordCloudButton.waitFor({ state: 'visible', timeout: 10_000 });
  await wordCloudButton.click();
  const cloud = page.locator('mat-dialog-container app-word-cloud').first();
  await cloud.waitFor({ state: 'visible', timeout: 15_000 });
  const sizeSelect = page.getByLabel(/Größe nach Stimmen/i);
  await sizeSelect.waitFor({ state: 'visible', timeout: 10_000 });
  const questionCountPill = page
    .locator('.word-cloud__meta-pill')
    .filter({ hasText: /\d+\s+Fragen?/i });
  await questionCountPill
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);

  let firstWordLabels = [];
  for (const [value, label] of [
    ['TOP', 'Stimmen'],
    ['BEST', 'Beste Fragen'],
    ['CONTROVERSIAL', 'Kontroverse'],
  ]) {
    await sizeSelect.selectOption(value);
    const selectedReady = await page
      .waitForFunction(
        (expected) => {
          const select = document.querySelector('.qa-word-cloud-dialog__size-select');
          return select instanceof HTMLSelectElement && select.value === expected;
        },
        value,
        { timeout: 8_000 },
      )
      .then(
        () => true,
        () => false,
      );
    const resizedLabels = await waitForWordCloudTerms(page, 30_000);
    if (firstWordLabels.length === 0) {
      firstWordLabels = resizedLabels;
    }
    const ok = selectedReady && resizedLabels.length > 0;
    logStep(ok, `Wortwolke skaliert nach ${label}`);
    if (!ok) {
      failures.push(
        `Wortwolken-Größe ${value} fehlgeschlagen (selected=${selectedReady}, words=${resizedLabels.join(', ') || 'leer'}).`,
      );
    }
  }

  const questionCountVisible = await questionCountPill
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  const hasSeededTerm = firstWordLabels.some((term) =>
    /klausur|hausaufgabe|kontrovers|sommer|frist|nennen/i.test(term),
  );
  logStep(hasSeededTerm && questionCountVisible, 'Q&A-Wortwolke zeigt Begriffe');
  if (!hasSeededTerm || !questionCountVisible) {
    const cloudDiagnostics = await page.evaluate(() => ({
      empty: document.querySelector('.word-cloud__empty')?.textContent?.trim() ?? null,
      meta: [...document.querySelectorAll('.word-cloud__meta-pill')]
        .map((node) => (node.textContent ?? '').trim())
        .filter(Boolean),
      questionCount:
        [...document.querySelectorAll('.word-cloud__meta-pill')]
          .map((node) => (node.textContent ?? '').trim())
          .find((text) => /\d+\s+Fragen?/i.test(text)) ?? null,
      note: document.querySelector('.qa-word-cloud-dialog__mode-note')?.textContent?.trim() ?? null,
    }));
    failures.push(
      `Wortwolke ohne erwartete Begriffe: ${firstWordLabels.join(', ') || 'leer'} (questionCount=${questionCountVisible}, diag=${JSON.stringify(cloudDiagnostics)})`,
    );
  }

  await page.locator('.qa-word-cloud-dialog__close').click({ force: true });
  await cloud.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
}

async function waitForParticipantCount(page, expected, timeout = 15_000) {
  const locator = page.locator('.session-host__live-participants-count').first();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const value = (await locator.textContent().catch(() => '')).trim();
    if (value === String(expected)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function main() {
  if (!(await waitForServer(BASE_URL))) {
    throw new Error(`Frontend nicht erreichbar unter ${BASE_URL}.`);
  }
  if (!(await waitForServer(`${TRPC_URL}/health.check`))) {
    throw new Error(`Backend nicht erreichbar unter ${TRPC_URL}.`);
  }

  const { created, hostTrpc } = await createConfiguredQaSession();
  const browser = await launchBrowser();
  const failures = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    await seedHostBrowser(hostContext, created);
    const participantContext = await browser.newContext({ viewport: MOBILE });
    const host = await hostContext.newPage();
    const participant = await participantContext.newPage();

    await host.goto(`${BASE_URL}/session/${created.code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(host, `/session/${created.code}/host`);
    await dismissRecoveryCardIfPresent(host);
    // Nur tRPC starten — paralleler UI-Klick + mutate race't sonst LOBBY→ACTIVE
    // (getLifecycle liest noch LOBBY, startQa sieht schon ACTIVE).
    const lifecycle = await hostTrpc.session.getLifecycleForHost.query({ code: created.code });
    if (lifecycle.status === 'LOBBY') {
      await hostTrpc.session.startQa.mutate({ code: created.code });
    } else if (lifecycle.status !== 'ACTIVE') {
      throw new Error(`Unerwarteter Sessionstatus vor der Fragerunde: ${lifecycle.status}.`);
    }
    const afterStart = await hostTrpc.session.getLifecycleForHost.query({ code: created.code });
    if (afterStart.status !== 'ACTIVE') {
      throw new Error(`Fragerunde nicht ACTIVE nach startQa: ${afterStart.status}.`);
    }
    logStep(true, 'Host startet die Fragerunde');

    await participant.goto(`${BASE_URL}/join/${created.code}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await chooseJoinIdentity(participant, PARTICIPANT_NAME);
    const joined = await clickJoinAction(participant);
    if (joined) {
      await waitForPathSuffix(participant, `/session/${created.code}/vote`);
      logStep(true, 'Teilnehmer tritt der Q&A-Session bei');
    } else {
      failures.push('Join-Ansicht bot keinen nutzbaren Beitritts-CTA.');
    }

    const hostSawJoin = await waitForParticipantCount(host, 1);
    logStep(hostSawJoin, 'Host sieht den ersten Beitritt');
    if (!hostSawJoin) {
      failures.push('Host-Ansicht hat die Teilnehmerzahl nicht auf 1 aktualisiert.');
    }

    const draft = participant.locator('#qa-draft');
    await draft.waitFor({ state: 'visible', timeout: 15_000 });
    await draft.fill(QUESTION_TEXT);
    const submit = participant.locator('.session-qa-form__submit');
    await submit.waitFor({ state: 'visible', timeout: 10_000 });
    await submit.click();

    const participantSawQuestion = await participant
      .getByText(QUESTION_TEXT, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(
        () => true,
        () => false,
      );
    logStep(participantSawQuestion, 'Teilnehmer sieht die eigene Frage');
    if (!participantSawQuestion) {
      failures.push('Die gesendete Frage erschien nicht in der Teilnehmeransicht.');
    }

    const hostSawQuestion = await host
      .getByText(QUESTION_TEXT, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(
        () => true,
        () => false,
      );
    logStep(hostSawQuestion, 'Host sieht die Teilnehmerfrage');
    if (!hostSawQuestion) {
      failures.push('Die Frage erschien nicht in der Host-Ansicht.');
    }

    await seedRankedQaBoardAndAssertHostViews(host, hostTrpc, created, failures);

    await hostTrpc.session.end.mutate({ code: created.code });
    const closed = await participant
      .waitForFunction(
        () => {
          const body = document.body?.innerText ?? '';
          const draftGone = !document.querySelector('#qa-draft');
          return draftGone || /geschlossen|abgelaufen|beendet|nicht mehr möglich/i.test(body);
        },
        undefined,
        { timeout: 20_000 },
      )
      .then(
        () => true,
        () => false,
      );
    logStep(closed, 'Teilnehmer-Schreibpfad schließt nach Sessionende');
    if (!closed) {
      failures.push('Nach session.end blieb das Q&A-Formular für Teilnehmende offen.');
    }

    await participantContext.close();
    await hostContext.close();
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('\nFehlgeschlagene Teilnehmer-Prüfschritte:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`\n✓ Epic-#405-Teilnehmer-Q&A-Smoke bestanden (${created.code}).`);
}

await main().catch((error) => {
  console.error(error);
  process.exit(1);
});
