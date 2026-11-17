import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'macos-spacy-wordcloud-dev.sh');

function run(args) {
  return spawnSync('bash', [script, ...args], { encoding: 'utf8' });
}

test('macos-spacy-wordcloud-dev.sh ist syntaktisch gültiges Bash', () => {
  const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('--help nennt Demo-Quiz, Clean, Produktions-Build und Locales', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Demo-Quiz als Host, nicht als Voter/);
  assert.match(result.stdout, /Was hilft dir beim Lernen/);
  assert.match(result.stdout, /build:prod/);
  assert.match(result.stdout, /clean:generated/);
  assert.match(result.stdout, /start:prod/);
  assert.match(result.stdout, /serve:localize:api/);
  assert.match(result.stdout, /localhost:4200\/de\//);
  assert.match(result.stdout, /localhost:4200\/fr\//);
  assert.match(result.stdout, /seed:session-votes/);
  assert.match(result.stdout, /seed:qa-forum/);
  assert.match(result.stdout, /seed:moderation-compass/);
  assert.match(result.stdout, /Moderationskompass/);
  assert.match(result.stdout, /Ein ng serve reicht nicht/);
});

test('prueft spaCy-Modelle de/en/fr/es und italienische Lookup-Daten', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /spacy_lookups_data/);
  assert.match(source, /fr_core_news_sm/);
  assert.match(source, /es_core_news_sm/);
  assert.match(source, /Sprachformen glätten in de\/en\/fr\/es\/it/);
  assert.match(source, /http:\/\/localhost:4200\/it\//);
});

test('setzt ein lokales YJS_SHARE_TOKEN_SECRET fuer start:prod', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /YJS_SHARE_TOKEN_SECRET/);
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /dump_backend_log/);
});

test('setzt npm_config_prefix zurück, bevor nvm geladen wird', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /unset npm_config_prefix NPM_CONFIG_PREFIX/);
});

test('run_seeds übergibt Q&A-Flags literal, ohne $qa_flag', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /seed:qa-forum -w @arsnova\/backend -- --code "\$CODE" --replace/);
  assert.match(source, /seed:qa-forum -w @arsnova\/backend -- --code "\$CODE" --append/);
  assert.match(source, /seed:moderation-compass -w @arsnova\/backend -- --code "\$CODE"/);
  assert.match(source, /Button Moderation/);
  assert.match(source, /session\/\$\{CODE\}\/host/);
  assert.match(source, /Voter-Join/);
  assert.doesNotMatch(source, /\$qa_flag/);
});

test('wendet das Prisma-Schema an, bevor Host-Session und Seeds laufen', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /npm run prisma:migrate/);
  assert.match(source, /npm run prisma:generate/);
  assert.match(source, /wait_for_postgres/);
  const help = run(['--help']);
  assert.match(help.stdout, /prisma:migrate/);
});

test('lehnt einen ungültigen Session-Code ab, bevor Clean oder Build startet', () => {
  const result = run(['--code', 'nope']);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /Ungültiger Session-Code/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /clean:generated/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /build:prod/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Starte Host-Sidecar/);
});

test('require_localized_dist listet fehlende Locale-Dateien', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /Fehlende Build-Artefakte/);
  assert.match(source, /dist\/browser\/de\/index\.html/);
  assert.match(source, /dist\/browser\/it\/index\.html/);
  assert.match(source, /apps\/backend\/dist\/index\.js/);
  assert.match(source, /ng serve auf 4200 reicht nicht/);
});

test('wählt für das spaCy-venv nur Python 3.10–3.13 und ersetzt ein altes venv', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(
    source,
    /for candidate in python3\.13 python3\.12 python3\.11 python3\.10 python3; do/,
  );
  assert.match(source, /\(3, 10\) <= sys\.version_info\[:2\] < \(3, 14\)/);
  assert.match(source, /if "\$candidate" -m venv --clear "\$venv_dir"; then/);
  assert.match(source, /versuche den nächsten Interpreter/);
  assert.doesNotMatch(source, /^\s*python3 -m venv/m);
});

test('prüft Italienisch und startet nur einen verwalteten alten Sidecar neu', () => {
  const directory = mkdtempSync(join(tmpdir(), 'arsnova-spacy-upgrade-'));
  try {
    const pidFile = join(directory, 'sidecar.pid');
    const probesFile = join(directory, 'probes');
    for (const scenario of ['ready', 'managed', 'external', 'busy', 'still-busy']) {
      writeFileSync(probesFile, '');
      writeFileSync(pidFile, '123\n');
      const result = spawnSync(
        'bash',
        [
          '-c',
          `
source "$1"
scenario="$2"
sidecar_healthy() { return 0; }
curl() {
  [[ "$*" == *'"locale":"it"'* && "$*" == *"$SOCKET"* ]] || return 1
  printf '.' >>"$PROBES_FILE"
  case "$scenario" in
    busy) if [[ "$(cat "$PROBES_FILE")" == . ]]; then printf 503; else printf 200; fi ;;
    still-busy) printf 503 ;;
    ready) printf 200 ;;
    *) if [[ "$(cat "$SIDECAR_PID_FILE")" == 123 ]]; then printf 400; else printf 200; fi ;;
  esac
}
ps() {
  if [[ "$scenario" != external ]]; then printf '%s' "python $ROOT/docker/spacy/server.py"; fi
}
kill() {
  if [[ "$1" == -0 ]]; then return 1; fi
  printf 'stopped %s\n' "$1"
}
nohup() { :; }
sleep() { [[ "$1" == 1 ]]; }
start_sidecar python
`,
          'sidecar-upgrade-test',
          script,
          scenario,
        ],
        {
          encoding: 'utf8',
          timeout: 5000,
          env: {
            ...process.env,
            NLP_SOCKET_PATH: join(directory, 'sidecar.sock'),
            NLP_SIDECAR_PID_FILE: pidFile,
            NLP_SIDECAR_LOG: join(directory, 'sidecar.log'),
            PROBES_FILE: probesFile,
          },
        },
      );
      const output = result.stdout + result.stderr;
      assert.equal(
        result.status,
        scenario === 'external' || scenario === 'still-busy' ? 1 : 0,
        output,
      );
      if (scenario === 'busy') {
        assert.match(output, /Sidecar läuft bereits mit italienischer Glättung/);
        assert.equal(readFileSync(probesFile, 'utf8'), '..');
      }
      if (scenario === 'still-busy') {
        assert.equal(readFileSync(probesFile, 'utf8'), '...');
        assert.match(output, /weiterhin ausgelastet/);
      }
      if (scenario === 'managed') {
        assert.match(output, /stopped 123/);
        assert.match(output, /Sidecar ist bereit und unterstützt italienische Glättung/);
        assert.notEqual(readFileSync(pidFile, 'utf8').trim(), '123');
      } else {
        assert.doesNotMatch(output, /stopped|Starte Host-Sidecar/);
        assert.equal(readFileSync(pidFile, 'utf8').trim(), '123');
      }
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
