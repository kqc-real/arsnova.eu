#!/usr/bin/env node
/** Real-DOM regression for host-controlled projection pages; local test sessions only. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const base = process.env.BASE_URL || 'http://localhost:4200';
const theme = process.env.PROJECTION_THEME || 'light';
const api = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const locales = (process.env.PROJECTION_LOCALES || 'de').split(',');
const presets = (process.env.PROJECTION_PRESETS || 'SERIOUS,PLAYFUL').split(',');
const viewports = (process.env.PROJECTION_SIZES || '1280x720,1920x1080,1920x1200')
  .split(',')
  .map((size) => size.split('x').map(Number));
const artifacts = resolve(process.env.SMOKE_ARTIFACT_DIR || 'tmp/projection-pages');
const client = (token) =>
  createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: api,
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }),
        headers: token ? { 'x-host-token': token } : undefined,
      }),
    ],
  });
const browser = await chromium.launch({ headless: true });
await mkdir(artifacts, { recursive: true });
const question = [
  '## Projektionsprüfung: vollständige Inhalte',
  ...Array.from(
    { length: 5 },
    (_, index) =>
      `Absatz ${index + 1}: ` +
      'Die letzte Reihe soll jeden Teil der Frage vollständig lesen können. '.repeat(3),
  ),
  '$$e^{i\\pi}+1=0$$',
  '```typescript\n' +
    Array.from({ length: 22 }, (_, index) => `const zeile${index + 1} = ${index + 1};`).join('\n') +
    '\n```',
  'ENDE DER FRAGE',
].join('\n\n');
try {
  for (const preset of presets) {
    const publicApi = client();
    const { quizId } = await publicApi.quiz.upload.mutate({
      name: 'Projection regression',
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
          text: question,
          type: 'SINGLE_CHOICE',
          difficulty: 'MEDIUM',
          timer: null,
          order: 0,
          answers: Array.from({ length: 6 }, (_, index) => ({
            text:
              `Antwort ${index + 1}: ` +
              'Ein vollständiger und gut lesbarer Antworttext mit mehreren Sätzen. '.repeat(4) +
              ` ENDE ANTWORT ${index + 1}`,
            isCorrect: index === 0,
          })),
        },
      ],
    });
    const session = await publicApi.session.create.mutate({ quizId, type: 'QUIZ' });
    const hostApi = client(session.hostToken);
    await hostApi.session.nextQuestion.mutate({ code: session.code });
    for (const locale of locales)
      for (const [width, height] of viewports) {
        const context = await browser.newContext({ viewport: { width, height } });
        await context.addInitScript(
          ({ session, preset, theme }) => {
            sessionStorage.setItem(`arsnova-host-token:${session.code}`, session.hostToken);
            localStorage.setItem('home-preset', preset === 'SERIOUS' ? 'serious' : 'spielerisch');
            localStorage.setItem('home-theme', theme);
            // Fullscreen permission is tested separately; here measure the entire projection viewport.
            Object.defineProperty(document, 'fullscreenElement', {
              get: () => document.documentElement,
            });
          },
          { session, preset, theme },
        );
        const page = await context.newPage();
        const subscriptionErrors = [];
        page.on('websocket', (socket) => {
          if (new URL(socket.url()).pathname !== '/trpc-ws') return;
          socket.on('framereceived', ({ payload }) => {
            const message = JSON.parse(String(payload));
            if (message.error) subscriptionErrors.push(message.error.data?.code ?? 'UNKNOWN');
          });
        });
        page.setDefaultTimeout(15000);
        page.setDefaultNavigationTimeout(20000);
        const name = `${preset}-${locale}-${width}x${height}`;
        try {
          await page.goto(`${base}/${locale}/session/${session.code}/present`);
          await page.locator('.projection-pages__page .session-projection-quiz').waitFor();
          await page.waitForFunction(() =>
            document
              .querySelector('.projection-pages__indicator')
              ?.textContent?.match(/\/\s*[2-9]/),
          );
          let info = await hostApi.session.getInfo.query({ code: session.code });
          // The status fanout is asynchronous; wait for the presenter's measured count.
          for (let i = 0; i < 40 && (info.presenterPage?.count ?? 1) === 1; i++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            info = await hostApi.session.getInfo.query({ code: session.code });
          }
          assert.ok(info.presenterPage.count > 1);
          while (info.presenterPage.index > 0)
            info = {
              ...info,
              ...(await hostApi.session.setPresenterSurface.mutate({
                code: session.code,
                page: { context: info.presenterPage.context, delta: -1 },
              })),
            };
          const content = [];
          for (let index = 0; index < info.presenterPage.count; index++) {
            console.log(`${name}: checking page ${index + 1}/${info.presenterPage.count}`);
            await page.waitForFunction(
              (n) =>
                document
                  .querySelector('.projection-pages__indicator')
                  ?.textContent?.match(new RegExp(`(?:Seite|Page|Página|Pagina)\\s+${n + 1}\\s*/`)),
              index,
            );
            const result = await page
              .locator('.projection-pages__viewport')
              .evaluate((viewport) => {
                const root = viewport.querySelector('.projection-pages__page');
                const bounds = viewport.getBoundingClientRect();
                const overflow = Array.from(root.querySelectorAll('*'))
                  .filter((el) => {
                    const style = getComputedStyle(el);
                    if (
                      style.display === 'none' ||
                      style.visibility === 'hidden' ||
                      el.closest('.katex-mathml')
                    )
                      return false;
                    const rect = el.getBoundingClientRect();
                    return (
                      rect.width > 0 &&
                      rect.height > 0 &&
                      (rect.right > bounds.right + 2 || rect.bottom > bounds.bottom + 2)
                    );
                  })
                  .map((el) => el.className)
                  .slice(0, 10);
                return {
                  text: root.textContent,
                  overflow,
                  pageHeight: root.scrollHeight,
                  availableHeight: viewport.clientHeight,
                  scroll: document.documentElement.scrollHeight > innerHeight + 2,
                  cramped: Array.from(
                    root.querySelectorAll(
                      '.session-projection-quiz__title p, .session-projection-quiz__answer-head p, pre code',
                    ),
                  ).filter((el) => {
                    const css = getComputedStyle(el);
                    return parseFloat(css.lineHeight) < parseFloat(css.fontSize) * 1.49;
                  }).length,
                  correctness: root.querySelectorAll('.session-projection-quiz__answer--correct')
                    .length,
                };
              });
            assert.deepEqual(
              result.overflow,
              [],
              `${name} page ${index + 1}: ${JSON.stringify(result)}`,
            );
            assert.equal(result.scroll, false, `${name} document overflow`);
            assert.equal(result.correctness, 0, 'No solutions before release');
            assert.equal(result.cramped, 0, 'Main text and code require line height 1.5');
            content.push(result.text);
            if (index === 0 || index === info.presenterPage.count - 1)
              await page.screenshot({ path: `${artifacts}/${name}-${index + 1}.png` });
            if (index + 1 < info.presenterPage.count)
              await hostApi.session.setPresenterSurface.mutate({
                code: session.code,
                page: { context: info.presenterPage.context, delta: 1 },
              });
          }
          const text = content.join('');
          for (let i = 1; i <= 5; i++) assert.ok(text.includes(`Absatz ${i}`));
          for (let i = 1; i <= 22; i++) assert.ok(text.includes(`const zeile${i} = ${i};`));
          for (let i = 1; i <= 6; i++) assert.ok(text.includes(`ENDE ANTWORT ${i}`));
          assert.ok(text.includes('ENDE DER FRAGE'));
          console.log(`Measured ${name}: ${info.presenterPage.count} complete pages`);
          const before = await hostApi.session.getInfo.query({ code: session.code });
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator('.projection-pages__page .session-projection-quiz').waitFor();
          assert.equal(
            (await hostApi.session.getInfo.query({ code: session.code })).presenterPage.index,
            before.presenterPage.index,
          );
          assert.equal(before.status, 'ACTIVE');
          if (preset === 'SERIOUS' && locale === 'de' && width === 1280) {
            const hostPage = await context.newPage();
            await hostPage.setViewportSize({ width: 320, height: 800 });
            await hostPage.goto(`${base}/${locale}/session/${session.code}/host`);
            const controls = hostPage.locator('.session-host__projection-pages');
            await controls.waitFor();
            await controls.scrollIntoViewIfNeeded();
            const bounds = await controls.boundingBox();
            assert.ok(
              bounds && bounds.x >= 0 && bounds.x + bounds.width <= 321,
              'Host controls reflow at 320px',
            );
            await controls.getByRole('button', { name: 'Vorherige Seite' }).click();
            await page.waitForFunction(
              (n) =>
                document
                  .querySelector('.projection-pages__indicator')
                  ?.textContent?.includes(`${n} /`),
              before.presenterPage.index,
            );
            await controls.getByRole('button', { name: 'Nächste Seite' }).click();
            await page.waitForFunction(
              (n) =>
                document
                  .querySelector('.projection-pages__indicator')
                  ?.textContent?.includes(`${n + 1} /`),
              before.presenterPage.index,
            );
            await hostPage.screenshot({ path: `${artifacts}/host-pages-mobile.png` });
            await hostPage.close();
          }

          assert.deepEqual(subscriptionErrors, [], 'Authenticated presenter subscriptions');
          console.log(
            `OK ${name}: ${info.presenterPage.count} pages, complete content, no clipping, reload preserved`,
          );
        } catch (error) {
          await page.screenshot({ path: `${artifacts}/${name}-failure.png`, fullPage: true });
          throw error;
        } finally {
          await context.close();
        }
      }
  }
} finally {
  await browser.close();
}
