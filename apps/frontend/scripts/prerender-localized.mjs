#!/usr/bin/env node
import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const angularBuildPrivatePath = require.resolve('@angular/build/private', {
  paths: [__dirname, path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..')],
});

let zoneNodePath = null;
try {
  zoneNodePath = require.resolve('zone.js/node', {
    paths: [__dirname, path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..')],
  });
} catch {
  zoneNodePath = null;
}

if (zoneNodePath) {
  await import(pathToFileURL(zoneNodePath).href);
}
const { InlineCriticalCssProcessor } = await import(pathToFileURL(angularBuildPrivatePath).href);

const browserRoot = path.join(__dirname, '..', 'dist', 'browser');
const serverRoot = path.join(__dirname, '..', 'dist', 'server');

const LOCALES = ['de', 'en', 'fr', 'it', 'es'];
const ROUTES = ['/', '/help', '/news-archive', '/quiz', '/legal/imprint', '/legal/privacy'];

function stripLeadingSlash(route) {
  return route.startsWith('/') ? route.slice(1) : route;
}

function isBootstrapFn(value) {
  return typeof value === 'function' && !('ɵmod' in value);
}

async function renderRoute({
  document,
  route,
  outputPath,
  serverBundlePath,
  inlineCriticalCssProcessor,
}) {
  const serverBundle = require(serverBundlePath);
  const {
    ɵSERVER_CONTEXT,
    AppServerModule,
    renderModule,
    renderApplication,
    default: bootstrapAppFn,
  } = serverBundle;

  assert(ɵSERVER_CONTEXT, `ɵSERVER_CONTEXT was not exported from: ${serverBundlePath}.`);

  const platformProviders = [
    {
      provide: ɵSERVER_CONTEXT,
      useValue: 'ssg',
    },
  ];

  let html;
  if (isBootstrapFn(bootstrapAppFn)) {
    assert(renderApplication, `renderApplication was not exported from: ${serverBundlePath}.`);
    html = await renderApplication(bootstrapAppFn, {
      document,
      url: route,
      platformProviders,
    });
  } else {
    assert(renderModule, `renderModule was not exported from: ${serverBundlePath}.`);
    const moduleClass = bootstrapAppFn || AppServerModule;
    assert(
      moduleClass,
      `Neither an AppServerModule nor a bootstrapping function was exported from: ${serverBundlePath}.`,
    );
    html = await renderModule(moduleClass, {
      document,
      url: route,
      extraProviders: platformProviders,
    });
  }

  const { content, errors, warnings } = await inlineCriticalCssProcessor.process(html, { outputPath });
  if ((errors?.length ?? 0) > 0) {
    throw new Error(errors.join('\n'));
  }
  for (const warning of warnings ?? []) {
    console.warn(warning);
  }

  return content;
}

async function main() {
  const inlineCriticalCssProcessor = new InlineCriticalCssProcessor({
    deployUrl: '',
    minify: true,
  });

  for (const locale of LOCALES) {
    const outputPath = path.join(browserRoot, locale);
    const serverBundlePath = path.join(serverRoot, locale, 'main.js');
    const indexPath = path.join(outputPath, 'index.html');
    const indexOriginalPath = path.join(outputPath, 'index.original.html');

    if (!fs.existsSync(indexPath)) {
      throw new Error(`Missing localized browser index for ${locale}: ${indexPath}`);
    }
    if (!fs.existsSync(serverBundlePath)) {
      throw new Error(`Missing localized server bundle for ${locale}: ${serverBundlePath}`);
    }

    fs.copyFileSync(indexPath, indexOriginalPath);
    const document = await fs.promises.readFile(indexOriginalPath, 'utf8');
    console.log(`Prerendering ${ROUTES.length} route(s) to ${outputPath}...`);

    for (const route of ROUTES) {
      const html = await renderRoute({
        document,
        route,
        outputPath,
        serverBundlePath,
        inlineCriticalCssProcessor,
      });

      const routePath = stripLeadingSlash(route);
      const routeDir = routePath ? path.join(outputPath, routePath) : outputPath;
      await fs.promises.mkdir(routeDir, { recursive: true });
      await fs.promises.writeFile(path.join(routeDir, 'index.html'), html, 'utf8');
    }

    console.log(`Prerendering routes to ${outputPath} complete.`);
  }
}

await main();
