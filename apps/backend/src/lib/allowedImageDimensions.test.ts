import { describe, expect, it } from 'vitest';
import { readAllowedImageDimensions } from './allowedImageDimensions';

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00,
  ]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegSof(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);
}

function webpVp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  const w = width - 1;
  const h = height - 1;
  bytes[24] = w & 0xff;
  bytes[25] = (w >> 8) & 0xff;
  bytes[26] = (w >> 16) & 0xff;
  bytes[27] = h & 0xff;
  bytes[28] = (h >> 8) & 0xff;
  bytes[29] = (h >> 16) & 0xff;
  return bytes;
}

describe('readAllowedImageDimensions', () => {
  it('liest PNG-IHDR-Dimensionen', () => {
    expect(readAllowedImageDimensions(pngHeader(640, 480), 'image/png')).toEqual({
      width: 640,
      height: 480,
    });
  });

  it('liest JPEG-SOF-Dimensionen', () => {
    expect(readAllowedImageDimensions(jpegSof(320, 240), 'image/jpeg')).toEqual({
      width: 320,
      height: 240,
    });
  });

  it('liest WebP-VP8X-Dimensionen', () => {
    expect(readAllowedImageDimensions(webpVp8x(100, 50), 'image/webp')).toEqual({
      width: 100,
      height: 50,
    });
  });

  it('lehnt korrupte Buffer ab', () => {
    expect(readAllowedImageDimensions(new Uint8Array([1, 2, 3]), 'image/png')).toBeNull();
    expect(readAllowedImageDimensions(pngHeader(1, 1), 'image/jpeg')).toBeNull();
  });
});
