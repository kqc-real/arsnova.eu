import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ServiceWorkerConfig {
  index?: unknown;
  navigationRequestStrategy?: unknown;
  assetGroups?: Array<{
    name?: unknown;
    resources?: { files?: unknown };
  }>;
}

describe('CSP-Rollout im Service Worker', () => {
  it('holt Online-Navigationen frisch statt HTML-Header aus dem App-Shell-Cache zu konservieren', () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), 'ngsw-config.json'), 'utf8'),
    ) as ServiceWorkerConfig;

    expect(config.index).toBe('/index.html');
    expect(config.navigationRequestStrategy).toBe('freshness');
    expect(
      config.assetGroups?.find((group) => group.name === 'app-shell')?.resources?.files instanceof
        Array,
    ).toBe(true);
  });
});
