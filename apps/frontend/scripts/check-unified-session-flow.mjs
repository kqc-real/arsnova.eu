#!/usr/bin/env node
/**
 * Smoke-Test für den Unified-Live-Session-Flow:
 * Quiz + Fragen + Blitz-Feedback unter einem Session-Code.
 *
 * Run:
 *   BASE_URL=http://localhost:4200 npm run smoke:unified-session -w @arsnova/frontend
 */
import pg from 'pg';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';
const EXISTING_SESSION_CODE = (process.env.SESSION_CODE || '').trim().toUpperCase();
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 430, height: 932 };
const CHANNEL_LABELS = ['Quiz', 'Fragen', 'Blitz-Feedback'];
const QA_HOST_HINTS = ['Hier sammelst und moderierst', 'Vorab-Moderation ist aktiv'];
const QA_HOST_READY_HINTS = [...QA_HOST_HINTS, 'Gesamt:', 'Warten auf Freigabe:'];
const QA_PIN_LABEL = 'Hervorheben';
const QUICK_FEEDBACK_TITLE = 'ja · nein · vielleicht';
const SMOKE_QUESTIONS = {
  editorPrompt: 'Welche Funktion testen wir?',
  editorCorrectAnswer: 'Unified Flow',
  editorDistractor: 'Nur Quiz',
  participantFirst: 'Kommt Kapitel 4 in der Klausur vor?',
  participantSecond: 'Kannst du das Beispiel noch einmal erklären?',
};
const { Client } = pg;

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Server noch nicht bereit
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

async function waitForPath(page, predicate, arg = null, timeout = 30_000) {
  await page.waitForFunction(predicate, arg, { timeout });
}

async function waitForHostRoute(page) {
  await waitForPath(page, () => location.pathname.startsWith('/session/') && location.pathname.endsWith('/host'));
}

async function waitForVoteRoute(page, code) {
  await waitForPath(page, (sessionCode) => location.pathname === `/session/${sessionCode}/vote`, code);
}

async function visibleText(page) {
  return page.locator('body').innerText();
}

async function fillFirstTextInput(page, value) {
  const candidates = page.locator('input[type="text"], input:not([type]), input[matinput], textarea');
  const count = await candidates.count();
  for (let index = 0; index < count; index++) {
    const field = candidates.nth(index);
    if (await field.isVisible().catch(() => false)) {
      await field.fill(value);
      return true;
    }
  }
  return false;
}

async function chooseJoinIdentity(page, fallbackName) {
  const typed = await fillFirstTextInput(page, fallbackName);
  if (typed) {
    return { ok: true, mode: 'text' };
  }

  const combobox = page.getByRole('combobox').first();
  if (await combobox.isVisible().catch(() => false)) {
    await combobox.click();
    await page.waitForTimeout(300);
    const options = page.getByRole('option');
    const count = await options.count();
    for (let index = 0; index < count; index++) {
      const option = options.nth(index);
      const text = ((await option.innerText().catch(() => '')) || '').trim();
      const disabled = await option.getAttribute('aria-disabled').catch(() => null);
      if (text && !text.includes('Bitte wählen') && disabled !== 'true') {
        await option.click();
        await page.waitForTimeout(300);
        return { ok: true, mode: 'select', value: text };
      }
    }
  }

  return { ok: false, mode: 'none' };
}

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  console.log(`${prefix}${label}${detail ? ` — ${detail}` : ''}`);
}

function logWarn(label, detail = '') {
  console.log(`WARN ${label}${detail ? ` — ${detail}` : ''}`);
}

function extractSessionCode(url) {
  return url.match(/\/session\/([A-Z0-9]{6})\/host/)?.[1] ?? null;
}

function hasAllChannelLabels(text) {
  return CHANNEL_LABELS.every((label) => text.includes(label));
}

function containsAny(text, snippets) {
  return snippets.some((snippet) => text.includes(snippet));
}

async function loadReusableSessionCodes() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `
        SELECT code
        FROM "Session"
        WHERE "qaEnabled" = TRUE
          AND "quickFeedbackEnabled" = TRUE
          AND status IN ('LOBBY', 'ACTIVE')
        ORDER BY
          CASE status WHEN 'LOBBY' THEN 0 ELSE 1 END,
          "statusChangedAt" DESC,
          "startedAt" DESC
        LIMIT 12
      `,
    );
    return result.rows.map((row) => String(row.code || '').trim().toUpperCase()).filter(Boolean);
  } finally {
    await client.end();
  }
}

