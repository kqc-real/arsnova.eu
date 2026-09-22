import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  resolve(process.cwd(), 'src/app/shared/styles/session-channel-card-lead-icon.scss'),
  'utf8',
);

describe('Session-Kanal Lead-Icon-Kachel', () => {
  it('folgt der umrandeten Startseiten-/Dialog-Kachel (Primary-Glyph, transparent)', () => {
    expect(styles).toMatch(
      /\.session-channel-card__header-lead-icon \{[^}]*background:\s*transparent/s,
    );
    expect(styles).toMatch(
      /\.session-channel-card__header-lead-icon \{[^}]*color:\s*var\(--mat-sys-primary\)/s,
    );
    expect(styles).toMatch(
      /\.session-channel-card__header-lead-icon \{[^}]*border:\s*1\.5px solid color-mix\(in srgb, var\(--mat-sys-outline\)/s,
    );
    expect(styles).not.toMatch(/primary-container/);
  });
});
