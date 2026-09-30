import '@angular/compiler';
import '@angular/localize/init';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { afterEach } from 'vitest';

// jsdom cannot parse Angular Material's generated CSS and logs noisy
// "Could not parse CSS stylesheet" errors. Patch stderr to suppress them.
const _origStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
  if (typeof chunk === 'string' && chunk.includes('Could not parse CSS stylesheet')) return true;
  return (_origStderrWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
}) as typeof process.stderr.write;

setupTestBed({ zoneless: true });

afterEach(() => {
  // Optional: Heap zwischen schweren Host-Specs freigeben (nur mit --expose-gc).
  (
    globalThis as typeof globalThis & {
      gc?: () => void;
    }
  ).gc?.();
});
