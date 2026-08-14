import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(srcRoot, 'manifest.webmanifest');
const iconsDir = join(srcRoot, 'assets/icons');

describe('PWA-Manifest-Screenshots', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    screenshots?: Array<{ src: string; sizes: string; form_factor?: string; label?: string }>;
  };

  it('liefert je drei Wide- und Narrow-Shots mit identischem Seitenverhältnis', () => {
    const shots = manifest.screenshots ?? [];
    expect(shots).toHaveLength(6);

    const wide = shots.filter((shot) => shot.form_factor === 'wide');
    const narrow = shots.filter((shot) => shot.form_factor === 'narrow');
    expect(wide.map((shot) => shot.sizes)).toEqual(['1280x720', '1280x720', '1280x720']);
    expect(narrow.map((shot) => shot.sizes)).toEqual(['390x844', '390x844', '390x844']);

    const files = shots.map((shot) => shot.src.split('?')[0]?.split('/').pop());
    expect(files).toEqual([
      'screenshot-wide.png',
      'screenshot-wide-quiz.png',
      'screenshot-wide-cloud.png',
      'screenshot-narrow.png',
      'screenshot-narrow-quiz.png',
      'screenshot-narrow-cloud.png',
    ]);
    for (const shot of shots) {
      expect(shot.src).toMatch(/\?v=7$/);
      const file = shot.src.split('?')[0]?.split('/').pop();
      expect(file && existsSync(join(iconsDir, file))).toBe(true);
    }
  });

  it('übersetzt Labels anhand des Dateinamens, nicht nur des Formfaktors', async () => {
    const patcherUrl = pathToFileURL(
      join(srcRoot, '../scripts/patch-pwa-manifest-per-locale.mjs'),
    ).href;
    const { applyScreenshotLabels, MANIFEST_I18N, screenshotLabelKey } = await import(patcherUrl);

    expect(screenshotLabelKey('/assets/icons/screenshot-wide-quiz.png?v=7')).toBe(
      'screenshotWideQuiz',
    );
    expect(screenshotLabelKey('/assets/icons/screenshot-wide.png?v=7')).toBe('screenshotWide');

    const screenshots = structuredClone(manifest.screenshots ?? []);
    applyScreenshotLabels(screenshots, MANIFEST_I18N.en);
    expect(screenshots.map((shot) => shot.label)).toEqual([
      'arsnova.eu – Home',
      'arsnova.eu – Live demo quiz',
      'arsnova.eu – Word cloud from the demo quiz',
      'arsnova.eu – Home on a phone',
      'arsnova.eu – Voting in the demo quiz',
      'arsnova.eu – Open response in the demo quiz',
    ]);
  });
});
