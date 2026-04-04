#!/usr/bin/env node
/**
 * Smoke-Test fuer Host-Hintergrundmusik und Audio-Unlock im lokalisierten Host-Flow.
 *
 * Verifiziert:
 * - Ein frueher, blockierter Audio-Resume-Versuch auf der Host-Seite blockiert den ersten echten Klick nicht dauerhaft.
 * - Der Klick auf die Musiksteuerung triggert einen zweiten Resume-Versuch.
 * - Die Track-Vorschau im Musik-Menue startet danach erfolgreich.
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:host-music -w @arsnova/frontend
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200/de';
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const DESKTOP = { width: 1440, height: 1000 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const QUIZ_PAYLOAD = {
  name: `Host Music Smoke ${Date.now()}`,
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
  bonusTokenCount: 3,
  readingPhaseEnabled: true,
  preset: 'PLAYFUL',
  questions: [
    {
      text: 'Welche Host-Funktion prueft dieser Smoke-Test?',
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: 'Audio-Unlock und Musikvorschau', isCorrect: true },
        { text: 'Nur der Join-Flow', isCorrect: false },
      ],
    },
  ],
};

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

function createBrowserTrpcClient() {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
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

async function waitForVisible(locator, timeout = 15_000) {
  await locator.first().waitFor({ state: 'visible', timeout });
}

async function clickViaDom(locator) {
  await waitForVisible(locator);
  await locator.first().evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
    }
  });
}

async function readAudioStats(page) {
  return page.evaluate(() => ({
    resumeCalls: globalThis.__arsnovaAudioResumeCalls ?? 0,
    startCalls: globalThis.__arsnovaAudioStartCalls ?? 0,
    state: globalThis.__arsnovaAudioLastState ?? 'missing',
  }));
}

async function main() {
  console.log(`Warte auf ${BASE_URL}...`);
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

  const browser = await launchBrowser();
  const failures = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    await hostContext.addInitScript(
      ({ sessionCode, token, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
        globalThis.__arsnovaAudioResumeCalls = 0;
        globalThis.__arsnovaAudioStartCalls = 0;
        globalThis.__arsnovaAudioLastState = 'suspended';
        globalThis.__arsnovaAudioAllowResume = false;

        document.addEventListener(
          'click',
          (event) => {
            const target = event.target;
            globalThis.__arsnovaAudioAllowResume =
              target instanceof Element &&
              !!target.closest(
                '.session-host__live-sound-control, .session-host__music-preview-btn',
              );
            queueMicrotask(() => {
              globalThis.__arsnovaAudioAllowResume = false;
            });
          },
          true,
        );

        const nativeFetch = globalThis.fetch.bind(globalThis);
        globalThis.fetch = async (input, init) => {
          let url;
          if (typeof input === 'string') {
            url = input;
          } else if (input instanceof Request) {
            url = input.url;
          } else {
            url = String(input);
          }

          if (url.includes('/assets/sound/')) {
            return new Response(new ArrayBuffer(8), {
              status: 200,
              headers: { 'Content-Type': 'audio/mpeg' },
            });
          }

          return nativeFetch(input, init);
        };

        class FakeAudioBufferSourceNode {
          buffer = null;

          loop = false;

          onended = null;

          connect() {
            return undefined;
          }

          disconnect() {
            return undefined;
          }

          start() {
            globalThis.__arsnovaAudioStartCalls += 1;
            globalThis.setTimeout(() => {
              if (typeof this.onended === 'function') {
                this.onended();
              }
            }, 1_000);
          }

          stop() {
            if (typeof this.onended === 'function') {
              this.onended();
            }
          }
        }

        class FakeGainNode {
          gain = { value: 1 };

          connect() {
            return undefined;
          }

          disconnect() {
            return undefined;
          }
        }

        class FakeAudioContext {
          state = 'suspended';

          destination = { nodeType: 'destination' };

          constructor() {
            globalThis.__arsnovaAudioLastState = this.state;
          }

          async resume() {
            globalThis.__arsnovaAudioResumeCalls += 1;
            if (!globalThis.__arsnovaAudioAllowResume) {
              globalThis.__arsnovaAudioLastState = this.state;
              throw new Error('autoplay blocked');
            }
            this.state = 'running';
            globalThis.__arsnovaAudioLastState = this.state;
          }

          async decodeAudioData() {
            return { duration: 4 };
          }

          createBufferSource() {
            return new FakeAudioBufferSourceNode();
          }

          createGain() {
            return new FakeGainNode();
          }
        }

        globalThis.AudioContext = FakeAudioContext;
        globalThis.webkitAudioContext = FakeAudioContext;
      },
      { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
    );

    const hostPage = await hostContext.newPage();
    await hostPage.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(hostPage, `/session/${code}/host`);
    await waitForVisible(hostPage.locator('.session-host__live-sound-control'));

    await hostPage.waitForFunction(() => (globalThis.__arsnovaAudioResumeCalls ?? 0) >= 1, {
      timeout: 10_000,
    });
    const initialAudio = await readAudioStats(hostPage);
    const initialBlocked =
      initialAudio.resumeCalls >= 1 &&
      initialAudio.startCalls === 0 &&
      initialAudio.state === 'suspended';
    logStep(
      initialBlocked,
      'Initiale Host-Resumes bleiben vor echtem Musik-Klick blockiert',
      `resume=${initialAudio.resumeCalls}, starts=${initialAudio.startCalls}, state=${initialAudio.state}`,
    );
    if (!initialBlocked) {
      failures.push(
        `Vor dem ersten Musik-Klick sollte Audio noch blockiert sein: resume=${initialAudio.resumeCalls}, starts=${initialAudio.startCalls}, state=${initialAudio.state}.`,
      );
    }

    const musicControl = hostPage.locator('.session-host__live-sound-control').first();
    await clickViaDom(musicControl);

    await hostPage.waitForFunction(() => (globalThis.__arsnovaAudioResumeCalls ?? 0) >= 2, {
      timeout: 10_000,
    });
    const unlockedAudio = await readAudioStats(hostPage);
    const recovered = unlockedAudio.resumeCalls > initialAudio.resumeCalls;
    logStep(
      recovered,
      'Musiksteuerung loest erneute Audio-Resumes aus',
      `resume=${unlockedAudio.resumeCalls}, state=${unlockedAudio.state}`,
    );
    if (!recovered) {
      failures.push(
        `Nach Klick auf die Musiksteuerung gab es keinen weiteren Resume-Versuch: vorher=${initialAudio.resumeCalls}, nachher=${unlockedAudio.resumeCalls}.`,
      );
    }

    const previewButton = hostPage
      .locator('.session-host__music-track-list .session-host__music-preview-btn')
      .first();
    await clickViaDom(previewButton);

    await hostPage.waitForFunction(() => (globalThis.__arsnovaAudioStartCalls ?? 0) >= 1, {
      timeout: 10_000,
    });
    const previewAudio = await readAudioStats(hostPage);
    const previewStarted = previewAudio.startCalls >= 1;
    logStep(
      previewStarted,
      'Track-Vorschau startet im Host-Menue',
      `starts=${previewAudio.startCalls}`,
    );
    if (!previewStarted) {
      failures.push('Die Musikvorschau hat keinen Audio-Start ausgelost.');
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('\nSmoke-Test fehlgeschlagen:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('\nHost-Musik-Smoke erfolgreich.');
}

await main();
