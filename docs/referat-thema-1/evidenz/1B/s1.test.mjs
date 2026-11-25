import assert from 'node:assert/strict';
import { test } from 'node:test';
import { s1Config, checkS1Host, buildS1Result, s1Environment } from './s1.mjs';

test('S1 rejects unapproved variants and oversized series before mutations', () => {
  assert.equal(s1Config({ n: 3, consumer: 'label', tag: 's1-label', timeoutMs: 300000 }).n, 3);
  for (const patch of [
    { n: 4 },
    { n: 0 },
    { consumer: 'breaker-summary' },
    { tag: '' },
    { timeoutMs: 1 },
  ])
    assert.throws(() =>
      s1Config({ n: 3, consumer: 'label', tag: 's1-label', timeoutMs: 300000, ...patch }),
    );
});
const host = {
  addresses: ['192.168.150.20'],
  cpus: 8,
  memoryBytes: 10 * 1024 ** 3,
  availableBytes: 5 * 1024 ** 3,
  diskBytes: 8 * 1024 ** 3,
  foreignContainers: [],
};
test('S1 rejects wrong VM, insufficient reserves and foreign containers', () => {
  assert.doesNotThrow(() => checkS1Host(host));
  for (const patch of [
    { addresses: ['192.168.150.10'] },
    { cpus: 2 },
    { memoryBytes: 4 * 1024 ** 3 },
    { availableBytes: 1024 },
    { diskBytes: 1024 },
    { foreignContainers: ['arsnova-v3-app'] },
  ])
    assert.throws(() => checkS1Host({ ...host, ...patch }));
});
test('private S1 env changes only experiment flags and keeps token bytes', () => {
  const env =
    'OPEN_WEIGHT_LLM_TOKEN=synthetic-token\nOPEN_WEIGHT_LLM_URL=http://192.168.150.20:8080\nQA_SUMMARY_TIMEOUT_MS=90000\nOPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=90000\nQA_SUMMARY_ENABLED=true\nOPEN_WEIGHT_LLM_ENABLED=true\nWORD_CLOUD_SEMANTIC_ENABLED=true\n';
  const result = s1Environment(env, { consumer: 'summary', timeoutMs: 300000 });
  assert.match(result, /OPEN_WEIGHT_LLM_TOKEN=synthetic-token/);
  assert.match(result, /WORD_CLOUD_SEMANTIC_ENABLED=false/);
  assert.match(result, /QA_SUMMARY_TIMEOUT_MS=300000/);
  assert.throws(() =>
    s1Environment(env.replace('192.168.150.20', 'example.com'), {
      consumer: 'label',
      timeoutMs: 300000,
    }),
  );
});
test('S1 result requires all windows and matching immutable image IDs', () => {
  const input = {
    config: s1Config({ n: 1, consumer: 'label', tag: 'dev-s1-label', timeoutMs: 300000 }),
    driver: {
      auftraege: [
        { status: 'ready', measurement: { complete: true, resources: { complete: true } } },
      ],
      live: { windows: [{ complete: true }] },
    },
    sourceImages: { app: 'sha256:a' },
    actualImages: { app: 'sha256:a' },
    restored: true,
  };
  assert.equal(buildS1Result(input).topology, 'same-host-http');
  assert.throws(() => buildS1Result({ ...input, actualImages: { app: 'sha256:b' } }));
  assert.throws(() => buildS1Result({ ...input, restored: false }));
  assert.throws(() => buildS1Result({ ...input, driver: { ...input.driver, auftraege: [] } }));
  assert.throws(() =>
    buildS1Result({
      ...input,
      driver: { ...input.driver, live: { windows: [{ complete: false }] } },
    }),
  );
});

test('S1 host evidence must contain finite measured numbers', () => {
  for (const key of ['cpus', 'memoryBytes', 'availableBytes', 'diskBytes'])
    for (const value of [undefined, NaN, Infinity])
      assert.throws(() => checkS1Host({ ...host, [key]: value }));
});

// Ausschließlich temporäre Dateien und Bash-Funktionen als Docker-/SSH-Ersatz.
const { execFileSync } = await import('node:child_process');
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { resolve, join } = await import('node:path');
const hostScript = resolve('docs/referat-thema-1/evidenz/1B/s1-host.sh');
const definitions = readFileSync(hostScript, 'utf8').split('case "${1:-}" in')[0];
function exerciseUndo(body) {
  const dir = mkdtempSync(join(tmpdir(), '1b-s1-undo-'));
  writeFileSync(join(dir, 'owner'), 'arsnova-1b-s1-v1\n');
  writeFileSync(join(dir, 'started'), '');
  try {
    execFileSync('bash', ['-c', `${definitions}\nlease="$1"\n${body}`, hostScript, dir], {
      stdio: 'pipe',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test('S1 undo never touches Docker on the wrong host, even in a conditional', () => {
  exerciseUndo(`assert_target() { return 1; }
docker() { touch "$lease/unexpected"; return 0; }
if undo; then exit 9; fi
test ! -f "$lease/unexpected"
test -f "$lease/owner"`);
});
test('S1 undo refuses foreign containers and retains lease', () => {
  exerciseUndo(`assert_target() { return 0; }
docker() { if [[ "$1" == inspect ]]; then echo foreign-project; return 0; fi; touch "$lease/unexpected"; }
if undo; then exit 9; fi
test ! -f "$lease/unexpected"
test -f "$lease/owner"`);
});
test('S1 undo retains lease when the runtime cannot be restored', () => {
  exerciseUndo(`assert_target() { return 0; }
docker() { [[ "$1" != inspect ]]; }
bash() { return 1; }
if undo; then exit 9; fi
test -f "$lease/owner"`);
});

test('S1 result rejects unfinished jobs even if the live window completed', () => {
  const config = s1Config({ n: 1, consumer: 'label', tag: 's1-label', timeoutMs: 300000 });
  assert.throws(() =>
    buildS1Result({
      config,
      sourceImages: { app: 'id' },
      actualImages: { app: 'id' },
      restored: true,
      driver: {
        auftraege: [
          { status: 'pending', measurement: { complete: true, resources: { complete: true } } },
        ],
        live: { windows: [{ complete: true }] },
      },
    }),
  );
});

test('S1 dedicated subnet cannot overlap an existing Docker network', async () => {
  const { checkS1Networks } = await import('./s1.mjs');
  assert.doesNotThrow(() => checkS1Networks(['172.17.0.0/16', '192.168.150.0/24']));
  for (const subnet of ['172.31.0.0/16', '172.31.150.0/24', '172.31.150.128/25', '0.0.0.0/0'])
    assert.throws(() => checkS1Networks([subnet]));
});

test('S1 undo withdraws only its scoped firewall rule before a failed runtime restore', () => {
  exerciseUndo(`assert_target() { return 0; }
touch "$lease/firewall-armed"
docker() { [[ "$1" != inspect ]]; }
journal() { printf '%s\\n' "$*" >>"$lease/withdrawn"; }
sudo() {
  if [[ "$*" == 'ufw status' ]]; then echo 'arsnova-1b-s1'; return 0; fi
  if [[ "$*" == 'ufw --force delete allow in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1' ]]; then return 0; fi
  if [[ "$1" == iptables ]]; then return 1; fi
  return 9
}
bash() { return 1; }
if undo; then exit 9; fi
test ! -f "$lease/firewall-armed"
grep -q 'ufw --force delete allow in on br-1b-s1' "$lease/withdrawn"
test -f "$lease/owner"`);
});
