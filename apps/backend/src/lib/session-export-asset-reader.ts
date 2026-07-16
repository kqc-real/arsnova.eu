import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function candidateAssetRoots(): string[] {
  const cwd = process.cwd();
  const fromEnv = process.env.SESSION_EXPORT_ASSET_ROOT?.trim();
  const candidates = [
    fromEnv,
    // Production Docker: lokalisiertes Angular-Build unter apps/frontend/dist/{locale}
    join(cwd, 'apps/frontend/dist/de/assets'),
    join(cwd, 'apps/frontend/dist/en/assets'),
    join(cwd, 'apps/frontend/dist/assets'),
    join(cwd, 'apps/frontend/src/assets'),
    join(cwd, '../frontend/src/assets'),
    join(cwd, '../../apps/frontend/src/assets'),
  ].filter(Boolean) as string[];
  return [...new Set(candidates.map((path) => resolve(path)))];
}

export async function readSessionExportLocalAsset(
  relativePath: string,
): Promise<Uint8Array | null> {
  const normalized = relativePath.replace(/^\/+/, '');
  for (const root of candidateAssetRoots()) {
    try {
      const data = await readFile(join(root, normalized));
      return new Uint8Array(data);
    } catch {
      // nächster Kandidat
    }
  }
  return null;
}
