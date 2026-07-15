/**
 * Thin wrapper: package-local build still runs via `npm run build -w @arsnova/shared-types`.
 * Canonical implementation lives in scripts/fix-esm-imports.mjs.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const script = path.join(repoRoot, 'scripts/fix-esm-imports.mjs');
const distDir = path.join(packageRoot, 'dist');

const result = spawnSync(process.execPath, [script, distDir], { stdio: 'inherit' });
process.exit(result.status ?? 1);
