import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyFault, undoFault } from './fault-vm.mjs';

async function fixture(t, failAt = 0) {
  const dir = await mkdtemp(join(tmpdir(), '1b-fault-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  let mutations = 0;
  let qdisc = 'qdisc noqueue 0: root';
  let drop = false;
  const context = {
    stateDir: join(dir, 'lease'),
    iface: 'eth0',
    ensureVm: async () => {},
    startFake: async () => ({ pid: 123, start: '456' }),
    stopFake: async () => {},
    run: async (args) => {
      calls.push(args);
      if (args.includes('show')) return qdisc;
      if (args[0] === 'sudo' && args[1] === 'ufw' && args[2] === 'status')
        return 'Status: active' + (drop ? '\n8080 DENY IN # arsnova-1b-experiment' : '');
      if (args[1] === 'iptables')
        return (
          (drop
            ? '-A ufw-user-input -i eth0 -s 192.168.150.10/32 -d 192.168.150.20/32 -p tcp -m tcp --dport 8080 -j DROP\n'
            : '') +
          '-A ufw-user-input -s 192.168.150.10/32 -d 192.168.150.20/32 -p tcp --dport 8080 -j ACCEPT'
        );
      if (args[0] === 'docker' && args[1] === 'inspect') return 'true';
      mutations++;
      if (mutations === failAt) throw new Error('injected failure');
      if (args[1] === 'ufw') drop = args.includes('insert');
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

test('übersprungene ufw-Regel wird trotz Exitcode null nicht als aktive Störung akzeptiert', async (t) => {
  const { context, calls } = await fixture(t);
  const run = context.run;
  context.run = async (args) => {
    if (args.includes('insert')) {
      calls.push(args);
      return 'Skipping inserting existing rule';
    }
    return run(args);
  };
  await assert.rejects(applyFault({ variant: 'f2', ...context }), /DROP.*bestätigt/);
  assert.ok(!calls.some((c) => c.includes('delete')));
  await assert.rejects(readFile(join(context.stateDir, 'state.json')), { code: 'ENOENT' });
});

test('ufw-Status ohne vorrangige Kernel-DROP-Regel genügt nicht als Aktivierungsnachweis', async (t) => {
  const { context } = await fixture(t);
  const run = context.run;
  let afterInsert = false;
  context.run = async (args) => {
    if (args[1] === 'iptables' && afterInsert)
      return '-A ufw-user-input -s 192.168.150.10/32 -d 192.168.150.20/32 -p tcp --dport 8080 -j ACCEPT';
    const output = await run(args);
    if (args.includes('insert')) afterInsert = true;
    if (args.includes('delete')) afterInsert = false;
    return output;
  };
  await assert.rejects(applyFault({ variant: 'f2', ...context }), /DROP.*bestätigt/);
  await assert.rejects(readFile(join(context.stateDir, 'state.json')), { code: 'ENOENT' });
});

test('aktive F2-Regel wird im Kernel bestätigt und samt gebundener Schnittstelle entfernt', async (t) => {
  const { context, calls } = await fixture(t);
  const state = await applyFault({ variant: 'f2', ...context });
  assert.equal(state.f2RuleVersion, 2);
  const journal = await readFile(join(context.stateDir, '..', 'stoerung-journal.jsonl'), 'utf8');
  assert.match(journal, /"phase":"verified"/);
  await undoFault(context);
  const insert = calls.find((c) => c.includes('insert'));
  const remove = calls.find((c) => c.includes('delete'));
  assert.deepEqual(insert.slice(4), remove.slice(4));
  assert.ok(insert.includes('eth0'));
});

test('alte F2-Leases entfernen weiterhin genau die frühere ungebundene Regel', async (t) => {
  const { context, calls } = await fixture(t);
  await applyFault({ variant: 'f2', ...context });
  const file = join(context.stateDir, 'state.json');
  const state = JSON.parse(await readFile(file, 'utf8'));
  delete state.f2RuleVersion;
  await writeFile(file, JSON.stringify(state));
  await undoFault(context);
  const remove = calls.find((c) => c.includes('delete'));
  assert.ok(!remove.includes('eth0'));
});

test('eine bereits vorhandene passende Kernelregel wird weder übernommen noch gelöscht', async (t) => {
  const { context, calls } = await fixture(t);
  const run = context.run;
  context.run = async (args) => {
    if (args[1] === 'iptables')
      return '-A ufw-user-input -i eth0 -s 192.168.150.10/32 -d 192.168.150.20/32 -p tcp --dport 8080 -j DROP';
    return run(args);
  };
  await assert.rejects(applyFault({ variant: 'f2', ...context }), /Vorhandene DROP/);
  assert.ok(!calls.some((c) => c.includes('insert') || c.includes('delete')));
});

test('ein nach Rücknahme verbleibender Kernel-DROP hält das Lease offen', async (t) => {
  const { context } = await fixture(t);
  await applyFault({ variant: 'f2', ...context });
  const run = context.run;
  context.run = async (args) => {
    if (args[1] === 'iptables')
      return '-A ufw-user-input -i eth0 -s 192.168.150.10/32 -d 192.168.150.20/32 -p tcp --dport 8080 -j DROP';
    return run(args);
  };
  await assert.rejects(undoFault(context), /Kernel noch vorhanden/);
  assert.equal(
    JSON.parse(await readFile(join(context.stateDir, 'state.json'), 'utf8')).f2RuleVersion,
    2,
  );
});
