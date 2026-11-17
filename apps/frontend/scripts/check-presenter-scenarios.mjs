#!/usr/bin/env node
/** Projection acceptance against local API sessions and the localized production build. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const base = process.env.BASE_URL || 'http://localhost:4200';
const theme = process.env.PROJECTION_THEME || 'light';
const api = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const locales = (process.env.PROJECTION_LOCALES || 'de,en,fr').split(',');
const scenarios = process.env.PROJECTION_SCENARIOS?.split(',');
const sizes =
  process.env.PROJECTION_SMOKE === '1'
    ? [[1280, 720]]
    : [
        [1280, 720],
        [1920, 1080],
        [1920, 1200],
      ];
const presets = process.env.PROJECTION_SMOKE === '1' ? ['SERIOUS'] : ['SERIOUS', 'PLAYFUL'];
const artifacts = resolve(process.env.SMOKE_ARTIFACT_DIR || 'tmp/presenter-scenarios');
const client = (headers = {}) =>
  createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: api,
        headers,
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
      }),
    ],
  });
const publicApi = client();
const browser = await chromium.launch({ headless: true });
await mkdir(artifacts, { recursive: true });

async function check(session, host, preset, name, selector, verify = () => {}) {
  if (scenarios && !scenarios.includes(name)) return;
  for (const locale of locales)
    for (const [width, height] of sizes) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: 'reduce',
      });
      await context.addInitScript(
        ({ session, preset, theme }) => {
          sessionStorage.setItem(`arsnova-host-token:${session.code}`, session.hostToken);
          localStorage.setItem('home-preset', preset === 'SERIOUS' ? 'serious' : 'spielerisch');
          localStorage.setItem('home-theme', theme);
          Object.defineProperty(document, 'fullscreenElement', {
            get: () => document.documentElement,
          });
        },
        { session, preset, theme },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const file = `${preset}-${locale}-${width}x${height}-${name}`;
      try {
        await page.goto(`${base}/${locale}/session/${session.code}/present`);
        await page.locator(selector).first().waitFor({ state: 'attached' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(350);
        let info = await host.session.getInfo.query({ code: session.code });
        const quizPageIndex = page.locator('.session-present__quiz-nav-index');
        if (await page.locator('app-projection-pages').count()) {
          await page.waitForFunction(() =>
            document.querySelector('.projection-pages__page')?.textContent?.trim(),
          );
          for (let attempt = 0; attempt < 30; attempt++) {
            info = await host.session.getInfo.query({ code: session.code });
            const label = await quizPageIndex.textContent({ timeout: 100 }).catch(() => null);
            const count = label === null ? 1 : Number(label.split('/').at(-1));
            if (info.presenterPage?.count === count && count > 1) break;
            await page.waitForTimeout(100);
          }
          while (info.presenterPage.index > 0)
            info = {
              ...info,
              ...(await host.session.setPresenterSurface.mutate({
                code: session.code,
                page: { context: info.presenterPage.context, delta: -1 },
              })),
            };
        }
        const count = (await quizPageIndex.count()) ? info.presenterPage.count : 1;
        const allText = [];
        for (let index = 0; index < count; index++) {
          if (count > 1)
            await quizPageIndex
              .filter({ hasText: new RegExp(`^\\s*${index + 1} / ${count}\\s*$`) })
              .waitFor();
          const metrics = await page.evaluate(() => {
            const root =
              document.querySelector(
                'app-projection-pages:not([hidden]) .projection-pages__page',
              ) || document.querySelector('.session-present');
            const clipped = Array.from(root.querySelectorAll('*'))
              .filter((el) => {
                if (el.closest('.projection-pages__source,.sr-only,.katex-mathml')) return false;
                const css = getComputedStyle(el),
                  r = el.getBoundingClientRect();
                if (
                  css.display === 'none' ||
                  css.visibility === 'hidden' ||
                  r.width === 0 ||
                  r.height === 0
                )
                  return false;
                const scrollStage = el.closest('.session-present__qa-stage');
                return (
                  r.right > innerWidth + 2 ||
                  ((!scrollStage || scrollStage === el) && r.bottom > innerHeight + 2) ||
                  (css.overflowY === 'hidden' &&
                    el.scrollHeight > el.clientHeight + 2 &&
                    el.textContent.trim() &&
                    !el.matches('mat-icon'))
                );
              })
              .map((el) => (typeof el.className === 'string' ? el.className : el.tagName))
              .slice(0, 8);
            return {
              text: root.textContent,
              clipped,
              scroll:
                document.documentElement.scrollWidth > innerWidth + 2 ||
                document.documentElement.scrollHeight > innerHeight + 2,
            };
          });
          assert.deepEqual(metrics.clipped, [], `${file}: clipped main content`);
          assert.equal(metrics.scroll, false, `${file}: document overflow`);
          allText.push(metrics.text);
          if (index === 0 || index === count - 1)
            await page.screenshot({ path: `${artifacts}/${file}-${index + 1}.png` });
          if (index + 1 < count)
            await host.session.setPresenterSurface.mutate({
              code: session.code,
              page: { context: info.presenterPage.context, delta: 1 },
            });
        }
        await verify(page, allText.join('\n'));
        console.log(`OK ${file}: ${count} page(s)`);
      } catch (error) {
        await page.screenshot({ path: `${artifacts}/${file}-failure.png`, fullPage: true });
        throw error;
      } finally {
        await context.close();
      }
    }
}
try {
  for (const preset of presets) {
    const { quizId } = await publicApi.quiz.upload.mutate({
      name: 'Presenter acceptance',
      preset,
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableMotivationMessages: false,
      enableEmojiReactions: false,
      anonymousMode: false,
      teamMode: false,
      nicknameTheme: 'NOBEL_LAUREATES',
      readingPhaseEnabled: false,
      enableSoundEffects: false,
      enableRewardEffects: false,
      questions: [
        {
          text: 'Wie viele Kilometer beträgt die Strecke?',
          type: 'NUMERIC_ESTIMATE',
          difficulty: 'MEDIUM',
          timer: null,
          order: 0,
          numericReferenceValue: 100,
          numericIntervalLeft: 90,
          numericIntervalRight: 110,
          numericTolerancePercent: 10,
          answers: [],
        },
        {
          text: 'Welche Begriffe beschreiben gutes Lernen?',
          type: 'FREETEXT',
          difficulty: 'MEDIUM',
          timer: null,
          order: 1,
          answers: [],
        },
        {
          text: 'Welche Antwort trifft zu?',
          type: 'SINGLE_CHOICE',
          difficulty: 'MEDIUM',
          timer: null,
          order: 2,
          answers: [
            { text: 'Die erste Antwort', isCorrect: true },
            { text: 'Die zweite Antwort', isCorrect: false },
          ],
        },
      ],
    });
    const session = await publicApi.session.create.mutate({
      quizId,
      type: 'QUIZ',
      qaEnabled: true,
      qaModerationMode: false,
      quickFeedbackEnabled: true,
    });
    const host = client({ 'x-host-token': session.hostToken });
    const participants = [];
    for (const total of [0, 10, 200]) {
      while (participants.length < total) {
        const batch = Array.from(
          { length: Math.min(10, total - participants.length) },
          (_, offset) => participants.length + offset,
        );
        participants.push(
          ...(await Promise.all(
            batch.map((i) =>
              publicApi.session.join.mutate({
                code: session.code,
                nickname: `Person ${i + 1}`,
                anonymousClientId: crypto.randomUUID(),
                joinIdempotencyKey: crypto.randomUUID(),
              }),
            ),
          )),
        );
      }
      await check(
        session,
        host,
        preset,
        `lobby-${total}`,
        '.session-present__lobby-code',
        async (page) => {
          assert.equal(await page.locator('.session-present__lobby-code').count(), 1);
          if (total === 200)
            assert.equal(await page.locator('.session-present__audience-summary').count(), 1);
        },
      );
    }
    await host.session.nextQuestion.mutate({ code: session.code });
    let q = await host.session.getCurrentQuestionForHost.query({ code: session.code });
    for (let i = 0; i < 10; i++)
      await client({ 'x-participant-capability': participants[i].rejoinToken }).vote.submit.mutate({
        sessionId: session.sessionId,
        participantId: participants[i].participantId,
        questionId: q.questionId,
        numericValue: 70 + i * 7,
      });
    await host.session.revealResults.mutate({ code: session.code });
    await check(
      session,
      host,
      preset,
      'numeric-results',
      '.session-projection-quiz__histogram',
      async (_page, text) => {
        assert.ok(text.includes('n=10'), `Stichprobengröße fehlt in der Projektion: ${text}`);
        assert.ok(text.includes('100'));
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await host.session.nextQuestion.mutate({ code: session.code });
    q = await host.session.getCurrentQuestionForHost.query({ code: session.code });
    const words = [
      'Motivation',
      'Vertrauen',
      'Neugier',
      'Teamarbeit',
      'Freude',
      'Lernen',
      'Bildung',
      'Diskussion',
      'Austausch',
      'Erkenntnis',
      'Mathematik',
      'Physik',
      'Chemie',
      'Biologie',
      'Kultur',
      'Sprache',
      'Geschichte',
      'Freiheit',
      'Forschung',
      'Bewegung',
      'Wissen',
      'Erfahrung',
      'Technik',
      'Gesundheit',
      'Kunst',
      'Musik',
      'Natur',
      'Mut',
      'Verantwortung',
      'Energie',
      'Handwerk',
      'Wirtschaft',
      'Gesellschaft',
      'Nachhaltigkeit',
      'Respekt',
      'Offenheit',
      'Geduld',
      'Kreativität',
      'Zusammenarbeit',
      'Experiment',
      'Praxis',
      'Theorie',
      'Beobachtung',
      'Analyse',
      'Konzentration',
      'Erholung',
      'Übung',
      'Planung',
      'Entwicklung',
      'Struktur',
    ];
    for (let i = 0; i < 30; i++)
      await client({ 'x-participant-capability': participants[i].rejoinToken }).vote.submit.mutate({
        sessionId: session.sessionId,
        participantId: participants[i].participantId,
        questionId: q.questionId,
        freeText: `${words[i]} ${words[(i + 30) % words.length]}`,
      });
    await host.session.revealResults.mutate({ code: session.code });
    await check(session, host, preset, 'freetext-results', '.word-cloud__word', async (page) => {
      await page.waitForTimeout(500);
      const boxes = await page.locator('.word-cloud__word').evaluateAll((nodes) =>
        nodes.map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
      );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          assert.ok(
            !(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top),
            'Word cloud terms overlap',
          );
        }
      const sizes = await page
        .locator('.word-cloud__word')
        .evaluateAll((nodes) =>
          nodes.map((el) => parseFloat(el.ownerDocument.defaultView.getComputedStyle(el).fontSize)),
        );
      assert.ok(sizes.length > 0 && sizes.every((size) => size >= 30));
    });
    const qaSelection = {
      code: session.code,
      mode: 'INITIAL',
      selection: { kind: 'UNTIL_SESSION_END' },
    };
    const qaPreview = await host.session.previewQaConfiguration.query(qaSelection);
    await host.session.configureQaChannel.mutate({
      ...qaSelection,
      expectedLifecycleRevision: qaPreview.expectedLifecycleRevision,
      previewServerNow: qaPreview.serverNow,
      confirmedQaClosesAt: qaPreview.newQaClosesAt,
      confirmedExpiresAt: qaPreview.newExpiresAt,
      confirmSessionExtension: false,
      moderationMode: false,
    });
    await host.session.setPreferredLiveChannel.mutate({ code: session.code, channel: 'qa' });
    for (let i = 0; i < 8; i++) {
      const { question } = await client({
        'x-participant-capability': participants[i].rejoinToken,
      }).qa.submit.mutate({
        sessionId: session.sessionId,
        participantId: participants[i].participantId,
        text:
          `Frage ${i + 1}: ` +
          'Welche Erkenntnisse können wir aus diesem Beispiel für unsere gemeinsame Arbeit ableiten? '.repeat(
            5,
          ),
        idempotencyKey: crypto.randomUUID(),
      });
      if (i === 0)
        await host.qa.moderate.mutate({
          sessionCode: session.code,
          questionId: question.id,
          action: 'PIN',
        });
    }
    await check(session, host, preset, 'qa-pinned', '.session-present__qa-text', async (page) => {
      assert.match(await page.locator('.session-present__qa-text').textContent(), /^Frage 1:/);
      assert.equal(await page.locator('.session-present__qa-list-item').count(), 7);
      const last = page.locator('.session-present__qa-list-item').last();
      await last.scrollIntoViewIfNeeded();
      assert.ok(
        await last.evaluate((item) => {
          const stage = item.closest('.session-present__qa-stage');
          return (
            stage.scrollTop > 0 &&
            item.getBoundingClientRect().bottom <= stage.getBoundingClientRect().bottom + 2
          );
        }),
      );
    });
    await host.quickFeedback.create.mutate({
      sessionCode: session.code,
      type: 'ABCD',
      showLiveResults: false,
    });
    await host.session.setPreferredLiveChannel.mutate({
      code: session.code,
      channel: 'quickFeedback',
    });
    for (let i = 0; i < 8; i++) {
      const participant = participants[i];
      await client({
        'x-participant-capability': participant.rejoinToken,
      }).quickFeedback.vote.mutate({
        sessionCode: session.code,
        voterId: participant.participantId,
        value: ['A', 'B', 'C', 'D'][i % 4],
      });
    }
    await check(
      session,
      host,
      preset,
      'feedback-hidden',
      '.session-present__feedback-hidden-hint',
      async (page) => assert.equal(await page.locator('.session-present__feedback-row').count(), 0),
    );
    await host.quickFeedback.toggleLock.mutate({ sessionCode: session.code });
    await check(
      session,
      host,
      preset,
      'feedback-revealed',
      '.session-present__feedback-row',
      async (_page, text) => assert.ok(text.includes('25')),
    );
    await host.session.setPreferredLiveChannel.mutate({ code: session.code, channel: 'quiz' });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await host.session.nextQuestion.mutate({ code: session.code });
    q = await host.session.getCurrentQuestionForHost.query({ code: session.code });
    await check(
      session,
      host,
      preset,
      'quiz-history-live-vote',
      '[data-testid=presenter-quiz-history-previous]',
      async (page) => {
        const { code, sessionId } = session;
        const history = page.getByTestId('presenter-quiz-history-status');
        const previous = page.getByTestId('presenter-quiz-history-previous');
        assert.equal(await previous.getAttribute('aria-keyshortcuts'), 'ArrowLeft');
        await previous.scrollIntoViewIfNeeded();
        await previous.focus();
        const before = await host.session.getInfo.query({ code });
        const assertLive = async () => {
          const info = await host.session.getInfo.query({ code });
          assert.equal(info.status, 'ACTIVE');
          assert.equal(info.currentQuestion, before.currentQuestion);
          assert.equal(info.currentRound, before.currentRound);
          const live = await publicApi.session.getCurrentQuestionForStudent.query({ code });
          assert.equal(live.id, q.questionId);
          assert.ok(live.answers.every((answer) => !Object.hasOwn(answer, 'isCorrect')));
        };

        await page.keyboard.press('ArrowLeft');
        await history.waitFor({ state: 'visible' });
        await page.locator('app-word-cloud').waitFor({ state: 'attached' });
        const next = page.getByTestId('presenter-quiz-history-next');
        const viewport = page.viewportSize();
        for (const [width, height] of [
          [840, 600],
          [600, 500],
          [320, 568],
        ]) {
          await page.setViewportSize({ width, height });
          await page.locator('[data-testid=presenter-quiz-history-next]').scrollIntoViewIfNeeded();
          const bounds = await next.boundingBox();
          assert.ok(
            bounds &&
              bounds.x >= 0 &&
              bounds.x + bounds.width <= width + 1 &&
              bounds.y >= 0 &&
              bounds.y + bounds.height <= height + 1,
            `Rückblick-Button bei ${width}×${height}: ${JSON.stringify(bounds)}`,
          );
          assert.ok(await next.evaluate((button) => button.scrollWidth <= button.clientWidth + 1));
        }
        await page.setViewportSize(viewport);
        await page.keyboard.press('ArrowLeft');
        await page
          .locator('.session-projection-quiz__histogram')
          .first()
          .waitFor({ state: 'attached' });
        await assertLive();

        // One vote per browser scenario, leaving the final-score fixtures free to vote later.
        const participant = await publicApi.session.join.mutate({
          code,
          nickname: `Rückblick ${crypto.randomUUID().slice(0, 8)}`,
          anonymousClientId: crypto.randomUUID(),
          joinIdempotencyKey: crypto.randomUUID(),
        });
        await client({ 'x-participant-capability': participant.rejoinToken }).vote.submit.mutate({
          sessionId,
          participantId: participant.participantId,
          questionId: q.questionId,
          answerIds: [q.answers.find((answer) => answer.isCorrect).id],
        });

        await page.keyboard.press('ArrowRight');
        await page.locator('app-word-cloud').waitFor({ state: 'attached' });
        await next.focus();
        await page.keyboard.press('ArrowRight');
        await history.waitFor({ state: 'detached' });
        await page.locator('[data-testid=presenter-quiz-reveal-results]:focus').waitFor();
        await assertLive();
      },
    );
    for (let i = 0; i < 30; i++)
      await client({ 'x-participant-capability': participants[i].rejoinToken }).vote.submit.mutate({
        sessionId: session.sessionId,
        participantId: participants[i].participantId,
        questionId: q.questionId,
        answerIds: [q.answers.find((answer) => answer.isCorrect).id],
      });
    await host.session.revealResults.mutate({ code: session.code });
    await host.session.nextQuestion.mutate({ code: session.code });
    await check(session, host, preset, 'finale', '.session-present__board-item', async (page) => {
      assert.ok((await page.locator('.session-present__board-item').count()) <= 8);
      assert.equal(await page.locator('.session-present__board-page').count(), 1);
    });
    await host.session.end.mutate({ code: session.code });
    await host.session.dismissFinishProjection.mutate({ code: session.code });
    await check(session, host, preset, 'ended', '[data-testid=presenter-finish-idle]');
  }
} finally {
  await browser.close();
}
