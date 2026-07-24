import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

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
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes('\0')) {
    return null;
  }
  for (const root of candidateAssetRoots()) {
    try {
      const realRoot = await realpath(root);
      const candidate = resolve(realRoot, relativePath);
      const candidateRelative = relative(realRoot, candidate);
      if (
        candidateRelative === '' ||
        candidateRelative.startsWith(`..${sep}`) ||
        candidateRelative === '..' ||
        isAbsolute(candidateRelative)
      ) {
        continue;
      }
      const realCandidate = await realpath(candidate);
      const realCandidateRelative = relative(realRoot, realCandidate);
      if (
        realCandidateRelative.startsWith(`..${sep}`) ||
        realCandidateRelative === '..' ||
        isAbsolute(realCandidateRelative)
      ) {
        continue;
      }
      const data = await readFile(realCandidate);
      return new Uint8Array(data);
    } catch {
      // nächster Kandidat
    }
  }
  return null;
}
