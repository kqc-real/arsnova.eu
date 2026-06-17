#!/usr/bin/env node
/**
 * Smoke test for numeric estimate questions with:
 * - dark playful theme
 * - 2 team auto assignment
 * - 20 participants
 * - 2 voting rounds
 * - host statistics, host scoreboards and participant score summary
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:numeric-estimate -w @arsnova/frontend
 */
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

function normalizeLoopbackUrl(url) {
  return url.replace('://localhost', '://127.0.0.1');
}

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const PROBE_URL = new URL(BASE_URL).origin;
const TRPC_URL = normalizeLoopbackUrl(process.env.TRPC_URL || 'http://localhost:3000/trpc');
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const QUESTION_TEXT = 'In welchem Jahr begann die Französische Revolution?';
const TEAM_NAMES = ['Jakobiner', 'Girondisten'];
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || tmpdir();
const OUT_HOST_RESULTS = `${ARTIFACT_DIR}/numeric-estimate-dark-teams-host.png`;
const OUT_CLIENT_PREFIX = `${ARTIFACT_DIR}/numeric-estimate-dark-teams-client`;

const participants = Array.from({ length: 20 }, (_, index) => {
  const n = index + 1;
  const round1 = [
    1760, 1770, 1776, 1780, 1783, 1785, 1788, 1789, 1790, 1792, 1795, 1800, 1804, 1812, 1750, 1774,
    1786, 1791, 1799, 1820,
  ][index];
  const round2 = [
    1789, 1789, 1788, 1789, 1790, 1789, 1789, 1789, 1789, 1791, 1789, 1788, 1789, 1790, 1787, 1789,
    1789, 1789, 1792, 1789,
  ][index];
  return {
    nickname: `Revolution ${String(n).padStart(2, '0')}`,
    round1,
    round2,
  };
});

const clientSampleIndexes = participants.map((_, index) => index);

function createTrpcClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

