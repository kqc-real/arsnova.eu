#!/usr/bin/env node
/**
 * Live check: FINISHED shows results on presenter + vote;
 * Host "Zur Startseite" dismisses presenter to exit branding;
 * Vote keeps personal finish + star feedback.
 *
 * Usage:
 *   BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc \
 *     node apps/frontend/scripts/check-finish-dismiss-flow.mjs
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from '@playwright/test';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200').replace(/\/$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://localhost:3000/trpc').replace(/\/$/, '');
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';

const QUIZ_PAYLOAD = {
  name: `Finish Dismiss ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  enableSoundEffects: true,
  enableRewardEffects: true,
  enableMotivationMessages: true,
  enableEmojiReactions: true,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: 'AUTO',
  teamNames: [],
  backgroundMusic: null,
  nicknameTheme: 'NOBEL_LAUREATES',
  bonusTokenCount: 1,
  readingPhaseEnabled: false,
  preset: 'PLAYFUL',
  questions: [
    {
      text: 'Hauptstadt von Frankreich?',
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: 'Paris', isCorrect: true },
        { text: 'Lyon', isCorrect: false },
      ],
    },
  ],
};

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

async function injectParticipantToken(page, code, participantId) {
  await page.addInitScript(
    ({ sessionCode, pid }) => {
      globalThis.localStorage.setItem(`arsnova-participant-${sessionCode}`, pid);
    },
    { sessionCode: code, pid: participantId },
  );
}

async function bodyText(page) {
  return page.locator('body').innerText();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(await waitForServer(BASE_URL), `Frontend nicht erreichbar: ${BASE_URL}`);
  assert(
    await waitForServer(`${TRPC_URL.replace(/\/trpc$/, '')}/health`),
    `Backend nicht erreichbar: ${TRPC_URL}`,
  );

  const publicTrpc = createPublicTrpc();
  const { quizId } = await publicTrpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const created = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: true,
  });
  const code = created.code;
  const hostToken = created.hostToken;
  assert(typeof code === 'string' && code.length >= 4, 'session.create lieferte keinen Code');
  assert(
    typeof hostToken === 'string' && hostToken.length > 10,
    'session.create lieferte keinen hostToken',
  );
  const hostTrpc = createHostTrpc(hostToken);

  const joined = await publicTrpc.session.join.mutate({
    code,
    nickname: 'FinishCheck',
    anonymousClientId: globalThis.crypto.randomUUID(),
  });
  assert(typeof joined.participantId === 'string', 'session.join lieferte keine participantId');

  const browser = await launchBrowser();
  const hostPage = await browser.newPage();
  const presentPage = await browser.newPage();
  const votePage = await browser.newPage();

  try {
    await injectHostToken(hostPage, code, hostToken);
    await injectHostToken(presentPage, code, hostToken);
    await injectParticipantToken(votePage, code, joined.rejoinToken || joined.participantId);

    await Promise.all([
      hostPage.goto(`${BASE_URL}/session/${code}/host`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      }),
      presentPage.goto(`${BASE_URL}/session/${code}/present`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      }),
      votePage.goto(`${BASE_URL}/session/${code}/vote`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      }),
    ]);

    await hostPage.waitForTimeout(1500);
    await presentPage.waitForTimeout(800);
    await votePage.waitForTimeout(800);

    // Mindestens eine bewertete Antwort, sonst ist das Leaderboard leer → Presenter idle.
    await hostTrpc.session.nextQuestion.mutate({ code });
    const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
    assert(
      question?.id && question.answers?.[0]?.id,
      'Aktuelle Frage/Antwort fehlt nach nextQuestion',
    );
    await publicTrpc.vote.submit.mutate({
      sessionId: joined.id,
      participantId: joined.participantId,
      questionId: question.id,
      answerIds: [question.answers[0].id],
      responseTimeMs: 1200,
      round: 1,
    });
    await hostPage.waitForTimeout(500);

    await hostTrpc.session.end.mutate({ code });

    // Phase A: after quiz end → presenter leaderboard/results, vote personal finish
    await presentPage
      .waitForFunction(
        () => {
          const text = document.body?.innerText || '';
          return text.includes('Leaderboard') || text.includes('Gewonnen hat');
        },
        undefined,
        { timeout: 30_000 },
      )
      .catch(async () => {
        throw new Error(
          `Presenter nach End zeigte keine Ergebnisse.\n${(await bodyText(presentPage)).slice(0, 1200)}`,
        );
      });
    const presentA = await bodyText(presentPage);
    assert(
      presentA.includes('Leaderboard') || presentA.includes('Gewonnen hat'),
      `Presenter nach End sollte Ergebnisse zeigen. Got:\n${presentA.slice(0, 800)}`,
    );
    assert(
      !presentA.includes('Die Session ist beendet.'),
      'Presenter sollte nach End noch keine Exit-Branding zeigen',
    );
    console.log('OK A1: Presenter zeigt Ergebnisse nach Quiz-Ende');

    await votePage
      .waitForFunction(
        () => {
          const text = document.body?.innerText || '';
          return /Punkte|Ergebnis|Platz|#\d|Score|Dein/i.test(text);
        },
        undefined,
        { timeout: 30_000 },
      )
      .catch(async () => {
        throw new Error(
          `Vote nach End zeigte kein persönliches Ergebnis.\n${(await bodyText(votePage)).slice(0, 1200)}`,
        );
      });
    const voteA = await bodyText(votePage);
    assert(
      /Punkte|Ergebnis|Platz|Score/i.test(voteA),
      `Vote nach End sollte persönliches Ergebnis zeigen. Got:\n${voteA.slice(0, 800)}`,
    );
    console.log('OK A2: Vote zeigt persönliches Ergebnis nach Quiz-Ende');

    // Star feedback (session feedback)
    const starBtn = votePage.locator('.vote-feedback-card__star, .feedback-vote__star-btn').first();
    const feedbackHost = votePage
      .locator('.vote-feedback-card, app-feedback-vote, .feedback-vote')
      .first();
    await votePage.waitForTimeout(1500);
    const hasStars =
      (await starBtn.isVisible().catch(() => false)) ||
      (await feedbackHost.isVisible().catch(() => false)) ||
      /★|☆|Stern|Bewertung|Feedback|Star/i.test(voteA);
    assert(hasStars, `Vote sollte Feedback/Sterne-Option zeigen. Got:\n${voteA.slice(0, 800)}`);
    console.log('OK A3: Vote zeigt Feedback/Sterne-Option');

    // Phase B: dismiss via Host "Zur Startseite"
    const homeBtn = hostPage.getByRole('button', {
      name: /Zur Startseite|Back to home|Accueil|Inicio|Homepage/i,
    });
    await homeBtn
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(async () => {
        throw new Error(
          `Host „Zur Startseite“ nicht sichtbar.\n${(await bodyText(hostPage)).slice(0, 1200)}`,
        );
      });
    await homeBtn.first().click();
    await hostPage.waitForURL(/\/(home)?$/, { timeout: 20_000 }).catch(() => undefined);

    await presentPage
      .waitForFunction(
        () => (document.body?.innerText || '').includes('Die Session ist beendet.'),
        undefined,
        { timeout: 30_000 },
      )
      .catch(async () => {
        throw new Error(
          `Presenter nach Dismiss zeigte kein Exit-Branding.\n${(await bodyText(presentPage)).slice(0, 1200)}`,
        );
      });
    await presentPage.waitForTimeout(2500);
    const presentB = await bodyText(presentPage);
    assert(
      presentB.includes('Die Session ist beendet.'),
      `Presenter nach Dismiss sollte Exit-Text zeigen. Got:\n${presentB.slice(0, 800)}`,
    );
    assert(
      !presentB.includes('Leaderboard') && !presentB.includes('Gewonnen hat'),
      `Presenter nach Dismiss darf kein Leaderboard mehr zeigen. Got:\n${presentB.slice(0, 800)}`,
    );
    const logoVisible = await presentPage
      .locator(
        '.session-present__finish-brand-icon, .present-finish-empty__logo, .session-present__finish-brand-title',
      )
      .first()
      .isVisible()
      .catch(() => false);
    assert(logoVisible, 'Presenter Exit-Branding sollte Logo/Marke zeigen');
    console.log('OK B1: Presenter zeigt Logo + „Die Session ist beendet.“ nach Host-Home');

    const voteB = await bodyText(votePage);
    assert(
      /Punkte|Ergebnis|Platz|Score|Feedback|★|☆|Stern|Bewertung/i.test(voteB),
      `Vote nach Host-Home sollte persönliches Finish/Feedback behalten. Got:\n${voteB.slice(0, 800)}`,
    );
    assert(
      !voteB.includes('Die Session ist beendet.'),
      'Vote darf Presenter-Exit-Text nicht anzeigen',
    );
    console.log('OK B2: Vote behält persönliches Ergebnis + Feedback nach Host-Home');

    // Bonus code optional — log only
    if (/Bonus|Code/i.test(voteB)) {
      console.log('INFO: Bonus-Code auf Vote sichtbar');
    } else {
      console.log('INFO: Kein Bonus-Code in dieser Session (optional)');
    }

    console.log(`\nPASS finish-dismiss-flow (${code})`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('\nFAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
