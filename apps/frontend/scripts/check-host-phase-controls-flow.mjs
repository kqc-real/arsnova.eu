#!/usr/bin/env node
/**
 * Slice 3 (#470): real Quiz host phases, labeled utilities, reflow and menu focus.
 * Requires a localized frontend and a local backend with PostgreSQL/Redis.
 * Contexts run sequentially; participant votes use the shared tRPC contract.
 * No PDF worker is needed: this checks export entry points, not PDF generation.
 *
 * BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 *   SMOKE_ARTIFACT_DIR=/tmp/host-phase-controls \
 *   npm run smoke:host-phase-controls -w @arsnova/frontend
 */
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { QuizUploadInputSchema, SubmitVoteInputSchema } from '@arsnova/shared-types';
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de')
  .replace(/\/+$/, '')
  .replace(/\/(de|en|fr|es|it)$/, '');
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const ARTIFACT_DIR =
  process.env.SMOKE_ARTIFACT_DIR || join('tmp', 'host-phase-controls', randomUUID());
const PRIMARY = '.session-host__exit-anchor-button--primary';
const MORE = '[data-testid="host-more-actions"]';
// Pairwise sample, deliberately not a full cartesian product.
const CASES = [
  { locale: 'de', preset: 'PLAYFUL', width: 320, theme: 'light', discussion: true },
  { locale: 'de', preset: 'SERIOUS', width: 1440, theme: 'dark', discussion: true },
  { locale: 'en', preset: 'SERIOUS', width: 600, theme: 'light' },
  { locale: 'fr', preset: 'PLAYFUL', width: 840, theme: 'dark' },
  { locale: 'es', preset: 'SERIOUS', width: 320, theme: 'dark' },
  { locale: 'it', preset: 'PLAYFUL', width: 1440, theme: 'light' },
];
const LABELS = {
  de: [
    'Antwortphase starten',
    'Zur Gesamtauswertung',
    'Vollbild',
    'App-Rahmen',
    'Weitere Aktionen',
  ],
  en: [
    'Start accepting answers',
    'To the overall results',
    'Full screen',
    'App frame',
    'More actions',
  ],
  fr: [
    'Lancer la phase de réponse',
    'Vers le bilan',
    'Plein écran',
    'Cadre de l’application',
    'Autres actions',
  ],
  es: [
    'Iniciar la fase de respuesta',
    'Ir al resumen general',
    'Pantalla completa',
    'Marco de la aplicación',
    'Más acciones',
  ],
  it: [
    'Avvia la fase di risposta',
    'Vai alla sintesi',
    'Schermo intero',
    'Cornice dell’app',
    'Altre azioni',
  ],
};

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function client(headers = {}) {
  return createTRPCProxyClient({
    links: [httpBatchLink({ url: TRPC_URL, headers: () => headers })],
  });
}

function quizPayload(preset) {
  return QuizUploadInputSchema.parse({
    name: `Host Phase Controls ${preset} ${Date.now()}`,
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
    backgroundMusic: null,
    nicknameTheme: 'NOBEL_LAUREATES',
    readingPhaseEnabled: true,
    preset,
    questions: [
      {
        text: 'Welche Handlung passt zur aktuellen Quiz-Phase?',
        type: 'SINGLE_CHOICE',
        confidenceEnabled: true,
        difficulty: 'EASY',
        order: 0,
        timer: null,
        answers: [
          { text: 'Den nächsten fachlichen Schritt wählen', isCorrect: true },
          { text: 'Die gesamte Session sofort beenden', isCorrect: false },
        ],
      },
    ],
  });
}

async function waitForStatus(hostApi, code, status) {
  const deadline = Date.now() + 20_000;
  do {
    const info = await hostApi.session.getInfo.query({ code });
    if (info.status === status) return info;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new Error(`Session did not reach ${status}.`);
}

async function expectFocus(page, selector) {
  try {
    await page.waitForFunction(
      (target) => document.activeElement === document.querySelector(target),
      selector,
    );
  } catch {
    const active = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      label: document.activeElement?.getAttribute('aria-label'),
      testId: document.activeElement?.getAttribute('data-testid'),
      text: document.activeElement?.textContent?.trim().slice(0, 100),
    }));
    throw new Error(`Focus did not return to ${selector}: ${JSON.stringify(active)}`);
  }
}

