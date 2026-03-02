#!/usr/bin/env node
/**
 * Generates PWA icons and favicon from favicon.svg (EU-Flagge: blaues Quadrat, gelber EU-Stern).
 * Run: node apps/frontend/scripts/generate-icons.mjs
 */
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// sharp aus Root- oder Frontend-node_modules (Workspace-Hoisting)
const require = createRequire(join(__dirname, '..', '..', '..', 'package.json'));
const sharp = require('sharp');

const iconsDir = join(__dirname, '..', 'src', 'assets', 'icons');
// Einheitliche Quelle: EU-Flaggen-Icon für alle PWA-Icons und Favicon
const iconSvgPath = join(iconsDir, 'favicon.svg');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(iconSvgPath)
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `icon-${size}x${size}.png`));
  console.log(`Generated icon-${size}x${size}.png`);
}

// Maskable: EU-Icon mit Safe-Zone (10 % Inset), Hintergrund EU-Blau
const maskSize = 512;
const padding = Math.round(maskSize * 0.1);
const inner = maskSize - padding * 2;
const innerBuf = await sharp(iconSvgPath).resize(inner, inner).png().toBuffer();
await sharp({
  create: { width: maskSize, height: maskSize, channels: 4, background: { r: 0, g: 51, b: 153, alpha: 1 } },
})
  .composite([{ input: innerBuf, left: padding, top: padding }])
  .png()
  .toFile(join(iconsDir, `icon-maskable-${maskSize}x${maskSize}.png`));
console.log(`Generated icon-maskable-${maskSize}x${maskSize}.png`);

// Apple touch icon (180x180)
await sharp(iconSvgPath)
  .resize(180, 180)
  .png()
  .toFile(join(iconsDir, `apple-touch-icon.png`));
console.log('Generated apple-touch-icon.png');

// Favicon 32x32 und 16x16
await sharp(iconSvgPath)
  .resize(32, 32)
  .png()
  .toFile(join(iconsDir, `favicon-32x32.png`));
console.log('Generated favicon-32x32.png');

await sharp(iconSvgPath)
  .resize(16, 16)
  .png()
  .toFile(join(iconsDir, `favicon-16x16.png`));
console.log('Generated favicon-16x16.png');
