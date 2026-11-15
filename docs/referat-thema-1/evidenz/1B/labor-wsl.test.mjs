// Prüft labor-wsl.sh ohne Windows: powershell.exe, ssh.exe, cmd.exe und wslpath sind Attrappen, die ihre
// Argumente protokollieren. So ist belegt, welche Windows-Programme mit welchen Argumenten aufgerufen werden.
// Aufruf: node --test docs/referat-thema-1/evidenz/1B/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
let t, bin, protokoll, winhome;

before(() => {
  t = mkdtempSync(join(tmpdir(), 'labor-wsl-'));
  bin = join(t, 'bin');
  winhome = join(t, 'Users', 'niklas');
  protokoll = join(t, 'aufrufe.log');
  mkdirSync(bin);
  mkdirSync(join(winhome, 'labor-1b'), { recursive: true });
  writeFileSync(join(winhome, 'labor-1b', 'einstellungen.json'), '{"VmDir":"D:\\\\arsnova-1b"}');
  const attrappe = (name, aus = '') =>
    writeFileSync(
      join(bin, name),
      `#!/bin/bash\nprintf '%s|' ${name} "$@" >> ${protokoll}\necho >> ${protokoll}\n${aus}\n`,
    );
  attrappe('powershell.exe', 'echo "ausgabe von labor.ps1"');
  attrappe('ssh.exe', 'echo "ausgabe aus der vm"');
  attrappe('cmd.exe', 'printf "C:\\\\Users\\\\niklas\\r\\n"');
  // wslpath: -w macht aus einem Linux-Pfad einen Windows-Pfad, ohne Option umgekehrt.
  writeFileSync(
    join(bin, 'wslpath'),
    `#!/bin/bash\nif [ "$1" = -w ]; then echo "W:$2"; else echo "${winhome}"; fi\n`,
  );
  for (const n of ['powershell.exe', 'ssh.exe', 'cmd.exe', 'wslpath'])
    chmodSync(join(bin, n), 0o755);
});
after(() => rmSync(t, { recursive: true, force: true }));

function lauf(...args) {
  writeFileSync(protokoll, '');
  const out = execFileSync('bash', [join(here, 'labor-wsl.sh'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LAB_WSL_TEST: '1' },
  });
  const alle = readFileSync(protokoll, 'utf8').trim().split('\n').filter(Boolean);
  return { out, aufrufe: alle.filter((l) => !l.startsWith('cmd.exe|')) };
}

test('status ruft labor.ps1 über powershell.exe ohne Admin-Fenster auf', () => {
  const { out, aufrufe } = lauf('status');
  assert.match(out, /ausgabe von labor\.ps1/);
  assert.equal(aufrufe.length, 1);
  assert.match(
    aufrufe[0],
    /^powershell\.exe\|-NoProfile\|-ExecutionPolicy\|Bypass\|-File\|W:.*labor\.ps1\|-Mode\|status\|$/,
  );
});

test('Zusatzparameter gehen unverändert an labor.ps1', () => {
  const { aufrufe } = lauf('lauf', '-LabN', '1', '-LabTag', 'dev-stoerung');
  assert.match(aufrufe[0], /\|-Mode\|lauf\|-LabN\|1\|-LabTag\|dev-stoerung\|$/);
});

test('up läuft mit Admin-Rückfrage (Start-Process -Verb RunAs)', () => {
  const { aufrufe } = lauf('up');
  assert.match(
    aufrufe[0],
    /^powershell\.exe\|-NoProfile\|-Command\|.*Start-Process.*-Verb RunAs.*-Mode up/,
  );
});

test('vm llm schickt den Befehl per ssh.exe mit Laborschlüssel und known_hosts aus dem VM-Ordner', () => {
  const { out, aufrufe } = lauf('vm', 'llm', 'docker ps');
  assert.match(out, /ausgabe aus der vm/);
  const a = aufrufe[0];
  assert.match(a, /^ssh\.exe\|/);
  assert.match(a, /\|-i\|W:.*\.ssh\/arsnova-1b_ed25519\|/);
  assert.match(a, /UserKnownHostsFile=D:\/arsnova-1b\/known_hosts/);
  assert.match(a, /\|labor@192\.168\.150\.20\|docker ps\|$/);
});

