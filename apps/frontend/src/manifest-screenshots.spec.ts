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

  it('liefert acht Wide- und fünf Narrow-Shots mit identischem Seitenverhältnis', () => {
    const shots = manifest.screenshots ?? [];
    expect(shots).toHaveLength(13);

    const wide = shots.filter((shot) => shot.form_factor === 'wide');
    const narrow = shots.filter((shot) => shot.form_factor === 'narrow');
    expect(wide.map((shot) => shot.sizes)).toEqual(Array(8).fill('1920x1080'));
    expect(narrow.map((shot) => shot.sizes)).toEqual(Array(5).fill('440x956'));

    const files = shots.map((shot) => shot.src.split('?')[0]?.split('/').pop());
    expect(files).toEqual([
      'screenshot-wide.png',
      'screenshot-wide-lobby.png',
      'screenshot-wide-quiz.png',
      'screenshot-wide-present.png',
      'screenshot-wide-cloud.png',
      'screenshot-wide-qa.png',
      'screenshot-wide-feedback.png',
      'screenshot-wide-leaderboard.png',
      'screenshot-narrow.png',
      'screenshot-narrow-quiz.png',
      'screenshot-narrow-cloud.png',
      'screenshot-narrow-qa.png',
      'screenshot-narrow-feedback.png',
    ]);
    for (const shot of shots) {
      expect(shot.src).toMatch(/\?v=10$/);
      const file = shot.src.split('?')[0]?.split('/').pop();
      expect(file && existsSync(join(iconsDir, file))).toBe(true);
      if (file) {
        const png = readFileSync(join(iconsDir, file));
        expect(png.readUInt32BE(16)).toBe(shot.form_factor === 'wide' ? 1920 : 440);
        expect(png.readUInt32BE(20)).toBe(shot.form_factor === 'wide' ? 1080 : 956);
      }
    }
  });

  it('übersetzt Labels anhand des Dateinamens, nicht nur des Formfaktors', async () => {
    const patcherUrl = pathToFileURL(
      join(srcRoot, '../scripts/patch-pwa-manifest-per-locale.mjs'),
    ).href;
    const { applyScreenshotLabels, MANIFEST_I18N, screenshotLabelKey } = await import(patcherUrl);

    expect(screenshotLabelKey('/assets/icons/screenshot-wide-quiz.png?v=10')).toBe(
      'screenshotWideQuiz',
    );
    expect(screenshotLabelKey('/assets/icons/screenshot-wide.png?v=10')).toBe('screenshotWide');
    expect(screenshotLabelKey('/assets/icons/screenshot-wide-lobby.png?v=10')).toBe(
      'screenshotWideLobby',
    );
    expect(screenshotLabelKey('/assets/icons/screenshot-narrow-qa.png?v=10')).toBe(
      'screenshotNarrowQa',
    );

    const screenshots = structuredClone(manifest.screenshots ?? []);
    applyScreenshotLabels(screenshots, MANIFEST_I18N.en);
    expect(screenshots.map((shot) => shot.label)).toEqual([
      'Quiz, Q&A and live feedback – no sign-up',
      'Join with a QR code – no account',
      'Quiz, Q&A and live feedback in one session',
      'Presenter view for lecture halls',
      'Live word cloud from the audience',
      'Audience Q&A – no login',
      'Mood check in seconds',
      'Team leaderboard with nicknames',
      'Join live without an account',
      'Vote on your phone – no account',
      'Open answers become a word cloud',
      'Ask a question anonymously',
      'Mood check with one tap',
    ]);
  });
});

describe('PWA-Manifest-Shortcuts', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    shortcuts?: Array<{
      name?: string;
      short_name?: string;
      description?: string;
      url?: string;
      icons?: Array<{ src: string; sizes: string }>;
    }>;
  };

  it('liefert vier Homescreen-Shortcuts mit 192er-Icons in Hero-Reihenfolge', () => {
    const shortcuts = manifest.shortcuts ?? [];
    expect(shortcuts.map((item) => item.name)).toEqual([
      'Code eingeben',
      'Quiz erstellen',
      'Q&A öffnen',
      'Blitzlicht starten',
    ]);
    expect(shortcuts.map((item) => item.url)).toEqual([
      '/join?homescreen=1',
      '/quiz/new?homescreen=1',
      '/?homescreen=1&host=qa',
      '/?homescreen=1&host=quickFeedback',
    ]);
    for (const shortcut of shortcuts) {
      const icon = shortcut.icons?.[0];
      expect(icon?.sizes).toBe('192x192');
      expect(icon?.src).toMatch(/\?v=3$/);
      const file = icon?.src.split('?')[0]?.split('/').pop();
      expect(file && existsSync(join(iconsDir, file))).toBe(true);
      if (file) {
        const png = readFileSync(join(iconsDir, file));
        expect(png.readUInt32BE(16)).toBe(192);
        expect(png.readUInt32BE(20)).toBe(192);
      }
    }
  });

  it('übersetzt Shortcut-Texte und setzt Locale-Präfixe in den URLs', async () => {
    const patcherUrl = pathToFileURL(
      join(srcRoot, '../scripts/patch-pwa-manifest-per-locale.mjs'),
    ).href;
    const { applyShortcutCopy, MANIFEST_I18N, localizeShortcutUrl, shortcutCopyPrefix } =
      await import(patcherUrl);

    expect(shortcutCopyPrefix('/join?homescreen=1')).toBe('shortcutJoin');
    expect(shortcutCopyPrefix('/quiz/new?homescreen=1')).toBe('shortcutQuiz');
    expect(shortcutCopyPrefix('/?homescreen=1&host=qa')).toBe('shortcutQa');
    expect(shortcutCopyPrefix('/?homescreen=1&host=quickFeedback')).toBe('shortcutFeedback');
    expect(localizeShortcutUrl('/join?homescreen=1', 'en')).toBe('/en/join?homescreen=1');
    expect(localizeShortcutUrl('/?homescreen=1&host=qa', 'fr')).toBe('/fr/?homescreen=1&host=qa');

    const shortcuts = structuredClone(manifest.shortcuts ?? []);
    applyShortcutCopy(shortcuts, MANIFEST_I18N.en, 'en');
    expect(shortcuts.map((item) => item.name)).toEqual([
      'Enter the code',
      'Create quiz',
      'Open Q&A',
      'Start pulse check',
    ]);
    expect(shortcuts.map((item) => item.url)).toEqual([
      '/en/join?homescreen=1',
      '/en/quiz/new?homescreen=1',
      '/en/?homescreen=1&host=qa',
      '/en/?homescreen=1&host=quickFeedback',
    ]);
  });
});
