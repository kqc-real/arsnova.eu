// Prüft die Bash-Umsetzung der Größenregel (groessen.sh) gegen groessen-faelle.json.
// Dieselben Fälle prüft groessen.Tests.ps1 für die PowerShell-Umsetzung.
// Aufruf: node --test docs/referat-thema-1/evidenz/1B/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { faelle } = JSON.parse(readFileSync(join(here, 'groessen-faelle.json'), 'utf8'));

function empfehlung({ kerne, threads, ramGib, kernJeCpu }) {
  const out = execFileSync(
    'bash',
    [
      '-c',
      'source "$0"; groessen_empfehlung "$@"',
      join(here, 'groessen.sh'),
      String(kerne),
      String(threads),
      String(ramGib),
      kernJeCpu.join(','),
    ],
    { encoding: 'utf8' },
  );
  return JSON.parse(out);
}

for (const fall of faelle) {
  test(`Bash: ${fall.name}`, () => {
    const ist = empfehlung(fall.eingabe);
    if (fall.erwartet.abbruch) {
      assert.equal(ist.abbruch, fall.erwartet.abbruch);
      return;
    }
    assert.deepEqual(ist, fall.erwartet);
  });
}

const { pruefFaelle } = JSON.parse(readFileSync(join(here, 'groessen-faelle.json'), 'utf8'));
for (const fall of pruefFaelle) {
  test(`Bash prüfen: ${fall.name}`, () => {
    const { kerne, threads, ramGib } = fall.rechner;
    const w = fall.werte;
    const out = execFileSync(
      'bash',
      [
        '-c',
        'source "$0"; groessen_pruefen "$@"',
        join(here, 'groessen.sh'),
        ...[
          kerne,
          threads,
          ramGib,
          w.llmVcpu,
          w.llmRamGib,
          w.appVcpu,
          w.appRamGib,
          w.llmDiskGib,
          w.appDiskGib,
        ].map(String),
      ],
      { encoding: 'utf8' },
    );
    assert.equal(out.trim(), fall.fehler);
  });
}

const { ressourcenFaelle } = JSON.parse(readFileSync(join(here, 'groessen-faelle.json'), 'utf8'));
for (const fall of ressourcenFaelle) {
  test(`Bash Ressourcen: ${fall.name}`, () => {
    const out = execFileSync(
      'bash',
      [
        '-c',
        'source "$0"; groessen_ressourcen "$@"',
        join(here, 'groessen.sh'),
        ...[
          fall.frei.ramGib,
          fall.frei.diskGib,
          fall.plan.ramGib,
          fall.plan.diskGib,
          fall.reserveGib ?? '',
        ]
          .filter((x) => x !== '')
          .map(String),
      ],
      { encoding: 'utf8' },
    );
    assert.deepEqual(JSON.parse(out), fall.erwartet);
  });
}
