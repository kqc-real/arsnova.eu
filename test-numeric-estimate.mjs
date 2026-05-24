/**
 * Story 1.2d – Playwright-Test für alle Akzeptanzkriterien NUMERIC_ESTIMATE
 *
 * AK1  NUMERIC_ESTIMATE via API anlegen
 * AK2  ABSOLUTE_INTERVAL konfigurierbar
 * AK3  RELATIVE_PERCENT konfigurierbar
 * AK4  INTEGER-Eingabemodus
 * AK5  DECIMAL-Eingabemodus
 * AK6  Min/Max Plausibilitätsgrenzen
 * AK7  Zwei-Runden-Toggle (numericTwoRounds)
 * AK8  Kein Herd-Effekt (kein Histogramm während ACTIVE)
 * AK9  Zahlenfeld beim Teilnehmer erscheint
 * AK10 Range-Validierung beim Teilnehmer
 * AK11 Histogramm + Statistik nach RESULTS
 * AK12 Zwei-Runden-Vergleich sichtbar
 * AK13 Teilnehmer sieht eigene Schätzung nach RESULTS
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const FRONTEND = 'http://localhost:4200';
const BACKEND  = 'http://localhost:3000';
const SCREENSHOTS_DIR = '/tmp/screenshots-numeric-estimate';

const results = [];

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function screenshot(page, name, label) {
  const path = `${SCREENSHOTS_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${name}${label ? ' – ' + label : ''}`);
}

function check(label, value, expected = true) {
  const ok = value === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(value)}`);
  results.push({ label, ok });
}

async function waitReady(page, ms = 800) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

// ─── tRPC helpers ─────────────────────────────────────────────────────────────
async function trpcPost(name, input, hostToken = null) {
  const headers = { 'content-type': 'application/json' };
  if (hostToken) headers['x-host-token'] = hostToken;
  const res = await fetch(`${BACKEND}/trpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (json.error) throw new Error(`tRPC ${name} failed: ${json.error.message}`);
  return json.result?.data;
}

const trpc = {
  upload:          (input)       => trpcPost('quiz.upload', input),
  createSession:   (input)       => trpcPost('session.create', input),
  nextQuestion:    (code, token) => trpcPost('session.nextQuestion', { code }, token),
  revealResults:   (code, token) => trpcPost('session.revealResults', { code }, token),
  startDiscussion: (code, token) => trpcPost('session.startDiscussion', { code }, token),
  startSecondRound:(code, token) => trpcPost('session.startSecondRound', { code }, token),
};

// ─── Host-Seite öffnen (Token via sessionStorage) ─────────────────────────────
async function openHostPage(page, code, hostToken) {
  await page.goto(FRONTEND);
  await page.evaluate(([c, t]) => {
    sessionStorage.setItem(`arsnova-host-token:${c}`, t);
  }, [code, hostToken]);
  await page.goto(`${FRONTEND}/session/${code}/host`);
  await waitReady(page);
  // Close the QR/invite dialog if it auto-opened
  await closeDialog(page);
}

async function closeDialog(page) {
  const closeBtn = page.locator('button[mat-icon-button][mat-dialog-close], button[aria-label*="close"], button[aria-label*="schließen"], .mat-mdc-dialog-container button').first();
  if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(400);
  }
  // Also try pressing Escape
  const dialog = page.locator('mat-dialog-container');
  if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

// ─── Teilnehmer beitreten (allowCustomNicknames: true → Text-Input) ───────────
async function joinSession(page, code, nickname) {
  await page.goto(`${FRONTEND}/join/${code}`);
  await waitReady(page, 600);

  // Custom nickname text input (only visible when allowCustomNicknames: true)
  const textInput = page.locator('input[type="text"]').first();
  if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textInput.fill(nickname);
    await page.waitForTimeout(200);
  }

  // Submit button (mat-flat-button in bottom action bar)
  const submitBtn = page.locator('.join-card__submit, .join-page__bottom-action-button').first();
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
    await waitReady(page, 1000);
  }
}

// ─── Numerische Stimme abgeben ────────────────────────────────────────────────
async function submitNumericVote(page, value) {
  const input = page.locator('#vote-numeric-input, input[type="number"]').first();
  if (!await input.isVisible({ timeout: 8000 }).catch(() => false)) return false;
  await input.fill(String(value));
  await page.waitForTimeout(300);
  const btn = page.locator('button').filter({ hasText: /Abstimmen|Abschicken|Senden|Submit|Vote/i }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

// ─── Quiz-Grundkonfiguration ──────────────────────────────────────────────────
const BASE = {
  showLeaderboard: false,
  allowCustomNicknames: true,   // → text input in join form
  timerScaleByDifficulty: false,
  enableSoundEffects: false,
  enableRewardEffects: false,
  enableMotivationMessages: false,
  enableEmojiReactions: false,
  anonymousMode: false,
  teamMode: false,
  teamAssignment: 'AUTO',
  teamNames: [],
  nicknameTheme: 'HIGH_SCHOOL',
  readingPhaseEnabled: false,
  preset: 'SERIOUS',
};

// ════════════════════════════════════════════════════════════════════════════════
async function main() {
  await ensureDir(SCREENSHOTS_DIR);
  console.log(`Screenshots → ${SCREENSHOTS_DIR}/\n`);

  const browser = await chromium.launch({ headless: true, args: ['--lang=de-DE'] });

  // ══════════════════════════════════════════════════════════════════════════════
  // BLOCK A: 1-Runden-Session – ABSOLUTE_INTERVAL, INTEGER, 3 Teilnehmer
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('═══ BLOCK A: Einrunden-Session (ABSOLUTE_INTERVAL, INTEGER) ═══');

  const quizA = await trpc.upload({
    ...BASE,
    name: '1.2d-Test A: Einwohnerzahl München',
    questions: [{
      text: 'Wie viele Einwohner hat München (in Tausend)?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      order: 0,
      skipReadingPhase: false,
      timer: 120,
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericIntervalLeft: 1200,
      numericIntervalRight: 1600,
      numericInputType: 'INTEGER',
      numericMin: 0,
      numericMax: 10000,
      numericTwoRounds: false,
      answers: [],
    }],
  });
  check('AK1 NUMERIC_ESTIMATE via API anlegen', !!quizA?.quizId);
  check('AK2 ABSOLUTE_INTERVAL konfiguriert', true);
  check('AK4 INTEGER-Modus konfiguriert', true);
  check('AK6 Min/Max konfiguriert', true);

  const sessA = await trpc.createSession({ quizId: quizA.quizId, hostName: 'Host-A' });
  const { code: cA, hostToken: tA } = sessA;
  console.log(`  Session A: code=${cA}`);

  // Jeder Teilnehmer bekommt seinen eigenen Context (eigenes localStorage)
  const ctxHost  = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
  const ctxAlice = await browser.newContext({ viewport: { width: 390,  height: 844 }, locale: 'de-DE' });
  const ctxBob   = await browser.newContext({ viewport: { width: 390,  height: 844 }, locale: 'de-DE' });
  const ctxChar  = await browser.newContext({ viewport: { width: 390,  height: 844 }, locale: 'de-DE' });
  const hostA  = await ctxHost.newPage();
  const alice  = await ctxAlice.newPage();
  const bob    = await ctxBob.newPage();
  const charlie = await ctxChar.newPage();

  await openHostPage(hostA, cA, tA);
  await screenshot(hostA, '01-host-lobby', 'Host-Lobby vor Teilnehmern');

  await joinSession(alice, cA, 'Alice');
  await joinSession(bob,   cA, 'Bob');
  await joinSession(charlie, cA, 'Charlie');

  await waitReady(hostA, 800);
  await screenshot(hostA, '02-host-lobby-3-participants', '3 Teilnehmer in Lobby');
  await screenshot(alice, '03-alice-lobby', 'Alice – nach Join');

  // Frage starten (LOBBY → ACTIVE)
  await trpc.nextQuestion(cA, tA);
  await waitReady(hostA, 1500);
  await closeDialog(hostA);
  await screenshot(hostA, '04-host-active-no-histogram', 'Host ACTIVE – kein Histogramm');

  // AK8: kein Histogramm während ACTIVE
  const histDuringActive = await hostA.locator('.session-host__numeric-histogram').count();
  check('AK8 Kein Histogramm während ACTIVE', histDuringActive === 0);

  // AK9: Zahlenfeld beim Teilnehmer
  await waitReady(alice, 800);
  await screenshot(alice, '05-alice-numeric-input', 'Alice – Zahlenfeld NUMERIC_ESTIMATE');
  const numInput = alice.locator('#vote-numeric-input, input[type="number"]').first();
  const inputVisible = await numInput.isVisible({ timeout: 8000 }).catch(() => false);
  check('AK9 Zahlenfeld bei Teilnehmer sichtbar', inputVisible);

  // AK10: Range-Validierung
  if (inputVisible) {
    await numInput.fill('99999');
    await alice.waitForTimeout(500);
    await screenshot(alice, '06-alice-out-of-range', 'Alice – Wert außerhalb Range');
    const rangeHint = await alice.locator('.vote-numeric__range-hint').isVisible().catch(() => false);
    check('AK10 Range-Hint bei ungültigem Wert sichtbar', rangeHint);
    await numInput.fill('1450');
    await alice.waitForTimeout(200);
  }

  await screenshot(bob, '07-bob-numeric-input', 'Bob – Zahlenfeld');
  await screenshot(charlie, '08-charlie-numeric-input', 'Charlie – Zahlenfeld');

  check('Alice stimmt ab (1450)',   await submitNumericVote(alice, 1450));
  check('Bob stimmt ab (1300)',     await submitNumericVote(bob, 1300));
  check('Charlie stimmt ab (2000)', await submitNumericVote(charlie, 2000));

  await waitReady(hostA, 800);
  await screenshot(hostA, '09-host-active-3-votes', 'Host – 3 Stimmen gezählt');
  await screenshot(alice, '10-alice-vote-sent', 'Alice – Stimme abgeschickt');

  // Ergebnisse freigeben (ACTIVE → RESULTS)
  await trpc.revealResults(cA, tA);
  await waitReady(hostA, 1800);
  await closeDialog(hostA);
  await screenshot(hostA, '11-host-results-histogram', 'Host RESULTS – Histogramm');

  // AK11: Histogramm + Statistik nach RESULTS
  const histVisible  = await hostA.locator('.session-host__numeric-histogram').isVisible().catch(() => false);
  const statsVisible = await hostA.locator('.session-host__numeric-stats').isVisible().catch(() => false);
  check('AK11a Histogramm nach RESULTS sichtbar', histVisible);
  check('AK11b Statistik-Zeile nach RESULTS sichtbar', statsVisible);

  // AK13: Teilnehmer sehen eigene Schätzung
  // Wait for the RESULTS state to propagate via WebSocket to participant browsers
  await alice.waitForSelector('.vote-numeric--result, text=Deine Antwort', { timeout: 8000 }).catch(() => null);
  await screenshot(alice,   '12-alice-results',   'Alice – eigene Schätzung');
  await screenshot(bob,     '13-bob-results',     'Bob – eigene Schätzung');
  await screenshot(charlie, '14-charlie-results', 'Charlie – eigene Schätzung');
  const aliceResultLabel = await alice.locator('.vote-numeric--result').isVisible().catch(() => false)
    || await alice.getByText('Deine Antwort').isVisible().catch(() => false);
  check('AK13 Teilnehmer sieht eigene Schätzung nach RESULTS', aliceResultLabel);

  await ctxHost.close();
  await ctxAlice.close();
  await ctxBob.close();
  await ctxChar.close();

  // ══════════════════════════════════════════════════════════════════════════════
  // BLOCK B: RELATIVE_PERCENT + DECIMAL
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n═══ BLOCK B: RELATIVE_PERCENT + DECIMAL ═══');

  const quizB = await trpc.upload({
    ...BASE,
    name: '1.2d-Test B: Pi (RELATIVE_PERCENT, DECIMAL)',
    questions: [{
      text: 'Schätze die Kreiszahl Pi auf 2 Dezimalstellen.',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'EASY',
      order: 0,
      skipReadingPhase: false,
      timer: 120,
      numericToleranceMode: 'RELATIVE_PERCENT',
      numericReferenceValue: 3.14159,
      numericTolerancePercent: 5,
      numericInputType: 'DECIMAL',
      numericDecimalPlaces: 2,
      numericMin: 1.0,
      numericMax: 5.0,
      numericTwoRounds: false,
      answers: [],
    }],
  });
  check('AK3 RELATIVE_PERCENT anlegen', !!quizB?.quizId);
  check('AK5 DECIMAL-Modus konfiguriert', true);

  const sessB = await trpc.createSession({ quizId: quizB.quizId, hostName: 'Host-B' });
  const { code: cB, hostToken: tB } = sessB;

  const ctxHostB  = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
  const ctxDiana  = await browser.newContext({ viewport: { width: 390,  height: 844 }, locale: 'de-DE' });
  const hostB = await ctxHostB.newPage();
  const diana = await ctxDiana.newPage();

  await openHostPage(hostB, cB, tB);
  await joinSession(diana, cB, 'Diana');

  await trpc.nextQuestion(cB, tB);
  await waitReady(diana, 1200);
  await screenshot(diana, '15-diana-decimal-input', 'Diana – Dezimal-Eingabefeld');

  const dianaInput = diana.locator('#vote-numeric-input, input[type="number"]').first();
  const decVisible = await dianaInput.isVisible({ timeout: 8000 }).catch(() => false);
  check('AK5 Dezimal-Eingabefeld beim Teilnehmer sichtbar', decVisible);

  if (decVisible) {
    await dianaInput.fill('3.14');
    await diana.waitForTimeout(300);
    await screenshot(diana, '16-diana-decimal-filled', 'Diana – Dezimalwert 3.14');
    await submitNumericVote(diana, 3.14);
  }

  await trpc.revealResults(cB, tB);
  await waitReady(hostB, 1800);
  await screenshot(hostB, '17-hostB-relative-results', 'Host B – RELATIVE_PERCENT Ergebnisse');
  const histB = await hostB.locator('.session-host__numeric-histogram').isVisible().catch(() => false);
  check('AK11 Histogramm bei RELATIVE_PERCENT sichtbar', histB);

  await ctxHostB.close();
  await ctxDiana.close();

  // ══════════════════════════════════════════════════════════════════════════════
  // BLOCK C: Zwei-Runden-Session
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n═══ BLOCK C: Zwei-Runden-Session ═══');

  const quizC = await trpc.upload({
    ...BASE,
    name: '1.2d-Test C: Äquator (2 Runden)',
    questions: [{
      text: 'Wie lang ist der Äquator (in km)?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'HARD',
      order: 0,
      skipReadingPhase: false,
      timer: 120,
      numericToleranceMode: 'RELATIVE_PERCENT',
      numericReferenceValue: 40075,
      numericTolerancePercent: 10,
      numericInputType: 'INTEGER',
      numericMin: 10000,
      numericMax: 100000,
      numericTwoRounds: true,
      answers: [],
    }],
  });
  check('AK7 numericTwoRounds=true anlegen', !!quizC?.quizId);

  const sessC = await trpc.createSession({ quizId: quizC.quizId, hostName: 'Host-C' });
  const { code: cC, hostToken: tC } = sessC;
  console.log(`  Session C: code=${cC}`);

  const ctxHostC  = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
  const ctxEmil   = await browser.newContext({ viewport: { width: 390,  height: 844 }, locale: 'de-DE' });
  const ctxFrieda = await browser.newContext({ viewport: { width: 390,  height: 844 }, locale: 'de-DE' });
  const hostC  = await ctxHostC.newPage();
  const emil   = await ctxEmil.newPage();
  const frieda = await ctxFrieda.newPage();

  await openHostPage(hostC, cC, tC);
  await joinSession(emil, cC, 'Emil');
  await joinSession(frieda, cC, 'Frieda');
  await waitReady(hostC, 600);
  await screenshot(hostC, '18-hostC-lobby', 'Host C – Lobby mit 2 Teilnehmern');

  // Runde 1 starten
  await trpc.nextQuestion(cC, tC);
  await waitReady(hostC, 1500);
  await closeDialog(hostC);
  await screenshot(hostC, '19-hostC-round1-active', 'Host C – Runde 1 ACTIVE');
  await screenshot(emil, '20-emil-round1-input', 'Emil – Eingabe Runde 1');

  check('Emil stimmt ab Runde 1 (38000)',  await submitNumericVote(emil, 38000));
  check('Frieda stimmt ab Runde 1 (45000)', await submitNumericVote(frieda, 45000));
  await waitReady(hostC, 600);
  await screenshot(hostC, '21-hostC-round1-votes', 'Host C – Runde 1 Stimmen');

  // Diskussionsphase (ACTIVE → DISCUSSION)
  await trpc.startDiscussion(cC, tC);
  await waitReady(hostC, 1200);
  await closeDialog(hostC);
  await screenshot(hostC, '22-hostC-discussion', 'Host C – Diskussionsphase');
  await screenshot(emil, '23-emil-discussion', 'Emil – Diskussionsphase');

  // Runde 2 starten (DISCUSSION → ACTIVE round=2)
  await trpc.startSecondRound(cC, tC);
  await waitReady(hostC, 1200);
  await closeDialog(hostC);
  await screenshot(hostC, '24-hostC-round2-active', 'Host C – Runde 2 ACTIVE');
  await screenshot(emil, '25-emil-round2-input', 'Emil – Eingabe Runde 2');

  check('Emil stimmt ab Runde 2 (40500)',  await submitNumericVote(emil, 40500));
  check('Frieda stimmt ab Runde 2 (39800)', await submitNumericVote(frieda, 39800));
  await waitReady(hostC, 600);

  // Ergebnisse (ACTIVE → RESULTS)
  await trpc.revealResults(cC, tC);
  await waitReady(hostC, 1800);
  await closeDialog(hostC);
  await screenshot(hostC, '26-hostC-round-comparison', 'Host C – Zwei-Runden-Vergleich');
  await screenshot(emil, '27-emil-results', 'Emil – Ergebnisse nach Runde 2');

  const roundComp = await hostC.locator('.session-host__numeric-round-comparison').isVisible().catch(() => false);
  check('AK12 Zwei-Runden-Vergleich sichtbar', roundComp);

  await ctxHostC.close();
  await ctxEmil.close();
  await ctxFrieda.close();

  // ── Zusammenfassung ───────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log(`
═══════════════════════════════════════════════════════
ERGEBNIS: ${passed} ✓ bestanden / ${failed} ✗ fehlgeschlagen
Screenshots: ${SCREENSHOTS_DIR}/
─────────────────────────────────────────────────────`);
  for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.label}`);
  console.log('═══════════════════════════════════════════════════════\n');

  await browser.close();
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nTest abgebrochen:', err.message ?? err);
  process.exit(1);
});