async function expectLabel(locator, text) {
  await locator.filter({ hasText: text }).waitFor({ state: 'visible' });
  const actual = await locator.evaluate((button) => {
    const copy = button.cloneNode(true);
    copy.querySelectorAll('mat-icon, app-presenter-icon').forEach((icon) => icon.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  });
  ensure(actual === text, `Expected full label "${text}", got "${actual}".`);
}

async function checkLayout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const failures = await page.evaluate(() => {
    const failures = [];
    const tolerance = 2;
    if (
      Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) >
      innerWidth + tolerance
    ) {
      failures.push('horizontal document overflow');
    }
    const controls = [
      ...document.querySelectorAll(
        '.session-host__exit-anchor button, .session-host__quiz-tools button, ' +
          '[data-testid="lobby-start-session"], .session-host__export-actions button',
      ),
    ].filter((element) => element.getClientRects().length > 0);
    for (const button of controls) {
      const bounds = button.getBoundingClientRect();
      const name = button.textContent.trim().replace(/\s+/g, ' ');
      if (bounds.left < -tolerance || bounds.right > innerWidth + tolerance) {
        failures.push(`control outside horizontal viewport: ${name}`);
      }
      if (bounds.width < 24 || bounds.height < 24) failures.push(`small target: ${name}`);
      // Inspect rendered text ranges so wrapping is allowed but clipping is not.
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (
          !node.textContent.trim() ||
          node.parentElement.closest('mat-icon, svg, app-presenter-icon')
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (
            rect.width &&
            rect.height &&
            (rect.left < bounds.left - tolerance ||
              rect.right > bounds.right + tolerance ||
              rect.top < bounds.top - tolerance ||
              rect.bottom > bounds.bottom + tolerance)
          )
            failures.push(`clipped label: ${name}`);
        }
      }
    }
    const footer = controls.filter((button) => button.closest('.session-host__exit-anchor'));
    for (let i = 0; i < footer.length; i += 1) {
      const a = footer[i].getBoundingClientRect();
      for (const other of footer.slice(i + 1)) {
        const b = other.getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance
        ) {
          failures.push('overlapping footer controls');
        }
      }
    }
    const more = document.querySelector('[data-testid="host-more-actions"]');
    const primary = document.querySelector('.session-host__exit-anchor-button--primary');
    if (
      primary &&
      more &&
      !(primary.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING)
    ) {
      failures.push('more actions precede the phase action in DOM order');
    }
    return failures;
  });
  ensure(failures.length === 0, `${label}: ${failures.join('; ')}`);
}

async function checkUtilities(page, sample) {
  const [, , fullscreen, frame, more] = LABELS[sample.locale];
  await page.locator('.session-host__quiz-tools').waitFor();
  await expectLabel(page.locator('.session-host__view-toggle--frame'), frame);
  const fullscreenButton = page.locator('.session-host__view-toggle--fullscreen');
  if (await fullscreenButton.isVisible()) await expectLabel(fullscreenButton, fullscreen);
  await expectLabel(page.locator(MORE), more);
  ensure(
    await page
      .locator('.session-host__sound-tools .session-host__live-sound-control .mdc-button__label')
      .innerText(),
    'Sound control has no visible label.',
  );
  const presenter = page.getByTestId('open-presenter-view');
  ensure(
    (await presenter.count()) === (sample.width >= 600 ? 1 : 0),
    'Unexpected presenter entry count.',
  );
  if (sample.width >= 600) {
    ensure(
      await presenter
        .locator('..')
        .evaluate((parent) => parent.classList.contains('session-host__view-controls--labeled')),
      'Presenter is outside the display utilities.',
    );
  }
  const state = await page.evaluate(() => ({
    locale: document.documentElement.lang,
    dark: document.documentElement.classList.contains('dark'),
    playful: document.documentElement.classList.contains('preset-playful'),
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    afterContent: !!(
      document
        .querySelector('.session-host__channel-stage')
        ?.compareDocumentPosition(document.querySelector('.session-host__quiz-tools')) &
      Node.DOCUMENT_POSITION_FOLLOWING
    ),
  }));
  ensure(state.locale.startsWith(sample.locale), `Wrong localized build: ${state.locale}.`);
  ensure(
    state.dark === (sample.theme === 'dark') && state.playful === (sample.preset === 'PLAYFUL'),
    'Theme/preset not applied.',
  );
  ensure(state.reduced && state.afterContent, 'Reduced motion or utility DOM order is incorrect.');
}

