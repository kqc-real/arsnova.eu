// Prüft die Erfassung der Umgebung (vm-info.sh in einer VM, umgebung.sh auf dem Linux-Rechner).
// Beide laufen hier ohne VMs: vm-info.sh beschreibt den Rechner selbst, umgebung.sh mit LAB_OHNE_VMS=1.
// Aufruf: node --test docs/referat-thema-1/evidenz/1B/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const json = (cmd, args, env = {}) =>
  JSON.parse(execFileSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...env } }));

test('vm-info.sh liefert Kernel, Betriebssystem, CPUs und RAM als JSON', () => {
  const v = json('bash', [join(here, 'vm-info.sh')]);
  assert.match(v.kernel, /^\d+\.\d+/);
  assert.ok(v.os.length > 0);
  assert.ok(Number.isInteger(v.cpus) && v.cpus > 0);
  assert.ok(v.ramGib > 0);
  assert.ok('docker' in v && 'cpuModell' in v);
});

test('umgebung.sh beschreibt Rechner und Hypervisor nach Schema 1b-umgebung-1', () => {
  const u = json('bash', [join(here, 'umgebung.sh')], { LAB_OHNE_VMS: '1' });
  assert.equal(u.schema, '1b-umgebung-1');
  assert.equal(u.rechner.plattform, 'linux');
  assert.ok(u.rechner.cpu.length > 0);
  assert.ok(u.rechner.kerne > 0 && u.rechner.threads >= u.rechner.kerne);
  assert.ok(u.rechner.ramGib > 0);
  assert.match(u.rechner.kernel, /^\d+\.\d+/);
  assert.ok('energieprofil' in u.rechner && 'netzteil' in u.rechner && 'speicherort' in u.rechner);
  assert.equal(u.hypervisor.name, 'KVM/QEMU (libvirt)');
  assert.ok('version' in u.hypervisor && 'pinning' in u.hypervisor);
  assert.deepEqual(u.vms, []);
  assert.match(u.laborStand.commit, /^[0-9a-f]{40}$/);
});
