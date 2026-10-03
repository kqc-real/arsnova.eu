import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '../..');

describe('word-cloud analysis cache rollout contract', () => {
  it('drains the writer and purges all cache generations before retention and app start', () => {
    const compose = readFileSync(resolve(repositoryRoot, 'docker-compose.prod.yml'), 'utf8');
    const dockerfile = readFileSync(resolve(repositoryRoot, 'Dockerfile'), 'utf8');
    const deploy = readFileSync(resolve(repositoryRoot, 'scripts/deploy.sh'), 'utf8');
    const entrypoint = readFileSync(
      resolve(repositoryRoot, 'scripts/docker-entrypoint.sh'),
      'utf8',
    );
    const migrationRunner = readFileSync(
      resolve(repositoryRoot, 'apps/backend/src/runWordCloudCacheMigration.ts'),
      'utf8',
    );
    const backendEntrypoint = readFileSync(
      resolve(repositoryRoot, 'apps/backend/src/index.ts'),
      'utf8',
    );
    const redisClient = readFileSync(resolve(repositoryRoot, 'apps/backend/src/redis.ts'), 'utf8');
    const services = compose.slice(compose.indexOf('services:'), compose.indexOf('\nnetworks:'));

    expect(services.match(/^ {2}app:$/gm)).toHaveLength(1);
    expect(services.match(/container_name: arsnova-v3-app/g)).toHaveLength(1);
    expect(dockerfile).toContain('ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]');
    expect(dockerfile).toContain('CMD ["node", "apps/backend/dist/index.js"]');
    expect(deploy).toContain('runWordCloudCacheMigration');
    expect(migrationRunner).toContain('evictAllWordCloudAnalysisCacheForRollout');
    expect(migrationRunner).toContain('evictLegacySessionBoundQuickFeedbackForRollout');
    expect(
      migrationRunner.indexOf('evictLegacySessionBoundQuickFeedbackForRollout()'),
    ).toBeGreaterThan(migrationRunner.indexOf('evictAllWordCloudAnalysisCacheForRollout()'));
    expect(migrationRunner).not.toContain('evictLegacyWordCloudAnalysisSnapshots');

    const migrationGate = entrypoint.indexOf(
      'node apps/backend/dist/runWordCloudCacheMigration.js',
    );
    const appStart = entrypoint.indexOf('exec "$@"');
    expect(entrypoint).toContain('set -eu');
    expect(entrypoint).toContain(
      '[ "$#" -ge 2 ] && [ "$1" = "node" ] && [ "$2" = "apps/backend/dist/index.js" ]',
    );
    expect(migrationGate).toBeGreaterThan(-1);
    expect(appStart).toBeGreaterThan(migrationGate);
    expect(entrypoint).toContain('Word-Cloud-/Blitzlicht-Rollout-Purge nach Writer-Drain');
    expect(entrypoint).not.toContain('|| true');

    const migrate = deploy.indexOf('prisma migrate deploy');
    const writerStop = deploy.indexOf('compose stop app');
    const rolloutPurgeCommand = deploy.indexOf(
      'app node /app/apps/backend/dist/runWordCloudCacheMigration.js',
    );
    const rolloutPurgeCalls = [...deploy.matchAll(/^run_wordcloud_all_cache_purge$/gm)].map(
      (match) => match.index ?? -1,
    );
    const retention = deploy.indexOf('node /app/apps/backend/dist/runRetentionCleanup.js');
    const candidatePersist = deploy.indexOf(
      'write_atomic_snapshot "$PURGE_RUNNER_CANDIDATE_STATE_FILE" "$ARSNOVA_IMAGE" "$DEPLOY_SHA"',
    );
    const appRollout = deploy.indexOf('compose up -d pdf-worker app');
    const stateCommit = deploy.indexOf('case "$DEPLOY_MODE" in', appRollout);
    const candidateClear = deploy.indexOf('rm -f -- "$PURGE_RUNNER_CANDIDATE_STATE_FILE"');
    expect(writerStop).toBeGreaterThan(migrate);
    expect(rolloutPurgeCommand).toBeGreaterThan(writerStop);
    expect(rolloutPurgeCalls).toHaveLength(2);
    expect(rolloutPurgeCalls[0]).toBeGreaterThan(writerStop);
    expect(retention).toBeGreaterThan(rolloutPurgeCalls[0] ?? -1);
    expect(rolloutPurgeCalls[1]).toBeGreaterThan(retention);
    expect(candidatePersist).toBeGreaterThan(rolloutPurgeCalls[1] ?? -1);
    expect(appRollout).toBeGreaterThan(candidatePersist);
    expect(stateCommit).toBeGreaterThan(appRollout);
    expect(candidateClear).toBeGreaterThan(stateCommit);
    expect(deploy).toContain('ACTIVE_APP_IMAGE="$(docker inspect');
    expect(deploy).toContain('PURGE_RUNNER_STATE_FILE=');
    expect(deploy).toContain('-e WORD_CLOUD_PURGE_REQUIRE_DURABILITY=1');

    const shutdown = backendEntrypoint.slice(
      backendEntrypoint.indexOf('async function shutdown()'),
    );
    const blockWrites = shutdown.indexOf('beginWordCloudAnalysisCacheShutdown()');
    const startHttpDrain = shutdown.indexOf('const httpDrain = closeHttpServer()');
    const awaitDrains = shutdown.indexOf('await Promise.all([');
    const blockRedisReopen = shutdown.indexOf('beginRedisShutdown()');
    const closeRedis = shutdown.indexOf('await closeRedis()');
    expect(blockWrites).toBeGreaterThan(-1);
    expect(startHttpDrain).toBeGreaterThan(blockWrites);
    expect(awaitDrains).toBeGreaterThan(startHttpDrain);
    expect(blockRedisReopen).toBeGreaterThan(awaitDrains);
    expect(closeRedis).toBeGreaterThan(blockRedisReopen);
    expect(shutdown).not.toContain('server.close();');
    expect(redisClient).toContain("throw new Error('REDIS_SHUTTING_DOWN')");
  });
});
