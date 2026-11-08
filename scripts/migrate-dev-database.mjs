#!/usr/bin/env node
/**
 * Wendet die versionierten Prisma-Migrationen auf die lokale Dev-DB an.
 * `npm run dev` und `setup:dev` nutzen diesen Pfad statt `prisma db push`
 * oder der ALTER-Liste in ensure-schema.mjs.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedMotdFeatureSql, seedMotdMakingOfSql, seedMotdWelcomeSql } from './ensure-schema.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const PRISMA_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'prisma');
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS_DIR = join(REPO_ROOT, 'prisma', 'migrations');

export function migrateDeployArgs() {
  return ['migrate', 'deploy', '--schema', SCHEMA];
}

export function migrateResolveAppliedArgs(name) {
  return ['migrate', 'resolve', '--applied', name, '--schema', SCHEMA];
}

export function listMigrationNames(migrationsDir = MIGRATIONS_DIR) {
  return readdirSync(migrationsDir)
    .filter((name) => {
      if (!/^\d{14}_/.test(name)) return false;
      return existsSync(join(migrationsDir, name, 'migration.sql'));
    })
    .sort();
}

function execPrisma(exec, args, { quietSuccess = false } = {}) {
  try {
    const output = exec(PRISMA_BIN, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    });
    if (!quietSuccess && typeof output === 'string' && output) process.stdout.write(output);
    return output;
  } catch (error) {
    if (typeof error?.stdout === 'string' && error.stdout) process.stdout.write(error.stdout);
    if (typeof error?.stderr === 'string' && error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

function combinedOutput(error) {
  return [error?.message, error?.stdout, error?.stderr].filter(Boolean).join('\n');
}

export function isEmptyHistoryOnExistingSchema(error) {
  return /P3005/.test(combinedOutput(error));
}

export function baselineExistingDevSchema(
  exec = execFileSync,
  names = listMigrationNames(),
  { quietSuccess = false } = {},
) {
  console.log(
    `Die vorhandene Datenbank wird einmalig mit ${names.length} gespeicherten Datenbank-Aktualisierungen abgeglichen …`,
  );
  for (const name of names) {
    execPrisma(exec, migrateResolveAppliedArgs(name), { quietSuccess });
  }
}

export function runMigrateDeploy(exec = execFileSync, { quietSuccess = false } = {}) {
  try {
    execPrisma(exec, migrateDeployArgs(), { quietSuccess });
    return;
  } catch (error) {
    if (!isEmptyHistoryOnExistingSchema(error)) {
      console.error('>>> prisma migrate deploy fehlgeschlagen.');
      console.error(
        '>>> Die lokale Dev-DB muss über versionierte Migrationen laufen, nicht über prisma db push.',
      );
      console.error(
        '>>> Nach einem irreparablen Schema: docker compose down -v && npm run docker:up:dev && npm run prisma:migrate',
      );
      throw error;
    }
    baselineExistingDevSchema(exec, listMigrationNames(), { quietSuccess });
    execPrisma(exec, migrateDeployArgs(), { quietSuccess });
  }
}

function main() {
  const migrationCount = listMigrationNames().length;
  console.log('Datenbank wird geprüft …');
  runMigrateDeploy(execFileSync, { quietSuccess: true });
  console.log(
    `✓ Datenbank bereit: ${migrationCount} vorbereitete Aktualisierungen wurden geprüft; fehlende Aktualisierungen wurden automatisch eingespielt.`,
  );
  console.log('Hinweise für die Startseite werden vorbereitet …');
  seedMotdWelcomeSql(false);
  seedMotdMakingOfSql(false);
  seedMotdFeatureSql(false);
  console.log('✓ Startseiten-Hinweise geprüft: Willkommen, Making-of und aktuelle Funktionen.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const code = error && typeof error === 'object' && 'status' in error ? error.status : 1;
    process.exit(typeof code === 'number' && code > 0 ? code : 1);
  }
}
