import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import { CspReportIngest, readCspReportSignals, type MinimizedCspReport } from './cspReportIngest';

const RUN_REDIS = process.env['RUN_REDIS_CSP_REPORT_TESTS'] === '1';

async function deleteTestKeys(): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys('csp:*');
  if (keys.length > 0) await redis.del(...keys);
}

describe.skipIf(!RUN_REDIS)('CSP-Report-Ingest mit echtem Redis', () => {
  beforeEach(deleteTestKeys);

  afterAll(async () => {
    await deleteTestKeys();
    await closeRedis();
  });

  it('begrenzt global-first atomar und erzeugt nach dem Cap keine IP-Keys', async () => {
    const now = () => 1_720_000_000_000;
    const ingest = new CspReportIngest({
      hashSecret: 'redis-integration-test-secret',
      now,
      config: { globalPerMinute: 3, ipPerMinute: 120 },
    });
    const decisions = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        ingest.ingest(`2001:db8::${index + 1}`, [{ effectiveDirective: 'script-src' }]),
      ),
    );

    expect(decisions.filter((decision) => decision.status === 'accepted')).toHaveLength(3);
    expect(decisions.filter((decision) => decision.status === 'rate-limited')).toHaveLength(17);
    expect(await getRedis().keys('csp:rl:ip:*')).toHaveLength(3);
    await expect(readCspReportSignals(now())).resolves.toMatchObject({
      receivedLastMinute: 3,
      rateLimitedLastMinute: 17,
    });
  });

  it('hält das Distinct-Cap auch bei Race auf 256 und setzt Retention-TTLs', async () => {
    const now = () => 1_720_000_000_000;
    const ingest = new CspReportIngest({
      hashSecret: 'redis-integration-test-secret',
      now,
      config: { globalPerMinute: 6_000, ipPerMinute: 120, retentionSeconds: 600 },
    });
    const reports: MinimizedCspReport[] = Array.from({ length: 300 }, (_, index) => ({
      effectiveDirective: `directive-${index}`,
      blockedUri: `https://example.invalid/${index}`,
    }));
    await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        ingest.ingest(`198.51.100.${index + 1}`, reports.slice(index * 10, index * 10 + 10)),
      ),
    );

    const [membersKey] = await getRedis().keys('csp:dimensions:*:members');
    const [countsKey] = await getRedis().keys('csp:dimensions:*:counts');
    expect(membersKey).toBeDefined();
    expect(countsKey).toBeDefined();
    expect(await getRedis().scard(membersKey!)).toBe(256);
    expect(await getRedis().hlen(countsKey!)).toBe(256);
    expect(await getRedis().ttl(membersKey!)).toBeGreaterThan(0);
    expect(await getRedis().ttl(membersKey!)).toBeLessThanOrEqual(600);
  });

  it('isoliert 500 CSP-Clients derselben NAT-IP von den übrigen App-Pfaden', async () => {
    const ingest = new CspReportIngest({
      hashSecret: 'redis-integration-test-secret',
      now: () => 1_720_000_000_000,
      config: { globalPerMinute: 6_000, ipPerMinute: 120 },
    });
    const decisions = await Promise.all(
      Array.from({ length: 500 }, () =>
        ingest.ingest('203.0.113.9', [{ effectiveDirective: 'script-src' }]),
      ),
    );

    expect(decisions.filter((decision) => decision.status === 'accepted')).toHaveLength(120);
    expect(decisions.filter((decision) => decision.status === 'rate-limited')).toHaveLength(380);
    expect(await getRedis().keys('csp:rl:ip:*')).toHaveLength(1);
    expect(await getRedis().keys('rl:*')).toHaveLength(0);
  });
});
