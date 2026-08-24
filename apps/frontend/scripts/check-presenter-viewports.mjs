#!/usr/bin/env node
/**
 * Blockierender Geometrie-Smoke für eine gefüllte Presenter-Lobby.
 *
 * Prüft vier reale Tablet-/Beamer-Viewports auf:
 * - sichtbaren Session-Code, QR-Code und 50 Personen,
 * - vollständig innerhalb des Publikumsrasters liegende Badges,
 * - keinen inneren oder dokumentweiten Scroll-Overflow,
 * - keine Überlappung von Beitritts- und Publikumsfläche.
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 *     node scripts/check-presenter-viewports.mjs
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium } from 'playwright';
import { kindergartenNickname } from '../../../scripts/load/lib/kindergarten-nicknames.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://localhost:3000/trpc').replace(/\/+$/, '');
const ARTIFACT_DIR =
  process.env.SMOKE_ARTIFACT_DIR || process.env.PRESENTER_VIEWPORT_ARTIFACT_DIR || 'tmp';
const CAPTURE_SCREENSHOTS = process.env.PRESENTER_VIEWPORT_SCREENSHOTS === '1';
const SUPPORTED_NICKNAME_THEMES = new Set([
  'KINDERGARTEN',
  'MIDDLE_SCHOOL',
  'HIGH_SCHOOL',
  'NOBEL_LAUREATES',
]);
const requestedNicknameTheme = process.env.PRESENTER_NICKNAME_THEME || 'KINDERGARTEN';
if (!SUPPORTED_NICKNAME_THEMES.has(requestedNicknameTheme)) {
  throw new Error(`Nicht unterstütztes PRESENTER_NICKNAME_THEME: ${requestedNicknameTheme}`);
}
const NICKNAME_THEME = requestedNicknameTheme;
const ANONYMOUS_MODE = process.env.PRESENTER_ANONYMOUS_MODE === '1';
const COLOR_SCHEME = process.env.PRESENTER_COLOR_SCHEME === 'dark' ? 'dark' : 'light';
const EXPECTED_PACKED_ICON = ANONYMOUS_MODE
  ? 'theater_comedy'
  : NICKNAME_THEME === 'MIDDLE_SCHOOL' || NICKNAME_THEME === 'HIGH_SCHOOL'
    ? 'school'
    : NICKNAME_THEME === 'NOBEL_LAUREATES'
      ? 'military_tech'
      : null;
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const requestedParticipantCount = Number(process.env.PRESENTER_PARTICIPANT_COUNT || 50);
if (
  !Number.isInteger(requestedParticipantCount) ||
  requestedParticipantCount < 1 ||
  requestedParticipantCount > 500
) {
  throw new Error('PRESENTER_PARTICIPANT_COUNT muss eine ganze Zahl zwischen 1 und 500 sein.');
}
const PARTICIPANT_COUNT = requestedParticipantCount;
const GEOMETRY_TOLERANCE_PX = 1.5;
const NOBEL_LAUREATE_NICKNAMES = [
  'Marie Curie',
  'Albert Einstein',
  'Ada Yonath',
  'Niels Bohr',
  'Max Planck',
  'Erwin Schrödinger',
  'Werner Heisenberg',
  'Paul Dirac',
  'Richard Feynman',
  'Linus Pauling',
  'Dorothy Hodgkin',
  'Maria Goeppert-Mayer',
  'Emmanuelle Charpentier',
  'Jennifer Doudna',
  'Frances Arnold',
  'Donna Strickland',
  'Gérard Mourou',
  'Arthur Ashkin',
  'Kip Thorne',
  'Barry Barish',
  'Rainer Weiss',
  'Peter Higgs',
  'François Englert',
  'Andre Geim',
  'Konstantin Novoselov',
  'Elizabeth Blackburn',
  'Carol Greider',
  'Jack Szostak',
  'Roger Kornberg',
  'Theodor Hänsch',
  'Roy Glauber',
  'John Hall',
  'Wolfgang Ketterle',
  'Eric Cornell',
  'Carl Wieman',
  'Steven Chu',
  'Claude Cohen-Tannoudji',
  'William Phillips',
  'Robert Laughlin',
  'Horst Störmer',
  'Daniel Tsui',
  'Gerardus t Hooft',
  'Martinus Veltman',
  'Robert Richardson',
  'Douglas Osheroff',
  'David Lee',
  'Bertram Brockhouse',
  'Clifford Shull',
  'Georges Charpak',
  'Russell Hulse',
];
const VIEWPORTS = [
  { name: 'galaxy-tab-portrait', width: 712, height: 1138 },
  { name: 'galaxy-tab-landscape', width: 1138, height: 712 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'hd-projector', width: 1280, height: 720 },
];

const QUIZ_PAYLOAD = {
  name: `Presenter Viewports ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  enableSoundEffects: false,
  enableRewardEffects: false,
  enableMotivationMessages: false,
  enableEmojiReactions: false,
  anonymousMode: ANONYMOUS_MODE,
  teamMode: false,
  teamCount: null,
  teamAssignment: 'AUTO',
  teamNames: [],
  backgroundMusic: null,
  nicknameTheme: NICKNAME_THEME,
  bonusTokenCount: 1,
  readingPhaseEnabled: true,
  preset: 'SERIOUS',
  questions: [
    {
      text: 'Welche Presenter-Fläche bleibt ohne Scroll sichtbar?',
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: 'Beitritt und Publikum', isCorrect: true },
        { text: 'Nur der Session-Code', isCorrect: false },
      ],
    },
  ],
};

function createTrpcClient() {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
      }),
    ],
  });
}

function participantNickname(index) {
  if (NICKNAME_THEME === 'NOBEL_LAUREATES') {
    const base = NOBEL_LAUREATE_NICKNAMES[index % NOBEL_LAUREATE_NICKNAMES.length];
    const cycle = Math.floor(index / NOBEL_LAUREATE_NICKNAMES.length);
    return cycle === 0 ? base : `${base} ${cycle + 1}`;
  }
  if (NICKNAME_THEME === 'KINDERGARTEN') {
    return kindergartenNickname(index, 'de');
  }
  return `Presenter Person ${String(index + 1).padStart(2, '0')}`;
}

async function waitForServer(url, maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Dienste starten in CI parallel.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function mapLimit(values, concurrency, operation) {
  const results = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

function formatFailures(viewport, failures) {
  return failures.map(
    (failure) => `${viewport.name} (${viewport.width}×${viewport.height}): ${failure}`,
  );
}

async function inspectPresenterGeometry(page) {
  return page.evaluate(
    ({ expectedParticipants, expectedPackedIcon, tolerance }) => {
      const rect = (element) => {
        const value = element.getBoundingClientRect();
        return {
          top: value.top,
          right: value.right,
          bottom: value.bottom,
          left: value.left,
          width: value.width,
          height: value.height,
        };
      };
      const within = (inner, outer) =>
        inner.left >= outer.left - tolerance &&
        inner.right <= outer.right + tolerance &&
        inner.top >= outer.top - tolerance &&
        inner.bottom <= outer.bottom + tolerance;
      const visible = (element) => {
        const style = getComputedStyle(element);
        const bounds = rect(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) > 0 &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      };
      const bySelector = (selector) => document.querySelector(selector);
      const root = bySelector('.session-present--lobby');
      const stage = bySelector('.session-present__lobby-stage');
      const join = bySelector('.session-present__lobby-join-stack');
      const audience = bySelector('.session-present__lobby-audience');
      const people = bySelector('.session-present__lobby-people-cols--packed');
      const code = bySelector('.session-present__lobby-code');
      const qr = bySelector('.session-present__lobby-qr');
      const cards = [...document.querySelectorAll('.session-present__lobby-person-col')];
      const icons = [
        ...document.querySelectorAll(
          '.session-present__lobby-nick-icon, .session-present__lobby-nick-mat-icon',
        ),
      ];
      const missing = [
        ['Presenter-Lobby', root],
        ['Lobby-Bühne', stage],
        ['Beitrittsfläche', join],
        ['Publikumsfläche', audience],
        ['Packed-Publikum', people],
        ['Session-Code', code],
        ['QR-Code', qr],
      ]
        .filter(([, element]) => !element)
        .map(([label]) => label);

      if (missing.length > 0) {
        return { failures: [`Elemente fehlen: ${missing.join(', ')}`] };
      }

      const failures = [];
      const viewport = {
        top: 0,
        left: 0,
        right: globalThis.innerWidth,
        bottom: globalThis.innerHeight,
      };
      const rootRect = rect(root);
      const stageRect = rect(stage);
      const joinRect = rect(join);
      const audienceRect = rect(audience);
      const peopleRect = rect(people);

      if (cards.length !== expectedParticipants) {
        failures.push(`erwartet ${expectedParticipants} Personen-Badges, gefunden ${cards.length}`);
      }
      if (icons.length !== expectedParticipants) {
        failures.push(`erwartet ${expectedParticipants} Personen-Icons, gefunden ${icons.length}`);
      }
      if (expectedPackedIcon) {
        const packedIcons = [...document.querySelectorAll('.session-present__lobby-packed-icon')];
        const packedNumbers = [
          ...document.querySelectorAll('.session-present__lobby-packed-number'),
        ];
        const expectedNumbers = Array.from({ length: expectedParticipants }, (_, index) =>
          String(expectedParticipants - index).padStart(2, '0'),
        );
        if (
          packedIcons.length !== expectedParticipants ||
          packedIcons.some((element) => element.textContent?.trim() !== expectedPackedIcon)
        ) {
          failures.push(
            `erwartet ${expectedParticipants} Packed-Icons "${expectedPackedIcon}", ` +
              `gefunden ${packedIcons.length}`,
          );
        }
        if (
          packedNumbers.length !== expectedParticipants ||
          packedNumbers.some(
            (element, index) => element.textContent?.trim() !== expectedNumbers[index],
          )
        ) {
          failures.push('Packed-Eingangsnummern sind unvollständig oder nicht stabil sortiert');
        }
      }

      for (const [label, element] of [
        ['Presenter-Lobby', root],
        ['Lobby-Bühne', stage],
        ['Beitrittsfläche', join],
        ['Publikumsfläche', audience],
        ['Packed-Publikum', people],
        ['Session-Code', code],
        ['QR-Code', qr],
      ]) {
        if (!visible(element)) {
          failures.push(`${label} ist nicht sichtbar`);
        }
        if (!within(rect(element), viewport)) {
          failures.push(`${label} liegt außerhalb des Viewports`);
        }
      }

      for (const [label, element] of [
        ['Presenter-Lobby', root],
        ['Lobby-Bühne', stage],
        ['Publikumsfläche', audience],
        ['Packed-Publikum', people],
      ]) {
        if (
          element.scrollWidth > element.clientWidth + tolerance ||
          element.scrollHeight > element.clientHeight + tolerance
        ) {
          failures.push(
            `${label} hat Overflow ${element.scrollWidth}×${element.scrollHeight} bei ` +
              `${element.clientWidth}×${element.clientHeight}`,
          );
        }
      }

      const documentWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      );
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      if (documentWidth > globalThis.innerWidth + tolerance) {
        failures.push(`Dokument scrollt horizontal (${documentWidth} > ${globalThis.innerWidth})`);
      }
      if (documentHeight > globalThis.innerHeight + tolerance) {
        failures.push(`Dokument scrollt vertikal (${documentHeight} > ${globalThis.innerHeight})`);
      }

      const escapedCards = cards
        .map((card, index) => ({ index, bounds: rect(card), visible: visible(card) }))
        .filter(
          ({ bounds, visible: isVisible }) =>
            !isVisible || !within(bounds, peopleRect) || !within(bounds, viewport),
        );
      if (escapedCards.length > 0) {
        failures.push(
          `${escapedCards.length} Personen-Badges sind unsichtbar oder liegen außerhalb des Rasters`,
        );
      }

      const horizontalLayout = globalThis.innerWidth >= 900;
      if (horizontalLayout && joinRect.right > audienceRect.left + tolerance) {
        failures.push('Beitritts- und Publikumsfläche überlappen horizontal');
      }
      if (!horizontalLayout && joinRect.bottom > audienceRect.top + tolerance) {
        failures.push('Beitritts- und Publikumsfläche überlappen vertikal');
      }

      if (!within(stageRect, rootRect)) {
        failures.push('Lobby-Bühne liegt außerhalb der Presenter-Fläche');
      }

      return {
        failures,
        metrics: {
          root: `${Math.round(rootRect.width)}×${Math.round(rootRect.height)}`,
          audience: `${Math.round(audienceRect.width)}×${Math.round(audienceRect.height)}`,
          badge: cards[0]
            ? `${Math.round(rect(cards[0]).width)}×${Math.round(rect(cards[0]).height)}`
            : 'fehlt',
        },
      };
    },
    {
      expectedParticipants: PARTICIPANT_COUNT,
      expectedPackedIcon: EXPECTED_PACKED_ICON,
      tolerance: GEOMETRY_TOLERANCE_PX,
    },
  );
}

async function verifyViewport(browser, session, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: COLOR_SCHEME,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ({ code, colorScheme, hostToken, prefix }) => {
      globalThis.sessionStorage.setItem(`${prefix}${code}`, hostToken);
      globalThis.localStorage.setItem('home-theme', colorScheme);
    },
    {
      code: session.code,
      colorScheme: COLOR_SCHEME,
      hostToken: session.hostToken,
      prefix: HOST_TOKEN_STORAGE_PREFIX,
    },
  );
  const page = await context.newPage();
  const failures = [];

  try {
    await page.goto(`${BASE_URL}/session/${session.code}/present`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForFunction(
      ({ count }) => {
        const label = document.querySelector('.session-present__lobby-audience-count');
        const cards = document.querySelectorAll('.session-present__lobby-person-col');
        return label?.textContent?.includes(String(count)) && cards.length === count;
      },
      { count: PARTICIPANT_COUNT },
      { timeout: 20_000 },
    );
    await page.locator('.session-present__lobby-qr').evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) {
        throw new Error('QR-Code ist kein Bild.');
      }
      if (image.complete && image.naturalWidth > 0) {
        return;
      }
      return new Promise((resolve, reject) => {
        image.addEventListener('load', () => resolve(undefined), { once: true });
        image.addEventListener('error', () => reject(new Error('QR-Code konnte nicht laden.')), {
          once: true,
        });
      });
    });
    await page.evaluate(
      () =>
        document.fonts?.ready ??
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

    const result = await inspectPresenterGeometry(page);
    failures.push(...formatFailures(viewport, result.failures));
    if (result.failures.length === 0) {
      console.log(
        `OK ${viewport.name} (${viewport.width}×${viewport.height}) — ` +
          `Lobby ${result.metrics.root}, Publikum ${result.metrics.audience}, ` +
          `Badge ${result.metrics.badge}`,
      );
    }
  } catch (error) {
    failures.push(
      ...formatFailures(viewport, [error instanceof Error ? error.message : String(error)]),
    );
  }

  if (failures.length > 0 || CAPTURE_SCREENSHOTS) {
    const artifactDir = resolve(ARTIFACT_DIR);
    const screenshotPath = resolve(artifactDir, `presenter-${viewport.name}.png`);
    await mkdir(artifactDir, { recursive: true });
    try {
      await page.screenshot({
        path: screenshotPath,
        fullPage: failures.length > 0,
      });
      if (CAPTURE_SCREENSHOTS) {
        console.log(`Screenshot ${screenshotPath}`);
      }
    } catch (error) {
      if (CAPTURE_SCREENSHOTS) {
        throw error;
      }
    }
  }

  await context.close();
  return failures;
}

async function main() {
  if (!(await waitForServer(BASE_URL))) {
    throw new Error(`Frontend nicht erreichbar unter ${BASE_URL}.`);
  }
  if (!(await waitForServer(`${TRPC_URL}/health.check`))) {
    throw new Error(`Backend nicht erreichbar unter ${TRPC_URL}.`);
  }

  const trpc = createTrpcClient();
  const { quizId } = await trpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const session = await trpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });

  await mapLimit(
    Array.from({ length: PARTICIPANT_COUNT }, (_, index) => index),
    10,
    (_, index) =>
      trpc.session.join.mutate({
        code: session.code,
        nickname: participantNickname(index),
        anonymousClientId: globalThis.crypto.randomUUID(),
      }),
  );

  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    for (const viewport of VIEWPORTS) {
      failures.push(...(await verifyViewport(browser, session, viewport)));
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('\nFehlgeschlagene Presenter-Viewport-Prüfungen:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n✓ Presenter-Lobby mit ${PARTICIPANT_COUNT} Personen in ${VIEWPORTS.length} Viewports ohne Scroll oder Clipping.`,
  );
}

await main().catch((error) => {
  console.error(error);
  process.exit(1);
});
