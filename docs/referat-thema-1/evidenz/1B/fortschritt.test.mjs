// Prüft fortschritt.sh: Schrittanzeige von labor.sh up wie unter Windows (Format-Dauer, Get-Restzeit),
// ergänzt um die Zeit seit Beginn und das voraussichtliche Ende.
// Aufruf: node --test docs/referat-thema-1/evidenz/1B/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bash = (code) =>
  execFileSync('bash', ['-c', `source "$0"; ${code}`, join(here, 'fortschritt.sh')], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Europe/Berlin' },
  }).trimEnd();

test('fs_dauer zeigt Sekunden wie Format-Dauer unter Windows', () => {
  assert.equal(bash('fs_dauer 5'), '0:05');
  assert.equal(bash('fs_dauer 125'), '2:05');
  assert.equal(bash('fs_dauer 3725'), '1:02:05');
});

test('fs_restzeit summiert die geschätzten Sekunden der offenen Schritte', () => {
  const plan = bash('fs_plan').split(' ').map(Number);
  assert.equal(plan.length, 7);
  const summe = plan.reduce((a, b) => a + b, 0);
  assert.equal(Number(bash('fs_restzeit 0')), summe);
  assert.equal(Number(bash('fs_restzeit 2')), summe - plan[0] - plan[1]);
  assert.equal(Number(bash('fs_restzeit 7')), 0);
});

test('fs_schritt zeigt Nummer, Text, Zeit seit Beginn, Restzeit und Ende', () => {
  const beginn = 1794585600; // 2026-11-13T17:00:00+01:00
  const zeile = bash(
    `FS_BEGINN=${beginn} FS_JETZT=${beginn + 600} fs_schritt 3 'VMs anlegen' '10 min'`,
  );
  const rest = Number(bash('fs_restzeit 2'));
  const ende = new Date((beginn + 600 + rest) * 1000).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
  // Leerzeile davor wie Write-Host '' in labor.ps1, damit sich der Schritt von der Ausgabe abhebt.
  assert.match(zeile, /^\n\[3\/7\] VMs anlegen \(dauert 10 min\)/);
  assert.match(zeile, / - seit Beginn 10:00, noch etwa \d+:\d\d(:\d\d)?, fertig gegen \d\d:\d\d$/);
  assert.ok(zeile.endsWith(`fertig gegen ${ende}`), zeile);
});

test('fs_schritt ohne FS_BEGINN setzt den Beginn beim ersten Schritt', () => {
  const zeile = bash(
    `FS_JETZT=1794585600; fs_schritt 1 'Voraussetzungen' '10 s'; echo "beginn=$FS_BEGINN"`,
  );
  assert.match(zeile, /seit Beginn 0:00/);
  assert.match(zeile, /beginn=1794585600$/);
});

test('fs_schritt lässt die Dauer weg, wenn keine angegeben ist (wie Format-SchrittZeile)', () => {
  const zeile = bash(`FS_BEGINN=1794585600 FS_JETZT=1794585605 fs_schritt 7 'Prüfen' ''`);
  assert.match(zeile, /^\n\[7\/7\] Prüfen - seit Beginn 0:05, noch etwa /);
});

test('fs_schritt schreibt nichts auf stderr', () => {
  const r = spawnSync(
    'bash',
    ['-c', 'source "$0"; FS_JETZT=1794585600 fs_schritt 1 Test 1s', join(here, 'fortschritt.sh')],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
});
