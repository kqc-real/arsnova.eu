import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { regenerateLocalizedServiceWorkers } from '../../apps/frontend/scripts/regenerate-ngsw-localized.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('build identities cover all locales, prerender/SSR documents and preserve SW integrity', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arsnova-pwa-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const browserRoot = path.join(root, 'browser');
  const serverRoot = path.join(root, 'server');
  const configFile = path.join(root, 'ngsw-config.json');
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      index: '/index.html',
      appData: { existing: 'preserved' },
      assetGroups: [
        { name: 'app', installMode: 'prefetch', resources: { files: ['/**', '!/ngsw.json'] } },
      ],
    }),
  );
  for (const locale of ['de', 'en', 'fr', 'it', 'es']) {
    for (const dir of [path.join(browserRoot, locale, 'help'), path.join(serverRoot, locale)]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    for (const name of ['index.html', 'help/index.html']) {
      fs.writeFileSync(
        path.join(browserRoot, locale, name),
        `<html><head><title>${locale}</title></head><body></body></html>`,
      );
    }
    fs.writeFileSync(
      path.join(serverRoot, locale, 'index.server.html'),
      '<html><head></head><body></body></html>',
    );
    fs.writeFileSync(path.join(browserRoot, locale, 'main.js'), 'console.log("unchanged")');
  }
  const options = {
    browserRoot,
    serverRoot,
    configFile,
    ngswCli: path.join(repoRoot, 'node_modules/@angular/service-worker/ngsw-config.js'),
  };
  const readManifest = (locale) =>
    JSON.parse(fs.readFileSync(path.join(browserRoot, locale, 'ngsw.json'), 'utf8'));
  regenerateLocalizedServiceWorkers(options);
  const identities = {};
  for (const locale of ['de', 'en', 'fr', 'it', 'es']) {
    const manifest = readManifest(locale);
    identities[locale] = manifest.appData.pwaBuildId;
    assert.match(identities[locale], /^[a-f0-9]{64}$/);
    assert.equal(manifest.appData.existing, 'preserved');
    for (const file of [
      path.join(browserRoot, locale, 'index.html'),
      path.join(browserRoot, locale, 'help/index.html'),
      path.join(serverRoot, locale, 'index.server.html'),
    ]) {
      assert.match(
        fs.readFileSync(file, 'utf8'),
        new RegExp(`name="arsnova-pwa-build" content="${identities[locale]}"`),
      );
    }
    const index = fs.readFileSync(path.join(browserRoot, locale, 'index.html'));
    assert.equal(
      manifest.hashTable[`/${locale}/index.html`],
      createHash('sha1').update(index).digest('hex'),
    );
    assert.equal(
      fs.readFileSync(path.join(browserRoot, locale, 'main.js'), 'utf8'),
      'console.log("unchanged")',
    );
  }
  // No timestamp-only changes or accumulating meta tags on repeated generation.
  regenerateLocalizedServiceWorkers(options);
  assert.equal(readManifest('de').appData.pwaBuildId, identities.de);
  assert.equal(
    (
      fs
        .readFileSync(path.join(browserRoot, 'de/index.html'), 'utf8')
        .match(/arsnova-pwa-build/g) ?? []
    ).length,
    1,
  );
  fs.writeFileSync(path.join(browserRoot, 'de/main.js'), 'console.log("new version")');
  regenerateLocalizedServiceWorkers(options);
  assert.notEqual(readManifest('de').appData.pwaBuildId, identities.de);
  assert.equal(readManifest('en').appData.pwaBuildId, identities.en);
});
