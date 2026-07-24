import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readSessionExportLocalAsset } from './session-export-asset-reader';

describe('readSessionExportLocalAsset', () => {
  let tempDirectory: string;
  let assetRoot: string;
  let previousAssetRoot: string | undefined;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'arsnova-export-assets-'));
    assetRoot = join(tempDirectory, 'assets');
    await mkdir(assetRoot);
    previousAssetRoot = process.env.SESSION_EXPORT_ASSET_ROOT;
    process.env.SESSION_EXPORT_ASSET_ROOT = assetRoot;
  });

  afterEach(async () => {
    if (previousAssetRoot === undefined) {
      delete process.env.SESSION_EXPORT_ASSET_ROOT;
    } else {
      process.env.SESSION_EXPORT_ASSET_ROOT = previousAssetRoot;
    }
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('liest reguläre Dateien innerhalb des Asset-Roots', async () => {
    await mkdir(join(assetRoot, 'demo'));
    await writeFile(join(assetRoot, 'demo', 'image.png'), new Uint8Array([1, 2, 3]));

    await expect(readSessionExportLocalAsset('demo/image.png')).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it.each(['/etc/passwd', '../outside.png', 'demo/../../outside.png', '\0image.png'])(
    'lehnt absoluten oder traversierenden Pfad %s ab',
    async (path) => {
      await writeFile(join(tempDirectory, 'outside.png'), new Uint8Array([9]));

      await expect(readSessionExportLocalAsset(path)).resolves.toBeNull();
    },
  );

  it('lehnt Symlinks auf Dateien außerhalb des Asset-Roots ab', async () => {
    const outside = join(dirname(assetRoot), `${basename(assetRoot)}-secret.png`);
    await writeFile(outside, new Uint8Array([9, 9, 9]));
    await symlink(outside, join(assetRoot, 'linked.png'));

    await expect(readSessionExportLocalAsset('linked.png')).resolves.toBeNull();
  });
});
