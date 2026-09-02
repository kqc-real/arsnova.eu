#!/usr/bin/env node
/**
 * Generates PWA icons, shortcut icons, and favicon from favicon.svg (EU-Flagge)
 * plus einfache Glyph-Shortcuts. Run: npm run icons -w @arsnova/frontend
 *
 * purpose „any“ und „maskable“ sind getrennte Manifest-Einträge. Die Grafik
 * ist dieselbe: der Stern sitzt in favicon.svg in der 80%-Safe-Zone, damit
 * Android und die DevTools-Kreismaske keine Zacken abschneiden.
 */
import { createRequire } from 'module';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', '..', '..', 'package.json'));
const sharp = require('sharp');

const iconsDir = join(__dirname, '..', 'src', 'assets', 'icons');
const iconSvgPath = join(iconsDir, 'favicon.svg');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
const EU_BLUE = '#003399';
const EU_YELLOW = '#FFCC00';

export const SHORTCUT_ICONS = [
  {
    file: 'shortcut-join.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="${EU_BLUE}"/>
  <rect x="28" y="54" width="40" height="34" rx="8" fill="${EU_YELLOW}"/>
  <rect x="76" y="54" width="40" height="34" rx="8" fill="${EU_YELLOW}"/>
  <rect x="124" y="54" width="40" height="34" rx="8" fill="${EU_YELLOW}"/>
  <rect x="28" y="104" width="40" height="34" rx="8" fill="${EU_YELLOW}"/>
  <rect x="76" y="104" width="40" height="34" rx="8" fill="${EU_YELLOW}"/>
  <rect x="124" y="104" width="40" height="34" rx="8" fill="${EU_YELLOW}"/>
</svg>`,
  },
  {
    file: 'shortcut-quiz.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="${EU_BLUE}"/>
  <rect x="50" y="32" width="92" height="128" rx="14" fill="${EU_YELLOW}"/>
  <rect x="68" y="56" width="56" height="10" rx="3" fill="${EU_BLUE}"/>
  <rect x="68" y="76" width="56" height="10" rx="3" fill="${EU_BLUE}"/>
  <rect x="68" y="96" width="36" height="10" rx="3" fill="${EU_BLUE}"/>
  <path d="M72 128 L86 142 L122 102" fill="none" stroke="${EU_BLUE}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  },
  {
    file: 'shortcut-qa.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="${EU_BLUE}"/>
  <path d="M36 58c0-16 14-30 44-30h28c30 0 44 14 44 30v28c0 16-14 30-44 30H78l-28 22 8-22c-16-4-22-14-22-30z" fill="${EU_YELLOW}"/>
  <circle cx="80" cy="78" r="7" fill="${EU_BLUE}"/>
  <circle cx="104" cy="78" r="7" fill="${EU_BLUE}"/>
  <circle cx="128" cy="78" r="7" fill="${EU_BLUE}"/>
</svg>`,
  },
  {
    file: 'shortcut-feedback.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="${EU_BLUE}"/>
  <path d="M112 24 L48 104 H90 L70 168 L152 80 H108 Z" fill="${EU_YELLOW}"/>
</svg>`,
  },
];

/** Chrome/W3C: Safe-Zone ist ein Kreis mit Durchmesser 80 % der kürzeren Kante. */
export function maskableSafeRadius(size) {
  return (Math.min(size, size) * 0.8) / 2;
}

/**
 * Zählt Kernpixel des gelben Sterns außerhalb der Maskable-Safe-Zone.
 * Antialiasing am Rand bleibt unberücksichtigt (nur kräftiges EU-Gelb).
 */
export function starPixelsOutsideSafeZone(raw, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = maskableSafeRadius(width);
  const outside = [];
  let starPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      const a = raw[i + 3];
      if (a < 220) continue;
      const isStar = r >= 220 && g >= 160 && g <= 230 && b <= 40;
      if (!isStar) continue;
      starPixels += 1;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > maxR) {
        outside.push({ x, y, d });
      }
    }
  }
  return { starPixels, outside };
}

export async function readRgbaPng(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function assertStarInsideSafeZone(filePath) {
  const { data, width, height } = await readRgbaPng(filePath);
  const { starPixels, outside } = starPixelsOutsideSafeZone(data, width, height);
  if (starPixels < 8) {
    throw new Error(
      `${filePath}: zu wenige Sternpixel (${starPixels}) — Icon leer oder Farbe falsch.`,
    );
  }
  if (outside.length > 0) {
    throw new Error(
      `${filePath}: ${outside.length}/${starPixels} Sternpixel außerhalb der 80%-Safe-Zone (z. B. ${outside[0].x},${outside[0].y}).`,
    );
  }
}

export async function generateIcons() {
  for (const size of sizes) {
    await sharp(iconSvgPath)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }

  await sharp(iconSvgPath).resize(180, 180).png().toFile(join(iconsDir, `apple-touch-icon.png`));
  console.log('Generated apple-touch-icon.png');

  await sharp(iconSvgPath).resize(32, 32).png().toFile(join(iconsDir, `favicon-32x32.png`));
  console.log('Generated favicon-32x32.png');

  await sharp(iconSvgPath).resize(16, 16).png().toFile(join(iconsDir, `favicon-16x16.png`));
  console.log('Generated favicon-16x16.png');

  await generateShortcutIcons();
  await generateMaskableIcons();

  await assertStarInsideSafeZone(join(iconsDir, 'icon-72x72.png'));
  await assertStarInsideSafeZone(join(iconsDir, 'icon-192x192.png'));
  await assertStarInsideSafeZone(join(iconsDir, 'icon-512x512.png'));
  await assertStarInsideSafeZone(join(iconsDir, 'icon-maskable-192x192.png'));
  await assertStarInsideSafeZone(join(iconsDir, 'icon-maskable-512x512.png'));
  console.log('Safe-Zone: Stern in any- und Maskable-Icons innerhalb des 80%-Kreises.');
}

export async function generateShortcutIcons() {
  for (const icon of SHORTCUT_ICONS) {
    await sharp(Buffer.from(icon.svg)).resize(192, 192).png().toFile(join(iconsDir, icon.file));
    console.log(`Generated ${icon.file}`);
  }
}

export async function generateMaskableIcons() {
  for (const size of MASKABLE_SIZES) {
    await sharp(iconSvgPath)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-maskable-${size}x${size}.png`));
    console.log(`Generated icon-maskable-${size}x${size}.png`);
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  await generateIcons();
}
