import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
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

  it('ersetzt abgelehnte externe Bilder fail-closed ohne Original-URL', async () => {
    const fetchExternalImage = vi.fn().mockRejectedValue(new Error('blocked target'));
    const originalUrl = 'https://images.example.test/internal.png';

    const inlined = await inlineExportImagesInHtml(`<img src="${originalUrl}" alt="x" />`, {
      fetchExternal: true,
      fetchExternalImage,
      replaceUnresolvedImages: true,
    });

    expect(fetchExternalImage).toHaveBeenCalledOnce();
    expect(inlined).not.toContain(originalUrl);
    expect(inlined).toContain('src="data:image/gif;base64,');
  });

  it('übernimmt Bytes und geprüften MIME-Typ des externen Loaders', async () => {
    const fetchExternalImage = vi.fn().mockResolvedValue({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mimeType: 'image/png',
    });
    const src = 'https://images.example.test/no-extension';

    const inlined = await inlineExportImagesInHtml(
      `<img src="${src}" alt="a" /><img src="${src}" alt="b" />`,
      {
        fetchExternal: true,
        fetchExternalImage,
        replaceUnresolvedImages: true,
      },
    );

    expect(fetchExternalImage).toHaveBeenCalledOnce();
    expect(inlined).not.toContain(src);
    expect(inlined.match(/src="data:image\/png;base64,/g)).toHaveLength(2);
  });

  it('begrenzt unterschiedliche Bildquellen pro Report', async () => {
    const fetchExternalImage = vi.fn().mockResolvedValue({
      bytes: new Uint8Array([1]),
      mimeType: 'image/png',
    });
    const html = [1, 2, 3]
      .map((index) => `<img src="https://images.example.test/${index}.png" alt="${index}" />`)
      .join('');

    const inlined = await inlineExportImagesInHtml(html, {
      fetchExternal: true,
      fetchExternalImage,
      replaceUnresolvedImages: true,
      maxImages: 2,
    });

    expect(fetchExternalImage).toHaveBeenCalledTimes(2);
    expect(inlined).not.toContain('https://images.example.test/');
    expect(inlined.match(/data:image\/gif;base64,/g)).toHaveLength(1);
  });
});
