#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src', 'assets', 'icons');

// Manifest: background_color #1c1b1f, theme_color #6750a4 (Material 3)
const bg = { r: 28, g: 27, b: 31, alpha: 1 };
const primary = { r: 103, g: 80, b: 164 };

async function createScreenshot(width, height, label, filename) {
  const svgOverlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${width * 0.1}" y="${height * 0.15}" width="${width * 0.8}" height="${height * 0.08}" rx="12" fill="rgb(${primary.r},${primary.g},${primary.b})" opacity="0.2"/>
      <text x="${width / 2}" y="${height * 0.38}" text-anchor="middle" font-family="Roboto,system-ui,sans-serif" font-weight="700" font-size="${Math.round(width * 0.08)}" fill="white">arsnova.eu</text>
      <text x="${width / 2}" y="${height * 0.5}" text-anchor="middle" font-family="Roboto,system-ui,sans-serif" font-weight="400" font-size="${Math.round(width * 0.03)}" fill="rgb(163,159,171)">Live-Quiz &amp; Abstimmung für Hochschulen</text>
      <rect x="${width * 0.3}" y="${height * 0.58}" width="${width * 0.4}" height="${height * 0.07}" rx="20" fill="rgb(${primary.r},${primary.g},${primary.b})"/>
      <text x="${width / 2}" y="${height * 0.625}" text-anchor="middle" font-family="Roboto,system-ui,sans-serif" font-weight="600" font-size="${Math.round(width * 0.025)}" fill="white">Session erstellen</text>
      <text x="${width / 2}" y="${height * 0.92}" text-anchor="middle" font-family="Roboto,system-ui,sans-serif" font-size="${Math.round(width * 0.02)}" fill="rgb(121,116,126)">100 % DSGVO-konform · Open Source · Kostenlos</text>
    </svg>`;

  await sharp({ create: { width, height, channels: 4, background: bg } })
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toFile(join(iconsDir, filename));
  console.log(`Generated ${filename} (${width}x${height})`);
}

await createScreenshot(1920, 1080, 'Desktop', 'screenshot-wide.png');
await createScreenshot(440, 956, 'Mobile', 'screenshot-narrow.png');
