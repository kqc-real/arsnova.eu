#!/usr/bin/env node
// Nur im llm-host über den Labor-Wrapper aufrufen. Keine Aktivierung beim Import.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, appendFile, rm, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { faultCommands } from './experiment.mjs';

const runtime = 'arsnova-open-weight-llm';
const stateFile = (dir) => join(dir, 'state.json');
const save = (dir, state) => writeFile(stateFile(dir), JSON.stringify(state), { mode: 0o600 });
async function journal(dir, event) {
  await appendFile(
    join(dirname(dir), 'stoerung-journal.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n',
    { mode: 0o600 },
  );
}

function matchesF2Drop(line, iface) {
  const args = line.trim().split(/\s+/);
  const value = (flag) => args[args.indexOf(flag) + 1];
  return (
    args[0] === '-A' &&
    args[1] === 'ufw-user-input' &&
    !args.includes('!') &&
    value('-i') === iface &&
    value('-p') === 'tcp' &&
    value('--dport') === '8080' &&
    ['192.168.150.10', '192.168.150.10/32'].includes(value('-s')) &&
    ['192.168.150.20', '192.168.150.20/32'].includes(value('-d')) &&
    value('-j') === 'DROP'
  );
}
const kernelInputRules = async (run) =>
  (await run(['sudo', 'iptables', '-S', 'ufw-user-input']))
    .split('\n')
    .filter((line) => line.startsWith('-A ufw-user-input '));

export async function applyFault({
  variant,
  delayMs = 0,
  stateDir,
  iface,
  run,
  ensureVm,
  startFake,
  stopFake,
}) {
  if (
    !['l1', 'l2', 'l3', 'f1', 'f2', 'busy', 'race'].includes(variant) ||
    !Number.isInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 900000
  )
    throw new Error('Ungültige Störung.');
  const plan = faultCommands(variant, iface);
  await mkdir(dirname(stateDir), { recursive: true, mode: 0o700 });
  await mkdir(stateDir, { mode: 0o700 }); // Ein vorhandenes Lease nie überschreiben.
  const state = {
    version: 1,
    variant,
    iface,
    undoArmed: false,
    restoreRuntime: false,
    fake: null,
    ...(variant === 'f2' ? { f2RuleVersion: 2 } : {}),
  };
  const context = { stateDir, iface, run, ensureVm, startFake, stopFake };
  await save(stateDir, state);
  try {
    await ensureVm();
    if (['l1', 'l2'].includes(variant)) {
      const before = await run(['sudo', 'tc', 'qdisc', 'show', 'dev', iface]);
      if (
        !/qdisc (noqueue|fq_codel|mq) 0: root/.test(before) ||
        /qdisc \S+ (?!0:)\S+:/.test(before)
      )
        throw new Error('Vorhandene qdisc wird nicht überschrieben.');
      state.qdiscBefore = before;
    }
    if (variant === 'f2') {
      const status = await run(['sudo', 'ufw', 'status']);
      if (!status.includes('Status: active') || status.includes('arsnova-1b-experiment'))
        throw new Error('Firewall inaktiv oder eigene Regel bereits vorhanden.');
      if ((await kernelInputRules(run)).some((line) => matchesF2Drop(line, iface)))
        throw new Error('Vorhandene DROP-Regel wird nicht übernommen.');
    }
    if (['f1', 'l3', 'busy', 'race'].includes(variant)) {
      if ((await run(['docker', 'inspect', '-f', '{{.State.Running}}', runtime])).trim() !== 'true')
        throw new Error('Runtime muss vor der Störung laufen.');
      state.restoreRuntime = true;
      await save(stateDir, state);
      await journal(stateDir, { phase: 'apply', command: ['docker', 'stop', runtime] });
      await run(['docker', 'stop', runtime]);
      if (variant !== 'f1') {
        const mode = variant === 'l3' ? 'delay' : variant;
        state.fake = await startFake(mode, delayMs, async (fake) => {
          state.fake = fake;
          await save(stateDir, state);
        });
        await save(stateDir, state);
        await journal(stateDir, { phase: 'apply', fakeMode: mode, delayMs });
      }
    }
    for (const command of plan.apply) {
      state.undoArmed = true;
      await save(stateDir, state);
      await journal(stateDir, { phase: 'apply', command });
      const output = await run(command);
      if (variant === 'f2')
        await journal(stateDir, { phase: 'apply-result', command, output: output.trim() });
    }
    if (variant === 'f2') {
      const status = await run(['sudo', 'ufw', 'status']);
      const rules = await kernelInputRules(run);
      if (!status.includes('arsnova-1b-experiment') || !matchesF2Drop(rules[0] ?? '', iface))
        throw new Error('Aktive vorrangige DROP-Regel nicht bestätigt.');
      await journal(stateDir, {
        phase: 'verified',
        variant,
        kernelRule: rules[0],
        ufwStatus: status,
      });
    }
    await journal(stateDir, { phase: 'active', variant });
    return state;
  } catch (error) {
    try {
      await undoFault(context);
    } catch {
      throw new Error('Aktivierung und Rücknahme fehlgeschlagen; Lease und Journal prüfen.');
    }
    throw error;
  }
}

export async function undoFault({ stateDir, run, ensureVm, stopFake }) {
  let state;
  try {
    state = JSON.parse(await readFile(stateFile(stateDir), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { active: false };
    throw error;
  }
  await ensureVm();
  if (
    state.version !== 1 ||
    !['l1', 'l2', 'l3', 'f1', 'f2', 'busy', 'race'].includes(state.variant)
  )
    throw new Error('Ungültiges Störungs-Lease.');
  if (state.variant === 'f2' && state.f2RuleVersion !== undefined && state.f2RuleVersion !== 2)
    throw new Error('Unbekannte F2-Regelversion.');
  const plan = faultCommands(state.variant, state.iface, {
    f2InterfaceScoped: state.f2RuleVersion === 2,
  });
  if (state.fake) await stopFake(state.fake);
  if (state.undoArmed) {
    for (const command of plan.undo) {
      await journal(stateDir, { phase: 'undo', command });
      // Nur die reservierte qdisc entfernen; nach fehlgeschlagenem add kann sie fehlen.
      if (
        ['l1', 'l2'].includes(state.variant) &&
        !(await run(['sudo', 'tc', 'qdisc', 'show', 'dev', state.iface])).includes('1b00:')
      )
        continue;
      // ufw kann insert trotz Exitcode 0 überspringen. Ohne eigene Regel nichts löschen.
      if (
        state.variant === 'f2' &&
        !(await run(['sudo', 'ufw', 'status'])).includes('arsnova-1b-experiment')
      )
        continue;
      await run(command);
    }
    const after = await run(
      state.variant === 'f2'
        ? ['sudo', 'ufw', 'status']
        : ['sudo', 'tc', 'qdisc', 'show', 'dev', state.iface],
    );
    if (after.includes(state.variant === 'f2' ? 'arsnova-1b-experiment' : '1b00:'))
      throw new Error('Rücknahme nicht bestätigt.');
    if (
      state.variant === 'f2' &&
      state.f2RuleVersion === 2 &&
      (await kernelInputRules(run)).some((line) => matchesF2Drop(line, state.iface))
    )
      throw new Error('DROP-Regel im Kernel noch vorhanden.');
  }
  if (state.restoreRuntime) {
    await journal(stateDir, { phase: 'undo', command: ['docker', 'start', runtime] });
    await run(['docker', 'start', runtime]);
  }
  await journal(stateDir, { phase: 'restored', variant: state.variant });
  await rm(stateDir, { recursive: true });
  return { restored: true, variant: state.variant };
}

export function processIdentity(stat, cmdline, fakePath) {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  if (fields[0] === 'Z' || fields[0] === 'X') return null;
  if (!cmdline.split('\0').includes(fakePath)) throw new Error('PID gehört nicht zum Labor-Fake.');
  return fields[19];
}

async function main() {
  const exec = promisify(execFile);
  const run = async (args) =>
    (await exec(args[0], args.slice(1), { timeout: 120000, env: { ...process.env, LC_ALL: 'C' } }))
      .stdout;
  const ensureVm = async () => {
    const interfaces = JSON.parse(await run(['ip', '-j', '-4', 'addr', 'show']));
    if (!interfaces.some((i) => i.addr_info?.some((a) => a.local === '192.168.150.20')))
      throw new Error('Störungen ausschließlich im llm-host.');
  };
  await ensureVm();
  const [action, variant, delay = '0'] = process.argv.slice(2);
  const stateDir = join(homedir(), 'labor-1b', 'stoerung-lease');
  const route = JSON.parse(await run(['ip', '-j', 'route', 'get', '192.168.150.10']));
  const iface = route[0]?.dev;
  const fakePath = fileURLToPath(new URL('./fake-runtime.mjs', import.meta.url));
  const identity = async (pid) => {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
    const cmd = await readFile(`/proc/${pid}/cmdline`, 'utf8');
    return processIdentity(stat, cmd, fakePath);
  };
  const stopFake = async (lease) => {
    let current;
    try {
      current = await identity(lease.pid);
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
    if (current === null) return;
    if (current !== lease.start) throw new Error('Fake-PID wurde wiederverwendet.');
    process.kill(-lease.pid, 'SIGTERM');
    for (let i = 0; i < 50; i++) {
      await wait(100);
      try {
        if ((await identity(lease.pid)) === null) return;
      } catch (e) {
        if (e.code === 'ENOENT') return;
        throw e;
      }
    }
    if ((await identity(lease.pid)) === lease.start) process.kill(-lease.pid, 'SIGKILL');
  };
  const startFake = async (mode, delayMs, record) => {
    const log = await open(join(stateDir, 'fake.log'), 'a', 0o600);
    const child = spawn(
      process.execPath,
      [fakePath, '--mode', mode, '--delay-ms', String(delayMs)],
      { detached: true, stdio: ['ignore', log.fd, log.fd] },
    );
    try {
      await once(child, 'spawn');
    } finally {
      await log.close();
    }
    child.unref();
    const lease = { pid: child.pid, start: await identity(child.pid) };
    await record(lease);
    try {
      const token = (await readFile('.env.llm', 'utf8')).match(
        /^OPEN_WEIGHT_LLM_TOKEN=([^\r\n]+)$/m,
      )?.[1];
      for (let i = 0; i < 50; i++) {
        try {
          const response = await fetch('http://192.168.150.20:8080/slots?fail_on_no_slot=1', {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(1000),
          });
          await response.text();
          if (response.status === (mode === 'busy' ? 503 : 200)) return lease;
        } catch {}
        await wait(200);
      }
      throw new Error('Fake nicht bereit.');
    } catch (error) {
      await stopFake(lease);
      throw error;
    }
  };
  const context = { stateDir, iface, run, ensureVm, startFake, stopFake };
  let result;
  if (action === 'apply')
    result = await applyFault({ variant, delayMs: Number(delay), ...context });
  else if (action === 'undo') result = await undoFault(context);
  else throw new Error('Aufruf: fault-vm.mjs apply VARIANTE VERZÖGERUNG_MS | undo');
  process.stdout.write(JSON.stringify(result) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    process.stderr.write('Störungshelfer fehlgeschlagen; Lease/Journal im llm-host prüfen.\n');
    process.exitCode = 1;
  });
