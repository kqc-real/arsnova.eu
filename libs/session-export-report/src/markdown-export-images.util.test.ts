import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetRelativePathFromSrc, inlineExportImagesInHtml } from './markdown-export-images.util';

function assetRootCandidates(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, '../../apps/frontend/src/assets'),
    join(cwd, '../../../apps/frontend/src/assets'),
  ].map((path) => resolve(path));
}

async function readTestAsset(relativePath: string): Promise<Uint8Array | null> {
  for (const root of assetRootCandidates()) {
    try {
      const data = await readFile(join(root, relativePath));
      return new Uint8Array(data);
    } catch {
      // nächster Kandidat
    }
  }
  return null;
}

describe('inlineExportImagesInHtml', () => {
  it('extrahiert Asset-Pfade', () => {
    expect(assetRelativePathFromSrc('/assets/demo/x.png')).toBe('demo/x.png');
    expect(assetRelativePathFromSrc('http://127.0.0.1:4200/assets/demo/x.png')).toBe('demo/x.png');
  });

  it('ersetzt lokale Assets durch data-URLs', async () => {
    const html =
      '<img src="http://127.0.0.1:4200/assets/demo/Bettgestell%20auf%20der%20Dachspitze.png" alt="x" loading="eager" decoding="async" />';
    const inlined = await inlineExportImagesInHtml(html, {
      readLocalAsset: readTestAsset,
      fetchExternal: false,
    });

    expect(inlined).toContain('src="data:image/png;base64,');
  });
});