function logStep(ok, label, detail = '') {
  console.log(`${ok ? 'OK' : 'FEHLER'} ${label}${detail ? ` - ${detail}` : ''}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function localizedInteger(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

function valueMatcher(value) {
  return new RegExp(`(?:${escapeRegExp(String(value))}|${escapeRegExp(localizedInteger(value))})`);
}

async function ensureOutput(path) {
  await mkdir(dirname(path), { recursive: true });
}

async function waitForServer(url, maxAttempts = 30) {
  for (let index = 0; index < maxAttempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // App not ready yet.
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

async function waitForText(page, matcher, timeout = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) {
      return text;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function pageUsesDarkTheme(page) {
  return page.evaluate(() => {
    const root = globalThis.document.documentElement;
    return (
      root.classList.contains('dark') &&
      root.classList.contains('preset-playful') &&
      globalThis.localStorage.getItem('home-theme') === 'dark'
    );
  });
}

function installDarkTheme(context) {
  return context.addInitScript(() => {
    globalThis.localStorage.setItem('home-theme', 'dark');
    globalThis.localStorage.setItem('home-preset', 'spielerisch');
    const root = globalThis.document.documentElement;
    root.classList.add('dark', 'preset-playful');
    root.classList.remove('light');
  });
}

async function createSession(publicTrpc) {
  const { quizId } = await publicTrpc.quiz.upload.mutate({
    name: `Schätzfrage Dark Teams ${Date.now()}`,
    description: undefined,
    motifImageUrl: null,
    showLeaderboard: true,
    allowCustomNicknames: true,
    defaultTimer: null,
    timerScaleByDifficulty: false,
    enableSoundEffects: false,
    enableRewardEffects: false,
    enableMotivationMessages: false,
    enableEmojiReactions: true,
    anonymousMode: false,
    teamMode: true,
    teamCount: 2,
    teamAssignment: 'AUTO',
    teamNames: TEAM_NAMES,
    backgroundMusic: null,
    nicknameTheme: 'NOBEL_LAUREATES',
    bonusTokenCount: 3,
    readingPhaseEnabled: false,
    preset: 'PLAYFUL',
    questions: [
      {
        text: QUESTION_TEXT,
        type: 'NUMERIC_ESTIMATE',
        timer: null,
        difficulty: 'MEDIUM',
        order: 0,
        answers: [],
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericReferenceValue: 1789,
        numericIntervalLeft: 1788.5,
        numericIntervalRight: 1789.5,
        numericInputType: 'INTEGER',
        numericMin: 1600,
        numericMax: 2000,
        numericTwoRounds: true,
      },
    ],
  });
  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  const hostTrpc = createTrpcClient(hostToken);
  await hostTrpc.session.nextQuestion.mutate({ code });
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    throw new Error('Schätzfrage wurde nicht als aktuelle Frage geladen.');
  }
  return { code, hostToken, hostTrpc, questionId: question.id };
}

async function joinAndVote(publicTrpc, code, questionId, round) {
  const joined = [];
  for (const participant of participants) {
    const sessionParticipant =
      round === 1
        ? await publicTrpc.session.join.mutate({ code, nickname: participant.nickname })
        : participant.joined;
    participant.joined = sessionParticipant;
    joined.push(sessionParticipant);
    await publicTrpc.vote.submit.mutate({
      sessionId: sessionParticipant.id,
      participantId: sessionParticipant.participantId,
      questionId,
      numericValue: round === 1 ? participant.round1 : participant.round2,
      round,
      responseTimeMs: 900 + participant.nickname.length + round * 100,
    });
  }
  return joined;
}

function validateTeamAssignment(teamsPayload, teamLeaderboard, failures) {
  if (teamsPayload.teamCount !== 2 || teamsPayload.teams.length !== 2) {
    failures.push(`Session hat nicht genau zwei Teams (${teamsPayload.teamCount}).`);
  }
  const payloadNames = new Set(teamsPayload.teams.map((team) => team.name));
  for (const name of TEAM_NAMES) {
    if (!payloadNames.has(name)) {
      failures.push(`Team "${name}" fehlt in der Session.`);
    }
  }
  const assignedTeamNames = new Set(participants.map((participant) => participant.joined.teamName));
  if (assignedTeamNames.size !== 2) {
    failures.push(`Teilnehmende wurden nicht auf zwei Teams verteilt (${assignedTeamNames.size}).`);
  }
  const memberCount = teamsPayload.teams.reduce((sum, team) => sum + team.memberCount, 0);
  if (memberCount !== participants.length) {
    failures.push(`Team-Mitgliederzahl ist ${memberCount}, erwartet ${participants.length}.`);
  }
  if (teamLeaderboard.length !== 2) {
    failures.push(`Team-Leaderboard hat ${teamLeaderboard.length} Einträge statt 2.`);
  }
  if (!teamLeaderboard.every((entry) => entry.memberCount > 0)) {
    failures.push('Team-Leaderboard enthält ein leeres Team.');
  }
}

async function openHostResults(browser, code, hostToken) {
  await ensureOutput(OUT_HOST_RESULTS);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installDarkTheme(context);
  await context.addInitScript(
    ({ sessionCode, token, prefix }) => {
      globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
    },
    { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
  );
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/session/${code}/host`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  const text = await waitForText(
    page,
    /Runde 1[\s\S]*Runde 2[\s\S]*Referenz\s*1789[\s\S]*Team-Wertung/,
    25_000,
  );
  await page.waitForTimeout(650);
  const finalText = await page
    .locator('body')
    .innerText()
    .catch(() => text ?? '');
  const darkActive = await pageUsesDarkTheme(page);
  await page.screenshot({ path: OUT_HOST_RESULTS, fullPage: true });
  await context.close();
  return { text: finalText ?? '', darkActive };
}

async function openClientResult(browser, code, questionId, participant, index) {
  const screenshotPath = `${OUT_CLIENT_PREFIX}-${String(index + 1).padStart(2, '0')}.png`;
  await ensureOutput(screenshotPath);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installDarkTheme(context);
  const participantId = participant.joined.participantId;
  const round1Payload = JSON.stringify({
    numericValue: participant.round1,
    sent: true,
    updatedAt: new Date().toISOString(),
  });
  const round2Payload = JSON.stringify({
    numericValue: participant.round2,
    sent: true,
    updatedAt: new Date().toISOString(),
  });
  await context.addInitScript(
    ({ code, nickname, participantId, questionId, round1Payload, round2Payload }) => {
      globalThis.localStorage.setItem(`arsnova-participant-${code}`, participantId);
      globalThis.localStorage.setItem(`arsnova-nickname-${code}`, nickname);
      globalThis.localStorage.setItem(
        `arsnova-vote-response-${code}-${participantId}-${questionId}-1`,
        round1Payload,
      );
      globalThis.localStorage.setItem(
        `arsnova-vote-response-${code}-${participantId}-${questionId}-2`,
        round2Payload,
      );
    },
    {
      code,
      nickname: participant.nickname,
      participantId,
      questionId,
      round1Payload,
      round2Payload,
    },
  );
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/session/${code}/vote`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForText(page, /Deine Antwort:/, 25_000);
  await waitForText(page, /(Dein Score|Dein Ergebnis)/, 3_000);
  const text = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  const darkActive = await pageUsesDarkTheme(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  return { text: text ?? '', screenshotPath, darkActive };
}

async function run() {
  if (!(await waitForServer(PROBE_URL))) {
    throw new Error(`Frontend unter ${BASE_URL} ist nicht erreichbar.`);
  }

  for (const path of [
    OUT_HOST_RESULTS,
    ...clientSampleIndexes.map((i) => `${OUT_CLIENT_PREFIX}-${String(i + 1).padStart(2, '0')}.png`),
  ]) {
    await ensureOutput(path);
  }

  const publicTrpc = createTrpcClient();
  const failures = [];
  const { code, hostToken, hostTrpc, questionId } = await createSession(publicTrpc);
  logStep(true, 'Session erstellt', code);

  await joinAndVote(publicTrpc, code, questionId, 1);
  logStep(true, 'Runde 1 abgestimmt', '20 Stimmen');
  await hostTrpc.session.startDiscussion.mutate({ code });
  await hostTrpc.session.startSecondRound.mutate({ code });
  await new Promise((resolve) => setTimeout(resolve, 1250));
  await joinAndVote(publicTrpc, code, questionId, 2);
  logStep(true, 'Runde 2 abgestimmt', '20 Stimmen');
  await hostTrpc.session.revealResults.mutate({ code });
  logStep(true, 'Ergebnisse freigegeben');

  const teamsPayload = await publicTrpc.session.getTeams.query({ code });
  const teamLeaderboard = await publicTrpc.session.getTeamLeaderboard.query({ code });
  validateTeamAssignment(teamsPayload, teamLeaderboard, failures);

  const browser = await launchBrowser();
  const clientScreenshots = [];
  try {
    const hostResult = await openHostResults(browser, code, hostToken);
    const hostText = hostResult.text;
    if (!hostResult.darkActive) {
      failures.push('Host läuft nicht im Dark Theme.');
    }
    if (!/Runde 1/.test(hostText) || !/Runde 2/.test(hostText)) {
      failures.push('Host zeigt keine vollständige Zwei-Runden-Auswertung.');
    }
    if (!/Referenz\s*1789/.test(hostText) || !/Akzeptierter Wert\s*1789/.test(hostText)) {
      failures.push('Host zeigt Referenzwert oder akzeptierten Jahreswert nicht klar.');
    }
    if (/1\.789/.test(hostText)) {
      failures.push('Host zeigt Jahreszahlen weiterhin mit Tausenderpunkt.');
    }
    if (/n=20/.test(hostText)) {
      failures.push('Host zeigt statistische Details ohne Aufruf.');
    }
    if (!/Median/i.test(hostText) || !/Akzeptiert/i.test(hostText)) {
      failures.push('Host zeigt keine verständliche Statistik-Kurzfassung.');
    }
    if (!/Rundenvergleich/i.test(hostText) || !/n(ä|ae)her am Referenzwert/i.test(hostText)) {
      failures.push('Host zeigt den Rundenvergleich nicht verständlich zusammengefasst.');
    }
    if (!/Top 5/.test(hostText)) {
      failures.push('Host-Scoreboard fehlt.');
    }
    if (!/Team-Wertung/.test(hostText)) {
      failures.push('Host-Teamwertung fehlt.');
    }
    for (const name of TEAM_NAMES) {
      if (!hostText.includes(name)) {
        failures.push(`Host zeigt Team "${name}" nicht.`);
      }
    }

    for (const sampleIndex of clientSampleIndexes) {
      const participant = participants[sampleIndex];
      const { text, screenshotPath, darkActive } = await openClientResult(
        browser,
        code,
        questionId,
        participant,
        sampleIndex,
      );
      clientScreenshots.push(screenshotPath);
      if (!darkActive) {
        failures.push(`${participant.nickname} läuft nicht im Dark Theme.`);
      }
      if (!/Deine Antwort:/.test(text) || !valueMatcher(participant.round2).test(text)) {
        failures.push(
          `${participant.nickname} sieht keine eigene Runde-2-Auswertung (${participant.round2}).`,
        );
      }
      if (!/Referenzwert:\s*1789/.test(text) || !/Akzeptierter Wert:\s*1789/.test(text)) {
        failures.push(`${participant.nickname} sieht Referenzwert oder akzeptierten Wert nicht.`);
      }
      if (/1\.789/.test(text)) {
        failures.push(`${participant.nickname} sieht Jahreszahlen weiterhin mit Tausenderpunkt.`);
      }
      const expectedInBand = participant.round2 === 1789;
      if (expectedInBand && !/Im Toleranzband/.test(text)) {
        failures.push(`${participant.nickname} sieht keinen Toleranzband-Treffer.`);
      }
      if (!expectedInBand && !/Außerhalb des Toleranzbands/.test(text)) {
        failures.push(`${participant.nickname} sieht keine Außerhalb-Einordnung.`);
      }
      if (
        !/(näher am Referenzwert|weiter weg vom Referenzwert|Gleich nah am Referenzwert)/.test(text)
      ) {
        failures.push(`${participant.nickname} sieht keinen Runde-1/Runde-2-Vergleich.`);
      }
      if (
        !/(Dein Score|Dein Ergebnis)/.test(text) ||
        !/Punkte/.test(text) ||
        !/Gesamt/.test(text)
      ) {
        failures.push(`${participant.nickname} sieht keine persönliche Scorecard.`);
      }
      if (!text.includes(participant.joined.teamName)) {
        failures.push(`${participant.nickname} sieht das eigene Team nicht.`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`SESSION_CODE=${code}`);
  console.log(`HOST_URL=${BASE_URL}/session/${code}/host`);
  console.log(`VOTE_URL=${BASE_URL}/session/${code}/vote`);
  console.log(`SCREENSHOT_HOST=${OUT_HOST_RESULTS}`);
  for (const screenshot of clientScreenshots) {
    console.log(`SCREENSHOT_CLIENT=${screenshot}`);
  }
  console.log(
    `TEAMS=${teamLeaderboard.map((entry) => `${entry.teamName}:${entry.memberCount}`).join(',')}`,
  );
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FEHLER ${failure}`);
    }
    process.exit(1);
  }
  logStep(true, 'Dark-Team-Schätzfrage sichtbar', `${clientSampleIndexes.length}/20 Clients`);
}

await run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
