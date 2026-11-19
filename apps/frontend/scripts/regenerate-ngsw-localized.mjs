#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['de', 'en', 'fr', 'it', 'es'];
const buildMeta = /<meta name="arsnova-pwa-build" content="[a-f0-9]+">/g;

function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? htmlFiles(file)
      : entry.isFile() && entry.name.endsWith('.html')
        ? [file]
        : [];
  });
}

/** Stamp the loaded document and the SW's latest version with the same content identity. */
export function regenerateLocalizedServiceWorkers({
  browserRoot = path.join(frontendRoot, 'dist/browser'),
  serverRoot = path.join(frontendRoot, 'dist/server'),
  configFile = path.join(frontendRoot, 'ngsw-config.json'),
  ngswCli = path.resolve(frontendRoot, '../../node_modules/@angular/service-worker/ngsw-config.js'),
} = {}) {
  if (!fs.existsSync(browserRoot)) {
    console.warn('regenerate-ngsw-localized: dist/browser fehlt, ueberspringe.');
    return;
  }
  if (!fs.existsSync(ngswCli)) throw new Error(`ngsw-config CLI nicht gefunden: ${ngswCli}`);

  for (const locale of locales) {
    const localeDir = path.join(browserRoot, locale);
    if (!fs.existsSync(localeDir)) continue;
    const documents = [...htmlFiles(localeDir), ...htmlFiles(path.join(serverRoot, locale))];
    // Remove our previous stamp before hashing, so regenerating a build is idempotent.
    for (const file of documents) {
      const html = fs.readFileSync(file, 'utf8').replace(buildMeta, '');
      if (!html.includes('</head>')) throw new Error(`HTML ohne </head>: ${file}`);
      fs.writeFileSync(file, html);
    }
    const generate = () =>
      execFileSync(
        process.execPath,
        [
          ngswCli,
          path.relative(path.dirname(configFile), localeDir),
          path.basename(configFile),
          `/${locale}/`,
        ],
        { cwd: path.dirname(configFile) },
      );
    generate();
    const manifestPath = path.join(localeDir, 'ngsw.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // Angular's generated timestamp alone does not represent changed application content.
    const buildId = createHash('sha256')
      .update(JSON.stringify({ ...manifest, timestamp: 0 }))
      .digest('hex');
    for (const file of documents) {
      const html = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(
        file,
        html.replace('</head>', `<meta name="arsnova-pwa-build" content="${buildId}"></head>`),
      );
    }
    // Recompute integrity hashes after stamping HTML; never modify hashed JS/CSS assets.
    generate();
    const finalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    finalManifest.appData = { ...finalManifest.appData, pwaBuildId: buildId };
    fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2) + '\n');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  regenerateLocalizedServiceWorkers();
}