async function checkMenuFocus(page, cancelEndDialog) {
  const more = page.locator(MORE);
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await menu.waitFor();
  await page.waitForFunction(() =>
    document.querySelector('[role="menu"]')?.contains(document.activeElement),
  );
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  await expectFocus(page, MORE);
  if (!cancelEndDialog) return;
  await page.keyboard.press('Enter');
  await menu.waitFor();
  await page.waitForFunction(() =>
    document.querySelector('[role="menu"]')?.contains(document.activeElement),
  );
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  const dialog = page.locator('mat-dialog-container');
  await dialog.waitFor();
  await page.waitForFunction(() =>
    document.querySelector('mat-dialog-container')?.contains(document.activeElement),
  );
  const cancel = dialog.getByRole('button', { name: 'Abbrechen', exact: true });
  await cancel.focus();
  await page.keyboard.press('Enter');
  await dialog.waitFor({ state: 'hidden' });
  await expectFocus(page, MORE);
}

async function voteRound(publicApi, code, participants, round, discussion) {
  const question = await publicApi.session.getCurrentQuestionForStudent.query({ code });
  ensure(question?.answers?.length === 2, 'Expected two public answer options.');
  for (let index = 0; index < participants.length; index += 1) {
    const participant = participants[index];
    // Respect the shared-IP vote throttle, also across the two rounds.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const answerText =
      discussion && round === 1 && index === 1
        ? 'Die gesamte Session sofort beenden'
        : 'Den nächsten fachlichen Schritt wählen';
    const answer = question.answers.find((option) => option.text === answerText);
    ensure(answer, 'Public answer option missing.');
    await client({ 'x-participant-capability': participant.rejoinToken }).vote.submit.mutate(
      SubmitVoteInputSchema.parse({
        sessionId: participant.id,
        participantId: participant.participantId,
        questionId: question.id,
        answerIds: [answer.id],
        confidenceValue: 3,
        round,
      }),
    );
  }
}