test('vm app nimmt die IP des app-hosts', () => {
  assert.match(lauf('vm', 'app', 'true').aufrufe[0], /\|labor@192\.168\.150\.10\|true\|$/);
});

test('unbekannte VM wird abgelehnt', () => {
  assert.throws(() => lauf('vm', 'db', 'true'), /app oder llm/);
});

test('--arbeitsstand legt refs/labor/arbeitsstand mit nicht committeten Änderungen an und übergibt -Commit', () => {
  const r = join(t, 'repo');
  execFileSync('bash', [
    '-c',
    `git init -q ${r} && cd ${r} && echo a > a.txt && git add a.txt && git -c user.name=t -c user.email=t@t commit -qm a && echo neu > b.txt`,
  ]);
  writeFileSync(protokoll, '');
  // Aufruf außerhalb des Repos: der Index muss über LAB_REPO gefunden werden, nicht über das
  // aktuelle Verzeichnis (git-path ist relativ; in einem Worktree ist .git eine Datei).
  execFileSync('bash', [join(here, 'labor-wsl.sh'), 'lauf', '-LabTag', 'dev-x', '--arbeitsstand'], {
    encoding: 'utf8',
    cwd: t,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LAB_WSL_TEST: '1', LAB_REPO: r },
  });
  const sha = execFileSync('git', ['-C', r, 'rev-parse', 'refs/labor/arbeitsstand'], {
    encoding: 'utf8',
  }).trim();
  const head = execFileSync('git', ['-C', r, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.notEqual(sha, head, 'Arbeitsstand ist ein eigener Commit');
  assert.match(
    execFileSync('git', ['-C', r, 'show', '--name-only', '--format=', sha], { encoding: 'utf8' }),
    /b\.txt/,
  );
  assert.equal(
    execFileSync('git', ['-C', r, 'status', '--porcelain'], { encoding: 'utf8' }).trim(),
    '?? b.txt',
    'Arbeitsbaum und Index unverändert',
  );
  const aufruf = readFileSync(protokoll, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('powershell.exe|'));
  assert.match(aufruf, new RegExp(`\\|-Mode\\|lauf\\|-LabTag\\|dev-x\\|-Commit\\|${sha}\\|$`));
});

test('up zeigt bei Fehler das Ende des Logs und gibt den Exit-Code weiter (Admin-Fenster ist dann zu)', async () => {
  const { spawnSync } = await import('node:child_process');
  const fehlerBin = join(t, 'bin-fehler');
  mkdirSync(fehlerBin, { recursive: true });
  for (const n of ['ssh.exe', 'cmd.exe', 'wslpath'])
    writeFileSync(join(fehlerBin, n), readFileSync(join(bin, n)));
  writeFileSync(join(fehlerBin, 'powershell.exe'), '#!/bin/bash\nexit 3\n');
  for (const n of ['powershell.exe', 'ssh.exe', 'cmd.exe', 'wslpath'])
    chmodSync(join(fehlerBin, n), 0o755);
  writeFileSync(
    join(winhome, 'labor-1b', 'log-up-20261113T190000.txt'),
    'Schritt 9\r\nFEHLER: llm-start.sh im llm-host fehlgeschlagen\r\n',
  );
  const r = spawnSync('bash', [join(here, 'labor-wsl.sh'), 'up'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${fehlerBin}:${process.env.PATH}`, LAB_WSL_TEST: '1' },
  });
  rmSync(join(winhome, 'labor-1b', 'log-up-20261113T190000.txt'));
  assert.equal(r.status, 3);
  assert.match(r.stderr + r.stdout, /FEHLER: llm-start\.sh im llm-host fehlgeschlagen/);
});
