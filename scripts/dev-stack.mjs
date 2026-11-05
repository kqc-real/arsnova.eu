#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const profiles = {
  nlp: {
    processNames: ['server', 'web', 'lemmatisierung', 'themen'],
    processColors: ['blue', 'green', 'magenta', 'cyan'],
    commands: [
      'npm run dev:backend:nlp',
      'npm run start:LOCALE -w @arsnova/frontend',
      'npm run spacy:dev',
      'npm run encoder:dev',
    ],
    freePortArguments: [],
    killOthersOnFail: false,
  },
  summary: {
    processNames: ['server', 'web', 'zusammenfassung', 'lemmatisierung', 'themen'],
    processColors: ['blue', 'green', 'yellow', 'magenta', 'cyan'],
    commands: [
      'npm run dev:backend:nlp',
      'npm run start:LOCALE -w @arsnova/frontend',
      'npm run qa-summary:dev',
      'npm run spacy:dev',
      'npm run encoder:dev',
    ],
    freePortArguments: [],
    killOthersOnFail: false,
  },
  ai: {
    processNames: ['server', 'web', 'zusammenfassung', 'lemmatisierung', 'themen'],
    processColors: ['blue', 'green', 'yellow', 'magenta', 'cyan'],
    commands: [
      'npm run dev:backend:ai',
      'npm run start:LOCALE -w @arsnova/frontend',
      'npm run qa-summary:dev:extractive',
      'npm run spacy:dev',
      'npm run encoder:dev',
    ],
    freePortArguments: ['--ports=3000,3001,3002,4200,8787', '--require-open-weight-llm'],
    killOthersOnFail: true,
  },
};

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  return (
    process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
  );
}

const profileName = argumentValue('profile', 'nlp');
const locale = argumentValue('locale', 'de');
const profile = profiles[profileName];

if (!profile || !['de', 'en'].includes(locale)) {
  console.error(
    'Der Entwicklungsstarter wurde mit einem unbekannten Profil oder Locale aufgerufen.',
  );
  console.error('Profile: nlp, summary, ai · Locales: de, en');
  process.exit(1);
}

const commands = profile.commands.map((command) => command.replace('LOCALE', locale));
const profileEnvironment = {
  ...(profileName === 'ai' ? { OPEN_WEIGHT_LLM_ENABLED: 'true' } : {}),
  ...(profileName === 'summary'
    ? {
        QA_NLP_ENABLED: 'true',
        QA_SUMMARY_ENABLED: 'true',
        QA_SUMMARY_INFERENCE_URL: 'http://127.0.0.1:8787/summary',
      }
    : {}),
};
const environment = { ...process.env, ...profileEnvironment };

if (process.argv.includes('--describe')) {
  console.log(
    JSON.stringify({
      ...profile,
      commands,
      enabledEnvironment: profileEnvironment,
      locale,
      profile: profileName,
    }),
  );
  process.exit(0);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`Konnte ${command} nicht starten: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('');
console.log('arsnova.eu wird für die lokale Entwicklung vorbereitet');
console.log('Datenbank, App-Anschlüsse und KI-Dienste werden geprüft.');
console.log('');

run(process.execPath, ['scripts/migrate-dev-database.mjs']);
run(process.execPath, ['scripts/free-dev-ports.mjs', ...profile.freePortArguments]);
run(process.execPath, [
  'scripts/dev-stack-status.mjs',
  `--profile=${profileName}`,
  `--locale=${locale}`,
]);

run(join(root, 'node_modules/.bin/concurrently'), [
  ...(profile.killOthersOnFail ? ['--kill-others-on-fail'] : []),
  '-n',
  profile.processNames.join(','),
  '-c',
  profile.processColors.join(','),
  ...commands,
]);