async function runCase(browser, publicApi, quizId, sample) {
  const name = `${sample.locale}-${sample.preset.toLowerCase()}-${sample.width}-${sample.theme}`;
  const { code, hostToken } = await publicApi.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  const hostApi = client({ 'x-host-token': hostToken });
  let context;
  let page;
  try {
    const participants = [];
    for (let index = 0; index < (sample.discussion ? 2 : 1); index += 1) {
      participants.push(
        await publicApi.session.join.mutate({
          code,
          nickname: `PhaseTester${index + 1}`,
          anonymousClientId: globalThis.crypto.randomUUID(),
          joinIdempotencyKey: globalThis.crypto.randomUUID(),
        }),
      );
    }
    context = await browser.newContext({
      viewport: { width: sample.width, height: 1000 },
      colorScheme: sample.theme,
      reducedMotion: 'reduce',
      locale: sample.locale,
    });
    await context.addInitScript(
      ({ code, hostToken, sample }) => {
        sessionStorage.setItem(`arsnova-host-token:${code}`, hostToken);
        localStorage.setItem('home-theme', sample.theme);
        localStorage.setItem(
          'home-preset',
          sample.preset === 'PLAYFUL' ? 'spielerisch' : 'serious',
        );
      },
      { code, hostToken, sample },
    );
    page = await context.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(`${BASE_URL}/${sample.locale}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
    });
    const start = page.getByTestId('lobby-start-session');
    await start.waitFor();
    const closeJoin = page.locator('.session-host__join-viewport-overlay__close');
    // Lobby entry and the later QR result each request the initial join overlay.
    // Wait for the rendered QR before dismissing it and moving focus elsewhere.
    await page.locator('.session-host__join-menu-qr').waitFor({ state: 'visible' });
    await closeJoin.click();
    await closeJoin.waitFor({ state: 'hidden' });
    await expectFocus(page, '[aria-controls="session-host-join-info"]');
    await waitForStatus(hostApi, code, 'LOBBY');
    ensure(
      (await page.locator(PRIMARY).count()) === 0,
      'Lobby duplicates its start action in the footer.',
    );
    await checkUtilities(page, sample);
    await checkLayout(page, `${name} LOBBY`);
    if (await closeJoin.isVisible()) await closeJoin.click();
    await checkMenuFocus(page, sample.locale === 'de');
    await waitForStatus(hostApi, code, 'LOBBY');
    await page.screenshot({ path: join(ARTIFACT_DIR, `${name}-lobby.png`), fullPage: true });

    if (await closeJoin.isVisible()) await closeJoin.click();
    await start.click();
    await waitForStatus(hostApi, code, 'QUESTION_OPEN');
    await expectLabel(page.locator(PRIMARY), LABELS[sample.locale][0]);
    await checkLayout(page, `${name} QUESTION_OPEN`);
    await page.locator(PRIMARY).click();
    await waitForStatus(hostApi, code, 'ACTIVE');
    await voteRound(publicApi, code, participants, 1, sample.discussion);
    if (sample.discussion) {
      const discussion = page.getByRole('button', {
        name: 'Diskussionsphase starten – Austausch vor zweiter Abstimmung',
        exact: true,
      });
      await discussion.waitFor();
      await checkLayout(page, `${name} ACTIVE PI`);
      await discussion.click();
      await waitForStatus(hostApi, code, 'DISCUSSION');
      await expectLabel(page.locator(PRIMARY), 'Zweite Abstimmung');
      await checkLayout(page, `${name} DISCUSSION`);
      await page.screenshot({ path: join(ARTIFACT_DIR, `${name}-discussion.png`), fullPage: true });
      await page.locator(PRIMARY).click();
      await waitForStatus(hostApi, code, 'ACTIVE');
      const question = await hostApi.session.getCurrentQuestionForHost.query({ code });
      ensure(question.currentRound === 2, 'Second vote round did not start.');
      await voteRound(publicApi, code, participants, 2, false);
    }
    await page
      .locator('.session-host__exit-anchor-button--reveal-options')
      .waitFor({ state: 'hidden' });
    await checkLayout(page, `${name} ACTIVE`);
    await page.screenshot({ path: join(ARTIFACT_DIR, `${name}-active.png`), fullPage: true });
    await page.locator(PRIMARY).click();
    await waitForStatus(hostApi, code, 'RESULTS');
    await expectLabel(page.locator(PRIMARY), LABELS[sample.locale][1]);
    await checkLayout(page, `${name} RESULTS`);
    await page.locator(PRIMARY).click();
    await waitForStatus(hostApi, code, 'FINISHED');
    await page.locator('#session-finished-heading').waitFor();
    await page.locator('.session-host__export-pdf-btn').waitFor();
    await page.locator('.session-host__leaderboard-card').first().waitFor();
    ensure(
      await page
        .locator('#host-session-finished-card')
        .evaluate(
          (card) =>
            !!(
              card.compareDocumentPosition(
                document.querySelector('.session-host__leaderboard-card'),
              ) & Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
      'Finished actions appear after the leaderboard.',
    );
    await checkLayout(page, `${name} FINISHED`);
    const exportMore = page.locator('.session-host__export-more-btn');
    await exportMore.focus();
    await page.keyboard.press('Enter');
    const exportMenu = page.getByRole('menu');
    await exportMenu.waitFor();
    await page.waitForFunction(() =>
      document.querySelector('[role="menu"]')?.contains(document.activeElement),
    );
    ensure(
      (await exportMenu
        .getByRole('menuitem')
        .filter({ hasText: /PDF\/UA-1/ })
        .count()) === 1,
      'Accessible PDF variant missing.',
    );
    ensure(
      (await exportMenu.getByRole('menuitem').filter({ hasText: /CSV/ }).count()) >= 1,
      'CSV export missing.',
    );
    await page.keyboard.press('Escape');
    await exportMenu.waitFor({ state: 'hidden' });
    await expectFocus(page, '.session-host__export-more-btn');
    await page.screenshot({ path: join(ARTIFACT_DIR, `${name}-finished.png`), fullPage: true });
    console.log(`OK ${name}: phases, labels, reflow, keyboard focus and exports`);
  } catch (error) {
    if (page && !page.isClosed()) {
      await page
        .screenshot({ path: join(ARTIFACT_DIR, `${name}-failure.png`), fullPage: true })
        .catch(() => undefined);
    }
    throw error;
  } finally {
    // Close all live channels even when a UI assertion fails midway.
    try {
      await hostApi.session.end.mutate({ code });
    } catch (error) {
      console.error(`${name}: session cleanup failed`, error);
      process.exitCode = 1;
    } finally {
      await context?.close();
    }
  }
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const publicApi = client();
  const browser = await chromium.launch({ headless: true });
  try {
    const quizIds = new Map();
    for (const sample of CASES) {
      if (!quizIds.has(sample.preset)) {
        const { quizId } = await publicApi.quiz.upload.mutate(quizPayload(sample.preset));
        quizIds.set(sample.preset, quizId);
      }
      await runCase(browser, publicApi, quizIds.get(sample.preset), sample);
    }
    console.log(`Host phase controls smoke passed. Artifacts: ${ARTIFACT_DIR}`);
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
