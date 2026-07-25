import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { buildSessionResultsPdf } from '../apps/backend/dist/lib/session-results-report-pdf.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertReadOnlyRootFilesystem() {
  const probe = '/home/node/.arsnova-rootfs-write-probe';
  try {
    await writeFile(probe, 'must not be writable');
  } catch (error) {
    assert(
      error && typeof error === 'object' && ['EACCES', 'EROFS'].includes(error.code),
      `Unerwarteter Rootfs-Probe-Fehler: ${String(error)}`,
    );
    return;
  }

  await rm(probe, { force: true });
  throw new Error('Root-Dateisystem ist beschreibbar');
}

async function assertWritableTmp() {
  const probe = `/tmp/arsnova-runtime-smoke-${process.pid}`;
  await writeFile(probe, 'ok');
  await access(probe, constants.R_OK | constants.W_OK);
  await rm(probe);
}

async function assertProcessRestrictions() {
  assert(process.getuid?.() !== 0, 'Container läuft als root');
  const status = await readFile('/proc/self/status', 'utf8');
  assert(/^NoNewPrivs:\s+1$/m.test(status), 'no-new-privileges ist nicht aktiv');
  assert(/^CapEff:\s+0+$/m.test(status), 'Effektive Linux-Capabilities sind nicht leer');
}

async function assertPdfRuntime() {
  const pdf = await buildSessionResultsPdf({
    sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
    sessionCode: 'ABC123',
    quizName: 'Container Runtime Smoke',
    finishedAt: '2026-07-25T00:00:00.000Z',
    participantCount: 1,
    teamMode: false,
    questions: [
      {
        questionOrder: 0,
        questionTextShort: 'Was ist 2+2?',
        questionTextFull: 'Was ist **2+2**?',
        type: 'SINGLE_CHOICE',
        participantCount: 1,
        optionDistribution: [
          { text: '4', count: 1, percentage: 100, isCorrect: true },
          { text: '5', count: 0, percentage: 0, isCorrect: false },
        ],
      },
    ],
  });
  assert(pdf.subarray(0, 4).toString('utf8') === '%PDF', 'Chromium erzeugte keine PDF-Datei');
}

await assertProcessRestrictions();
await assertReadOnlyRootFilesystem();
await assertWritableTmp();
await assertPdfRuntime();

console.log('Container-Härtung und Chromium-PDF-Smoke erfolgreich.');
