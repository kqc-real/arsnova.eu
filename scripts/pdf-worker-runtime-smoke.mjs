import { readFile, stat, statfs, writeFile, rm } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';

const EXPECTED_TMPFS_BYTES = 256 * 1024 * 1024;
const MAX_MEMORY_BYTES = 1024 * 1024 * 1024;
const MAX_PIDS = 128;
const socketPath = process.env.PDF_WORKER_SOCKET_PATH || '/run/pdf-worker/render.sock';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertProcessRestrictions() {
  assert(process.getuid?.() !== 0, 'PDF-Worker läuft als root');
  const status = await readFile('/proc/self/status', 'utf8');
  assert(/^NoNewPrivs:\s+1$/m.test(status), 'PDF-Worker: no-new-privileges fehlt');
  assert(/^CapEff:\s+0+$/m.test(status), 'PDF-Worker besitzt effektive Capabilities');
  assert(/^Seccomp:\s+2$/m.test(status), 'PDF-Worker läuft nicht unter Seccomp-Filtermodus');
}

async function assertReadOnlyRootFilesystem() {
  const probe = '/home/node/.arsnova-pdf-worker-write-probe';
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
  throw new Error('PDF-Worker-Root-Dateisystem ist beschreibbar');
}

async function assertTmpfsAndSocket() {
  const filesystem = await statfs('/tmp');
  const totalBytes = Number(filesystem.bsize) * Number(filesystem.blocks);
  assert(totalBytes <= EXPECTED_TMPFS_BYTES, `PDF-Worker-/tmp ist zu groß: ${totalBytes}`);
  const socket = await stat(socketPath);
  assert(socket.isSocket(), 'PDF-Worker-Socket fehlt');
  assert((socket.mode & 0o777) === 0o600, 'PDF-Worker-Socket ist nicht 0600');
  assert(socket.uid === process.getuid?.(), 'PDF-Worker-Socket gehört nicht dem Worker-UID');
}

async function assertCgroupLimits() {
  const [memoryRaw, pidsRaw, cpuRaw] = await Promise.all([
    readFile('/sys/fs/cgroup/memory.max', 'utf8'),
    readFile('/sys/fs/cgroup/pids.max', 'utf8'),
    readFile('/sys/fs/cgroup/cpu.max', 'utf8'),
  ]);
  const memory = Number(memoryRaw.trim());
  const pids = Number(pidsRaw.trim());
  const [quotaRaw, periodRaw] = cpuRaw.trim().split(/\s+/);
  const quota = Number(quotaRaw);
  const period = Number(periodRaw);
  assert(
    Number.isFinite(memory) && memory <= MAX_MEMORY_BYTES,
    `Ungültiges RAM-Limit: ${memoryRaw}`,
  );
  assert(Number.isFinite(pids) && pids <= MAX_PIDS, `Ungültiges PID-Limit: ${pidsRaw}`);
  assert(
    Number.isFinite(quota) && Number.isFinite(period) && quota / period <= 1,
    `Ungültiges CPU-Limit: ${cpuRaw}`,
  );
}

function assertNoNetworkOrSecrets() {
  const externalInterfaces = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses ?? []).filter((address) => !address.internal).map(() => name),
  );
  assert(externalInterfaces.length === 0, `PDF-Worker besitzt Netzwerk: ${externalInterfaces}`);
  for (const name of [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ADMIN_SECRET',
    'ADMIN_DIAGNOSTIC_SECRET',
  ]) {
    assert(!process.env[name], `PDF-Worker erhielt verbotenes Secret: ${name}`);
  }
}

await assertProcessRestrictions();
await assertReadOnlyRootFilesystem();
await assertTmpfsAndSocket();
await assertCgroupLimits();
assertNoNetworkOrSecrets();

console.log('PDF-Worker-Isolation, Ressourcenlimits und Secret-Grenze erfolgreich geprüft.');
