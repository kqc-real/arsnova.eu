import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = dirname(fileURLToPath(import.meta.url));
const repoRootPkg = join(srcRoot, '../../../package.json');
const require = createRequire(repoRootPkg);
const sharp = require('sharp') as typeof import('sharp');
const iconsDir = join(srcRoot, 'assets/icons');

const { starPixelsOutsideSafeZone } = await import(
  pathToFileURL(join(srcRoot, '../scripts/generate-icons.mjs')).href
);

async function inspect(file: string) {
  const { data, info } = await sharp(join(iconsDir, file)).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return starPixelsOutsideSafeZone(data, info.width, info.height);
}

function purposeTokens(purpose: string | undefined): string[] {
  return String(purpose ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

describe('PWA-Icons Maskable-Safe-Zone', () => {
  it('hält den Stern in den any-Icons innerhalb des 80%-Kreises', async () => {
    const small = await inspect('icon-72x72.png');
    const mid = await inspect('icon-192x192.png');
    const large = await inspect('icon-512x512.png');
    expect(small.starPixels).toBeGreaterThan(8);
    expect(mid.starPixels).toBeGreaterThan(40);
    expect(large.starPixels).toBeGreaterThan(80);
    expect(small.outside).toEqual([]);
    expect(mid.outside).toEqual([]);
    expect(large.outside).toEqual([]);
  });

  it('hält den Stern in den Maskable-Icons innerhalb des 80%-Kreises', async () => {
    const small = await inspect('icon-maskable-192x192.png');
    const large = await inspect('icon-maskable-512x512.png');
    expect(small.starPixels).toBeGreaterThan(20);
    expect(large.starPixels).toBeGreaterThan(40);
    expect(small.outside).toEqual([]);
    expect(large.outside).toEqual([]);
  });

  it('deklariert any und maskable als getrennte Icon-Einträge', () => {
    const manifest = JSON.parse(readFileSync(join(srcRoot, 'manifest.webmanifest'), 'utf8')) as {
      icons?: Array<{ sizes?: string; purpose?: string; src?: string }>;
    };
    const icons = manifest.icons ?? [];
    for (const icon of icons) {
      const tokens = purposeTokens(icon.purpose);
      expect(tokens.includes('any') && tokens.includes('maskable')).toBe(false);
    }

    const icons512 = icons.filter((icon) => icon.sizes === '512x512');
    expect(icons512).toHaveLength(2);
    const any512 = icons512.find((icon) => purposeTokens(icon.purpose).join(' ') === 'any');
    const maskable512 = icons512.find(
      (icon) => purposeTokens(icon.purpose).join(' ') === 'maskable',
    );
    expect(any512?.src).toContain('icon-512x512.png');
    expect(maskable512?.src).toContain('icon-maskable-512x512.png');

    const maskable192 = icons.find(
      (icon) => icon.sizes === '192x192' && purposeTokens(icon.purpose).join(' ') === 'maskable',
    );
    expect(maskable192?.src).toContain('icon-maskable-192x192.png');
  });
});