async function openReusableSession(host, warnings) {
  let codes = [];
  try {
    codes = await loadReusableSessionCodes();
  } catch (error) {
    warnings.push(`Fallback auf bestehende Session konnte die Datenbank nicht lesen: ${error.message}`);
    logWarn('Bestehende Session konnte nicht geladen werden', error.message);
    return null;
  }

  if (codes.length === 0) {
    warnings.push('Keine bestehende Unified-Session für den Smoke-Test gefunden.');
    logWarn('Keine bestehende Unified-Session gefunden');
    return null;
  }

  for (const code of codes) {
    try {
      await host.goto(`${BASE_URL}/session/${code}/host`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await host.waitForTimeout(1_800);
      const text = await visibleText(host);
      if (text.includes('Quiz') && text.includes('Fragen') && text.includes('Blitz-Feedback')) {
        logStep(true, 'Bestehende Host-Session automatisch gefunden', code);
        return code;
      }
    } catch (error) {
      warnings.push(`Bestehende Session ${code} konnte nicht geöffnet werden: ${error.message}`);
    }
  }

  warnings.push('Es wurde keine oeffnungsfaehige bestehende Unified-Session gefunden.');
  logWarn('Keine oeffnungsfaehige Unified-Session gefunden');
  return null;
}

async function main() {
  console.log(`Warte auf ${BASE_URL}…`);
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.error(`App nicht erreichbar unter ${BASE_URL}.`);
    process.exit(1);
  }

  const browser = await launchBrowser();
  const hardFailures = [];
  const warnings = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    const participantContext = await browser.newContext({ viewport: MOBILE });
    const presenterContext = await browser.newContext({ viewport: DESKTOP });

    const host = await hostContext.newPage();
    const participant = await participantContext.newPage();
    const presenter = await presenterContext.newPage();

    const quizName = `Unified Flow ${Date.now()}`;
    let sessionCode = EXISTING_SESSION_CODE || null;

    if (!sessionCode) {
      await host.goto(`${BASE_URL}/quiz/new`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await host.locator('input').first().fill(quizName);
      await host.getByRole('button', { name: 'Quiz erstellen' }).click();
      await host.waitForTimeout(1_000);
      await host.locator("textarea[aria-label='Fragetext eingeben']").fill(SMOKE_QUESTIONS.editorPrompt);
      await host.locator("input[aria-label='Antworttext eingeben']").nth(0).fill(SMOKE_QUESTIONS.editorCorrectAnswer);
      await host.locator("input[aria-label='Antworttext eingeben']").nth(1).fill(SMOKE_QUESTIONS.editorDistractor);
      await host.getByRole('button', { name: /Hinzufügen/ }).click();
      await host.waitForTimeout(1_200);
      const editorText = await visibleText(host);
      if (editorText.includes('1 Fragen') || editorText.includes('1 Frage')) {
        logStep(true, 'Minimal-Quiz angelegt');
      } else {
        hardFailures.push('Minimal-Quiz wurde im Editor nicht bestätigt.');
        logStep(false, 'Minimal-Quiz angelegt');
      }

      await host.goto(`${BASE_URL}/quiz?startLive=1`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await host.waitForTimeout(1_800);
      const dialogText = await visibleText(host);
      if (dialogText.includes('Veranstaltung starten') && dialogText.includes('Zusätzlich aktivieren')) {
        logStep(true, 'Live-Startdialog geöffnet');
      } else {
        hardFailures.push('Live-Startdialog konnte nicht geöffnet werden.');
        logStep(false, 'Live-Startdialog geöffnet');
      }

      const quickFeedbackCard = host.getByRole('button', { name: /Blitz-Feedback/ }).first();
      if ((await quickFeedbackCard.innerText()).includes('Aus')) {
        await quickFeedbackCard.click();
        await host.waitForTimeout(250);
      }

      await host.getByRole('button', { name: /^Veranstaltung starten$/ }).last().click();
      await host.waitForTimeout(1_500);
      const afterStartText = await visibleText(host);
      if (afterStartText.includes('Zu viele Sessions')) {
        logWarn('Rate-Limit beim Session-Start', 'suche bestehende Unified-Session');
        sessionCode = await openReusableSession(host, warnings);
        if (!sessionCode) {
          hardFailures.push(
            'Session-Start wurde durch das Rate-Limit blockiert und es konnte keine bestehende Unified-Session als Fallback gefunden werden.',
          );
          logStep(false, 'Host-Session gestartet', 'Rate-Limit aktiv');
        }
      } else {
        await waitForHostRoute(host);
        await host.waitForTimeout(2_000);
        sessionCode = extractSessionCode(host.url());
      }
      if (!sessionCode) {
        hardFailures.push('Session-Code in der Host-URL nicht gefunden.');
        logStep(false, 'Host-Session gestartet');
      } else {
        logStep(true, 'Host-Session gestartet', sessionCode);
      }
    } else {
      await host.goto(`${BASE_URL}/session/${sessionCode}/host`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await host.waitForTimeout(2_000);
      logStep(true, 'Bestehende Host-Session verwendet', sessionCode);
    }

    if (!sessionCode) {
      throw new Error('Smoke-Test abgebrochen: Session-Code fehlt.');
    }

    const hostText = await visibleText(host);
    if (hasAllChannelLabels(hostText)) {
      logStep(true, 'Host sieht alle Kanal-Tabs');
    } else {
      hardFailures.push('Host-Tabs für Quiz/Fragen/Blitz-Feedback fehlen.');
      logStep(false, 'Host sieht alle Kanal-Tabs');
    }

    await host.locator('.session-channel-tabs').getByText('Fragen').first().click();
    await host.waitForTimeout(700);
    const hostQaText = await visibleText(host);
    if (containsAny(hostQaText, QA_HOST_READY_HINTS)) {
      logStep(true, 'Host kann Fragen-Tab öffnen');
    } else {
      hardFailures.push('Host-Fragen-Tab zeigt keinen Moderationsbereich.');
      logStep(false, 'Host kann Fragen-Tab öffnen');
    }

    await participant.goto(`${BASE_URL}/join/${sessionCode}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await participant.waitForTimeout(1_800);
    const identity = await chooseJoinIdentity(participant, 'SmokeTester');
    if (!identity.ok) {
      warnings.push('Join-Formular bot weder sichtbaren Freitext noch eine nutzbare Namensauswahl.');
      logWarn('Join-Identität nicht vorbereitet');
    } else {
      logStep(true, 'Join-Identität gewählt', identity.mode === 'select' ? identity.value ?? 'Select' : 'Freitext');
    }
    await participant.getByRole('button', { name: /Jetzt beitreten/ }).click();
    await waitForVoteRoute(participant, sessionCode);
    await participant.waitForTimeout(2_000);
    logStep(true, 'Teilnehmer ist beigetreten', participant.url());

    const participantText = await visibleText(participant);
    if (hasAllChannelLabels(participantText)) {
      logStep(true, 'Teilnehmer sieht alle Kanal-Tabs');
    } else {
      hardFailures.push('Teilnehmer-Tabs für Quiz/Fragen/Blitz-Feedback fehlen.');
      logStep(false, 'Teilnehmer sieht alle Kanal-Tabs');
    }

    await participant.locator('.session-channel-tabs').getByText('Fragen').first().click();
    await participant.waitForTimeout(800);
    await participant.locator('#qa-draft').fill(SMOKE_QUESTIONS.participantFirst);
    await participant.getByRole('button', { name: 'Frage senden' }).click();
    await participant.waitForTimeout(800);
    await participant.locator('#qa-draft').fill(SMOKE_QUESTIONS.participantSecond);
    await participant.getByRole('button', { name: 'Frage senden' }).click();
    await participant.waitForTimeout(1_200);
    const participantQaText = await visibleText(participant);
    if (
      participantQaText.includes(SMOKE_QUESTIONS.participantFirst) &&
      participantQaText.includes(SMOKE_QUESTIONS.participantSecond)
    ) {
      logStep(true, 'Teilnehmer sieht eigene Fragen');
    } else {
      hardFailures.push('Teilnehmer sieht eingereichte Fragen nicht in der Q&A-Liste.');
      logStep(false, 'Teilnehmer sieht eigene Fragen');
    }

    await host.locator('.session-channel-tabs').getByText('Fragen').first().click();
    await host.waitForTimeout(1_500);
    const hostQaListText = await visibleText(host);
    if (
      hostQaListText.includes(SMOKE_QUESTIONS.participantFirst) &&
      hostQaListText.includes(SMOKE_QUESTIONS.participantSecond)
    ) {
      logStep(true, 'Host sieht eingereichte Fragen');
    } else {
      hardFailures.push('Host sieht eingereichte Fragen nicht in der Moderationsliste.');
      logStep(false, 'Host sieht eingereichte Fragen');
    }

    const firstQaCard = host.locator('.session-qa-card', { hasText: SMOKE_QUESTIONS.participantFirst }).first();
    const pinButton = firstQaCard.getByRole('button', { name: QA_PIN_LABEL });
    if (await pinButton.isVisible().catch(() => false)) {
      await pinButton.click();
      await host.waitForTimeout(1_200);
      logStep(true, 'Host hebt eine Frage hervor');
    } else {
      hardFailures.push('Host konnte keine Frage hervorheben.');
      logStep(false, 'Host hebt eine Frage hervor');
    }

    await presenter.goto(`${BASE_URL}/session/${sessionCode}/present`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await presenter.waitForTimeout(2_200);
    const presenterText = await visibleText(presenter);
    if (presenterText.includes('Wird gerade beantwortet') && presenterText.includes(SMOKE_QUESTIONS.participantFirst)) {
      logStep(true, 'Presenter zeigt hervorgehobene Frage');
    } else {
      hardFailures.push('Presenter zeigt die hervorgehobene Frage nicht.');
      logStep(false, 'Presenter zeigt hervorgehobene Frage');
    }
    if (presenterText.includes('Als Nächstes im Raum') && presenterText.includes(SMOKE_QUESTIONS.participantSecond)) {
      logStep(true, 'Presenter zeigt Q&A-Warteschlange');
    } else {
      hardFailures.push('Presenter zeigt die aktive Q&A-Warteschlange nicht.');
      logStep(false, 'Presenter zeigt Q&A-Warteschlange');
    }

    await host.locator('.session-channel-tabs').getByText('Blitz-Feedback').first().click();
    await host.waitForTimeout(900);
    const hostFeedbackText = await visibleText(host);
    const feedbackStartButton = host.getByRole('button', { name: QUICK_FEEDBACK_TITLE });
    if (await feedbackStartButton.isVisible().catch(() => false)) {
      await feedbackStartButton.click();
      await host.waitForTimeout(1_200);
    }
    const hostFeedbackAfterStartText = await visibleText(host);
    if (hostFeedbackAfterStartText.includes(QUICK_FEEDBACK_TITLE)) {
      logStep(true, 'Host startet Blitz-Feedback-Runde');
    } else {
      hardFailures.push('Host konnte die Blitz-Feedback-Runde nicht starten.');
      logStep(false, 'Host startet Blitz-Feedback-Runde');
    }

    await participant.locator('.session-channel-tabs').getByText('Blitz-Feedback').first().click();
    await participant.waitForTimeout(1_500);
    const participantFeedbackText = await visibleText(participant);
    if (participantFeedbackText.includes(QUICK_FEEDBACK_TITLE)) {
      logStep(true, 'Teilnehmer sieht aktive Blitz-Feedback-Runde');
    } else {
      hardFailures.push('Teilnehmer sieht die gestartete Blitz-Feedback-Runde nicht.');
      logStep(false, 'Teilnehmer sieht aktive Blitz-Feedback-Runde');
    }

    await participant.getByRole('button', { name: 'Ja' }).click();
    await participant.waitForTimeout(1_000);
    const participantAfterVoteText = await visibleText(participant);
    if (participantAfterVoteText.includes('Danke für dein Feedback!')) {
      logStep(true, 'Teilnehmer kann Blitz-Feedback absenden');
    } else {
      hardFailures.push('Teilnehmer erhielt nach Blitz-Feedback-Vote keine Bestätigung.');
      logStep(false, 'Teilnehmer kann Blitz-Feedback absenden');
    }

    await host.waitForTimeout(3_500);
    const hostAfterVoteText = await visibleText(host);
    if (
      hostAfterVoteText.includes('1 Stimme') ||
      hostAfterVoteText.includes('1 Stimmen') ||
      hostAfterVoteText.includes('1 (100 %)') ||
      hostAfterVoteText.includes('👍\n1')
    ) {
      logStep(true, 'Host sieht Blitz-Feedback-Ergebnis');
    } else {
      warnings.push('Host-Ergebnis blieb im Smoke-Test nach Teilnehmer-Vote auf 0 Stimmen.');
      logWarn('Host sieht Blitz-Feedback-Ergebnis nicht sofort');
    }

    console.log(`\nSession-Code: ${sessionCode}`);
    if (warnings.length > 0) {
      console.log('\nWarnungen:');
      for (const warning of warnings) {
        console.log(`- ${warning}`);
      }
    }

    await presenterContext.close();
    await participantContext.close();
    await hostContext.close();
  } finally {
    await browser.close();
  }

  if (hardFailures.length > 0) {
    console.error('\nFehlgeschlagene Prüfschritte:');
    for (const failure of hardFailures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('\n✓ Unified-Session-Smoke-Test bestanden.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
