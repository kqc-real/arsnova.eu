import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile),
  library = resolve('docs/referat-thema-1/evidenz/1B/experiment-lauf.sh');
async function scenario(body) {
  const dir = await mkdtemp(join(tmpdir(), '1b-restore-'));
  try {
    await writeFile(
      join(dir, 'ssh-stub'),
      `#!/bin/bash\nprintf '%s\\n' "$*" >>"$out/commands"\n[[ "$*" != *' undo' || "\${FAIL_UNDO:-0}" == 0 ]]\n`,
      { mode: 0o700 },
    );
    await writeFile(join(dir, 'pruefen.sh'), 'exit 0\n');
    const script = `set -euo pipefail\nexport out="$1"\nEV="$out"\nLLM=("$out/ssh-stub")\nsource "$2"\nruntime_frisch(){ echo fresh >>"$out/commands"; }\naufraeumen(){ echo cleanup >>"$out/commands"; }\n${body}`;
    let code = 0;
    try {
      await exec('bash', ['-c', script, 'test', dir, library]);
    } catch (e) {
      code = e.code;
    }
    const commands = await readFile(join(dir, 'commands'), 'utf8');
    let restored = null;
    try {
      restored = JSON.parse(await readFile(join(dir, 'wiederherstellung.json'), 'utf8'));
    } catch {}
    return { code, commands, restored };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test('Abbruch nimmt die aktivierte Störung zurück und prüft beide VMs', async () => {
  const r = await scenario(
    'experiment_offen=1; experiment_pruefen=1\ntrap lauf_ende EXIT\nexit 17',
  );
  assert.equal(r.code, 17);
  assert.match(r.commands, /undo\nfresh\n.*pruefen.sh llm/);
  assert.deepEqual(r.restored, { restored: true, checksPassed: true });
});
test('fehlgeschlagene Rücknahme bleibt Fehler und behauptet keine Wiederherstellung', async () => {
  const r = await scenario('export FAIL_UNDO=1\nexperiment_offen=1\ntrap lauf_ende EXIT\nexit 0');
  assert.equal(r.code, 1);
  assert.equal(r.restored, null);
  assert.doesNotMatch(r.commands, /fresh/);
});
test('erfolgreiche explizite Rücknahme wird im EXIT-Trap nicht wiederholt', async () => {
  const r = await scenario(
    'experiment_offen=1; experiment_pruefen=1\ntrap lauf_ende EXIT\nexperiment_zuruecknehmen',
  );
  assert.equal(r.code, 0);
  assert.equal(r.commands.match(/ undo/g)?.length, 1);
});

test('Kontext bleibt nach Fehler-Rückkehr aus lauf() für den EXIT-Trap erhalten', async () => {
  const r = await scenario(`
    lauf(){
      experiment_kontext "$out"
      experiment_offen=1
      experiment_pruefen=1
      trap lauf_ende EXIT
      return 19
    }
    lauf
  `);
  assert.equal(r.code, 19);
  assert.match(r.commands, / undo/);
  assert.deepEqual(r.restored, { restored: true, checksPassed: true });
});

test('vorhandenes Störungs-Lease blockiert einen neuen Lauf vor dem Runtime-Neustart', async () => {
  const r = await scenario(`
    "\${LLM[@]}" true
    LLM=(false)
    experiment_lease_pruefen
    runtime_frisch
  `);
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.commands, /fresh/);
});
