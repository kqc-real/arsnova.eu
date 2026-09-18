import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isEmptyHistoryOnExistingSchema,
  listMigrationNames,
  migrateDeployArgs,
  migrateResolveAppliedArgs,
  runMigrateDeploy,
} from './migrate-dev-database.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('migrate-dev-database', () => {
  it('ruft prisma migrate deploy mit dem Repo-Schema auf', () => {
    assert.deepEqual(migrateDeployArgs(), [
      'migrate',
      'deploy',
      '--schema',
      'prisma/schema.prisma',
    ]);
  });

  it('erkennt eine nicht-leere Dev-DB ohne Migrationshistorie', () => {
    assert.equal(isEmptyHistoryOnExistingSchema({ message: 'Error: P3005' }), true);
    assert.equal(isEmptyHistoryOnExistingSchema({ message: 'P3018' }), false);
  });

  it('baselined eine P3005-Dev-DB und deployt anschließend erneut', () => {
    const calls = [];
    let deployAttempts = 0;
    runMigrateDeploy((_bin, args) => {
      calls.push(args);
      if (args[1] === 'deploy') {
        deployAttempts += 1;
        if (deployAttempts === 1) {
          throw Object.assign(new Error('P3005'), { status: 1 });
        }
      }
    });
    assert.equal(deployAttempts, 2);
    assert.deepEqual(calls[0], migrateDeployArgs());
    assert.deepEqual(calls[1], migrateResolveAppliedArgs(listMigrationNames()[0]));
    assert.deepEqual(calls.at(-1), migrateDeployArgs());
    assert.ok(calls.length > 2);
  });

  it('leitet andere Deploy-Fehler an den Reset-Hinweis weiter', () => {
    assert.throws(
      () =>
        runMigrateDeploy(() => {
          throw Object.assign(new Error('P3018'), { status: 1 });
        }),
      /P3018/,
    );
  });

  it('bindet die lokalen Dev-Skripte an migrate deploy statt db push', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.match(pkg.scripts.dev, /migrate-dev-database\.mjs/);
    assert.match(pkg.scripts['setup:dev'], /prisma:migrate/);
    assert.doesNotMatch(pkg.scripts['setup:dev'], /prisma:push/);
    assert.equal(
      pkg.scripts['prisma:migrate'],
      'prisma migrate deploy --schema prisma/schema.prisma',
    );
  });
});
