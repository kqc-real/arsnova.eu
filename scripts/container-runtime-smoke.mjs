import { access, mkdtemp, readFile, rm, statfs, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { buildSessionResultsPdf } from '../apps/backend/dist/lib/session-results-report-pdf.js';

const EXPECTED_TMPFS_BYTES = 256 * 1024 * 1024;

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
  const tempDirectory = await mkdtemp('/tmp/arsnova-runtime-smoke-');
  try {
    const probe = join(tempDirectory, 'write-probe');
    await writeFile(probe, 'ok', { flag: 'wx', mode: 0o600 });
    await access(probe, constants.R_OK | constants.W_OK);
    const filesystem = await statfs('/tmp');
    const totalBytes = Number(filesystem.bsize) * Number(filesystem.blocks);
    assert(
      totalBytes <= EXPECTED_TMPFS_BYTES,
      `/tmp ist größer als das produktive 256-MiB-Limit (${totalBytes} Byte)`,
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function assertProcessRestrictions() {
  assert(process.getuid?.() !== 0, 'Container läuft als root');
  const status = await readFile('/proc/self/status', 'utf8');
  assert(/^NoNewPrivs:\s+1$/m.test(status), 'no-new-privileges ist nicht aktiv');
  assert(/^CapEff:\s+0+$/m.test(status), 'Effektive Linux-Capabilities sind nicht leer');
}

async function assertPdfRuntime() {
  const questions = Array.from({ length: 200 }, (_, questionOrder) => ({
    questionOrder,
    questionTextShort: `Frage ${questionOrder + 1}`,
    questionTextFull:
      `## Frage ${questionOrder + 1}\n\n` +
      'Ein repräsentativer **Markdown-Bericht** mit Formel $x^2 + y^2 = z^2$ und zehn Optionen.',
    type: 'SINGLE_CHOICE',
    participantCount: 500,
    optionDistribution: Array.from({ length: 10 }, (_, optionIndex) => ({
      text: `Option ${optionIndex + 1}`,
      count: optionIndex === 0 ? 500 : 0,
      percentage: optionIndex === 0 ? 100 : 0,
      isCorrect: optionIndex === 0,
    })),
  }));
  const pdf = await buildSessionResultsPdf({
    sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
    sessionCode: 'ABC123',
    quizName: 'Container Runtime Smoke – 200 Fragen',
    finishedAt: '2026-07-25T00:00:00.000Z',
    participantCount: 500,
    teamMode: false,
    questions,
  });
  assert(pdf.subarray(0, 4).toString('utf8') === '%PDF', 'Chromium erzeugte keine PDF-Datei');
}

await assertProcessRestrictions();
await assertReadOnlyRootFilesystem();
await assertWritableTmp();
await assertPdfRuntime();

console.log('Container-Härtung und Chromium-PDF-Smoke erfolgreich.');
