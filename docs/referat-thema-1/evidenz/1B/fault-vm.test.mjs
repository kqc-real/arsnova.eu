import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyFault, undoFault } from './fault-vm.mjs';

async function fixture(t, failAt = 0) {
  const dir = await mkdtemp(join(tmpdir(), '1b-fault-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  let mutations = 0;
  let qdisc = 'qdisc noqueue 0: root';
  const context = {
    stateDir: join(dir, 'lease'),
    iface: 'eth0',
    ensureVm: async () => {},
    startFake: async () => ({ pid: 123, start: '456' }),
    stopFake: async () => {},
    run: async (args) => {
      calls.push(args);
      if (args.includes('show')) return qdisc;
      if (args[0] === 'sudo' && args[1] === 'ufw' && args[2] === 'status') return 'Status: active';
      if (args[0] === 'docker' && args[1] === 'inspect') return 'true';
      mutations++;
      if (mutations === failAt) throw new Error('injected failure');
      if (args.includes('qdisc') && args.includes('root'))
        qdisc = args.includes('add') ? 'qdisc prio 1b00: root' : 'qdisc noqueue 0: root';
      return '';
    },
  };
  return { context, calls };
}
test('teilweise gesetztes netem wird bei Fehler zurückgenommen', async (t) => {
  const { context, calls } = await fixture(t, 2);
  await assert.rejects(applyFault({ variant: 'l1', ...context }), /injected/);
  assert.ok(calls.some((c) => c.includes('del') && c.includes('1b00:')));
  await assert.rejects(readFile(join(context.stateDir, 'state.json')), { code: 'ENOENT' });
});
test('Lease verhindert Überschreiben; Rücknahme ist wiederholbar', async (t) => {
  const { context, calls } = await fixture(t);
  await applyFault({ variant: 'l2', ...context });
  const count = calls.length;
  await assert.rejects(applyFault({ variant: 'f2', ...context }), /existiert|EEXIST/);
  assert.equal(calls.length, count);
  await undoFault(context);
  await undoFault(context);
});
test('Fake und Runtime werden bei Beendigung zurückgesetzt', async (t) => {
  const { context, calls } = await fixture(t);
  let stopped = false;
  context.stopFake = async (lease) => {
    assert.equal(lease.pid, 123);
    stopped = true;
  };
  await applyFault({ variant: 'l3', delayMs: 310000, ...context });
  assert.ok(calls.some((c) => c.join(' ') === 'docker stop arsnova-open-weight-llm'));
  await undoFault(context);
  assert.equal(stopped, true);
  assert.ok(calls.some((c) => c.join(' ') === 'docker start arsnova-open-weight-llm'));
});
test('fehlgeschlagene Rücknahme lässt Lease zur Wiederherstellung stehen', async (t) => {
  const { context } = await fixture(t);
  await applyFault({ variant: 'f2', ...context });
  const run = context.run;
  context.run = async (args) => {
    if (args.includes('delete')) throw new Error('undo failed');
    return run(args);
  };
  await assert.rejects(undoFault(context), /undo failed/);
  const state = JSON.parse(await readFile(join(context.stateDir, 'state.json'), 'utf8'));
  assert.equal(state.variant, 'f2');
});
test('fremde qdisc und inaktive Firewall werden vor Änderungen abgewiesen', async (t) => {
  for (const variant of ['l1', 'f2']) {
    const { context, calls } = await fixture(t);
    context.run = async (args) => {
      calls.push(args);
      return args.includes('show') ? 'qdisc netem 123: root' : 'Status: inactive';
    };
    await assert.rejects(applyFault({ variant, ...context }));
    assert.ok(!calls.some((c) => c.includes('add') || c.includes('insert')));
  }
});

test('Zombie-Fake gilt bei Rücknahme als beendet, fremde PID bleibt geschützt', async () => {
  const { processIdentity } = await import('./fault-vm.mjs');
  const stat = (state) =>
    `42 (node) ${state} ` +
    Array.from({ length: 19 }, (_, i) => (i === 18 ? '1234' : '0')).join(' ');
  assert.equal(processIdentity(stat('Z'), '', '/fake.mjs'), null);
  assert.equal(processIdentity(stat('S'), 'node\0/fake.mjs\0', '/fake.mjs'), '1234');
  assert.throws(() => processIdentity(stat('S'), 'node\0/other.mjs\0', '/fake.mjs'), /PID/);
});
