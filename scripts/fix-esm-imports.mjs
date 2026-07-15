/**
 * Patches relative imports in dist/*.js for Node ESM (requires explicit .js extensions).
 * Source may use extensionless paths for Angular/Webpack workspace resolution.
 *
 * Usage:
 *   node scripts/fix-esm-imports.mjs [distDir ...]
 * Defaults to libs/shared-types/dist and libs/session-export-report/dist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const defaultDistDirs = [
  path.join(repoRoot, 'libs/shared-types/dist'),
  path.join(repoRoot, 'libs/session-export-report/dist'),
];

function patchRelativeImports(source) {
  return source.replace(
    /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
    (match, prefix, specifier, suffix) => {
      if (specifier.endsWith('.js')) {
        return match;
      }
      return `${prefix}${specifier}.js${suffix}`;
    },
  );
}

function patchDistDir(distDir) {
  if (!fs.existsSync(distDir)) {
    console.error(`fix-esm-imports: dist directory missing: ${distDir}`);
    process.exit(1);
  }

  let patchedFiles = 0;
  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }
    const filePath = path.join(distDir, entry.name);
    const original = fs.readFileSync(filePath, 'utf8');
    const patched = patchRelativeImports(original);
    if (patched !== original) {
      fs.writeFileSync(filePath, patched);
      patchedFiles += 1;
    }
  }

  const label = path.relative(repoRoot, distDir) || distDir;
  console.log(`fix-esm-imports: patched ${patchedFiles} file(s) in ${label}/`);
}

const distDirs =
  process.argv.length > 2 ? process.argv.slice(2).map((arg) => path.resolve(arg)) : defaultDistDirs;

for (const distDir of distDirs) {
  patchDistDir(distDir);
}
