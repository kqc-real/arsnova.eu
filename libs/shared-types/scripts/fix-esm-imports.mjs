/**
 * Patches relative imports in dist/*.js for Node ESM (requires explicit .js extensions).
 * Source may use extensionless paths for Angular/Webpack workspace resolution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

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

if (!fs.existsSync(distDir)) {
  console.error('fix-esm-imports: dist directory missing — run tsc first');
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

console.log(`fix-esm-imports: patched ${patchedFiles} file(s) in dist/`);
